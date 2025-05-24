import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    // İstek verilerini al
    const { taskId, userId, telegramId, taskType, taskData } = await request.json();
    
    // Temel doğrulama
    if (!taskId || !userId || !telegramId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Eksik parametreler: taskId, userId ve telegramId gerekli' 
      }, { status: 400 });
    }
    
    console.log(`[verify-task] Görev doğrulama isteği: taskId=${taskId}, userId=${userId}, telegramId=${telegramId}, type=${taskType}`);
    
    let isVerified = false;
    let verificationMessage = '';
    
    // Görev tipine göre doğrulama işlemi
    if (taskType === 'channel_join') {
      if (!taskData?.channel_username) {
        return NextResponse.json({ 
          success: false, 
          message: 'Kanal kullanıcı adı eksik' 
        }, { status: 400 });
      }
      
      try {
        // Telegram Bot API ile kanal üyeliği kontrolü
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          throw new Error('Bot token eksik');
        }
        
        console.log(`[verify-task] Kanal üyeliği kontrolü: @${taskData.channel_username} için ${telegramId}`);
        
        const result = await fetch(
          `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${taskData.channel_username}&user_id=${telegramId}`
        ).then(r => r.json());
        
        console.log(`[verify-task] Telegram API yanıtı:`, result);
        
        if (result.ok && ["member", "administrator", "creator"].includes(result?.result?.status)) {
          isVerified = true;
          verificationMessage = 'Kanala katılım doğrulandı';
        } else {
          verificationMessage = 'Lütfen önce kanala katılın';
        }
      } catch (error: any) {
        console.error('[verify-task] Kanal kontrol hatası:', error);
        verificationMessage = 'Kanal üyeliği kontrol edilirken hata oluştu';
      }
    } 
    else if (taskType === 'link_click') {
      // Link tıklamaları için basit doğrulama - geliştirilebilir
      isVerified = true;
      verificationMessage = 'Link ziyareti kabul edildi';
    }
    else if (taskType === 'bot_command') {
      // Bot komutları için - doğrudan onaylıyoruz (gerçek sistemde bot webhook ile doğrulanmalı)
      isVerified = true;
      verificationMessage = 'Bot komutu kabul edildi';
    }
    else {
      // Diğer görev tipleri veya tip belirtilmediyse otomatik onay
      isVerified = true;
      verificationMessage = 'Görev doğrulandı';
    }
    
    // Doğrulandıysa Supabase'de görev ilerlemesini güncelle
    if (isVerified) {
      console.log(`[verify-task] Görev doğrulandı, Supabase RPC çağrılıyor...`);
      
      const { data, error } = await supabase.rpc('verify_telegram_task', {
        p_user_id: userId,
        p_telegram_id: telegramId,
        p_task_id: taskId
      });
      
      if (error) {
        console.error('[verify-task] Supabase RPC hatası:', error);
        return NextResponse.json({ 
          success: false, 
          message: 'Görev doğrulandı fakat kayıt sırasında hata oluştu' 
        }, { status: 500 });
      }
      
      console.log(`[verify-task] Görev başarıyla tamamlandı:`, data);
      
      return NextResponse.json({ 
        success: true, 
        message: verificationMessage,
        result: data
      });
    }
    
    // Doğrulanmadıysa hata döndür
    return NextResponse.json({ 
      success: false, 
      message: verificationMessage || 'Görev doğrulanamadı'
    });
    
  } catch (error: any) {
    console.error('[verify-task] İşlem hatası:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Bilinmeyen bir hata oluştu'
    }, { status: 500 });
  }
} 