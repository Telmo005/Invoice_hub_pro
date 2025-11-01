// app/api/document/quotation/create/route.ts
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

interface QuotationData {
  formData: {
    cotacaoNumero: string;
    dataFatura: string;
    dataVencimento: string; // ✅ AGORA OBRIGATÓRIO
    ordemCompra?: string;
    termos?: string;
    moeda?: string;
    metodoPagamento?: string;
    validezCotacao?: number;
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
  documentData: QuotationData;
}

// Códigos de erro padronizados (MESMOS DA FATURA)
const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR', 
  DATABASE_ERROR: 'DATABASE_ERROR',
  DOCUMENT_ALREADY_EXISTS: 'DOCUMENT_ALREADY_EXISTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

// Função para verificar se documento já existe (MESMA DA FATURA)
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
    
    // Verificar autenticação (MESMO DA FATURA)
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

    // Validar e parsear corpo da requisição (MESMO DA FATURA)
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

    // Validar dados obrigatórios (MESMO DA FATURA)
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

    console.log('📝 [API Quotation] Dados recebidos:', {
      user: user.id,
      tipo: 'cotacao',
      numero: formData?.cotacaoNumero,
      emitente: formData?.emitente?.nomeEmpresa,
      destinatario: formData?.destinatario?.nomeCompleto,
      totalItens: items?.length,
      validez: formData?.validezCotacao
    });

    // ✅ VALIDAÇÃO PADRONIZADA - MESMOS CAMPOS OBRIGATÓRIOS DA FATURA
    const missingFields = [];
    if (!formData?.cotacaoNumero) missingFields.push('cotacaoNumero');
    if (!formData?.dataVencimento) missingFields.push('dataVencimento'); // ✅ AGORA OBRIGATÓRIO
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
            required: ['cotacaoNumero', 'dataVencimento', 'emitente', 'destinatario'] // ✅ MESMO PADRÃO
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validar items (MESMO DA FATURA)
    if (!items || !Array.isArray(items) || items.length === 0) {
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Lista de itens é obrigatória',
          details: 'A cotação deve conter pelo menos um item'
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // ✅ VERIFICAR SE DOCUMENTO JÁ EXISTE (MESMO DA FATURA)
    const documentExists = await checkExistingDocument(
      supabase, 
      user.id, 
      formData.cotacaoNumero, 
      'cotacao'
    );

    if (documentExists) {
      console.warn('⚠️ [API Quotation] Tentativa de criar documento duplicado:', {
        userId: user.id,
        numero: formData.cotacaoNumero
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.DOCUMENT_ALREADY_EXISTS,
          message: 'Esta cotação já foi criada anteriormente',
          details: {
            documentNumber: formData.cotacaoNumero,
            suggestion: 'Verifique suas cotações criadas ou use um número diferente',
            existingDocument: true
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 409 });
    }

    // ✅ ESTRUTURA PADRONIZADA PARA O BANCO (igual à fatura)
    const { data: result, error: functionError } = await supabase.rpc('criar_fatura_completa', {
      p_user_id: user.id,
      p_emitente: formData.emitente,
      p_destinatario: formData.destinatario,
      p_fatura: {
        cotacaoNumero: formData.cotacaoNumero, // ✅ Nome do campo específico
        dataFatura: formData.dataFatura,
        dataVencimento: formData.dataVencimento, // ✅ AGORA SEMPRE EXISTE
        ordemCompra: formData.ordemCompra,
        termos: formData.termos,
        moeda: formData.moeda || 'MT',
        metodoPagamento: formData.metodoPagamento,
        logoUrl: logo || null,
        assinaturaBase64: assinatura || null,
        validezCotacao: formData.validezCotacao || 15 // ✅ Campo específico da cotação
      },
      p_itens: items || [],
      p_tipo_documento: 'cotacao',
      p_html_content: documentData.htmlContent || null
    });

    // ✅ TRATAMENTO DE ERRO PADRONIZADO (MESMO DA FATURA)
    if (functionError) {
      console.error('❌ [API Quotation] Erro na função criar_fatura_completa:', functionError);
      
      // Tratamento específico para erro de documento duplicado
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
          code: ERROR_CODES.DATABASE_ERROR,
          message: 'Erro ao criar cotação no banco de dados',
          details: {
            databaseError: functionError.message,
            hint: functionError.hint || 'Verifique os dados e tente novamente'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    if (!result) {
      console.error('❌ [API Quotation] Resultado vazio da função');
      
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

    console.log('✅ [API Quotation] Cotação criada com sucesso:', {
      cotacaoId: result,
      numero: formData.cotacaoNumero,
      validez: formData.validezCotacao || 15
    });

    // ✅ RESPOSTA PADRONIZADA (mesma estrutura da fatura)
    const successResponse: ApiResponse<{ id: string; numero: string }> = {
      success: true,
      data: {
        id: result,
        numero: formData.cotacaoNumero
      }
    };

    return NextResponse.json(successResponse, { status: 201 });

  } catch (error) {
    console.error('💥 [API Quotation] Erro inesperado:', error);
    
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