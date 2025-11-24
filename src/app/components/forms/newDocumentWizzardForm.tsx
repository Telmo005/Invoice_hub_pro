import React, { useState, useCallback, memo, useEffect } from 'react';
import { Roboto } from 'next/font/google';
import { FaPlus, FaExclamationTriangle, FaArrowRight, FaArrowLeft, FaCheck, FaSpinner, FaTimes, FaSync, FaMagnet } from 'react-icons/fa';
import useInvoiceForm from '@/app/hooks/forms/useNewDocumentWizzardForm';
import TemplateSlider from '@/app/components/panels/slider';
import Payment from '@/app/components/forms/PaymentForm';
import { formatCurrency } from '@/lib/formatUtils';
import { Empresa } from '@/types/emissor-type';
import { useListarEmissores } from '@/app/hooks/emitters/useListarEmissores';
import { useEmpresaPadrao } from '@/app/hooks/emitters/useEmpresaPadrao';
import { TipoDocumento, ItemFatura } from '@/types/invoice-types';

const roboto = Roboto({ weight: ['300', '400', '700'], subsets: ['latin'], variable: '--font-roboto' });

const STEPS = [
  { title: 'Dados do Emitente', icon: '🏢' },
  { title: 'Dados do Destinatário', icon: '👤' },
  { title: 'Itens do Documento', icon: '📋' },
  { title: 'Pré-visualização', icon: '👁️' },
  { title: 'Finalizar', icon: '🏆' },
];

type TaxLine = { id?: number; nome: string; tipo: 'percent' | 'fixed'; valor: number };
type DocumentItem = { id: number; descricao: string; quantidade: number; precoUnitario: number; taxas: TaxLine[] };
interface EmitenteStepProps {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  empresas: Empresa[];
  selectedEmpresa: Empresa | null;
  onEmpresaChange: (empresa: Empresa) => void;
  empresasLoading: boolean;
}

interface DestinatarioStepProps {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

interface ItensStepProps {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  items: DocumentItem[];
  adicionarItem: () => void;
  removerItem: (id: number) => void;
  atualizarItem: (id: number, field: keyof ItemFatura | 'taxas', value: string | number | TaxLine[]) => void;
  adicionarTaxa: (id: number) => void;
  removerTaxa: (id: number, taxaIndex: number) => void;
  onItemBlur: (field: string) => void;
  isGeneratingNumber: boolean;
  generateDocumentNumber: () => Promise<void>;
}

interface PreviewStepProps {
  invoiceData: Record<string, unknown>;
  tipo: TipoDocumento;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onHtmlRendered: (html: string) => void;
}

interface ProcessingOverlayProps {
  isVisible: boolean;
  message?: string;
}

interface NavigationButtonsProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  isNavigating: boolean;
}

interface StepsListProps {
  currentStep: number;
  onStepClick: (stepIndex: number) => void;
  validateAllPreviousSteps: (targetStep: number) => Promise<boolean>;
  isNavigating: boolean;
}

interface NewDocumentFormProps { tipo: TipoDocumento; }

interface ItemRowProps {
  item: DocumentItem;
  currency: string;
  onUpdate: (field: keyof DocumentItem | 'taxas' | 'descricao' | 'quantidade' | 'precoUnitario', value: string | number | TaxLine[]) => void;
  onRemove: () => void;
  onAddTax: () => void;
  onRemoveTax: (index: number) => void;
  errors: Record<string, string>;
  onBlur: (field: string) => void;
}

