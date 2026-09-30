// Explicit, one-time transfer. Defaults to read-only inspection; --apply copies
// into an empty database (or verifies an identical previous transfer).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync, backup } = require('node:sqlite');
const { createClient } = require('@libsql/client');
const schema = require('./schema');
const tables = schema('turso').map(sql => sql.match(/EXISTS (\w+)/)[1]);
const digest = rows => crypto.createHash('sha256').update(JSON.stringify(rows.map(row => Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest('hex');

async function main() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw Error('Turso URL/token missing.');
  const sourcePath = path.resolve(process.env.SQLITE_PATH || 'data/fitadapt.sqlite');
  if (!fs.existsSync(sourcePath)) throw Error('Local database not found.');
  const local = new DatabaseSync(sourcePath, { readOnly:true });
  const remote = createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN,intMode:'number'});
  try {
    const existing = (await remote.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows.map(r=>r.name);
    const source = {};
    for (const table of tables) {
      const columns=local.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
      const rows=local.prepare(`SELECT ${columns.join(',')} FROM ${table}`).all();
      source[table]={columns,rows};
      const count=existing.includes(table)?Number((await remote.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n):0;
      console.log(`${table}: local=${rows.length}, turso=${count}`);
      if(count) {
        const target=(await remote.execute(`SELECT ${columns.join(',')} FROM ${table}`)).rows;
        if(digest(rows)!==digest(target))throw Error(`Turso table ${table} contains different data. Stopped without overwriting records.`);
      }
    }
    if(!process.argv.includes('--apply')){console.log('Inspection complete; no changes made.');return;}
    const backupPath=path.resolve('data/backups',`before-turso-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
    fs.mkdirSync(path.dirname(backupPath),{recursive:true});await backup(local,backupPath);
    console.log('Local backup saved: '+path.relative(process.cwd(),backupPath));
    await remote.batch(schema('turso'),'write');
    const tx=await remote.transaction('write');
    try {
      for(const table of tables) {
        const {columns,rows}=source[table];
        const count=Number((await tx.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
        if(count){const target=(await tx.execute(`SELECT ${columns.join(',')} FROM ${table}`)).rows;if(digest(rows)!==digest(target))throw Error(`Concurrent changes detected in ${table}.`);continue;}
        for(let i=0;i<rows.length;i+=50){const chunk=rows.slice(i,i+50);await tx.execute({sql:`INSERT INTO ${table} (${columns.join(',')}) VALUES ${chunk.map(()=>`(${columns.map(()=>'?').join(',')})`).join(',')}`,args:chunk.flatMap(row=>columns.map(c=>row[c]))});}
      }
      for(const table of tables){const {columns,rows}=source[table];const target=(await tx.execute(`SELECT ${columns.join(',')} FROM ${table}`)).rows;if(digest(rows)!==digest(target))throw Error('Verification failed: '+table);}
      const violations=await tx.execute('PRAGMA foreign_key_check');if(violations.rows.length)throw Error('Foreign-key verification failed.');
      await tx.commit();
      console.log('Transfer committed. Every table verified against local data; foreign keys valid.');
    } catch(e){if(!tx.closed)await tx.rollback();throw e;} finally{tx.close();}
  } finally {local.close();remote.close();}
}
main().catch(e=>{console.error('Transfer stopped:',e.code||'',e.message);process.exitCode=1;});
