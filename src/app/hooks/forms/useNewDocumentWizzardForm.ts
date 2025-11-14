// app/hooks/forms/useNewDocumentWizzardForm.ts
import { useState, useEffect, useCallback } from 'react';
import { FormDataFatura, ItemFatura, TotaisFatura, TaxaItem, InvoiceData, TipoDocumento } from '@/types/invoice-types';

interface Empresa {
  id: string;
  padrao: boolean;
  nome: string;
  nuip: string;
  pais: string;
  cidade: string;
  endereco: string;
  pessoa_contato?: string;
  email: string;
  telefone: string;
}

interface EmpresaModificacoes {
  empresaOriginal: Empresa | null;
  camposModificados: Record<string, { original: string; atual: string }>;
  houveModificacoes: boolean;
}

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
  MIN_DISCOUNT: 0,
  MAX_DISCOUNT_PERCENT: 100,
  MAX_DISCOUNT_AMOUNT: 99999999.99,
} as const;

const generateNextDocumentNumber = async (tipo: TipoDocumento): Promise<string> => {
  try {
    const response = await fetch(`/api/document/next-number?tipo=${tipo}`);
    if (!response.ok) throw new Error('Erro ao gerar número');
    const data = await response.json();
    if (data.success) return data.data.numero;
    throw new Error(data.error);
  } catch (_error) {
    const prefixo = tipo === 'fatura' ? 'FTR' : 'COT';
    const fallback = Math.floor(Math.random() * 9000) + 1000;
    return `${prefixo}_${String(fallback).padStart(4, '0')}`;
  }
};

const sanitizeString = (input: string): string => {
  return typeof input === 'string' ? input.replace(/[<>]/g, '') : '';
};

const sanitizeNumber = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, Number(value) || min));
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

const calcularDataValidade = (dataFatura: string, diasValidade: string | number): string => {
  const data = new Date(dataFatura);
  const dias = typeof diasValidade === 'string' ? parseInt(diasValidade) || 15 : diasValidade;
  data.setDate(data.getDate() + dias);
  return data.toISOString().split('T')[0];
};

