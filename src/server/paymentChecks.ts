/** Pure checks also exercised without issuing a real Telegram charge. */
export function validPreCheckout(order: {status:string;amount:number;expires_at:string;telegram_id:string} | null, query: {currency:string;total_amount:number;telegram_id:string}, now=Date.now()) {
 return Boolean(order && order.status==='pending' && order.amount===query.total_amount && query.currency==='XTR' && order.telegram_id===query.telegram_id && new Date(order.expires_at).getTime()>now);
}
