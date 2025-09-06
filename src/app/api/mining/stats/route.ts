import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Mining istatistiklerini getir
    const { data: stats, error } = await supabase.rpc('get_user_mining_stats', {
      p_user_id: userId
    });

    if (error) {
      console.error('Mining stats error:', error);
      return NextResponse.json({ error: 'Failed to fetch mining stats' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stats: stats || {}
    });

  } catch (error) {
    console.error('Mining stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action, sessionId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'complete':
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required for completion' }, { status: 400 });
        }
        const { data: reward, error: completeError } = await supabase.rpc('complete_mining', {
          p_mining_session_id: parseInt(sessionId)
        });

        if (completeError) {
          console.error('Complete mining error:', completeError);
          return NextResponse.json({ error: 'Failed to complete mining' }, { status: 500 });
        }

        result = { reward, message: 'Mining completed successfully' };
        break;

      case 'update_expired':
        const { data: updateResult, error: updateError } = await supabase.rpc('update_expired_mining_sessions');

        if (updateError) {
          console.error('Update expired sessions error:', updateError);
          return NextResponse.json({ error: 'Failed to update expired sessions' }, { status: 500 });
        }

        result = updateResult;
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Mining action API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
