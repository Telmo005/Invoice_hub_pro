import React, { useRef, useEffect } from 'react';
import { FiMinimize2, FiMaximize2, FiZoomIn, FiZoomOut } from 'react-icons/fi';

interface PreviewPanelProps {
    templateName: string;
    zoomLevel: number;
    isFullscreen: boolean;
    previewHeight: string;
    isRendering: boolean;
    error: string | null;
    renderedHtml: string;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onToggleFullscreen: () => void;
    isZoomInDisabled: boolean;
    isZoomOutDisabled: boolean;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
    templateName,
    zoomLevel,
    isFullscreen,
    previewHeight,
    isRendering,
    error,
    renderedHtml,
    onZoomIn,
    onZoomOut,
    onToggleFullscreen,
    isZoomInDisabled,
    isZoomOutDisabled
}) => {
    const contentRef = useRef<HTMLDivElement>(null);

    // Post-process template HTML to prevent styles from locking scroll/movement
    useEffect(() => {
        if (contentRef.current && renderedHtml) {
            // Find template containers and neutralize any overflow/positioning constraints
            const templates = contentRef.current.querySelectorAll('.t1-isolated, .invoice-template-isolated, .t3-isolated, .invoice-template');
            templates.forEach((template) => {
                const el = template as HTMLElement;
                // Allow natural scroll and positioning
                el.style.overflow = 'visible !important';
                el.style.position = 'relative !important';
                el.style.maxHeight = 'none !important';
                el.style.width = 'auto !important';
            });
        }
    }, [renderedHtml]);

    return (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
            {/* Header with controls */}
            <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center shrink-0">
                <h5 className="text-base font-semibold text-gray-900 m-0">
                    Pré-visualização: <span className="text-blue-600">{templateName}</span>
                </h5>
                <div className="flex items-center gap-3">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                        <button
                            onClick={onZoomOut}
                            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                            disabled={isZoomOutDisabled}
                            aria-label="Reduzir zoom"
                            title="Reduzir (−)"
                        >
                            <FiZoomOut size={18} />
                        </button>
                        <span className="px-3 py-1 text-sm font-medium text-gray-700 min-w-12 text-center">
                            {zoomLevel}%
                        </span>
                        <button
                            onClick={onZoomIn}
                            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                            disabled={isZoomInDisabled}
                            aria-label="Aumentar zoom"
                            title="Aumentar (+)"
                        >
                            <FiZoomIn size={18} />
                        </button>
                    </div>

                    {/* Fullscreen toggle */}
                    <button
                        onClick={onToggleFullscreen}
                        className="p-2 hover:bg-gray-200 rounded transition"
                        aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                        title={isFullscreen ? "Sair da tela cheia" : "Abrir em tela cheia"}
                    >
                        {isFullscreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
                    </button>
                </div>
            </div>

            {/* Preview content area */}
            <div
                className="flex-1 overflow-auto bg-gray-50 p-4"
                style={{ height: previewHeight }}
            >
                {isRendering ? (
                    <div className="flex flex-col items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-3"></div>
                        <span className="text-gray-600 text-sm">Carregando template...</span>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg m-4">
                        <p className="font-semibold mb-1">Erro ao carregar template</p>
                        <p className="text-sm">{error}</p>
                    </div>
                ) : (
                    <div className="flex justify-center items-start">
                        {/* Template container with zoom applied directly */}
                        <div
                            ref={contentRef}
                            style={{
                                zoom: `${zoomLevel}%`,
                                transformOrigin: 'top center',
                                width: 'fit-content',
                                willChange: 'auto', // Better performance
                                transition: 'none',
                            }}
                            className="bg-white rounded-lg overflow-visible"
                        >
                            <div 
                                dangerouslySetInnerHTML={{ __html: renderedHtml }} 
                                className="border border-gray-300 rounded"
                                style={{
                                    overflow: 'visible',
                                    position: 'relative'
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};