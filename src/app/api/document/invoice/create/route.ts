// app/api/document/invoice/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface InvoiceData {
  formData: {
    faturaNumero: string;
    dataFatura: string;
    dataVencimento: string;
    ordemCompra?: string;
    termos?: string;
    moeda?: string;
    metodoPagamento?: string;
    emitente: any;
    destinatario: any;
    // NOVOS CAMPOS DE DESCONTO
    desconto?: number;
    tipoDesconto?: 'fixed' | 'percent';
  };
  items: any[];
  totais?: any;
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let invoiceId: string | null = null;
  let user: any = null;
  let documentData: InvoiceData | null = null;

  try {
    const supabase = await supabaseServer();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de acesso não autorizado à API de criação de fatura',
        details: { 
          endpoint: '/api/document/invoice/create',
          error: authError?.message 
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Não autorizado',
          details: 'Usuário não autenticado ou token inválido'
        }
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    user = authUser;

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

    documentData = body.documentData;

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

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Dados do documento são obrigatórios',
          details: {
            missingField: 'documentData',
            expected: 'Objeto com formData, items, etc.'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
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
        // NOVO: Log do desconto
        desconto: formData?.desconto,
        tipoDesconto: formData?.tipoDesconto
      }
    });

    const missingFields = [];
    if (!formData?.faturaNumero) missingFields.push('faturaNumero');
    if (!formData?.emitente) missingFields.push('emitente');
    if (!formData?.destinatario) missingFields.push('destinatario');

    if (missingFields.length > 0) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Dados obrigatórios faltando para criação de fatura',
        details: {
          user: user.id,
          missingFields,
          required: ['faturaNumero', 'emitente', 'destinatario'],
          numero: formData?.faturaNumero
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Dados obrigatórios faltando',
          details: {
            missingFields,
            required: ['faturaNumero', 'emitente', 'destinatario']
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Lista de itens vazia para fatura',
        details: {
          user: user.id,
          numero: formData.faturaNumero
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Lista de itens é obrigatória',
          details: 'A fatura deve conter pelo menos um item'
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // VALIDAÇÃO DO DESCONTO (NOVO)
    if (formData.desconto && formData.desconto < 0) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Desconto negativo não permitido',
        details: {
          user: user.id,
          numero: formData.faturaNumero,
          desconto: formData.desconto
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Desconto inválido',
          details: {
            invalidField: 'desconto',
            message: 'Desconto não pode ser negativo'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

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

    // PREPARAR DADOS DA FATURA COM DESCONTO (ATUALIZADO)
    const faturaData = {
      faturaNumero: formData.faturaNumero,
      dataFatura: formData.dataFatura,
      dataVencimento: formData.dataVencimento,
      ordemCompra: formData.ordemCompra,
      termos: formData.termos,
      moeda: formData.moeda || 'MT',
      metodoPagamento: formData.metodoPagamento,
      logoUrl: logo || null,
      assinaturaBase64: assinatura || null,
      // NOVOS CAMPOS DE DESCONTO
      desconto: formData.desconto || 0,
      tipoDesconto: formData.tipoDesconto || 'fixed'
    };

    const { data: result, error: functionError } = await supabase.rpc('criar_fatura_completa', {
      p_user_id: user.id,
      p_emitente: formData.emitente,
      p_destinatario: formData.destinatario,
      p_fatura: faturaData,
      p_itens: items || [],
      p_tipo_documento: 'fatura',
      p_html_content: documentData.htmlContent || null
    });

    if (functionError) {
      await logger.logError(functionError, 'create_invoice_database', {
        user: user.id,
        numero: formData.faturaNumero,
        databaseError: functionError.message,
        databaseCode: functionError.code,
        databaseHint: functionError.hint,
        // NOVO: Log do desconto no erro
        desconto: formData.desconto,
        tipoDesconto: formData.tipoDesconto
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
          tipoDesconto: formData.tipoDesconto
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

    await logger.logDocumentCreation('fatura', result, {
      numero: formData.faturaNumero,
      totais: totais,
      items: { length: items.length },
      emitente: formData.emitente,
      destinatario: formData.destinatario,
      dataVencimento: formData.dataVencimento,
      // NOVO: Log do desconto na criação
      desconto: {
        valor: formData.desconto,
        tipo: formData.tipoDesconto,
        aplicado: totais?.desconto || 0
      }
    });

    const successResponse: ApiResponse<{ 
      id: string; 
      numero: string;
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
        // NOVO: Incluir informações de desconto na resposta
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
      // NOVO: Log do desconto no erro inesperado
      desconto: documentData?.formData?.desconto,
      tipoDesconto: documentData?.formData?.tipoDesconto
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
      // NOVO: Incluir informações de desconto no log final
      {
        numero: documentData?.formData?.faturaNumero,
        desconto: documentData?.formData?.desconto,
        tipoDesconto: documentData?.formData?.tipoDesconto
      }
    );
  }
}