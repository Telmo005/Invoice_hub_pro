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

  // Usa Tailwind ao invés de Bootstrap para melhor performance
  const containerClasses = isFullscreen 
    ? 'fixed inset-0 bg-white z-50 p-4 overflow-hidden flex flex-col' 
    : 'w-full';

  const previewHeight = isFullscreen ? 'calc(100vh - 160px)' : '500px';

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="mb-4 p-3 bg-gray-100 rounded-lg flex justify-between items-center">
        <div>
          <h5 className="text-lg font-semibold mb-1">
            📄 {tipo === 'cotacao' ? 'Modelos de Cotação' : 'Modelos de Fatura'}
          </h5>
        </div>
        <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${
          tipo === 'cotacao' ? 'bg-green-500' : 'bg-blue-500'
        }`}>
          {tipo === 'cotacao' ? 'COTAÇÃO' : 'FATURA'}
        </span>
      </div>

      {/* Template Selection */}
      <TemplateNavigationPanel
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        navigation={navigation}
        templatesContainerRef={templatesContainerRef}
        onTemplateSelect={handleTemplateSelectWithScroll}
        onNavigation={handleNavigation}
        tipo={tipo}
      />

      {/* Preview */}
      <div className="flex-1 overflow-hidden">
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
        />
      </div>
    </div>
  );
};

interface TemplateNavigationPanelProps {
  templates: any[];
  selectedTemplateId: string;
  navigation: any;
  templatesContainerRef: React.RefObject<HTMLDivElement | null>;
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
    <div className="mb-4">
      {/* Navigation buttons + template carousel */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          onClick={() => onNavigation('prev')}
          className="shrink-0 p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!navigation.hasPrev}
          aria-label="Modelo anterior"
        >
          <FiChevronLeft size={20} />
        </button>

        {/* Template carousel - lightweight scroll container */}
        <div 
          ref={templatesContainerRef}
          className="flex gap-3 overflow-x-auto flex-1 px-2 pb-2 scroll-smooth"
          style={{ 
            scrollBehavior: 'smooth',
            maxWidth: '100%',
            scrollbarWidth: 'thin',
          }}
        >
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedTemplateId === template.id}
              onSelect={onTemplateSelect}
            />
          ))}
        </div>

        <button
          onClick={() => onNavigation('next')}
          className="shrink-0 p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!navigation.hasNext}
          aria-label="Próximo modelo"
        >
          <FiChevronRight size={20} />
        </button>
      </div>

      {/* Mobile hint */}
      <div className="md:hidden text-center mb-2">
        <small className="text-gray-500">
          {tipo === 'cotacao' ? 'Deslize para ver mais modelos de cotação' : 'Deslize para ver mais modelos de fatura'}
        </small>
      </div>
    </div>
  );
};

export default TemplateSlider;