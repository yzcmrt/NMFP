import { checkOrigin, readSession, errorResponse, HttpError } from '@/server/auth';
import { database, requireOwned } from '@/server/db';
import { gameAction } from '@/server/game';
const catalogs = new Set(['car_models','garage_templates','tasks']);
const owned = new Set(['users','user_cars','garages','mining_sessions','transactions','ton_transactions','user_tasks','user_weekly_stats','user_daily_checkins']);
// Select shapes are server controlled; client supplied relation expansion is never forwarded.
const selects: Record<string,string> = {user_cars:'*,car_model:car_models(*)',mining_sessions:'*,user_car:user_cars(*,car_model:car_models(*)),garage:garages(*)',user_tasks:'*,task:tasks(*)'};
async function handle(request: Request, context: {params:Promise<{path:string[]}>}) {
 try {
  const session = readSession(request);
  const {path} = await context.params;
  const method = request.method;
  if (!['GET','HEAD'].includes(method)) checkOrigin(request);
  if (path.length === 2 && path[0] === 'rpc' && method === 'POST') {
   const body = await request.json();
   if (!body || Array.isArray(body) || typeof body !== 'object') throw new HttpError(400,'Invalid request.');
   return Response.json(await gameAction(path[1],body,session),{headers:{'Cache-Control':'no-store'}});
  }
  const table = path[0];
  if (path.length !== 1 || (!catalogs.has(table) && !owned.has(table))) throw new HttpError(404,'Resource not found.');
  const url = new URL(request.url);
  const query = new URLSearchParams(url.search);
  const ownerColumn = table === 'users' ? 'id' : 'user_id';
  if (owned.has(table)) query.set(ownerColumn,`eq.${session.userId}`);
  query.set('select',selects[table] || '*');
  query.set('limit',String(Math.min(200,Math.max(1,Number(query.get('limit')) || 100))));
  let body: string | undefined;
  if (method === 'PATCH' && table === 'users') {
   const input = await request.json();
   const update: Record<string,unknown> = {};
   for (const key of ['selected_car_id','selected_garage_id']) {
    if (input[key] !== undefined) { if (input[key] !== null) await requireOwned(key === 'selected_car_id'?'user_cars':'garages',input[key],session.userId); update[key] = input[key]; }
   }
   if (input.wallet_address !== undefined) {
    // A connected address is display-only. It never proves ownership or authorizes spending.
    if (input.wallet_address !== null && (typeof input.wallet_address !== 'string' || input.wallet_address.length > 100)) throw new HttpError(400,'Invalid wallet address.');
    update.wallet_address = input.wallet_address;
   }
   if (!Object.keys(update).length) throw new HttpError(403,'Profile change is not allowed.');
   body = JSON.stringify(update);
  } else if (!['GET','HEAD'].includes(method)) throw new HttpError(405,'Method not allowed.');
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new HttpError(503,'Database unavailable.');
  const headers = new Headers({'apikey':key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json'});
  const accept = request.headers.get('accept');
  if (accept?.includes('application/vnd.pgrst.object+json')) headers.set('Accept','application/vnd.pgrst.object+json');
  headers.set('Prefer','return=representation,count=exact');
  const response = await fetch(`${base}/rest/v1/${table}?${query}`,{method,body,headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
  if (!response.ok) { const err = await response.json().catch(()=>({})); return Response.json({message:err.code==='PGRST116'?'No matching record.':'Unable to load game data.',code:err.code},{status:response.status}); }
  const outputHeaders = new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});
  if (response.headers.has('content-range')) outputHeaders.set('content-range',response.headers.get('content-range')!);
  return new Response(method==='HEAD'?null:await response.text(),{status:response.status,headers:outputHeaders});
 } catch(error) { return errorResponse(error); }
}
export {handle as GET,handle as HEAD,handle as POST,handle as PATCH};
