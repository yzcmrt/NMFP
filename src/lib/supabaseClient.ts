import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase'; // Assuming your auto-generated types are here

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("Hata: NEXT_PUBLIC_SUPABASE_URL ortam değişkeni eksik");
  // throw new Error("Supabase URL eksik"); // Veya hata fırlat
}
if (!supabaseKey) {
  console.error("Hata: NEXT_PUBLIC_SUPABASE_ANON_KEY ortam değişkeni eksik");
  // throw new Error("Supabase Anon Key eksik"); // Veya hata fırlat
}

// Tekil supabase istemcisi with realtime configuration
export const supabase = createClient<Database>(supabaseUrl!, supabaseKey!, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  db: {
    schema: 'public'
  }
});

console.log('[SupabaseClient] Paylaşılan istemci başlatıldı (realtime enabled).'); 