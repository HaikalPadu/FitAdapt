process.env.DB_DRIVER='sqlite';process.env.SQLITE_PATH=':memory:';
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');
const db=require('../config/db'),t=require('../services/training'),scheduler=require('../services/scheduler');
const {today,addDays,weekStart,utc}=require('../services/dates');
let id,p;
before(async()=>{await db.init();await require('../db/migrate')();process.env.SEED_ADMIN_PASSWORD='Training-Test-Password!';process.env.SEED_USER_PASSWORD='Training-User-Password!';await require('../db/seed')();id=(await db.one("SELECT id FROM users WHERE email='user@fitadapt.com'")).id;p=await t.profile(id);});
after(()=>db.close());
test('missed sessions reconcile once, carry focus, cut next-week volume and extend plan',async()=>{
 const start=addDays(weekStart(today()),-7);await db.transaction(()=>t.makePlan(id,p,start));await scheduler.reconcileUser(id);
 const plan=await db.one("SELECT * FROM plans WHERE user_id=? AND status='active'",[id]),sessions=await t.sessions(plan.id),events=await db.query('SELECT * FROM adaptation_events WHERE plan_id=?',[plan.id]);
 assert.ok(sessions.some(s=>s.status==='missed'));assert.ok(events.some(e=>e.rule_code==='BR-19'));assert.ok(events.some(e=>e.rule_code==='BR-20'));assert.ok(sessions.some(s=>s.carry_over_focus));
 const next=addDays(weekStart(today()),7);assert.ok(sessions.filter(s=>!s.is_rest&&s.scheduled_date>=next&&s.scheduled_date<addDays(next,7)).every(s=>s.volume_modifier===0.75&&s.exercises.every(e=>e.target_sets===2)));
 await scheduler.reconcileUser(id);assert.equal((await db.query('SELECT * FROM adaptation_events WHERE plan_id=?',[plan.id])).length,events.length);
 assert.ok(sessions.at(-1).scheduled_date>=addDays(today(),13));
});
test('profile regeneration preserves today and past sessions and archives previous version',async()=>{
 const active=await db.one("SELECT id FROM plans WHERE user_id=? AND status='active'",[id]),before=await t.sessions(active.id);const present=before.find(s=>s.scheduled_date===today());
 await t.saveProfile(id,{goal:'general_fitness',level:p.level,equipment_level:p.equipment_level,limitation_notes:p.limitation_notes,session_minutes:p.session_minutes,plan_start_date:p.plan_start_date,days:p.days});
 const current=await db.one("SELECT * FROM plans WHERE user_id=? AND status='active'",[id]);assert.notEqual(current.id,active.id);assert.equal((await db.one('SELECT status FROM plans WHERE id=?',[active.id])).status,'archived');
 const todaySession=(await t.sessions(current.id)).find(s=>s.scheduled_date===today());assert.equal(todaySession.id,present.id);assert.deepEqual(todaySession.exercises,present.exercises);
 assert.ok((await t.sessions(active.id)).every(s=>s.scheduled_date<today()));
});
test('adaptive persistence changes only future targets, never historical logs, once per week',async()=>{
 const plan=await db.one("SELECT id FROM plans WHERE user_id=? AND status='active'",[id]);const all=await t.sessions(plan.id),future=all.find(s=>!s.is_rest&&s.scheduled_date>today()),e=future.exercises.find(e=>e.load_increment_kg>0);assert.ok(e);
 for(let n=0;n<2;n++){
  const scheduled=addDays(today(),-5+n*2),ps=await db.insert('planned_sessions',{plan_id:plan.id,scheduled_date:scheduled,is_rest:0,session_label:'History test',status:'completed'});
  const pe=await db.insert('planned_exercises',{planned_session_id:ps,exercise_id:e.exercise_id,order_no:1,target_sets:3,target_rep_min:8,target_rep_max:12,target_weight_kg:10});
  const sl=await db.insert('session_logs',{planned_session_id:ps,user_id:id,status:'completed',started_at:scheduled+' 01:00:00',ended_at:scheduled+' 02:00:00',edit_locked_at:scheduled+' 23:00:00'});
  const el=await db.insert('exercise_logs',{session_log_id:sl,planned_exercise_id:pe,exercise_id:e.exercise_id,status:'completed',avg_rpe:6,top_weight_kg:10});await db.insertMany('set_logs',[1,2,3].map(set_no=>({exercise_log_id:el,set_no,reps:12,weight_kg:10,rpe:6})));
  if(n===1){await db.transaction(()=>t.adapt(id,e.exercise_id,sl));await db.transaction(()=>t.adapt(id,e.exercise_id,sl));}
 }
 const adjusted=await db.one('SELECT target_weight_kg FROM planned_exercises WHERE id=?',[e.id]);assert.equal(adjusted.target_weight_kg,10+e.load_increment_kg);
 const events=await db.query("SELECT * FROM adaptation_events WHERE user_id=? AND exercise_id=? AND action='increase_load'",[id,e.exercise_id]);assert.equal(events.length,1);
 const historical=await db.query('SELECT top_weight_kg FROM exercise_logs WHERE exercise_id=?',[e.exercise_id]);assert.ok(historical.every(h=>h.top_weight_kg===10));
});
