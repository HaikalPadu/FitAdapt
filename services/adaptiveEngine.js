const rules=require('../config/engineRules');
const {addDays,weekStart,weekday}=require('./dates');
const round=(n,step=rules.weightRounding)=>Math.max(0,Math.round(n/step)*step);
function evaluate(history,target,{changedThisWeek=false,lockedByCoach=false}={}) {
 if(lockedByCoach||changedThisWeek||!history.length)return null;
 const latest=history[0], weight=Number(target.target_weight_kg??latest.top_weight_kg??0);
 const result=(action,ruleCode,reasonText,newWeight)=>({action,ruleCode,reasonText,...(newWeight===undefined?{}:{newWeight})});
 if(latest.avg_rpe>=rules.hold.rpeAtOrAbove)return result('hold_load','BR-17a','Beban dikekalkan kerana usaha tinggi (RPE 9 atau lebih).',weight);
 const failed=h=>h.sets.length>0&&h.sets.some(s=>s.reps<(h.target_rep_min||target.target_rep_min));
 if(history.length>=rules.hold.failedSessions&&history.slice(0,rules.hold.failedSessions).every(failed))return result('reduce_load','BR-17b','Beban dikurangkan kerana sasaran rep tidak dicapai dua sesi berturut-turut.',round(weight*(1-rules.hold.reducePercent/100)));
 const achieved=h=>h.sets.length>=(h.target_sets||target.target_sets)&&h.sets.every(s=>s.reps>=(h.target_rep_max||target.target_rep_max))&&h.avg_rpe<=rules.overload.maxRpe;
 if(history.length>=rules.overload.consecutiveSessions&&history.slice(0,rules.overload.consecutiveSessions).every(achieved)&&Number(target.load_increment_kg)>0)return result('increase_load','BR-16','Beban dinaikkan kerana semua rep dicapai dengan RPE 7 atau kurang dua sesi berturut-turut.',round(weight+Number(target.load_increment_kg)));
 if(history.length>=rules.plateau.sessions) {const a=history.slice(0,rules.plateau.sessions);const reps=h=>Math.max(0,...h.sets.map(s=>s.reps));if(a.every((h,i)=>i===a.length-1||(h.top_weight_kg<=a[i+1].top_weight_kg&&reps(h)<=reps(a[i+1]))))return result('suggest_variation','BR-18','Kemajuan mendatar tiga sesi. Cuba senaman alternatif atau minggu latihan ringan.');}
 return null;
}
function reschedule(missed,sessions,availableDays,currentDate) {
 const end=addDays(weekStart(missed.scheduled_date),6);
 const candidates=sessions.filter(s=>s.scheduled_date>missed.scheduled_date&&s.scheduled_date>=currentDate&&s.scheduled_date<=end&&s.is_rest&&availableDays.includes(weekday(s.scheduled_date)));
 const safe=candidates.sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date)).find(candidate=>!sessions.some(s=>!s.is_rest&&s.id!==missed.id&&Math.abs(Date.parse(s.scheduled_date)-Date.parse(candidate.scheduled_date))<172800000&&(s.exercises||[]).some(e=>(missed.exercises||[]).some(m=>m.muscle_group===e.muscle_group))));
 return safe?{action:'reschedule',date:safe.scheduled_date,ruleCode:'BR-19'}:{action:'carry_over',date:addDays(end,1),ruleCode:'BR-19'};
}
function reduceVolume(sets){return Math.max(1,sets-1);}
function logStatus(logged,total){return logged===0?'missed':logged>=total?'completed':'partial';}
function sessionStatus(statuses){return statuses.every(s=>s==='completed')&&statuses.length?'completed':statuses.some(s=>s!=='missed')?'partial':'missed';}
module.exports={evaluate,reschedule,reduceVolume,round,logStatus,sessionStatus};
