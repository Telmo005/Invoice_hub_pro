import React, { useState, useCallback, useMemo } from 'react';
import { Roboto } from 'next/font/google';
import { isValidDocumentoFiscal, DOCUMENTO_FISCAL_TIPOS } from '@/lib/validation';
import { 
  FaEye, 
  FaPlus, 
  FaTrash, 
  FaStar, 
  FaRegStar, 
  FaEdit, 
  FaExclamationTriangle, 
  FaIdCard, 
  FaGlobe, 
  FaCity, 
  FaMapMarkerAlt, 
  FaPhone, 
  FaEnvelope,
  FaCheck,
  FaArrowRight,
  FaArrowLeft,
  FaSpinner
} from 'react-icons/fa';
import { Empresa } from '@/types/emissor-type';
import { useListarEmissores } from '@/app/hooks/emitters/useListarEmissores';
import { useEmpresaPadrao } from '@/app/hooks/emitters/useEmpresaPadrao';
import { useCrudEmissores } from '@/app/hooks/emitters/useCrudEmissores';

const roboto = Roboto({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
});

let cachedCsrfToken: string | null = null;
const fetchCsrfToken = async (): Promise<string> => {
    if (cachedCsrfToken) return cachedCsrfToken;
    const res = await fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' });
    const data = await res.json();
    const received = data?.csrfToken || data?.token;
    if (typeof received === 'string' && received.length > 10) {
        cachedCsrfToken = received;
        return cachedCsrfToken;
    }
    throw new Error('Falha ao obter CSRF token');
};

// Componente auxiliar
const Info = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <div className="flex items-center min-w-[120px] text-gray-500 text-sm">
      <span className="text-gray-400 text-xs mr-1">{icon}</span>
      <span>{label}:</span>
    </div>
    <div className="text-gray-800 text-sm">{value}</div>
  </div>
);

type ModalMode = 'view' | 'add' | 'edit';

