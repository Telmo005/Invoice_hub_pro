// app/hooks/useInvoiceForm.ts
import { useState, useEffect, useCallback } from 'react';
import { FormDataFatura, ItemFatura, TotaisFatura, TaxaItem, InvoiceData, TipoDocumento } from '@/types/invoice-types';

// Interfaces para controle de modificações
interface EmpresaModificacoes {
  empresaOriginal: Empresa | null;
  camposModificados: Record<string, { original: string; atual: string }>;
  houveModificacoes: boolean;
}

// Constants for validation
const VALIDATION_RULES = {
  MAX_STRING_LENGTH: 100,
  MAX_DOCUMENT_LENGTH: 20,
  MAX_EMAIL_LENGTH: 60,
  MAX_PHONE_LENGTH: 20,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_TERMS_LENGTH: 260,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 999999,
  MIN_PRICE: 0,
  MAX_PRICE: 99999999.99,
  MIN_TAX_RATE: 0,
  MAX_TAX_RATE: 100,
} as const;

const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>]/g, '');
};

const sanitizeNumber = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, Number(value) || min));
};

const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

const validateEmail = (email: string): boolean => {
  if (!email) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone: string): boolean => {
  if (!phone) return true;
  const phoneRegex = /^[\+]?[0-9\s\-\(\)]{8,20}$/;
  return phoneRegex.test(phone);
};

const validateDocument = (document: string): boolean => {
  if (!document) return true;
  const docRegex = /^[A-Z0-9\-\s]{1,20}$/;
  return docRegex.test(document);
};

// Função para calcular a data de validade
const calcularDataValidade = (dataFatura: string, diasValidade: string | number): string => {
  const data = new Date(dataFatura);
  const dias = typeof diasValidade === 'string' ? parseInt(diasValidade) || 15 : diasValidade;
  data.setDate(data.getDate() + dias);
  return data.toISOString().split('T')[0];
};

// Função para calcular dias entre duas datas
const calcularDiasEntreDatas = (dataInicio: string, dataFim: string): number => {
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  const diferenca = fim.getTime() - inicio.getTime();
  return Math.ceil(diferenca / (1000 * 3600 * 24));
};

