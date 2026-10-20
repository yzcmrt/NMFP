import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validPreCheckout} from '../src/server/paymentChecks';
const order={status:'pending',amount:199,expires_at:new Date(2000).toISOString(),telegram_id:'1'};
const query={currency:'XTR',total_amount:199,telegram_id:'1'};
test('valid pending Stars quote accepted',()=>assert.equal(validPreCheckout(order,query,1000),true));
test('wrong currency, price, owner, expiration, status and missing order denied',()=>{for(const q of [{...query,currency:'TON'},{...query,total_amount:1},{...query,telegram_id:'2'}])assert.equal(validPreCheckout(order,q,1000),false);for(const o of [null,{...order,status:'paid'},{...order,expires_at:new Date(500).toISOString()}])assert.equal(validPreCheckout(o,query,1000),false);});
