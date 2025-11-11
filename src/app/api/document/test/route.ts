import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
    try {
        const supabase = await supabaseServer()

        const { data: { user } } = await supabase.auth.getUser()

        const { data, error } = await supabase
            .from('faturas')
            .select('id, numero')
            .limit(2)

        if (error) {
            return NextResponse.json({
                status: 'Erro na consulta',
                error: 'Falha na consulta ao banco'
            }, { status: 500 })
        }

        return NextResponse.json({
            status: 'Operacional',
            user: user ? { id: user.id } : 'Não autenticado',
            documents_count: data?.length || 0,
            timestamp: new Date().toISOString()
        })

    } catch {
        return NextResponse.json({
            status: 'Erro interno',
            error: 'Falha no servidor'
        }, { status: 500 })
    }
}