// Componente de confirmação de exclusão
const DeleteConfirmationModal: React.FC<{
  isOpen: boolean;
  empresaNome: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}> = ({ isOpen, empresaNome, onConfirm, onCancel, isProcessing = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 text-red-500">
            <FaExclamationTriangle className="text-xl" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-semibold text-gray-900">Confirmar Exclusão</h3>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600">
            Tem certeza que deseja excluir a entidade <strong>"{empresaNome}"</strong>?
            Esta ação não pode ser desfeita.
          </p>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isProcessing ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Excluindo...
              </>
            ) : (
              'Excluir'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente de campo de formulário reutilizável
const FormField = React.memo(({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required,
  maxLength,
  halfWidth,
  ...props
}: {
  id: string;
  label: string;
  type?: string;
  value: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  halfWidth?: boolean;
  [key: string]: any;
}) => {
  const { halfWidth: _, ...inputProps } = props;
  
  return (
    <div className={`${halfWidth ? "w-full md:w-1/2" : "w-full"} px-2 mb-3`}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        id={id}
        name={id}
        className={`w-full p-2 border rounded text-sm ${error ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        maxLength={maxLength}
        {...inputProps}
      />
      {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
    </div>
  );
});

FormField.displayName = 'FormField';

// Componente de overlay de processamento
const ProcessingOverlay = React.memo(({ isVisible, message = "Processando..." }: { isVisible: boolean; message?: string }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded-lg">
      <div className="text-center">
        <FaSpinner className="animate-spin text-blue-500 text-2xl mb-2 mx-auto" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
});

ProcessingOverlay.displayName = 'ProcessingOverlay';

// Componente de botões de navegação
const NavigationButtons = React.memo(({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  isNavigating
}: {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  isNavigating: boolean;
}) => (
  <div className="mt-6 flex justify-between border-t pt-4">
    {currentStep > 0 && (
      <button
        className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded flex items-center text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onPrev}
        disabled={isNavigating}
      >
        {isNavigating ? (
          <FaSpinner className="animate-spin mr-2" size={14} />
        ) : (
          <FaArrowLeft className="mr-2" size={14} />
        )}
        {isNavigating ? 'Processando...' : 'Voltar'}
      </button>
    )}
    {currentStep < totalSteps - 1 && (
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center text-sm ml-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onNext}
        disabled={isNavigating}
      >
        {isNavigating ? (
          <>
            <FaSpinner className="animate-spin mr-2" size={14} />
            Processando...
          </>
        ) : (
          <>
            Próximo <FaArrowRight className="ml-2" size={14} />
          </>
        )}
      </button>
    )}
  </div>
));

NavigationButtons.displayName = 'NavigationButtons';

// Steps configuration
const PROFILE_STEPS = [
  { title: 'Lista de Entidades', icon: '🏢' },
  { title: 'Detalhes da Entidade', icon: '👁️' },
];

const Screen = () => {
  // Usando os hooks separados
  const { 
    empresas, 
    loading: loadingList, 
    error: errorList, 
    refetch: refetchList 
  } = useListarEmissores();
  
  const { 
    empresaPadrao: _empresaPadrao, 
    loading: loadingPadrao, 
    error: errorPadrao, 
    definirEmpresaPadrao,
    refetch: refetchPadrao 
  } = useEmpresaPadrao();
  
  const { 
    loading: _loadingCrud, 
    error: _errorCrud, 
    adicionarEmpresa, 
    editarEmpresa, 
    excluirEmpresa 
  } = useCrudEmissores();

  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('view');
  const [newEmpresa, setNewEmpresa] = useState<Omit<Empresa, 'id' | 'padrao'>>({
    nome: '',
    nuip: '',
    documento_tipo: 'NUIT',
    pais: '',
    cidade: '',
    endereco: '',
    telefone: '',
    email: '',
    pessoa_contato: '',
    logo_url: null
  });
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    empresaId: string | null;
    empresaNome: string;
  }>({
    isOpen: false,
    empresaId: null,
    empresaNome: ''
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Novos estados para controlar processamento individual
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // Combinar estados de loading e error
  const loading = loadingList || loadingPadrao;
  const error = errorList || errorPadrao;

  // Função para refresh dos dados
  const refreshData = useCallback(async () => {
    await Promise.all([refetchList(), refetchPadrao()]);
  }, [refetchList, refetchPadrao]);

  // Funções de navegação
  const nextStep = useCallback(async () => {
    setIsNavigating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setCurrentStep(prev => Math.min(prev + 1, PROFILE_STEPS.length - 1));
    setIsNavigating(false);
  }, []);

  const prevStep = useCallback(async () => {
    setIsNavigating(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setCurrentStep(prev => Math.max(prev - 1, 0));
    setIsNavigating(false);
  }, []);

  const handleStepClick = useCallback((stepIndex: number) => {
    setCurrentStep(stepIndex);
  }, []);

  // Validação otimizada com useCallback
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!newEmpresa.nome.trim()) errors.nome = 'Nome da entidade é obrigatório';
    if (!newEmpresa.nuip.trim()) errors.nuip = 'Documento é obrigatório';
    else if (!isValidDocumentoFiscal(newEmpresa.documento_tipo, newEmpresa.nuip, newEmpresa.pais)) {
      errors.nuip = 'NUIT inválido: deve ter 9 dígitos';
    }
    if (!newEmpresa.pais.trim()) errors.pais = 'País é obrigatório';
    if (!newEmpresa.cidade.trim()) errors.cidade = 'Cidade é obrigatória';
    if (!newEmpresa.endereco.trim()) errors.endereco = 'Endereço é obrigatório';
    if (!newEmpresa.telefone.trim()) errors.telefone = 'Telefone é obrigatório';

    if (newEmpresa.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmpresa.email)) {
      errors.email = 'Email inválido';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [newEmpresa]);

  // Handlers otimizados com useCallback - CORRIGIDOS
  const handleAddEmpresa = useCallback(async (empresaData: Omit<Empresa, 'id' | 'padrao'>) => {
    if (!validateForm()) return;
    
    setIsProcessing(true);
    setProcessingMessage('Adicionando entidade...');
    
    try {
      await adicionarEmpresa({
        ...empresaData,
        pessoa_contato: empresaData.pessoa_contato || ''
      });
      setIsModalOpen(false);
      setNewEmpresa({
        nome: '',
        nuip: '',
        documento_tipo: 'NUIT',
        pais: '',
        cidade: '',
        endereco: '',
        telefone: '',
        email: '',
        pessoa_contato: ''
      });
      setFormErrors({});
      // Refresh após sucesso
      await refreshData();
    } catch (err) {
      console.error('Erro ao adicionar entidade:', err);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [adicionarEmpresa, validateForm, refreshData]);

  const handleEditEmpresa = useCallback(async (empresaData: Omit<Empresa, 'id' | 'padrao'>) => {
    if (!selectedEmpresa) return;
    if (!validateForm()) return;

    setIsProcessing(true);
    setProcessingMessage('Atualizando entidade...');

    try {
      await editarEmpresa(selectedEmpresa.id, {
        ...empresaData,
        pessoa_contato: empresaData.pessoa_contato || ''
      });
      setIsModalOpen(false);
      setNewEmpresa({
        nome: '',
        nuip: '',
        documento_tipo: 'NUIT',
        pais: '',
        cidade: '',
        endereco: '',
        telefone: '',
        email: '',
        pessoa_contato: ''
      });
      setFormErrors({});
      // Refresh após sucesso
      await refreshData();
    } catch (err) {
      console.error('Erro ao editar entidade:', err);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [selectedEmpresa, editarEmpresa, validateForm, refreshData]);

  // Handler seguro para exclusão com confirmação
  const handleRemoveClick = useCallback((id: string, nome: string) => {
    setDeleteConfirmation({
      isOpen: true,
      empresaId: id,
      empresaNome: nome
    });
  }, []);

  const handleConfirmRemove = useCallback(async () => {
    if (!deleteConfirmation.empresaId) return;

    setIsProcessing(true);
    setProcessingMessage('Excluindo entidade...');

    try {
      await excluirEmpresa(deleteConfirmation.empresaId);
      if (selectedEmpresa?.id === deleteConfirmation.empresaId) {
        setSelectedEmpresa(null);
      }
      // Refresh após sucesso
      await refreshData();
    } catch (err) {
      console.error('Erro ao excluir entidade:', err);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
      setDeleteConfirmation({ isOpen: false, empresaId: null, empresaNome: '' });
    }
  }, [deleteConfirmation, selectedEmpresa, excluirEmpresa, refreshData]);

  const handleSetAsDefault = useCallback(async (id: string) => {
    setIsProcessing(true);
    setProcessingMessage('Definindo como padrão...');

    try {
      await definirEmpresaPadrao(id);
      // Refresh após sucesso
      await refreshData();
    } catch (err) {
      console.error('Erro ao definir entidade como padrão:', err);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [definirEmpresaPadrao, refreshData]);

  // Modal handlers otimizados
  const openViewModal = useCallback((empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setModalMode('view');
    setIsModalOpen(true);
  }, []);

  const openAddModal = useCallback(() => {
    setModalMode('add');
    setIsModalOpen(true);
    setFormErrors({});
    setNewEmpresa({
      nome: '',
      nuip: '',
      documento_tipo: 'NUIT',
      pais: '',
      cidade: '',
      endereco: '',
      telefone: '',
      email: '',
      pessoa_contato: '',
      logo_url: null
    });
    setLogoUploadError(null);
  }, []);

  const openEditModal = useCallback((empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setNewEmpresa({
      nome: empresa.nome,
      nuip: empresa.nuip,
      documento_tipo: empresa.documento_tipo || 'NUIT',
      pais: empresa.pais,
      cidade: empresa.cidade,
      endereco: empresa.endereco,
      telefone: empresa.telefone,
      email: empresa.email,
      pessoa_contato: empresa.pessoa_contato || '',
      logo_url: empresa.logo_url ?? null
    });
    setModalMode('edit');
    setIsModalOpen(true);
    setFormErrors({});
    setLogoUploadError(null);
  }, []);

  const handleInputChange = useCallback((field: keyof Omit<Empresa, 'id' | 'padrao'>) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setNewEmpresa(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  }, [formErrors]);

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setLogoUploadError('Tamanho da imagem excede o limite de 2MB.');
      return;
    }

    setIsUploadingLogo(true);
    setLogoUploadError(null);

    try {
      const csrfToken = await fetchCsrfToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/emissores/logo', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar logotipo');
      }

      const data = await response.json();
      if (data.url) {
        setNewEmpresa(prev => ({ ...prev, logo_url: data.url }));
      }
    } catch (err) {
      console.error('Erro no upload do logo:', err);
      setLogoUploadError(err instanceof Error ? err.message : 'Erro ao enviar logotipo');
    } finally {
      setIsUploadingLogo(false);
    }
  }, []);

  // Memoização da lista de entidades para performance
  const empresaList = useMemo(() =>
    empresas.map((empresa) => (
      <div
        key={empresa.id}
        className="px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-white via-gray-50 to-white hover:from-indigo-50 hover:via-indigo-100 hover:to-indigo-50 transition-all duration-300 cursor-pointer text-sm rounded-sm"
        onClick={() => {
          setSelectedEmpresa(empresa);
          if (currentStep === 0) nextStep();
        }}
      >
        {/* Nome da empresa */}
        <div className="font-medium text-gray-700 group-hover:text-indigo-700 truncate">
          {empresa.nome}
        </div>

        {/* Endereço */}
        <div className="text-xs text-gray-500 mt-0.5 truncate">
          {empresa.endereco} — {empresa.cidade}, {empresa.pais}
        </div>

        {/* Linha de ações com selo fixo à esquerda */}
        <div className="flex justify-between items-center mt-2">
          {/* Espaço reservado para selo "Padrão" */}
          <div className="min-w-[80px]">
            {empresa.padrao ? (
              <FaStar className="text-yellow-500 text-xs" />
            ) : (
              <span className="text-[10px] text-transparent px-2 py-0.5">.</span>
            )}
          </div>

          {/* Ícones de ação fixos à direita */}
          <div className="flex gap-3 text-gray-400 text-xs">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openViewModal(empresa);
              }}
              title="Visualizar"
              className="hover:text-blue-600 hover:scale-110 transition-transform"
              disabled={isProcessing}
            >
              <FaEye />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(empresa);
              }}
              title="Editar"
              className="hover:text-green-600 hover:scale-110 transition-transform"
              disabled={isProcessing}
            >
              <FaEdit />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveClick(empresa.id, empresa.nome);
              }}
              title="Excluir"
              className="hover:text-red-600 hover:scale-110 transition-transform"
              disabled={isProcessing}
            >
              <FaTrash />
            </button>
          </div>
        </div>
      </div>
    )),
    [empresas, setSelectedEmpresa, currentStep, nextStep, openViewModal, openEditModal, handleRemoveClick, isProcessing]
  );

  // Renderizar conteúdo do step atual
  const renderStepContent = useCallback(() => {
    switch (currentStep) {
      case 0: // Lista de Entidades
        return (
          <div className="w-full space-y-6">
            <div className="pt-4">
              <h4 className="text-lg font-semibold mb-2">Lista de Entidades</h4>
              <p className="text-sm text-gray-600 mb-4">
                Esses dados serão utilizados para o preenchimento automático de informações nas cotações e faturas, facilitando o processo e economizando tempo ao criar documentos.
              </p>
              <hr className="mb-6" />
            </div>

            {/* Lista de Entidades */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {empresas.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="flex flex-col items-center">
                    <div className="text-gray-300 mb-4">
                      <FaIdCard className="h-12 w-12 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhuma entidade cadastrada
                    </h3>
                    <p className="text-gray-500 mb-6 max-w-sm">
                      Adicione sua primeira entidade para começar a usar o sistema.
                    </p>
                    <button 
                      onClick={openAddModal}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <FaSpinner className="animate-spin mr-2 inline" />
                          Processando...
                        </>
                      ) : (
                        'Adicionar Primeira Entidade'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {empresaList}
                </div>
              )}
            </div>

            {/* Botão Adicionar */}
            {empresas.length > 0 && (
              <div className="flex justify-center">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={openAddModal}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <FaSpinner className="animate-spin mr-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <FaPlus className="mr-2" />
                      Adicionar Nova Entidade
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        );

      case 1: // Detalhes da Entidade
        return (
          <div className="w-full space-y-6">
            <div className="pt-4">
              <h4 className="text-lg font-semibold mb-2">Detalhes da Entidade</h4>
              <p className="text-sm text-gray-600 mb-4">
                Visualize e gerencie os detalhes da entidade selecionada.
              </p>
              <hr className="mb-6" />
            </div>

            {selectedEmpresa ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                {/* Cabeçalho com selo padrão */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    {selectedEmpresa.padrao && (
                      <div className="mb-2">
                        <span className="bg-yellow-100 text-yellow-700 text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-medium shadow-sm">
                          <FaStar className="text-yellow-500 text-xs" />
                          Padrão
                        </span>
                      </div>
                    )}
                    <h3 className="text-gray-800 text-lg font-semibold">
                      {selectedEmpresa.nome}
                    </h3>
                  </div>
                  {!selectedEmpresa.padrao && (
                    <button
                      onClick={() => handleSetAsDefault(selectedEmpresa.id)}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <FaSpinner className="animate-spin mr-2" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <FaRegStar className="mr-2" />
                          Tornar Padrão
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Informações em coluna */}
                <div className="flex flex-col gap-3 text-sm text-gray-700">
                  <Info icon={<FaIdCard />} label={selectedEmpresa.documento_tipo || 'Documento'} value={selectedEmpresa.nuip} />
                  <Info icon={<FaGlobe />} label="País" value={selectedEmpresa.pais} />
                  <Info icon={<FaCity />} label="Cidade" value={selectedEmpresa.cidade} />
                  <Info icon={<FaMapMarkerAlt />} label="Endereço" value={selectedEmpresa.endereco} />
                  <Info icon={<FaPhone />} label="Telefone" value={selectedEmpresa.telefone} />
                  <Info icon={<FaEnvelope />} label="Email" value={selectedEmpresa.email} />
                  <div className="flex items-start gap-2">
                    <div className="flex items-center min-w-[120px] text-gray-500 text-sm">
                      <span className="text-gray-400 text-xs mr-1">🖼️</span>
                      <span>Logotipo:</span>
                    </div>
                    <div>
                      {selectedEmpresa.logo_url ? (
                        <img src={selectedEmpresa.logo_url} alt="Logo" className="max-h-16 max-w-[160px] object-contain border p-1 rounded bg-white shadow-sm" />
                      ) : (
                        <span className="text-gray-400 text-xs italic">Nenhum configurado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(selectedEmpresa)}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <FaSpinner className="animate-spin mr-2" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <FaEdit className="mr-2" />
                        Editar Entidade
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleRemoveClick(selectedEmpresa.id, selectedEmpresa.nome)}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg flex items-center text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <FaSpinner className="animate-spin mr-2" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <FaTrash className="mr-2" />
                        Excluir Entidade
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
                Nenhuma entidade selecionada. Volte para a lista e selecione uma entidade.
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  }, [
    currentStep, empresas, empresaList, selectedEmpresa, isProcessing,
    openAddModal, openEditModal, handleSetAsDefault, handleRemoveClick
  ]);

  // Componente StepsList
  const StepsList = React.memo(() => (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sticky top-4">
      <h5 className="font-semibold text-gray-800 text-base mb-3">Navegação:</h5>
      <hr className="mb-3" />
      <div className="space-y-1 text-sm">
        {PROFILE_STEPS.map((step, index) => (
          <div
            key={index}
            className={`px-2 py-2 border-b border-gray-100 cursor-pointer transition-colors ${
              index === currentStep
                ? 'bg-blue-50 border-blue-200'
                : index < currentStep
                ? 'bg-green-50 border-green-200 hover:bg-green-100'
                : 'hover:bg-gray-50'
            } ${isNavigating || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !isNavigating && !isProcessing && handleStepClick(index)}
          >
            <div className="font-medium text-gray-700 text-xs flex items-center justify-between">
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

      {/* Botão Adicionar Entidade */}
      <button
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg font-medium flex items-center justify-center text-sm mt-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={openAddModal}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <FaSpinner className="animate-spin mr-2" />
            Processando...
          </>
        ) : (
          <>
            <FaPlus className="mr-2" />
            Adicionar Entidade
          </>
        )}
      </button>

      {/* Link de Ajuda */}
      <div className="pt-3 border-t border-gray-200 text-center mt-4">
        <a
          href="mailto:digitalhub.midia@gmail.com"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Ajuda? digitalhub.midia@gmail.com
        </a>
      </div>
    </div>
  ));

  StepsList.displayName = 'StepsList';

  if (loading && empresas.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-blue-500 text-2xl mb-4 mx-auto" />
          <p className="text-gray-600">Carregando entidades...</p>
        </div>
      </div>
    );
  }

  if (error && empresas.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
            <p className="font-bold">Erro ao carregar entidades associadas</p>
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

  return (
    <div className="min-h-screen bg-gray-50 mt-3 p-3 md:p-4 relative">
      <ProcessingOverlay isVisible={isProcessing} message={processingMessage} />

      <div className="max-w-6xl mx-auto">
        <header className="mb-4 md:mb-6 text-center">
          <div className="bg-white rounded-lg border border-gray-200 p-2 mb-4">
            <div className="bg-gray-50 p-2">
              <h5 className={`text-xl md:text-2xl font-bold uppercase text-gray-900 mb-2 mt-2 ${roboto.className}`}>
                Painel de Entidades
              </h5>
              <p className={`text-gray-600 text-xs md:text-sm ${roboto.className}`}>
                Gerencie as entidades associadas ao seu perfil
              </p>
            </div>
          </div>
        </header>

        {/* Card de Progresso */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4 mb-4 overflow-x-auto">
          <div className="flex items-center space-x-2 md:space-x-4 text-xs md:text-sm min-w-max">
            {PROFILE_STEPS.map((step, index) => (
              <React.Fragment key={index}>
                <div className="flex items-center">
                  <div className={`rounded-full p-1 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center mr-1 md:mr-2 ${
                    index <= currentStep ? 'bg-blue-600' : 'bg-gray-300'
                  }`}>
                    <span className={`text-xs font-bold ${
                      index <= currentStep ? 'text-white' : 'text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                  </div>
                  <span className={`hidden md:inline ${
                    index <= currentStep ? 'text-gray-700 font-medium' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </span>
                  <span className={`md:hidden ${
                    index <= currentStep ? 'text-gray-700 font-medium' : 'text-gray-500'
                  }`}>
                    {step.icon}
                  </span>
                </div>
                {index < PROFILE_STEPS.length - 1 && <div className="text-gray-300">›</div>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Layout de 3 Cards */}
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Card 1: Lista de Steps */}
          <div className="lg:w-64 xl:w-80">
            <StepsList />
          </div>

          {/* Card 2: Conteúdo do Step Atual */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 overflow-hidden">
              {renderStepContent()}

              {/* Navegação entre Steps */}
              <NavigationButtons
                currentStep={currentStep}
                totalSteps={PROFILE_STEPS.length}
                onPrev={prevStep}
                onNext={nextStep}
                isNavigating={isNavigating || isProcessing}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Adicionar/Editar Entidade */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
              <h3 className="font-semibold text-lg text-gray-800">
                {modalMode === 'view'
                  ? 'Visualizar Entidade'
                  : modalMode === 'add'
                    ? 'Adicionar Entidade'
                    : 'Editar Entidade'
                }
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-xl bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessing}
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              {modalMode === 'view' && selectedEmpresa && (
                <div className="bg-white p-6 rounded-lg">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-lg font-semibold text-gray-800">{selectedEmpresa.nome}</h4>
                    {selectedEmpresa.padrao ? (
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm flex items-center">
                        <FaStar className="mr-1" /> Entidade Padrão
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetAsDefault(selectedEmpresa.id)}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <FaSpinner className="animate-spin mr-2" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <FaRegStar className="mr-2" />
                            Tornar Padrão
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-bold">{selectedEmpresa.documento_tipo || 'Documento'}:</span>
                      <span className="font-medium text-gray-800">{selectedEmpresa.nuip}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-bold">País:</span>
                      <span className="font-medium text-gray-800">{selectedEmpresa.pais}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-bold">Cidade:</span>
                      <span className="font-medium text-gray-800">{selectedEmpresa.cidade}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-bold">Endereço:</span>
                      <span className="font-medium text-gray-800 text-right max-w-xs">{selectedEmpresa.endereco}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-bold">Telefone:</span>
                      <span className="font-medium text-gray-800">{selectedEmpresa.telefone}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-bold">Email:</span>
                      <span className="font-medium text-gray-800">{selectedEmpresa.email}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-bold">Logotipo:</span>
                      <span className="font-medium text-gray-800">
                        {selectedEmpresa.logo_url ? (
                          <img src={selectedEmpresa.logo_url} alt="Logo" className="max-h-12 max-w-[120px] object-contain border p-1 rounded" />
                        ) : (
                          <span className="text-gray-400 text-xs italic">Nenhum</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(modalMode === 'add' || modalMode === 'edit') && (
                <div className="space-y-4 bg-white p-6 rounded-lg">
                  <div className="flex flex-wrap -mx-2">
                    <FormField
                      id="nome"
                      label="Entidade/Pessoa Fisica *"
                      type="text"
                      value={newEmpresa.nome}
                      onChange={handleInputChange('nome')}
                      error={formErrors.nome}
                      placeholder="Digite o nome da entidade"
                      required
                      maxLength={70}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="flex flex-wrap -mx-2">
                    <div className="w-full md:w-1/3 px-2 mb-3">
                      <label htmlFor="documento_tipo" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                      <select
                        id="documento_tipo"
                        className="w-full p-2 border rounded text-sm border-gray-300"
                        value={newEmpresa.documento_tipo || 'NUIT'}
                        onChange={handleInputChange('documento_tipo') as any}
                        disabled={isProcessing}
                      >
                        {DOCUMENTO_FISCAL_TIPOS.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                      </select>
                    </div>
                    <FormField
                      id="nuip"
                      label="Número do Documento *"
                      type="text"
                      value={newEmpresa.nuip}
                      onChange={handleInputChange('nuip')}
                      error={formErrors.nuip}
                      placeholder="123456789"
                      required
                      maxLength={20}
                      halfWidth
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="flex flex-wrap -mx-2">
                    <FormField
                      id="pais"
                      label="País *"
                      type="text"
                      value={newEmpresa.pais}
                      onChange={handleInputChange('pais')}
                      error={formErrors.pais}
                      placeholder="Digite o país"
                      required
                      maxLength={15}
                      halfWidth
                      disabled={isProcessing}
                    />
                    <FormField
                      id="cidade"
                      label="Cidade *"
                      type="text"
                      value={newEmpresa.cidade}
                      onChange={handleInputChange('cidade')}
                      error={formErrors.cidade}
                      placeholder="Digite a cidade"
                      required
                      maxLength={30}
                      halfWidth
                      disabled={isProcessing}
                    />
                    <FormField
                      id="endereco"
                      label="Endereço Completo *"
                      type="text"
                      value={newEmpresa.endereco}
                      onChange={handleInputChange('endereco')}
                      error={formErrors.endereco}
                      placeholder="Rua da Resistência, nº 245, Bairro Alto-Maé"
                      required
                      maxLength={80}
                      disabled={isProcessing}
                    />
                    <FormField
                      id="telefone"
                      label="Telefone *"
                      type="tel"
                      value={newEmpresa.telefone}
                      onChange={handleInputChange('telefone')}
                      error={formErrors.telefone}
                      placeholder="Digite o telefone"
                      required
                      maxLength={18}
                      halfWidth
                      disabled={isProcessing}
                    />
                    <FormField
                      id="email"
                      label="Email"
                      type="email"
                      value={newEmpresa.email}
                      onChange={handleInputChange('email')}
                      error={formErrors.email}
                      placeholder="Digite o email"
                      maxLength={60}
                      halfWidth
                      disabled={isProcessing}
                    />
                    
                    <div className="w-full px-2 mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Logotipo da Empresa
                      </label>
                      <div className="flex items-center gap-4 border p-3 rounded bg-gray-50">
                        {newEmpresa.logo_url ? (
                          <div className="relative w-20 h-20 border rounded overflow-hidden bg-white flex items-center justify-center shadow-sm">
                            <img src={newEmpresa.logo_url} alt="Logo preview" className="object-contain w-full h-full p-1" />
                            <button
                              type="button"
                              onClick={() => setNewEmpresa(prev => ({ ...prev, logo_url: null }))}
                              className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors shadow"
                              title="Remover logotipo"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-20 border border-dashed rounded bg-white flex items-center justify-center text-gray-400 text-xs text-center p-2 shadow-inner">
                            Sem Logo
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                            onChange={handleLogoUpload}
                            disabled={isUploadingLogo || isProcessing}
                            className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
                          />
                          <p className="text-[11px] text-gray-500 mt-1">
                            PNG, JPG, SVG, GIF ou WEBP (máx. 2MB).
                          </p>
                          {isUploadingLogo && (
                            <span className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                              <FaSpinner className="animate-spin" /> A enviar logo...
                            </span>
                          )}
                          {logoUploadError && (
                            <span className="text-xs text-red-500 block mt-1">{logoUploadError}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium text-sm mt-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    onClick={() => {
                      if (modalMode === 'add') {
                        handleAddEmpresa(newEmpresa);
                      } else {
                        handleEditEmpresa(newEmpresa);
                      }
                    }}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <FaSpinner className="animate-spin mr-2" />
                        {modalMode === 'add' ? 'Adicionando...' : 'Salvando...'}
                      </>
                    ) : (
                      modalMode === 'add' ? 'Adicionar Entidade' : 'Salvar Alterações'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        empresaNome={deleteConfirmation.empresaNome}
        onConfirm={handleConfirmRemove}
        onCancel={() => setDeleteConfirmation({ isOpen: false, empresaId: null, empresaNome: '' })}
        isProcessing={isProcessing}
      />
    </div>
  );
};

export default React.memo(Screen);