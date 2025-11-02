// app/api/document/invoice/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

// Interfaces para tipagem consistente
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

// Códigos de erro padronizados
const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  DOCUMENT_ALREADY_EXISTS: 'DOCUMENT_ALREADY_EXISTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

// Função para verificar se documento já existe
async function checkExistingDocument(
  supabase: any, 
  userId: string, 
  documentNumber: string, 
  tipo: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('documentos')
    .select('id')
    .eq('user_id', userId)
    .eq('numero_documento', documentNumber)
    .eq('tipo_documento', tipo)
    .maybeSingle();

  if (error) {
    console.error('Erro ao verificar documento existente:', error);
    return false;
  }

  return !!data;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let invoiceId: string | null = null;
  let user: any = null;
  let documentData: InvoiceData | null = null;

  try {
    const supabase = await supabaseServer();
    
    // Verificar autenticação
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

    // Validar e parsear corpo da requisição
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

    // Validar dados obrigatórios
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

    // Log de tentativa de criação
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
        dataVencimento: formData?.dataVencimento
      }
    });

    // Validar dados obrigatórios específicos
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

    // Validar items
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

    // ✅ VERIFICAR SE DOCUMENTO JÁ EXISTE ANTES DE CRIAR
    const documentExists = await checkExistingDocument(
      supabase, 
      user.id, 
      formData.faturaNumero, 
      'fatura'
    );

    if (documentExists) {
      await logger.log({
        action: 'document_create',
        level: 'warn',
        message: `Tentativa de criar fatura duplicada: ${formData.faturaNumero}`,
        details: {
          user: user.id,
          numero: formData.faturaNumero,
          tipo: 'fatura'
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.DOCUMENT_ALREADY_EXISTS,
          message: 'Esta fatura já foi criada anteriormente',
          details: {
            documentNumber: formData.faturaNumero,
            suggestion: 'Verifique suas faturas criadas ou use um número diferente',
            existingDocument: true
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 409 }); // 409 Conflict
    }

    // Chamar a função PostgreSQL para criar a fatura completa
    const { data: result, error: functionError } = await supabase.rpc('criar_fatura_completa', {
      p_user_id: user.id,
      p_emitente: formData.emitente,
      p_destinatario: formData.destinatario,
      p_fatura: {
        faturaNumero: formData.faturaNumero,
        dataFatura: formData.dataFatura,
        dataVencimento: formData.dataVencimento,
        ordemCompra: formData.ordemCompra,
        termos: formData.termos,
        moeda: formData.moeda || 'MT',
        metodoPagamento: formData.metodoPagamento,
        logoUrl: logo || null,
        assinaturaBase64: assinatura || null
      },
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
        databaseHint: functionError.hint
      });

      // Tratamento específico para erro de documento duplicado
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
          numero: formData.faturaNumero
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

    // Log de sucesso da criação
    await logger.logDocumentCreation('fatura', result, {
      numero: formData.faturaNumero,
      totais: totais,
      items: { length: items.length },
      emitente: formData.emitente,
      destinatario: formData.destinatario,
      dataVencimento: formData.dataVencimento
    });

    // Resposta de sucesso
    const successResponse: ApiResponse<{ id: string; numero: string }> = {
      success: true,
      data: {
        id: result,
        numero: formData.faturaNumero
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
      numero: documentData?.formData?.faturaNumero
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
    
    // Log de performance da API
    await logger.logApiCall(
      '/api/document/invoice/create',
      'POST',
      duration,
      invoiceId !== null // Sucesso se invoiceId foi definido
    );
  }
}