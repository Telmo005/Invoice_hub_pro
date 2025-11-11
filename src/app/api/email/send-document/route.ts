// src/app/api/email/send-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/services/email-service';

export async function POST(request: NextRequest) {
  console.log('📧 API send-document: Iniciando processamento...');
  
  try {
    const body = await request.json();
    
    console.log('📧 PARÂMETROS RECEBIDOS:', {
      documentId: body.documentId,
      documentNumber: body.documentNumber,
      documentType: body.documentType,
      clientEmail: body.clientEmail
    });
    
    const { 
      documentId,
      documentNumber,
      documentType, 
      clientName, 
      clientEmail, 
      date,
      totalValue,
      currency
    } = body;

    // Validações básicas do MVP-1
    if (!documentId?.trim()) {
      return NextResponse.json(
        { success: false, error: 'ID do documento é obrigatório' },
        { status: 400 }
      );
    }

    if (!documentNumber?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Número do documento é obrigatório' },
        { status: 400 }
      );
    }

    if (!clientEmail?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email do cliente é obrigatório' },
        { status: 400 }
      );
    }

    console.log('📧 Chamando emailService...');
    const result = await emailService.sendDocumentLink({
      documentId,
      documentNumber: documentNumber.trim(),
      documentType,
      clientName: clientName?.trim() || 'Cliente',
      clientEmail: clientEmail.trim(),
      date: date || new Date().toISOString(),
      totalValue,
      currency
    });

    console.log('📧 Resultado do emailService:', result.success);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Erro na API de email:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}