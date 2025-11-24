// app/api/document/invoice/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { withApiGuard } from '@/lib/api/guard';
import { FormDataFatura, ItemFatura, TotaisFatura } from '@/types/invoice-types';

interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

interface InvoiceData {
  formData: FormDataFatura & {
    faturaNumero: string;
    dataFatura: string;
    dataVencimento: string;
    metodoPagamento?: string;
  };
  items: ItemFatura[];
  totais?: TotaisFatura;
  logo?: string;
  assinatura?: string;
  htmlContent?: string;
}

interface RequestBody {
  documentData: InvoiceData;
}

const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  DOCUMENT_ALREADY_EXISTS: 'DOCUMENT_ALREADY_EXISTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export const POST = withApiGuard(async (request: NextRequest, { user }) => {
  const startTime = Date.now();
  let invoiceId: string | null = null;
  let documentData: InvoiceData | null = null;

  try {
    const supabase = await supabaseServer();

    let body: RequestBody;
    try {
      body = await request.json();
    } catch (parseError) {
      await logger.logError(parseError as Error, 'parse_invoice_request_body', {
        endpoint: '/api/document/invoice/create',
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

    documentData = body.documentData as InvoiceData;

    if (!documentData) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Dados da fatura não fornecidos',
        details: { 
          user: user.id,
          endpoint: '/api/document/invoice/create'
        }
      });

      return NextResponse.json({ success: false, error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'documentData ausente' } }, { status: 400 });
    }

    const { formData, items, totais, logo, assinatura } = documentData;

    await logger.log({
      action: 'document_create',
      level: 'info',
      message: `Tentativa de criação de fatura: ${formData?.faturaNumero}`,
      details: {
        user: user.id,
        tipo: 'fatura',
        numero: formData?.faturaNumero,
        emitente: formData?.emitente?.nomeEmpresa,
        destinatario: formData?.destinatario?.nomeCompleto,
        totalItens: items?.length,
        valorTotal: totais?.totalFinal,
        dataVencimento: formData?.dataVencimento,
        desconto: formData?.desconto,
        tipoDesconto: formData?.tipoDesconto,
        metodoPagamento: formData?.metodoPagamento
      }
    });

    if (!formData.dataVencimento) {
      const errorResponse: ApiResponse = {
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'dataVencimento é obrigatória', details: { field: 'dataVencimento' } }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Lista de itens já garantida pelo schema (min(1))

    // VALIDAÇÃO DO NÚMERO (formato exigido pelo BD)
    // Número já validado via regex do schema

    // VALIDAÇÃO DO DESCONTO
    // Desconto não negativo garantido pelo schema

    if (formData.tipoDesconto === 'percent' && formData.desconto && formData.desconto > 100) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Desconto percentual acima de 100%',
        details: {
          user: user.id,
          numero: formData.faturaNumero,
          desconto: formData.desconto,
          tipoDesconto: formData.tipoDesconto
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Desconto percentual inválido',
          details: {
            invalidField: 'desconto',
            message: 'Desconto percentual não pode ser maior que 100%'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // ===== ADAPTAR PARA NOVA FUNÇÃO criar_documento_completo =====
    // Garantir / obter IDs do emitente e destinatário
    const ensureEmissor = async () => {
      const emissor = formData.emitente;
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
      const dest = formData.destinatario;
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

    // Método de pagamento: agora livre/informativo. Persistimos exatamente o valor informado.
    const metodoInformativo = formData.metodoPagamento || null;
    const statusDocumento = formData.status === 'paga' ? 'paga' : 'emitida';

    const dadosEspecificos = {
      numero: formData.faturaNumero,
      data_emissao: formData.dataFatura ?? null,
      data_vencimento: formData.dataVencimento ?? null,
      ordem_compra: formData.ordemCompra ?? null,
      termos: formData.termos ?? null,
      moeda: formData.moeda || 'MT',
      logo_url: logo || null,
      assinatura_base64: assinatura || null,
      status: statusDocumento,
      desconto: formData.desconto || 0,
      tipo_desconto: formData.tipoDesconto || 'fixed',
      metodo_pagamento: metodoInformativo,
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
      message: 'Chamando criar_documento_completo para fatura',
      details: {
        user: user.id,
        numero: formData.faturaNumero,
        itensCount: itensMapeados.length,
        desconto: dadosEspecificos.desconto,
        tipoDesconto: dadosEspecificos.tipo_desconto,
        metodoPagamento: dadosEspecificos.metodo_pagamento
      }
    });

    const { data: result, error: functionError } = await supabase.rpc('criar_documento_completo', {
      p_user_id: user.id,
      p_tipo_documento: 'fatura',
      p_emitente_id: emitenteId,
      p_destinatario_id: destinatarioId,
      p_dados_especificos: dadosEspecificos,
      p_itens: itensMapeados,
      p_html_content: documentData.htmlContent || null
    });

    if (!functionError) {
      await logger.log({
        action: 'api_call',
        level: 'info',
        message: 'criar_documento_completo executado com sucesso para fatura',
        details: {
          user: user.id,
          numero: formData.faturaNumero,
          idGerado: result,
          metodoPagamento: formData.metodoPagamento
        }
      });
    }

    if (functionError) {
      await logger.logError(functionError, 'create_invoice_database', {
        user: user.id,
        numero: formData.faturaNumero,
        databaseError: functionError.message,
        databaseCode: functionError.code,
        databaseHint: functionError.hint,
        desconto: formData.desconto,
        tipoDesconto: formData.tipoDesconto,
        metodoPagamento: formData.metodoPagamento
      });

      if (functionError.code === 'P0001' && functionError.message.includes('Já existe um documento')) {
        const errorResponse: ApiResponse = {
          success: false,
          error: {
            code: ERROR_CODES.DOCUMENT_ALREADY_EXISTS,
            message: 'Esta fatura já foi criada anteriormente',
            details: {
              documentNumber: formData.faturaNumero,
              suggestion: 'Verifique suas faturas criadas ou use um número diferente',
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
          message: 'Erro ao criar fatura no banco de dados',
          details: {
            databaseError: functionError.message,
            hint: functionError.hint || 'Verifique os dados e tente novamente'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    if (!result) {
      await logger.log({
        action: 'error',
        level: 'error',
        message: 'Resultado vazio da função de criação de fatura',
        details: {
          user: user.id,
          numero: formData.faturaNumero,
          desconto: formData.desconto,
          tipoDesconto: formData.tipoDesconto,
          metodoPagamento: formData.metodoPagamento
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.DATABASE_ERROR,
          message: 'Erro ao criar fatura',
          details: 'A função do banco retornou um resultado vazio'
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    invoiceId = result;

    // Não criamos registro em pagamentos porque método é apenas informativo.

    await logger.logDocumentCreation('fatura', result, {
      numero: formData.faturaNumero,
      totais: totais,
      items: { length: items.length },
      emitente: formData.emitente,
      destinatario: formData.destinatario,
      dataVencimento: formData.dataVencimento,
      metodoPagamento: formData.metodoPagamento,
      desconto: {
        valor: formData.desconto,
        tipo: formData.tipoDesconto,
        aplicado: totais?.desconto || 0
      }
    });

    const successResponse: ApiResponse<{ 
      id: string; 
      numero: string;
      pagamento?: {
        metodo?: string;
        status?: string;
      };
      desconto?: {
        valor: number;
        tipo: string;
        aplicado: number;
      }
    }> = {
      success: true,
      data: {
        id: result,
        numero: formData.faturaNumero,
        pagamento: {
          metodo: metodoInformativo || undefined
        },
        desconto: {
          valor: formData.desconto || 0,
          tipo: formData.tipoDesconto || 'fixed',
          aplicado: totais?.desconto || 0
        }
      }
    };

    return NextResponse.json(successResponse, { status: 201 });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'create_invoice_unexpected', {
      user: user?.id,
      invoiceId,
      durationMs: duration,
      endpoint: '/api/document/invoice/create',
      numero: documentData?.formData?.faturaNumero,
      desconto: documentData?.formData?.desconto,
      tipoDesconto: documentData?.formData?.tipoDesconto,
      metodoPagamento: documentData?.formData?.metodoPagamento
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
      '/api/document/invoice/create',
      'POST',
      duration,
      invoiceId !== null,
      {
        numero: documentData?.formData?.faturaNumero,
        desconto: documentData?.formData?.desconto,
        tipoDesconto: documentData?.formData?.tipoDesconto,
        metodoPagamento: documentData?.formData?.metodoPagamento
      }
    );
  }
}, { auth: true, rate: { limit: 30 }, auditAction: 'document_create' });