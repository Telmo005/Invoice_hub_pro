import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    await logger.log({
      action: 'api_call',
      message: 'Teste de log manual',
      details: { teste: true }
    });

    await logger.logDocumentCreation('cotacao', 'test-id-123', {
      numero: 'TEST-001',
      totais: { totalFinal: 1500 },
      items: [{ nome: 'Item Teste' }],
      emitente: { nomeEmpresa: 'Teste Emitente' },
      destinatario: { nomeCompleto: 'Teste Destinatário' }
    });

    await logger.logError(new Error('Erro de teste'), 'test_logs');

    return NextResponse.json({ 
      success: true, 
      message: 'Teste de logs executado' 
    });

  } catch {
    return NextResponse.json({ 
      success: false, 
      error: 'Erro no teste' 
    }, { status: 500 });
  }
}