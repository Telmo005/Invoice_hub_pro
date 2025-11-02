// app/api/admin/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await supabaseServer();

        // Verificar se é admin (implemente sua lógica de admin)
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const level = searchParams.get('level');
        const action = searchParams.get('action');

        let query = supabase
            .from('system_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (level) query = query.eq('level', level);
        if (action) query = query.eq('action', action);

        const { data: logs, error, count } = await query;

        if (error) {
            console.error('Erro ao buscar logs:', error);
            return NextResponse.json({ error: 'Erro ao buscar logs' }, { status: 500 });
        }

        return NextResponse.json({
            logs,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });

    } catch (error) {
        console.error('Erro inesperado:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}