import { TemplateRegistry } from './templateRegistry';
import { InvoiceData } from '@/types/invoice-types';

export class TemplateRenderer {
  private templateRegistry: TemplateRegistry;

  constructor() {
    this.templateRegistry = TemplateRegistry.getInstance();
  }

  render(templateId: string, html: string, invoiceData: InvoiceData): string {
    const templateConfig = this.templateRegistry.getTemplate(templateId);
    
    if (!templateConfig) {
      throw new Error(`Template '${templateId}' não encontrado`);
    }

    return templateConfig.renderer(html, invoiceData);
  }

  validateTemplate(templateId: string): boolean {
    return this.templateRegistry.getTemplate(templateId) !== undefined;
  }
}