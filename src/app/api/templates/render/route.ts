// src/app/api/templates/render/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Diretórios dos templates
const TEMPLATES_DIRS = {
  invoice: path.join(process.cwd(), 'src/app/templates/invoice'),
  quotation: path.join(process.cwd(), 'src/app/templates/quotation')
};

interface DocumentData {
  formData: {
    emitente?: any;
    destinatario?: any;
    faturaNumero?: string;
    cotacaoNumero?: string;
    dataFatura?: string;
    dataVencimento?: string;
    ordemCompra?: string;
    metodoPagamento?: string;
    moeda?: string;
    termos?: string;
    validezCotacao?: number;
    desconto?: string; // ADICIONADO: propriedade desconto
  };
  items: any[];
  totais: any;
  tipoDocumento?: 'invoice' | 'quotation';
}

class TemplateService {
  private getTemplateDir(tipo: 'invoice' | 'quotation'): string {
    return TEMPLATES_DIRS[tipo];
  }

  async loadTemplate(templateId: string, tipo: 'invoice' | 'quotation'): Promise<string> {
    if (!this.isValidTemplateId(templateId)) {
      throw new Error('ID de template inválido');
    }

    const templateDir = this.getTemplateDir(tipo);
    const filePath = path.join(templateDir, `${templateId}.html`);
    return await fs.readFile(filePath, 'utf-8');
  }

  isValidTemplateId(templateId: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(templateId);
  }

  validateDocumentData(data: any, tipo: 'invoice' | 'quotation'): boolean {
    const baseValidation = data?.formData && Array.isArray(data?.items) && typeof data?.totais === 'object';
    
    if (tipo === 'invoice') {
      return baseValidation && !!data.formData.faturaNumero;
    } else {
      return baseValidation && !!data.formData.cotacaoNumero;
    }
  }

