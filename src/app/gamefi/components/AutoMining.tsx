'use client';
import {useState} from 'react';
import {toast} from 'react-hot-toast';
import {useTelegram} from '@/components/TelegramInitProvider';
import {starsCheckout} from '@/lib/starsCheckout';
export default function AutoMining({onBalanceUpdate}:{onBalanceUpdate?:(balance?:number)=>Promise<void>}) {
 const {user,refreshUserData}=useTelegram(); const [loading,setLoading]=useState(false);
 const active=Boolean(user?.premium_active && user.premium_until && new Date(user.premium_until)>new Date());
 async function purchase(){setLoading(true);try{await starsCheckout('premium','annual');await refreshUserData();await onBalanceUpdate?.();toast.success('Otomatik madencilik aktif.');}catch(e){toast.error(e instanceof Error?e.message:'Ödeme tamamlanamadı.');}finally{setLoading(false);}}
 return <section className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-5 space-y-3"><h2 className="font-semibold text-lg">Otomatik madencilik</h2><p className="text-sm text-gray-400">Uygun araçlar için madencilik turlarını otomatik başlatır. Yakıt ve bakım için NMFP puanları kullanılır.</p>{active?<p className="text-green-400">Aktif · {new Date(user!.premium_until!).toLocaleDateString()} tarihine kadar</p>:<button disabled={loading} onClick={purchase} className="bg-yellow-400 text-black px-4 py-3 rounded-xl font-bold disabled:opacity-50">{loading?'İşleniyor…':'199 Stars · 365 gün'}</button>}<p className="text-xs text-gray-400">Tek seferlik ödeme. Otomatik yenilenmez. <a href="/terms" className="underline">Satın alma koşulları</a></p></section>;
}
