import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId } = body;

    if (!sessionId) {
      return NextResponse.json({
        error: 'Session ID is required'
      }, { status: 400 });
    }

    // Mining tamamla
    const { data: reward, error } = await supabase.rpc('complete_mining', {
      p_mining_session_id: parseInt(sessionId)
    });

    if (error) {
      console.error('Complete mining error:', error);

      let errorMessage = 'Mining tamamlanamadı';
      if (error.message.includes('not found')) {
        errorMessage = 'Mining oturumu bulunamadı';
      } else if (error.message.includes('already completed')) {
        errorMessage = 'Mining oturumu zaten tamamlanmış';
      }

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      reward: reward || 0,
      message: 'Mining başarıyla tamamlandı'
    });

  } catch (error) {
    console.error('Mining complete API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
