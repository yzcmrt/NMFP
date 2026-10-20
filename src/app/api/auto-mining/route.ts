import { checkOrigin, readSession, errorResponse, HttpError } from '@/server/auth';
export async function POST(request:Request) {
 try { checkOrigin(request); readSession(request); throw new HttpError(409,'This payment route has been retired. No payment was accepted.'); }
 catch(error) { return errorResponse(error); }
}
