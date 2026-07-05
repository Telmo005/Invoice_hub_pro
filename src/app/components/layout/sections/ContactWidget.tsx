'use client';

import { useState, useCallback } from 'react';
import styles from '@/styles/Footer.module.css';

// Formulário de contacto/suporte (2026-07-05): utilizador escreve uma
// mensagem (reportar bug, dúvida, etc.) que é enviada por email para a
// equipa (ALERT_EMAIL, o mesmo endereço já usado pelo digest de erros --
// não introduz uma nova variável de ambiente). Disponível sem sessão --
// alguém com problemas para entrar na conta também precisa de conseguir
// contactar suporte.

export default function ContactWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage(null);
    try {
      const csrfRes = await fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' });
      const csrfData = await csrfRes.json();
      const csrfToken = csrfData?.csrfToken || csrfData?.token;

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken || '' },
        credentials: 'include',
        body: JSON.stringify({ nome, email, mensagem })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || data.error || 'Erro ao enviar mensagem');
      }
      setStatus('success');
      setNome('');
      setEmail('');
      setMensagem('');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao enviar mensagem');
    }
  }, [nome, email, mensagem]);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={styles.legalLink} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
        Contactar Suporte
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            {status === 'success' ? (
              <div className="text-center py-4">
                <p className="text-green-600 font-semibold mb-2">Mensagem enviada!</p>
                <p className="text-sm text-gray-600 mb-4">Vamos responder o mais rápido possível.</p>
                <button type="button" onClick={handleClose} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">Fechar</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Contactar Suporte</h3>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="contact-nome">Nome</label>
                  <input id="contact-nome" type="text" required maxLength={70} value={nome} onChange={(e) => setNome(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="contact-email">O teu email</label>
                  <input id="contact-email" type="email" required maxLength={100} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="contact-mensagem">Mensagem</label>
                  <textarea id="contact-mensagem" required maxLength={2000} rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Descreve o problema ou a tua dúvida..." />
                </div>
                {status === 'error' && errorMessage && (
                  <div className="text-red-600 text-sm mb-3">{errorMessage}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={handleClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm">Cancelar</button>
                  <button type="submit" disabled={status === 'sending'} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm">
                    {status === 'sending' ? 'A enviar...' : 'Enviar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
