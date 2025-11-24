// app/api/document/receipt/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { withApiGuard } from '@/lib/api/guard';
import { FormDataFatura, ItemFatura, TotaisFatura, Emitente, Destinatario } from '@/types/invoice-types';

interface ApiError { code: string; message: string; details?: unknown }
interface ApiResponse<T = unknown> { success: boolean; data?: T; error?: ApiError }

interface ReceiptData {
  formData: {
    reciboNumero: string;
    dataRecebimento: string;
    dataPagamento?: string;
    valorRecebido: number;
    formaPagamento?: string;
    referenciaPagamento?: string;
    documentoAssociadoCustom?: string;
    motivoPagamento?: string;
    moeda?: string;
    ordemCompra?: string;
    termos?: string;
    emitente: Emitente;
    destinatario?: Destinatario;
    status?: 'emitida' | 'paga';
  };
  items?: ItemFatura[];
  totais?: TotaisFatura;
  logo?: string;
  assinatura?: string;
  htmlContent?: string;
}

interface RequestBody { documentData: ReceiptData }

const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  DOCUMENT_ALREADY_EXISTS: 'DOCUMENT_ALREADY_EXISTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export const POST = withApiGuard(async (request: NextRequest, { user }) => {
  const startTime = Date.now();
  let receiptId: string | null = null;
  let documentData: ReceiptData | null = null;

  try {
    const supabase = await supabaseServer();

    let body: RequestBody;
    try {
      body = await request.json();
    } catch (parseError) {
      await logger.logError(parseError as Error, 'parse_receipt_request_body', {
        endpoint: '/api/document/receipt/create',
        method: 'POST',
        user: user.id
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'JSON inválido',
          details: 'O corpo da requisição deve ser um JSON válido'
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    documentData = body.documentData as ReceiptData;

    if (!documentData) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Dados do recibo não fornecidos',
        details: {
          user: user.id,
          endpoint: '/api/document/receipt/create'
        }
      });

      return NextResponse.json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'documentData ausente' } }, { status: 400 });
    }

    const { formData, items, totais, logo, assinatura } = documentData;

    await logger.log({
      action: 'document_create',
      level: 'info',
      message: `Tentativa de criação de recibo: ${formData?.reciboNumero}`,
      details: {
        user: user.id,
        tipo: 'recibo',
        numero: formData?.reciboNumero,
        emitente: formData?.emitente?.nomeEmpresa,
        destinatario: formData?.destinatario?.nomeCompleto,
        valorRecebido: formData?.valorRecebido,
        formaPagamento: formData?.formaPagamento
      }
    });

    // Definir data atual caso não venha dataRecebimento
    if (!formData?.dataRecebimento) {
      formData.dataRecebimento = new Date().toISOString().split('T')[0];
    }

    // Campos obrigatórios já tratados pelo schema

    // Preparar dados completos do recibo para o RPC (chaves esperadas pela função unificada)
    const reciboData = {
      // Identificadores do número (manter ambos para compatibilidade)
      reciboNumero: formData.reciboNumero,
      faturaNumero: formData.reciboNumero,
      // Datas
      dataFatura: formData.dataRecebimento, // usado como data base
      dataRecebimento: formData.dataRecebimento,
      dataPagamento: formData.dataPagamento || null,
      dataVencimento: null,
      // Valores / pagamento
      valorRecebido: formData.valorRecebido,
      formaPagamento: formData.formaPagamento || null,
      // Referências
      referenciaPagamento: formData.referenciaPagamento || null,
      documentoAssociadoCustom: formData.documentoAssociadoCustom || null,
      motivoPagamento: formData.motivoPagamento || null,
      // Outros campos opcionais
      ordemCompra: formData.ordemCompra || null,
      termos: formData.termos || (formData.formaPagamento ? `Forma de pagamento: ${formData.formaPagamento}` : null),
      moeda: formData.moeda || 'MT',
      metodoPagamento: formData.formaPagamento || null,
      logoUrl: logo || null,
      assinaturaBase64: assinatura || null
    };

    // ===== BLOCO RPC UNIFICADO PARA RECIBO =====
    // Adaptar para nova função criar_documento_completo
    const ensureEmissor = async () => {
      const emissor: Emitente = formData.emitente;
      let emissorId: string | null = null;
      if (emissor?.documento) {
        const { data: foundByDoc } = await supabase
          .from('emissores')
          .select('id')
          .eq('user_id', user.id)
          .eq('documento', emissor.documento)
          .maybeSingle();
        emissorId = foundByDoc?.id ?? null;
      }
      if (!emissorId && emissor?.nomeEmpresa) {
        const { data: foundByName } = await supabase
          .from('emissores')
          .select('id')
          .eq('user_id', user.id)
          .eq('nome_empresa', emissor.nomeEmpresa)
          .maybeSingle();
        emissorId = foundByName?.id ?? null;
      }
      if (!emissorId) {
        const { data: created } = await supabase
          .from('emissores')
          .insert({
            user_id: user.id,
            nome_empresa: emissor?.nomeEmpresa ?? 'Empresa',
            documento: emissor?.documento ?? '',
            pais: emissor?.pais ?? '',
            cidade: emissor?.cidade ?? '',
            bairro: emissor?.bairro ?? '',
            pessoa_contato: emissor?.pessoaContato ?? null,
            email: emissor?.email ?? '',
            telefone: emissor?.telefone ?? ''
          })
          .select('id')
          .single();
        emissorId = created?.id ?? null;
      }
      return emissorId as string;
    };

    const ensureDestinatario = async () => {
      const dest: Destinatario | undefined = formData.destinatario;
      if (!dest) return null;
      let destinatarioId: string | null = null;
      if (dest?.documento) {
        const { data: foundByDoc } = await supabase
          .from('destinatarios')
          .select('id')
          .eq('user_id', user.id)
          .eq('documento', dest.documento)
          .maybeSingle();
        destinatarioId = foundByDoc?.id ?? null;
      }
      if (!destinatarioId && dest?.nomeCompleto) {
        const { data: foundByName } = await supabase
          .from('destinatarios')
          .select('id')
          .eq('user_id', user.id)
          .eq('nome_completo', dest.nomeCompleto)
          .maybeSingle();
        destinatarioId = foundByName?.id ?? null;
      }
      if (!destinatarioId) {
        const { data: created } = await supabase
          .from('destinatarios')
          .insert({
            user_id: user.id,
            nome_completo: dest?.nomeCompleto ?? 'Cliente',
            documento: dest?.documento ?? null,
            pais: dest?.pais ?? null,
            cidade: dest?.cidade ?? null,
            bairro: dest?.bairro ?? null,
            email: dest?.email ?? '',
            telefone: dest?.telefone ?? ''
          })
          .select('id')
          .single();
        destinatarioId = created?.id ?? null;
      }
      return destinatarioId as string | null;
    };

    const [emitenteId, destinatarioId] = await Promise.all([
      ensureEmissor(),
      ensureDestinatario()
    ]);

    // Forma de pagamento em recibo é informativa para o usuário; não validar de forma restritiva.

    const statusDocumento = formData.status === 'paga' ? 'paga' : 'emitida';
    const dadosEspecificos = {
      numero: formData.reciboNumero,
      data_emissao: formData.dataRecebimento,
      moeda: formData.moeda || 'MT',
      termos: reciboData.termos,
      ordem_compra: reciboData.ordemCompra,
      tipo_recibo: 'pagamento',
      valor_recebido: formData.valorRecebido,
      forma_pagamento: formData.formaPagamento || null,
      metodo_pagamento: formData.formaPagamento || null,
      referencia_recebimento: formData.referenciaPagamento || null,
      motivo_pagamento: formData.motivoPagamento || null,
      documento_referencia: formData.documentoAssociadoCustom || null,
      data_recebimento: formData.dataRecebimento,
      local_emissao: formData.emitente?.cidade || null,
      status: statusDocumento
    };

    const itensMapeados = (items || []).map((it: ItemFatura) => ({
      id_original: it.id,
      quantidade: it.quantidade,
      descricao: it.descricao,
      preco_unitario: it.precoUnitario,
      taxas: Array.isArray(it.taxas) ? it.taxas.map(t => ({ nome: t.nome, valor: t.valor, tipo: t.tipo })) : []
    }));

    await logger.log({
      action: 'api_call',
      level: 'debug',
      message: 'Chamando criar_documento_completo para recibo',
      details: {
        user: user.id,
        numero: formData.reciboNumero || '(auto)',
        itensCount: itensMapeados.length,
        valorRecebido: formData.valorRecebido
      }
    });

    const { data: unifiedResult, error: unifiedError } = await supabase.rpc('criar_documento_completo', {
      p_user_id: user.id,
      p_tipo_documento: 'recibo',
      p_emitente_id: emitenteId,
      p_destinatario_id: destinatarioId,
      p_dados_especificos: dadosEspecificos,
      p_itens: itensMapeados,
      p_html_content: documentData.htmlContent || null
    });
    const result = unifiedResult;
    const functionError = unifiedError;

    if (functionError) {
      await logger.log({
        action: 'error',
        level: 'error',
        message: 'Erro na função criar_fatura_completa para recibo',
        details: {
          user: user.id,
          numero: formData.reciboNumero || '(auto)',
          errorCode: functionError.code,
          errorMessage: functionError.message,
          errorHint: functionError.hint
        }
      });
    } else {
      await logger.log({
        action: 'api_call',
        level: 'info',
        message: 'Recibo criado com sucesso via criar_documento_completo',
        details: { user: user.id, numero: formData.reciboNumero || '(auto)', formaPagamento: formData.formaPagamento }
      });
    }
    // ===== FIM BLOCO RPC UNIFICADO =====

    if (functionError) {
      await logger.logError(functionError, 'create_receipt_database', {
        user: user.id,
        numero: formData.reciboNumero,
        databaseError: functionError.message,
        databaseCode: functionError.code,
        databaseHint: functionError.hint
      });

      if (functionError.code === 'P0001' && functionError.message.includes('Já existe um documento')) {
        const errorResponse: ApiResponse = {
          success: false,
          error: {
            code: ERROR_CODES.DOCUMENT_ALREADY_EXISTS,
            message: 'Este recibo já foi criado anteriormente',
            details: {
              documentNumber: formData.reciboNumero,
              suggestion: 'Verifique seus recibos criados ou use um número diferente',
              existingDocument: true,
              databaseError: functionError.message
            }
          }
        };
        return NextResponse.json(errorResponse, { status: 409 });
      }

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.DATABASE_ERROR,
          message: 'Erro ao criar recibo no banco de dados',
          details: {
            databaseError: functionError.message,
            hint: functionError.hint || 'Verifique os dados e tente novamente',
            dbCode: functionError.code,
            dbDetails: functionError.details || null,
            payloadResumo: {
              numero: formData.reciboNumero || '(auto)',
              emitenteDocumento: formData.emitente?.documento,
              destinatarioDocumento: formData.destinatario?.documento || null,
              itensCount: items?.length || 0,
              valorRecebido: formData.valorRecebido
            }
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    if (!result) {
      await logger.log({
        action: 'error',
        level: 'error',
        message: 'Resultado vazio da função de criação de recibo',
        details: {
          user: user.id,
          numero: formData.reciboNumero
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.DATABASE_ERROR,
          message: 'Erro ao criar recibo',
          details: 'A função do banco retornou um resultado vazio'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    receiptId = result;

    // Não registamos pagamento em tabela pagamentos para recibo; o próprio recibo representa o pagamento.

    await logger.logDocumentCreation('recibo', result, {
      numero: formData.reciboNumero,
      totais: totais,
      items: { length: items?.length || 0 },
      emitente: formData.emitente,
      destinatario: formData.destinatario,
      valorRecebido: formData.valorRecebido
    });

    const successResponse: ApiResponse<{ id: string; numero: string; referencia_recebimento?: string; documento_referencia?: string; forma_pagamento?: string; valor_recebido?: number; }> = {
      success: true,
      data: {
        id: result,
        numero: formData.reciboNumero,
        referencia_recebimento: formData.referenciaPagamento || undefined,
        documento_referencia: formData.documentoAssociadoCustom || undefined,
        forma_pagamento: formData.formaPagamento || undefined,
        valor_recebido: formData.valorRecebido
      }
    };

    return NextResponse.json(successResponse, { status: 201 });

  } catch (error) {
    const duration = Date.now() - startTime;

    await logger.logError(error as Error, 'create_receipt_unexpected', {
      user: user?.id,
      receiptId,
      durationMs: duration,
      endpoint: '/api/document/receipt/create',
      numero: documentData?.formData?.reciboNumero
    });

    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ?
          (error instanceof Error ? error.message : 'Erro desconhecido') :
          undefined
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  } finally {
    const duration = Date.now() - startTime;

    await logger.logApiCall(
      '/api/document/receipt/create',
      'POST',
      duration,
      receiptId !== null,
      { numero: documentData?.formData?.reciboNumero }
    );
  }
}, { auth: true, rate: { limit: 30 }, auditAction: 'document_create' });
