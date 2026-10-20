import { checkOrigin, validateTelegramData, readSession, sessionCookie, errorResponse, HttpError } from '@/server/auth';
import { database } from '@/server/db';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { initData } = await request.json();
    const identity = validateTelegramData(initData, process.env.TELEGRAM_BOT_TOKEN || '');
    const db = database();
    const { data, error } = await db.rpc('get_or_create_user', { p_telegram_id: String(identity.id), p_username: identity.username || identity.first_name, p_is_premium: identity.is_premium === true, p_force_create: false });
    if (error || !data?.user_id) throw new HttpError(503, 'Unable to load your game account. Please try again.');
    const { data: user, error: userError } = await db.from('users').select('*').eq('id', data.user_id).single();
    if (userError || !user) throw new HttpError(503, 'Unable to load your game account.');
    return Response.json({ user, telegramUser: identity, isNew: data.is_new }, { headers: { 'Cache-Control': 'no-store', 'Set-Cookie': sessionCookie({ userId: user.id, telegramId: String(identity.id), exp: Math.floor(Date.now() / 1000) + 43200 }) } });
  } catch (error) { return errorResponse(error); }
}
export async function GET(request: Request) {
  try {
    const session = readSession(request);
    const { data: user, error } = await database().from('users').select('*').eq('id', session.userId).single();
    if (error) throw new HttpError(503, 'Unable to refresh your game account.');
    return Response.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
