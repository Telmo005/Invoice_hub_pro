// Modifique seu teste para verificar a tabela de faturas
export async function GET() {
    const supabase = supabaseServer();
    
    try {
        const { data, error } = await supabase
            .from('invoices') // Ou o nome real da sua tabela de faturas
            .select('*')
            .limit(5); // Aumente o limite para ver mais registros
            
        if (error) throw error;
        
        return NextResponse.json({ 
            success: true, 
            data,
            message: data.length === 0 ? 'Tabela existe mas está vazia' : 'Dados encontrados'
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Erro ao acessar tabela de faturas', details: error },
            { status: 500 }
        );
    }
}