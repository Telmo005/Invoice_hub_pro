import React, { useState, useCallback, memo, useEffect } from 'react';
import { Roboto } from 'next/font/google';
import {
  FaEye,
  FaPlus,
  FaTrash,
  FaStar,
  FaRegStar,
  FaEdit,
  FaExclamationTriangle,
  FaLocationArrow,
  FaCircle,
  FaIdCard,
  FaGlobe,
  FaCity,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaPaperclip,
  FaArrowRight,
  FaArrowLeft,
  FaCheck,
  FaSpinner,
  FaTimes,
  FaDownload,
  FaBuilding
} from 'react-icons/fa';
import useInvoiceForm from '@/app/hooks/forms/useNewDocumentWizzardForm';
import TemplateSlider from '@/app/components/panels/slider';
import Payment from '@/app/components/forms/PaymentForm';
import { formatCurrency } from '@/lib/formatUtils';
import { Empresa } from '@/types/emissor-type';
import { useListarEmissores } from '@/app/hooks/emitters/useListarEmissores';
import { useEmpresaPadrao } from '@/app/hooks/emitters/useEmpresaPadrao';
import { TipoDocumento } from '@/types/invoice-types';
import { useDocumentCheck } from '@/app/hooks/document/useFind';

// Font configuration
const roboto = Roboto({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
});

// Constants
const STEPS = [
  { title: 'Dados do Emitente', icon: '🏢' },
  { title: 'Dados do Destinatário', icon: '👤' },
  { title: 'Itens do Documento', icon: '📋' },
  { title: 'Pré-visualização', icon: '👁️' },
  { title: 'Finalizar', icon: '🏆' },
];

// Props interface
interface newDocumentFormProps {
  tipo: TipoDocumento;
}

