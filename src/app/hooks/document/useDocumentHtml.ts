// src/app/hooks/document/useDocumentHtml.ts
'use client';

import { useState, useCallback } from 'react';

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

export const useDocumentHtml = () => {
  const [documentHtml, setDocumentHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (htmlContent: string, documentData: any, documentNumber?: string) => {
    setIsGeneratingPdf(true);
    try {
      const pdfWindow = window.open('', '_blank');
      if (!pdfWindow) {
        throw new Error('Permita popups para gerar o PDF.');
      }

      const optimizedHtml = getPdfTemplate(htmlContent, documentData, documentNumber);
      
      pdfWindow.document.write(optimizedHtml);
      pdfWindow.document.close();
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      // Fallback: usar a API
      const pdfUrl = `/api/document/pdf/${documentData.id}`;
      window.open(pdfUrl, '_blank');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const fetchDocumentHtml = useCallback(async (documentId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/document/html?id=${documentId}`);

      if (!response.ok) {
        throw new Error('Não foi possível carregar o documento');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Erro ao carregar documento');
      }

      setDocumentHtml(data.data.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setDocumentHtml(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearDocumentHtml = useCallback(() => {
    setDocumentHtml(null);
    setError(null);
  }, []);

  return {
    documentHtml,
    isLoading,
    isGeneratingPdf,
    error,
    fetchDocumentHtml,
    clearDocumentHtml,
    handleDownload
  };
};