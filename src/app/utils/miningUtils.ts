/**
 * Mining işlemleri için yardımcı fonksiyonlar
 */

/**
 * Kalan süreyi saat:dakika:saniye formatında biçimlendirir
 * @param timeLeftInMs Kalan süre (milisaniye)
 * @returns Formatlanmış süre (hh:mm:ss)
 */
export function formatTimeLeft(timeLeftInMs: number): string {
  if (timeLeftInMs <= 0) {
    return '00:00:00';
  }
  
  const hours = Math.floor(timeLeftInMs / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeftInMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeftInMs % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * İki zaman arasındaki ilerleme yüzdesini hesaplar
 * @param startTime Başlangıç zamanı (timestamp)
 * @param endTime Bitiş zamanı (timestamp)
 * @param currentTime Şu anki zaman (timestamp, default: Date.now())
 * @returns İlerleme yüzdesi (0-100)
 */
export function calculateProgress(
  startTime: number, 
  endTime: number, 
  currentTime: number = Date.now()
): number {
  const total = endTime - startTime;
  const elapsed = currentTime - startTime;
  const percentage = (elapsed / total) * 100;
  
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Belirli bir bitiş zamanına kalan süreyi hesaplar
 * @param endTime Bitiş zamanı (timestamp)
 * @returns Kalan süre (milisaniye)
 */
export function calculateRemainingTime(endTime: number): number {
  const now = Date.now();
  return Math.max(0, endTime - now);
}

/**
 * Mining oturumu için zamanlayıcı kurar
 * @param endTime Son tarih/saat
 * @param onTick Her saniye yenilendiğinde çağrılacak fonksiyon
 * @param onComplete Süre dolduğunda çağrılacak fonksiyon
 * @param startTime Başlangıç zamanı (default: şu an)
 * @returns Zamanlayıcı referansı (clearInterval için)
 */
export function setupTimer(
  endTime: Date,
  onTick: (timeLeft: string, progress: number) => void,
  onComplete: () => void,
  startTime: Date = new Date()
): NodeJS.Timeout {
  const calculateTimeLeft = () => {
    const now = new Date();
    const endTimeMs = endTime.getTime();
    const startTimeMs = startTime.getTime();
    
    // Mining tamamlanmış mı kontrol et
    if (now >= endTime) {
      onTick('00:00:00', 100);
      onComplete();
      return;
    }
    
    // Kalan süreyi hesapla
    const remainingTimeMs = endTimeMs - now.getTime();
    const formattedTimeLeft = formatTimeLeft(remainingTimeMs);
    
    // İlerleme yüzdesini hesapla
    const progress = calculateProgress(startTimeMs, endTimeMs, now.getTime());
    
    onTick(formattedTimeLeft, progress);
  };
  
  // İlk çağrı
  calculateTimeLeft();
  
  // Zamanlayıcıyı kur
  return setInterval(calculateTimeLeft, 1000);
}

/**
 * Mining ödülünü hesaplar
 * @param miningPower Mining gücü
 * @param durationHours Mining süresi (saat)
 * @param bonusMultiplier Bonus çarpanı (varsayılan: 1)
 * @returns Hesaplanan ödül miktarı
 */
export function calculateMiningReward(
  miningPower: number,
  durationHours: number,
  bonusMultiplier: number = 1
): number {
  const baseHourlyRate = miningPower / 60; // Her 60 mining gücü için saatte 1 NMFP
  return baseHourlyRate * durationHours * bonusMultiplier;
}

/**
 * Mining toastları için mesaj oluşturur
 * @param action İşlem tipi ('start', 'complete', 'collect')
 * @param reward Kazanılan ödül (opsiyonel)
 * @returns Toast mesajı
 */
export function createMiningToastMessage(
  action: 'start' | 'complete' | 'collect',
  reward?: number
): string {
  switch (action) {
    case 'start':
      return 'Mining başarıyla başlatıldı!';
    case 'complete':
      return 'Mining tamamlandı! Ödülünüzü toplayabilirsiniz.';
    case 'collect':
      return reward 
        ? `${reward.toFixed(2)} NMFP kazandınız!` 
        : 'Ödülünüz toplandı!';
    default:
      return 'Mining işlemi gerçekleştirildi.';
  }
}

/**
 * Araç bakım maliyetini hesaplar
 * @param currentCondition Mevcut durum yüzdesi (0-100)
 * @param costPerUnit Birim başına maliyet (varsayılan: 0.5)
 * @returns Bakım maliyeti
 */
export function calculateMaintenanceCost(
  currentCondition: number,
  costPerUnit: number = 0.5
): number {
  const neededMaintenance = 100 - Math.max(0, Math.min(100, currentCondition));
  return neededMaintenance * costPerUnit;
}

/**
 * Araç yakıt doldurma maliyetini hesaplar
 * @param currentFuel Mevcut yakıt yüzdesi (0-100)
 * @param costPerUnit Birim başına maliyet (varsayılan: 0.2)
 * @returns Yakıt doldurma maliyeti
 */
export function calculateFuelCost(
  currentFuel: number,
  costPerUnit: number = 0.2
): number {
  const neededFuel = 100 - Math.max(0, Math.min(100, currentFuel));
  return neededFuel * costPerUnit;
}

/**
 * Mining durumu UI renk sınıflarını döndürür
 * @param status Mining durumu ('idle', 'mining', 'completed', 'waiting')
 * @returns UI sınıfları objesi
 */
export function getMiningStatusClasses(status: 'idle' | 'mining' | 'completed' | 'waiting'): {
  text: string;
  bg: string;
  border: string;
  progress: string;
} {
  switch (status) {
    case 'idle':
      return {
        text: 'text-gray-400',
        bg: 'bg-[#1a1a2e]/70',
        border: 'border-[#2a3855]/50',
        progress: 'from-gray-600 to-gray-400'
      };
    case 'mining':
      return {
        text: 'text-[#2ff7c1]',
        bg: 'bg-[#1a1a2e]/70',
        border: 'border-[#2a3855]/50',
        progress: 'from-[#2f7bf7] via-[#5f40f8] to-[#7b2ff7]'
      };
    case 'completed':
      return {
        text: 'text-[#2ff7c1]',
        bg: 'bg-[#1a1a2e]/70',
        border: 'border-[#2ff7c1]/20',
        progress: 'from-[#2ff7c1] to-[#5ff7d5]'
      };
    case 'waiting':
      return {
        text: 'text-yellow-400',
        bg: 'bg-[#1a1a2e]/70',
        border: 'border-yellow-500/20',
        progress: 'from-yellow-600 to-yellow-400'
      };
    default:
      return {
        text: 'text-gray-400',
        bg: 'bg-[#1a1a2e]/70',
        border: 'border-[#2a3855]/50',
        progress: 'from-gray-600 to-gray-400'
      };
  }
} 