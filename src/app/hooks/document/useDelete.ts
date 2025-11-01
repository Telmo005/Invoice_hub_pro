// app/hooks/useDelete.ts
import { useState } from 'react';

export function useDelete() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteDocument = async (documentId: string) => {
    try {
      setIsDeleting(true);
      setError(null);

      console.log('Iniciando delete para documento:', documentId);
      
      const response = await fetch(`/api/document/delete/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Resposta da API:', response.status, response.statusText);

      if (!response.ok) {
        // Tentar ler a resposta como texto primeiro para debug
        const responseText = await response.text();
        console.log('Resposta de erro:', responseText);
        
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          throw new Error(`Erro ${response.status}: ${responseText.substring(0, 100)}`);
        }
        
        throw new Error(errorData.error || `Erro ${response.status} ao eliminar documento`);
      }

      const result = await response.json();
      console.log('Delete bem sucedido:', result);
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro no hook de delete:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteDocument,
    isDeleting,
    error,
    clearError: () => setError(null)
  };
}