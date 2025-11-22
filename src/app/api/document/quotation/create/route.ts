// app/api/document/quotation/create/route.ts
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

interface QuotationData {
  formData: {
    cotacaoNumero: string;
    dataFatura: string;
    dataVencimento: string;
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

const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR', 
  DATABASE_ERROR: 'DATABASE_ERROR',
  DOCUMENT_ALREADY_EXISTS: 'DOCUMENT_ALREADY_EXISTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let quotationId: string | null = null;
  let user: any = null;
  let documentData: QuotationData | null = null;

  try {
    const supabase = await supabaseServer();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Tentativa de acesso não autorizado à API de criação de cotação',
        details: { 
          endpoint: '/api/document/quotation/create',
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

    documentData = body.documentData;

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

    const missingFields = [];
    if (!formData?.cotacaoNumero) missingFields.push('cotacaoNumero');
    if (!formData?.emitente) missingFields.push('emitente');
    if (!formData?.destinatario) missingFields.push('destinatario');

    if (missingFields.length > 0) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Dados obrigatórios faltando para criação de cotação',
        details: {
          user: user.id,
          missingFields,
          required: ['cotacaoNumero', 'emitente', 'destinatario'],
          numero: formData?.cotacaoNumero
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Dados obrigatórios faltando',
          details: {
            missingFields,
            required: ['cotacaoNumero', 'emitente', 'destinatario']
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Lista de itens vazia para cotação',
        details: {
          user: user.id,
          numero: formData.cotacaoNumero
        }
      });

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

    // Obter ou criar IDs de emitente e destinatário conforme novo schema
    const ensureEmissor = async () => {
      const emissor = formData.emitente;
      // Tentar encontrar por documento, depois por nome
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

    // Método de pagamento em cotação é informativo; não validar de forma restritiva.

    // Mapear dados específicos conforme a função criar_documento_completo
    const dadosEspecificos: Record<string, any> = {
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
      status: (formData as any).status === 'paga' ? 'paga' : 'emitida'
    };

    // Mapear itens para o formato do banco
    const itensMapeados = (items || []).map((it: any) => ({
      id_original: it.id,
      quantidade: it.quantidade,
      descricao: it.descricao,
      preco_unitario: it.precoUnitario,
      taxas: Array.isArray(it.taxas) ? it.taxas.map((t: any) => ({
        nome: t.nome,
        valor: t.valor,
        tipo: t.tipo
      })) : []
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

    const { data: result, error: functionError } = await supabase.rpc('criar_documento_completo', {
      p_user_id: user.id,
      p_tipo_documento: 'cotacao',
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
}