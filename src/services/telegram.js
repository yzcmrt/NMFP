const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is not defined');
}

// Bot'u oluştur
const bot = new TelegramBot(token, { 
  polling: true,
  filepath: false // Bu parametre longpolling için önemli
});

// Komutları temizle - BotFather'dan komutları kaldırmak için
const clearCommands = async () => {
  try {
    await bot.setMyCommands([]);
    console.log('Komutlar başarıyla temizlendi');
  } catch (error) {
    console.error('Komutlar temizlenirken hata oluştu:', error);
  }
};

// Uygulama başladığında komutları temizle
clearCommands();

// Varsayılan karşılama mesajı gönder ve web app butonunu göster
const sendWelcomeMessage = (chatId) => {
  // Web app butonu ile karşılama mesajı
  bot.sendMessage(
    chatId, 
    `👋 *Welcome to NMFP!*\n\nNeed Money For Porsche is a GameFi platform where you can earn while collecting Porsche cars.\n\nTap the button below to start:`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Launch GameFi App 🚀', web_app: { url: 'https://gamefi.needmoneyforporsche.wtf' } }]
        ]
      }
    }
  );
};

// Gelen tüm mesajları kontrol eden handler
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  console.log(`Mesaj alındı: ${JSON.stringify(msg)}`);
  
  // Herhangi bir mesaja aynı yanıtı ver (karşılama mesajı)
  sendWelcomeMessage(chatId);
});

// Hata yakalama
bot.on('polling_error', (error) => {
  console.error('Telegram bot polling hatası:', error);
});

// Debug için webhook bilgisi
bot.getWebHookInfo().then((info) => {
  console.log('Webhook bilgisi:', info);
}).catch(err => {
  console.error('Webhook bilgisi alınamadı:', err);
});

module.exports = bot; 