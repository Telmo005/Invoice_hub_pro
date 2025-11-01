// app/api/document/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { rateLimit } from '@/app/api/lib/rate.limit'

// Configuração de rate limiting
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minuto
  uniqueTokenPerInterval: 500,
})

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer() // ← AGORA É ASYNC

  try {
    // 1. Rate Limiting
    const identifier = request.headers.get('x-forwarded-for') || 'anonymous'
    const isRateLimited = await limiter.check(30, identifier)
    
    if (isRateLimited) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
        { status: 429 }
      )
    }

    // 2. Verificar autenticação
    const authPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout de autenticação')), 5000)
    )

    const { data: { user }, error: authError } = await Promise.race([
      authPromise,
      timeoutPromise
    ]) as any

    if (authError || !user) {
      console.warn('Tentativa de acesso não autorizado aos documentos')
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // 3. Extrair parâmetros de query
    const { searchParams } = new URL(request.url)
    
    const tipo = searchParams.get('tipo') as 'faturas' | 'cotacoes' | null
    const status = searchParams.get('status')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Validar parâmetros
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Parâmetros de paginação inválidos' },
        { status: 400 }
      )
    }

    // 4. Construir query base
    let query = supabase
      .from('view_documentos_pagamentos')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id) // ← AGORA A COLUNA EXISTE NA VIEW

    // Aplicar filtros
    if (tipo) {
      const tipoDocumento = tipo === 'faturas' ? 'fatura' : 'cotacao'
      query = query.eq('tipo_documento', tipoDocumento)
    }

    if (status && status !== 'todos') {
      const validStatus = ['rascunho', 'emitida', 'paga', 'cancelada', 'expirada', 'pendente']
      if (validStatus.includes(status)) {
        query = query.eq('status_documento', status)
      }
    }

    // Aplicar busca
    if (search.trim()) {
      const sanitizedSearch = search.trim().substring(0, 100)
      query = query.or(
        `numero.ilike.%${sanitizedSearch}%,destinatario.ilike.%${sanitizedSearch}%,emitente.ilike.%${sanitizedSearch}%`
      )
    }

    // 5. Paginação
    const from = (page - 1) * limit
    const to = from + limit - 1
    
    query = query
      .range(from, to)
      .order('data_criacao', { ascending: false })

    // 6. Executar query
    const { data: documents, error: queryError, count } = await query

    if (queryError) {
      console.error('Erro ao buscar documentos:', {
        userId: user.id,
        error: queryError.message,
        code: queryError.code
      })
      
      if (queryError.code === 'PGRST301') {
        return NextResponse.json(
          { error: 'View de documentos não encontrada' },
          { status: 404 }
        )
      }
      
      throw queryError
    }

    // 7. Buscar estatísticas
    const stats = await getDocumentStats(supabase, user.id)

    // 8. Transformar dados
    const transformedDocuments = (documents || []).map((doc: any) => ({
      id: doc.id,
      numero: doc.numero || `DOC-${doc.id?.slice(0, 8) || '0000'}`,
      tipo: doc.tipo_documento === 'cotacao' ? 'cotacao' : 'fatura',
      status: doc.status_documento || 'rascunho',
      emitente: doc.emitente || 'Emitente não definido',
      destinatario: doc.destinatario || 'Destinatário não definido',
      data_emissao: doc.data_criacao || new Date().toISOString(),
      data_vencimento: doc.data_vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      valor_total: doc.valor_documento || 0,
      moeda: doc.moeda || 'BRL',
      itens_count: doc.quantidade_itens || 0,
      pagamento_status: doc.status_pagamento || null
    }))

    // 9. Retornar resposta
    return NextResponse.json({
      documents: transformedDocuments,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      stats
    })

  } catch (error) {
    console.error('Erro completo ao carregar documentos:', {
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    })

    return NextResponse.json(
      { 
        error: 'Erro ao carregar documentos',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

// Função para buscar estatísticas
async function getDocumentStats(supabase: any, userId: string) {
  try {
    const [
      { count: totalInvoices },
      { count: totalQuotes },
      { data: pendingInvoices },
      { data: pendingQuotes }
    ] = await Promise.all([
      supabase
        .from('faturas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('cotacoes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('faturas')
        .select('status_documento, status_pagamento')
        .eq('user_id', userId)
        .in('status_documento', ['emitida', 'rascunho']),
      supabase
        .from('cotacoes')
        .select('status_documento')
        .eq('user_id', userId)
        .in('status_documento', ['emitida', 'rascunho'])
    ])

    const pendingInvoicesCount = pendingInvoices?.filter(inv => 
      inv.status_documento === 'emitida' || inv.status_pagamento === 'pendente'
    ).length || 0

    const pendingQuotesCount = pendingQuotes?.filter(quote => 
      quote.status_documento === 'emitida'
    ).length || 0

    return {
      pendingInvoicesCount,
      pendingQuotesCount,
      totalInvoices: totalInvoices || 0,
      totalQuotes: totalQuotes || 0
    }

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    return {
      pendingInvoicesCount: 0,
      pendingQuotesCount: 0,
      totalInvoices: 0,
      totalQuotes: 0
    }
  }
}

// Método OPTIONS para CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}