// src/services/email-service.ts
import nodemailer from 'nodemailer';

export interface EmailDocumentData {
  documentId: string;
  documentNumber: string;
  documentType: 'fatura' | 'cotacao';
  clientName: string;
  clientEmail: string;
  date: string;
  totalValue?: string;
  currency?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('Credenciais de email não configuradas');
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  private getDocumentDisplayInfo(documentType: 'fatura' | 'cotacao') {
    const isCotacao = documentType === 'cotacao';
    return {
      typeDisplay: isCotacao ? 'Cotação' : 'Fatura',
      typeDisplayLower: isCotacao ? 'cotação' : 'fatura',
    };
  }

  private generateViewLink(documentId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    if (!baseUrl) {
      throw new Error('NEXT_PUBLIC_APP_URL não configurado');
    }

    return `${baseUrl.replace(/\/$/, '')}/api/document/view/${documentId}`;
  }

  async sendDocumentLink(documentData: EmailDocumentData): Promise<{ success: boolean; message: string }> {
    try {
      console.log('📧 EmailService: Iniciando envio para:', documentData.clientEmail);

      if (!documentData.documentId?.trim()) {
        throw new Error('ID do documento é obrigatório');
      }

      if (!documentData.documentNumber?.trim()) {
        throw new Error('Número do documento é obrigatório');
      }

      if (!documentData.clientEmail?.trim()) {
        throw new Error('Email do cliente é obrigatório');
      }

      const { typeDisplay, typeDisplayLower } = this.getDocumentDisplayInfo(documentData.documentType);
      
      const viewLink = this.generateViewLink(documentData.documentId);
      console.log('📧 EmailService: Link de visualização gerado:', viewLink);

      const htmlTemplate = this.createEmailTemplate(documentData, typeDisplay, typeDisplayLower, viewLink);

      const mailOptions = {
        from: `"DigitalHub" <${process.env.GMAIL_USER}>`,
        to: documentData.clientEmail,
        subject: `${typeDisplay} ${documentData.documentNumber} - DigitalHub`,
        html: htmlTemplate,
      };

      await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Email enviado com sucesso para:', documentData.clientEmail);
      
      return {
        success: true,
        message: `${typeDisplay} enviada com sucesso para ${documentData.clientEmail}`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar email';
      console.error('❌ Erro no envio de email:', errorMessage);
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  private createEmailTemplate(
    documentData: EmailDocumentData, 
    typeDisplay: string, 
    typeDisplayLower: string,
    viewLink: string
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${typeDisplay} ${documentData.documentNumber} - DigitalHub</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: #f8fafc;
            -webkit-font-smoothing: antialiased;
        }
        
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
        }
        
        .header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .logo {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 600;
            margin: 16px 0 8px 0;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 16px;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 24px;
            color: #4b5563;
        }
        
        .message {
            font-size: 15px;
            color: #4b5563;
            margin-bottom: 32px;
            line-height: 1.6;
        }
        
        .download-section {
            text-align: center;
            margin: 32px 0;
        }
        
        .primary-button {
            display: inline-block;
            background: #2563eb;
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
            margin-top: 16px;
        }
        
        .primary-button:hover {
            background: #1d4ed8;
            transform: translateY(-1px);
        }
        
        .support-section {
            border-top: 1px solid #e5e7eb;
            padding-top: 24px;
            margin-top: 32px;
        }
        
        .support-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .footer {
            text-align: center;
            padding: 32px 30px;
            background: #f8fafc;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
        }
        
        .footer p {
            margin: 4px 0;
        }
        
        @media (max-width: 600px) {
            .header {
                padding: 30px 20px;
            }
            
            .content {
                padding: 30px 20px;
            }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="header">
            <div class="logo">DIGITALHUB</div>
            <h1>${typeDisplay} Disponível</h1>
            <p>Sua ${typeDisplayLower} foi processada e está pronta para visualização</p>
        </div>
        
        <div class="content">
            <p class="greeting">Prezado(a) <strong>${documentData.clientName}</strong>,</p>
            
            <p class="message">
                Informamos que sua ${typeDisplayLower} <strong>${documentData.documentNumber}</strong> foi processada com sucesso e está disponível para download.
                <br><br>
                Clique no botão abaixo para visualizar e baixar sua ${typeDisplayLower} em formato PDF.
            </p>

            <div class="download-section">
                <a href="${viewLink}" class="primary-button" target="_blank" rel="noopener noreferrer">
                    📄 Baixar ${typeDisplay}
                </a>
            </div>

            <div class="support-section">
                <p class="support-title">📞 Precisa de ajuda?</p>
                <p>Entre em contacto connosco respondendo a este email ou através do nosso suporte.</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>DigitalHub</strong></p>
            <p>Email: digitalhub.midia@gmail.com</p>
            <p style="margin-top: 16px; font-size: 12px; opacity: 0.8;">
                Esta é uma mensagem automática. Por favor, não responda a este email.
            </p>
        </div>
    </div>
</body>
</html>`;
  }
}

export const emailService = new EmailService();