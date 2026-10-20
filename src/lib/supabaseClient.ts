import { createClient } from '@supabase/supabase-js';
// The browser has no database credentials. All queries pass through the authenticated API.
export const supabase = createClient('https://nmfp.invalid','nmfp-session-proxy',{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 global:{fetch:async(input,init)=>{
  const url = new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if (!url.pathname.startsWith('/rest/v1/')) throw new Error('Unsupported database operation.');
  const headers = new Headers(init?.headers); headers.delete('apikey'); headers.delete('authorization');
  return fetch(`/api/data/${url.pathname.slice('/rest/v1/'.length)}${url.search}`,{...init,headers,credentials:'same-origin'});
 }}
});
