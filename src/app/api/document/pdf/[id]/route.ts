import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';

const getPdfTemplate = (htmlContent: string, documentData: any, nonce: string, documentNumber?: string): string => {
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

      .header, .footer, #header, #footer, .print-header, .print-footer {
        display: none !important;
      }
      /* Permite cabeçalhos específicos de documentos (evita esconder .receipt-header) */
      .receipt-header { display: block !important; }
      .invoice-header { display: block !important; }
      .quotation-header { display: block !important; }
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

  <script nonce="${nonce}">
    setTimeout(() => window.print(), 500);
    window.onbeforeunload = () => "PDF gerado com sucesso? Pode fechar esta janela.";
  </script>
</body>
</html>`;
};

// Rota pública por desenho (fallback de download usado por useDocumentHtml.ts
// para clientes/utilizadores que recebem o link do documento). Antes desta
// correção, a query usava a tabela `faturas` com colunas que já não existem
// desde a normalização do schema (numero, tipo_documento, status, html_content,
// data_fatura, moeda, destinatarios) -- por isso esta rota estava
// silenciosamente quebrada. Passa a usar `documentos_base`/`view_documentos_pagamentos`,
// a mesma fonte já usada em document/view/[id]. Mitigação do IDOR (C2, ver
// docs/auditoria-inicial.md): manter público, mas com rate limiting + registo.
export const GET = withApiGuard(async (request: NextRequest) => {
  const documentId = request.nextUrl.pathname.split('/').pop();

  if (!documentId || documentId === 'undefined' || documentId === 'null') {
    return NextResponse.json(
      { success: false, error: 'ID do documento é obrigatório' },
      { status: 400 }
    );
  }

  let tipoDocumento: string | null = null;
  let numero: string | null = null;
  let moeda: string | null = null;
  let statusDoc: string | null = null;
  let clientName: string = 'Cliente não especificado';

  const { data: viewDoc } = await supabaseAdmin
    .from('view_documentos_pagamentos')
    .select('id, tipo_documento, numero, moeda, status_documento, destinatario')
    .eq('id', documentId)
    .maybeSingle();

  if (viewDoc) {
    tipoDocumento = viewDoc.tipo_documento;
    numero = viewDoc.numero;
    moeda = viewDoc.moeda;
    statusDoc = viewDoc.status_documento;
    if (viewDoc.destinatario) {
      clientName = viewDoc.destinatario;
    }
  }

  const { data: baseDoc } = await supabaseAdmin
    .from('documentos_base')
    .select('id, numero, status, html_content, moeda')
    .eq('id', documentId)
    .maybeSingle();

  if (!baseDoc) {
    await logger.log({
      action: 'document_download',
      level: 'warn',
      message: `Tentativa de geração de PDF para documento inexistente: ${documentId}`,
      details: { documentId }
    });
    return NextResponse.json(
      { success: false, error: 'Documento não encontrado' },
      { status: 404 }
    );
  }

  if (!baseDoc.html_content) {
    return NextResponse.json(
      { success: false, error: 'Conteúdo não disponível para geração de PDF' },
      { status: 404 }
    );
  }

  tipoDocumento = tipoDocumento || 'fatura';
  numero = numero || baseDoc.numero;
  moeda = moeda || baseDoc.moeda || 'MZN';
  statusDoc = statusDoc || baseDoc.status;

  const pdfHtml = getPdfTemplate(baseDoc.html_content, {
    id: baseDoc.id,
    numero,
    type: tipoDocumento,
    typeDisplay: tipoDocumento === 'cotacao' ? 'Cotação' : (tipoDocumento === 'recibo' ? 'Recibo' : 'Fatura'),
    client: clientName,
    currency: moeda,
    status: statusDoc
  }, request.headers.get('x-nonce') ?? '');

  // Não há geração real de PDF binário no servidor -- este HTML conta com o
  // <script> de auto-print acima para abrir a caixa de impressão do browser
  // (o utilizador escolhe "Guardar como PDF"). Antes, esta rota anunciava
  // 'Content-Disposition: attachment; filename="...pdf"' com um
  // Content-Type de text/html -- o browser gravava um ficheiro chamado
  // "...pdf" cujos bytes eram HTML, que qualquer leitor de PDF rejeita como
  // corrompido. Servir inline (sem attachment) deixa o browser mostrar a
  // página e disparar o print normalmente, tal como document/view/[id].
  return new NextResponse(pdfHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}, { rate: { limit: 30, intervalMs: 60_000 }, auditAction: 'document_pdf' });
