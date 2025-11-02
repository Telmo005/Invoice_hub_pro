// app/api/test-logs/route.ts
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    console.log('🧪 TESTE: Iniciando teste de logs...');
    
    // Teste 1: Log simples
    await logger.log({
      action: 'api_call',
      message: 'Teste de log manual',
      details: { teste: true }
    });

    // Teste 2: Log de documento
    await logger.logDocumentCreation('cotacao', 'test-id-123', {
      numero: 'TEST-001',
      totais: { totalFinal: 1500 },
      items: [{ nome: 'Item Teste' }],
      emitente: { nomeEmpresa: 'Teste Emitente' },
      destinatario: { nomeCompleto: 'Teste Destinatário' }
    });

    // Teste 3: Log de erro
    await logger.logError(new Error('Erro de teste'), 'test_logs');

    console.log('✅ TESTE: Todos os logs foram enviados');

    return NextResponse.json({ 
      success: true, 
      message: 'Teste de logs executado - verifique o console e a tabela system_logs' 
    });

  } catch (error) {
    console.error('❌ TESTE: Erro no teste de logs:', error);
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}