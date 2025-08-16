import { supabase } from '@/lib/supabaseClient';

export const testRealtimeConnection = async (userId: string) => {
  console.log('[RealtimeTest] 🔍 Realtime bağlantısı test ediliyor...');
  
  // 1. Test basic connection
  const { data: connectionTest } = await supabase.from('users').select('id').limit(1);
  console.log('[RealtimeTest] 📡 Basic connection test:', connectionTest ? 'SUCCESS' : 'FAILED');
  
  // 2. Test user access
  const { data: userTest, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  console.log('[RealtimeTest] 👤 User access test:', {
    success: !!userTest,
    error: userError,
    userData: userTest ? { id: userTest.id, balance: userTest.balance } : null
  });
  
  // 3. Test realtime channels status
  const channels = supabase.getChannels();
  console.log('[RealtimeTest] 📺 Active channels:', channels.map(ch => ({
    topic: ch.topic,
    state: ch.state,
    joinedAt: ch.joinedAt
  })));
  
  // 4. Test manual update to trigger realtime
  console.log('[RealtimeTest] 🔧 Manual update test başlıyor...');
  
  const testChannel = supabase
    .channel('test-realtime')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'users', 
        filter: `id=eq.${userId}` 
      }, 
      (payload) => {
        console.log('[RealtimeTest] ✅ Realtime event received:', payload);
      }
    )
    .subscribe((status, err) => {
      console.log('[RealtimeTest] 📡 Test channel status:', { status, error: err });
    });
  
  // Wait for subscription
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Trigger update
  const { data: updateResult, error: updateError } = await supabase
    .from('users')
    .update({ 
      last_login: new Date().toISOString(),
      // Add a tiny balance change to trigger realtime
      balance: userTest?.balance || 0
    })
    .eq('id', userId);
  
  console.log('[RealtimeTest] 🚀 Manual update result:', {
    success: !updateError,
    error: updateError,
    data: updateResult
  });
  
  // Cleanup
  setTimeout(() => {
    testChannel.unsubscribe();
    console.log('[RealtimeTest] 🧹 Test channel unsubscribed');
  }, 5000);
  
  return {
    connectionTest: !!connectionTest,
    userAccess: !!userTest,
    manualUpdate: !updateError
  };
};

export const debugRealtimeIssues = () => {
  console.group('[RealtimeDebug] 🐛 Realtime Debug Başlatıldı');
  
  // Check environment
  console.log('Environment:', {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    nodeEnv: process.env.NODE_ENV
  });
  
  // Check supabase client
  console.log('Supabase Client:', {
    realtime: !!supabase.realtime,
    realtimeUrl: supabase.realtime?.url,
    supabaseUrl: supabase.supabaseUrl,
    supabaseKey: supabase.supabaseKey ? 'SET' : 'MISSING'
  });
  
  console.groupEnd();
};