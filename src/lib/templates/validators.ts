import { InvoiceData } from '@/types/invoice-types';

export class TemplateValidator {
    static isValidTemplateId(id: string): boolean {
        return /^[a-zA-Z0-9_-]+$/.test(id);
    }

    static validateInvoiceData(data: any): data is InvoiceData {
        if (!data?.formData) return false;
        if (!data?.items || !Array.isArray(data.items)) return false;
        if (!data?.totais || typeof data.totais !== 'object') return false;

        // Validação mais rigorosa
        const requiredFields = ['emitente', 'destinatario', 'faturaNumero', 'dataFatura'];
        const hasRequiredFields = requiredFields.every(field =>
            data.formData[field] !== undefined && data.formData[field] !== null
        );

        return hasRequiredFields;
    }

    static validateHTML(html: string): boolean {
        if (!html || typeof html !== 'string') return false;
        if (html.trim().length === 0) return false;
        return true;
    }
}