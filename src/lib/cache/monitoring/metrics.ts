export interface MetricsCollector {
    increment(metric: string, tags?: Record<string, string>): void;
    timing(metric: string, duration: number, tags?: Record<string, string>): void;
    gauge(metric: string, value: number, tags?: Record<string, string>): void;
}

export class ConsoleMetricsCollector implements MetricsCollector {
    increment(metric: string, tags?: Record<string, string>): void {
        console.log(`[METRIC] ${metric}`, tags || '');
    }

    timing(metric: string, duration: number, tags?: Record<string, string>): void {
        console.log(`[TIMING] ${metric}: ${duration}ms`, tags || '');
    }

    gauge(metric: string, value: number, tags?: Record<string, string>): void {
        console.log(`[GAUGE] ${metric}: ${value}`, tags || '');
    }
}

export class TemplateMetrics {
    private static instance: TemplateMetrics;
    private collector: MetricsCollector;

    private constructor() {
        this.collector = new ConsoleMetricsCollector();
        // Em produção: new DatadogMetricsCollector() ou new PrometheusMetricsCollector()
    }

    static getInstance(): TemplateMetrics {
        if (!TemplateMetrics.instance) {
            TemplateMetrics.instance = new TemplateMetrics();
        }
        return TemplateMetrics.instance;
    }

    trackRenderStart(templateId: string): () => void {
        const start = performance.now();

        return () => {
            const duration = performance.now() - start;
            this.collector.timing('template.render.duration', duration, { templateId });
            this.collector.increment('template.render.count', { templateId, status: 'success' });
        };
    }

    trackRenderError(templateId: string, error: string): void {
        this.collector.increment('template.render.count', {
            templateId,
            status: 'error',
            error_type: error
        });
    }

    trackCacheHit(templateId: string, cacheType: 'template' | 'render'): void {
        this.collector.increment('template.cache.hit', { templateId, cache_type: cacheType });
    }

    trackCacheMiss(templateId: string, cacheType: 'template' | 'render'): void {
        this.collector.increment('template.cache.miss', { templateId, cache_type: cacheType });
    }

    setActiveTemplates(count: number): void {
        this.collector.gauge('template.active.count', count);
    }
}