// Memoized ItemRow component
const ItemRow = memo(({
  item,
  currency,
  onUpdate,
  onRemove,
  onAddTax,
  onRemoveTax,
  errors,
  onBlur
}) => {
  const calculateTotal = useCallback(() => {
    const subtotal = item.quantidade * item.precoUnitario;
    const taxTotal = item.taxas.reduce((sum, tax) => {
      return tax.tipo === 'percent'
        ? sum + (subtotal * tax.valor) / 100
        : sum + tax.valor;
    }, 0);
    return subtotal + taxTotal;
  }, [item.quantidade, item.precoUnitario, item.taxas]);

  // Função para lidar com campos numéricos
  const handleNumericInput = useCallback((field, value, currentValue) => {
    // Se estiver vazio, define como 0
    if (value === '') {
      onUpdate(field, 0);
      return;
    }

    // Remove zeros à esquerda quando o usuário digita
    const cleanValue = value.replace(/^0+/, '') || '0';

    // Converte para número
    const numValue = parseFloat(cleanValue);

    if (!isNaN(numValue)) {
      onUpdate(field, numValue);
    }
  }, [onUpdate]);

  const handleTaxUpdate = useCallback((index, field, value) => {
    const newTaxas = [...item.taxas];
    newTaxas[index] = { ...newTaxas[index], [field]: value };
    onUpdate('taxas', newTaxas);
  }, [item.taxas, onUpdate]);

  // Função para lidar com campos de taxa
  const handleTaxValueChange = useCallback((index, value) => {
    const newTaxas = [...item.taxas];

    // Se estiver vazio, define como 0
    if (value === '') {
      newTaxas[index] = {
        ...newTaxas[index],
        valor: 0
      };
      onUpdate('taxas', newTaxas);
      return;
    }

    // Remove zeros à esquerda quando o usuário digita
    const cleanValue = value.replace(/^0+/, '') || '0';
    const numValue = parseFloat(cleanValue);

    if (!isNaN(numValue)) {
      newTaxas[index] = {
        ...newTaxas[index],
        valor: numValue
      };
      onUpdate('taxas', newTaxas);
    }
  }, [item.taxas, onUpdate]);

  return (
    <tr className="hover:bg-gray-50 border-b">
      <td className="p-1 border-r text-sm w-16">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="w-full p-1 border rounded text-center text-xs"
          value={item.quantidade === 0 ? '' : item.quantidade.toString()}
          onChange={(e) => {
            const value = e.target.value;
            // Permite apenas números
            if (/^\d*$/.test(value)) {
              handleNumericInput('quantidade', value, item.quantidade);
            }
          }}
          onBlur={(e) => {
            // Se estiver vazio no blur, define como 1 (mínimo para quantidade)
            if (e.target.value === '') {
              onUpdate('quantidade', 1);
            }
            onBlur(`item-${item.id}-quantidade`);
          }}
          onFocus={(e) => {
            // Seleciona todo o texto quando focado
            e.target.select();
          }}
        />
        {errors[`item-${item.id}-quantidade`] && (
          <div className="text-red-500 text-xs mt-1">{errors[`item-${item.id}-quantidade`]}</div>
        )}
      </td>
      <td className="p-1 border-r text-sm w-32">
        <input
          type="text"
          className="w-full p-1 border rounded text-xs"
          value={item.descricao}
          onChange={(e) => onUpdate('descricao', e.target.value)}
          onBlur={() => onBlur(`item-${item.id}-descricao`)}
          placeholder="Descrição"
        />
        {errors[`item-${item.id}-descricao`] && (
          <div className="text-red-500 text-xs mt-1">{errors[`item-${item.id}-descricao`]}</div>
        )}
      </td>
      <td className="p-1 border-r text-sm w-24">
        <input
          type="text"
          inputMode="decimal"
          className="w-full p-1 border rounded text-right text-xs"
          value={item.precoUnitario === 0 ? '' : item.precoUnitario.toString()}
          onChange={(e) => {
            const value = e.target.value;
            // Permite números e ponto decimal
            if (/^\d*\.?\d*$/.test(value)) {
              handleNumericInput('precoUnitario', value, item.precoUnitario);
            }
          }}
          onBlur={() => onBlur(`item-${item.id}-preco`)}
          onFocus={(e) => {
            // Seleciona todo o texto quando focado
            e.target.select();
          }}
        />
        {errors[`item-${item.id}-preco`] && (
          <div className="text-red-500 text-xs mt-1">{errors[`item-${item.id}-preco`]}</div>
        )}
      </td>
      <td className="p-1 border-r text-sm w-32">
        {item.taxas.map((taxa, index) => (
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
                // Permite números e ponto decimal
                if (/^\d*\.?\d*$/.test(value)) {
                  handleTaxValueChange(index, value);
                }
              }}
              onFocus={(e) => {
                // Seleciona todo o texto quando focado
                e.target.select();
              }}
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
        <span className="text-xs">{formatCurrency(calculateTotal(), currency)}</span>
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

// Reusable FormField component
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
  ...props
}) => (
  <div className={`${halfWidth ? "w-full md:w-1/2" : "w-full"} px-2 mb-3`}>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
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
      {...props}
    />
    {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
  </div>
));

FormField.displayName = 'FormField';

// Step components
const EmitenteStep = memo(({
  formData,
  errors,
  handleChange,
  handleBlur,
  empresas,
  selectedEmpresa,
  onEmpresaChange,
  empresasLoading
}) => {
  const [localLoading, setLocalLoading] = useState(false);
  const isCotacao = formData.tipo === 'cotacao';

  const handleEmpresaSelect = useCallback(async (empresaId) => {
    if (!empresaId || empresasLoading) return;

    setLocalLoading(true);

    try {
      const empresa = empresas.find(e => e.id === empresaId);
      if (empresa) {
        await onEmpresaChange(empresa);
      }
    } finally {
      setTimeout(() => setLocalLoading(false), 300);
    }
  }, [empresas, onEmpresaChange, empresasLoading]);

  return (
    <div className="w-full relative">

      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div>
              <h4 className="text-lg font-semibold mb-2">Dados do Emitente</h4>
              <p className="text-sm text-blue-600">
                {isCotacao
                  ? 'Informe os dados da sua empresa para a cotação.'
                  : 'Informe os dados da sua empresa para a fatura.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown de seleção de empresa */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione a Empresa Emitente
        </label>

        {empresasLoading && (
          <div className="flex items-center p-3 bg-gray-50 rounded border">
            <FaSpinner className="animate-spin text-blue-500 mr-2" />
            <span className="text-sm text-gray-600">Carregando empresas...</span>
          </div>
        )}

        {!empresasLoading && empresas.length > 0 && (
          <div className="flex gap-2">
            <select
              className="flex-1 p-2 border border-gray-300 bg-green-50 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              value={selectedEmpresa?.id || ''}
              onChange={(e) => handleEmpresaSelect(e.target.value)}
              disabled={localLoading || empresasLoading}
            >
              <option value="">Selecione uma empresa...</option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nome} {empresa.padrao && '⭐'}
                </option>
              ))}
            </select>

            {localLoading && (
              <div className="flex items-center px-3 bg-blue-50 border border-blue-200 rounded">
                <FaSpinner className="animate-spin text-blue-500 mr-2" />
                <span className="text-blue-700 text-sm">Carregando...</span>
              </div>
            )}

            {selectedEmpresa && !localLoading && (
              <div className="flex items-center px-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                <FaCheck className="mr-2" />
                Selecionado
              </div>
            )}
          </div>
        )}

        {!empresasLoading && empresas.length === 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-center">
            <FaExclamationTriangle className="text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-yellow-700">
              Nenhuma empresa cadastrada.
              <span className="underline ml-1 hover:text-yellow-800">
                Por favor, prossiga preenchendo os espaços em branco.
              </span>
            </p>
          </div>
        )}

        {selectedEmpresa && !localLoading && (
          <div className="mt-2 text-xs text-gray-500">
            Dados preenchidos automaticamente. Você pode editar manualmente se necessário.
          </div>
        )}
      </div>

      {localLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg z-10">
          <div className="text-center">
            <FaSpinner className="animate-spin text-blue-500 text-2xl mb-2 mx-auto" />
            <p className="text-sm text-gray-600">Preenchendo dados da empresa...</p>
          </div>
        </div>
      )}

      <div className={`space-y-3 ${localLoading ? 'opacity-50' : ''}`}>
        <div className="flex flex-wrap -mx-2">
          <FormField
            id="emitente.nomeEmpresa"
            label="Nome/Empresa *"
            type="text"
            value={formData.emitente.nomeEmpresa}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['emitente.nomeEmpresa']}
            placeholder="Nome/Empresa"
            required
            halfWidth
            maxLength={70}
            disabled={localLoading}
          />
          <FormField
            id="emitente.documento"
            label="Documento"
            type="text"
            value={formData.emitente.documento}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['emitente.documento']}
            placeholder="NUIT - 123456789"
            halfWidth
            maxLength={20}
            disabled={localLoading}
          />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField
            id="emitente.pais"
            label="País *"
            type="text"
            value={formData.emitente.pais}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['emitente.pais']}
            placeholder="Moçambique"
            required
            halfWidth
            maxLength={60}
            disabled={localLoading}
          />
          <FormField
            id="emitente.cidade"
            label="Cidade *"
            type="text"
            value={formData.emitente.cidade}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['emitente.cidade']}
            placeholder="Maputo"
            required
            halfWidth
            maxLength={60}
            disabled={localLoading}
          />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField
            id="emitente.bairro"
            label="Endereço Completo *"
            type="text"
            value={formData.emitente.bairro}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['emitente.bairro']}
            placeholder="Alto Maé A, Av. 24 de Julho, Casa 123"
            required
            maxLength={60}
            disabled={localLoading}
          />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField
            id="emitente.telefone"
            label="Telefone *"
            type="tel"
            value={formData.emitente.telefone}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['emitente.telefone']}
            placeholder="+258 83 123 4567"
            required
            halfWidth
            maxLength={20}
            disabled={localLoading}
          />
          <FormField
            id="emitente.email"
            label="Email"
            type="email"
            value={formData.emitente.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['emitente.email']}
            placeholder="Email@gmail.com"
            halfWidth
            maxLength={60}
            disabled={localLoading}
          />
        </div>
      </div>
    </div>
  );
});

