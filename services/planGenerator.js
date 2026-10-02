const {addDays,weekday,weekStart}=require('./dates');
const {fail}=require('../middleware/errors');
const access={none:['bodyweight'],dumbbell:['bodyweight','dumbbell'],full_gym:['bodyweight','dumbbell','barbell','machine','cable']};
const limitationMap={knee:['lutut','knee'],back:['belakang','back'],shoulder:['bahu','shoulder'],wrist:['pergelangan','wrist'],elbow:['siku','elbow'],neck:['leher','neck']};
function limitations(notes=''){return Object.entries(limitationMap).filter(([,words])=>words.some(w=>notes.toLowerCase().includes(w))).map(([tag])=>tag);}
const templates={2:['full','full'],3:['full','full','full'],4:['upper','lower','upper','lower'],5:['push','squat','pull','upper','hinge'],6:['push','pull','lower','push','pull','lower']};
const labels={full:'Seluruh Badan',upper:'Atas Badan (Push / Pull)',lower:'Bawah Badan',push:'Atas Badan (Push)',pull:'Atas Badan (Pull)',squat:'Bawah Badan (Squat)',hinge:'Bawah Badan (Hinge)'};
function splitType(n){return n<=3?'full_body':n===4?'upper_lower':n===5?'hybrid5':'ppl6';}
function eligible(exercise,profile){return exercise.is_active&&access[profile.equipment_level].includes(exercise.equipment_type)&&(exercise.level==='beginner'||(profile.level==='intermediate'&&exercise.level==='intermediate'))&&!(exercise.tags||[]).some(t=>limitations(profile.limitation_notes).includes(t));}
function matches(e,focus){return focus==='full'||(focus==='upper'&&['push','pull'].includes(e.split_tag))||(focus==='lower'&&['legs','core'].includes(e.split_tag))||(['squat','hinge'].includes(focus)&&((e.split_tag==='legs'&&[focus,'none'].includes(e.movement_focus))||e.split_tag==='core'))||e.split_tag===focus;}
function generate(profile,catalog,startDate,dayCount=14,previous=[]) {
 if(!profile.days||profile.days.length<2||profile.days.length>6||new Set(profile.days).size!==profile.days.length||!access[profile.equipment_level])fail(422,'INVALID_PROFILE','Pilih antara 2 hingga 6 hari latihan.');
 const days=[...profile.days].sort((a,b)=>a-b), candidates=catalog.filter(e=>eligible(e,profile)), history=[...previous], sessions=[];
 for(let i=0;i<dayCount;i++) {
  const date=addDays(startDate,i),day=weekday(date),index=days.indexOf(day);
  if(index<0){sessions.push({scheduled_date:date,is_rest:1,session_label:'Hari rehat',exercises:[]});continue;}
  const focus=templates[days.length][index];
  const recent=history.filter(s=>s.scheduled_date<date&&Date.parse(date)-Date.parse(s.scheduled_date)<172800000).flatMap(s=>s.exercises||[]);
  const pool=candidates.filter(e=>matches(e,focus)&&!recent.some(p=>p.muscle_group===e.muscle_group));
  // On adjacent full-body days, partition upper/lower so primary muscles recover for 48h.
  const tomorrowAvailable=days.includes(weekday(addDays(date,1)));
  const filtered=focus==='full'&&tomorrowAvailable&&!recent.length?pool.filter(e=>['push','pull'].includes(e.split_tag)):pool;
  const count=profile.session_minutes<30?Math.max(2,Math.ceil(profile.session_minutes/10)):profile.session_minutes<45?4:profile.session_minutes<60?5:6;
  const ordered=filtered.sort((a,b)=>b.is_compound-a.is_compound||a.id-b.id);
  const chosen=[]; const groups=new Set();
  for(const e of ordered)if(!groups.has(e.muscle_group)&&chosen.length<count){chosen.push(e);groups.add(e.muscle_group);}
  for(const e of ordered)if(!chosen.includes(e)&&chosen.length<count)chosen.push(e);
  if(!chosen.length)fail(422,'NO_SAFE_EXERCISES','Tiada senaman sesuai untuk jadual dan limitasi ini. Pilih hari berselang, ubah akses peralatan, atau hubungi pentadbir untuk menambah senaman.');
  const session={scheduled_date:date,is_rest:0,session_label:labels[focus],exercises:chosen.sort((a,b)=>b.is_compound-a.is_compound).map((e,j)=>({...e,exercise_id:e.id,order_no:j+1,target_sets:profile.level==='beginner'?Math.min(3,Math.max(2,e.default_sets)):Math.min(4,Math.max(3,e.default_sets)),target_rep_min:profile.level==='beginner'?8:e.default_rep_min,target_rep_max:profile.level==='beginner'?12:e.default_rep_max,target_weight_kg:profile.level==='beginner'?e.base_load_beginner_kg:e.base_load_intermediate_kg}))};
  sessions.push(session); history.push(session);
 }
 return {split_type:splitType(days.length),sessions};
}
module.exports={generate,splitType,eligible,limitations,access,matches};
