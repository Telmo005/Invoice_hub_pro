// app/api/document/quotation/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { withApiGuard } from '@/lib/api/guard';
import { FormDataFatura, ItemFatura, TotaisFatura, Emitente, Destinatario } from '@/types/invoice-types';

interface ApiError { code: string; message: string; details?: unknown }
interface ApiResponse<T = unknown> { success: boolean; data?: T; error?: ApiError }

interface QuotationData {
  formData: (FormDataFatura & {
    cotacaoNumero: string;
    dataFatura: string;
    dataVencimento: string;
    validezCotacao?: number;
    status?: 'emitida' | 'paga';
    emitente: Emitente;
    destinatario: Destinatario;
  });
  items: ItemFatura[];
  totais?: TotaisFatura;
  logo?: string;
  assinatura?: string;
  htmlContent?: string;
}

interface RequestBody { documentData: QuotationData }

const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR', 
  DATABASE_ERROR: 'DATABASE_ERROR',
  DOCUMENT_ALREADY_EXISTS: 'DOCUMENT_ALREADY_EXISTS',
  SUPABASE_TIMEOUT: 'SUPABASE_TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export const POST = withApiGuard(async (request: NextRequest, { user }) => {
  const startTime = Date.now();
  let quotationId: string | null = null;
  let documentData: QuotationData | null = null;

  try {
    const supabase = await supabaseServer();

    let body: RequestBody;
    try {
      body = await request.json();
    } catch (parseError) {
      await logger.logError(parseError as Error, 'parse_quotation_request_body', {
        endpoint: '/api/document/quotation/create',
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

    documentData = body.documentData as QuotationData;

    if (!documentData) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Dados da cotação não fornecidos',
        details: { 
          user: user.id,
          endpoint: '/api/document/quotation/create'
        }
      });

      return NextResponse.json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'documentData ausente' } }, { status: 400 });
    }

    const { formData, items, totais, logo, assinatura } = documentData;

    await logger.log({
      action: 'document_create',
      level: 'info',
      message: `Tentativa de criação de cotação: ${formData?.cotacaoNumero}`,
      details: {
        user: user.id,
        tipo: 'cotacao',
        numero: formData?.cotacaoNumero,
        emitente: formData?.emitente?.nomeEmpresa,
        destinatario: formData?.destinatario?.nomeCompleto,
        totalItens: items?.length,
        validez: formData?.validezCotacao,
        valorTotal: totais?.totalFinal,
        metodoPagamento: formData?.metodoPagamento
      }
    });

    // Campos obrigatórios já tratados pelo schema

    // Lista de itens garantida pelo schema

    // Obter ou criar IDs de emitente e destinatário conforme novo schema
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
      const dest: Destinatario = formData.destinatario;
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
      return destinatarioId as string;
    };

    const [emitenteId, destinatarioId] = await Promise.all([
      ensureEmissor(),
      ensureDestinatario()
    ]);

    // Método de pagamento em cotação é informativo; não validar de forma restritiva.

    // Mapear dados específicos conforme a função criar_documento_completo
    const statusDocumento = formData.status === 'paga' ? 'paga' : 'emitida';
    const dadosEspecificos = {
      numero: formData.cotacaoNumero,
      data_emissao: formData.dataFatura ?? null,
      data_vencimento: formData.dataVencimento ?? null,
      ordem_compra: formData.ordemCompra ?? null,
      termos: formData.termos ?? null,
      moeda: formData.moeda ?? 'MT',
      logo_url: logo ?? null,
      assinatura_base64: assinatura ?? null,
      validez_dias: formData.validezCotacao ? Number(formData.validezCotacao) : 15,
      desconto: typeof formData.desconto === 'number' ? formData.desconto : (totais?.desconto ?? 0),
      tipo_desconto: formData.tipoDesconto ?? 'fixed',
      metodo_pagamento: formData.metodoPagamento || null,
      status: statusDocumento
    };

    // Mapear itens para o formato do banco
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
      message: 'Chamando criar_documento_completo para cotacao',
      details: {
        user: user.id,
        numero: formData.cotacaoNumero,
        itensCount: itensMapeados.length,
        validezDias: dadosEspecificos.validez_dias
      }
    });

    let result: any = null;
    let functionError: any = null;
    try {
      const rpcRes = await supabase.rpc('criar_documento_completo', {
        p_user_id: user.id,
        p_tipo_documento: 'cotacao',
        p_emitente_id: emitenteId,
        p_destinatario_id: destinatarioId,
        p_dados_especificos: dadosEspecificos,
        p_itens: itensMapeados,
        p_html_content: documentData.htmlContent || null
      });
      result = rpcRes.data;
      functionError = rpcRes.error;
    } catch (netErr: any) {
      // Captura de falha de rede/timeout antes de obter functionError
      await logger.logApiError('/api/document/quotation/create', 'POST', netErr, {
        step: 'rpc_criar_documento_completo',
        numero: formData.cotacaoNumero
      });
      const isTimeout = netErr?.code === 'UND_ERR_CONNECT_TIMEOUT' || /timeout|fetch failed/i.test(netErr?.message || '');
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: isTimeout ? ERROR_CODES.SUPABASE_TIMEOUT : ERROR_CODES.INTERNAL_ERROR,
          message: isTimeout ? 'Timeout ao conectar Supabase' : 'Falha de rede ao criar cotação',
          details: process.env.NODE_ENV === 'development' ? (netErr?.message || 'network error') : undefined
        }
      };
      return NextResponse.json(errorResponse, { status: isTimeout ? 503 : 500 });
    }

    if (!functionError) {
      await logger.log({
        action: 'api_call',
        level: 'info',
        message: 'criar_documento_completo executado com sucesso para cotacao',
        details: {
          user: user.id,
          numero: formData.cotacaoNumero,
          idGerado: result,
          metodoPagamento: formData.metodoPagamento
        }
      });
    }

    if (functionError) {
      const isTimeout = functionError?.code === 'UND_ERR_CONNECT_TIMEOUT' || /timeout|fetch failed/i.test(functionError?.message || '');
      await logger.logError(functionError, 'create_quotation_database', {
        user: user.id,
        numero: formData.cotacaoNumero,
        databaseError: functionError.message,
        databaseCode: functionError.code,
        databaseHint: functionError.hint,
        validez: formData.validezCotacao
      });

      if (functionError.code === 'P0001' && functionError.message.includes('Já existe um documento')) {
        const errorResponse: ApiResponse = {
          success: false,
          error: {
            code: ERROR_CODES.DOCUMENT_ALREADY_EXISTS,
            message: 'Esta cotação já foi criada anteriormente',
            details: {
              documentNumber: formData.cotacaoNumero,
              suggestion: 'Verifique suas cotações criadas ou use um número diferente',
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
          code: isTimeout ? ERROR_CODES.SUPABASE_TIMEOUT : ERROR_CODES.DATABASE_ERROR,
          message: isTimeout ? 'Timeout ao comunicar com o banco' : 'Erro ao criar cotação no banco de dados',
          details: {
            databaseError: functionError.message,
            hint: functionError.hint || 'Verifique os dados e tente novamente'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: isTimeout ? 503 : 500 });
    }

    if (!result) {
      await logger.log({
        action: 'error',
        level: 'error',
        message: 'Resultado vazio da função de criação de cotação',
        details: {
          user: user.id,
          numero: formData.cotacaoNumero,
          validez: formData.validezCotacao
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.DATABASE_ERROR,
          message: 'Erro ao criar cotação',
          details: 'A função do banco retornou um resultado vazio'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    quotationId = result;

    // Não registamos pagamento para cotação; método é apenas informativo.

    await logger.logDocumentCreation('cotacao', result, {
      numero: formData.cotacaoNumero,
      totais: totais,
      items: { length: items.length },
      emitente: formData.emitente,
      destinatario: formData.destinatario,
      validez: formData.validezCotacao || 15,
      dataVencimento: formData.dataVencimento
    });

    const successResponse: ApiResponse<{ id: string; numero: string; }> = {
      success: true,
      data: {
        id: result,
        numero: formData.cotacaoNumero
      }
    };

    return NextResponse.json(successResponse, { status: 201 });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'create_quotation_unexpected', {
      user: user?.id,
      quotationId,
      durationMs: duration,
      endpoint: '/api/document/quotation/create',
      numero: documentData?.formData?.cotacaoNumero
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
      '/api/document/quotation/create',
      'POST',
      duration,
      quotationId !== null
    );
  }
}, { auth: true, rate: { limit: 30 }, auditAction: 'document_create' });