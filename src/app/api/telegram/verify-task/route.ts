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
    // Yeni görev tipleri
    else if (taskType === 'car_purchase_nmfp') {
      try {
        // Kullanıcının NMFP ile araç satın alıp almadığını kontrol et
        const { count, error } = await supabase
          .from('user_cars')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('purchase_type', 'NMFP');
          
        if (error) throw error;
        
        console.log(`[verify-task] NMFP ile alınan araç sayısı:`, count);
        isVerified = count > 0;
        verificationMessage = isVerified 
          ? 'NMFP ile araç satın alma görevi doğrulandı' 
          : 'Henüz NMFP ile araç satın almamışsınız';
      } catch (error: any) {
        console.error('[verify-task] NMFP araç kontrolü hatası:', error);
        verificationMessage = 'Araç kontrolü sırasında hata oluştu';
      }
    }
    else if (taskType === 'car_purchase_ton') {
      try {
        const { count, error } = await supabase
          .from('user_cars')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('purchase_type', 'TON');
          
        if (error) throw error;
        
        console.log(`[verify-task] TON ile alınan araç sayısı:`, count);
        isVerified = count > 0;
        verificationMessage = isVerified 
          ? 'TON ile araç satın alma görevi doğrulandı' 
          : 'Henüz TON ile araç satın almamışsınız';
      } catch (error: any) {
        console.error('[verify-task] TON araç kontrolü hatası:', error);
        verificationMessage = 'Araç kontrolü sırasında hata oluştu';
      }
    }
    else if (taskType === 'car_mint_nft') {
      try {
        const { count, error } = await supabase
          .from('user_cars')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('purchase_type', 'NFT');
          
        if (error) throw error;
        
        console.log(`[verify-task] NFT mint edilen araç sayısı:`, count);
        isVerified = count > 0;
        verificationMessage = isVerified 
          ? 'NFT mint görevi doğrulandı' 
          : 'Henüz NFT mint yapmamışsınız';
      } catch (error: any) {
        console.error('[verify-task] NFT araç kontrolü hatası:', error);
        verificationMessage = 'Araç kontrolü sırasında hata oluştu';
      }
    }
    else if (taskType === 'car_repair') {
      try {
        const { count, error } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'expense')
          .like('item', 'Araç Tamiri%');
          
        if (error) throw error;
        
        console.log(`[verify-task] Yapılan araç tamiri sayısı:`, count);
        isVerified = count > 0;
        verificationMessage = isVerified 
          ? 'Araç tamir görevi doğrulandı' 
          : 'Henüz araç tamir etmemişsiniz';
      } catch (error: any) {
        console.error('[verify-task] Tamir kontrolü hatası:', error);
        verificationMessage = 'Tamir kontrolü sırasında hata oluştu';
      }
    }
    else if (taskType === 'car_refill') {
      try {
        const { count, error } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'expense')
          .like('item', 'Yakıt Dolumu%');
          
        if (error) throw error;
        
        console.log(`[verify-task] Yapılan yakıt dolumu sayısı:`, count);
        isVerified = count > 0;
        verificationMessage = isVerified 
          ? 'Yakıt doldurma görevi doğrulandı' 
          : 'Henüz yakıt doldurmamışsınız';
      } catch (error: any) {
        console.error('[verify-task] Yakıt kontrolü hatası:', error);
        verificationMessage = 'Yakıt kontrolü sırasında hata oluştu';
      }
    }
    else if (taskType === 'mining_complete') {
      try {
        // Görev bilgilerini al
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .select('total')
          .eq('id', taskId)
          .single();
          
        if (taskError) throw taskError;
        
        const requiredCount = taskData?.total || 1;
        
        // Kullanıcının mining sayısını kontrol et
        const { count, error } = await supabase
          .from('mining_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'completed');
          
        if (error) throw error;
        
        console.log(`[verify-task] Tamamlanan mining sayısı: ${count}/${requiredCount}`);
        isVerified = count >= requiredCount;
        verificationMessage = isVerified 
          ? `Mining görevi doğrulandı (${count}/${requiredCount})` 
          : `Henüz yeterli mining tamamlanmadı (${count}/${requiredCount})`;
      } catch (error: any) {
        console.error('[verify-task] Mining kontrolü hatası:', error);
        verificationMessage = 'Mining kontrolü sırasında hata oluştu';
      }
    }
    else if (taskType === 'collect_bonus') {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('last_bonus_collected_at')
          .eq('id', userId)
          .single();
          
        if (error) throw error;
        
        isVerified = data?.last_bonus_collected_at != null;
        verificationMessage = isVerified 
          ? 'Günlük bonus toplama görevi doğrulandı' 
          : 'Henüz günlük bonus toplamamışsınız';
      } catch (error: any) {
        console.error('[verify-task] Bonus kontrolü hatası:', error);
        verificationMessage = 'Bonus kontrolü sırasında hata oluştu';
      }
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