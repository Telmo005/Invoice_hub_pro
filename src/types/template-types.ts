export interface Template {
    id: string;
    name: string;
    description: string;
    premium?: boolean;
    thumbnail: string;
    templateType: 'default' | 'minimal' | 'detailed';
    imageUrl: string;
}

export interface TemplateRenderState {
    html: string;
    isLoading: boolean;
    error: string | null;
}

export interface ZoomControls {
    level: number;
    min: number;
    max: number;
    step: number;
    default: number;
}

export interface TemplateNavigation {
    currentIndex: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
}