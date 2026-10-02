const crypto=require('node:crypto');
const db=require('../config/db');
const hash=key=>crypto.createHash('sha256').update(key).digest('hex');
module.exports=class DatabaseRateLimitStore {
 init(options){this.windowMs=options.windowMs;}
 async increment(key){
  const bucket=hash(key),now=Date.now(),reset=now+this.windowMs;
  return db.transaction(async()=>{
   if(db.driver==='mysql'){
    await db.query('INSERT INTO auth_rate_limits (bucket_key,hits,reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=IF(reset_at<=?,1,hits+1),reset_at=IF(reset_at<=?,?,reset_at)',[bucket,reset,now,now,reset]);
   }else{
    await db.query('INSERT INTO auth_rate_limits (bucket_key,hits,reset_at) VALUES (?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET hits=CASE WHEN reset_at<=? THEN 1 ELSE hits+1 END,reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END',[bucket,reset,now,now,reset]);
   }
   const row=await db.one('SELECT hits,reset_at FROM auth_rate_limits WHERE bucket_key=?',[bucket]);
   return {totalHits:Number(row.hits),resetTime:new Date(Number(row.reset_at))};
  });
 }
 async decrement(key){await db.query('UPDATE auth_rate_limits SET hits=CASE WHEN hits>0 THEN hits-1 ELSE 0 END WHERE bucket_key=?',[hash(key)]);}
 async resetKey(key){await db.query('DELETE FROM auth_rate_limits WHERE bucket_key=?',[hash(key)]);}
};
