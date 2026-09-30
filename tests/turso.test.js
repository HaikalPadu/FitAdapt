process.env.DB_DRIVER='turso';process.env.TURSO_DATABASE_URL='file::memory:';
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');
const db=require('../config/db');
before(async()=>{await db.init();await require('../db/migrate')();});after(()=>db.close());
test('Turso libSQL schema, parameterized queries, transaction rollback and cascades',async()=>{
 const id=await db.insert('users',{full_name:'Turso test',email:'turso@example.test',password_hash:'test-only'});assert.equal(typeof id,'number');
 assert.equal((await db.one('SELECT full_name FROM users WHERE id=?',[id])).full_name,'Turso test');
 await assert.rejects(()=>db.transaction(async()=>{await db.update('users',{full_name:'Should rollback'},'id=?',[id]);throw Error('rollback');}));assert.equal((await db.one('SELECT full_name FROM users WHERE id=?',[id])).full_name,'Turso test');
 await db.transaction(async()=>{await db.insert('notifications',{user_id:id,type:'info',message:'Hello'});await db.transaction(()=>db.insert('notifications',{user_id:id,type:'info',message:'Nested'}));});
 await db.query('DELETE FROM users WHERE id=?',[id]);assert.equal((await db.one('SELECT COUNT(*) AS n FROM notifications')).n,0);
});
test('Turso seed and plan generation through real libSQL client',async()=>{process.env.SEED_ADMIN_PASSWORD='Turso-Test-Password!';process.env.SEED_USER_PASSWORD='Turso-User-Password!';await require('../db/seed')();const plan=await db.one("SELECT id FROM plans WHERE status='active'");assert.ok(plan);assert.equal((await require('../services/training').sessions(plan.id)).length,14);});
