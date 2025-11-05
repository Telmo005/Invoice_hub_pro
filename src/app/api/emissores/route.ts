import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// Tipos para validação
interface EmissorCreateData {
  nome_empresa: string
  documento: string
  pais: string
  cidade: string
  bairro: string
  pessoa_contato?: string
  email: string
  telefone: string
  padrao?: boolean
}

// Interface para resposta padronizada
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Validação de dados
function validateEmissorData(data: any): { isValid: boolean; errors: string[]; validatedData?: EmissorCreateData } {
  const errors: string[] = []

  if (!data.nome_empresa?.trim()) errors.push('Nome da empresa é obrigatório')
  if (!data.documento?.trim()) errors.push('Documento é obrigatório')
  if (!data.pais?.trim()) errors.push('País é obrigatório')
  if (!data.cidade?.trim()) errors.push('Cidade é obrigatória')
  if (!data.bairro?.trim()) errors.push('Bairro é obrigatório')
  if (!data.email?.trim()) errors.push('Email é obrigatório')
  if (!data.telefone?.trim()) errors.push('Telefone é obrigatório')

  // Validação de email
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Email inválido')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  const validatedData: EmissorCreateData = {
    nome_empresa: data.nome_empresa.trim(),
    documento: data.documento.trim(),
    pais: data.pais.trim(),
    cidade: data.cidade.trim(),
    bairro: data.bairro.trim(),
    pessoa_contato: data.pessoa_contato?.trim(),
    email: data.email.trim(),
    telefone: data.telefone.trim(),
    padrao: Boolean(data.padrao)
  }

  return { isValid: true, errors: [], validatedData }
}

// Função de log segura
async function safeLog(action: string, message: string, details?: any) {
  try {
    const { logger } = await import('@/lib/logger');
    await logger.log({
      action: action as any,
      level: 'info',
      message,
      details
    });
  } catch (error) {
    // Fallback para console se o logger falhar
    console.log(`📝 [LOG: ${action}]:`, message, details);
  }
}

