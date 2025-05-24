import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Güvenlik için doğrulama fonksiyonu
const verifyTelegramWebhook = (data: any, botToken: string): boolean => {
  // Telegram bot tokenini kontrol et
  if (!botToken || botToken.length < 10) {
    console.error('BOT_TOKEN eksik veya geçersiz');
    return false;
  }

  // Burada daha detaylı doğrulama yapabilirsiniz
  // Örnek: Telegram'dan gelen bir başlık veya token kontrolü
  
  return true;
};

export async function POST(request: Request) {
  try {
    // Bot tokenini al
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { success: false, message: 'Bot token eksik' },
        { status: 401 }
      );
    }

    // Webhook verilerini al
    const webhookData = await request.json();
    console.log('Gelen Telegram webhook verisi:', webhookData);

    // Webhook doğrulama
    if (!verifyTelegramWebhook(webhookData, botToken)) {
      return NextResponse.json(
        { success: false, message: 'Webhook doğrulanamadı' },
        { status: 401 }
      );
    }

    // Mesaj veya callback_query'i kontrol et
    if (webhookData.message) {
      return handleTelegramMessage(webhookData.message);
    } else if (webhookData.callback_query) {
      return handleTelegramCallback(webhookData.callback_query);
    }

    // Ne mesaj ne de callback yoksa
    return NextResponse.json({ success: true, message: 'İşlenecek veri bulunamadı' });
  } catch (error: any) {
    console.error('Telegram webhook hatası:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Bilinmeyen hata' },
      { status: 500 }
    );
  }
}

// Telegram mesajlarını işle (komutlar için)
async function handleTelegramMessage(message: any) {
  const { text, from, chat } = message;
  
  // Komut olmayan mesajları atla
  if (!text || !text.startsWith('/')) {
    return NextResponse.json({ success: true, message: 'Komut değil' });
  }

  // Komut ve parametreleri ayır
  const [command, ...args] = text.split(' ');
  const commandLower = command.toLowerCase();

  // /start task_XXX komutunu işle
  if (commandLower === '/start' && args.length > 0 && args[0].startsWith('task_')) {
    const taskId = parseInt(args[0].replace('task_', ''), 10);
    const telegramId = from.id.toString();
    
    if (isNaN(taskId)) {
      return NextResponse.json({ success: false, message: 'Geçersiz görev ID' });
    }
    
    try {
      // Telegram ID'ye göre kullanıcıyı bul
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .single();
      
      if (userError || !userData) {
        console.error('Kullanıcı bulunamadı:', userError);
        return NextResponse.json({ success: false, message: 'Kullanıcı bulunamadı' });
      }
      
      // Görevi doğrula
      const { data: verifyResult, error: verifyError } = await supabase.rpc(
        'verify_telegram_task',
        {
          p_user_id: userData.id,
          p_telegram_id: telegramId,
          p_task_id: taskId
        }
      );
      
      if (verifyError) {
        console.error('Görev doğrulama hatası:', verifyError);
        return NextResponse.json({ success: false, message: 'Görev doğrulanamadı' });
      }
      
      console.log('Görev doğrulama sonucu:', verifyResult);
      
      // Kullanıcıya mesaj gönder
      // Bu kısım Telegram Bot API ile gerçekleştirilebilir
      
      return NextResponse.json({ 
        success: true, 
        message: 'Görev işlendi', 
        result: verifyResult 
      });
    } catch (error: any) {
      console.error('Görev işleme hatası:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Görev işlenirken hata oluştu' },
        { status: 500 }
      );
    }
  }
  
  // Diğer komutlar...
  
  return NextResponse.json({ success: true, message: 'Komut işlendi' });
}

// Telegram callback query'leri işle (inline butonlar için)
async function handleTelegramCallback(callbackQuery: any) {
  const { data, from } = callbackQuery;
  
  // Veri yoksa atla
  if (!data) {
    return NextResponse.json({ success: true, message: 'İşlenecek callback verisi yok' });
  }
  
  // Görev callback'leri (örnek: task_verify_XXX)
  if (data.startsWith('task_verify_')) {
    const taskId = parseInt(data.replace('task_verify_', ''), 10);
    const telegramId = from.id.toString();
    
    if (isNaN(taskId)) {
      return NextResponse.json({ success: false, message: 'Geçersiz görev ID' });
    }
    
    try {
      // Telegram ID'ye göre kullanıcıyı bul
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .single();
      
      if (userError || !userData) {
        console.error('Kullanıcı bulunamadı:', userError);
        return NextResponse.json({ success: false, message: 'Kullanıcı bulunamadı' });
      }
      
      // Görevi doğrula
      const { data: verifyResult, error: verifyError } = await supabase.rpc(
        'verify_telegram_task',
        {
          p_user_id: userData.id,
          p_telegram_id: telegramId,
          p_task_id: taskId
        }
      );
      
      if (verifyError) {
        console.error('Görev doğrulama hatası:', verifyError);
        return NextResponse.json({ success: false, message: 'Görev doğrulanamadı' });
      }
      
      // Callback cevabı
      return NextResponse.json({ 
        success: true, 
        message: 'Görev doğrulandı', 
        result: verifyResult,
        callback_response: {
          callback_query_id: callbackQuery.id,
          text: verifyResult.success 
            ? `✅ Görev tamamlandı! ${verifyResult.reward} NMFP kazandınız.` 
            : `❌ ${verifyResult.message || 'Görev doğrulanamadı'}`
        }
      });
    } catch (error: any) {
      console.error('Callback işleme hatası:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Callback işlenirken hata oluştu' },
        { status: 500 }
      );
    }
  }
  
  return NextResponse.json({ success: true, message: 'Callback işlendi' });
} 