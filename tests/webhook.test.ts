import {test} from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../src/app/api/telegram/webhook/route';
process.env.TELEGRAM_WEBHOOK_SECRET='test-webhook-secret';
process.env.TELEGRAM_BOT_TOKEN='test-bot-token';
process.env.SUPABASE_URL='https://db.test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';
const payment={message:{from:{id:123},successful_payment:{currency:'XTR',invoice_payload:'00000000-0000-4000-8000-000000000001',telegram_payment_charge_id:'test-charge',total_amount:50}}};
const req=(body:any,secret='test-webhook-secret')=>new Request('https://nmfp.test/api/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-bot-api-secret-token':secret},body:JSON.stringify(body)});
async function withFetch(fn:(url:string,init:any)=>Response|Promise<Response>,run:()=>Promise<void>){const original=global.fetch;global.fetch=async(input:any,init:any)=>fn(typeof input==='string'?input:input.url,init);try{await run();}finally{global.fetch=original;}}
test('webhook rejects missing secret including non-ASCII values without DB access',async()=>{await withFetch(()=>{throw new Error('Unexpected network');},async()=>{assert.equal((await POST(req(payment,''))).status,401);assert.equal((await POST(req(payment,'üüüü'))).status,401);});});
test('confirmed payment is delivered exclusively through atomic RPC',async()=>{let called=0;await withFetch((url,init)=>{assert.match(url,/db\.test\.invalid\/rest\/v1\/rpc\/nmfp_fulfill_star_order/);const b=JSON.parse(init.body);assert.equal(b.p_amount,50);assert.equal(b.p_telegram_id,'123');called++;return Response.json({success:true});},async()=>assert.equal((await POST(req(payment))).status,200));assert.equal(called,1);});
test('DB failure returns 500 for Telegram retry, never acknowledges delivery',async()=>{await withFetch(()=>Response.json({code:'XX000',message:'temporary failure'},{status:500}),async()=>assert.equal((await POST(req(payment))).status,500));});
test('duplicate item triggers refund then records refunded state',async()=>{const calls:string[]=[];await withFetch((url,init)=>{calls.push(url);if(url.includes('/rpc/'))return Response.json({refund_required:true});if(url.includes('api.telegram.org')){assert.match(url,/refundStarPayment$/);assert.equal(JSON.parse(init.body).telegram_payment_charge_id,'test-charge');return Response.json({ok:true,result:true});}assert.equal(init.method,'PATCH');assert.equal(JSON.parse(init.body).status,'refunded');return Response.json([]);},async()=>assert.equal((await POST(req(payment))).status,200));assert.equal(calls.length,3);});
test('non-Stars payment cannot deliver an item',async()=>{await withFetch(()=>{throw new Error('Unexpected network');},async()=>assert.equal((await POST(req({...payment,message:{...payment.message,successful_payment:{...payment.message.successful_payment,currency:'TON'}}}))).status,400));});