  /**
   * RENDERIZADOR UNIVERSAL - Para faturas e cotações
   */
  renderTemplate(html: string, documentData: DocumentData): string {
    const data = documentData;
    const tipo = data.tipoDocumento || 'invoice';

    // FUNÇÃO OBRIGATÓRIA: Escape HTML completo
    const escapeHtml = (text: any) => {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\//g, '&#x2F;');
    };

    const formatCurrency = (value: number, currency: string = 'MZN') => {
      if (typeof value !== 'number' || isNaN(value)) return `0,00 ${currency}`;
      const formattedValue = value.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
      return `${formattedValue} ${currency}`;
    };

    const formatDate = (dateString: string | undefined) => {
      if (!dateString) return '';
      try {
        return new Date(dateString).toLocaleDateString('pt-BR');
      } catch (_e) {
          return dateString;
        }
    };

    let renderedHtml = html;

    try {
      // ========== MAPEAMENTO SEGURO DOS DADOS ==========

      // 1. DADOS DO EMITENTE (comum a ambos)
      if (data.formData?.emitente) {
        const e = data.formData.emitente;

        const emitenteMappings = {
          'emitente-nomeEmpresa': e.nomeEmpresa || ' ',
          'emitente-endereco': [e.bairro, e.cidade, e.pais].filter(Boolean).join(', ') || ' ',
          'emitente-cidade-pais': [e.cidade, e.pais].filter(Boolean).join(' - ') || '',
          'emitente-contato': [e.telefone ? `Tel: ${e.telefone}` : ' ', e.email || ' '].filter(Boolean).join(' | ') || ' ',
          'emitente-documento': e.documento || ' ',
          'emitente-email': e.email || ' ',
          'emitente-telefone': e.telefone || ' ',
          'emitente-pais': e.pais || ' ',
          'emitente-cidade': e.cidade || ' ',
          'emitente-bairro': e.bairro || ' '
        };

        for (const [id, value] of Object.entries(emitenteMappings)) {
          if (value) {
            renderedHtml = this.replaceElementContent(renderedHtml, id, escapeHtml(value));
          }
        }

        // Versões específicas para cartões
        renderedHtml = this.replaceElementContent(renderedHtml, 'emitente-nomeEmpresa-card', escapeHtml(e.nomeEmpresa || ' '));
        renderedHtml = this.replaceElementContent(renderedHtml, 'emitente-endereco-card', escapeHtml([e.bairro, e.cidade, e.pais].filter(Boolean).join(', ') || ' '));
        renderedHtml = this.replaceElementContent(renderedHtml, 'emitente-contato-card', escapeHtml(e.telefone || e.email || ' '));
        renderedHtml = this.replaceElementContent(renderedHtml, 'emitente-documento-card', escapeHtml(e.documento || ' '));
      }

      // 2. DADOS DO DESTINATÁRIO (comum a ambos)
      if (data.formData?.destinatario) {
        const d = data.formData.destinatario;

        const destinatarioMappings = {
          'destinatario-nomeCompleto': d.nomeCompleto || ' ',
          'destinatario-endereco': [d.cidade, d.pais].filter(Boolean).join(' - '),
          'destinatario-contato': [d.telefone ? `Tel: ${d.telefone}` : ' ', d.email || ' '].filter(Boolean).join(' | '),
          'destinatario-documento': d.documento || ' ',
          'destinatario-email': d.email || ' ',
          'destinatario-telefone': d.telefone || ' ',
          'destinatario-pais': d.pais || ' ',
          'destinatario-cidade': d.cidade || ' ',
          'destinatario-bairro': d.bairro || ' '
        };

        for (const [id, value] of Object.entries(destinatarioMappings)) {
          if (value) {
            renderedHtml = this.replaceElementContent(renderedHtml, id, escapeHtml(value));
          }
        }
      }

      // 3. CABEÇALHO DO DOCUMENTO (diferenciado por tipo)
      if (data.formData) {
        const f = data.formData;
        
        // Mapeamentos comuns
        const commonMappings = {
          'data-documento': formatDate(f.dataFatura),
          'data-documento-display': 'Data: ' + formatDate(f.dataFatura),
          'data-vencimento': formatDate(f.dataVencimento),
          'ordem-compra': f.ordemCompra || ' ',
          'metodo-pagamento': f.metodoPagamento || ' ',
          'moeda-pagamento': f.moeda || ' ',
          'termos-pagamento': f.termos || ' ',
          'desconto': f.desconto || '0' // AGORA VÁLIDO: propriedade existe na interface
        };

        // Mapeamentos específicos por tipo
        if (tipo === 'invoice') {
          const invoiceMappings = {
            'fatura-numero': f.faturaNumero || ' ',
            'fatura-numero-display': `Nº: ${f.faturaNumero || ''}`,
            'fatura-data-display': `Data: ${formatDate(f.dataFatura) || ''}`,
            'documento-numero': f.faturaNumero || ' ',
            'documento-numero-display': `Nº: ${f.faturaNumero || ''}`
          };
          
          Object.assign(commonMappings, invoiceMappings);
        } else {
          const quotationMappings = {
            'cotacao-numero': f.cotacaoNumero || ' ',
            'cotacao-numero-display': `Nº: ${f.cotacaoNumero || ''}`,
            'validez-cotacao': f.validezCotacao ? `${f.validezCotacao} dias` : ' ',
            'documento-numero': f.cotacaoNumero || ' ',
            'documento-numero-display': `Nº: ${f.cotacaoNumero || ''}`
          };
          
          Object.assign(commonMappings, quotationMappings);
        }

        for (const [id, value] of Object.entries(commonMappings)) {
          if (value) {
            renderedHtml = this.replaceElementContent(renderedHtml, id, escapeHtml(value));
          }
        }

        // Título do documento baseado no tipo
        const documentTitle = tipo === 'invoice' ? 'FATURA' : 'COTAÇÃO';
        renderedHtml = this.replaceElementContent(renderedHtml, 'documento-titulo', documentTitle);
        renderedHtml = this.replaceElementContent(renderedHtml, 'titulo-documento', documentTitle);
      }

      // 4. ITENS DA TABELA - COM LIMITE DE SEGURANÇA (comum a ambos)
      if (data.items && Array.isArray(data.items)) {
        const moeda = data.formData?.moeda || 'MZN';
        let itemsHtml = '';

        // PROTEÇÃO CRÍTICA: limita número de itens
        const safeItems = data.items.slice(0, 500); // Máximo 500 itens

        safeItems.forEach((item: any) => {
          const precoUnitario = item.precoUnitario || 0;
          const quantidade = item.quantidade || 0;
          const subtotalItem = precoUnitario * quantidade;

          // Calcular taxas
          let totalTaxas = 0;
          let taxasTexto = '';

          if (item.taxas && Array.isArray(item.taxas)) {
            // Limita também o número de taxas por item
            const safeTaxas = item.taxas.slice(0, 10);
            taxasTexto = safeTaxas.map((taxa: any) => {
              let valorTaxa = 0;
              let taxaDisplay = '';
              if (taxa.tipo === 'percent') {
                valorTaxa = (subtotalItem * (taxa.valor || 0)) / 100;
                taxaDisplay = `${escapeHtml(taxa.nome)}: ${taxa.valor}% (${formatCurrency(valorTaxa, moeda)})`;
              } else {
                valorTaxa = taxa.valor || 0;
                taxaDisplay = `${escapeHtml(taxa.nome)}: ${formatCurrency(valorTaxa, moeda)}`;
              }
              totalTaxas += valorTaxa;
              return taxaDisplay;
            }).join('<br>');
          }

          const totalItem = subtotalItem + totalTaxas;

          itemsHtml += `
            <tr>
              <td class="text-center">${escapeHtml(quantidade.toString())}</td>
              <td>${escapeHtml(item.descricao || 'Item sem descrição')}</td>
              <td class="text-right">${formatCurrency(precoUnitario, moeda)}</td>
              <td class="text-right">${taxasTexto || '0,00'}</td>
              <td class="text-right">${formatCurrency(totalItem, moeda)}</td>
            </tr>
          `;
        });

        if (safeItems.length === 0) {
          itemsHtml = `<tr><td colspan="5" style="text-align: center;">Nenhum item encontrado</td></tr>`;
        }

        // Substitui o tbody dos itens
        renderedHtml = renderedHtml.replace(
          /<tbody[^>]*id="items-tbody"[^>]*>[\s\S]*?<\/tbody>/,
          `<tbody id="items-tbody">${itemsHtml}</tbody>`
        );
      }

      // 5. TOTAIS E TAXAS (comum a ambos)
      if (data.totais) {
        const moeda = data.formData?.moeda || 'MZN';
        const totaisMappings = {
          'subtotal': formatCurrency(data.totais.subtotal || 0, moeda),
          'desconto': formatCurrency(data.totais.desconto || 0, moeda),
          'total-final': formatCurrency(data.totais.totalFinal || 0, moeda),
          'taxas-total': formatCurrency(data.totais.totalTaxas || 0, moeda),
          'total-final-balance': formatCurrency(data.totais.totalFinal || 0, moeda),
          'total-final-card': formatCurrency(data.totais.totalFinal || 0, moeda)
        };

        for (const [id, value] of Object.entries(totaisMappings)) {
          renderedHtml = this.replaceElementContent(renderedHtml, id, value);
        }

        // Taxas detalhadas
        if (data.totais.taxasDetalhadas && Array.isArray(data.totais.taxasDetalhadas)) {
          let taxasHtml = '';
          // Limita número de taxas detalhadas
          const safeTaxas = data.totais.taxasDetalhadas.slice(0, 10);
          safeTaxas.forEach((taxa: any) => {
            if (taxa.valor && taxa.valor !== 0) {
              taxasHtml += `
                <p><strong>${escapeHtml(taxa.nome || 'Taxa')}:</strong> ${formatCurrency(taxa.valor, moeda)}</p>
              `;
            }
          });

          if (taxasHtml) {
            renderedHtml = renderedHtml.replace(
              /<div[^>]*id="taxas-container"[^>]*>[\s\S]*?<\/div>/,
              `<div id="taxas-container">${taxasHtml}</div>`
            );
          }
        }
      }

      // 6. CAMPOS DE PAGAMENTO (fallbacks - principalmente para faturas)
      const paymentFallbacks = {
        'banco-pagamento': 'Não informado',
        'conta-pagamento': 'Não informado',
        'moeda-pagamento': data.formData?.moeda || 'MZN'
      };

      for (const [id, value] of Object.entries(paymentFallbacks)) {
        if (!renderedHtml.includes(`id="${id}">`)) continue;
        const currentContent = this.getElementContent(renderedHtml, id);
        if (!currentContent || currentContent.includes('Carregando')) {
          renderedHtml = this.replaceElementContent(renderedHtml, id, escapeHtml(value));
        }
      }

      // 7. CAMPOS ESPECÍFICOS PARA COTAÇÕES
      if (tipo === 'quotation' && data.formData?.validezCotacao) {
        const validezMappings = {
          'validez-cotacao': `${data.formData.validezCotacao} dias`,
          'validez-documento': `Válida por ${data.formData.validezCotacao} dias`,
          'validez-display': `Esta cotação é válida por ${data.formData.validezCotacao} dias`
        };

        for (const [id, value] of Object.entries(validezMappings)) {
          if (value) {
            renderedHtml = this.replaceElementContent(renderedHtml, id, escapeHtml(value));
          }
        }
      }

    } catch (error) {
      console.error('Erro durante renderização:', error);
      // Em caso de erro, retorna o HTML original
      return html;
    }

    return renderedHtml;
  }

