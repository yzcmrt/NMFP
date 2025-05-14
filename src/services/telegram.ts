import TelegramBot from 'node-telegram-bot-api';
import { Message } from 'node-telegram-bot-api';
import { config } from 'dotenv';

config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is not defined');
}

const bot = new TelegramBot(token, { polling: true });

// Komutlar
bot.onText(/\/start/, (msg: Message) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'NMFP Bot\'a hoş geldiniz! 🚗\n\nKomutlar:\n/help - Yardım menüsü\n/channel - Duyuru kanalı');
});

bot.onText(/\/help/, (msg: Message) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Yardım Menüsü 📚\n\n/start - Bot\'u başlat\n/help - Bu menüyü göster\n/channel - Duyuru kanalı');
});

// Duyuru kanalı
bot.onText(/\/channel/, (msg: Message) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'NMFP Duyuru Kanalı 📢\n\nhttps://t.me/needmoneyforporschewtf\n\nEn güncel duyurular ve haberler için kanalımıza katılın!');
});

// Hata yakalama
bot.on('polling_error', (error: Error) => {
  console.error('Telegram bot polling error:', error);
});

export default bot; 