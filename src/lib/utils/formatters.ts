export const formatCurrency = (value: number, currency: string = 'MZN'): string => {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0,00';
    }

    try {
        return new Intl.NumberFormat('pt-MZ', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
        }).format(value);
    } catch (error) {
        // Fallback para formatação básica
        return `${value.toFixed(2)} ${currency}`;
    }
};

export const formatDate = (dateString: string): string => {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-MZ');
    } catch (error) {
        return dateString;
    }
};