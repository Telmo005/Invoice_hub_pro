// src/app/test-email/page.tsx
'use client';

import { useState } from 'react';

export default function TestEmailPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const handleTest = async () => {
    if (!email) {
      alert('Por favor, insira um email para teste');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toEmail: email }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: 'Erro de conexão com o servidor'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">🧪 Teste de Email</h1>
        <p className="text-gray-600 mb-6">Verifique se o Gmail está configurado corretamente</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email para teste:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu-email@gmail.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleTest}
          disabled={loading || !email}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Enviando Teste...' : 'Enviar Email de Teste'}
        </button>

        {result && (
          <div className={`mt-4 p-4 rounded-md ${
            result.success 
              ? 'bg-green-50 border border-green-200 text-green-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <h3 className="font-semibold">
              {result.success ? '✅ Sucesso!' : '❌ Erro'}
            </h3>
            <p className="text-sm mt-1">{result.message || result.error}</p>
          </div>
        )}

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <h4 className="font-semibold text-yellow-800 mb-2">📝 Instruções:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>1. Insira um email válido onde quer receber o teste</li>
            <li>2. Clique em "Enviar Email de Teste"</li>
            <li>3. Verifique sua caixa de entrada (e spam)</li>
            <li>4. Se receber o email, a configuração está correta!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}