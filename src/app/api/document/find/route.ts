// app/api/document/find/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await supabaseServer();

        // 1. Verificar autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autorizado' },
                { status: 401 }
            );
        }

        // 2. Validar corpo da requisição
        const body = await request.json();
        const { numero, tipo } = body;

        if (!numero || !tipo) {
            return NextResponse.json(
                { error: 'Número e tipo são obrigatórios' },
                { status: 400 }
            );
        }

        if (typeof numero !== 'string' || numero.length > 20) {
            return NextResponse.json(
                { error: 'Número inválido' },
                { status: 400 }
            );
        }

        if (!['fatura', 'cotacao'].includes(tipo)) {
            return NextResponse.json(
                { error: 'Tipo de documento inválido' },
                { status: 400 }
            );
        }

        // 3. Sanitizar dados
        const numeroSanitizado = numero.trim().toUpperCase();

        // 4. Verificar se já existe documento com este número para o usuário
        const { data: existingDocument, error: queryError } = await supabase
            .from('faturas')
            .select('id, numero, tipo_documento, status')
            .eq('user_id', user.id)
            .eq('numero', numeroSanitizado)
            .eq('tipo_documento', tipo)
           // .is('deleted_at', null) // Considerando soft delete se existir
            .single();

        if (queryError && queryError.code !== 'PGRST116') {
            // PGRST116 = nenhum resultado encontrado (isso é normal)
            console.error('Erro ao verificar documento:', queryError);
            return NextResponse.json(
                { error: 'Erro interno do servidor' },
                { status: 500 }
            );
        }

        // 5. Retornar resultado
        return NextResponse.json({
            exists: !!existingDocument,
            numero: numeroSanitizado,
            documento: existingDocument ? {
                id: existingDocument.id,
                numero: existingDocument.numero,
                tipo: existingDocument.tipo_documento,
                status: existingDocument.status
            } : null
        });

    } catch (error) {
        console.error('Erro ao verificar documento:', error);

        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}