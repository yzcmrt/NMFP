import {checkOrigin,readSession,errorResponse} from '@/server/auth';
import {gameAction} from '@/server/game';
export async function POST(request:Request){try{checkOrigin(request);const session=readSession(request);const body=await request.json(); const sessionId=await gameAction('start_mining',{p_car_id:body.carId,p_garage_id:body.garageId},session); return Response.json({success:true,sessionId});}catch(error){return errorResponse(error);}}
