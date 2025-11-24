import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const getPdfTemplate = (htmlContent: string, documentData: any, documentNumber?: string): string => {
  const documentType = documentData?.type === 'cotacao' ? 'Cotação' : 'Fatura';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${documentType} ${documentNumber || documentData?.numero}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
      font-family: 'Arial', 'Helvetica', sans-serif;
    }
    
    body { 
      background: white !important;
      color: #000 !important;
      line-height: 1.4;
      padding: 5mm;
      margin: 0 !important;
    }
    
    @media print {
      @page {
        margin: 5mm !important;
        size: A4;
        margin-header: 0 !important;
        margin-footer: 0 !important;
        marks: none !important;
      }
      
      body { 
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
      }
      
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      .header, .footer, [class*="header"], [class*="footer"],
      #header, #footer, .print-header, .print-footer {
        display: none !important;
      }
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
    }
    
    th, td {
      padding: 8px 12px;
      border: 1px solid #ddd;
    }
    
    .no-break {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${htmlContent}
  
  <script>
    setTimeout(() => window.print(), 500);
    window.onbeforeunload = () => "PDF gerado com sucesso? Pode fechar esta janela.";
  </script>
</body>
</html>`;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await context.params;

    if (!documentId || documentId === 'undefined' || documentId === 'null') {
      return NextResponse.json(
        { success: false, error: 'ID do documento é obrigatório' },
        { status: 400 }
      );
    }

    // 1. Tentar obter metadados via view unificada para determinar tipo
    let tipoDocumento: string | null = null;
    let numero: string | null = null;
    let moeda: string | null = null;
    let statusDoc: string | null = null;
    let dataFatura: string | null = null;
    let clientName: string = 'Cliente não especificado';

    const { data: viewDoc } = await supabaseAdmin
      .from('view_documentos_pagamentos')
      .select('id, tipo_documento, numero, moeda, status_documento, data_criacao, destinatario')
      .eq('id', documentId)
      .maybeSingle();

    if (viewDoc) {
      tipoDocumento = viewDoc.tipo_documento;
      numero = viewDoc.numero;
      moeda = viewDoc.moeda;
      statusDoc = viewDoc.status_documento;
      dataFatura = viewDoc.data_criacao;
      if (viewDoc.destinatario) {
        clientName = viewDoc.destinatario;
      }
    }

    // 2. Buscar html_content diretamente na tabela base (fonte de verdade)
    const { data: baseDoc } = await supabaseAdmin
      .from('documentos_base')
      .select('id, numero, status, html_content, data_emissao, moeda')
      .eq('id', documentId)
      .maybeSingle();

    if (!baseDoc) {
      return NextResponse.json(
        { success: false, error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    if (!baseDoc.html_content) {
      return NextResponse.json(
        { success: false, error: 'Conteúdo não disponível para visualização' },
        { status: 404 }
      );
    }

    // Ajustar tipo e numero com fallback para dados da tabela base
    tipoDocumento = tipoDocumento || 'fatura';
    numero = numero || baseDoc.numero;
    moeda = moeda || baseDoc.moeda || 'MZN';
    statusDoc = statusDoc || baseDoc.status;
    dataFatura = dataFatura || baseDoc.data_emissao;

    const pdfHtml = getPdfTemplate(baseDoc.html_content, {
      id: baseDoc.id,
      numero,
      type: tipoDocumento,
      typeDisplay: tipoDocumento === 'cotacao' ? 'Cotação' : (tipoDocumento === 'recibo' ? 'Recibo' : 'Fatura'),
      client: clientName,
      date: dataFatura,
      currency: moeda,
      status: statusDoc
    });

    return new NextResponse(pdfHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Erro ao gerar visualização PDF:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}