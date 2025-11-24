-- Remove CHECK constraint que limita metodo_pagamento a lista fixa
ALTER TABLE faturas DROP CONSTRAINT IF EXISTS faturas_metodo_pagamento_check;

-- Opcional: permitir qualquer texto (já é padrão). Se quiser garantir não nulo, descomente:
-- ALTER TABLE faturas ALTER COLUMN metodo_pagamento DROP NOT NULL;

-- Log manual (caso tenha tabela de migrações de sistema)
-- INSERT INTO system_logs (level, action, message) VALUES ('info', 'migration', 'Removida constraint metodo_pagamento em faturas para permitir valor informativo livre');
