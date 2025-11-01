// app/hooks/documents/useCreate.ts
import { useCallback, useState } from 'react';
import { InvoiceData } from '@/types/invoice-types';

interface CreateDocumentResponse {
  id: string;
  numero: string;
  message: string;
  success: boolean;
}

interface UseCreateReturn {
  createDocument: (documentData: InvoiceData) => Promise<CreateDocumentResponse>;
  creating: boolean;
  error: string | null;
  resetError: () => void;
}

export function useCreate(): UseCreateReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDocument = useCallback(async (documentData: InvoiceData): Promise<CreateDocumentResponse> => {
    console.group('🔄 [useCreate] Iniciando criação de documento');
    
    setCreating(true);
    setError(null);

    try {
      const documentType = documentData.tipo || 'fatura';
      const endpoint = documentType === 'cotacao' 
        ? '/api/document/quotation/create' 
        : '/api/document/invoice/create';

      console.log('🎯 [useCreate] Configuração:', {
        documentType,
        endpoint,
        numero: documentData.formData?.faturaNumero || documentData.formData?.cotacaoNumero
      });

      // Validar dados mínimos antes de enviar
      if (!documentData.formData) {
        throw new Error('Dados do formulário não encontrados');
      }

      if (documentType === 'fatura' && !documentData.formData.faturaNumero) {
        throw new Error('Número da fatura é obrigatório');
      }

      if (documentType === 'cotacao' && !documentData.formData.cotacaoNumero) {
        throw new Error('Número da cotação é obrigatório');
      }

      const requestBody = {
        documentData
      };

      console.log('📤 [useCreate] Enviando requisição...');
      
      const startTime = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseTime = Date.now() - startTime;
      
      console.log('📥 [useCreate] Resposta recebida:', {
        tempo: `${responseTime}ms`,
        status: response.status,
        ok: response.ok
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ [useCreate] Erro na resposta:', {
          status: response.status,
          erro: result.error
        });
        
        throw new Error(result.error || `Erro ${response.status} ao criar ${documentType}`);
      }

      console.log('✅ [useCreate] Sucesso:', {
        id: result.id,
        numero: result.numero,
        message: result.message
      });

      console.groupEnd();
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      
      console.error('💥 [useCreate] Erro crítico:', {
        erro: err,
        mensagem: errorMessage
      });

      console.groupEnd();
      setError(errorMessage);
      throw err;
    } finally {
      console.log('🏁 [useCreate] Processo finalizado');
      setCreating(false);
    }
  }, []);

  const resetError = useCallback(() => {
    console.log('🔄 [useCreate] Resetando erro');
    setError(null);
  }, []);

  return {
    createDocument,
    creating,
    error,
    resetError,
  };
}