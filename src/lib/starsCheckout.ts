'use client';
export async function starsCheckout(kind:'car'|'garage'|'premium',productId:string):Promise<void> {
 const tg=(window as any).Telegram?.WebApp;
 if(!tg?.openInvoice)throw new Error('Open the game in Telegram to pay with Stars.');
 if(!window.confirm('This is a one-time purchase of an in-game item with no cash value. By continuing, you accept the purchase terms at /terms. Payment support: /support. Continue?'))throw new Error('Purchase cancelled.');
 const response=await fetch('/api/stars/invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,productId,termsAccepted:true})});
 const result=await response.json();
 if(!response.ok)throw new Error(result.message || 'Unable to open checkout.');
 const status=await new Promise<string>(resolve=>tg.openInvoice(result.invoiceUrl,resolve));
 if(status==='cancelled'||status==='failed')throw new Error(status==='cancelled'?'Purchase cancelled.':'Payment failed. No item was granted.');
 // A client-side paid signal is not proof; wait for the authenticated server order.
 for(let i=0;i<20;i++) {
  const check=await fetch(`/api/stars/orders?id=${encodeURIComponent(result.orderId)}`,{cache:'no-store'});
  if(check.ok) {
   const order=(await check.json()).orders?.[0];
   if(order?.status==='paid')return;
   if(order?.status==='refunded')throw new Error('This payment was refunded.');
  }
  await new Promise(resolve=>setTimeout(resolve,1500));
 }
 throw new Error(`Payment confirmation is pending. Do not pay again. Order: ${result.orderId}. Your item will arrive after confirmation.`);
}
