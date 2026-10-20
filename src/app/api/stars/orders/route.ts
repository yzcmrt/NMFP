import { readSession,errorResponse,HttpError } from '@/server/auth';
import { database } from '@/server/db';
export async function GET(request:Request) {
 try {
  const session=readSession(request),id=new URL(request.url).searchParams.get('id');
  const query=database().from('star_orders').select('id,kind,title,amount,status,created_at,delivered_id').eq('user_id',session.userId).order('created_at',{ascending:false}).limit(30);
  if(id)query.eq('id',id);
  const {data,error}=await query;
  if(error)throw new HttpError(503,'Unable to load orders.');
  return Response.json({orders:data},{headers:{'Cache-Control':'no-store'}});
 } catch(error){return errorResponse(error);}
}
