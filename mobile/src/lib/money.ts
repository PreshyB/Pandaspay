export function formatMoney(minor: string | number, currency: string): string {
  const value = Number(minor) / 100;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(value);
}
