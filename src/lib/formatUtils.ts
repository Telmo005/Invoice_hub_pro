export const formatCurrency = (value: number, currency: string): string => {
  const formattedValue = Math.abs(value).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  switch (currency.toUpperCase()) {
    case 'MZN':
      return `${formattedValue} MT`; // Exibe apenas "MT" no final
    case 'USD':
      return `$${formattedValue}`;
    case 'EUR':
      return `€${formattedValue}`;
    case 'BRL':
      return `R$${formattedValue}`;
    default:
      return `${currency} ${formattedValue}`; // Para outras moedas (ex: "KZT 1.000,00")
  }
};
