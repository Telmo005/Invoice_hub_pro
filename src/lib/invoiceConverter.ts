export class InvoiceConverter {
  /**
   * Converte os dados do invoice para JSON
   */
  convertToJSON(invoiceData: any): string {
    if (!invoiceData) {
      throw new Error('Dados do invoice não fornecidos');
    }

    // Simplesmente converte o objeto completo para JSON
    return JSON.stringify(invoiceData, null, 2);
  }

  /**
   * Converte para objeto JavaScript (sem stringify)
   */
  convertToObject(invoiceData: any): any {
    if (!invoiceData) {
      throw new Error('Dados do invoice não fornecidos');
    }

    // Retorna o objeto diretamente (já está em formato de objeto)
    return invoiceData;
  }
}