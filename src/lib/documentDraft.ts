// Armazenamento local (localStorage) de rascunhos do wizard de criação de
// documento -- ver src/app/hooks/forms/useDocumentDraft.ts para o hook que
// consome isto. Objetivo: se o usuário sair a meio (chamada, troca de aba,
// fecho acidental), ao voltar encontra o formulário como o deixou.

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const DRAFT_KEY_PREFIX = 'invoicehub:draft';

export interface StoredDraft<T> {
  data: T;
  savedAt: number;
}

function draftKey(tipo: string, userId: string): string {
  return `${DRAFT_KEY_PREFIX}:${tipo}:${userId}`;
}

export function saveDraft<T>(tipo: string, userId: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredDraft<T> = { data, savedAt: Date.now() };
    window.localStorage.setItem(draftKey(tipo, userId), JSON.stringify(payload));
  } catch {
    // localStorage indisponível (modo privado, quota excedida, etc.) --
    // autosave é um extra, não pode quebrar o preenchimento do formulário.
  }
}

export function loadDraft<T>(tipo: string, userId: string): StoredDraft<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(draftKey(tipo, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(draftKey(tipo, userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(tipo: string, userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(draftKey(tipo, userId));
  } catch {
    // ignore
  }
}
