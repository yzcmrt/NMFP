// Telegram bot sunucusu
require('dotenv').config();

// Botun çalıştırılması
async function startBot() {
  try {
    console.log('Telegram bot başlatılıyor...');
    const bot = require('./src/services/telegram.js');
    console.log('Telegram bot başarıyla başlatıldı!');
    
    // Test mesajı gönderme (isteğe bağlı, kullanmak istiyorsanız chat ID'yi ekleyin)
    // Kendi chat ID'nizi öğrenmek için bottan gelen mesajların loglarına bakın
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) {
      setTimeout(() => {
        try {
          bot.sendMessage(adminChatId, 'Bot başarıyla başlatıldı! 🚀 Tüm sistemler çalışıyor.');
        } catch (err) {
          console.error('Test mesajı gönderilemedi:', err);
        }
      }, 5000); // 5 saniye bekle, bot tamamen başlatılsın
    }
    
    // Basit durum kontrolü
    setInterval(() => {
      try {
        // Bot'un aktif olup olmadığını kontrol et
        if (bot && typeof bot.getMe === 'function') {
          bot.getMe().then(botInfo => {
            console.log(`Bot aktif çalışıyor: ${botInfo.username}`);
          }).catch(err => {
            console.error('Bot durum kontrolünde hata:', err);
            // Hata durumunda botu yeniden başlatmayı deneyebiliriz
            restartBot();
          });
        } else {
          console.error('Bot nesnesi tanımlı değil veya getMe fonksiyonu bulunamadı!');
          restartBot();
        }
      } catch (e) {
        console.error('Durum kontrolü sırasında bir hata oluştu:', e);
      }
    }, 600000); // Her 10 dakikada bir kontrol et
  } catch (error) {
    console.error('Telegram bot başlatılırken hata oluştu:', error);
    // Hata durumunda 30 saniye sonra yeniden başlatmayı dene
    setTimeout(() => {
      console.log('Bot yeniden başlatılıyor...');
      startBot();
    }, 30000);
  }
}

// Bot'u yeniden başlat (gerektiğinde)
function restartBot() {
  console.log('Bot yeniden başlatılıyor...');
  try {
    // Mevcut modülü temizle ve yeniden yükle
    delete require.cache[require.resolve('./src/services/telegram.js')];
    const bot = require('./src/services/telegram.js');
    console.log('Bot başarıyla yeniden başlatıldı!');
  } catch (error) {
    console.error('Bot yeniden başlatılırken hata oluştu:', error);
  }
}

// Beklenmeyen hataları yakala
process.on('uncaughtException', (error) => {
  console.error('Beklenmeyen hata:', error);
  // Kritik hatada bile çalışmaya devam et, botu yeniden başlat
  restartBot();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('İşlenmeyen Promise reddi:', reason);
});

// Botu başlat
startBot(); 