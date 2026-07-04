// app/api/document/invoice/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { withApiGuard } from '@/lib/api/guard';
import { FormDataFatura, ItemFatura, TotaisFatura } from '@/types/invoice-types';
import { validateInvoicePayload } from '@/lib/validation/documentSchemas';
import { ensureEmitenteId, ensureDestinatarioId } from '@/lib/document/party';
import { buildDadosEspecificos, mapItensParaRpc } from '@/lib/document/buildDadosEspecificos';
import { fetchNumeroDocumento } from '@/lib/document/fetchNumeroDocumento';
import { hasActiveSubscription } from '@/lib/payments/hasActiveSubscription';

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
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export const POST = withApiGuard(async (request: NextRequest, { user }) => {
  const startTime = Date.now();
  let invoiceId: string | null = null;
  let documentData: InvoiceData | null = null;

  try {
    const supabase = await supabaseServer();

    // Fase 4 (docs/auditoria-inicial.md): criação direta só é permitida a
    // utilizadores com assinatura mensal ativa (já pagaram na mensalidade).
    // Sem assinatura ativa (plano pay_per_documento, o default), o único
    // caminho para criar um documento é /api/payments/checkout -- o
    // documento só é criado pelo webhook do PaySuite depois do pagamento
    // ser confirmado. Antes desta verificação, esta rota podia ser chamada
    // diretamente sem pagar nada, contornando por completo o fluxo pago.
    if (!(await hasActiveSubscription(supabase, user.id))) {
      return NextResponse.json({
        success: false,
        error: {
          code: ERROR_CODES.PAYMENT_REQUIRED,
          message: 'É necessário pagamento ou assinatura ativa para criar este documento',
          details: { checkoutEndpoint: '/api/payments/checkout' }
        }
      }, { status: 402 });
    }

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

    // Validação estrutural completa via Zod (ver A4 em docs/auditoria-inicial.md
    // -- o schema já existia em documentSchemas.ts mas nunca era chamado aqui)
    const validation = validateInvoicePayload(documentData);
    if (!validation.ok) {
      await logger.log({
        action: 'validation',
        level: 'warn',
        message: 'Payload de fatura reprovado na validação de schema',
        details: { user: user.id, issues: validation.errors }
      });
      return NextResponse.json({
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Dados da fatura inválidos', details: validation.errors }
      }, { status: 400 });
    }

    const { formData, items, totais, logo, assinatura } = validation.data;

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

    // Garantir / obter IDs do emitente e destinatário (lógica partilhada com
    // quotation/create e receipt/create -- ver src/lib/document/party.ts)
    const [emitenteId, destinatarioId] = await Promise.all([
      ensureEmitenteId(user.id, formData.emitente),
      ensureDestinatarioId(user.id, formData.destinatario)
    ]);

    // Método de pagamento: agora livre/informativo. Persistimos exatamente o valor informado.
    const metodoInformativo = formData.metodoPagamento || null;

    const dadosEspecificos = buildDadosEspecificos({ tipo: 'fatura', formData, logo, assinatura });
    const itensMapeados = mapItensParaRpc(items);

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

    // O número real é reservado atomicamente dentro de criar_documento_completo
    // (ver buildDadosEspecificos.ts) -- pode divergir do previsualizado no
    // wizard sob concorrência, por isso vamos buscar o valor definitivo.
    const numeroFinal = (await fetchNumeroDocumento(supabase, result)) ?? formData.faturaNumero;

    await logger.logDocumentCreation('fatura', result, {
      numero: numeroFinal,
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
        numero: numeroFinal,
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