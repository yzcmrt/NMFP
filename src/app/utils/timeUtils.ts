/**
 * Madencilik süreçleri için zamanlayıcı ve süre formatlaması yardımcı fonksiyonları
 */

/**
 * Kalan süreyi saat:dakika:saniye formatında formatlar
 * @param remaining Kalan milisaniye süresi
 * @returns Formatlanmış süre string'i (HH:MM:SS)
 */
export const formatTimeLeft = (remaining: number): string => {
  // Negatif değerleri sıfıra çevir
  const timeLeft = Math.max(remaining, 0);
  
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Başlangıç ve bitiş süreleri arasındaki ilerlemeyi hesaplar
 * @param startTime Başlangıç zamanı (Date veya ISO string)
 * @param endTime Bitiş zamanı (Date veya ISO string)
 * @returns 0-100 arasında ilerleme yüzdesi
 */
export const calculateProgress = (startTime: Date | string, endTime: Date | string): number => {
  const start = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime.getTime();
  const end = typeof endTime === 'string' ? new Date(endTime).getTime() : endTime.getTime();
  const now = new Date().getTime();
  
  // Toplam süre
  const total = end - start;
  
  // Eğer toplam süre 0 veya negatifse % 0 döndür
  if (total <= 0) return 0;
  
  // Geçen süre
  const elapsed = now - start;
  
  // İlerleme yüzdesi (0-100 arasında sınırlandır)
  return Math.min(Math.max((elapsed / total) * 100, 0), 100);
};

/**
 * İki tarih arasında kalan süreyi hesaplar
 * @param endTime Bitiş zamanı (Date veya ISO string)
 * @returns Kalan milisaniye süresi
 */
export const calculateRemainingTime = (endTime: Date | string): number => {
  const end = typeof endTime === 'string' ? new Date(endTime).getTime() : endTime.getTime();
  const now = new Date().getTime();
  
  return Math.max(end - now, 0);
};

/**
 * Zamanlayıcı için callback fonksiyonu
 * @param endTime Bitiş zamanı (Date veya ISO string)
 * @param onTick Her zamanlayıcı tick'inde çağrılacak callback
 * @param onComplete Zamanlayıcı tamamlandığında çağrılacak callback
 * @returns Zamanlayıcıyı temizleyen fonksiyon
 */
export const setupTimer = (
  endTime: Date | string, 
  onTick: (timeLeft: string, progress: number) => void,
  onComplete: () => void
): () => void => {
  // İlk çağrı hemen
  const tick = () => {
    const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
    const now = new Date();
    
    // Eğer bitiş zamanı geçtiyse
    if (now >= end) {
      onTick('00:00:00', 100);
      onComplete();
      return;
    }
    
    // Kalan süreyi hesapla
    const remaining = end.getTime() - now.getTime();
    const timeLeftStr = formatTimeLeft(remaining);
    
    // İlerlemeyi hesapla
    const totalDuration = end.getTime() - (end.getTime() - 8 * 60 * 60 * 1000); // 8 saat varsayılan
    const elapsed = totalDuration - remaining;
    const progress = (elapsed / totalDuration) * 100;
    
    onTick(timeLeftStr, Math.min(100, progress));
  };
  
  // İlk çağrıyı hemen yap
  tick();
  
  // Zamanlayıcıyı kur
  const interval = setInterval(tick, 1000);
  
  // Temizleme fonksiyonunu döndür
  return () => clearInterval(interval);
}; 