export const formatCurrency = (value, options = {}) => {
  const number = Number(value) || 0;
  const defaultOptions = {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  };
  const formatter = new Intl.NumberFormat(undefined, { ...defaultOptions, ...options });
  return formatter.format(number);
};

export default formatCurrency;
