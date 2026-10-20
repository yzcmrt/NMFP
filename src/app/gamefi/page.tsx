'use client';
import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MiningArea from './components/MiningArea';
import AutoMining from './components/AutoMining';
import {useTelegram} from '@/components/TelegramInitProvider';
import {useRealtimeBalance} from '@/hooks/useRealtimeBalance';
import {userCarService, garageService, miningService, transactionService} from '@/services/api';
import type {UserCar, Garage, MiningSession, Transaction} from '@/types';
import {formatCurrency} from '@/app/utils/formatters';

export default function GameFiPage(){
 const {user,telegramUser}=useTelegram();
 const {balance,refreshBalance}=useRealtimeBalance({userId:user?.id||'',initialBalance:user?.balance});
 const [data,setData]=useState<{cars:UserCar[];garages:Garage[];sessions:MiningSession[];transactions:Transaction[]}|null>(null);
 const [error,setError]=useState(false);
 const userId=user?.id;
 const refresh=useCallback(async()=>{
   if(!userId)return;
   try{
     const [cars,garages,sessions,transactions]=await Promise.all([userCarService.getUserCars(userId),garageService.getUserGarages(userId),miningService.getAllActiveMiningSessions(userId),transactionService.getUserTransactions(userId,5)]);
     setData({cars,garages,sessions,transactions});setError(false);
   }catch{setError(true);}
 },[userId]);
 useEffect(()=>{
   void refresh();const visible=()=>{if(document.visibilityState==='visible')void refresh();};
   const timer=setInterval(visible,15000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
   return()=>{clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[refresh]);
 const update=useCallback(async()=>{await refreshBalance();await refresh();},[refreshBalance,refresh]);
 const active=data?.sessions.filter(s=>s.status==='active').length;
 const capacity=data?.garages.reduce((sum,g)=>sum+g.capacity,0);
 return <div className="command-deck">
   <div className="deck-heading"><div><p className="eyebrow">OPERATOR / LVL {user?.level??1}</p><h1>{user?.username||telegramUser?.first_name||'Oyuncu'}<span className="cursor-mark">_</span></h1></div><span className="operator-xp">{user?.xp?.toLocaleString()??0} XP</span></div>
   <section className="garage-banner"><Image src="/cars/garage/garaj-10.jpg" alt="Neon garaj" fill priority sizes="(max-width: 760px) 100vw, 900px" /><div className="garage-banner-shade"/><div className="garage-banner-copy"><p className="eyebrow">NIGHT SHIFT // KONTROL MERKEZİ</p><h2>Garaj senin.<br/>Sıradaki hamle de.</h2><Link href="/gamefi/car" className="text-link">Araç koleksiyonu ↗</Link></div></section>
   <section className="balance-panel"><div><p className="eyebrow">OYUN BAKİYESİ</p><strong>{formatCurrency(balance)} <small>NMFP</small></strong></div><Link href="/gamefi/wallet" className="round-link" aria-label="Bakiye ve işlem geçmişi">↗</Link></section>
   {error&&<div role="alert" className="data-alert">Garaj özeti güncellenemedi. <button onClick={()=>void refresh()}>Tekrar dene</button></div>}
   <div className="deck-stats"><Link href="/gamefi/car"><span>ARAÇ</span><strong>{data?.cars.length??'—'}</strong></Link><Link href="/gamefi/garage"><span>GARAJ SLOTU</span><strong>{capacity??'—'}</strong></Link><div><span>AKTİF TUR</span><strong>{active??'—'}<i className={active?'status-dot':''}/></strong></div></div>
   <div className="deck-section-label"><h2>Üretim kontrolü</h2><span>01 / OPERATIONS</span></div>
   <MiningArea onBalanceUpdate={update} currentBalance={balance}/>
   <AutoMining onBalanceUpdate={update}/>
   <section className="cyber-panel transaction-panel"><div className="deck-section-label"><h2>Son işlemler</h2><Link href="/gamefi/wallet">TÜMÜ ↗</Link></div>{!data?<p className="muted" role="status">İşlemler yükleniyor…</p>:data.transactions.length===0?<p className="muted">İlk turunla işlem geçmişin burada oluşacak.</p>:<ul>{data.transactions.map(t=><li key={t.id}><div><strong>{t.item||t.type.replaceAll('_',' ')}</strong><time dateTime={t.date}>{new Date(t.date).toLocaleString('tr-TR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></div><span>{formatCurrency(t.amount)} <small>{t.currency==='XTR'?'Stars':t.currency}</small></span></li>)}</ul>}</section>
 </div>;
}
