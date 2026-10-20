import { createHash, timingSafeEqual } from 'node:crypto';
import { errorResponse,HttpError } from '@/server/auth';
import { database } from '@/server/db';
import { telegram } from '@/server/telegram';
import { validPreCheckout } from '@/server/paymentChecks';
export async function POST(request:Request) {
 try {
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET || '',received=request.headers.get('x-telegram-bot-api-secret-token') || '';
  if(!secret || !timingSafeEqual(createHash('sha256').update(secret).digest(),createHash('sha256').update(received).digest()))throw new HttpError(401,'Invalid webhook.');
  const update=await request.json(), db=database();
  if(update.pre_checkout_query) {
   const q=update.pre_checkout_query;
   const {data:o,error}=await db.from('star_orders').select('*,users!inner(telegram_id)').eq('id',q.invoice_payload).maybeSingle();
   let ok=!error && validPreCheckout(o?{...o,telegram_id:o.users.telegram_id}:null,{currency:q.currency,total_amount:q.total_amount,telegram_id:String(q.from.id)});
   if(ok && o.kind!=='premium') {
    const {count,error:ownedError}=await db.from(o.kind==='car'?'user_cars':'garages').select('id',{count:'exact',head:true}).eq('user_id',o.user_id).eq(o.kind==='car'?'car_model_id':'template_id',o.product_id);
    ok=!ownedError && !count;
   }
   await telegram('answerPreCheckoutQuery',{pre_checkout_query_id:q.id,ok:Boolean(ok),...(!ok?{error_message:'This order is unavailable or has expired. Please reopen checkout.'}:{})});
  }
  const message=update.message,payment=message?.successful_payment;
  if(payment) {
   if(payment.currency!=='XTR')throw new HttpError(400,'Unsupported payment currency.');
   const {data:delivery,error}=await db.rpc('nmfp_fulfill_star_order',{p_order_id:payment.invoice_payload,p_telegram_id:String(message.from.id),p_charge_id:payment.telegram_payment_charge_id,p_amount:payment.total_amount});
   // Transient failures return 500 so Telegram retries. Never silently acknowledge an undelivered purchase.
   if(error)throw new Error('Stars fulfillment failed; Telegram will retry delivery.');
   if(delivery?.refund_required) {
    try { await telegram('refundStarPayment',{user_id:message.from.id,telegram_payment_charge_id:payment.telegram_payment_charge_id}); } catch(error) {
     if(!(error instanceof Error && error.message.includes('CHARGE_ALREADY_REFUNDED'))) throw error;
    }
    const {error:refundError}=await db.from('star_orders').update({status:'refunded'}).eq('id',payment.invoice_payload).eq('telegram_charge_id',payment.telegram_payment_charge_id).eq('status','refund_pending');
    if(refundError) throw new Error('Refund record could not be updated.');
   }
  }
  const command=message?.text?.split(/\s/)[0]?.split('@')[0];
  const site=process.env.NEXT_PUBLIC_SITE_URL || 'https://nmfp.vercel.app';
  if(message?.chat?.type==='private' && command && !payment) {
   if(command==='/start' || command==='/play')return Response.json({method:'sendMessage',chat_id:message.chat.id,text:'Welcome to NMFP. Build your garage and earn in-game NMFP points.',reply_markup:{inline_keyboard:[[{text:'Open your garage',web_app:{url:`${site}/gamefi`}}]]}});
   if(['/support','/paysupport','/terms'].includes(command))return Response.json({method:'sendMessage',chat_id:message.chat.id,text:command==='/terms'?`Purchase terms: ${site}/terms`:`For game and payment support, use ${site}/support. Include your order ID; never send passwords or wallet recovery words.`});
  }
  return Response.json({ok:true});
 }catch(error){return errorResponse(error);}
}
