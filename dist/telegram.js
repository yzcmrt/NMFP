"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var node_telegram_bot_api_1 = require("node-telegram-bot-api");
var dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
var token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not defined');
}
var bot = new node_telegram_bot_api_1.default(token, { polling: true });
// Komutlar
bot.onText(/\/start/, function (msg) {
    var chatId = msg.chat.id;
    bot.sendMessage(chatId, 'NMFP Bot\'a hoş geldiniz! 🚗\n\nKomutlar:\n/help - Yardım menüsü\n/channel - Duyuru kanalı');
});
bot.onText(/\/help/, function (msg) {
    var chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Yardım Menüsü 📚\n\n/start - Bot\'u başlat\n/help - Bu menüyü göster\n/channel - Duyuru kanalı');
});
// Duyuru kanalı
bot.onText(/\/channel/, function (msg) {
    var chatId = msg.chat.id;
    bot.sendMessage(chatId, 'NMFP Duyuru Kanalı 📢\n\nhttps://t.me/needmoneyforporschewtf\n\nEn güncel duyurular ve haberler için kanalımıza katılın!');
});
// Hata yakalama
bot.on('polling_error', function (error) {
    console.error('Telegram bot polling error:', error);
});
exports.default = bot;
