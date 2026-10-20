import { createHmac, timingSafeEqual } from 'node:crypto';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface TelegramIdentity { id: number; first_name: string; username?: string; is_premium?: boolean; photo_url?: string; }
export interface Session { userId: string; telegramId: string; exp: number; }
const cookieName = 'nmfp_session';
export function validateTelegramData(raw: string, token: string, now = Date.now() / 1000): TelegramIdentity {
  if (!token) throw new HttpError(503, 'Telegram authentication is not configured.');
  if (typeof raw !== 'string' || raw.length > 16384) throw new HttpError(401, 'Invalid Telegram session.');
  const params = new URLSearchParams(raw);
  if (new Set(params.keys()).size !== [...params.keys()].length) throw new HttpError(401, 'Duplicate authentication fields.');
  const hash = params.get('hash') || '';
  params.delete('hash');
  const date = Number(params.get('auth_date'));
  if (!Number.isSafeInteger(date) || now - date > 3600 || date > now + 30 || !/^[a-f0-9]{64}$/i.test(hash)) throw new HttpError(401, 'Please reopen the game from Telegram.');
  const data = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('\n');
  const key = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', key).update(data).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw new HttpError(401, 'Invalid Telegram signature.');
  let user: TelegramIdentity;
  try { user = JSON.parse(params.get('user') || 'null'); } catch { throw new HttpError(401, 'Invalid Telegram user.'); }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.first_name !== 'string') throw new HttpError(401, 'Invalid Telegram user.');
  return user;
}
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new HttpError(503, 'Session configuration is unavailable.');
  return value;
}
export function signSession(session: Session) {
  const body = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`;
}
export function readSession(request: Request): Session {
  const value = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!value || value.length > 2048) throw new HttpError(401, 'Open the game from Telegram to sign in.');
  const [body, signature, extra] = value.split('.');
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  if (extra || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new HttpError(401, 'Session expired. Reopen the game.');
  let session: Session;
  try { session = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw new HttpError(401, 'Invalid session.'); }
  if (!session || !/^[a-f0-9-]{36}$/i.test(session.userId) || !/^\d+$/.test(session.telegramId) || !Number.isFinite(session.exp) || session.exp <= Date.now() / 1000) throw new HttpError(401, 'Session expired. Reopen the game.');
  return session;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(request.url).origin;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin || (origin !== expected && origin !== site)) throw new HttpError(403, 'Request origin is not allowed.');
}
export function sessionCookie(session: Session) {
  return `${cookieName}=${signSession(session)}; HttpOnly; Path=/; Max-Age=43200${process.env.NODE_ENV === 'production' ? '; SameSite=None; Secure; Partitioned' : '; SameSite=Lax'}`;
}
export function errorResponse(error: unknown) {
  const status = error instanceof HttpError ? error.status : 500;
  if (status === 500) console.error('Request failed:', error instanceof Error ? error.message : 'unknown');
  return Response.json({ success: false, message: status === 500 ? 'The request could not be completed. Please try again.' : (error as Error).message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
