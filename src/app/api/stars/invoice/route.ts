import { checkOrigin,readSession,errorResponse,HttpError } from '@/server/auth';
import { database } from '@/server/db';
import { telegram } from '@/server/telegram';
export async function POST(request:Request) {
 try {
  checkOrigin(request); const session=readSession(request);
  const {kind,productId,termsAccepted}=await request.json();
  if(termsAccepted!==true) throw new HttpError(400,'Please accept the purchase terms.');
  if(!['car','garage','premium'].includes(kind)||typeof productId!=='string'||productId.length>100) throw new HttpError(400,'Invalid product.');
  const db=database();
  const {count,error:countError}=await db.from('star_orders').select('id',{count:'exact',head:true}).eq('user_id',session.userId).gte('created_at',new Date(Date.now()-60000).toISOString());
  if(countError) throw new HttpError(503,'Checkout is temporarily unavailable.');
  if((count || 0)>=5) throw new HttpError(429,'Please wait a minute before trying again.');
  let title='Auto mining · 365 days',amount=199;
  if(kind==='premium' && productId!=='annual') throw new HttpError(400,'Invalid plan.');
  if(kind!=='premium') {
   const {data,error}=await db.from(kind==='car'?'car_models':'garage_templates').select('*').eq('id',productId).single();
   if(error || !data) throw new HttpError(404,'Product not found.');
   amount=data.stars_price; title=data.name;
   const {count:owned,error:ownedError}=await db.from(kind==='car'?'user_cars':'garages').select('id',{count:'exact',head:true}).eq('user_id',session.userId).eq(kind==='car'?'car_model_id':'template_id',productId);
   if(ownedError) throw new HttpError(503,'Unable to check your garage.');
   if(owned) throw new HttpError(409,'You already own this item.');
  }
  if(!Number.isSafeInteger(amount)||amount<=0) throw new HttpError(503,'Price unavailable.');
  const {data:order,error}=await db.from('star_orders').insert({user_id:session.userId,kind,product_id:productId,amount,title}).select('*').single();
  if(error) throw new HttpError(503,'Unable to create order.');
  const invoiceUrl=await telegram('createInvoiceLink',{title:title.slice(0,32),description:kind==='premium'?'365 days of automatic mining. One-time payment; no automatic renewal.':'One in-game item. No cash value. Delivered after Telegram confirms payment.',payload:order.id,currency:'XTR',provider_token:'',prices:[{label:title.slice(0,32),amount}]});
  const {error:saveError}=await db.from('star_orders').update({invoice_url:invoiceUrl}).eq('id',order.id);
  if(saveError) throw new HttpError(503,'Unable to prepare checkout.');
  return Response.json({orderId:order.id,invoiceUrl,amount,currency:'XTR'},{headers:{'Cache-Control':'no-store'}});
 } catch(error) {return errorResponse(error);}
}
