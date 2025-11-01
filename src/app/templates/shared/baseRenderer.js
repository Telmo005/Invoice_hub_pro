export default class BaseTemplateRenderer {
  render(html, invoiceData) {
    // Implementação base igual à mostrada acima
    // (todo o código do BaseTemplateRenderer)
    
    const data = invoiceData;
    const escapeHtml = (text) => {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const formatCurrency = (value, currency = 'MZN') => {
      if (typeof value !== 'number' || isNaN(value)) return `0.00 ${currency}`;
      return `${value.toFixed(2)} ${currency}`;
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';
      try {
        return new Date(dateString).toLocaleDateString('pt-BR');
      } catch (e) {
        return dateString;
      }
    };

    let renderedHtml = html;

    // ... (implementação completa do renderizador base)

    return renderedHtml;
  }

  // ... (métodos auxiliares)
}