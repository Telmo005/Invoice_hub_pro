// src/app/api/email/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const { toEmail } = await request.json();

    if (!toEmail) {
      return NextResponse.json(
        { success: false, error: 'Email de destino é obrigatório' },
        { status: 400 }
      );
    }

    // ✅ CORREÇÃO: createTransport (no singular)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Verificar configuração
    await transporter.verify();

    // Enviar email de teste
    const testResult = await transporter.sendMail({
      from: `"DigitalHub Test" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: '✅ Teste de Configuração Gmail - DigitalHub',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; border: 1px solid #c3e6cb; }
                .info { background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 5px; border: 1px solid #bee5eb; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success">
                    <h2>🎉 Teste Bem-Sucedido!</h2>
                    <p>O serviço de email do DigitalHub está configurado corretamente.</p>
                </div>
                
                <div class="info">
                    <h3>📋 Detalhes do Teste:</h3>
                    <ul>
                        <li><strong>Serviço:</strong> Gmail SMTP</li>
                        <li><strong>Conta:</strong> ${process.env.GMAIL_USER}</li>
                        <li><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-MZ')}</li>
                        <li><strong>Status:</strong> ✅ Funcionando</li>
                    </ul>
                </div>
                
                <p>Se você recebeu este email, significa que o sistema pode enviar emails para clientes.</p>
                
                <hr>
                <p><small>DigitalHub - Sistema de Gestão de Documentos</small></p>
            </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({
      success: true,
      message: 'Email de teste enviado com sucesso!',
      messageId: testResult.messageId
    });

  } catch (error: any) {
    console.error('❌ Erro no teste de email:', error);
    
    let errorMessage = 'Erro desconhecido';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Falha na autenticação. Verifique GMAIL_USER e GMAIL_APP_PASSWORD.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Erro de conexão com o Gmail. Verifique sua internet.';
    } else {
      errorMessage = error.message || 'Erro ao enviar email de teste';
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    );
  }
}


