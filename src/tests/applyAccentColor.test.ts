import { describe, it, expect } from 'vitest';
import { applyAccentColor } from '@/lib/document/applyAccentColor';

describe('applyAccentColor', () => {
  it('anexa um bloco <style> a sobrepor --accent-color para templates suportados', () => {
    const html = '<div class="t1-isolated">conteúdo</div>';
    for (const templateId of ['template-1', 'template-2', 'template-3', 'receipt-1', 'receipt-2']) {
      const result = applyAccentColor(html, templateId, '#ff0000');
      expect(result).toContain(html);
      expect(result).toContain('<style>');
      expect(result).toContain('--accent-color: #ff0000;');
    }
  });

  it('sobrepõe também --primary-color para o template legado receipt-2', () => {
    const html = '<div>conteúdo</div>';
    const result = applyAccentColor(html, 'receipt-2', '#ff0000');
    expect(result).toContain('--primary-color: #ff0000;');
  });

  it('não sobrepõe --primary-color para os outros templates', () => {
    const html = '<div>conteúdo</div>';
    const result = applyAccentColor(html, 'template-1', '#ff0000');
    expect(result).not.toContain('--primary-color');
  });

  it('devolve o html original sem alteração se não houver cor', () => {
    const html = '<div class="t1-isolated">conteúdo</div>';
    expect(applyAccentColor(html, 'template-1', null)).toBe(html);
    expect(applyAccentColor(html, 'template-1', undefined)).toBe(html);
  });

  it('devolve o html original para templates desconhecidos/não suportados', () => {
    const html = '<div class="x-isolated">conteúdo</div>';
    expect(applyAccentColor(html, 'template-desconhecido', '#ff0000')).toBe(html);
  });

  it('rejeita valores que não sejam hex de 6 dígitos válido (proteção contra injeção)', () => {
    const html = '<div class="t1-isolated">conteúdo</div>';
    expect(applyAccentColor(html, 'template-1', 'red')).toBe(html);
    expect(applyAccentColor(html, 'template-1', '#fff')).toBe(html); // 3 dígitos não aceite
    expect(applyAccentColor(html, 'template-1', '</style><script>alert(1)</script>')).toBe(html);
    expect(applyAccentColor(html, 'template-1', '#ff00zz')).toBe(html);
  });
});
