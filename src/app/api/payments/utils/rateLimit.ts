export const rateLimit = async (ip: string, cache: Map<string, number[]>): Promise<boolean> => {
    const now = Date.now();
    const windowMs = 60000; // 1 minuto
    const maxRequests = 10; // Máximo 10 requests por minuto

    const requests = cache.get(ip) || [];

    // Limpar requests antigos
    const recentRequests = requests.filter(time => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
        return false;
    }

    recentRequests.push(now);
    cache.set(ip, recentRequests);

    // Auto-limpeza (em produção usar Redis TTL)
    if (cache.size > 1000) {
        const keys = Array.from(cache.keys());
        for (let i = 0; i < 100; i++) {
            if (keys[i]) cache.delete(keys[i]);
        }
    }

    return true;
};