const useInvoiceForm = (tipoInicial: TipoDocumento = 'fatura') => {
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
    validezFatura: '15',
    desconto: 0,
    tipoDesconto: 'fixed'
  };

  const defaultItem: ItemFatura = {
    id: 1,
    quantidade: 1,
    descricao: '',
    precoUnitario: 0,
    taxas: [],
    totalItem: 0,
  };

  const [formData, setFormData] = useState<FormDataFatura>(defaultFormData);
  const [items, setItems] = useState<ItemFatura[]>([{ ...defaultItem }]);
  const [totais, setTotais] = useState<TotaisFatura>({
    subtotal: 0,
    totalTaxas: 0,
    totalFinal: 0,
    taxasDetalhadas: [],
    desconto: 0
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [empresaModificacoes, setEmpresaModificacoes] = useState<EmpresaModificacoes>({
    empresaOriginal: null,
    camposModificados: {},
    houveModificacoes: false
  });
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

  const atualizarTermosAutomaticamente = useCallback((currentFormData: FormDataFatura) => {
    const dias = currentFormData.tipo === 'cotacao'
      ? parseInt(currentFormData.validezCotacao || '15') || 15
      : parseInt(currentFormData.validezFatura || '15') || 15;
    const tipoDocumento = currentFormData.tipo === 'cotacao' ? 'cotação' : 'fatura';
    return `Este ${tipoDocumento} é válido por ${dias} ${dias === 1 ? 'dia' : 'dias'} a partir da data de emissão.`;
  }, []);

  const generateDocumentNumber = useCallback(async () => {
    setIsGeneratingNumber(true);
    try {
      const numero = await generateNextDocumentNumber(formData.tipo);
      if (formData.tipo === 'fatura') {
        setFormData(prev => ({ ...prev, faturaNumero: numero }));
      } else {
        setFormData(prev => ({ ...prev, cotacaoNumero: numero }));
      }
    } catch (error) {
      console.error('Erro ao gerar número:', error);
    } finally {
      setIsGeneratingNumber(false);
    }
  }, [formData.tipo]);

  useEffect(() => {
    generateDocumentNumber();
  }, [formData.tipo, generateDocumentNumber]);

  useEffect(() => {
    let shouldUpdate = false;
    const updates: Partial<FormDataFatura> = {};

    if (formData.dataFatura) {
      const diasValidade = formData.tipo === 'cotacao' 
        ? formData.validezCotacao || 15
        : formData.validezFatura || 15;
      const novaDataValidade = calcularDataValidade(formData.dataFatura, diasValidade);
      if (formData.dataVencimento !== novaDataValidade) {
        updates.dataVencimento = novaDataValidade;
        shouldUpdate = true;
      }
    }

    const novosTermos = atualizarTermosAutomaticamente(formData);
    if (formData.termos !== novosTermos) {
      updates.termos = novosTermos;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
  }, [formData.dataFatura, formData.dataVencimento, formData.validezCotacao, formData.validezFatura, formData.tipo, formData.termos, atualizarTermosAutomaticamente]);

  const verificarModificacoesEmpresa = useCallback((empresaOriginal: Empresa, dadosAtuais: FormDataFatura['emitente']) => {
    const camposModificados: Record<string, { original: string; atual: string }> = {};
    let houveModificacoes = false;

    const mapeamentoCampos = {
      nomeEmpresa: 'nome',
      documento: 'nuip',
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
        camposModificados[campoForm] = { original: String(valorOriginal), atual: String(valorAtual) };
        houveModificacoes = true;
      }
    });

    return { camposModificados, houveModificacoes };
  }, []);

  const registrarEmpresaOriginal = useCallback((empresa: Empresa) => {
    setEmpresaModificacoes({ empresaOriginal: empresa, camposModificados: {}, houveModificacoes: false });
  }, []);

  const limparModificacoesEmpresa = useCallback(() => {
    setEmpresaModificacoes({ empresaOriginal: null, camposModificados: {}, houveModificacoes: false });
  }, []);

  const calcularDesconto = useCallback((subtotal: number): number => {
    if (formData.tipoDesconto === 'percent') {
      const percentual = Math.max(VALIDATION_RULES.MIN_DISCOUNT, 
        Math.min(VALIDATION_RULES.MAX_DISCOUNT_PERCENT, formData.desconto || 0));
      return (subtotal * percentual) / 100;
    } else {
      return Math.max(VALIDATION_RULES.MIN_DISCOUNT, 
        Math.min(VALIDATION_RULES.MAX_DISCOUNT_AMOUNT, formData.desconto || 0));
    }
  }, [formData.tipoDesconto, formData.desconto]);

  const calcularTotais = useCallback(() => {
    let subtotal = 0;
    let totalTaxas = 0;
    const taxasMap: Record<string, number> = {};

    items.forEach((item) => {
      const quantidade = Math.max(VALIDATION_RULES.MIN_QUANTITY, Math.min(VALIDATION_RULES.MAX_QUANTITY, item.quantidade));
      const precoUnitario = Math.max(VALIDATION_RULES.MIN_PRICE, Math.min(VALIDATION_RULES.MAX_PRICE, item.precoUnitario));
      const baseValue = quantidade * precoUnitario;
      let itemTaxas = 0;

      item.taxas.forEach((taxa) => {
        const valorTaxa = Math.max(VALIDATION_RULES.MIN_TAX_RATE, Math.min(taxa.tipo === 'percent' ? VALIDATION_RULES.MAX_TAX_RATE : VALIDATION_RULES.MAX_PRICE, taxa.valor));
        const taxaAmount = taxa.tipo === 'percent' ? (baseValue * valorTaxa) / 100 : valorTaxa;
        itemTaxas += taxaAmount;
        const nomeTaxa = sanitizeString(taxa.nome) || 'Taxa';
        taxasMap[nomeTaxa] = (taxasMap[nomeTaxa] || 0) + taxaAmount;
      });

      const totalItem = baseValue + itemTaxas;
      subtotal += baseValue;
      totalTaxas += itemTaxas;

      if (item.totalItem !== totalItem || item.quantidade !== quantidade || item.precoUnitario !== precoUnitario) {
        setItems((prevItems) =>
          prevItems.map((prevItem) =>
            prevItem.id === item.id ? { ...prevItem, totalItem, quantidade, precoUnitario } : prevItem
          )
        );
      }
    });

    const desconto = calcularDesconto(subtotal);
    const totalFinal = Math.max(0, subtotal + totalTaxas - desconto);

    const taxasDetalhadas = Object.entries(taxasMap).map(([nome, valor]) => ({ nome, valor: Number(valor.toFixed(2)) }));
    
    setTotais({ 
      subtotal: Number(subtotal.toFixed(2)), 
      totalTaxas: Number(totalTaxas.toFixed(2)), 
      totalFinal: Number(totalFinal.toFixed(2)), 
      taxasDetalhadas,
      desconto: Number(desconto.toFixed(2))
    });
  }, [items, calcularDesconto]);

  useEffect(() => { 
    calcularTotais(); 
  }, [calcularTotais]);

  const validateField = async (name: string, value: any): Promise<string> => {
    const stringValue = typeof value === 'number' ? value.toString() : String(value || '');
    
    if (!stringValue.trim() && (name.includes('.nomeEmpresa') || name.includes('.nomeCompleto') || name.includes('.pais') || name.includes('.cidade') || name.includes('.telefone'))) {
      return 'Campo obrigatório';
    }
    
    if ((name === 'validezCotacao' || name === 'validezFatura') && !stringValue.trim()) return 'Campo obrigatório';
    if ((name === 'validezCotacao' || name === 'validezFatura') && stringValue) {
      const dias = parseInt(stringValue);
      if (dias < 1 || dias > 365) return 'Validade deve ser entre 1 e 365 dias';
    }
    
    if (name === 'desconto') {
      const numValue = parseFloat(stringValue);
      if (isNaN(numValue) || numValue < VALIDATION_RULES.MIN_DISCOUNT) {
        return 'Desconto não pode ser negativo';
      }
      
      if (formData.tipoDesconto === 'percent' && numValue > VALIDATION_RULES.MAX_DISCOUNT_PERCENT) {
        return 'Desconto percentual não pode ser maior que 100%';
      }
      
      if (formData.tipoDesconto === 'fixed' && numValue > VALIDATION_RULES.MAX_DISCOUNT_AMOUNT) {
        return `Desconto não pode ser maior que ${VALIDATION_RULES.MAX_DISCOUNT_AMOUNT}`;
      }
      
      return '';
    }
    
    if (name.includes('email') && stringValue && !validateEmail(stringValue)) return 'Email inválido';
    if (name.includes('telefone') && stringValue && !validatePhone(stringValue)) return 'Telefone inválido';
    
    if (stringValue.length > VALIDATION_RULES.MAX_STRING_LENGTH) {
      return `Máximo ${VALIDATION_RULES.MAX_STRING_LENGTH} caracteres`;
    }

    // Item-level quick validations (item-<id>-descricao, item-<id>-quantidade, item-<id>-preco)
    const itemDescMatch = name.match(/^item-(\d+)-descricao$/);
    if (itemDescMatch) {
      if (!stringValue.trim()) return 'Descrição obrigatória';
      if (stringValue.length > VALIDATION_RULES.MAX_DESCRIPTION_LENGTH) return `Máximo ${VALIDATION_RULES.MAX_DESCRIPTION_LENGTH} caracteres`;
      return '';
    }

    const itemQtdMatch = name.match(/^item-(\d+)-quantidade$/);
    if (itemQtdMatch) {
      const num = parseInt(stringValue) || 0;
      if (num < VALIDATION_RULES.MIN_QUANTITY) return `Quantidade mínima: ${VALIDATION_RULES.MIN_QUANTITY}`;
      if (num > VALIDATION_RULES.MAX_QUANTITY) return `Quantidade máxima: ${VALIDATION_RULES.MAX_QUANTITY}`;
      return '';
    }

    const itemPrecoMatch = name.match(/^item-(\d+)-preco$/);
    if (itemPrecoMatch) {
      const num = parseFloat(stringValue) || 0;
      if (num < VALIDATION_RULES.MIN_PRICE) return 'Preço unitário inválido';
      if (num > VALIDATION_RULES.MAX_PRICE) return `Preço máximo: ${VALIDATION_RULES.MAX_PRICE}`;
      return '';
    }
    
    return '';
  };

  const handleBlur = async (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    let processedValue: any = value;
    if (name === 'desconto') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
      setFormData(prev => ({ ...prev, [name]: processedValue }));
    }
    
    const error = await validateField(name, processedValue);
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
    } else {
      setErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let sanitizedValue: any = value;

    if (name === 'desconto') {
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        sanitizedValue = value;
      } else {
        return;
      }
    } else if (name === 'validezCotacao' || name === 'validezFatura') {
      const numValue = parseInt(value) || 1;
      sanitizedValue = Math.max(1, Math.min(365, numValue)).toString();
      setFormData((prev) => ({ ...prev, [name]: sanitizedValue }));
      if (touched[name]) {
        validateField(name, value).then(error => {
          if (error) setErrors(prev => ({ ...prev, [name]: error }));
          else setErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
        });
      }
      return;
    } else if (name.includes('telefone') || name.includes('email')) {
      if (name.startsWith('emitente.')) {
        const field = name.split('.')[1] as keyof FormDataFatura['emitente'];
        setFormData((prev) => ({ ...prev, emitente: { ...prev.emitente, [field]: value } }));
      } else if (name.startsWith('destinatario.')) {
        const field = name.split('.')[1] as keyof FormDataFatura['destinatario'];
        setFormData((prev) => ({ ...prev, destinatario: { ...prev.destinatario, [field]: value } }));
      }
      if (touched[name]) {
        validateField(name, value).then(error => {
          if (error) setErrors(prev => ({ ...prev, [name]: error }));
          else setErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
        });
      }
      return;
    } else if (type === 'number') {
      sanitizedValue = value === '' ? '' : parseFloat(value) || 0;
    } else {
      sanitizedValue = value;
    }

    if (name.startsWith('emitente.')) {
      const field = name.split('.')[1] as keyof FormDataFatura['emitente'];
      setFormData((prev) => ({ ...prev, emitente: { ...prev.emitente, [field]: sanitizedValue } }));
    } else if (name.startsWith('destinatario.')) {
      const field = name.split('.')[1] as keyof FormDataFatura['destinatario'];
      setFormData((prev) => ({ ...prev, destinatario: { ...prev.destinatario, [field]: sanitizedValue } }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: sanitizedValue }));
    }

    if (touched[name]) {
      validateField(name, value).then(error => {
        if (error) setErrors(prev => ({ ...prev, [name]: error }));
        else setErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
      });
    }
  };

  const adicionarItem = () => {
    const novoId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    setItems([...items, { id: novoId, quantidade: 1, descricao: '', precoUnitario: 0, taxas: [], totalItem: 0 }]);
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
        valor: sanitizeNumber(taxa.valor, VALIDATION_RULES.MIN_TAX_RATE, taxa.tipo === 'percent' ? VALIDATION_RULES.MAX_TAX_RATE : VALIDATION_RULES.MAX_PRICE)
      }));
    }
    setItems(items.map((item) => (item.id === id ? { ...item, [campo]: sanitizedValue } : item)));

    // If the user already touched this item field, run quick validation to update inline errors
    (async () => {
      try {
        if (campo === 'descricao') {
          const fieldName = `item-${id}-descricao`;
          if (touched[fieldName]) {
            const err = await validateField(fieldName, sanitizedValue);
            if (err) setErrors(prev => ({ ...prev, [fieldName]: err }));
            else setErrors(prev => { const newErrors = { ...prev }; delete newErrors[fieldName]; return newErrors; });
          }
        }

        if (campo === 'quantidade') {
          const fieldName = `item-${id}-quantidade`;
          if (touched[fieldName]) {
            const err = await validateField(fieldName, sanitizedValue);
            if (err) setErrors(prev => ({ ...prev, [fieldName]: err }));
            else setErrors(prev => { const newErrors = { ...prev }; delete newErrors[fieldName]; return newErrors; });
          }
        }

        if (campo === 'precoUnitario') {
          const fieldName = `item-${id}-preco`;
          if (touched[fieldName]) {
            const err = await validateField(fieldName, sanitizedValue);
            if (err) setErrors(prev => ({ ...prev, [fieldName]: err }));
            else setErrors(prev => { const newErrors = { ...prev }; delete newErrors[fieldName]; return newErrors; });
          }
        }
      } catch (e) {
        // ignore validation errors
      }
    })();
  };

  const adicionarTaxa = (itemId: number) => {
    setItems(items.map((item) => item.id === itemId ? { ...item, taxas: [...item.taxas, { nome: '', valor: 0, tipo: 'percent' }] } : item));
  };

  const removerTaxa = (itemId: number, taxaIndex: number) => {
    setItems(items.map((item) => item.id === itemId ? { ...item, taxas: item.taxas.filter((_, index) => index !== taxaIndex) } : item));
  };

  const updateFormData = useCallback((newData: Partial<FormDataFatura>) => {
    setFormData(prev => ({ ...prev, ...newData, emitente: { ...prev.emitente, ...newData.emitente } }));
    if (empresaModificacoes.empresaOriginal && newData.emitente) {
      const { camposModificados, houveModificacoes } = verificarModificacoesEmpresa(empresaModificacoes.empresaOriginal, { ...formData.emitente, ...newData.emitente });
      setEmpresaModificacoes(prev => ({ ...prev, camposModificados, houveModificacoes }));
    }
  }, [empresaModificacoes.empresaOriginal, formData.emitente, verificarModificacoesEmpresa]);

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    const allFields = ['emitente.nomeEmpresa', 'emitente.pais', 'emitente.cidade', 'emitente.telefone', 'destinatario.nomeCompleto', 'destinatario.telefone'];
    if (formData.tipo === 'fatura') {
      allFields.push('validezFatura');
    } else {
      allFields.push('validezCotacao');
    }
    allFields.push('dataFatura');

    const newTouched: Record<string, boolean> = {};
    allFields.forEach(field => { newTouched[field] = true; });
    setTouched(newTouched);

    if (!formData.emitente.nomeEmpresa.trim()) newErrors['emitente.nomeEmpresa'] = 'Campo obrigatório';
    if (!formData.emitente.pais.trim()) newErrors['emitente.pais'] = 'Campo obrigatório';
    if (!formData.emitente.cidade.trim()) newErrors['emitente.cidade'] = 'Campo obrigatório';
    if (!formData.emitente.telefone.trim()) newErrors['emitente.telefone'] = 'Campo obrigatório';
    else if (!validatePhone(formData.emitente.telefone)) newErrors['emitente.telefone'] = 'Telefone inválido';
    if (formData.emitente.email && !validateEmail(formData.emitente.email)) newErrors['emitente.email'] = 'Email inválido';

    if (!formData.destinatario.nomeCompleto.trim()) newErrors['destinatario.nomeCompleto'] = 'Campo obrigatório';
    if (!formData.destinatario.telefone.trim()) newErrors['destinatario.telefone'] = 'Campo obrigatório';
    else if (!validatePhone(formData.destinatario.telefone)) newErrors['destinatario.telefone'] = 'Telefone inválido';
    if (formData.destinatario.email && !validateEmail(formData.destinatario.email)) newErrors['destinatario.email'] = 'Email inválido';

    if (formData.tipo === 'fatura') {
      if (!formData.validezFatura?.trim()) newErrors.validezFatura = 'Campo obrigatório';
      else {
        const dias = parseInt(formData.validezFatura);
        if (dias < 1 || dias > 365) newErrors.validezFatura = 'Validade deve ser entre 1 e 365 dias';
      }
    } else {
      if (!formData.validezCotacao?.trim()) newErrors.validezCotacao = 'Campo obrigatório';
      else {
        const dias = parseInt(formData.validezCotacao);
        if (dias < 1 || dias > 365) newErrors.validezCotacao = 'Validade deve ser entre 1 e 365 dias';
      }
    }

    if (formData.desconto < VALIDATION_RULES.MIN_DISCOUNT) {
      newErrors['desconto'] = 'Desconto não pode ser negativo';
    }
    if (formData.tipoDesconto === 'percent' && formData.desconto > VALIDATION_RULES.MAX_DISCOUNT_PERCENT) {
      newErrors['desconto'] = 'Desconto percentual não pode ser maior que 100%';
    }

    items.forEach((item, index) => {
      if (!item.descricao.trim()) {
        newErrors[`item-${item.id}-descricao`] = 'Descrição obrigatória';
        newTouched[`item-${item.id}-descricao`] = true;
      }
      if (item.quantidade < VALIDATION_RULES.MIN_QUANTITY) {
        newErrors[`item-${item.id}-quantidade`] = `Quantidade mínima: ${VALIDATION_RULES.MIN_QUANTITY}`;
        newTouched[`item-${item.id}-quantidade`] = true;
      }
      if (item.precoUnitario < VALIDATION_RULES.MIN_PRICE) {
        newErrors[`item-${item.id}-preco`] = 'Preço unitário inválido';
        newTouched[`item-${item.id}-preco`] = true;
      }
    });

    if (!formData.dataFatura) newErrors.dataFatura = 'Data da fatura é obrigatória';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const limparFormulario = () => {
    setFormData(defaultFormData);
    setItems([{ ...defaultItem }]);
    setTotais({ subtotal: 0, totalTaxas: 0, totalFinal: 0, taxasDetalhadas: [], desconto: 0 });
    setErrors({});
    setTouched({});
    setEmpresaModificacoes({ empresaOriginal: null, camposModificados: {}, houveModificacoes: false });
  };

  const prepareInvoiceData = (): InvoiceData => {
    const safeFormData = JSON.parse(JSON.stringify(formData));
    const safeItems = JSON.parse(JSON.stringify(items));
    
    const subtotal = totais.subtotal;
    const desconto = calcularDesconto(subtotal);
    const totalFinal = Math.max(0, subtotal + totais.totalTaxas - desconto);

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
        validezCotacao: safeFormData.validezCotacao,
        desconto: safeFormData.desconto,
        tipoDesconto: safeFormData.tipoDesconto
      },
      items: safeItems.map((item: ItemFatura) => ({
        id: item.id,
        quantidade: item.quantidade,
        descricao: sanitizeString(item.descricao).slice(0, VALIDATION_RULES.MAX_DESCRIPTION_LENGTH),
        precoUnitario: item.precoUnitario,
        taxas: item.taxas.map(taxa => ({ nome: sanitizeString(taxa.nome), valor: taxa.valor, tipo: taxa.tipo })),
        totalItem: item.quantidade * item.precoUnitario + item.taxas.reduce((sum, tax) => tax.tipo === 'percent' ? sum + (item.quantidade * item.precoUnitario * tax.valor) / 100 : sum + tax.valor, 0)
      })),
      totais: { 
        subtotal: totais.subtotal, 
        totalTaxas: totais.totalTaxas, 
        totalFinal: totalFinal, 
        taxasDetalhadas: totais.taxasDetalhadas,
        desconto: desconto
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
    isGeneratingNumber,
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
    limparModificacoesEmpresa,
    generateDocumentNumber
  };
};

export default useInvoiceForm;
