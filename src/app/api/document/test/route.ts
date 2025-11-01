import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
    console.log('🧪 [TEST API] Testando endpoint...')

    try {
        const supabase = await supabaseServer()
        console.log('✅ [TEST API] Supabase conectado')

        // Teste simples de autenticação
        const { data: { user } } = await supabase.auth.getUser()
        console.log('✅ [TEST API] User:', user?.id)

        // Teste simples de query
        const { data, error } = await supabase
            .from('faturas')
            .select('id, numero')
            .limit(2)

        console.log('✅ [TEST API] Query teste:', {
            count: data?.length,
            error: error?.message
        })

        return NextResponse.json({
            status: 'API funcionando! 🚀',
            user: user ? {
                id: user.id,
                email: user.email
            } : 'Não autenticado',
            documents_sample: data || [],
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('❌ [TEST API] Erro:', error)
        return NextResponse.json({
            status: 'Erro na API',
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            timestamp: new Date().toISOString()
        }, { status: 500 })
    }
}