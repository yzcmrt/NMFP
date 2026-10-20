import {checkOrigin,readSession,errorResponse,HttpError} from '@/server/auth';
import {database} from '@/server/db';
import {telegram} from '@/server/telegram';
export async function POST(request:Request){
 try{
  checkOrigin(request);const session=readSession(request);const {taskId}=await request.json();
  if(!Number.isSafeInteger(Number(taskId)))throw new HttpError(400,'Invalid task.');
  const db=database();const {data:task,error}=await db.from('tasks').select('*').eq('id',taskId).eq('is_active',true).single();
  if(error||!task)throw new HttpError(404,'Task not found.');
  const type=task.verification_type;
  if(type==='channel_join'){
   const channel=task.verification_data?.channel_username;
   if(typeof channel!=='string'||!/^@?[A-Za-z0-9_]{5,32}$/.test(channel))throw new HttpError(503,'This task is not configured.');
   const member=await telegram('getChatMember',{chat_id:channel.startsWith('@')?channel:`@${channel}`,user_id:Number(session.telegramId)});
   if(!['member','administrator','creator'].includes(member.status))throw new HttpError(409,'Join the channel first.');
  }else if(!['link_click','mining_complete','car_repair','car_refill','car_purchase_nmfp','car_purchase_ton','car_mint_nft','collect_bonus'].includes(type))throw new HttpError(409,'This task cannot be verified automatically.');
  const {data,error:verifyError}=await db.rpc('verify_telegram_task',{p_user_id:session.userId,p_telegram_id:session.telegramId,p_task_id:Number(taskId)});
  if(verifyError)throw new HttpError(503,'Unable to save task progress.');
  return Response.json({success:data.success,message:data.message,result:data});
 }catch(error){return errorResponse(error);}
}