const useInvoiceForm = (tipoInicial: TipoDocumento = 'fatura') => {
  // Default data atualizado com validezFatura
  const defaultFormData: FormDataFatura = {
    tipo: tipoInicial,
    emitente: {
      nomeEmpresa: '',
      documento: '',
      pais: '',
      cidade: '',
      bairro: '',
      email: '',
      telefone: '',
    },
    destinatario: {
      nomeCompleto: '',
      documento: '',
      pais: '',
      cidade: '',
      bairro: '',
      email: '',
      telefone: '',
    },
    faturaNumero: '',
    cotacaoNumero: '',
    ordemCompra: '',
    dataFatura: new Date().toISOString().split('T')[0],
    dataVencimento: calcularDataValidade(new Date().toISOString().split('T')[0], '15'),
    termos: 'Este documento é válido por 15 dias a partir da data de emissão.',
    moeda: 'MT',
    metodoPagamento: '',
    validezCotacao: '15',
    validezFatura: '15'
  };

  const defaultItem: ItemFatura = {
    id: 1,
    quantidade: 1,
    descricao: '',
    precoUnitario: 0,
    taxas: [{ nome: 'IVA', valor: 16, tipo: 'percent' }],
    totalItem: 0,
  };

  // State
  const [formData, setFormData] = useState<FormDataFatura>(defaultFormData);
  const [items, setItems] = useState<ItemFatura[]>([{ ...defaultItem }]);
  const [totais, setTotais] = useState<TotaisFatura>({
    subtotal: 0,
    totalTaxas: 0,
    totalFinal: 0,
    taxasDetalhadas: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [empresaModificacoes, setEmpresaModificacoes] = useState<EmpresaModificacoes>({
    empresaOriginal: null,
    camposModificados: {},
    houveModificacoes: false
  });

  // Função para atualizar termos automaticamente - MELHORADA
  const atualizarTermosAutomaticamente = useCallback((currentFormData: FormDataFatura) => {
    const dias = currentFormData.tipo === 'cotacao' 
      ? parseInt(currentFormData.validezCotacao) || 15
      : parseInt(currentFormData.validezFatura) || 15;
    
    const tipoDocumento = currentFormData.tipo === 'cotacao' ? 'cotação' : 'fatura';
    const palavraValidade = currentFormData.tipo === 'cotacao' ? 'válida' : 'válida';
    
    return `Este ${tipoDocumento} é ${palavraValidade} por ${dias} ${dias === 1 ? 'dia' : 'dias'} a partir da data de emissão.`;
  }, []);

  // Effect para cálculos automáticos de datas e termos - CORRIGIDO
  useEffect(() => {
    let shouldUpdate = false;
    const updates: Partial<FormDataFatura> = {};

    // Para ambos os tipos: calcular dataVencimento baseado em dataFatura + validez
    if (formData.dataFatura) {
      const diasValidade = formData.tipo === 'cotacao' 
        ? formData.validezCotacao 
        : formData.validezFatura;
      
      const novaDataValidade = calcularDataValidade(formData.dataFatura, diasValidade);
      if (formData.dataVencimento !== novaDataValidade) {
        updates.dataVencimento = novaDataValidade;
        shouldUpdate = true;
      }
    }

    // PARA AMBOS: SEMPRE atualizar termos quando a validade mudar
    const novosTermos = atualizarTermosAutomaticamente(formData);
    if (formData.termos !== novosTermos) {
      updates.termos = novosTermos;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      setFormData(prev => ({
        ...prev,
        ...updates
      }));
    }
  }, [
    formData.dataFatura, 
    formData.dataVencimento, 
    formData.validezCotacao, 
    formData.validezFatura,
    formData.tipo, 
    formData.termos, 
    atualizarTermosAutomaticamente
  ]);

  // Função para verificar modificações
  const verificarModificacoesEmpresa = useCallback((empresaOriginal: Empresa, dadosAtuais: FormDataFatura['emitente']) => {
    const camposModificados: Record<string, { original: string; atual: string }> = {};
    let houveModificacoes = false;

    const mapeamentoCampos = {
      nomeEmpresa: 'nome',
      documento: 'nuit',
      pais: 'pais',
      cidade: 'cidade',
      bairro: 'endereco',
      telefone: 'telefone',
      email: 'email'
    };

    Object.entries(mapeamentoCampos).forEach(([campoForm, campoEmpresa]) => {
      const valorOriginal = empresaOriginal[campoEmpresa as keyof Empresa] || '';
      const valorAtual = dadosAtuais[campoForm as keyof FormDataFatura['emitente']] || '';

      if (valorOriginal !== valorAtual) {
        camposModificados[campoForm] = {
          original: String(valorOriginal),
          atual: String(valorAtual)
        };
        houveModificacoes = true;
      }
    });

    return { camposModificados, houveModificacoes };
  }, []);

  // Função para registrar empresa original
  const registrarEmpresaOriginal = useCallback((empresa: Empresa) => {
    setEmpresaModificacoes({
      empresaOriginal: empresa,
      camposModificados: {},
      houveModificacoes: false
    });
  }, []);

  // Função para limpar modificações
  const limparModificacoesEmpresa = useCallback(() => {
    setEmpresaModificacoes({
      empresaOriginal: null,
      camposModificados: {},
      houveModificacoes: false
    });
  }, []);

  // Calculate totals
  const calcularTotais = useCallback(() => {
    let subtotal = 0;
    let totalTaxas = 0;
    const taxasMap: Record<string, number> = {};

    items.forEach((item) => {
      const quantidade = Math.max(VALIDATION_RULES.MIN_QUANTITY, 
        Math.min(VALIDATION_RULES.MAX_QUANTITY, item.quantidade));
      const precoUnitario = Math.max(VALIDATION_RULES.MIN_PRICE, 
        Math.min(VALIDATION_RULES.MAX_PRICE, item.precoUnitario));

      const baseValue = quantidade * precoUnitario;
      let itemTaxas = 0;

      item.taxas.forEach((taxa) => {
        const valorTaxa = Math.max(VALIDATION_RULES.MIN_TAX_RATE, 
          Math.min(taxa.tipo === 'percent' ? VALIDATION_RULES.MAX_TAX_RATE : VALIDATION_RULES.MAX_PRICE, 
          taxa.valor));

        let taxaAmount = 0;
        if (taxa.tipo === 'percent') {
          taxaAmount = (baseValue * valorTaxa) / 100;
        } else {
          taxaAmount = valorTaxa;
        }
        
        itemTaxas += taxaAmount;
        
        const nomeTaxa = sanitizeString(taxa.nome) || 'Taxa';
        taxasMap[nomeTaxa] = (taxasMap[nomeTaxa] || 0) + taxaAmount;
      });

      const totalItem = baseValue + itemTaxas;
      subtotal += baseValue;
      totalTaxas += itemTaxas;

      if (item.totalItem !== totalItem || 
          item.quantidade !== quantidade || 
          item.precoUnitario !== precoUnitario) {
        setItems((prevItems) =>
          prevItems.map((prevItem) =>
            prevItem.id === item.id ? { 
              ...prevItem, 
              totalItem,
              quantidade,
              precoUnitario 
            } : prevItem
          )
        );
      }
    });

    const taxasDetalhadas = Object.entries(taxasMap).map(([nome, valor]) => ({
      nome,
      valor: Number(valor.toFixed(2)),
    }));

    setTotais({
      subtotal: Number(subtotal.toFixed(2)),
      totalTaxas: Number(totalTaxas.toFixed(2)),
      totalFinal: Number((subtotal + totalTaxas).toFixed(2)),
      taxasDetalhadas,
    });
  }, [items]);

  useEffect(() => {
    calcularTotais();
  }, [calcularTotais]);

  // Função para validar campo individual
  const validateField = (name: string, value: string): string => {
    if (!value.trim() && name.includes('.nomeEmpresa')) return 'Campo obrigatório';
    if (!value.trim() && name.includes('.nomeCompleto')) return 'Campo obrigatório';
    if (!value.trim() && name.includes('.pais')) return 'Campo obrigatório';
    if (!value.trim() && name.includes('.cidade')) return 'Campo obrigatório';
    if (!value.trim() && name.includes('.telefone')) return 'Campo obrigatório';
    
    // Validação específica por tipo
    if (name === 'faturaNumero' && formData.tipo === 'fatura' && !value.trim()) return 'Campo obrigatório';
    if (name === 'cotacaoNumero' && formData.tipo === 'cotacao' && !value.trim()) return 'Campo obrigatório';
    
    // Validação dos campos de validade
    if ((name === 'validezCotacao' || name === 'validezFatura') && !value.trim()) return 'Campo obrigatório';
    if ((name === 'validezCotacao' || name === 'validezFatura') && value) {
      const dias = parseInt(value);
      if (dias < 1 || dias > 365) return 'Validade deve ser entre 1 e 365 dias';
    }
    
    if (name.includes('email') && value && !validateEmail(value)) return 'Email inválido';
    if (name.includes('telefone') && value && !validatePhone(value)) return 'Telefone inválido';
    if (name.includes('documento') && value && !validateDocument(value)) return 'Documento inválido';
    
    if ((name === 'faturaNumero' || name === 'cotacaoNumero') && value && !/^[A-Z0-9\-_]{1,20}$/.test(value)) {
      return 'Apenas letras, números, hífens e underscores';
    }
    
    if (value.length > VALIDATION_RULES.MAX_STRING_LENGTH) {
      return `Máximo ${VALIDATION_RULES.MAX_STRING_LENGTH} caracteres`;
    }
    
    return '';
  };

  // Handle field blur
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const error = validateField(name, value);
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Handle change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    let sanitizedValue: any = value;

    // Tratamento específico para campos de validade
    if (name === 'validezCotacao' || name === 'validezFatura') {
      // Garantir que seja um número válido entre 1 e 365
      const numValue = parseInt(value) || 1;
      sanitizedValue = Math.max(1, Math.min(365, numValue)).toString();
      
      setFormData((prev) => ({
        ...prev,
        [name]: sanitizedValue,
      }));
      
      if (touched[name]) {
        const error = validateField(name, value);
        if (error) {
          setErrors(prev => ({ ...prev, [name]: error }));
        } else {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
          });
        }
      }
      
      return;
    }

    if (name.includes('telefone') || name.includes('email')) {
      if (name.startsWith('emitente.')) {
        const field = name.split('.')[1] as keyof FormDataFatura['emitente'];
        setFormData((prev) => ({
          ...prev,
          emitente: {
            ...prev.emitente,
            [field]: value,
          },
        }));
      } else if (name.startsWith('destinatario.')) {
        const field = name.split('.')[1] as keyof FormDataFatura['destinatario'];
        setFormData((prev) => ({
          ...prev,
          destinatario: {
            ...prev.destinatario,
            [field]: value,
          },
        }));
      }
      
      if (touched[name]) {
        const error = validateField(name, value);
        if (error) {
          setErrors(prev => ({ ...prev, [name]: error }));
        } else {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
          });
        }
      }
      
      return;
    }

    if (type === 'number') {
      sanitizedValue = value === '' ? '' : parseFloat(value) || 0;
    } else {
      sanitizedValue = value;
    }

    if (name.startsWith('emitente.')) {
      const field = name.split('.')[1] as keyof FormDataFatura['emitente'];
      setFormData((prev) => ({
        ...prev,
        emitente: {
          ...prev.emitente,
          [field]: sanitizedValue,
        },
      }));
    } else if (name.startsWith('destinatario.')) {
      const field = name.split('.')[1] as keyof FormDataFatura['destinatario'];
      setFormData((prev) => ({
        ...prev,
        destinatario: {
          ...prev.destinatario,
          [field]: sanitizedValue,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: sanitizedValue,
      }));
    }

    if (touched[name]) {
      const error = validateField(name, value);
      if (error) {
        setErrors(prev => ({ ...prev, [name]: error }));
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    }
  };

  const adicionarItem = () => {
    const novoId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    setItems([
      ...items,
      {
        id: novoId,
        quantidade: 1,
        descricao: '',
        precoUnitario: 0,
        taxas: [{ nome: 'IVA', valor: 16, tipo: 'percent' }],
        totalItem: 0,
      },
    ]);
  };

  const removerItem = (id: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const atualizarItem = (id: number, campo: keyof ItemFatura, valor: any) => {
    let sanitizedValue = valor;
    
    if (campo === 'quantidade') {
      sanitizedValue = sanitizeNumber(valor, VALIDATION_RULES.MIN_QUANTITY, VALIDATION_RULES.MAX_QUANTITY);
    } else if (campo === 'precoUnitario') {
      sanitizedValue = sanitizeNumber(valor, VALIDATION_RULES.MIN_PRICE, VALIDATION_RULES.MAX_PRICE);
    } else if (campo === 'descricao') {
      sanitizedValue = sanitizeString(valor).slice(0, VALIDATION_RULES.MAX_DESCRIPTION_LENGTH);
    } else if (campo === 'taxas') {
      sanitizedValue = valor.map((taxa: TaxaItem) => ({
        ...taxa,
        nome: sanitizeString(taxa.nome),
        valor: sanitizeNumber(taxa.valor, 
          VALIDATION_RULES.MIN_TAX_RATE, 
          taxa.tipo === 'percent' ? VALIDATION_RULES.MAX_TAX_RATE : VALIDATION_RULES.MAX_PRICE)
      }));
    }

    setItems(
      items.map((item) => (item.id === id ? { ...item, [campo]: sanitizedValue } : item))
    );
  };

  const adicionarTaxa = (itemId: number) => {
    setItems(
      items.map((item) =>
        item.id === itemId
          ? { 
              ...item, 
              taxas: [...item.taxas, { nome: '', valor: 0, tipo: 'percent' }] 
            }
          : item
      )
    );
  };

  const removerTaxa = (itemId: number, taxaIndex: number) => {
    setItems(
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              taxas: item.taxas.filter((_, index) => index !== taxaIndex),
            }
          : item
      )
    );
  };

  // Função para atualizar o formData
  const updateFormData = useCallback((newData: Partial<FormDataFatura>) => {
    setFormData(prev => ({
      ...prev,
      ...newData,
      emitente: {
        ...prev.emitente,
        ...newData.emitente,
      },
    }));

    if (empresaModificacoes.empresaOriginal && newData.emitente) {
      const { camposModificados, houveModificacoes } = verificarModificacoesEmpresa(
        empresaModificacoes.empresaOriginal,
        { ...formData.emitente, ...newData.emitente }
      );

      setEmpresaModificacoes(prev => ({
        ...prev,
        camposModificados,
        houveModificacoes
      }));
    }
  }, [empresaModificacoes.empresaOriginal, formData.emitente, verificarModificacoesEmpresa]);

  // Enhanced form validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const allFields = [
      'emitente.nomeEmpresa', 'emitente.pais', 'emitente.cidade', 'emitente.telefone',
      'destinatario.nomeCompleto', 'destinatario.telefone'
    ];

    // Adiciona campos baseado no tipo
    if (formData.tipo === 'fatura') {
      allFields.push('faturaNumero', 'validezFatura');
    } else {
      allFields.push('cotacaoNumero', 'validezCotacao');
    }

    allFields.push('dataFatura');

    const newTouched: Record<string, boolean> = {};
    allFields.forEach(field => {
      newTouched[field] = true;
    });
    setTouched(newTouched);

    // Emitente validation
    if (!formData.emitente.nomeEmpresa.trim()) {
      newErrors['emitente.nomeEmpresa'] = 'Campo obrigatório';
    }

    if (!formData.emitente.pais.trim()) {
      newErrors['emitente.pais'] = 'Campo obrigatório';
    }

    if (!formData.emitente.cidade.trim()) {
      newErrors['emitente.cidade'] = 'Campo obrigatório';
    }

    if (!formData.emitente.telefone.trim()) {
      newErrors['emitente.telefone'] = 'Campo obrigatório';
    } else if (!validatePhone(formData.emitente.telefone)) {
      newErrors['emitente.telefone'] = 'Telefone inválido';
    }

    if (formData.emitente.email && !validateEmail(formData.emitente.email)) {
      newErrors['emitente.email'] = 'Email inválido';
    }

    // Destinatario validation
    if (!formData.destinatario.nomeCompleto.trim()) {
      newErrors['destinatario.nomeCompleto'] = 'Campo obrigatório';
    }

    if (!formData.destinatario.telefone.trim()) {
      newErrors['destinatario.telefone'] = 'Campo obrigatório';
    } else if (!validatePhone(formData.destinatario.telefone)) {
      newErrors['destinatario.telefone'] = 'Telefone inválido';
    }

    if (formData.destinatario.email && !validateEmail(formData.destinatario.email)) {
      newErrors['destinatario.email'] = 'Email inválido';
    }

    // Number validation based on type
    if (formData.tipo === 'fatura') {
      if (!formData.faturaNumero.trim()) {
        newErrors.faturaNumero = 'Campo obrigatório';
      } else if (!/^[A-Z0-9\-_]{1,20}$/.test(formData.faturaNumero)) {
        newErrors.faturaNumero = 'Apenas letras, números, hífens e underscores são permitidos';
      }
      
      // Validação da validade da fatura
      if (!formData.validezFatura.trim()) {
        newErrors.validezFatura = 'Campo obrigatório';
      } else {
        const dias = parseInt(formData.validezFatura);
        if (dias < 1 || dias > 365) {
          newErrors.validezFatura = 'Validade deve ser entre 1 e 365 dias';
        }
      }
    } else {
      if (!formData.cotacaoNumero.trim()) {
        newErrors.cotacaoNumero = 'Campo obrigatório';
      } else if (!/^[A-Z0-9\-_]{1,20}$/.test(formData.cotacaoNumero)) {
        newErrors.cotacaoNumero = 'Apenas letras, números, hífens e underscores são permitidos';
      }
      
      // Validação da validade da cotação
      if (!formData.validezCotacao.trim()) {
        newErrors.validezCotacao = 'Campo obrigatório';
      } else {
        const dias = parseInt(formData.validezCotacao);
        if (dias < 1 || dias > 365) {
          newErrors.validezCotacao = 'Validade deve ser entre 1 e 365 dias';
        }
      }
    }

    // Items validation
    items.forEach((item, index) => {
      if (!item.descricao.trim()) {
        newErrors[`item-${index}-descricao`] = 'Descrição obrigatória';
      }
      
      if (item.quantidade < VALIDATION_RULES.MIN_QUANTITY) {
        newErrors[`item-${index}-quantidade`] = `Quantidade mínima: ${VALIDATION_RULES.MIN_QUANTITY}`;
      }
      
      if (item.precoUnitario < VALIDATION_RULES.MIN_PRICE) {
        newErrors[`item-${index}-preco`] = 'Preço unitário inválido';
      }
    });

    // Date validation
    if (!formData.dataFatura) {
      newErrors.dataFatura = 'Data da fatura é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const limparFormulario = () => {
    setFormData(defaultFormData);
    setItems([{ ...defaultItem }]);
    setTotais({
      subtotal: 0,
      totalTaxas: 0,
      totalFinal: 0,
      taxasDetalhadas: [],
    });
    setErrors({});
    setTouched({});
    setEmpresaModificacoes({
      empresaOriginal: null,
      camposModificados: {},
      houveModificacoes: false
    });
  };

  // Prepare invoice data
  const prepareInvoiceData = (): InvoiceData => {
    const safeFormData = JSON.parse(JSON.stringify(formData));
    const safeItems = JSON.parse(JSON.stringify(items));
    
    return {
      tipo: formData.tipo,
      formData: {
        ...safeFormData,
        faturaNumero: formData.tipo === 'fatura' ? sanitizeString(safeFormData.faturaNumero) : '',
        cotacaoNumero: formData.tipo === 'cotacao' ? sanitizeString(safeFormData.cotacaoNumero) : '',
        termos: sanitizeString(safeFormData.termos).slice(0, VALIDATION_RULES.MAX_TERMS_LENGTH),
        moeda: safeFormData.moeda === 'MT' ? 'MZN' : safeFormData.moeda,
        metodoPagamento: sanitizeString(safeFormData.metodoPagamento).slice(0, VALIDATION_RULES.MAX_TERMS_LENGTH),
        validezFatura: safeFormData.validezFatura,
        validezCotacao: safeFormData.validezCotacao
      },
      items: safeItems.map((item: ItemFatura) => ({
        id: item.id,
        quantidade: item.quantidade,
        descricao: sanitizeString(item.descricao).slice(0, VALIDATION_RULES.MAX_DESCRIPTION_LENGTH),
        precoUnitario: item.precoUnitario,
        taxas: item.taxas.map(taxa => ({
          nome: sanitizeString(taxa.nome),
          valor: taxa.valor,
          tipo: taxa.tipo
        })),
        totalItem: item.quantidade * item.precoUnitario + 
                  item.taxas.reduce((sum, tax) => {
                    return tax.tipo === 'percent' 
                      ? sum + (item.quantidade * item.precoUnitario * tax.valor) / 100
                      : sum + tax.valor;
                  }, 0)
      })),
      totais: {
        subtotal: totais.subtotal,
        totalTaxas: totais.totalTaxas,
        totalFinal: totais.totalFinal,
        taxasDetalhadas: totais.taxasDetalhadas
      },
      logo: null,
      assinatura: null
    };
  };

  return {
    formData,
    items,
    totais,
    errors,
    touched,
    handleChange,
    handleBlur,
    adicionarItem,
    removerItem,
    atualizarItem,
    adicionarTaxa,
    removerTaxa,
    validateForm,
    limparFormulario,
    calcularTotais,
    prepareInvoiceData,
    updateFormData,
    empresaModificacoes,
    verificarModificacoesEmpresa,
    registrarEmpresaOriginal,
    limparModificacoesEmpresa
  };
};

export default useInvoiceForm;