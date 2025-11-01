export function generateDataHash(data: any): string {
    const jsonString = JSON.stringify(data, (key, value) => {
        if (typeof value === 'number') {
            return value.toFixed(2); // Normalizar números
        }
        return value;
    });

    // Hash simples - em produção usar crypto.subtle.digest
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}