EmitenteStep.displayName = 'EmitenteStep';

const DestinatarioStep = memo(({ formData, errors, handleChange, handleBlur }) => {
  const isCotacao = formData.tipo === 'cotacao';

  return (
    <div className="w-full">

      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div>
              <h4 className="text-lg font-semibold mb-2">Dados do Destinatário</h4>
              <p className="text-sm text-blue-600">
                {isCotacao
                  ? 'Informe os dados do cliente que receberá a cotação.'
                  : 'Informe os dados do destinatário ou empresa que receberá a fatura.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap -mx-2">
          <FormField
            id="destinatario.nomeCompleto"
            label="Nome Completo *"
            type="text"
            value={formData.destinatario.nomeCompleto}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['destinatario.nomeCompleto']}
            placeholder="Nome completo do destinatário"
            required
            halfWidth
            maxLength={60}
          />
          <FormField
            id="destinatario.documento"
            label="Documento"
            type="text"
            value={formData.destinatario.documento}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['destinatario.documento']}
            placeholder="NUIT - 123456789"
            halfWidth
            maxLength={20}
          />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField
            id="destinatario.pais"
            label="País *"
            type="text"
            value={formData.destinatario.pais}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['destinatario.pais']}
            placeholder="Moçambique"
            required
            halfWidth
            maxLength={60}
          />
          <FormField
            id="destinatario.cidade"
            label="Cidade *"
            type="text"
            value={formData.destinatario.cidade}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['destinatario.cidade']}
            placeholder="Matola"
            required
            halfWidth
            maxLength={60}
          />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField
            id="destinatario.bairro"
            label="Endereço Completo *"
            type="text"
            value={formData.destinatario.bairro}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['destinatario.bairro']}
            placeholder="Av. das Indústrias, Bairro 3, Casa 45"
            maxLength={60}
          />
        </div>
        <div className="flex flex-wrap -mx-2">
          <FormField
            id="destinatario.telefone"
            label="Telefone *"
            type="tel"
            value={formData.destinatario.telefone}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['destinatario.telefone']}
            placeholder="+258 84 123 4567"
            required
            halfWidth
            maxLength={20}
          />
          <FormField
            id="destinatario.email"
            label="Email"
            type="email"
            value={formData.destinatario.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors['destinatario.email']}
            placeholder="Email@gmail.com"
            halfWidth
            maxLength={60}
          />
        </div>
      </div>
    </div>
  );
});

DestinatarioStep.displayName = 'DestinatarioStep';

