import {checkOrigin,readSession,errorResponse} from '@/server/auth';
import {gameAction} from '@/server/game';
export async function POST(request:Request){try{checkOrigin(request);const session=readSession(request);const body=await request.json();const result=await gameAction(body.action==='complete'?'complete_mining':'update_expired_mining_sessions',{p_mining_session_id:body.sessionId},session);return Response.json({success:true,data:result});}catch(error){return errorResponse(error);}}
export async function GET(request:Request){try{const session=readSession(request);const stats=await gameAction('get_user_mining_stats',{},session);return Response.json({success:true,stats});}catch(error){return errorResponse(error);}}
