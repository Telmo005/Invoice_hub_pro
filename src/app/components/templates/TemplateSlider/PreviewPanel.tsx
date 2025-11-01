import React from 'react';
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
    return (
        <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                    Pré-visualização: <span className="text-primary">{templateName}</span>
                </h5>
                <div className="d-flex gap-2">
                    <button
                        onClick={onZoomOut}
                        className="btn btn-sm btn-outline-secondary"
                        disabled={isZoomOutDisabled}
                        aria-label="Reduzir zoom"
                    >
                        <FiZoomOut />
                    </button>
                    <span className="d-flex align-items-center px-2">
                        {zoomLevel}%
                    </span>
                    <button
                        onClick={onZoomIn}
                        className="btn btn-sm btn-outline-secondary"
                        disabled={isZoomInDisabled}
                        aria-label="Aumentar zoom"
                    >
                        <FiZoomIn />
                    </button>
                    <button
                        onClick={onToggleFullscreen}
                        className="btn btn-sm btn-outline-secondary"
                        aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                    >
                        {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
                    </button>
                </div>
            </div>

            <div
                className="card-body overflow-auto p-0"
                style={{ height: previewHeight }}
            >
                {isRendering ? (
                    <div className="d-flex justify-content-center align-items-center h-100">
                        <div className="spinner-border text-primary me-2" role="status"></div>
                        <span>Carregando template...</span>
                    </div>
                ) : error ? (
                    <div className="alert alert-danger m-3">{error}</div>
                ) : (
                    <div className="d-flex justify-content-center p-3">
                        <div
                            style={{
                                transform: `scale(${zoomLevel / 100})`,
                                transformOrigin: 'top center',
                                width: '100%'
                            }}
                        >
                            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} className="border" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};