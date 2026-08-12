'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadDraft, saveDraft, clearDraft, StoredDraft } from '@/lib/documentDraft';

const AUTOSAVE_DEBOUNCE_MS = 800;

interface UseDocumentDraftParams<T> {
  tipo: string;
  userId: string | null | undefined;
  data: T;
}

// Autosave do wizard de criação de documento: se o usuário sair a meio do
// preenchimento (chamada, troca de aba, fecho acidental do browser), ao
// voltar encontra um banner para retomar em vez de ter de refazer tudo.
export function useDocumentDraft<T>({ tipo, userId, data }: UseDocumentDraftParams<T>) {
  const [pendingDraft, setPendingDraft] = useState<StoredDraft<T> | null>(null);
  const [checked, setChecked] = useState(false);
  const decidedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verifica uma única vez, ao montar, se há um rascunho pendente para este
  // tipo de documento e utilizador.
  useEffect(() => {
    if (!userId || checked) return;
    // O fluxo de clonagem de documento (sessionStorage, ver
    // newDocumentWizzardForm.tsx) já preenche o formulário sozinho -- não
    // interromper com o banner de rascunho nesse caso.
    if (typeof window !== 'undefined' && window.sessionStorage.getItem('clonedInvoiceData')) {
      decidedRef.current = true;
      setChecked(true);
      return;
    }
    const found = loadDraft<T>(tipo, userId);
    if (found) setPendingDraft(found);
    else decidedRef.current = true; // nada para decidir, pode autosave já
    setChecked(true);
  }, [userId, tipo, checked]);

  // Autosave (debounced) -- só depois de decidido o que fazer com um
  // eventual rascunho anterior, para não o sobrescrever com o formulário
  // ainda em branco antes do usuário poder escolher "Continuar"/"Novo".
  useEffect(() => {
    if (!userId || !checked || !decidedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDraft(tipo, userId, data);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [userId, tipo, checked, data]);

  const restoreDraft = useCallback((): T | null => {
    if (!pendingDraft) return null;
    decidedRef.current = true;
    setPendingDraft(null);
    return pendingDraft.data;
  }, [pendingDraft]);

  const discardDraft = useCallback(() => {
    decidedRef.current = true;
    if (userId) clearDraft(tipo, userId);
    setPendingDraft(null);
  }, [tipo, userId]);

  const clearOnSuccess = useCallback(() => {
    if (userId) clearDraft(tipo, userId);
  }, [tipo, userId]);

  return { pendingDraft, restoreDraft, discardDraft, clearOnSuccess };
}