// Função de log de erro segura
async function safeLogError(error: Error, context: string, details?: any) {
  try {
    const { logger } = await import('@/lib/logger');
    await logger.logError(error, context, details);
  } catch (logError) {
    console.error(`❌ [ERROR: ${context}]:`, error.message, details);
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await supabaseServer()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      await safeLog('api_call', 'Tentativa de acesso não autorizado à listagem de emissores', {
        endpoint: '/api/emissores',
        error: authError?.message
      });

      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Log de início da listagem
    await safeLog('document_view', `Usuário ${user.id} listando emissores`, {
      user: user.id
    });

    // Buscar todos os emissores do usuário
    const { data: emissores, error } = await supabase
      .from('emissores')
      .select('*')
      .eq('user_id', user.id)
      .order('padrao', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) {
      await safeLogError(error, 'list_emissores_database', {
        user: user.id
      });

      console.error('Erro ao buscar emissores:', error)
      return NextResponse.json(
        { error: 'Erro ao carregar empresas' },
        { status: 500 }
      )
    }

    // Log de sucesso na listagem
    await safeLog('document_view', `Listagem concluída: ${emissores?.length || 0} emissores encontrados`, {
      user: user.id,
      total: emissores?.length || 0,
      emissoresPadrao: emissores?.filter(e => e.padrao).length || 0
    });

    // Transformar para formato do frontend
    const empresas = emissores.map(emissor => ({
      id: emissor.id,
      nome: emissor.nome_empresa,
      nuip: emissor.documento,
      pais: emissor.pais,
      cidade: emissor.cidade,
      endereco: emissor.bairro,
      telefone: emissor.telefone,
      email: emissor.email,
      pessoa_contato: emissor.pessoa_contato,
      padrao: emissor.padrao
    }))

    return NextResponse.json({ empresas })

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await safeLogError(error as Error, 'list_emissores_unexpected', {
      durationMs: duration
    });

    console.error('Erro completo ao carregar emissores:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  } finally {
    // Log de performance
    const duration = Date.now() - startTime;
    try {
      const { logger } = await import('@/lib/logger');
      await logger.logApiCall('/api/emissores', 'GET', duration, true);
    } catch (error) {
      console.log(`⏱️ [PERF] GET /api/emissores: ${duration}ms`);
    }
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await supabaseServer()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      await safeLog('api_call', 'Tentativa de acesso não autorizado à criação de emissor', {
        endpoint: '/api/emissores',
        error: authError?.message
      });

      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Log de tentativa de criação
    await safeLog('document_create', `Usuário ${user.id} tentando criar emissor`, {
      user: user.id,
      nome_empresa: body.nome_empresa,
      documento: body.documento
    });
    
    // Validar dados
    const validation = validateEmissorData(body)
    if (!validation.isValid) {
      await safeLog('api_call', 'Validação falhou na criação de emissor', {
        user: user.id,
        errors: validation.errors,
        data: {
          nome_empresa: body.nome_empresa,
          documento: body.documento,
          email: body.email
        }
      });

      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.errors },
        { status: 400 }
      )
    }

    const { validatedData } = validation

    // Se for definir como padrão, remover padrão atual
    if (validatedData.padrao) {
      await safeLog('document_update', 'Removendo emissor padrão anterior', {
        user: user.id
      });

      await supabase
        .from('emissores')
        .update({ padrao: false })
        .eq('user_id', user.id)
        .eq('padrao', true)
    }

    // Log antes da inserção
    await safeLog('document_create', 'Inserindo novo emissor no banco', {
      user: user.id,
      emissor: {
        nome_empresa: validatedData.nome_empresa,
        documento: validatedData.documento,
        padrao: validatedData.padrao
      }
    });

    // Inserir novo emissor
    const { data: novoEmissor, error } = await supabase
      .from('emissores')
      .insert({
        user_id: user.id,
        nome_empresa: validatedData.nome_empresa,
        documento: validatedData.documento,
        pais: validatedData.pais,
        cidade: validatedData.cidade,
        bairro: validatedData.bairro,
        pessoa_contato: validatedData.pessoa_contato,
        email: validatedData.email,
        telefone: validatedData.telefone,
        padrao: validatedData.padrao || false
      })
      .select()
      .single()

    if (error) {
      await safeLogError(error, 'create_emissor_database', {
        user: user.id,
        emissor: {
          nome_empresa: validatedData.nome_empresa,
          documento: validatedData.documento
        }
      });

      console.error('Erro ao criar emitente:', error)
      
      // Tratar erro de duplicação
      if (error.code === '23505') {
        await safeLog('document_create', 'Tentativa de criar emissor com documento duplicado', {
          user: user.id,
          documento: validatedData.documento
        });

        return NextResponse.json(
          { error: 'Já existe uma empresa com este documento' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Erro ao criar empresa' },
        { status: 500 }
      )
    }

    // Log de sucesso
    await safeLog('document_create', `Emissor criado com sucesso: ${novoEmissor.nome_empresa}`, {
      user: user.id,
      emissorId: novoEmissor.id,
      emissorNome: novoEmissor.nome_empresa,
      documento: novoEmissor.documento,
      padrao: novoEmissor.padrao
    });

    return NextResponse.json({
      success: true,
      emissor: novoEmissor,
      message: 'Empresa criada com sucesso'
    }, { status: 201 })

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await safeLogError(error as Error, 'create_emissor_unexpected', {
      durationMs: duration
    });

    console.error('Erro completo ao criar emitente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  } finally {
    // Log de performance
    const duration = Date.now() - startTime;
    try {
      const { logger } = await import('@/lib/logger');
      await logger.logApiCall('/api/emissores', 'POST', duration, true);
    } catch (error) {
      console.log(`⏱️ [PERF] POST /api/emissores: ${duration}ms`);
    }
  }
}