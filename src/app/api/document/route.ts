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
  try {
    // Totais simples por tabela
    const [
      { count: totalInvoices },
      { count: totalQuotes },
      { count: totalReceipts }
    ] = await Promise.all([
      supabase.from('faturas').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('cotacoes').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('recibos').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    ])

    // Fallback para recibos antigos que não tinham user_id (conta via view unificada)
    let receiptsCountFinal = totalReceipts || 0;
    if (!receiptsCountFinal) {
      const { count: viewReceiptsCount } = await supabase
        .from('view_documentos_pagamentos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('tipo_documento', 'recibo');
      receiptsCountFinal = viewReceiptsCount || 0;
    }

    // Faturas pendentes: emitidas sem pagamento concluído
    const { data: pendingInvoicesData } = await supabase
      .from('view_documentos_pagamentos')
      .select('id,status_documento,status_pagamento')
      .eq('user_id', userId)
      .eq('tipo_documento', 'fatura')
      .in('status_documento', ['emitida'])
      .or('status_pagamento.is.null,status_pagamento.in.(pendente,aguardando)');

    const pendingInvoicesCount = (pendingInvoicesData || []).filter((d: { status_documento?: string }) => d.status_documento === 'emitida').length;

    // Cotações pendentes: emitidas (ainda não convertidas) 
    const { data: pendingQuotesData } = await supabase
      .from('cotacoes')
      .select('id,status_documento,data_vencimento')
      .eq('user_id', userId)
      .eq('status_documento', 'emitida');

    const pendingQuotesCount = (pendingQuotesData || []).length;

    // Cotações a expirar em <= 7 dias
    const now = new Date();
    const in7 = new Date();
    in7.setDate(now.getDate() + 7);
    const { data: expiringQuotesData } = await supabase
      .from('cotacoes')
      .select('id,status_documento,data_vencimento')
      .eq('user_id', userId)
      .eq('status_documento', 'emitida')
      .gte('data_vencimento', now.toISOString())
      .lte('data_vencimento', in7.toISOString());

    const expiringQuotesCount = (expiringQuotesData || []).length;

    // Cotações expiradas
    const { data: expiredQuotesData } = await supabase
      .from('cotacoes')
      .select('id,status_documento')
      .eq('user_id', userId)
      .eq('status_documento', 'expirada');

    const expiredQuotesCount = (expiredQuotesData || []).length;

    // Faturas expiradas
    const { data: expiredInvoicesData } = await supabase
      .from('faturas')
      .select('id,status_documento')
      .eq('user_id', userId)
      .eq('status_documento', 'expirada');

    const expiredInvoicesCount = (expiredInvoicesData || []).length;

    return {
      pendingInvoicesCount,
      pendingQuotesCount,
      totalInvoices: totalInvoices || 0,
      totalQuotes: totalQuotes || 0,
      totalReceipts: receiptsCountFinal,
      expiringQuotesCount,
      expiredQuotesCount,
      expiredInvoicesCount,
      pendingReceiptsCount: 0 // Recibos representam pagamentos concluídos na maioria dos casos
    };
  } catch {
    return {
      pendingInvoicesCount: 0,
      pendingQuotesCount: 0,
      totalInvoices: 0,
      totalQuotes: 0,
      totalReceipts: 0,
      expiringQuotesCount: 0,
      pendingReceiptsCount: 0
    };
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