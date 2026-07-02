import { describe, it, expect } from 'vitest';
import { applyAccentColor } from '@/lib/document/applyAccentColor';

describe('applyAccentColor', () => {
  it('anexa um bloco <style> com a cor pedida para template-1', () => {
    const html = '<div class="t1-isolated">conteúdo</div>';
    const result = applyAccentColor(html, 'template-1', '#ff0000');
    expect(result).toContain(html);
    expect(result).toContain('<style>');
    expect(result).toContain('#ff0000');
    expect(result).toContain('.t1-isolated .invoice-title');
  });

  it('devolve o html original sem alteração se não houver cor', () => {
    const html = '<div class="t1-isolated">conteúdo</div>';
    expect(applyAccentColor(html, 'template-1', null)).toBe(html);
    expect(applyAccentColor(html, 'template-1', undefined)).toBe(html);
  });

  it('devolve o html original para templates ainda não suportados', () => {
    const html = '<div class="t2-isolated">conteúdo</div>';
    expect(applyAccentColor(html, 'template-2', '#ff0000')).toBe(html);
    expect(applyAccentColor(html, 'receipt-1', '#ff0000')).toBe(html);
  });

  it('rejeita valores que não sejam hex de 6 dígitos válido (proteção contra injeção)', () => {
    const html = '<div class="t1-isolated">conteúdo</div>';
    expect(applyAccentColor(html, 'template-1', 'red')).toBe(html);
    expect(applyAccentColor(html, 'template-1', '#fff')).toBe(html); // 3 dígitos não aceite
    expect(applyAccentColor(html, 'template-1', '</style><script>alert(1)</script>')).toBe(html);
    expect(applyAccentColor(html, 'template-1', '#ff00zz')).toBe(html);
  });
});
