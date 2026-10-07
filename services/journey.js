const db=require('../config/db');
const training=require('./training');
const {today,addDays,weekStart,weekday}=require('./dates');
const {streak}=require('./stats');
function summarize(sessions,profile,date=today()){
 const history=sessions.filter(s=>!s.is_rest&&s.scheduled_date<=date).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date));
 const completed=history.filter(s=>s.status==='completed');
 const start=addDays(weekStart(date),-7),end=weekStart(date);
 const previous=history.filter(s=>s.scheduled_date>=start&&s.scheduled_date<end);
 const count=status=>previous.filter(s=>s.status===status).length;
 const milestones=[1,4,12,24].map(target=>{
  const achieved=completed.length>=target;
  let estimatedDate=null,remaining=target-completed.length;
  if(!achieved&&profile?.days?.length){for(let i=1;i<=366&&remaining>0;i++){const next=addDays(date,i);if(next>=(profile.plan_start_date||date)&&profile.days.includes(weekday(next))){remaining--;if(!remaining)estimatedDate=next;}}}
  return {target,achieved,date:achieved?completed[target-1].scheduled_date:estimatedDate};
 });
 return {completed:completed.length,streak:streak(history),milestones,weekly:{start,end:addDays(end,-1),completed:count('completed'),partial:count('partial'),missed:count('missed'),planned:previous.length}};
}
async function journey(userId){
 const [profile,sessions,plan,events]=await Promise.all([
  training.profile(userId),
  db.query('SELECT ps.* FROM planned_sessions ps JOIN plans p ON p.id=ps.plan_id WHERE p.user_id=? ORDER BY ps.scheduled_date,ps.id',[userId]),
  db.one("SELECT * FROM plans WHERE user_id=? AND status='active'",[userId]),
  db.query('SELECT * FROM adaptation_events WHERE user_id=? AND created_at>=? ORDER BY id DESC LIMIT 20',[userId,addDays(today(),-7)+' 00:00:00'])
 ]);
 return {...summarize(sessions,profile),goal:profile?.goal||null,locked:!!plan?.locked_by_coach,events};
}
async function review(userId){
 await require('./scheduler').reconcileUser(userId);
 const recent=await db.query('SELECT el.exercise_id,MAX(sl.id) AS log_id FROM exercise_logs el JOIN session_logs sl ON sl.id=el.session_log_id WHERE sl.user_id=? AND sl.ended_at IS NOT NULL GROUP BY el.exercise_id',[userId]);
 for(const e of recent)await db.transaction(()=>training.adapt(userId,e.exercise_id,e.log_id));
 return journey(userId);
}
module.exports={summarize,journey,review};
