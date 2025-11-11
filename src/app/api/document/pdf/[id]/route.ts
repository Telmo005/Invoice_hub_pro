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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    if (!documentId || documentId === 'undefined' || documentId === 'null') {
      return NextResponse.json(
        { success: false, error: 'ID do documento é obrigatório' },
        { status: 400 }
      );
    }

    const { data: document, error } = await supabaseAdmin
      .from('faturas')
      .select(`
        id, 
        numero, 
        tipo_documento, 
        status, 
        html_content, 
        data_fatura, 
        moeda,
        destinatarios!inner (
          nome_completo
        )
      `)
      .eq('id', documentId)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { success: false, error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    if (!document.html_content) {
      return NextResponse.json(
        { success: false, error: 'Conteúdo não disponível para geração de PDF' },
        { status: 404 }
      );
    }

    const pdfHtml = getPdfTemplate(document.html_content, {
      id: document.id,
      numero: document.numero,
      type: document.tipo_documento,
      typeDisplay: document.tipo_documento === 'cotacao' ? 'Cotação' : 'Fatura',
      client: document.destinatarios.nome_completo,
      date: document.data_fatura,
      currency: document.moeda || 'MZN',
      status: document.status
    });

    return new NextResponse(pdfHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${document.tipo_documento === 'cotacao' ? 'cotacao' : 'fatura'}-${document.numero}.pdf"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}