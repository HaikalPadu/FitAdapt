const db=require('../config/db');
const schema=require('./schema');
async function migrate(){for(const sql of schema(db.driver))await db.query(sql); const indexes=[['idx_sessions_date','planned_sessions','scheduled_date,status'],['idx_logs_user','session_logs','user_id,started_at'],['idx_exercise_logs','exercise_logs','exercise_id,session_log_id'],['idx_events_user','adaptation_events','user_id,created_at'],['idx_exercises_filter','exercises','is_active,equipment_type,level']];for(const [name,table,cols] of indexes){try{await db.query(`CREATE INDEX ${name} ON ${table} (${cols})`);}catch(e){if(!/already exists|Duplicate key name/i.test(e.message))throw e;}}}
if(require.main===module) db.init().then(migrate).then(()=>console.log('Migrasi selesai.')).finally(()=>db.close()).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports=migrate;