  /**
   * Substitui o conteúdo de qualquer elemento pelo ID
   */
  private replaceElementContent(html: string, elementId: string, content: string): string {
    // Verifica se o elementId é seguro
    if (!/^[a-zA-Z0-9_-]+$/.test(elementId)) {
      return html;
    }

    // Regex para encontrar o elemento pelo ID
    const regex = new RegExp(
      `(<[^>]*\\sid\\s*=\\s*["']${elementId}["'][^>]*>)([^<]*)(<\\/\\s*[^>]*>)`,
      'gi'
    );

    const result = html.replace(regex, `$1${content}$3`);

    // Fallback para elementos sem tag de fechamento explícita
    if (result === html) {
      const fallbackRegex = new RegExp(
        `id=["']${elementId}["'][^>]*>([^<]*)<`,
        'gi'
      );
      return html.replace(fallbackRegex, `id="${elementId}">${content}<`);
    }

    return result;
  }

  /**
   * Obtém o conteúdo atual de um elemento pelo ID (para verificação)
   */
  private getElementContent(html: string, elementId: string): string {
    const regex = new RegExp(
      `id=["']${elementId}["'][^>]*>([^<]*)<`,
      'gi'
    );
    const match = regex.exec(html);
    return match ? match[1] : '';
  }
}

