// app/api/emissores/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

interface RouteParams {
    params: {
        id: string
    }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const supabase = await supabaseServer()

    try {
        // Verificar autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autorizado' },
                { status: 401 }
            )
        }

        const { id } = params

        // Buscar emitente específico
        const { data: emissor, error } = await supabase
            .from('emissores')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'Empresa não encontrada' },
                    { status: 404 }
                )
            }

            console.error('Erro ao buscar emitente:', error)
            return NextResponse.json(
                { error: 'Erro ao carregar dados da empresa' },
                { status: 500 }
            )
        }

        // Transformar para formato do frontend
        const empresa = {
            id: emissor.id,
            nome: emissor.nome_empresa,
            nuip: emissor.documento,
            pais: emissor.pais,
            cidade: emissor.cidade,
            endereco: emissor.bairro,
            telefone: emissor.telefone,
            email: emissor.email,
            pessoa_contato: emissor.pessoa_contato
        }

        return NextResponse.json({ empresa })

    } catch (error) {
        console.error('Erro completo ao carregar emitente:', error)
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        )
    }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    const supabase = await supabaseServer()

    try {
        // Verificar autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autorizado' },
                { status: 401 }
            )
        }

        const { id } = params
        const body = await request.json()

        // Atualizar emitente
        const { data: emissorAtualizado, error } = await supabase
            .from('emissores')
            .update({
                nome_empresa: body.nome_empresa,
                documento: body.documento,
                pais: body.pais,
                cidade: body.cidade,
                bairro: body.bairro,
                pessoa_contato: body.pessoa_contato,
                email: body.email,
                telefone: body.telefone,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) {
            console.error('Erro ao atualizar emitente:', error)
            return NextResponse.json(
                { error: 'Erro ao atualizar empresa' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            emissor: emissorAtualizado
        })

    } catch (error) {
        console.error('Erro completo ao atualizar emitente:', error)
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const supabase = await supabaseServer()

    try {
        // Verificar autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autorizado' },
                { status: 401 }
            )
        }

        const { id } = params

        // Verificar se existem faturas vinculadas a este emitente
        const { data: faturas, error: checkError } = await supabase
            .from('faturas')
            .select('id')
            .eq('emitente_id', id)
            .eq('user_id', user.id)
            .limit(1)

        if (checkError) {
            console.error('Erro ao verificar faturas:', checkError)
        }

        if (faturas && faturas.length > 0) {
            return NextResponse.json(
                { error: 'Não é possível excluir esta empresa pois existem faturas vinculadas a ela' },
                { status: 400 }
            )
        }

        // Excluir emitente
        const { error } = await supabase
            .from('emissores')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) {
            console.error('Erro ao excluir emitente:', error)
            return NextResponse.json(
                { error: 'Erro ao excluir empresa' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Empresa excluída com sucesso'
        })

    } catch (error) {
        console.error('Erro completo ao excluir emitente:', error)
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        )
    }
}