-- Cria view unificada usada pela API /api/document
CREATE OR REPLACE VIEW view_documentos_pagamentos AS
SELECT 
  db.id,
  db.user_id,
  db.numero,
  CASE 
    WHEN c.id IS NOT NULL THEN 'cotacao'
    WHEN f.id IS NOT NULL THEN 'fatura'
    WHEN r.id IS NOT NULL THEN 'recibo'
  END AS tipo_documento,
  db.status AS status_documento,
  db.moeda,
  db.created_at AS data_criacao,
  db.data_emissao,
  COALESCE(f.data_vencimento,
           CASE WHEN c.id IS NOT NULL THEN (db.data_emissao + (c.validez_dias * INTERVAL '1 day')) ELSE NULL END,
           r.data_recebimento) AS data_vencimento,
  e.nome_empresa AS emitente,
  d.nome_completo AS destinatario,
  td.total_final AS valor_documento,
  r.valor_recebido,
  COALESCE(f.documento_referencia, r.documento_referencia) AS documento_referencia,
  COALESCE(ii.qtd, 0) AS quantidade_itens,
  pstatus.status AS status_pagamento
FROM documentos_base db
LEFT JOIN cotacoes c ON c.id = db.id
LEFT JOIN faturas f   ON f.id = db.id
LEFT JOIN recibos r   ON r.id = db.id
LEFT JOIN emissores e ON e.id = db.emitente_id
LEFT JOIN destinatarios d ON d.id = db.destinatario_id
LEFT JOIN totais_documento td ON td.documento_id = db.id
LEFT JOIN (
  SELECT documento_id, COUNT(*)::int AS qtd
  FROM itens_documento
  GROUP BY documento_id
) ii ON ii.documento_id = db.id
LEFT JOIN (
  SELECT DISTINCT ON (documento_id)
    documento_id,
    status
  FROM pagamentos
  ORDER BY documento_id, created_at DESC
) pstatus ON pstatus.documento_id = db.id;
