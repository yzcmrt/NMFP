import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MiningProgressUpdate {
  sessionId: number;
  progress: number;
  timeLeft: number;
  isCompleted: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Aktif mining sessions'larda progress hesapla
    const { data: activeSessions, error } = await supabaseAdmin
      .from('mining_sessions')
      .select(`
        id,
        user_id,
        start_time,
        end_time,
        expected_reward,
        status,
        user_cars!inner(name)
      `)
      .eq('status', 'active')
      .gte('updated_at', fiveMinutesAgo.toISOString()) // Son 5 dakikada güncellenen
      .limit(100); // Batch limit

    if (error) {
      console.error('Mining sessions fetch error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch mining sessions' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!activeSessions || activeSessions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active sessions to update' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Progress updates'leri hesapla
    const progressUpdates: Record<string, MiningProgressUpdate> = {};
    const completedSessionIds: number[] = [];

    for (const session of activeSessions) {
      const startTime = new Date(session.start_time).getTime();
      const endTime = new Date(session.end_time).getTime();
      const currentTime = now.getTime();

      let progress = 0;
      let timeLeft = 0;
      let isCompleted = false;

      if (currentTime >= endTime) {
        progress = 100;
        timeLeft = 0;
        isCompleted = true;
        completedSessionIds.push(session.id);
      } else if (currentTime > startTime) {
        const totalDuration = endTime - startTime;
        const elapsed = currentTime - startTime;
        progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        timeLeft = endTime - currentTime;
      } else {
        timeLeft = endTime - currentTime;
      }

      progressUpdates[session.id.toString()] = {
        sessionId: session.id,
        progress: Math.round(progress),
        timeLeft,
        isCompleted
      };
    }

    // Completed sessions'ları güncelle (batch)
    if (completedSessionIds.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('mining_sessions')
        .update({
          status: 'completed',
          completed_at: now.toISOString()
        })
        .in('id', completedSessionIds);

      if (updateError) {
        console.error('Failed to update completed sessions:', updateError);
      } else {
        console.log(`Updated ${completedSessionIds.length} completed mining sessions`);
      }

      // Tamamlanan session'lar için reward'ları da işle
      for (const sessionId of completedSessionIds) {
        const session = activeSessions.find(s => s.id === sessionId);
        if (session) {
          // User balance'ı güncelle
          await supabaseAdmin
            .from('users')
            .update({
              balance: supabaseAdmin.sql`balance + ${session.expected_reward}`
            })
            .eq('id', session.user_id);

          // Transaction kaydı oluştur
          await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: session.user_id,
              type: 'mining_reward',
              amount: session.expected_reward,
              currency: 'NMFP',
              status: 'confirmed',
              source: 'Auto Mining Completion',
              item: `Mining Session #${session.id}`
            });
        }
      }
    }

    // Group updates by user_id for efficient broadcasting
    const userGroups: Record<string, MiningProgressUpdate[]> = {};
    
    for (const session of activeSessions) {
      if (!userGroups[session.user_id]) {
        userGroups[session.user_id] = [];
      }
      
      const progressUpdate = progressUpdates[session.id.toString()];
      if (progressUpdate) {
        userGroups[session.user_id].push(progressUpdate);
      }
    }

    // Broadcast to each user group
    let broadcastCount = 0;
    for (const [userId, updates] of Object.entries(userGroups)) {
      try {
        await supabaseAdmin
          .channel(`mining_progress_${userId}`)
          .send({
            type: 'broadcast',
            event: 'batch_mining_progress',
            payload: {
              mining_updates: updates,
              timestamp: now.toISOString()
            }
          });
        
        broadcastCount++;
      } catch (broadcastError) {
        console.error(`Failed to broadcast to user ${userId}:`, broadcastError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionsProcessed: activeSessions.length,
        completedSessions: completedSessionIds.length,
        broadcastCount,
        timestamp: now.toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Mining progress broadcaster error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
