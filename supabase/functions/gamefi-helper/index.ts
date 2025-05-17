// NMFP Gamefi Yardımcı Fonksiyonu
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase Edge Function
Deno.serve(async (req) => {
  try {
    // CORS header
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // Sadece GET ve POST isteklerini işle
    if (req.method !== 'GET' && req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Supabase client oluştur
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
        auth: { persistSession: false }
      }
    );

    // POST request için body parse işlemi
    let requestData = {};
    if (req.method === 'POST') {
      requestData = await req.json();
    }

    // GET params alınması
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';
    const userId = url.searchParams.get('user_id');

    // İşlem tipine göre farklı davranışlar
    let responseData = {};

    switch (action) {
      case 'status':
        responseData = {
          status: 'online',
          timestamp: new Date().toISOString(),
          env: Deno.env.get('SUPABASE_URL') ? 'configured' : 'not-configured'
        };
        break;

      case 'user-stats':
        if (!userId) {
          return new Response(JSON.stringify({ error: 'User ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Kullanıcı istatistiklerini çek
        const { data: userStats, error: userStatsError } = await supabaseClient
          .rpc('get_user_stats', { p_user_id: userId });

        if (userStatsError) {
          return new Response(JSON.stringify({ error: userStatsError.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        responseData = { stats: userStats };
        break;

      default:
        responseData = {
          message: 'Unknown action',
          action,
          availableActions: ['status', 'user-stats']
        };
    }

    return new Response(JSON.stringify(responseData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}); 