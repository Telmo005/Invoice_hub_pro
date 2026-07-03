import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { rateLimit } from '@/app/api/lib/rate.limit'

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
})

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer()

  try {
    const identifier = request.headers.get('x-forwarded-for') || 'anonymous'
    const isRateLimited = await limiter.check(30, identifier)
    
    if (isRateLimited) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
        { status: 429 }
      )
    }

    const authPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    )

    const { data: { user } } = await Promise.race([authPromise, timeoutPromise]) as any

    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    const tipo = searchParams.get('tipo') as 'faturas' | 'cotacoes' | 'recibos' | null
    const status = searchParams.get('status')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)

    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { error: 'Parâmetros de paginação inválidos' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('view_documentos_pagamentos')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    if (tipo) {
      const tipoDocumento = tipo === 'faturas' ? 'fatura' : (tipo === 'cotacoes' ? 'cotacao' : 'recibo')
      query = query.eq('tipo_documento', tipoDocumento)
    }

    if (status && status !== 'todos') {
      const validStatus = ['rascunho', 'emitida', 'paga', 'cancelada', 'expirada', 'pendente']
      if (validStatus.includes(status)) {
        query = query.eq('status_documento', status)
      }
    }

    if (search.trim()) {
      const sanitizedSearch = search.trim().substring(0, 100)
      query = query.or(
        `numero.ilike.%${sanitizedSearch}%,destinatario.ilike.%${sanitizedSearch}%,emitente.ilike.%${sanitizedSearch}%`
      )
    }

    const from = (page - 1) * limit
    const to = from + limit - 1
    
    const { data: documents, error: queryError, count } = await query
      .range(from, to)
      .order('data_criacao', { ascending: false })

    if (queryError) {
      if (queryError.code === 'PGRST301') {
        return NextResponse.json(
          { error: 'Recurso não encontrado' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      )
    }

    const stats = await getDocumentStats(supabase, user.id)

    const transformedDocuments = (documents || []).map((doc: any) => {
      const tipoDoc = doc.tipo_documento === 'cotacao' ? 'cotacao' : (doc.tipo_documento === 'recibo' ? 'recibo' : 'fatura');
      const valorBase = doc.valor_documento || 0;
      const valorRecibo = tipoDoc === 'recibo' ? (doc.valor_recebido || valorBase) : valorBase;
      return {
        id: doc.id,
        numero: doc.numero || `DOC-${doc.id?.slice(0, 8) || '0000'}`,
        tipo: tipoDoc,
        status: doc.status_documento || 'rascunho',
        emitente: doc.emitente || 'Emitente não definido',
        destinatario: doc.destinatario || 'Destinatário não definido',
        data_emissao: doc.data_criacao || new Date().toISOString(),
        data_vencimento: doc.data_vencimento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        valor_total: valorRecibo,
        moeda: doc.moeda || 'BRL',
        itens_count: doc.quantidade_itens || 0,
        pagamento_status: doc.status_pagamento || null,
        referencia: doc.documento_referencia || null
      };
    })

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

  } catch (_error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

async function getDocumentStats(supabase: any, userId: string) {
  const emptyStats = {
    pendingInvoicesCount: 0,
    pendingQuotesCount: 0,
    totalInvoices: 0,
    totalQuotes: 0,
    totalReceipts: 0,
    expiringQuotesCount: 0,
    expiredQuotesCount: 0,
    expiredInvoicesCount: 0,
    pendingReceiptsCount: 0
  };

  try {
    // Antes, isto fazia 6+ queries diretas a `faturas`/`cotacoes`/`recibos`
    // pedindo colunas que não existem nessas tabelas (user_id, status_documento,
    // data_vencimento vivem em documentos_base/view_documentos_pagamentos desde
    // a normalização do schema) -- cada uma falhava silenciosamente e as stats
    // ficavam sempre a 0. Uma única leitura da view unificada resolve tudo.
    const { data: rows, error } = await supabase
      .from('view_documentos_pagamentos')
      .select('tipo_documento, status_documento, data_vencimento, status_pagamento')
      .eq('user_id', userId);

    if (error || !rows) return emptyStats;

    const faturas = rows.filter((r: any) => r.tipo_documento === 'fatura');
    const cotacoes = rows.filter((r: any) => r.tipo_documento === 'cotacao');
    const recibos = rows.filter((r: any) => r.tipo_documento === 'recibo');

    const now = new Date();
    const in7 = new Date();
    in7.setDate(now.getDate() + 7);

    const isExpired = (r: { status_documento?: string; data_vencimento?: string }) => {
      if (r.status_documento === 'expirada') return true;
      if (r.status_documento === 'emitida' && r.data_vencimento) {
        try { return new Date(r.data_vencimento) < now; } catch { return false; }
      }
      return false;
    };

    const pendingInvoicesCount = faturas.filter((f: any) =>
      f.status_documento === 'emitida' && (!f.status_pagamento || ['pendente', 'aguardando'].includes(f.status_pagamento))
    ).length;

    const pendingQuotesCount = cotacoes.filter((c: any) => c.status_documento === 'emitida').length;

    const expiringQuotesCount = cotacoes.filter((c: any) => {
      if (c.status_documento !== 'emitida' || !c.data_vencimento) return false;
      const d = new Date(c.data_vencimento);
      return d >= now && d <= in7;
    }).length;

    return {
      pendingInvoicesCount,
      pendingQuotesCount,
      totalInvoices: faturas.length,
      totalQuotes: cotacoes.length,
      totalReceipts: recibos.length,
      expiringQuotesCount,
      expiredQuotesCount: cotacoes.filter(isExpired).length,
      expiredInvoicesCount: faturas.filter(isExpired).length,
      pendingReceiptsCount: 0 // Recibos representam pagamentos concluídos na maioria dos casos
    };
  } catch {
    return emptyStats;
  }
}

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