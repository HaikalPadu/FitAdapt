const db=require('../config/db');
const training=require('./training');
const engine=require('./adaptiveEngine');
const generator=require('./planGenerator');
const rules=require('../config/engineRules');
const {today,addDays,weekStart,utc}=require('./dates');
async function reconcileUser(userId,date=today()){return db.transaction(async()=>{
 const plan=await db.one("SELECT * FROM plans WHERE user_id=? AND status='active'",[userId]);if(!plan||plan.locked_by_coach)return;
 const p=await training.profile(userId);let sessions=await training.sessions(plan.id);
 const last=sessions.at(-1)?.scheduled_date;
 if(last&&last<addDays(date,13)){
  const start=addDays(last,1);const count=Math.floor((Date.parse(addDays(date,13))-Date.parse(start))/86400000)+1;
  if(count>0){const generated=generator.generate(p,await training.catalog(),start,count,sessions);for(const s of generated.sessions)for(const e of s.exercises){const latest=[...sessions].reverse().flatMap(s=>s.exercises).find(x=>x.exercise_id===e.exercise_id);if(latest)e.target_weight_kg=latest.target_weight_kg;}await training.storeSessions(plan.id,generated.sessions);sessions=await training.sessions(plan.id);}
 }
 for(const missed of sessions.filter(s=>!s.is_rest&&s.scheduled_date<date&&['scheduled','rescheduled','in_progress'].includes(s.status))){
  const log=await db.one('SELECT * FROM session_logs WHERE planned_session_id=?',[missed.id]);
   if(log){const has=await db.one('SELECT s.id FROM set_logs s JOIN exercise_logs e ON e.id=s.exercise_log_id WHERE e.session_log_id=? LIMIT 1',[log.id]);if(has){const finished=await training.finishSession(log.id,userId);missed.status=finished.status;continue;}await db.update('session_logs',{status:'missed',ended_at:utc(),edit_locked_at:utc()},'id=?',[log.id]);}
  await db.update('planned_sessions',{status:'missed'},'id=?',[missed.id]);missed.status='missed';await training.notify(userId,'missed_session',`Sesi ${missed.session_label} pada ${missed.scheduled_date} terlepas.`);
  const result=engine.reschedule(missed,sessions,p.days,date);let reason;
  if(result.action==='reschedule'){
   const destination=sessions.find(s=>s.scheduled_date===result.date);await db.update('planned_sessions',{is_rest:0,session_label:missed.session_label,original_date:missed.scheduled_date,status:'rescheduled'},'id=?',[destination.id]);
   for(const e of missed.exercises)await db.insert('planned_exercises',{planned_session_id:destination.id,exercise_id:e.exercise_id,order_no:e.order_no,target_sets:e.target_sets,target_rep_min:e.target_rep_min,target_rep_max:e.target_rep_max,target_weight_kg:e.target_weight_kg});
   destination.is_rest=0;destination.exercises=missed.exercises;reason=`Sesi terlepas dijadualkan semula pada ${result.date}.`;
  }else{
   const next=sessions.find(s=>!s.is_rest&&s.scheduled_date>=result.date&&s.scheduled_date>=date&&s.status==='scheduled');
   const focus=missed.exercises[0]?.split_tag||'legs';
   if(next){
    await db.update('planned_sessions',{carry_over_focus:focus},'id=?',[next.id]);
    if(!next.exercises.some(e=>e.split_tag===focus)){
     const neighbors=sessions.filter(s=>s.id!==next.id&&!s.is_rest&&Math.abs(Date.parse(s.scheduled_date)-Date.parse(next.scheduled_date))<172800000).flatMap(s=>s.exercises);
     const replacement=(await training.catalog()).find(e=>e.split_tag===focus&&generator.eligible(e,p)&&!neighbors.some(n=>n.muscle_group===e.muscle_group));
     if(replacement&&next.exercises.length){const previous=next.exercises.at(-1);const weight=p.level==='beginner'?replacement.base_load_beginner_kg:replacement.base_load_intermediate_kg;await db.update('planned_exercises',{exercise_id:replacement.id,target_weight_kg:weight},'id=?',[previous.id]);Object.assign(previous,{exercise_id:replacement.id,split_tag:replacement.split_tag,muscle_group:replacement.muscle_group});}
    }
    const preferred=next.exercises.filter(e=>e.split_tag===focus);const other=next.exercises.filter(e=>e.split_tag!==focus);const ordered=[...preferred,...other];for(let i=0;i<ordered.length;i++)await db.update('planned_exercises',{order_no:100+i},'id=?',[ordered[i].id]);for(let i=0;i<ordered.length;i++)await db.update('planned_exercises',{order_no:i+1},'id=?',[ordered[i].id]);
   }
   reason='Sesi kekal terlepas. Fokus latihan dibawa ke minggu seterusnya.';
  }
  await db.insert('adaptation_events',{user_id:userId,plan_id:plan.id,source_key:`missed:${missed.id}`,rule_code:'BR-19',action:result.action,reason_text:reason});await training.notify(userId,'plan_adjusted',reason);
 }
 const ended=sessions.filter(s=>!s.is_rest&&s.scheduled_date<date).sort((a,b)=>b.scheduled_date.localeCompare(a.scheduled_date));
 let missedCount=0;for(const s of ended){if(s.status==='missed')missedCount++;else break;}
 const nextWeek=addDays(weekStart(date),7),key=`volume:${plan.id}:${nextWeek}`;
 if(missedCount>=rules.missed.consecutiveForVolumeCut&&!await db.one('SELECT id FROM adaptation_events WHERE source_key=?',[key])){
  const future=sessions.filter(s=>!s.is_rest&&s.scheduled_date>=nextWeek&&s.scheduled_date<addDays(nextWeek,7)&&s.status==='scheduled');
  if(future.length){for(const s of future){await db.update('planned_sessions',{volume_modifier:0.75},'id=?',[s.id]);for(const e of s.exercises)await db.update('planned_exercises',{target_sets:engine.reduceVolume(e.target_sets)},'id=?',[e.id]);}const reason='Dua sesi berturut-turut terlepas. Satu set dikurangkan bagi setiap senaman minggu depan.';await db.insert('adaptation_events',{user_id:userId,plan_id:plan.id,source_key:key,rule_code:'BR-20',action:'reduce_volume',reason_text:reason});await training.notify(userId,'plan_adjusted',reason);}
 }
});}
async function runDaily(){await db.query('DELETE FROM auth_sessions WHERE expires_at<?',[utc()]);const users=await db.query("SELECT user_id FROM plans WHERE status='active'");for(const u of users)try{await reconcileUser(u.user_id);}catch(e){console.error('Scheduler user',u.user_id,e.message);}}
module.exports={reconcileUser,runDaily};
