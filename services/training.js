const db=require('../config/db');
const generator=require('./planGenerator');
const engine=require('./adaptiveEngine');
const {today,addDays,weekStart,utc,parseUtc}=require('./dates');
const {fail}=require('../middleware/errors');
async function profile(userId){const p=await db.one('SELECT * FROM profiles WHERE user_id=?',[userId]);if(p){const preference=await db.one('SELECT duration_minutes FROM profile_preferences WHERE user_id=?',[userId]);if(preference)p.session_minutes=preference.duration_minutes;}if(p)p.days=(await db.query('SELECT weekday FROM profile_days WHERE profile_id=? ORDER BY weekday',[p.id])).map(r=>r.weekday);return p;}
async function catalog(){const rows=await db.query('SELECT * FROM exercises ORDER BY id');const tags=await db.query('SELECT * FROM exercise_limitation_tags');return rows.map(e=>({...e,tags:tags.filter(t=>t.exercise_id===e.id).map(t=>t.tag)}));}
async function sessions(planId){const rows=await db.query('SELECT * FROM planned_sessions WHERE plan_id=? ORDER BY scheduled_date',[planId]);const ex=await db.query('SELECT pe.*,e.name,e.muscle_group,e.split_tag,e.movement_focus,e.equipment_type,e.instructions,e.image_url,e.load_increment_kg FROM planned_exercises pe JOIN exercises e ON e.id=pe.exercise_id JOIN planned_sessions ps ON ps.id=pe.planned_session_id WHERE ps.plan_id=? ORDER BY pe.order_no',[planId]);return rows.map(s=>({...s,exercises:ex.filter(e=>e.planned_session_id===s.id)}));}
async function storeSessions(planId,items){
 await db.insertMany('planned_sessions',items.map(s=>({plan_id:planId,scheduled_date:s.scheduled_date,is_rest:s.is_rest,session_label:s.session_label,status:'scheduled'})));
 const stored=await db.query('SELECT id,scheduled_date FROM planned_sessions WHERE plan_id=?',[planId]);
 await db.insertMany('planned_exercises',items.flatMap(s=>s.exercises.map(e=>({planned_session_id:stored.find(row=>row.scheduled_date===s.scheduled_date).id,exercise_id:e.exercise_id,order_no:e.order_no,target_sets:e.target_sets,target_rep_min:e.target_rep_min,target_rep_max:e.target_rep_max,target_weight_kg:e.target_weight_kg}))));
}
async function notify(userId,type,message){await db.insert('notifications',{user_id:userId,type,message});}
async function makePlan(userId,p,startDate,reason='initial'){
 const old=await db.one("SELECT * FROM plans WHERE user_id=? AND status='active'",[userId]);
 const oldSessions=old?await sessions(old.id):[];
 const history=oldSessions.filter(s=>s.scheduled_date<startDate);
 const result=generator.generate(p,await catalog(),startDate,14,history);
 if(old){await db.update('plans',{status:'archived'},'id=?',[old.id]);await db.query("DELETE FROM planned_sessions WHERE plan_id=? AND scheduled_date>=? AND status='scheduled'",[old.id,startDate]);}
 const version=await db.one('SELECT MAX(version) AS n FROM plans WHERE user_id=?',[userId]);
 const planId=await db.insert('plans',{user_id:userId,version:(version.n||0)+1,status:'active',split_type:result.split_type,generated_by:reason,adjusted_at:utc(),adjustment_reason:reason==='initial'?'Pelan pertama dijana mengikut profil anda.':'Pelan dilaraskan mengikut perubahan profil.'});
 // Keep today's session attached to the active plan without changing its logs or targets.
 if(old&&startDate>today())await db.query('UPDATE planned_sessions SET plan_id=? WHERE plan_id=? AND scheduled_date=?',[planId,old.id,today()]);
 await storeSessions(planId,result.sessions);
 if(reason!=='initial')await notify(userId,'plan_adjusted','Profil dikemas kini. Pelan baharu bermula esok.');
 return planId;
}
async function saveProfile(userId,data,initial=false){return db.transaction(async()=>{
 const old=await profile(userId);if(initial&&old)fail(409,'ALREADY_ONBOARDED','Profil telah dilengkapkan. Gunakan tetapan profil.');
 if(!old&&data.plan_start_date<today())fail(422,'INVALID_START_DATE','Tarikh mula tidak boleh sebelum hari ini.');
 const {days,full_name,...values}=data;
 if(full_name)await db.update('users',{full_name,updated_at:utc()},'id=?',[userId]);
 // Retain the legacy constrained column for existing databases and rollback compatibility.
 const storedValues={...values,session_minutes:values.session_minutes<=30?30:values.session_minutes>=60?60:45};
 const id=old?.id||await db.insert('profiles',{...storedValues,user_id:userId});
 if(old)await db.update('profiles',{...storedValues,updated_at:utc()},'id=?',[id]);
 await db.query('DELETE FROM profile_preferences WHERE user_id=?',[userId]);
 await db.insert('profile_preferences',{user_id:userId,duration_minutes:values.session_minutes});
 await db.query('DELETE FROM profile_days WHERE profile_id=?',[id]);for(const weekday of days)await db.insert('profile_days',{profile_id:id,weekday});
 const changed=!old||['goal','level','equipment_level','limitation_notes','session_minutes'].some(k=>String(old[k]||'')!==String(values[k]||''))||JSON.stringify(old.days)!==JSON.stringify([...days].sort((a,b)=>a-b));
 if(changed)await makePlan(userId,{...values,days},old?addDays(today(),1):values.plan_start_date,old?'profile_update':'initial');
 return profile(userId);
});}
async function ownedSession(id,userId){const s=await db.one('SELECT ps.*,p.user_id,p.locked_by_coach FROM planned_sessions ps JOIN plans p ON p.id=ps.plan_id WHERE ps.id=? AND p.user_id=?',[id,userId]);if(!s)fail(404,'NOT_FOUND','Sesi tidak ditemui.');return s;}
async function ownedLog(id,userId){const log=await db.one('SELECT sl.*,ps.session_label,ps.scheduled_date,ps.plan_id FROM session_logs sl JOIN planned_sessions ps ON ps.id=sl.planned_session_id WHERE sl.id=? AND sl.user_id=?',[id,userId]);if(!log)fail(404,'NOT_FOUND','Log tidak ditemui.');return log;}
function assertEditable(log){if((log.edit_locked_at&&Date.now()>=parseUtc(log.edit_locked_at).getTime())||(!log.ended_at&&log.scheduled_date&&Date.now()>=Date.parse(addDays(log.scheduled_date,2)+'T00:00:00+08:00')))fail(403,'LOG_LOCKED','Log dikunci selepas 24 jam.');}
async function getLog(id,userId){const log=await ownedLog(id,userId);const ex=await db.query('SELECT el.*,pe.target_sets,pe.target_rep_min,pe.target_rep_max,pe.target_weight_kg,e.name,e.instructions,e.muscle_group,e.image_url FROM exercise_logs el JOIN planned_exercises pe ON pe.id=el.planned_exercise_id JOIN exercises e ON e.id=el.exercise_id WHERE el.session_log_id=? ORDER BY pe.order_no',[id]);for(const e of ex)e.sets=await db.query('SELECT * FROM set_logs WHERE exercise_log_id=? ORDER BY set_no',[e.id]);return {...log,locked:!!log.edit_locked_at&&Date.now()>=parseUtc(log.edit_locked_at).getTime(),exercises:ex};}
async function startSession(id,userId){return db.transaction(async()=>{
 const s=await ownedSession(id,userId);if(s.is_rest||s.scheduled_date!==today()||!['scheduled','rescheduled','in_progress'].includes(s.status))fail(409,'SESSION_UNAVAILABLE','Sesi hanya boleh dimulakan pada hari latihan yang dijadualkan.');
 const existing=await db.one('SELECT id FROM session_logs WHERE planned_session_id=?',[id]);if(existing)return getLog(existing.id,userId);
 const logId=await db.insert('session_logs',{planned_session_id:Number(id),user_id:userId,status:'in_progress'});
 for(const e of await db.query('SELECT * FROM planned_exercises WHERE planned_session_id=?',[id]))await db.insert('exercise_logs',{session_log_id:logId,planned_exercise_id:e.id,exercise_id:e.exercise_id,status:'missed'});
 await db.update('planned_sessions',{status:'in_progress'},'id=?',[id]);return getLog(logId,userId);
});}
async function refreshStatus(log){const rows=await db.query('SELECT status FROM exercise_logs WHERE session_log_id=?',[log.id]);const avg=await db.one('SELECT AVG(s.rpe) AS rpe FROM set_logs s JOIN exercise_logs e ON e.id=s.exercise_log_id WHERE e.session_log_id=?',[log.id]);const status=engine.sessionStatus(rows.map(r=>r.status));await db.update('session_logs',{session_rpe:avg.rpe??null,...(log.ended_at?{status}:{})},'id=?',[log.id]);if(log.ended_at)await db.update('planned_sessions',{status},'id=?',[log.planned_session_id]);return status;}
async function adapt(userId,exerciseId,sourceLogId){
 const plan=await db.one("SELECT * FROM plans WHERE user_id=? AND status='active'",[userId]);if(!plan||plan.locked_by_coach)return;
 const later=await db.one('SELECT sl.id FROM exercise_logs el JOIN session_logs sl ON sl.id=el.session_log_id WHERE sl.user_id=? AND el.exercise_id=? AND sl.id>? AND el.avg_rpe IS NOT NULL LIMIT 1',[userId,exerciseId,sourceLogId]);if(later)return;
 const history=await db.query("SELECT el.*,pe.target_sets,pe.target_rep_min,pe.target_rep_max,pe.target_weight_kg FROM exercise_logs el JOIN session_logs sl ON sl.id=el.session_log_id JOIN planned_exercises pe ON pe.id=el.planned_exercise_id WHERE sl.user_id=? AND el.exercise_id=? AND sl.ended_at IS NOT NULL AND el.avg_rpe IS NOT NULL ORDER BY sl.started_at DESC,sl.id DESC LIMIT 3",[userId,exerciseId]);if(!history.length)return;
 for(const h of history)h.sets=await db.query('SELECT * FROM set_logs WHERE exercise_log_id=? ORDER BY set_no',[h.id]);
 const target={...history[0],...await db.one('SELECT load_increment_kg FROM exercises WHERE id=?',[exerciseId])};
 const start=weekStart(today()),cutoff=utc(new Date(start+'T00:00:00+08:00'));
 const changed=await db.one("SELECT id FROM adaptation_events WHERE user_id=? AND exercise_id=? AND action IN ('increase_load','reduce_load') AND created_at>=? LIMIT 1",[userId,exerciseId,cutoff]);
 const output=engine.evaluate(history,target,{changedThisWeek:!!changed});if(!output)return;
 const sourceKey=`exercise:${history[0].id}:${output.ruleCode}`;if(await db.one('SELECT id FROM adaptation_events WHERE source_key=?',[sourceKey]))return;
 if(output.newWeight!==undefined&&['increase_load','reduce_load'].includes(output.action))await db.query("UPDATE planned_exercises SET target_weight_kg=? WHERE exercise_id=? AND planned_session_id IN (SELECT id FROM planned_sessions WHERE plan_id=? AND scheduled_date>? AND status='scheduled')",[output.newWeight,exerciseId,plan.id,today()]);
 await db.insert('adaptation_events',{user_id:userId,plan_id:plan.id,exercise_id:exerciseId,source_key:sourceKey,rule_code:output.ruleCode,action:output.action,old_value:String(target.target_weight_kg??0),new_value:output.newWeight===undefined?null:String(output.newWeight),reason_text:output.reasonText});await db.update('plans',{adjusted_at:utc(),adjustment_reason:output.reasonText},'id=?',[plan.id]);await notify(userId,'plan_adjusted',output.reasonText);
}
async function saveExercise(logId,exerciseLogId,userId,data){return db.transaction(async()=>{
 const log=await ownedLog(logId,userId);assertEditable(log);
 const ex=await db.one('SELECT el.*,pe.target_sets FROM exercise_logs el JOIN planned_exercises pe ON pe.id=el.planned_exercise_id WHERE el.id=? AND el.session_log_id=?',[exerciseLogId,logId]);if(!ex)fail(404,'NOT_FOUND','Senaman tidak ditemui.');
 if(data.sets.some(s=>s.set_no>ex.target_sets))fail(422,'INVALID_SET','Nombor set melebihi sasaran.');
 await db.query('DELETE FROM set_logs WHERE exercise_log_id=?',[exerciseLogId]);for(const s of data.sets)await db.insert('set_logs',{exercise_log_id:Number(exerciseLogId),...s});
 await db.update('exercise_logs',{status:engine.logStatus(data.sets.length,ex.target_sets),avg_rpe:data.sets.length?data.sets.reduce((n,s)=>n+s.rpe,0)/data.sets.length:null,top_weight_kg:data.sets.length?Math.max(...data.sets.map(s=>s.weight_kg)):null,notes:data.notes},'id=?',[exerciseLogId]);
 await refreshStatus(log);if(log.ended_at)await adapt(userId,ex.exercise_id,log.id);return getLog(logId,userId);
});}
async function finishSession(id,userId){return db.transaction(async()=>{
 const log=await ownedLog(id,userId);if(log.ended_at)return getLog(id,userId);
 const ended=log.scheduled_date<today()?new Date(addDays(log.scheduled_date,1)+'T00:00:00+08:00'):new Date();const end=utc(ended),lock=utc(new Date(ended.getTime()+require('../config/engineRules').editWindowHours*3600000));await db.update('session_logs',{ended_at:end,edit_locked_at:lock},'id=?',[id]);await refreshStatus({...log,ended_at:end});for(const e of await db.query('SELECT exercise_id FROM exercise_logs WHERE session_log_id=?',[id]))await adapt(userId,e.exercise_id,Number(id));return getLog(id,userId);
});}
module.exports={profile,catalog,sessions,storeSessions,notify,makePlan,saveProfile,ownedSession,ownedLog,assertEditable,getLog,startSession,saveExercise,finishSession,adapt};
