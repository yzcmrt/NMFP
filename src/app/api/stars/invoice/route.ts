import { checkOrigin,readSession,errorResponse,HttpError } from '@/server/auth';
import { database } from '@/server/db';
import {normalizeRecipient,UPGRADE_STARS} from '@/lib/nft/contract';
import {requireNftAvailable} from '@/server/nft/availability';
import { telegram } from '@/server/telegram';
export async function POST(request:Request) {
 try {
  checkOrigin(request); const session=readSession(request);
  const {kind,productId,termsAccepted,recipientAddress}=await request.json();
  if(termsAccepted!==true) throw new HttpError(400,'Please accept the purchase terms.');
  if(!['car','garage','premium','nft_car','nft_upgrade'].includes(kind)||typeof productId!=='string'||productId.length>100) throw new HttpError(400,'Invalid product.');
  const nft=kind==='nft_car'||kind==='nft_upgrade';let recipient:string|undefined;
  if(nft){try{recipient=normalizeRecipient(recipientAddress);}catch{throw new HttpError(400,'Geçerli bir TON mainnet cüzdanı seçin.');}await requireNftAvailable();}
  const db=database();
  const {count,error:countError}=await db.from('star_orders').select('id',{count:'exact',head:true}).eq('user_id',session.userId).gte('created_at',new Date(Date.now()-60000).toISOString());
  if(countError) throw new HttpError(503,'Checkout is temporarily unavailable.');
  if((count || 0)>=5) throw new HttpError(429,'Please wait a minute before trying again.');
  let title='Auto mining · 365 days',amount=199;
  if(kind==='premium' && productId!=='annual') throw new HttpError(400,'Invalid plan.');
  if(kind==='nft_upgrade'){
   const carId=Number(productId);if(!Number.isSafeInteger(carId)||carId<=0)throw new HttpError(400,'Geçersiz araç.');
   const car=await db.from('user_cars').select('id,name').eq('id',carId).eq('user_id',session.userId).neq('status','sold').maybeSingle();
   if(car.error||!car.data)throw new HttpError(404,'Araç bulunamadı.');
   const existing=await db.from('nft_jobs').select('id').eq('car_id',carId).maybeSingle();if(existing.error)throw new HttpError(503,'NFT kaydı kontrol edilemedi.');if(existing.data)throw new HttpError(409,'Bu araç için NFT talebi zaten var.');
   title=car.data.name+' NFT';amount=UPGRADE_STARS;
  } else if(kind!=='premium') {
   const {data,error}=await db.from((kind==='car'||kind==='nft_car')?'car_models':'garage_templates').select('*').eq('id',productId).single();
   if(error || !data) throw new HttpError(404,'Product not found.');
   amount=data.stars_price+(kind==='nft_car'?UPGRADE_STARS:0); title=data.name+(nft?' + NFT':'');
   const {count:owned,error:ownedError}=await db.from((kind==='car'||kind==='nft_car')?'user_cars':'garages').select('id',{count:'exact',head:true}).eq('user_id',session.userId).eq((kind==='car'||kind==='nft_car')?'car_model_id':'template_id',productId);
   if(ownedError) throw new HttpError(503,'Unable to check your garage.');
   if(owned) throw new HttpError(409,'You already own this item.');
  }
  if(!Number.isSafeInteger(amount)||amount<=0) throw new HttpError(503,'Price unavailable.');
  const {data:order,error}=await db.from('star_orders').insert({user_id:session.userId,kind,product_id:productId,amount,title,...(nft?{recipient_address:recipient}:{})}).select('*').single();
  if(error) throw new HttpError(503,'Unable to create order.');
  const invoiceUrl=await telegram('createInvoiceLink',{title:title.slice(0,32),description:nft?'NFT collectible delivered automatically to the selected TON address after confirmed Stars payment. In-game car remains in this account.':kind==='premium'?'365 days of automatic mining. One-time payment; no automatic renewal.':'One in-game item. No cash value. Delivered after Telegram confirms payment.',payload:order.id,currency:'XTR',provider_token:'',prices:[{label:title.slice(0,32),amount}]});
  const {error:saveError}=await db.from('star_orders').update({invoice_url:invoiceUrl}).eq('id',order.id);
  if(saveError) throw new HttpError(503,'Unable to prepare checkout.');
  return Response.json({orderId:order.id,invoiceUrl,amount,currency:'XTR'},{headers:{'Cache-Control':'no-store'}});
 } catch(error) {return errorResponse(error);}
}
