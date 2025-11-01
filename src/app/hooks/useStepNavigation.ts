// app/hooks/useStepNavigation.ts
'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UseStepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  formId: string;
}

export const useStepNavigation = ({
  currentStep,
  totalSteps,
  onStepChange,
  formId
}: UseStepNavigationProps) => {
  const isPopState = useRef(false);
  const isInitialized = useRef(false);

  // Função para atualizar a URL
  const updateUrl = useCallback((step: number, replace: boolean = false) => {
    const url = new URL(window.location.href);
    url.searchParams.set('step', step.toString());
    
    if (replace) {
      window.history.replaceState(
        { formId, step, timestamp: Date.now() },
        '',
        url.toString()
      );
    } else {
      window.history.pushState(
        { formId, step, timestamp: Date.now() },
        '',
        url.toString()
      );
    }
  }, [formId]);

  // Função para navegar para um step específico
  const goToStep = useCallback((step: number) => {
    if (step < 0 || step >= totalSteps || step === currentStep) return;

    console.log(`Navigating from step ${currentStep} to step ${step}`);

    // Adiciona o estado atual ao histórico
    updateUrl(currentStep, false);
    
    // Atualiza para o novo step
    updateUrl(step, true);
    
    // Executa a mudança de step
    onStepChange(step);
  }, [currentStep, totalSteps, onStepChange, updateUrl]);

  // Função para voltar um step
  const goBack = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  // Função para avançar um step
  const goForward = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, totalSteps, goToStep]);

  // Efeito para lidar com o popstate (botão voltar/avancar do navegador)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      console.log('🔙 PopState event detected', event.state);
      
      // Verifica se é uma navegação do nosso formulário
      if (event.state?.formId === formId) {
        isPopState.current = true;
        
        const targetStep = event.state.step;
        console.log(`🎯 Navigating to step: ${targetStep} (current: ${currentStep})`);
        
        if (targetStep >= 0 && targetStep < totalSteps && targetStep !== currentStep) {
          onStepChange(targetStep);
        }
        
        // Previne o comportamento padrão do browser para nossa navegação
        event.preventDefault();
      } else {
        console.log('🌐 External navigation - not handling');
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentStep, totalSteps, formId, onStepChange]);

  // Efeito para sincronizar a URL quando o step muda
  useEffect(() => {
    if (isInitialized.current && !isPopState.current) {
      console.log(`🔄 Step changed internally to: ${currentStep}`);
      updateUrl(currentStep, true);
    }
    isPopState.current = false;
  }, [currentStep, updateUrl]);

  // Efeito inicial para configurar o estado do histórico
  useEffect(() => {
    if (!isInitialized.current) {
      const urlParams = new URLSearchParams(window.location.search);
      const stepFromUrl = urlParams.get('step');
      const initialStep = stepFromUrl ? 
        Math.max(0, Math.min(parseInt(stepFromUrl), totalSteps - 1)) : 0;
      
      console.log(`🚀 Initializing step navigation. URL step: ${stepFromUrl}, Initial step: ${initialStep}`);
      
      // Configura o estado inicial
      window.history.replaceState(
        { formId, step: initialStep, timestamp: Date.now() },
        '',
        window.location.href
      );
      
      isInitialized.current = true;
    }
  }, [formId, totalSteps]);

  return {
    goToStep,
    goBack,
    goForward,
    currentStep
  };
};