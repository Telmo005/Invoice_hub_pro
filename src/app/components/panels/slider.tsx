import React, { useCallback } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { InvoiceData, TipoDocumento } from '@/types/invoice-types';
import { useTemplateManager } from '@/app/hooks/panels/useTemplateManager';
import { useTemplateScroll } from '@/app/hooks/panels/useTemplateScroll';
import { TemplateCard } from '@/app/components/panels/card';
import { PreviewPanel } from '@/app/components/panels/preview';

interface TemplateSliderProps {
  invoiceData: InvoiceData;
  tipo: TipoDocumento; 
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onHtmlRendered?: (html: string) => void;
}

const TemplateSlider: React.FC<TemplateSliderProps> = ({
  invoiceData,
  tipo,
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
    tipo, 
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

      <TemplateNavigationPanel
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        navigation={navigation}
        templatesContainerRef={templatesContainerRef}
        onTemplateSelect={handleTemplateSelectWithScroll}
        onNavigation={handleNavigation}
        tipo={tipo}
      />

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
        tipo={tipo}
      />
    </div>
  );
};

interface TemplateNavigationPanelProps {
  templates: any[];
  selectedTemplateId: string;
  navigation: any;
  templatesContainerRef: React.RefObject<HTMLDivElement>;
  onTemplateSelect: (id: string) => void;
  onNavigation: (direction: 'next' | 'prev') => void;
  tipo: TipoDocumento;
}

const TemplateNavigationPanel: React.FC<TemplateNavigationPanelProps> = ({
  templates,
  selectedTemplateId,
  navigation,
  templatesContainerRef,
  onTemplateSelect,
  onNavigation,
  tipo
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
              tipo={tipo}
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