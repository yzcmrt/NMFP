import { supabase } from '@/lib/supabaseClient';
import { useBalanceStore } from '@/store/balanceStore';
// Same-origin authenticated polling replaces anonymous realtime database channels.
class RealtimeManager {
 private subscribers = new Map<string,number>();
 private timers = new Map<string,ReturnType<typeof setInterval>>();
 async subscribeToUserBalance(userId:string) {
  this.subscribers.set(userId,(this.subscribers.get(userId)||0)+1);
  if (!this.timers.has(userId)) {
   const refresh = () => { if (document.visibilityState === 'visible') void this.refreshUserBalance(userId); };
   refresh(); this.timers.set(userId,setInterval(refresh,10000));
  }
  return null;
 }
 async subscribeToMiningUpdates(userId:string, _garageIds:number[]) { await this.subscribeToUserBalance(userId); return null; }
 async refreshUserBalance(userId:string):Promise<boolean> {
  try {
   const {data,error}=await supabase.from('users').select('balance').eq('id',userId).maybeSingle();
   if(error || !data) return false;
   useBalanceStore.getState().setBalance(userId,data.balance);
   window.dispatchEvent(new CustomEvent('balanceUpdated',{detail:{userId,balance:data.balance}}));
   return true;
  } catch { return false; }
 }
 async unsubscribeUser(userId:string) { const remaining=(this.subscribers.get(userId)||1)-1; if(remaining>0){this.subscribers.set(userId,remaining);return;} this.subscribers.delete(userId); const timer=this.timers.get(userId); if(timer) clearInterval(timer); this.timers.delete(userId); }
 async cleanup() { for(const timer of this.timers.values())clearInterval(timer);this.timers.clear();this.subscribers.clear(); }
 getHealthStatus() { return {isHealthy:true,activeConnections:this.timers.size,maxConnections:10,queueLength:0,lastUpdate:Date.now()}; }
}
export const realtimeManager = new RealtimeManager();
export const useRealtimeManager = () => realtimeManager;
