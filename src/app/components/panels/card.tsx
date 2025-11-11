import React from 'react';
import { FiCheck, FiAward } from 'react-icons/fi';
import { Template } from '@/types/template-types';

interface TemplateCardProps {
    template: Template;
    isSelected: boolean;
    onSelect: (id: string) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
    template,
    isSelected,
    onSelect
}) => {
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.target as HTMLImageElement;
        target.onerror = null;
        target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22300%22%20height%3D%22150%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20300%20150%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_18945b7b3b5%20text%20%7B%20fill%3A%23AAAAAA%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A15pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_18945b7b3b5%22%3E%3Crect%20width%3D%22300%22%20height%3D%22150%22%20fill%3D%22%23EEEEEE%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22110.5%22%20y%3D%2280.1%22%3E300x150%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';
    };

    return (
        <div
            className={`flex-shrink-0 position-relative ${template.thumbnail} rounded-3 p-3 cursor-pointer`}
            style={{
                width: '200px',
                minWidth: '200px',
                height: '250px',
                border: isSelected ? '3px solid #0d6efd' : '1px solid #dee2e6',
                transition: 'all 0.3s ease',
                flexShrink: 0
            }}
            onClick={() => onSelect(template.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(template.id)}
        >
            {template.premium && (
                <div className="position-absolute top-0 end-0 bg-warning text-white small rounded-pill px-2 py-1 d-flex align-items-center m-2">
                    <FiAward className="me-1" /> Premium
                </div>
            )}

            <div className="w-100 h-50 rounded mb-3 overflow-hidden">
                <img
                    src={template.imageUrl}
                    alt={`Template ${template.name}`}
                    className="w-100 h-100 object-cover rounded"
                    onError={handleImageError}
                />
            </div>

            <div className="text-center">
                <h6 className="fw-bold mb-1 text-truncate">{template.name}</h6>
                <p className="small text-muted text-truncate">{template.description}</p>
            </div>

            {isSelected && (
                <div className="position-absolute bottom-0 end-0 bg-primary text-white rounded-circle p-2 m-2">
                    <FiCheck size={14} />
                </div>
            )}
        </div>
    );
};