const templateService = new TemplateService();

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');
    const tipo = searchParams.get('tipo') as 'invoice' | 'quotation' || 'invoice';

    if (!templateId) {
      return NextResponse.json({ error: 'ID do template não fornecido' }, { status: 400 });
    }

    // VALIDAÇÃO CRÍTICA: verifica templateId antes de usar
    if (!templateService.isValidTemplateId(templateId)) {
      return NextResponse.json({ error: 'ID de template inválido' }, { status: 400 });
    }

    // VALIDAÇÃO: verifica tipo de documento
    if (tipo !== 'invoice' && tipo !== 'quotation') {
      return NextResponse.json({ error: 'Tipo de documento inválido. Use "invoice" ou "quotation"' }, { status: 400 });
    }

    const requestData = await request.json();
    const documentData: DocumentData = {
      ...requestData?.documentData,
      tipoDocumento: tipo
    };

    if (!documentData) {
      return NextResponse.json({ error: 'Dados do documento não fornecidos' }, { status: 400 });
    }

    if (!templateService.validateDocumentData(documentData, tipo)) {
      return NextResponse.json({ error: 'Dados do documento incompletos ou inválidos' }, { status: 400 });
    }

    const templateHtml = await templateService.loadTemplate(templateId, tipo);
    const renderedHtml = templateService.renderTemplate(templateHtml, documentData);

    return new NextResponse(renderedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, max-age=0',
      },
    });

  } catch (error) {
    console.error('Erro ao processar requisição POST:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes('inválido')) {
      return NextResponse.json({ error: 'Template inválido' }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get('id');
  const tipo = searchParams.get('tipo') as 'invoice' | 'quotation' || 'invoice';

  if (!templateId) {
    return NextResponse.json({
      status: 'healthy',
      message: 'Template API is running',
      supported_types: ['invoice', 'quotation']
    });
  }

  // VALIDAÇÃO CRÍTICA: verifica templateId antes de usar
  if (!templateService.isValidTemplateId(templateId)) {
    return NextResponse.json({
      status: 'invalid_template_id',
      templateId,
    }, { status: 400 });
  }

  // VALIDAÇÃO: verifica tipo de documento
  if (tipo !== 'invoice' && tipo !== 'quotation') {
    return NextResponse.json({
      status: 'invalid_document_type',
      message: 'Tipo de documento inválido. Use "invoice" ou "quotation"'
    }, { status: 400 });
  }

  try {
    await templateService.loadTemplate(templateId, tipo);
    return NextResponse.json({
      status: 'template_exists',
      templateId,
      tipo,
    });
  } catch {
    return NextResponse.json({
      status: 'template_not_found',
      templateId,
      tipo,
    }, { status: 404 });
  }
}