import 'server-only';
import { HttpError } from './auth';
export async function telegram(method:string,body:Record<string,unknown>) {
 const token=process.env.TELEGRAM_BOT_TOKEN;
 if(!token) throw new HttpError(503,'Telegram is not configured.');
 const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 const result=await response.json();
 if(!result.ok && method==='refundStarPayment' && String(result.description).includes('CHARGE_ALREADY_REFUNDED')) return true;
 if(!response.ok || !result.ok) throw new HttpError(502,'Telegram could not complete this request. Please try again.');
 return result.result;
}
