/**
 * Para birimi formatlama fonksiyonu
 * @param value Formatlanacak sayı
 * @param currency Para birimi sembolü (varsayılan: boş)
 * @returns Formatlanmış para birimi
 */
export function formatCurrency(value: number, currency: string = ''): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value) + (currency ? ` ${currency}` : '');
}

/**
 * Sayı formatlama fonksiyonu
 * @param value Formatlanacak sayı
 * @returns Formatlanmış sayı
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value);
} 