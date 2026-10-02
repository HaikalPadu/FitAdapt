process.env.DB_DRIVER='sqlite';
process.env.SQLITE_PATH=':memory:';
process.env.VERCEL='1';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const request=require('supertest');
const handler=require('../server');
const db=require('../config/db');
const Store=require('../services/rateLimitStore');
after(()=>db.close());
test('imported production handler initializes before concurrent requests',async()=>{
 assert.equal(typeof handler,'function');
 const results=await Promise.all([request(handler).get('/api/health'),request(handler).get('/api/health')]);
 for(const response of results){assert.equal(response.status,200);assert.equal(response.body.database,'sqlite');}
 await require('../db/migrate')();
});
test('cron fails closed without its configured secret',async()=>{
 delete process.env.CRON_SECRET;
 assert.equal((await request(handler).get('/api/cron/daily').set('Authorization','Bearer undefined')).status,401);
 process.env.CRON_SECRET='test-cron-secret';
 assert.equal((await request(handler).get('/api/cron/daily').set('Authorization','Bearer wrong')).status,401);
 assert.equal((await request(handler).get('/api/cron/daily').set('Authorization','Bearer test-cron-secret')).status,200);
});
test('rate limit counts survive separate store instances and expire',async()=>{
 const first=new Store(),second=new Store();
 first.init({windowMs:60000});second.init({windowMs:60000});
 assert.equal((await first.increment('client')).totalHits,1);
 assert.equal((await second.increment('client')).totalHits,2);
 await db.query('UPDATE auth_rate_limits SET reset_at=0');
 assert.equal((await first.increment('client')).totalHits,1);
 await second.resetKey('client');
 assert.equal((await first.increment('client')).totalHits,1);
});