const ItemRow = memo(({
  item,
  currency,
  onUpdate,
  onRemove,
  onAddTax,
  onRemoveTax,
  errors,
  onBlur
}: ItemRowProps) => {
  const subtotal = React.useMemo(() => item.quantidade * item.precoUnitario, [item.quantidade, item.precoUnitario]);
  const taxTotal = React.useMemo(() => item.taxas.reduce((sum: number, tax: TaxLine) => (
    tax.tipo === 'percent' ? sum + (subtotal * tax.valor) / 100 : sum + tax.valor
  ), 0), [item.taxas, subtotal]);
  const totalItem = React.useMemo(() => subtotal + taxTotal, [subtotal, taxTotal]);

  const handleNumericInput = useCallback((field: string, value: string, _currentValue: number) => {
    if (value === '') { onUpdate(field, 0); return; }
    const cleanValue = value.replace(/^0+/, '') || '0';
    const numValue = parseFloat(cleanValue);
    if (!isNaN(numValue)) onUpdate(field, numValue);
  }, [onUpdate]);

  const handleTaxUpdate = useCallback((index: number, field: keyof TaxLine, value: string | number) => {
    const newTaxas = [...item.taxas];
    newTaxas[index] = { ...newTaxas[index], [field]: value };
    onUpdate('taxas', newTaxas);
  }, [item.taxas, onUpdate]);

  const handleTaxValueChange = useCallback((index: number, value: string) => {
    const newTaxas = [...item.taxas];
    if (value === '') {
      newTaxas[index] = { ...newTaxas[index], valor: 0 };
      onUpdate('taxas', newTaxas);
      return;
    }
    const cleanValue = value.replace(/^0+/, '') || '0';
    const numValue = parseFloat(cleanValue);
    if (!isNaN(numValue)) {
      newTaxas[index] = { ...newTaxas[index], valor: numValue };
      onUpdate('taxas', newTaxas);
    }
  }, [item.taxas, onUpdate]);

  return (
    <tr className="hover:bg-gray-50 border-b">
      <td className="p-1 border-r text-sm w-16">
        <input
          id={`item-${item.id}-quantidade`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-invalid={!!errors[`item-${item.id}-quantidade`]}
          className={`w-full p-1 border rounded text-center text-xs ${errors[`item-${item.id}-quantidade`] ? 'border-red-500' : 'border-gray-300'}`}
          value={item.quantidade === 0 ? '' : item.quantidade.toString()}
          onChange={(e) => {
            const value = e.target.value;
            if (/^\d*$/.test(value)) handleNumericInput('quantidade', value, item.quantidade);
          }}
          onBlur={(e) => {
            if (e.target.value === '') onUpdate('quantidade', 1);
            onBlur(`item-${item.id}-quantidade`);
          }}
          onFocus={(e) => e.target.select()}
        />
        {errors[`item-${item.id}-quantidade`] && <div className="text-red-500 text-xs mt-1">{errors[`item-${item.id}-quantidade`]}</div>}
      </td>
      <td className="p-1 border-r text-sm w-32">
        <input
          id={`item-${item.id}-descricao`}
          type="text"
          aria-invalid={!!errors[`item-${item.id}-descricao`]}
          className={`w-full p-1 border rounded text-xs ${errors[`item-${item.id}-descricao`] ? 'border-red-500' : 'border-gray-300'}`}
          value={item.descricao}
          onChange={(e) => onUpdate('descricao', e.target.value)}
          onBlur={() => onBlur(`item-${item.id}-descricao`)}
          placeholder="Descrição"
        />
        {errors[`item-${item.id}-descricao`] && <div className="text-red-500 text-xs mt-1">{errors[`item-${item.id}-descricao`]}</div>}
      </td>
      <td className="p-1 border-r text-sm w-24">
        <input
          id={`item-${item.id}-preco`}
          type="text"
          inputMode="decimal"
          aria-invalid={!!errors[`item-${item.id}-preco`]}
          className={`w-full p-1 border rounded text-right text-xs ${errors[`item-${item.id}-preco`] ? 'border-red-500' : 'border-gray-300'}`}
          value={item.precoUnitario === 0 ? '' : item.precoUnitario.toString()}
          onChange={(e) => {
            const value = e.target.value;
            if (/^\d*\.?\d*$/.test(value)) handleNumericInput('precoUnitario', value, item.precoUnitario);
          }}
          onBlur={() => onBlur(`item-${item.id}-preco`)}
          onFocus={(e) => e.target.select()}
        />
        {errors[`item-${item.id}-preco`] && <div className="text-red-500 text-xs mt-1">{errors[`item-${item.id}-preco`]}</div>}
      </td>
      <td className="p-1 border-r text-sm w-32">
        {item.taxas.map((taxa: TaxLine, index: number) => (
          <div key={index} className="flex items-center mb-1">
            <select
              className="w-12 p-1 border rounded text-center text-xs"
              value={taxa.tipo}
              onChange={(e) => handleTaxUpdate(index, 'tipo', e.target.value)}
            >
              <option value="percent">%</option>
              <option value="fixed">Fixo</option>
            </select>
            <input
              type="text"
              className="w-12 p-1 border rounded text-center text-xs mx-1"
              value={taxa.nome}
              onChange={(e) => handleTaxUpdate(index, 'nome', e.target.value)}
              placeholder="IVA"
            />
            <input
              type="text"
              inputMode="decimal"
              className="w-12 p-1 border rounded text-center text-xs mx-1"
              value={taxa.valor === 0 ? '' : taxa.valor.toString()}
              onChange={(e) => {
                const value = e.target.value;
                if (/^\d*\.?\d*$/.test(value)) handleTaxValueChange(index, value);
              }}
              onFocus={(e) => e.target.select()}
              placeholder="16"
            />
            <button
              type="button"
              className="text-red-500 hover:text-red-700"
              onClick={() => onRemoveTax(index)}
            >
              <FaTimes size={10} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs text-blue-500 hover:text-blue-700 mt-1 flex items-center justify-center"
          onClick={onAddTax}
        >
          <FaPlus size={8} className="mr-1" /> Taxa
        </button>
      </td>
      <td className="p-1 border-r text-sm text-right font-medium w-24">
        <span className="text-xs">{formatCurrency(totalItem, currency)}</span>
      </td>
      <td className="p-1 text-sm text-center w-12">
        <button
          type="button"
          className="text-red-500 hover:text-red-700 p-1"
          onClick={onRemove}
        >
          <FaTimes size={12} />
        </button>
      </td>
    </tr>
  );
});
ItemRow.displayName = 'ItemRow';

interface FormFieldProps {
  id: string;
  label: string;
  type: string;
  value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  halfWidth?: boolean;
  disabled?: boolean;
  maxLength?: number;
}

const FormField = memo(({
  id,
  label,
  type,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required,
  halfWidth,
  disabled = false,
  maxLength,
  ...props
}: FormFieldProps) => (
  <div className={`${halfWidth ? "w-full md:w-1/2" : "w-full"} px-2 mb-3`}>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      id={id}
      name={id}
      className={`w-full p-2 border rounded text-sm ${error ? 'border-red-500' : 'border-gray-300'} ${disabled ? 'bg-gray-100 opacity-50 cursor-not-allowed' : ''}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      required={required}
      disabled={disabled}
      maxLength={maxLength}
      {...props}
    />
    {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
  </div>
));
FormField.displayName = 'FormField';

const EmitenteStep = memo(({ formData, errors, handleChange, handleBlur, empresas, selectedEmpresa, onEmpresaChange, empresasLoading }: EmitenteStepProps) => {
  const [localLoading, setLocalLoading] = useState(false);
  const isCotacao = formData.tipo === 'cotacao';
  const isRecibo = formData.tipo === 'recibo';

  const handleEmpresaSelect = useCallback(async (empresaId: string) => {
    if (!empresaId || empresasLoading) return;
    setLocalLoading(true);
    try {
      const empresa = empresas.find(e => e.id === empresaId);
      if (empresa) await onEmpresaChange(empresa);
    } finally {
      setTimeout(() => setLocalLoading(false), 300);
    }
  }, [empresas, onEmpresaChange, empresasLoading]);

  return (
    <div className="w-full relative">
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between"><div className="flex items-center"><div><h4 className="text-lg font-semibold mb-2">Dados do Emitente</h4><p className="text-sm text-blue-600">{isCotacao ? 'Informe os dados da sua empresa para a cotação.' : (isRecibo ? 'Informe os dados da sua empresa para o recibo.' : 'Informe os dados da sua empresa para a fatura.')}</p></div></div></div>
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Selecione a Empresa Emitente</label>
        {empresasLoading && <div className="flex items-center p-3 bg-gray-50 rounded border"><FaSpinner className="animate-spin text-blue-500 mr-2" /><span className="text-sm text-gray-600">Carregando empresas...</span></div>}
        {!empresasLoading && empresas.length > 0 && (
          <div className="flex gap-2">
            <select className="flex-1 p-2 border border-gray-300 bg-green-50 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed" value={selectedEmpresa?.id || ''} onChange={(e) => handleEmpresaSelect(e.target.value)} disabled={localLoading || empresasLoading}>
              <option value="">Selecione uma empresa...</option>
              {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome} {empresa.padrao && '⭐'}</option>)}
            </select>
            {localLoading && <div className="flex items-center px-3 bg-blue-50 border border-blue-200 rounded"><FaSpinner className="animate-spin text-blue-500 mr-2" /><span className="text-blue-700 text-sm">Carregando...</span></div>}
            {selectedEmpresa && !localLoading && <div className="flex items-center px-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm"><FaCheck className="mr-2" />Selecionado</div>}
          </div>
        )}
        {!empresasLoading && empresas.length === 0 && <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-center"><FaExclamationTriangle className="text-yellow-500 mx-auto mb-2" /><p className="text-sm text-yellow-700">Nenhuma empresa cadastrada.<span className="underline ml-1 hover:text-yellow-800">Por favor, prossiga preenchendo os espaços em branco.</span></p></div>}
        {selectedEmpresa && !localLoading && <div className="mt-2 text-xs text-gray-500">Dados preenchidos automaticamente. Você pode editar manualmente se necessário.</div>}
      </div>
      {localLoading && <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg z-10"><div className="text-center"><FaSpinner className="animate-spin text-blue-500 text-2xl mb-2 mx-auto" /><p className="text-sm text-gray-600">Preenchendo dados da empresa...</p></div></div>}
      <div className={`space-y-3 ${localLoading ? 'opacity-50' : ''}`}>
        <div className="flex flex-wrap -mx-2">
          <FormField id="emitente.nomeEmpresa" label="Nome/Empresa *" type="text" value={formData.emitente.nomeEmpresa} onChange={handleChange} onBlur={handleBlur} error={errors['emitente.nomeEmpresa']} placeholder="Nome/Empresa" required halfWidth maxLength={70} disabled={localLoading} />
          <FormField id="emitente.documento" label="Documento" type="text" value={formData.emitente.documento} onChange={handleChange} onBlur={handleBlur} error={errors['emitente.documento']} placeholder="NUIT - 123456789" halfWidth maxLength={20} disabled={localLoading} />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField id="emitente.pais" label="País *" type="text" value={formData.emitente.pais} onChange={handleChange} onBlur={handleBlur} error={errors['emitente.pais']} placeholder="Moçambique" required halfWidth maxLength={15} disabled={localLoading} />
          <FormField id="emitente.cidade" label="Cidade *" type="text" value={formData.emitente.cidade} onChange={handleChange} onBlur={handleBlur} error={errors['emitente.cidade']} placeholder="Maputo" required halfWidth maxLength={30} disabled={localLoading} />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField id="emitente.bairro" label="Endereço Completo *" type="text" value={formData.emitente.bairro} onChange={handleChange} onBlur={handleBlur} error={errors['emitente.bairro']} placeholder="Alto Maé A, Av. 24 de Julho, Casa 123" required maxLength={80} disabled={localLoading} />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField id="emitente.telefone" label="Telefone *" type="tel" value={formData.emitente.telefone} onChange={handleChange} onBlur={handleBlur} error={errors['emitente.telefone']} placeholder="+258 83 123 4567" required halfWidth maxLength={18} disabled={localLoading} />
          <FormField id="emitente.email" label="Email" type="email" value={formData.emitente.email} onChange={handleChange} onBlur={handleBlur} error={errors['emitente.email']} placeholder="Email@gmail.com" halfWidth maxLength={60} disabled={localLoading} />
        </div>
      </div>
    </div>
  );
});
EmitenteStep.displayName = 'EmitenteStep';

const DestinatarioStep = memo(({ formData, errors, handleChange, handleBlur }: DestinatarioStepProps) => {
  const isCotacao = formData.tipo === 'cotacao';
  const isRecibo = formData.tipo === 'recibo';

  return (
    <div className="w-full">
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg"><div className="flex items-center justify-between"><div className="flex items-center"><div><h4 className="text-lg font-semibold mb-2">Dados do Destinatário</h4><p className="text-sm text-blue-600">{isCotacao ? 'Informe os dados do cliente que receberá a cotação.' : (isRecibo ? 'Informe os dados do destinatário ou cliente que receberá o recibo.' : 'Informe os dados do destinatário ou empresa que receberá a fatura.')}</p></div></div></div></div>
      <div className="space-y-3">
        <div className="flex flex-wrap -mx-2">
          <FormField id="destinatario.nomeCompleto" label="Nome Completo *" type="text" value={formData.destinatario.nomeCompleto} onChange={handleChange} onBlur={handleBlur} error={errors['destinatario.nomeCompleto']} placeholder="Nome completo do destinatário" required halfWidth maxLength={70} />
          <FormField id="destinatario.documento" label="Documento" type="text" value={formData.destinatario.documento} onChange={handleChange} onBlur={handleBlur} error={errors['destinatario.documento']} placeholder="NUIT - 123456789" halfWidth maxLength={20} />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField id="destinatario.pais" label="País *" type="text" value={formData.destinatario.pais} onChange={handleChange} onBlur={handleBlur} error={errors['destinatario.pais']} placeholder="Moçambique" required halfWidth maxLength={15} />
          <FormField id="destinatario.cidade" label="Cidade *" type="text" value={formData.destinatario.cidade} onChange={handleChange} onBlur={handleBlur} error={errors['destinatario.cidade']} placeholder="Matola" required halfWidth maxLength={30} />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField id="destinatario.bairro" label="Endereço Completo *" type="text" value={formData.destinatario.bairro} onChange={handleChange} onBlur={handleBlur} error={errors['destinatario.bairro']} placeholder="Av. das Indústrias, Bairro 3, Casa 45" required maxLength={80} />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField id="destinatario.telefone" label="Telefone *" type="tel" value={formData.destinatario.telefone} onChange={handleChange} onBlur={handleBlur} error={errors['destinatario.telefone']} placeholder="+258 84 123 4567" required halfWidth maxLength={18} />
          <FormField id="destinatario.email" label="Email" type="email" value={formData.destinatario.email} onChange={handleChange} onBlur={handleBlur} error={errors['destinatario.email']} placeholder="Email@gmail.com" halfWidth maxLength={60} />
        </div>
      </div>
    </div>
  );
});
DestinatarioStep.displayName = 'DestinatarioStep';

const ItensStep = memo(({ formData, errors, handleChange, handleBlur, items, adicionarItem, removerItem, atualizarItem, adicionarTaxa, removerTaxa, onItemBlur, isGeneratingNumber, generateDocumentNumber }: ItensStepProps) => {
  const isCotacao = formData.tipo === 'cotacao';
  const isRecibo = formData.tipo === 'recibo';

  const calcularSubtotal = useCallback(() => {
    return items.reduce((total, item) => {
      const subtotalItem = item.quantidade * item.precoUnitario;
      const taxasItem = item.taxas.reduce((sum: number, tax: any) =>
        tax.tipo === 'percent' ? sum + (subtotalItem * tax.valor) / 100 : sum + tax.valor, 0);
      return total + subtotalItem + taxasItem;
    }, 0);
  }, [items]);

  const calcularDescontoTotal = useCallback(() => {
    const subtotal = calcularSubtotal();
    if (formData.tipoDesconto === 'percent') {
      return (subtotal * (formData.desconto || 0)) / 100;
    }
    return formData.desconto || 0;
  }, [formData.tipoDesconto, formData.desconto, calcularSubtotal]);

  const calcularTotalFinal = useCallback(() => {
    const subtotal = calcularSubtotal();
    const desconto = calcularDescontoTotal();
    return Math.max(0, subtotal - desconto);
  }, [calcularSubtotal, calcularDescontoTotal]);

  const formatarData = (data: string) => new Date(data).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleValidityChange = (e: React.ChangeEvent<HTMLInputElement>, isCotacao: boolean) => {
    const value = e.target.value;
    const fieldName = isCotacao ? "validezCotacao" : "validezFatura";
    if (/^\d*$/.test(value)) {
      if (value === '') handleChange({ target: { name: fieldName, value: '0' } } as React.ChangeEvent<HTMLInputElement>);
      else { const cleanValue = value.replace(/^0+/, '') || '0'; handleChange({ target: { name: fieldName, value: cleanValue } } as React.ChangeEvent<HTMLInputElement>); }
    }
  };

  const handleDescontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      handleChange(e);
    }
  };

  const handleDescontoBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      handleChange({
        target: {
          name: 'desconto',
          value: 0
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    }
    handleBlur(e);
  };

  // Função para preencher automaticamente o valor recebido com o total
  const preencherValorRecebidoComTotal = useCallback(() => {
    handleChange({
      target: {
        name: 'valorRecebido',
        value: calcularTotalFinal()
      }
    } as unknown as React.ChangeEvent<HTMLInputElement>);
  }, [calcularTotalFinal, handleChange]);

  return (
    <div className="w-full">
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-3">{isCotacao ? '📄' : '📄'}</span>
            <div>
              <h5 className="text-blue-800">{isCotacao ? 'Itens da cotação' : (isRecibo ? 'Itens do recibo' : 'Itens da Fatura')}</h5>
              <p className="text-sm text-blue-600">
                {isCotacao ? 'Lista dos produtos e serviços incluídos nesta cotação.' : (isRecibo ? 'Lista dos produtos e serviços incluídos neste recibo.' : 'Lista dos produtos e serviços incluídos nesta fatura.')}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${isCotacao ? 'bg-green-100 text-green-800' : (isRecibo ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800')}`}>
            {isCotacao ? 'COTAÇÃO' : (isRecibo ? 'RECIBO' : 'FATURA')}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Número do documento e data */}
        <div className="flex flex-wrap -mx-2">
          <div className="w-full md:w-1/2 px-2 mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isCotacao ? 'Número da Cotação *' : (isRecibo ? 'Número do Recibo *' : 'Número da Fatura *')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id={isCotacao ? 'cotacaoNumero' : (isRecibo ? 'reciboNumero' : 'faturaNumero')}
                name={isCotacao ? 'cotacaoNumero' : (isRecibo ? 'reciboNumero' : 'faturaNumero')}
                className={`flex-1 bg-gray-50 p-2 border rounded text-sm ${errors[isCotacao ? 'cotacaoNumero' : (isRecibo ? 'reciboNumero' : 'faturaNumero')] ? 'border-red-500' : 'border-gray-300'} ${isGeneratingNumber ? 'bg-gray-50' : ''}`}
                value={isCotacao ? (formData.cotacaoNumero || '') : (isRecibo ? (formData.reciboNumero || '') : formData.faturaNumero)}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={isGeneratingNumber ? 'Gerando número automaticamente...' : (isCotacao ? 'Ex: COT-100' : (isRecibo ? 'Ex: RCB-100' : 'Ex: FTR-100'))}
                required
                maxLength={20}
                readOnly={true}
              />
              <button
                type="button"
                className="h-6 px-1 py-0 mt-2 leading-none text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                onClick={generateDocumentNumber}
                disabled={isGeneratingNumber}
                title={isCotacao ? 'Gerar novo número de cotação' : (isRecibo ? 'Gerar novo número de recibo' : 'Gerar novo número de fatura')}
              >
                {isGeneratingNumber ? (
                  <FaSpinner className="animate-spin" size={14} />
                ) : (
                  <FaSync size={14} />
                )}
              </button>
            </div>
            {isGeneratingNumber ? (
              <div className="text-blue-500 text-xs mt-1 flex items-center">
                <FaSpinner className="animate-spin mr-1" size={12} />
                Gerando número automaticamente...
              </div>
            ) : (isCotacao ? formData.cotacaoNumero : (isRecibo ? formData.reciboNumero : formData.faturaNumero)) ? (
              <div className="text-green-500 text-xs mt-1 flex items-center">
                <FaCheck className="mr-1" size={12} />
                Número {isRecibo ? 'de recibo' : (isCotacao ? 'de cotação' : 'de fatura')} gerado automaticamente
              </div>
            ) : null}
            {errors[isCotacao ? 'cotacaoNumero' : (isRecibo ? 'reciboNumero' : 'faturaNumero')] && (
              <div className="text-red-500 text-xs mt-1">
                {errors[isCotacao ? 'cotacaoNumero' : (isRecibo ? 'reciboNumero' : 'faturaNumero')]}
              </div>
            )}
          </div>

          <div className="w-full md:w-1/2 px-2 mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isCotacao ? 'Data da Cotação *' : (isRecibo ? 'Data do Recibo *' : 'Data da Fatura *')}
            </label>
            <input
              type="date"
              id={isRecibo ? 'dataRecebimento' : (isCotacao ? 'dataFatura' : 'dataFatura')}
              name={isRecibo ? 'dataRecebimento' : (isCotacao ? 'dataFatura' : 'dataFatura')}
              className={`w-full p-2 border rounded text-sm ${errors[isRecibo ? 'dataRecebimento' : 'dataFatura'] ? 'border-red-500' : 'border-gray-300'}`}
              value={isRecibo ? (formData.dataRecebimento || '') : formData.dataFatura}
              onChange={handleChange}
              onBlur={handleBlur}
              required
            />
            {errors[isRecibo ? 'dataRecebimento' : 'dataFatura'] && (
              <div className="text-red-500 text-xs mt-1">
                {errors[isRecibo ? 'dataRecebimento' : 'dataFatura']}
              </div>
            )}
            {isRecibo && (
              <div className="text-xs text-gray-500 mt-1">
                Data de emissão do recibo
              </div>
            )}
          </div>
        </div>

        {/* Tabela de itens - AGORA ACIMA do painel amarelo */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          <div className="overflow-x-auto" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            <table className="min-w-[600px] w-full border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-2 border text-xs font-medium text-gray-700 text-center w-16">Qtd</th>
                  <th className="px-2 py-2 border text-xs font-medium text-gray-700 w-32">Descrição</th>
                  <th className="px-2 py-2 border text-xs font-medium text-gray-700 text-right w-24">Preço</th>
                  <th className="px-2 py-2 border text-xs font-medium text-gray-700 text-center w-32">Taxas</th>
                  <th className="px-2 py-2 border text-xs font-medium text-gray-700 text-right w-24">Total</th>
                  <th className="px-2 py-2 border text-xs font-medium text-gray-700 text-center w-12">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    currency={formData.moeda}
                    onUpdate={(field, value) => atualizarItem(item.id, field as keyof ItemFatura, value)}
                    onRemove={() => removerItem(item.id)}
                    onAddTax={() => adicionarTaxa(item.id)}
                    onRemoveTax={(taxaIndex) => removerTaxa(item.id, taxaIndex)}
                    errors={errors}
                    onBlur={onItemBlur}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Botão Adicionar Item - ajustado e mais pequeno */}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors flex items-center justify-center"
            onClick={adicionarItem}
          >
            <FaPlus className="mr-1" size={10} /> Adicionar Item
          </button>
        </div>

        {/* Validade do documento (apenas para fatura e cotação) */}
        {!isRecibo && (
          <div className={`border rounded-lg p-4 mb-4 ${isCotacao ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
            <h5 className="font-semibold mb-3 text-gray-800">Validade do Documento</h5>
            <div className="flex flex-wrap -mx-2">
              <div className="w-full md:w-1/2 px-2 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Validade (dias) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  id={isCotacao ? "validezCotacao" : "validezFatura"}
                  name={isCotacao ? "validezCotacao" : "validezFatura"}
                  className={`w-full p-2 border rounded text-sm ${errors[isCotacao ? 'validezCotacao' : 'validezFatura'] ? 'border-red-500' : 'border-gray-300'}`}
                  value={isCotacao ? (formData.validezCotacao === '0' ? '' : formData.validezCotacao) : (formData.validezFatura === '0' ? '' : formData.validezFatura)}
                  onChange={(e) => handleValidityChange(e, isCotacao)}
                  onBlur={(e) => {
                    if (e.target.value === '') handleChange({
                      target: { name: isCotacao ? "validezCotacao" : "validezFatura", value: '15' }
                    } as React.ChangeEvent<HTMLInputElement>);
                    handleBlur(e);
                  }}
                  onFocus={(e) => e.target.select()}
                  required
                />
                {errors[isCotacao ? 'validezCotacao' : 'validezFatura'] && (
                  <div className="text-red-500 text-xs mt-1">{errors[isCotacao ? 'validezCotacao' : 'validezFatura']}</div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {isCotacao ? 'Padrão: 15 dias. Digite o número de dias de validade.' : 'Padrão: 15 dias. Digite o número de dias para vencimento.'}
                </div>
              </div>
              <div className="w-full md:w-1/2 px-2 mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isCotacao ? 'Data de Validade Calculada' : 'Data de Vencimento Calculada'}
                </label>
                <div className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50">{formatarData(formData.dataVencimento)}</div>
                <div className="text-xs text-gray-500 mt-1">Calculado automaticamente</div>
              </div>
            </div>
            <div className="mt-2 p-2 bg-white rounded border">
              <p className="text-xs text-gray-700"><strong>Resumo:</strong> {isCotacao ? 'Esta cotação' : 'Esta fatura'} emitida em {formatarData(formData.dataFatura)} será válida até {formatarData(formData.dataVencimento)} ({isCotacao ? formData.validezCotacao : formData.validezFatura} {parseInt(isCotacao ? formData.validezCotacao : formData.validezFatura) === 1 ? 'dia' : 'dias'} de validade).</p>
            </div>
          </div>
        )}

        {/* Seção específica para recibos - Layout reorganizado */}
        {isRecibo && (() => {
          const totalDocumento = calcularTotalFinal?.() || 0;
          const valorRecebido = formData.valorRecebido || 0;
          const restante = Math.max(0, totalDocumento - valorRecebido);

          return (
            <>
              <div className="border rounded-lg p-4 mb-4 bg-yellow-50 border-yellow-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start">
                    <span className="text-xl mr-3">💳</span>
                    <div>
                      <h5 className="text-gray-900 font-semibold">Dados do Pagamento</h5>
                      <p className="text-sm text-yellow-700">
                        Informe os detalhes do recebimento. Campos marcados com * são obrigatórios.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    RECIBO
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Coluna 1: Dados principais do pagamento */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valor Recebido *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="valorRecebido"
                          name="valorRecebido"
                          inputMode="decimal"
                          className={`flex-1 p-2 border rounded text-sm text-right ${errors['valorRecebido'] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          value={valorRecebido === 0 ? '' : valorRecebido}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (/^\d*\.?\d*$/.test(v)) handleChange(e as any);
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '') {
                              handleChange({ target: { name: 'valorRecebido', value: 0 } } as any);
                            }
                            handleBlur(e);
                          }}
                          placeholder="0.00"
                        />
                        <button
                          type="button"
                          className="h-9 px-3 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded transition-colors flex items-center"
                          onClick={preencherValorRecebidoComTotal}
                          title="Preencher com o valor total"
                        >
                          <FaMagnet size={12} />
                        </button>
                      </div>
                      {errors['valorRecebido'] && (
                        <div className="text-red-500 text-xs mt-1">{errors['valorRecebido']}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Forma de Pagamento *
                      </label>
                      <select
                        id="formaPagamento"
                        name="formaPagamento"
                        className={`w-full p-2 border rounded text-sm bg-white ${errors['formaPagamento'] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        value={formData.formaPagamento}
                        onChange={handleChange}
                        onBlur={handleBlur}
                      >
                        <option value="">Selecione...</option>
                        <option value="Transferência Bancária">Transferência Bancária</option>
                        <option value="M-Pesa">M-Pesa</option>
                        <option value="Cartão">Cartão</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Outro">Outro</option>
                      </select>
                      {errors['formaPagamento'] && (
                        <div className="text-red-500 text-xs mt-1">{errors['formaPagamento']}</div>
                      )}
                    </div>
                  </div>

                  {/* Coluna 2: Informações complementares */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fatura/Cotação Associada
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="documentoAssociadoCustom"
                          name="documentoAssociadoCustom"
                          className="flex-1 p-2 border rounded text-sm border-gray-300 bg-white"
                          placeholder=""
                          value={formData.documentoAssociadoCustom || ''}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          maxLength={30}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Referência do Pagamento
                      </label>
                      <input
                        type="text"
                        id="referenciaPagamento"
                        name="referenciaPagamento"
                        className="w-full p-2 border rounded text-xs border-gray-300 bg-white"
                        value={formData.referenciaPagamento || ''}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder=""
                        maxLength={40}
                      />
                    </div>
                  </div>
                </div>

                {/* Moeda - DENTRO do painel amarelo e ocupando duas colunas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Moeda</label>
                    <select
                      id="moeda"
                      name="moeda"
                      className="w-full p-2 border rounded border-gray-300 text-sm"
                      value={formData.moeda}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    >
                      <option value="MT">MT</option>
                      <option value="$">$ (USD)</option>
                      <option value="€">€ (EUR)</option>
                      <option value="R$">R$ (BRL)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Motivo do Pagamento e Resumo Financeiro - AGORA POR BAIXO do painel amarelo (apenas para recibo) */}
              <div className="space-y-4 mb-4">
                {/* Motivo do Pagamento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo do Pagamento
                  </label>
                  <textarea
                    id="motivoPagamento"
                    name="motivoPagamento"
                    className="w-full p-2 border rounded text-xs border-gray-300 bg-white"
                    value={formData.motivoPagamento || ''}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder=""
                    maxLength={80}
                    rows={2}
                  />
                </div>

                {/* Resumo financeiro */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-white rounded border">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase font-medium">Total do Documento</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">
                      {formatCurrency(totalDocumento, formData.moeda)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase font-medium">Valor Recebido</div>
                    <div className="text-lg font-semibold text-green-600 mt-1">
                      {formatCurrency(valorRecebido, formData.moeda)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase font-medium">Restante</div>
                    <div className={`text-lg font-semibold mt-1 ${restante > 0 ? 'text-orange-600' : 'text-gray-600'
                      }`}>
                      {formatCurrency(restante, formData.moeda)}
                    </div>
                  </div>
                </div>

                {restante > 0 && (
                  <div className="p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
                    <strong>Atenção:</strong> O valor recebido é inferior ao total do documento.
                    Restam {formatCurrency(restante, formData.moeda)} a receber.
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* SEÇÃO DE DESCONTO NO TOTAL (oculta para recibo) */}
        {!isRecibo && (
          <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
            <h5 className="font-semibold mb-4 text-gray-800 flex items-center">
              <FaPlus className="text-green-500 mr-2" size={14} />
              Desconto no Total
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <label className="block text-sm font-medium text-gray-700 w-24">
                    Tipo de Desconto:
                  </label>
                  <select
                    id="tipoDesconto"
                    name="tipoDesconto"
                    className="flex-1 p-2 border border-gray-300 rounded text-sm"
                    value={formData.tipoDesconto || 'fixed'}
                    onChange={handleChange}
                  >
                    <option value="fixed">Valor Fixo ({formData.moeda})</option>
                    <option value="percent">Percentual (%)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-3">
                  <label className="block text-sm font-medium text-gray-700 w-24">
                    {formData.tipoDesconto === 'percent' ? 'Percentual:' : 'Valor:'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    id="desconto"
                    name="desconto"
                    className={`flex-1 p-2 border rounded text-sm ${errors['desconto'] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    value={formData.desconto === 0 ? '' : formData.desconto?.toString() || ''}
                    onChange={handleDescontoChange}
                    onBlur={handleDescontoBlur}
                    placeholder={formData.tipoDesconto === 'percent' ? '0' : '0.00'}
                    onFocus={(e) => e.target.select()}
                  />
                  <span className="text-sm text-gray-600 w-8">
                    {formData.tipoDesconto === 'percent' ? '%' : formData.moeda}
                  </span>
                </div>
                {errors['desconto'] && (
                  <div className="text-red-500 text-xs mt-1">{errors['desconto']}</div>
                )}

                {formData.desconto > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                    <strong>Desconto aplicado:</strong> {formData.tipoDesconto === 'percent'
                      ? `${formData.desconto}% do total`
                      : `${formatCurrency(formData.desconto, formData.moeda)} de desconto`
                    }
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h6 className="font-semibold mb-3 text-gray-700 border-b pb-2">Resumo Financeiro</h6>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal ({items.length} itens):</span>
                    <span className="font-medium">{formatCurrency(calcularSubtotal(), formData.moeda)}</span>
                  </div>

                  {calcularDescontoTotal() > 0 && (
                    <>
                      <div className="flex justify-between text-red-600">
                        <span>Desconto:</span>
                        <span>-{formatCurrency(calcularDescontoTotal(), formData.moeda)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>
                          {formData.tipoDesconto === 'percent'
                            ? `(${formData.desconto}% aplicado)`
                            : `(desconto fixo)`
                          }
                        </span>
                        <span>
                          {formData.tipoDesconto === 'percent'
                            ? `${formatCurrency(calcularDescontoTotal(), formData.moeda)}`
                            : ''
                          }
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="font-semibold text-base">Total Final:</span>
                    <span className="font-bold text-lg text-green-600">
                      {formatCurrency(calcularTotalFinal(), formData.moeda)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Termos e condições (apenas para fatura e cotação) */}
        {!isRecibo && (
          <div className="w-full px-2 mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isCotacao ? 'Termos da Cotação' : 'Termos e Condições'}
            </label>
            <textarea
              id="termos"
              name="termos"
              className="w-full p-2 border rounded border-gray-300 text-sm"
              rows={3}
              value={formData.termos}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={260}
              placeholder={isCotacao ? 'Termos e condições específicos para esta cotação...' : 'Termos e condições de pagamento...'}
            />
            <div className="text-xs text-gray-500 mt-1">
              {isCotacao ? 'Os termos são atualizados automaticamente com a validade informada.' : 'Os termos são atualizados automaticamente com base na validade informada.'}
            </div>
          </div>
        )}

        {/* Métodos de pagamento (apenas para fatura) */}
        {!isRecibo && !isCotacao && (
          <div className="w-full px-2 mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Métodos de Pagamento
            </label>
            <textarea
              id="metodoPagamento"
              name="metodoPagamento"
              className="w-full p-2 border rounded border-gray-300 text-sm"
              rows={3}
              value={formData.metodoPagamento}
              onChange={handleChange}
              onBlur={handleBlur}
              maxLength={260}
              placeholder="Especifique os métodos de pagamento aceitos..."
            />
          </div>
        )}
      </div>
    </div>
  );
});
ItensStep.displayName = 'ItensStep';

const PreviewStep = memo(({ invoiceData, tipo, isFullscreen, onToggleFullscreen, onHtmlRendered }: PreviewStepProps) => (
  <div className="w-full space-y-6">
    <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg"><div className="flex items-center justify-between"><div className="flex items-center"><div><h4 className="text-lg font-semibold mb-2">Pré-visualização</h4><p className="text-sm text-blue-600">Visualize como seu documento ficará com o template selecionado.</p></div></div></div></div>
    <div><hr></hr><TemplateSlider invoiceData={invoiceData} tipo={tipo} isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} onHtmlRendered={onHtmlRendered} /></div>
  </div>
));
PreviewStep.displayName = 'PreviewStep';

const ProcessingOverlay = memo(({ isVisible, message = "Processando..." }: ProcessingOverlayProps) => {
  if (!isVisible) return null;
  return (<div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded-lg"><div className="text-center"><FaSpinner className="animate-spin text-blue-500 text-3xl mb-2 mx-auto" /><p className="text-sm text-gray-600">{message}</p></div></div>);
});
ProcessingOverlay.displayName = 'ProcessingOverlay';

const NavigationButtons = memo(({ currentStep, totalSteps, onPrev, onNext, isNavigating }: NavigationButtonsProps) => (
  <div className="mt-6 md:mt-8 flex justify-between border-t pt-4 md:pt-6">
    {currentStep > 0 && (<button className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-3 md:px-4 rounded flex items-center text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed" onClick={onPrev} disabled={isNavigating}>{isNavigating ? <FaSpinner className="animate-spin mr-1 md:mr-2" size={14} /> : <FaArrowLeft className="mr-1 md:mr-2" size={14} />}{isNavigating ? 'Processando...' : 'Voltar'}</button>)}
    {currentStep < totalSteps - 1 && (<button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 md:px-4 rounded flex items-center text-sm ml-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed" onClick={onNext} disabled={isNavigating}>{isNavigating ? <><FaSpinner className="animate-spin mr-1 md:mr-2" size={14} />Processando...</> : <><span>Próximo</span><FaArrowRight className="ml-1 md:ml-2" size={14} /></>}</button>)}
  </div>
));
NavigationButtons.displayName = 'NavigationButtons';

const StepsList = memo(({ currentStep, onStepClick, validateAllPreviousSteps, isNavigating }: StepsListProps) => {
  const handleStepClick = useCallback(async (stepIndex: number) => {
    if (isNavigating || stepIndex === currentStep) return;
    if (stepIndex < currentStep) { onStepClick(stepIndex); return; }
    const canProceed = await validateAllPreviousSteps(stepIndex);
    if (canProceed) onStepClick(stepIndex);
  }, [currentStep, onStepClick, validateAllPreviousSteps, isNavigating]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sticky top-4">
      <h5 className="font-semibold text-gray-800 text-base md:text-lg mb-3 md:mb-4">Etapas:</h5><hr className="mb-3 md:mb-4" />
      <div className="space-y-1 md:space-y-2 text-sm">
        {STEPS.map((step, index) => (
          <div key={index} className={`px-2 md:px-3 py-2 border-b border-gray-100 cursor-pointer transition-colors ${index === currentStep ? 'bg-blue-50 border-blue-200' : index < currentStep ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'hover:bg-gray-50'} ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => handleStepClick(index)}>
            <div className="font-medium text-gray-700 text-xs md:text-sm flex items-center justify-between">
              <span>{step.icon} <span className="hidden sm:inline">{step.title}</span><span className="sm:hidden">{step.title}</span></span>
              {index < currentStep && <FaCheck className="text-green-500 text-xs" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
StepsList.displayName = 'StepsList';

const NewDocumentForm: React.FC<NewDocumentFormProps> = ({ tipo = 'fatura' }) => {
  const { formData, items, errors, handleChange, handleBlur, adicionarItem, removerItem, atualizarItem, adicionarTaxa, removerTaxa, prepareInvoiceData, updateFormData, empresaModificacoes, verificarModificacoesEmpresa, registrarEmpresaOriginal, limparModificacoesEmpresa, isGeneratingNumber, validateForm, generateDocumentNumber, setItems } = useInvoiceForm(tipo);
  const { empresas, loading: empresasLoading, error: empresasError, refetch: refetchEmpresas } = useListarEmissores();
  const { empresaPadrao, loading: empresaPadraoLoading, error: empresaPadraoError, refetch: refetchEmpresaPadrao } = useEmpresaPadrao();
  const [currentStep, setCurrentStep] = useState(0);
  const [isTemplateFullscreen, setIsTemplateFullscreen] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const [isUpdatingEmpresa, setIsUpdatingEmpresa] = useState(false);
  const loading = empresasLoading || empresaPadraoLoading;
  const error = empresasError || empresaPadraoError;

  // Prefill cloning via sessionStorage (sobrevive navegação)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('clonedInvoiceData');
    if (!raw) return;
    try {
      const cloned = JSON.parse(raw);
      sessionStorage.removeItem('clonedInvoiceData');
      if (!cloned?.formData) return;
      // Atualiza formData completo
      updateFormData({ ...cloned.formData, tipo });
      // Substitui itens
      if (Array.isArray(cloned.items) && cloned.items.length) {
        const mapped = cloned.items.map((it: any, idx: number) => ({
          id: idx + 1,
          descricao: it.descricao || '',
          quantidade: it.quantidade || 1,
          precoUnitario: it.precoUnitario || 0,
          taxas: Array.isArray(it.taxas) ? it.taxas : [],
          totalItem: (it.quantidade || 1) * (it.precoUnitario || 0)
        }));
        setItems(mapped as any);
      }
      // Força salto para pré-visualização
      setCurrentStep(3);
    } catch (_e) {
      // Ignorar erros de parsing
    }
  }, [setItems, updateFormData, tipo]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      if (currentStep > 0) { setIsNavigating(true); setTimeout(() => { setCurrentStep(prev => prev - 1); setIsNavigating(false); }, 300); }
      else window.history.back();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentStep]);

  useEffect(() => { window.history.pushState({ step: currentStep, form: 'invoice-wizard' }, '', window.location.href); }, [currentStep]);

  const refreshData = useCallback(async () => { await Promise.all([refetchEmpresas(), refetchEmpresaPadrao()]); }, [refetchEmpresas, refetchEmpresaPadrao]);

  const fillEmitterData = useCallback((empresa: Empresa) => {
    if (!empresa || !updateFormData) return;
    const emitterData = { emitente: { nomeEmpresa: empresa.nome || '', documento: empresa.nuip || '', pais: empresa.pais || '', cidade: empresa.cidade || '', bairro: empresa.endereco || '', telefone: empresa.telefone || '', email: empresa.email || '' } };
    updateFormData(emitterData);
  }, [updateFormData]);

  useEffect(() => {
    const hasEmitenteData = formData.emitente.nomeEmpresa || formData.emitente.documento || formData.emitente.telefone;
    if (empresaPadrao && !selectedEmpresa && !hasEmitenteData && !loading) { setSelectedEmpresa(empresaPadrao); fillEmitterData(empresaPadrao); registrarEmpresaOriginal(empresaPadrao); }
  }, [empresaPadrao, selectedEmpresa, formData.emitente, loading, fillEmitterData, registrarEmpresaOriginal]);

  const handleEmpresaChange = useCallback((empresa: Empresa) => { setSelectedEmpresa(empresa); fillEmitterData(empresa); registrarEmpresaOriginal(empresa); }, [fillEmitterData, registrarEmpresaOriginal]);
  const handleHtmlRendered = useCallback((html: string) => { setRenderedHtml(html); }, []);
  const toggleTemplateFullscreen = useCallback(() => { setIsTemplateFullscreen(!isTemplateFullscreen); }, [isTemplateFullscreen]);

  const handleItemBlur = useCallback((field: string) => {
    let value: any = '';
    const match = field.match(/^item-(\d+)-(descricao|quantidade|preco)$/);
    if (match) {
      const id = parseInt(match[1]);
      const itemField = match[2];
      const targetItem = items.find(i => i.id === id);
      if (targetItem) {
        if (itemField === 'descricao') value = targetItem.descricao;
        else if (itemField === 'quantidade') value = targetItem.quantidade;
        else if (itemField === 'preco') value = targetItem.precoUnitario;
      }
    }
    handleBlur({ target: { name: field, value } } as any);
  }, [handleBlur, items]);

  const validateStep = useCallback((step: number) => {
    const newErrors: Record<string, string> = {};
    const invalidFields: string[] = [];

    const validateRequired = (value: string | undefined, fieldName: string) => {
      if (!value?.trim()) {
        newErrors[fieldName] = 'Obrigatório';
        invalidFields.push(fieldName);
        return false;
      }
      return true;
    };

    const validateEmail = (email: string | undefined, fieldName: string) => {
      if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors[fieldName] = 'Email inválido';
        invalidFields.push(fieldName);
        return false;
      }
      return true;
    };

    const validatePhone = (phone: string | undefined, fieldName: string) => {
      if (phone && phone.trim()) {
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (!/^[\+]?[0-9]{8,15}$/.test(cleanPhone)) {
          newErrors[fieldName] = 'Telefone inválido';
          invalidFields.push(fieldName);
          return false;
        }
      }
      return true;
    };

    const isRecibo = formData.tipo === 'recibo';

    switch (step) {
      case 0:
        validateRequired(formData.emitente.nomeEmpresa, 'emitente.nomeEmpresa');
        validateRequired(formData.emitente.pais, 'emitente.pais');
        validateRequired(formData.emitente.cidade, 'emitente.cidade');
        validateRequired(formData.emitente.telefone, 'emitente.telefone');
        validatePhone(formData.emitente.telefone, 'emitente.telefone');
        validateEmail(formData.emitente.email, 'emitente.email');
        break;
      case 1:
        validateRequired(formData.destinatario.nomeCompleto, 'destinatario.nomeCompleto');
        validateRequired(formData.destinatario.pais, 'destinatario.pais');
        validateRequired(formData.destinatario.cidade, 'destinatario.cidade');
        validateRequired(formData.destinatario.telefone, 'destinatario.telefone');
        validatePhone(formData.destinatario.telefone, 'destinatario.telefone');
        validateEmail(formData.destinatario.email, 'destinatario.email');
        break;
      case 2:
        if (formData.tipo === 'fatura') {
          validateRequired(formData.faturaNumero, 'faturaNumero');
          validateRequired(formData.validezFatura, 'validezFatura');
          if (formData.validezFatura) {
            const dias = parseInt(formData.validezFatura);
            if (dias < 1 || dias > 365) newErrors['validezFatura'] = 'Validade deve ser entre 1 e 365 dias';
          }
          validateRequired(formData.dataFatura, 'dataFatura');
        } else if (formData.tipo === 'cotacao') {
          validateRequired(formData.cotacaoNumero, 'cotacaoNumero');
          validateRequired(formData.validezCotacao, 'validezCotacao');
          if (formData.validezCotacao) {
            const dias = parseInt(formData.validezCotacao);
            if (dias < 1 || dias > 365) newErrors['validezCotacao'] = 'Validade deve ser entre 1 e 365 dias';
          }
          validateRequired(formData.dataFatura, 'dataFatura');
        } else if (isRecibo) {
          validateRequired(formData.reciboNumero, 'reciboNumero');
          // Atualizado: usar dataRecebimento consistente com hook e template
          validateRequired(formData.dataRecebimento, 'dataRecebimento');
          validateRequired(formData.valorRecebido?.toString(), 'valorRecebido');
          validateRequired(formData.formaPagamento, 'formaPagamento');
          // Regras adicionais específicas para recibo
          if (typeof formData.valorRecebido !== 'number' || formData.valorRecebido <= 0) {
            newErrors['valorRecebido'] = 'Valor recebido deve ser maior que zero';
            if (!invalidFields.includes('valorRecebido')) invalidFields.push('valorRecebido');
          }
          // Garante pelo menos 1 item no recibo (se itens são usados para detalhar o pagamento)
          if (!items || items.length === 0) {
            newErrors['faltaItens'] = 'Adicione pelo menos 1 item';
            // Foca no botão de adicionar item
            if (!invalidFields.includes('faltaItens')) invalidFields.push('item-0-descricao');
          }
        }

        if (formData.desconto < 0) {
          newErrors['desconto'] = 'Desconto não pode ser negativo';
        }
        if (formData.tipoDesconto === 'percent' && formData.desconto > 100) {
          newErrors['desconto'] = 'Desconto percentual não pode ser maior que 100%';
        }

        items.forEach((item) => {
          if (!item.descricao.trim()) {
            const field = `item-${item.id}-descricao`;
            newErrors[field] = 'Descrição obrigatória';
            invalidFields.push(field);
            try { handleItemBlur(field); } catch { /* ignore */ }
          }
          if (item.quantidade < 1) {
            const field = `item-${item.id}-quantidade`;
            newErrors[field] = `Quantidade mínima: 1`;
            invalidFields.push(field);
            try { handleItemBlur(field); } catch { /* ignore */ }
          }
          if (item.precoUnitario < 0) {
            const field = `item-${item.id}-preco`;
            newErrors[field] = 'Preço não pode ser negativo';
            invalidFields.push(field);
            try { handleItemBlur(field); } catch { /* ignore */ }
          }
        });
        break;
    }
    return { isValid: Object.keys(newErrors).length === 0, invalidFields, newErrors };
  }, [formData, items, handleItemBlur]);

  const nextStep = useCallback(async () => {
    setIsNavigating(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Valida todos os steps anteriores + o atual antes de avançar
    for (let step = 0; step <= currentStep; step++) {
      const { isValid, invalidFields } = validateStep(step);
      if (!isValid) {
        // Reposiciona para o step com erro e foca primeiro campo inválido
        setCurrentStep(step);
        if (invalidFields.length > 0) {
          const firstInvalidFieldElement = document.getElementById(invalidFields[0]);
          firstInvalidFieldElement?.focus();
          firstInvalidFieldElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setIsNavigating(false);
        return;
      }
    }

    // Verifica modificações de empresa somente se passo 0 foi validado
    if (currentStep === 0 && empresaModificacoes.empresaOriginal && selectedEmpresa) {
      const { camposModificados, houveModificacoes } = verificarModificacoesEmpresa(empresaModificacoes.empresaOriginal, formData.emitente);
      empresaModificacoes.camposModificados = camposModificados;
      empresaModificacoes.houveModificacoes = houveModificacoes;
      if (houveModificacoes) {
        setPendingStep(currentStep + 1);
        setShowUpdateModal(true);
        setIsNavigating(false);
        return;
      }
    }

    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    setIsNavigating(false);
  }, [currentStep, validateStep, empresaModificacoes, selectedEmpresa, verificarModificacoesEmpresa, formData.emitente]);

  const prevStep = useCallback(async () => { setIsNavigating(true); await new Promise(resolve => setTimeout(resolve, 300)); setCurrentStep(prev => Math.max(prev - 1, 0)); setIsNavigating(false); }, []);

  const validateAllPreviousSteps = useCallback(async (targetStep: number) => {
    setIsNavigating(true);
    for (let step = 0; step < targetStep; step++) {
      const { isValid, invalidFields } = validateStep(step);
      if (!isValid) { setCurrentStep(step); if (invalidFields.length > 0) { const firstInvalidFieldElement = document.getElementById(invalidFields[0]); firstInvalidFieldElement?.focus(); } setIsNavigating(false); return false; }
    }
    if (targetStep >= 3) {
      const formIsValid = await validateForm();
      if (!formIsValid) { setCurrentStep(2); setIsNavigating(false); return false; }
    }
    setIsNavigating(false);
    return true;
  }, [validateStep, validateForm]);

  const atualizarEmpresaNaBD = useCallback(async () => {
    if (!empresaModificacoes.empresaOriginal || !selectedEmpresa) return;
    setIsUpdatingEmpresa(true);
    try {
      const response = await fetch(`/api/emissores/${selectedEmpresa.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome_empresa: formData.emitente.nomeEmpresa, documento: formData.emitente.documento, pais: formData.emitente.pais, cidade: formData.emitente.cidade, bairro: formData.emitente.bairro, email: formData.emitente.email, telefone: formData.emitente.telefone }) });
      if (!response.ok) throw new Error('Erro ao atualizar empresa');
      await refreshData(); limparModificacoesEmpresa(); setShowUpdateModal(false);
      if (pendingStep !== null) { setCurrentStep(pendingStep); setPendingStep(null); }
    } catch { alert('Erro ao atualizar empresa. Tente novamente.'); } finally { setIsUpdatingEmpresa(false); }
  }, [empresaModificacoes.empresaOriginal, selectedEmpresa, formData.emitente, refreshData, limparModificacoesEmpresa, pendingStep]);

  const pularAtualizacao = useCallback(() => { setShowUpdateModal(false); setPendingStep(null); if (pendingStep !== null) setCurrentStep(pendingStep); }, [pendingStep]);
  const handleStepClick = useCallback((stepIndex: number) => { setCurrentStep(stepIndex); }, []);
  const prepareDocumentData = useCallback(() => { return prepareInvoiceData(); }, [prepareInvoiceData]);

  const renderStepContent = useCallback(() => {
    const stepComponents = {
      0: <EmitenteStep formData={formData} errors={errors} handleChange={handleChange} handleBlur={handleBlur} empresas={empresas} selectedEmpresa={selectedEmpresa} onEmpresaChange={handleEmpresaChange} empresasLoading={loading} />,
      1: <DestinatarioStep formData={formData} errors={errors} handleChange={handleChange} handleBlur={handleBlur} />,
      2: <ItensStep formData={formData} errors={errors} handleChange={handleChange} handleBlur={handleBlur} items={items} adicionarItem={adicionarItem} removerItem={removerItem} atualizarItem={atualizarItem} adicionarTaxa={adicionarTaxa} removerTaxa={removerTaxa} onItemBlur={handleItemBlur} isGeneratingNumber={isGeneratingNumber} generateDocumentNumber={generateDocumentNumber} />,
      3: <PreviewStep invoiceData={prepareInvoiceData()} tipo={tipo} isFullscreen={isTemplateFullscreen} onToggleFullscreen={toggleTemplateFullscreen} onHtmlRendered={handleHtmlRendered} />,
      4: <Payment invoiceData={prepareDocumentData()} renderedHtml={renderedHtml} />
    };
    return stepComponents[currentStep as keyof typeof stepComponents] || null;
  }, [currentStep, formData, errors, handleChange, handleBlur, items, adicionarItem, removerItem, atualizarItem, adicionarTaxa, removerTaxa, prepareInvoiceData, isTemplateFullscreen, toggleTemplateFullscreen, handleHtmlRendered, renderedHtml, handleItemBlur, empresas, selectedEmpresa, handleEmpresaChange, loading, prepareDocumentData, tipo, isGeneratingNumber, generateDocumentNumber]);

  if (loading && empresas.length === 0) return (<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><FaSpinner className="animate-spin text-blue-500 text-4xl mb-4 mx-auto" /><p className="text-gray-600">Carregando dados das empresas...</p></div></div>);
  if (error && empresas.length === 0) return (<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md"><p className="font-bold">Erro ao carregar empresas</p><p className="text-sm">{error}</p><button onClick={refreshData} className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm">Tentar Novamente</button></div></div></div>);
  const isCotacao = tipo === 'cotacao';
  const isRecibo = tipo === 'recibo';

  return (
    <div className="min-h-screen bg-gray-50 mt-3 p-3 md:p-4 relative">
      <ProcessingOverlay isVisible={isNavigating} />
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4"><FaExclamationTriangle className="text-yellow-500 text-xl mr-3" /><h3 className="text-lg font-semibold">Atualizar Dados do Emissor?</h3></div>
            <div className="mb-4">
              <p className="text-gray-600 text-sm mb-3">Você modificou os dados do emissor <strong>{selectedEmpresa?.nome}</strong>.</p>
              <p>Ao atualizar os dados do emissor, todas as faturas existentes deste emissor serão atualizadas.</p>
              <p>Deseja salvar estas alterações para uso futuro?</p>
              {empresaModificacoes.camposModificados && Object.keys(empresaModificacoes.camposModificados).length > 0 && (
                <div className="bg-gray-50 p-3 rounded text-xs">
                  <p className="font-medium mb-2">Campos modificados:</p>
                  <ul className="space-y-1">{Object.entries(empresaModificacoes.camposModificados).map(([campo, valores]) => (<li key={campo} className="flex justify-between"><span className="capitalize">{campo.replace('.', ' ')}:</span><span className="text-gray-600">{valores.original} → <strong>{valores.atual}</strong></span></li>))}</ul>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50" onClick={pularAtualizacao} disabled={isUpdatingEmpresa}>Manter dados originais</button>
              <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center" onClick={atualizarEmpresaNaBD} disabled={isUpdatingEmpresa}>{isUpdatingEmpresa ? <><FaSpinner className="animate-spin mr-2" />Atualizando...</> : <><FaCheck className="mr-2" />Atualizar</>}</button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        <header className="mb-4 md:mb-6 text-center">
          <div className="bg-white rounded-lg border border-gray-200 p-2 mb-4">
            <div className="bg-gray-50 p-2">
              <h5 className={`text-xl md:text-2xl font-bold uppercase text-gray-900 mb-2 mt-2 ${roboto.className}`}>{isCotacao ? 'Nova Cotação' : (isRecibo ? 'Novo Recibo' : 'Nova Fatura')}</h5>
              <p className={`text-gray-600 text-xs md:text-sm  ${roboto.className}`}>{isCotacao ? 'Preencha todas as etapas para criar sua cotação de forma simples e eficiente.' : (isRecibo ? 'Preencha as etapas para registar o recibo.' : 'Finalize todas as etapas para obter sua fatura de forma simples e eficiente.')}</p>
            </div>
          </div>
        </header>
        <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4 mb-4 overflow-x-auto">
          <div className="flex items-center space-x-2 md:space-x-4 text-xs md:text-sm min-w-max">
            {STEPS.map((step, index) => (<React.Fragment key={index}><div className="flex items-center"><div className={`rounded-full p-1 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center mr-1 md:mr-2 ${index <= currentStep ? 'bg-blue-600' : 'bg-gray-300'}`}><span className={`text-xs font-bold ${index <= currentStep ? 'text-white' : 'text-gray-600'}`}>{index + 1}</span></div><span className={`hidden md:inline ${index <= currentStep ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{step.title}</span><span className={`md:hidden ${index <= currentStep ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{step.icon}</span></div>{index < STEPS.length - 1 && <div className="text-gray-300">›</div>}</React.Fragment>))}
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          <div className="lg:w-64 xl:w-80"><StepsList currentStep={currentStep} onStepClick={handleStepClick} validateAllPreviousSteps={validateAllPreviousSteps} isNavigating={isNavigating} /></div>
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 overflow-hidden">
              {renderStepContent()}
              <NavigationButtons currentStep={currentStep} totalSteps={STEPS.length} onPrev={prevStep} onNext={nextStep} isNavigating={isNavigating} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewDocumentForm;