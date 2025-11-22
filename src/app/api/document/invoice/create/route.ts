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
        desconto: formData?.desconto,
        tipoDesconto: formData?.tipoDesconto,
        metodoPagamento: formData?.metodoPagamento
      }
    });

    const missingFields = [];
    if (!formData?.faturaNumero) missingFields.push('faturaNumero');
    if (!formData?.emitente) missingFields.push('emitente');
    if (!formData?.destinatario) missingFields.push('destinatario');
    if (!formData?.dataVencimento) missingFields.push('dataVencimento');

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

    // VALIDAÇÃO DO NÚMERO (formato exigido pelo BD)
    const numeroPattern = /^(FTR)\/\d{4}\/\d{3}$/;
    if (!numeroPattern.test(formData.faturaNumero)) {
      await logger.log({
        action: 'api_call',
        level: 'warn',
        message: 'Formato de número de fatura inválido',
        details: {
          user: user.id,
          numero: formData.faturaNumero,
          esperado: 'FTR/AAAA/NNN (ex: FTR/2025/001)'
        }
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Número de fatura inválido',
          details: {
            invalidField: 'faturaNumero',
            message: 'Use o formato FTR/AAAA/NNN (ex: FTR/2025/001)'
          }
        }
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // VALIDAÇÃO DO DESCONTO
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

    const dadosEspecificos: Record<string, any> = {
      numero: formData.faturaNumero,
      data_emissao: formData.dataFatura ?? null,
      data_vencimento: formData.dataVencimento ?? null,
      ordem_compra: formData.ordemCompra ?? null,
      termos: formData.termos ?? null,
      moeda: formData.moeda || 'MT',
      logo_url: logo || null,
      assinatura_base64: assinatura || null,
      status: (formData as any).status === 'paga' ? 'paga' : 'emitida',
      desconto: formData.desconto || 0,
      tipo_desconto: formData.tipoDesconto || 'fixed',
      metodo_pagamento: metodoInformativo,
    };

    const itensMapeados = (items || []).map((it: any) => ({
      id_original: it.id,
      quantidade: it.quantidade,
      descricao: it.descricao,
      preco_unitario: it.precoUnitario,
      taxas: Array.isArray(it.taxas) ? it.taxas.map((t: any) => ({ nome: t.nome, valor: t.valor, tipo: t.tipo })) : []
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
}