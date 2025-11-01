import React, { useCallback } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { InvoiceData, TipoDocumento } from '@/types/invoice-types';
import { useTemplateManager } from '@/app/hooks/useTemplateManager';
import { useTemplateScroll } from '@/app/hooks/useTemplateScroll';
import { TemplateCard } from '@/app/components/templates/TemplateSlider/TemplateCard';
import { PreviewPanel } from '@/app/components/templates/TemplateSlider/PreviewPanel';

interface TemplateSliderProps {
  invoiceData: InvoiceData;
  tipo: TipoDocumento; // ← ÚNICA MODIFICAÇÃO AQUI
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onHtmlRendered?: (html: string) => void;
}

const TemplateSlider: React.FC<TemplateSliderProps> = ({
  invoiceData,
  tipo, // ← NOVO PROP
  isFullscreen = false,
  onToggleFullscreen = () => {},
  onHtmlRendered = () => {}
}) => {
  const {
    selectedTemplateId,
    selectedTemplate,
    renderState,
    zoomLevel,
    templates,
    navigation,
    handleTemplateChange,
    handleTemplateSelect,
    handleZoomIn,
    handleZoomOut,
    isZoomInDisabled,
    isZoomOutDisabled
  } = useTemplateManager({ 
    invoiceData, 
    tipo, // ← PASSA O TIPO PARA O HOOK
    onHtmlRendered 
  });

  const {
    templatesContainerRef,
    scrollTemplates,
    scrollToTemplate
  } = useTemplateScroll();

  const handleNavigation = useCallback((direction: 'next' | 'prev') => {
    handleTemplateChange(direction);
    scrollTemplates(direction === 'next' ? 'right' : 'left');
  }, [handleTemplateChange, scrollTemplates]);

  const handleTemplateSelectWithScroll = useCallback((templateId: string) => {
    const templateIndex = templates.findIndex(t => t.id === templateId);
    handleTemplateSelect(templateId);
    scrollToTemplate(templateIndex);
  }, [handleTemplateSelect, scrollToTemplate, templates]);

  const containerClasses = isFullscreen 
    ? 'position-fixed top-0 start-0 w-100 h-100 bg-white z-1050 p-3' 
    : '';

  const previewHeight = isFullscreen ? 'calc(100vh - 150px)' : '500px';

  return (
    <div className={containerClasses}>
      {/* Header simples com tipo de documento */}
      <div className="mb-3 p-3 bg-light rounded">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            {tipo === 'cotacao' ? '📄 Modelos de Cotação' : '📄 Modelos de Fatura'}
          </h5>
          <span className={`badge ${tipo === 'cotacao' ? 'bg-success' : 'bg-primary'}`}>
            {tipo === 'cotacao' ? 'COTAÇÃO' : 'FATURA'}
          </span>
        </div>
      </div>

      {/* Seleção de templates acima - MANTIDO ORIGINAL */}
      <TemplateNavigationPanel
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        navigation={navigation}
        templatesContainerRef={templatesContainerRef}
        onTemplateSelect={handleTemplateSelectWithScroll}
        onNavigation={handleNavigation}
        tipo={tipo} // ← PASSA O TIPO
      />

      {/* Previsualização abaixo - MANTIDO ORIGINAL */}
      <PreviewPanel
        templateName={selectedTemplate.name}
        zoomLevel={zoomLevel}
        isFullscreen={isFullscreen}
        previewHeight={previewHeight}
        isRendering={renderState.isLoading}
        error={renderState.error}
        renderedHtml={renderState.html}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleFullscreen={onToggleFullscreen}
        isZoomInDisabled={isZoomInDisabled}
        isZoomOutDisabled={isZoomOutDisabled}
        tipo={tipo} // ← PASSA O TIPO
      />
    </div>
  );
};

// TemplateNavigationPanel - MODIFICAÇÃO MÍNIMA
interface TemplateNavigationPanelProps {
  templates: any[];
  selectedTemplateId: string;
  navigation: any;
  templatesContainerRef: React.RefObject<HTMLDivElement>;
  onTemplateSelect: (id: string) => void;
  onNavigation: (direction: 'next' | 'prev') => void;
  tipo: TipoDocumento; // ← ADICIONADO APENAS ISSO
}

const TemplateNavigationPanel: React.FC<TemplateNavigationPanelProps> = ({
  templates,
  selectedTemplateId,
  navigation,
  templatesContainerRef,
  onTemplateSelect,
  onNavigation,
  tipo // ← NOVO PARÂMETRO
}) => {
  return (
    <>
      <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
        <button
          onClick={() => onNavigation('prev')}
          className="btn btn-sm btn-light rounded-circle"
          disabled={!navigation.hasPrev}
          aria-label="Modelo anterior"
        >
          <FiChevronLeft />
        </button>

        <div 
          ref={templatesContainerRef}
          className="d-flex overflow-auto pb-3 gap-3 px-2 align-items-stretch"
          style={{ 
            scrollbarWidth: 'thin',
            scrollBehavior: 'smooth',
            maxWidth: '100%'
          }}
        >
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedTemplateId === template.id}
              onSelect={onTemplateSelect}
              tipo={tipo} // ← PASSA O TIPO
            />
          ))}
        </div>

        <button
          onClick={() => onNavigation('next')}
          className="btn btn-sm btn-light rounded-circle"
          disabled={!navigation.hasNext}
          aria-label="Próximo modelo"
        >
          <FiChevronRight />
        </button>
      </div>

      <div className="d-md-none text-center mb-2">
        <small className="text-muted">
          {tipo === 'cotacao' ? 'Deslize para ver mais modelos de cotação' : 'Deslize para ver mais modelos de fatura'}
        </small>
      </div>
    </>
  );
};

export default TemplateSlider;