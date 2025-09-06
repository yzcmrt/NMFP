import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, carId, garageId } = body;

    if (!userId || !carId) {
      return NextResponse.json({
        error: 'User ID and Car ID are required'
      }, { status: 400 });
    }

    // Mining başlat
    const { data: sessionId, error } = await supabase.rpc('start_mining', {
      p_user_id: userId,
      p_car_id: parseInt(carId),
      p_garage_id: garageId ? parseInt(garageId) : null
    });

    if (error) {
      console.error('Start mining error:', error);

      // Hata mesajını kullanıcı dostu hale getir
      let errorMessage = 'Mining başlatılamadı';
      if (error.message.includes('fuel')) {
        errorMessage = 'Araçta yeterli yakıt yok';
      } else if (error.message.includes('condition')) {
        errorMessage = 'Araç durumu mining için uygun değil';
      } else if (error.message.includes('garage')) {
        errorMessage = 'Garaj kapasitesi dolu';
      } else if (error.message.includes('already mining')) {
        errorMessage = 'Bu araç zaten mining yapıyor';
      }

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({
        error: 'Mining oturumu başlatılamadı'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Mining başarıyla başlatıldı'
    });

  } catch (error) {
    console.error('Mining start API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
