// app/api/document/quotation/find/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await supabaseServer();

        // Verificar autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autorizado' },
                { status: 401 }
            );
        }

        // Validar corpo da requisição
        const body = await request.json();
        const { numero } = body;

        if (!numero) {
            return NextResponse.json(
                { error: 'Número da cotação é obrigatório' },
                { status: 400 }
            );
        }

        if (typeof numero !== 'string' || numero.length > 20) {
            return NextResponse.json(
                { error: 'Número inválido' },
                { status: 400 }
            );
        }

        // Sanitizar e verificar
        const numeroSanitizado = numero.trim().toUpperCase();

        const { data: existingCotacao, error: queryError } = await supabase
            .from('faturas')
            .select('id, numero, tipo_documento, status, data_fatura, data_expiracao')
            .eq('user_id', user.id)
            .eq('numero', numeroSanitizado)
            .eq('tipo_documento', 'cotacao')
            //.is('deleted_at', null)
            .single();

        if (queryError && queryError.code !== 'PGRST116') {
            console.error('Erro ao verificar cotação:', queryError);
            return NextResponse.json(
                { error: 'Erro interno do servidor' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            exists: !!existingCotacao,
            numero: numeroSanitizado,
            cotacao: existingCotacao ? {
                id: existingCotacao.id,
                numero: existingCotacao.numero,
                status: existingCotacao.status,
                data_fatura: existingCotacao.data_fatura,
                data_expiracao: existingCotacao.data_expiracao,
                expirada: existingCotacao.data_expiracao && new Date(existingCotacao.data_expiracao) < new Date()
            } : null
        });

    } catch (error) {
        console.error('Erro ao verificar cotação:', error);

        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}