const ItensStep = memo(({
  formData,
  errors,
  handleChange,
  handleBlur,
  items,
  adicionarItem,
  removerItem,
  atualizarItem,
  adicionarTaxa,
  removerTaxa,
  isCheckingInvoice,
  invoiceError,
  documentExists,
  onItemBlur,
  onDocumentNumberChange
}) => {
  const isCotacao = formData.tipo === 'cotacao';
  const numeroDocumento = isCotacao ? formData.cotacaoNumero : formData.faturaNumero;

  // Função para formatar a data
  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-MZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleDocumentNumberChange = (e) => {
    if (documentExists && onDocumentNumberChange) {
      onDocumentNumberChange();
    }
    handleChange(e);
  };

  // Função para lidar com campos de validade
  const handleValidityChange = (e: React.ChangeEvent<HTMLInputElement>, isCotacao: boolean) => {
    const value = e.target.value;
    const fieldName = isCotacao ? "validezCotacao" : "validezFatura";

    // Permite apenas números
    if (/^\d*$/.test(value)) {
      // Se estiver vazio, define como 0
      if (value === '') {
        handleChange({
          target: {
            name: fieldName,
            value: '0'
          }
        } as React.ChangeEvent<HTMLInputElement>);
      } else {
        // Remove zeros à esquerda
        const cleanValue = value.replace(/^0+/, '') || '0';
        handleChange({
          target: {
            name: fieldName,
            value: cleanValue
          }
        } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  return (
    <div className="w-full">
      {/* Indicador de Tipo */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-3">
              {isCotacao ? '📄' : '📄'}
            </span>
            <div>
              <h5 className="text-blue-800">
                {isCotacao ? 'Itens da cotação' : 'Itens da Fatura'}
              </h5>
              <p className="text-sm text-blue-600">
                {isCotacao
                  ? 'Lista dos produtos e serviços incluídos nesta cotação.'
                  : 'Lista dos produtos e serviços incluídos nesta fatura.'
                }
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${isCotacao
            ? 'bg-green-100 text-green-800'
            : 'bg-blue-100 text-blue-800'
            }`}>
            {isCotacao ? 'COTAÇÃO' : 'FATURA'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap -mx-2">
          {/* Campo de número específico para o tipo */}
          <div className="w-full md:w-1/2 px-2 mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isCotacao ? 'Número da Cotação *' : 'Número da Fatura *'}
            </label>
            <input
              type="text"
              id={isCotacao ? "cotacaoNumero" : "faturaNumero"}
              name={isCotacao ? "cotacaoNumero" : "faturaNumero"}
              className={`w-full p-2 border rounded text-sm ${errors[isCotacao ? 'cotacaoNumero' : 'faturaNumero'] || invoiceError || documentExists
                ? 'border-red-500'
                : 'border-gray-300'
                }`}
              value={isCotacao ? (formData.cotacaoNumero || '') : formData.faturaNumero}
              onChange={handleDocumentNumberChange}
              onBlur={handleBlur}
              placeholder={isCotacao ? "Ex: COT-100" : "Ex: FTR-100"}
              required
              maxLength={20}
            />

            {documentExists && numeroDocumento && (
              <div className="text-red-500 text-xs mt-1">
                {isCotacao
                  ? `A cotação "${numeroDocumento}" já existe. Use um número diferente.`
                  : `A fatura "${numeroDocumento}" já existe. Use um número diferente.`
                }
              </div>
            )}

            {!documentExists && (errors[isCotacao ? 'cotacaoNumero' : 'faturaNumero'] || invoiceError) && (
              <div className="text-red-500 text-xs mt-1">
                {errors[isCotacao ? 'cotacaoNumero' : 'faturaNumero'] || invoiceError}
              </div>
            )}
          </div>

          <div className="w-full md:w-1/2 px-2 mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data {isCotacao ? 'da Cotação' : 'da Fatura'} *
            </label>
            <input
              type="date"
              id="dataFatura"
              name="dataFatura"
              className={`w-full p-2 border rounded text-sm ${errors['dataFatura'] ? 'border-red-500' : 'border-gray-300'
                }`}
              value={formData.dataFatura}
              onChange={handleChange}
              onBlur={handleBlur}
              required
            />
            {errors['dataFatura'] && (
              <div className="text-red-500 text-xs mt-1">{errors['dataFatura']}</div>
            )}
          </div>
        </div>

        {isCheckingInvoice && (
          <div className="text-sm text-blue-500 mb-2 flex items-center">
            <FaSpinner className="animate-spin mr-2" />
            Verificando número do documento...
          </div>
        )}

        {/* Seção de Validade - PADRÃO PARA AMBOS OS TIPOS */}
        <div className={`border rounded-lg p-4 mb-4 ${isCotacao ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
          <h5 className="font-semibold mb-3 text-gray-800">
            Validade do Documento
          </h5>

          <div className="flex flex-wrap -mx-2">
            {/* PARA AMBOS: Campo de dias + data calculada */}
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
                value={isCotacao ?
                  (formData.validezCotacao === '0' ? '' : formData.validezCotacao) :
                  (formData.validezFatura === '0' ? '' : formData.validezFatura)
                }
                onChange={(e) => handleValidityChange(e, isCotacao)}
                onBlur={(e) => {
                  // Garante que não fique vazio no blur
                  if (e.target.value === '') {
                    handleChange({
                      target: {
                        name: isCotacao ? "validezCotacao" : "validezFatura",
                        value: '15' // Valor padrão
                      }
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                  handleBlur(e);
                }}
                onFocus={(e) => {
                  // Seleciona todo o texto quando focado
                  e.target.select();
                }}
                required
              />
              {errors[isCotacao ? 'validezCotacao' : 'validezFatura'] && (
                <div className="text-red-500 text-xs mt-1">
                  {errors[isCotacao ? 'validezCotacao' : 'validezFatura']}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {isCotacao
                  ? 'Padrão: 15 dias. Digite o número de dias de validade.'
                  : 'Padrão: 15 dias. Digite o número de dias para vencimento.'
                }
              </div>
            </div>

            <div className="w-full md:w-1/2 px-2 mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isCotacao ? 'Data de Validade Calculada' : 'Data de Vencimento Calculada'}
              </label>
              <div className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50">
                {formatarData(formData.dataVencimento)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Calculado automaticamente
              </div>
            </div>
          </div>

          {/* Informação de resumo */}
          <div className="mt-2 p-2 bg-white rounded border">
            <p className="text-xs text-gray-700">
              <strong>Resumo:</strong> {isCotacao ? 'Esta cotação' : 'Esta fatura'} emitida em {formatarData(formData.dataFatura)}
              {` será válida até ${formatarData(formData.dataVencimento)} (${isCotacao ? formData.validezCotacao : formData.validezFatura} ${parseInt(isCotacao ? formData.validezCotacao : formData.validezFatura) === 1 ? 'dia' : 'dias'} de validade).`}
            </p>
          </div>
        </div>

        {/* Container da tabela */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div
            className="overflow-x-auto"
            style={{
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch'
            }}
          >
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
                    onUpdate={(field, value) => atualizarItem(item.id, field, value)}
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

        <button
          type="button"
          className="w-full md:w-auto mt-3 px-3 py-2 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors flex items-center justify-center"
          onClick={adicionarItem}
        >
          <FaPlus className="mr-1" size={10} /> Adicionar Item
        </button>

        <div className="flex flex-wrap -mx-2 mt-4">
          <div className="w-full md:w-1/2 px-2 mb-3">
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

        {/* Termos e condições específicos - ATUALIZADO AUTOMATICAMENTE */}
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
            placeholder={
              isCotacao
                ? 'Termos e condições específicos para esta cotação...'
                : 'Termos e condições de pagamento...'
            }
          />
          <div className="text-xs text-gray-500 mt-1">
            {isCotacao
              ? 'Os termos são atualizados automaticamente com a validade informada.'
              : 'Os termos são atualizados automaticamente com base na validade informada.'
            }
          </div>
        </div>

        {/* Método de pagamento - apenas para faturas */}
        {!isCotacao && (
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

// Custom TemplateSlider para a pré-visualização
const PreviewStep = memo(({
  invoiceData,
  tipo,
  isFullscreen,
  onToggleFullscreen,
  onHtmlRendered
}) => {
  return (
    <div className="w-full space-y-6">
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div>
              <h4 className="text-lg font-semibold mb-2">Pré-visualização</h4>
              <p className="text-sm text-blue-600">Visualize como seu documento ficará com o template selecionado.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="">
        <hr></hr>
        <TemplateSlider
          invoiceData={invoiceData}
          tipo={tipo}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          onHtmlRendered={onHtmlRendered}
        />
      </div>
    </div>
  );
});

PreviewStep.displayName = 'PreviewStep';

// Componente de overlay de processamento
const ProcessingOverlay = memo(({ isVisible, message = "Processando..." }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded-lg">
      <div className="text-center">
        <FaSpinner className="animate-spin text-blue-500 text-3xl mb-2 mx-auto" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
});

ProcessingOverlay.displayName = 'ProcessingOverlay';

// Componente de botões de navegação ATUALIZADO
const NavigationButtons = memo(({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  isCheckingInvoice,
  isNavigating,
  documentExists
}) => (
  <div className="mt-6 md:mt-8 flex justify-between border-t pt-4 md:pt-6">
    {currentStep > 0 && (
      <button
        className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-3 md:px-4 rounded flex items-center text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onPrev}
        disabled={isNavigating}
      >
        {isNavigating ? (
          <FaSpinner className="animate-spin mr-1 md:mr-2" size={14} />
        ) : (
          <FaArrowLeft className="mr-1 md:mr-2" size={14} />
        )}
        {isNavigating ? 'Processando...' : 'Voltar'}
      </button>
    )}
    {currentStep < totalSteps - 1 && (
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 md:px-4 rounded flex items-center text-sm ml-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onNext}
        disabled={isCheckingInvoice || isNavigating || documentExists}
      >
        {isCheckingInvoice ? (
          <>
            <FaSpinner className="animate-spin mr-1 md:mr-2" size={14} />
            Verificando...
          </>
        ) : isNavigating ? (
          <>
            <FaSpinner className="animate-spin mr-1 md:mr-2" size={14} />
            Processando...
          </>
        ) : (
          <>
            Próximo <FaArrowRight className="ml-1 md:ml-2" size={14} />
          </>
        )}
      </button>
    )}
  </div>
));

NavigationButtons.displayName = 'NavigationButtons';

// Componente para lista de etapas com validação
const StepsList = memo(({
  currentStep,
  onStepClick,
  validateAllPreviousSteps,
  isNavigating
}) => {
  const handleStepClick = useCallback(async (stepIndex) => {
    if (isNavigating || stepIndex === currentStep) return;

    if (stepIndex < currentStep) {
      onStepClick(stepIndex);
      return;
    }

    const canProceed = await validateAllPreviousSteps(stepIndex);
    if (canProceed) {
      onStepClick(stepIndex);
    }
  }, [currentStep, onStepClick, validateAllPreviousSteps, isNavigating]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sticky top-4">
      <h5 className="font-semibold text-gray-800 text-base md:text-lg mb-3 md:mb-4">Etapas:</h5>
      <hr className="mb-3 md:mb-4" />
      <div className="space-y-1 md:space-y-2 text-sm">
        {STEPS.map((step, index) => (
          <div
            key={index}
            className={`px-2 md:px-3 py-2 border-b border-gray-100 cursor-pointer transition-colors ${index === currentStep
              ? 'bg-blue-50 border-blue-200'
              : index < currentStep
                ? 'bg-green-50 border-green-200 hover:bg-green-100'
                : 'hover:bg-gray-50'
              } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleStepClick(index)}
          >
            <div className="font-medium text-gray-700 text-xs md:text-sm flex items-center justify-between">
              <span>
                {step.icon} <span className="hidden sm:inline">{step.title}</span>
                <span className="sm:hidden">{step.title}</span>
              </span>
              {index < currentStep && (
                <FaCheck className="text-green-500 text-xs" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

StepsList.displayName = 'StepsList';

// Main component
const newDocumentForm: React.FC<newDocumentFormProps> = ({ tipo = 'fatura' }) => {
  const {
    formData,
    items,
    errors,
    handleChange,
    handleBlur,
    adicionarItem,
    removerItem,
    atualizarItem,
    adicionarTaxa,
    removerTaxa,
    prepareInvoiceData,
    updateFormData,
    empresaModificacoes,
    verificarModificacoesEmpresa,
    registrarEmpresaOriginal,
    limparModificacoesEmpresa
  } = useInvoiceForm(tipo);

  // Usando os hooks separados em vez de useApiEmissores
  const {
    empresas,
    loading: empresasLoading,
    error: empresasError,
    refetch: refetchEmpresas
  } = useListarEmissores();

  const {
    empresaPadrao,
    loading: empresaPadraoLoading,
    error: empresaPadraoError,
    refetch: refetchEmpresaPadrao
  } = useEmpresaPadrao();

  // Usando apenas o hook de verificação de documentos
  const {
    checkDocumentExists,
    checkFaturaExists,
    checkCotacaoExists,
    checking: isCheckingInvoice,
    error: checkError,
    lastResult: documentExists,
    resetError: resetCheckError
  } = useDocumentCheck();

  const [currentStep, setCurrentStep] = useState(0);
  const [isTemplateFullscreen, setIsTemplateFullscreen] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const [isUpdatingEmpresa, setIsUpdatingEmpresa] = useState(false);

  // NOVO ESTADO: Controla quando resetar o documentExists
  const [shouldResetDocumentCheck, setShouldResetDocumentCheck] = useState(false);

  // Combinar estados de loading
  const loading = empresasLoading || empresaPadraoLoading;
  const error = empresasError || empresaPadraoError;

  // NOVO: Efeito para controlar o botão "Voltar" do navegador
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();

      if (currentStep > 0) {
        setIsNavigating(true);
        setTimeout(() => {
          setCurrentStep(prev => prev - 1);
          setIsNavigating(false);
        }, 300);
      } else {
        // Se está no primeiro step, permite voltar para página anterior
        window.history.back();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentStep]);

  // NOVO: Efeito para atualizar o histórico quando o step muda
  useEffect(() => {
    window.history.pushState({
      step: currentStep,
      form: 'invoice-wizard'
    }, '', window.location.href);
  }, [currentStep]);

  // NOVO: Reset do documentExists quando o usuário muda o número
  const handleDocumentNumberChange = useCallback(() => {
    resetCheckError();
    setShouldResetDocumentCheck(true);
  }, [resetCheckError]);

  // NOVO: Efeito para resetar o documentExists quando o número muda
  useEffect(() => {
    if (shouldResetDocumentCheck) {
      setShouldResetDocumentCheck(false);
    }
  }, [shouldResetDocumentCheck]);

  // Função para refresh dos dados
  const refreshData = useCallback(async () => {
    await Promise.all([refetchEmpresas(), refetchEmpresaPadrao()]);
  }, [refetchEmpresas, refetchEmpresaPadrao]);

  // Função para preencher os dados do emitente
  const fillEmitterData = useCallback((empresa: Empresa) => {
    if (!empresa || !updateFormData) return;

    const emitterData = {
      emitente: {
        nomeEmpresa: empresa.nome || '',
        documento: empresa.nuip || '',
        pais: empresa.pais || '',
        cidade: empresa.cidade || '',
        bairro: empresa.endereco || '',
        telefone: empresa.telefone || '',
        email: empresa.email || ''
      }
    };

    updateFormData(emitterData);
  }, [updateFormData]);

  // Efeito para preencher automaticamente quando temos empresa padrão
  useEffect(() => {
    const hasEmitenteData = formData.emitente.nomeEmpresa ||
      formData.emitente.documento ||
      formData.emitente.telefone;

    if (empresaPadrao && !selectedEmpresa && !hasEmitenteData && !loading) {
      setSelectedEmpresa(empresaPadrao);
      fillEmitterData(empresaPadrao);
      registrarEmpresaOriginal(empresaPadrao);
    }
  }, [empresaPadrao, selectedEmpresa, formData.emitente, loading, fillEmitterData, registrarEmpresaOriginal]);

  // Função para lidar com mudança de empresa
  const handleEmpresaChange = useCallback((empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    fillEmitterData(empresa);
    registrarEmpresaOriginal(empresa);
  }, [fillEmitterData, registrarEmpresaOriginal]);

  const handleHtmlRendered = useCallback((html: string) => {
    setRenderedHtml(html);
  }, []);

  const toggleTemplateFullscreen = useCallback(() => {
    setIsTemplateFullscreen(!isTemplateFullscreen);
  }, [isTemplateFullscreen]);

  // Função para verificar documento baseada no tipo
  const checkDocumentByType = useCallback(async (numero: string) => {
    if (tipo === 'fatura') {
      return await checkFaturaExists(numero);
    } else {
      return await checkCotacaoExists(numero);
    }
  }, [tipo, checkFaturaExists, checkCotacaoExists]);

  // Função para validar step individual
  const validateStep = useCallback((step: number) => {
    const newErrors: Record<string, string> = {};
    const invalidFields: string[] = [];

    const validateRequired = (value: string, fieldName: string) => {
      if (!value?.trim()) {
        newErrors[fieldName] = 'Obrigatório';
        invalidFields.push(fieldName);
        return false;
      }
      return true;
    };

    const validateEmail = (email: string, fieldName: string) => {
      if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors[fieldName] = 'Email inválido';
        invalidFields.push(fieldName);
        return false;
      }
      return true;
    };

    const validatePhone = (phone: string, fieldName: string) => {
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

    const validateLength = (value: string, fieldName: string, maxLength: number) => {
      if (value && value.length > maxLength) {
        newErrors[fieldName] = `Máximo ${maxLength} caracteres`;
        invalidFields.push(fieldName);
        return false;
      }
      return true;
    };

    switch (step) {
      case 0:
        validateRequired(formData.emitente.nomeEmpresa, 'emitente.nomeEmpresa');
        validateLength(formData.emitente.nomeEmpresa, 'emitente.nomeEmpresa', 70);
        validateRequired(formData.emitente.pais, 'emitente.pais');
        validateLength(formData.emitente.pais, 'emitente.pais', 60);
        validateRequired(formData.emitente.cidade, 'emitente.cidade');
        validateLength(formData.emitente.cidade, 'emitente.cidade', 60);
        validateRequired(formData.emitente.telefone, 'emitente.telefone');
        validatePhone(formData.emitente.telefone, 'emitente.telefone');
        validateEmail(formData.emitente.email, 'emitente.email');
        validateLength(formData.emitente.documento, 'emitente.documento', 20);
        break;
      case 1:
        validateRequired(formData.destinatario.nomeCompleto, 'destinatario.nomeCompleto');
        validateLength(formData.destinatario.nomeCompleto, 'destinatario.nomeCompleto', 60);
        validateRequired(formData.destinatario.pais, 'destinatario.pais');
        validateLength(formData.destinatario.pais, 'destinatario.pais', 60);
        validateRequired(formData.destinatario.cidade, 'destinatario.cidade');
        validateLength(formData.destinatario.cidade, 'destinatario.cidade', 60);
        validateRequired(formData.destinatario.telefone, 'destinatario.telefone');
        validatePhone(formData.destinatario.telefone, 'destinatario.telefone');
        validateEmail(formData.destinatario.email, 'destinatario.email');
        validateLength(formData.destinatario.documento, 'destinatario.documento', 20);
        break;
      case 2:
        // Validação do número baseada no tipo
        if (formData.tipo === 'fatura') {
          validateRequired(formData.faturaNumero, 'faturaNumero');
          if (formData.faturaNumero && !/^[A-Z0-9\-_]{1,20}$/.test(formData.faturaNumero)) {
            newErrors['faturaNumero'] = 'Apenas letras, números, hífens e underscores';
            invalidFields.push('faturaNumero');
          }
          // VALIDAÇÃO DA VALIDEZ DA FATURA
          validateRequired(formData.validezFatura, 'validezFatura');
          if (formData.validezFatura) {
            const dias = parseInt(formData.validezFatura);
            if (dias < 1 || dias > 365) {
              newErrors['validezFatura'] = 'Validade deve ser entre 1 e 365 dias';
              invalidFields.push('validezFatura');
            }
          }
        } else {
          validateRequired(formData.cotacaoNumero, 'cotacaoNumero');
          if (formData.cotacaoNumero && !/^[A-Z0-9\-_]{1,20}$/.test(formData.cotacaoNumero)) {
            newErrors['cotacaoNumero'] = 'Apenas letras, números, hífens e underscores';
            invalidFields.push('cotacaoNumero');
          }
          // VALIDAÇÃO DA VALIDEZ DA COTAÇÃO
          validateRequired(formData.validezCotacao, 'validezCotacao');
          if (formData.validezCotacao) {
            const dias = parseInt(formData.validezCotacao);
            if (dias < 1 || dias > 365) {
              newErrors['validezCotacao'] = 'Validade deve ser entre 1 e 365 dias';
              invalidFields.push('validezCotacao');
            }
          }
        }

        validateRequired(formData.dataFatura, 'dataFatura');

        items.forEach((item) => {
          if (!item.descricao.trim()) {
            newErrors[`item-${item.id}-descricao`] = 'Descrição obrigatória';
            invalidFields.push(`item-${item.id}-descricao`);
          }
          if (item.quantidade < 1) {
            newErrors[`item-${item.id}-quantidade`] = 'Quantidade mínima: 1';
            invalidFields.push(`item-${item.id}-quantidade`);
          }
          if (item.precoUnitario < 0) {
            newErrors[`item-${item.id}-preco`] = 'Preço não pode ser negativo';
            invalidFields.push(`item-${item.id}-preco`);
          }
        });
        break;
    }

    return { isValid: Object.keys(newErrors).length === 0, invalidFields, newErrors };
  }, [formData, items]);

  // Função para navegar para o próximo step ATUALIZADA - BLOQUEIA se documento existe
  const nextStep = useCallback(async () => {
    setIsNavigating(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Validação do step atual
    const { isValid, invalidFields } = validateStep(currentStep);
    if (!isValid) {
      if (invalidFields.length > 0) {
        const firstInvalidFieldId = invalidFields[0];
        const firstInvalidFieldElement = document.getElementById(firstInvalidFieldId);
        firstInvalidFieldElement?.focus();
      }
      setIsNavigating(false);
      return;
    }

    // Verificação de modificações da empresa
    if (currentStep === 0 && empresaModificacoes.empresaOriginal && selectedEmpresa) {
      const { camposModificados, houveModificacoes } = verificarModificacoesEmpresa(
        empresaModificacoes.empresaOriginal,
        formData.emitente
      );

      empresaModificacoes.camposModificados = camposModificados;
      empresaModificacoes.houveModificacoes = houveModificacoes;

      if (houveModificacoes) {
        setPendingStep(currentStep + 1);
        setShowUpdateModal(true);
        setIsNavigating(false);
        return;
      }
    }

    // VERIFICAÇÃO DO DOCUMENTO - BLOQUEIA TOTALMENTE SE EXISTIR
    if (currentStep === 2) {
      resetCheckError(); // Limpa erros anteriores

      const numero = tipo === 'fatura' ? formData.faturaNumero : formData.cotacaoNumero;

      if (!numero || !numero.trim()) {
        setIsNavigating(false);
        return;
      }

      try {
        const exists = await checkDocumentByType(numero);

        // SE EXISTIR, BLOQUEIA COMPLETAMENTE A NAVEGAÇÃO
        if (exists) {
          setIsNavigating(false);
          return; // Não avança - o usuário precisa mudar o número
        }
      } catch (error) {
        // Em caso de erro, não bloqueia o usuário (permite tentar novamente)
        console.error('Erro na verificação:', error);
      }
    }

    // Avança se tudo estiver ok
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    setIsNavigating(false);
  }, [
    currentStep,
    validateStep,
    checkDocumentByType,
    formData,
    tipo,
    empresaModificacoes,
    selectedEmpresa,
    verificarModificacoesEmpresa,
    resetCheckError
  ]);

  // Função para navegar para o step anterior
  const prevStep = useCallback(async () => {
    setIsNavigating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setCurrentStep(prev => Math.max(prev - 1, 0));
    setIsNavigating(false);
  }, []);

  // Função para validar todas as etapas anteriores
  const validateAllPreviousSteps = useCallback(async (targetStep: number) => {
    setIsNavigating(true);

    for (let step = 0; step < targetStep; step++) {
      const { isValid, invalidFields } = validateStep(step);

      if (!isValid) {
        setCurrentStep(step);
        if (invalidFields.length > 0) {
          const firstInvalidFieldId = invalidFields[0];
          const firstInvalidFieldElement = document.getElementById(firstInvalidFieldId);
          firstInvalidFieldElement?.focus();
        }

        setIsNavigating(false);
        return false;
      }
    }

    if (targetStep >= 3) {
      resetCheckError();

      try {
        const numero = tipo === 'fatura' ? formData.faturaNumero : formData.cotacaoNumero;
        const documentExists = await checkDocumentByType(numero);
        if (documentExists) {
          setCurrentStep(2);
          setIsNavigating(false);
          return false;
        }
      } catch (error) {
        setCurrentStep(2);
        setIsNavigating(false);
        return false;
      }
    }

    setIsNavigating(false);
    return true;
  }, [validateStep, checkDocumentByType, tipo, formData.faturaNumero, formData.cotacaoNumero, resetCheckError]);

  // Função para atualizar empresa na BD
  const atualizarEmpresaNaBD = useCallback(async () => {
    if (!empresaModificacoes.empresaOriginal || !selectedEmpresa) return;

    setIsUpdatingEmpresa(true);

    try {
      const response = await fetch(`/api/emissores/${selectedEmpresa.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome_empresa: formData.emitente.nomeEmpresa,
          documento: formData.emitente.documento,
          pais: formData.emitente.pais,
          cidade: formData.emitente.cidade,
          bairro: formData.emitente.bairro,
          email: formData.emitente.email,
          telefone: formData.emitente.telefone
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar empresa');
      }

      await refreshData();
      limparModificacoesEmpresa();
      setShowUpdateModal(false);

      if (pendingStep !== null) {
        setCurrentStep(pendingStep);
        setPendingStep(null);
      }

    } catch (error) {
      console.error('Erro ao atualizar empresa:', error);
      alert('Erro ao atualizar empresa. Tente novamente.');
    } finally {
      setIsUpdatingEmpresa(false);
    }
  }, [empresaModificacoes.empresaOriginal, selectedEmpresa, formData.emitente, refreshData, limparModificacoesEmpresa, pendingStep]);

  // Função para pular atualização e continuar
  const pularAtualizacao = useCallback(() => {
    setShowUpdateModal(false);
    setPendingStep(null);
    if (pendingStep !== null) {
      setCurrentStep(pendingStep);
    }
  }, [pendingStep]);

  const handleStepClick = useCallback((stepIndex: number) => {
    setCurrentStep(stepIndex);
  }, []);

  const handleItemBlur = useCallback((field: string) => {
    handleBlur({ target: { name: field, value: '' } });
  }, [handleBlur]);

  // Função SIMPLIFICADA para preparar dados para o Payment
  const prepareDocumentData = useCallback(() => {
    return prepareInvoiceData();
  }, [prepareInvoiceData]);

  const renderStepContent = useCallback(() => {
    const stepComponents = {
      0: <EmitenteStep
        formData={formData}
        errors={errors}
        handleChange={handleChange}
        handleBlur={handleBlur}
        empresas={empresas}
        selectedEmpresa={selectedEmpresa}
        onEmpresaChange={handleEmpresaChange}
        empresasLoading={loading}
      />,
      1: <DestinatarioStep formData={formData} errors={errors} handleChange={handleChange} handleBlur={handleBlur} />,
      2: <ItensStep
        formData={formData}
        errors={errors}
        handleChange={handleChange}
        handleBlur={handleBlur}
        items={items}
        adicionarItem={adicionarItem}
        removerItem={removerItem}
        atualizarItem={atualizarItem}
        adicionarTaxa={adicionarTaxa}
        removerTaxa={removerTaxa}
        isCheckingInvoice={isCheckingInvoice}
        invoiceError={checkError}
        documentExists={documentExists}
        onItemBlur={handleItemBlur}
        onDocumentNumberChange={handleDocumentNumberChange}
      />,
      3: <PreviewStep
        invoiceData={prepareInvoiceData()}
        tipo={tipo}
        isFullscreen={isTemplateFullscreen}
        onToggleFullscreen={toggleTemplateFullscreen}
        onHtmlRendered={handleHtmlRendered}
      />,
      4: <Payment
        invoiceData={prepareDocumentData()}
        renderedHtml={renderedHtml}
        isFullscreen={isTemplateFullscreen}
        onToggleFullscreen={toggleTemplateFullscreen}
      />
    };
    return stepComponents[currentStep] || null;
  }, [
    currentStep, formData, errors, handleChange, handleBlur, items, adicionarItem, removerItem,
    atualizarItem, adicionarTaxa, removerTaxa, isCheckingInvoice, checkError, documentExists,
    prepareInvoiceData, isTemplateFullscreen, toggleTemplateFullscreen,
    handleHtmlRendered, renderedHtml, handleItemBlur, empresas, selectedEmpresa, handleEmpresaChange, loading,
    prepareDocumentData, tipo
  ]);

  if (loading && empresas.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-blue-500 text-4xl mb-4 mx-auto" />
          <p className="text-gray-600">Carregando dados das empresas...</p>
        </div>
      </div>
    );
  }

  if (error && empresas.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
            <p className="font-bold">Erro ao carregar empresas</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={refreshData}
              className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isCotacao = tipo === 'cotacao';

  return (
    <div className="min-h-screen bg-gray-50 mt-3 p-3 md:p-4 relative">
      <ProcessingOverlay isVisible={isNavigating} />

      {showUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <FaExclamationTriangle className="text-yellow-500 text-xl mr-3" />
              <h3 className="text-lg font-semibold">Atualizar Dados do Emissor?</h3>
            </div>

            <div className="mb-4">
              <p className="text-gray-600 text-sm mb-3">
                Você modificou os dados do emissor <strong>{selectedEmpresa?.nome}</strong>.
              </p>
              <p>
                Ao atualizar os dados do emissor, todas as faturas existentes deste emissor serão atualizadas.
              </p>
              <p>
                Deseja salvar estas alterações para uso futuro?
              </p>

              {empresaModificacoes.camposModificados && Object.keys(empresaModificacoes.camposModificados).length > 0 && (
                <div className="bg-gray-50 p-3 rounded text-xs">
                  <p className="font-medium mb-2">Campos modificados:</p>
                  <ul className="space-y-1">
                    {Object.entries(empresaModificacoes.camposModificados).map(([campo, valores]) => (
                      <li key={campo} className="flex justify-between">
                        <span className="capitalize">{campo.replace('.', ' ')}:</span>
                        <span className="text-gray-600">
                          {valores.original} → <strong>{valores.atual}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                onClick={pularAtualizacao}
                disabled={isUpdatingEmpresa}
              >
                Manter dados originais
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
                onClick={atualizarEmpresaNaBD}
                disabled={isUpdatingEmpresa}
              >
                {isUpdatingEmpresa ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <FaCheck className="mr-2" />
                    Atualizar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <header className="mb-4 md:mb-6 text-center">
          <div className="bg-white rounded-lg border border-gray-200 p-2 mb-4">
            <div className="bg-gray-50 p-2">
              <h5 className={`text-xl md:text-2xl font-bold uppercase text-gray-900 mb-2 mt-2 ${roboto.className}`}>
                {isCotacao ? 'Nova Cotação' : 'Nova Fatura'}
              </h5>
              <p className={`text-gray-600 text-xs md:text-sm  ${roboto.className}`}>
                {isCotacao
                  ? 'Preencha todas as etapas para criar sua cotação de forma simples e eficiente.'
                  : 'Finalize todas as etapas para obter sua fatura de forma simples e eficiente.'
                }
              </p>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4 mb-4 overflow-x-auto">
          <div className="flex items-center space-x-2 md:space-x-4 text-xs md:text-sm min-w-max">
            {STEPS.map((step, index) => (
              <React.Fragment key={index}>
                <div className="flex items-center">
                  <div className={`rounded-full p-1 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center mr-1 md:mr-2 ${index <= currentStep ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <span className={`text-xs font-bold ${index <= currentStep ? 'text-white' : 'text-gray-600'}`}>
                      {index + 1}
                    </span>
                  </div>
                  <span className={`hidden md:inline ${index <= currentStep ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                    {step.title}
                  </span>
                  <span className={`md:hidden ${index <= currentStep ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                    {step.icon}
                  </span>
                </div>
                {index < STEPS.length - 1 && <div className="text-gray-300">›</div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          <div className="lg:w-64 xl:w-80">
            <StepsList
              currentStep={currentStep}
              onStepClick={handleStepClick}
              validateAllPreviousSteps={validateAllPreviousSteps}
              isNavigating={isNavigating}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 overflow-hidden">
              {renderStepContent()}

              <NavigationButtons
                currentStep={currentStep}
                totalSteps={STEPS.length}
                onPrev={prevStep}
                onNext={nextStep}
                isCheckingInvoice={isCheckingInvoice}
                isNavigating={isNavigating}
                documentExists={documentExists}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default newDocumentForm;