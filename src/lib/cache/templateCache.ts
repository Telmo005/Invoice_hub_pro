import { CacheStrategy, MemoryCacheStrategy } from './strategies';

export class TemplateCache {
    private static instance: TemplateCache;
    private cache: CacheStrategy<string>;
    private renderCache: CacheStrategy<string>;

    private constructor() {
        this.cache = new MemoryCacheStrategy<string>();
        this.renderCache = new MemoryCacheStrategy<string>();
    }

    static getInstance(): TemplateCache {
        if (!TemplateCache.instance) {
            TemplateCache.instance = new TemplateCache();
        }
        return TemplateCache.instance;
    }

    // Cache de templates HTML
    async getTemplate(templateId: string): Promise<string | null> {
        const key = `template:${templateId}`;
        return this.cache.get(key);
    }

    async setTemplate(templateId: string, html: string): Promise<void> {
        const key = `template:${templateId}`;
        await this.cache.set(key, html, 30 * 60 * 1000); // 30 minutes
    }

    // Cache de renders (mais curto devido aos dados dinâmicos)
    async getRenderedTemplate(templateId: string, dataHash: string): Promise<string | null> {
        const key = `render:${templateId}:${dataHash}`;
        return this.renderCache.get(key);
    }

    async setRenderedTemplate(templateId: string, dataHash: string, html: string): Promise<void> {
        const key = `render:${templateId}:${dataHash}`;
        await this.renderCache.set(key, html, 2 * 60 * 1000); // 2 minutes
    }

    async clearTemplate(templateId: string): Promise<void> {
        const key = `template:${templateId}`;
        await this.cache.delete(key);
    }

    async clearAll(): Promise<void> {
        await this.cache.clear();
        await this.renderCache.clear();
    }
}