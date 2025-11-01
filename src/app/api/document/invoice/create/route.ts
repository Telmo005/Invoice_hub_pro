// app/api/document/invoice/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

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
  try {
    const supabase = await supabaseServer();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
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

    // Validar e parsear corpo da requisição
    let body: RequestBody;
    try {
      body = await request.json();
    } catch (parseError) {
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

    const { documentData } = body;

    // Validar dados obrigatórios
    if (!documentData) {
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

    console.log('📝 [API Invoice] Dados recebidos:', {
      user: user.id,
      tipo: 'fatura',
      numero: formData?.faturaNumero,
      emitente: formData?.emitente?.nomeEmpresa,
      destinatario: formData?.destinatario?.nomeCompleto,
      totalItens: items?.length
    });

    // Validar dados obrigatórios específicos
    const missingFields = [];
    if (!formData?.faturaNumero) missingFields.push('faturaNumero');
    if (!formData?.emitente) missingFields.push('emitente');
    if (!formData?.destinatario) missingFields.push('destinatario');

    if (missingFields.length > 0) {
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
      console.warn('⚠️ [API Invoice] Tentativa de criar documento duplicado:', {
        userId: user.id,
        numero: formData.faturaNumero
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
      console.error('❌ [API Invoice] Erro na função criar_fatura_completa:', functionError);
      
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
      console.error('❌ [API Invoice] Resultado vazio da função');
      
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

    console.log('✅ [API Invoice] Fatura criada com sucesso:', {
      faturaId: result,
      numero: formData.faturaNumero
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
    console.error('💥 [API Invoice] Erro inesperado:', error);
    
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
  }
}