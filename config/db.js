const fs = require('node:fs');
const path = require('node:path');
const {AsyncLocalStorage} = require('node:async_hooks');
const context = new AsyncLocalStorage();
let pool, sqlite, turso, queue=Promise.resolve();
const driver = process.env.DB_DRIVER || (process.env.TURSO_DATABASE_URL?'turso':'sqlite');
async function init() {
  if(driver==='turso'){
    const url=process.env.TURSO_DATABASE_URL;
    if(!url)throw Error('Tetapkan TURSO_DATABASE_URL dalam .env.');
    if(!url.startsWith('file:')&&!process.env.TURSO_AUTH_TOKEN)throw Error('Tetapkan TURSO_AUTH_TOKEN dalam .env.');
    turso=require('@libsql/client').createClient({url,authToken:process.env.TURSO_AUTH_TOKEN,intMode:'number'});
    await turso.execute('PRAGMA foreign_keys=ON');
    await turso.execute('SELECT 1');
  } else if (driver === 'sqlite') {
    if(process.env.NODE_ENV==='production') throw Error('SQLite is only supported for local development. Use Turso in production.');
    const {DatabaseSync} = require('node:sqlite');
    const file = process.env.SQLITE_PATH || 'data/fitadapt.sqlite';
    if(file!==':memory:') fs.mkdirSync(path.dirname(file),{recursive:true});
    sqlite = new DatabaseSync(file); sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  } else {
    pool = require('mysql2/promise').createPool({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'fitadapt',password:process.env.DB_PASSWORD,database:process.env.DB_NAME||'fitadapt',timezone:'Z',dateStrings:true,decimalNumbers:true,connectionLimit:10,charset:'utf8mb4'});
    await pool.query('SELECT 1');
  }
}
async function raw(sql,params=[]) {
  if(turso){const r=await (context.getStore()||turso).execute({sql,args:params});return /^\s*(SELECT|WITH|PRAGMA)/i.test(sql)?r.rows.map(row=>Object.fromEntries(Object.entries(row))):{insertId:Number(r.lastInsertRowid||0),affectedRows:r.rowsAffected};}
  if(sqlite) {const stmt=sqlite.prepare(sql); if(/^\s*(SELECT|WITH|PRAGMA)/i.test(sql)) return stmt.all(...params); const r=stmt.run(...params); return {insertId:Number(r.lastInsertRowid),affectedRows:Number(r.changes)};}
  const [rows]=await (context.getStore()||pool).execute(sql,params); return rows;
}
async function transaction(fn) {
  if(context.getStore()) return fn();
  if(turso){const tx=await turso.transaction('write');try{const result=await context.run(tx,fn);await tx.commit();return result;}catch(e){if(!tx.closed)await tx.rollback();throw e;}finally{tx.close();}}
  if(sqlite) {
    const previous=queue; let release; queue=new Promise(r=>release=r); await previous;
    sqlite.exec('BEGIN IMMEDIATE');
    try {const result=await context.run(true,fn);sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}finally{release();}
  }
  const conn=await pool.getConnection(); await conn.beginTransaction();
  try{const result=await context.run(conn,fn);await conn.commit();return result;}catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function query(sql,params=[]) {if(sqlite&&!context.getStore()) return transaction(()=>raw(sql,params));return raw(sql,params);}
async function one(sql,params=[]) {return (await query(sql,params))[0]||null;}
async function insert(table, data) {const keys=Object.keys(data);return (await query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,Object.values(data))).insertId;}
async function insertMany(table,rows){if(!rows.length)return;const keys=Object.keys(rows[0]);const sql=`INSERT INTO ${table} (${keys.join(',')}) VALUES ${rows.map(()=>`(${keys.map(()=>'?').join(',')})`).join(',')}`;return query(sql,rows.flatMap(r=>keys.map(k=>r[k])));}
async function update(table,data,where,params=[]) {const keys=Object.keys(data);return query(`UPDATE ${table} SET ${keys.map(k=>k+' = ?').join(',')} WHERE ${where}`,[...Object.values(data),...params]);}
async function close(){if(sqlite)sqlite.close();if(pool)await pool.end();if(turso)turso.close();}
module.exports={init,query,one,insert,insertMany,update,transaction,close,driver};
