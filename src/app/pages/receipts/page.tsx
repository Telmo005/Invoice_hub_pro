// pages/receipts/page.tsx
'use client';

import Navbar from '@/app/components/layout/sections/Navbar';
import { useList } from '@/app/hooks/document/useList';
import { FiFileText, FiEye, FiRefreshCw } from 'react-icons/fi';
import React from 'react';

export default function ReceiptsListPage() {
  const { documents, loading, error, refetch } = useList({ tipo: 'recibos', limit: 20 });

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <Navbar />
      <div className="py-3 border-top border-bottom border-2" />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2"><FiFileText /> Recibos</h1>
          <button
            onClick={refetch}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium"
          >
            <FiRefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-600">Carregando recibos...</div>
        )}
        {error && (
          <div className="text-center py-16 text-red-600">Erro: {error}</div>
        )}

        {!loading && !error && documents.length === 0 && (
          <div className="text-center py-16 text-gray-600">Nenhum recibo encontrado.</div>
        )}

        {!loading && !error && documents.length > 0 && (
          <div className="overflow-x-auto bg-white shadow-sm rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Número</th>
                  <th className="px-3 py-2 text-left">Destinatário</th>
                  <th className="px-3 py-2 text-left">Referência</th>
                  <th className="px-3 py-2 text-right">Valor Recebido</th>
                  <th className="px-3 py-2 text-left">Moeda</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{doc.numero}</td>
                    <td className="px-3 py-2 text-gray-700">{doc.destinatario}</td>
                    <td className="px-3 py-2 text-gray-600">{(doc as any).referencia || '-'}</td>
                    <td className="px-3 py-2 text-right text-gray-800">{doc.valor_total.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-gray-700">{doc.moeda}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{doc.status}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <a
                        href={`/api/document/view/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                      >
                        <FiEye className="h-4 w-4" /> Ver
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
