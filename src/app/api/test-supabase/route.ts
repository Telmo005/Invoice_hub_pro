// src/app/api/test-supabase/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    try {
        const { data, error } = await supabase
            .from('faturas')
            .select('*')
            .limit(5);
            
        if (error) throw error;
        
        return NextResponse.json({ 
            success: true, 
            data,
            message: data.length === 0 ? 'Tabela existe mas está vazia' : 'Dados encontrados'
        });
    } catch (error) {
        return NextResponse.json(
            { 
                success: false,
                error: 'Erro ao acessar tabela de faturas', 
                details: error instanceof Error ? error.message : 'Erro desconhecido'
            },
            { status: 500 }
        );
    }
}