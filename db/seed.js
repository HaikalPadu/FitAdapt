const bcrypt=require('bcryptjs');
const db=require('../config/db');
const migrate=require('./migrate');
const catalog=require('./catalog');
const {access}=require('../services/planGenerator');
const {today}=require('../services/dates');
async function seed(){
 const adminPassword=process.env.SEED_ADMIN_PASSWORD||'Admin123!',userPassword=process.env.SEED_USER_PASSWORD||'User1234!';
 if(adminPassword.length<8||userPassword.length<8)throw Error('Tetapkan SEED_ADMIN_PASSWORD dan SEED_USER_PASSWORD (minimum 8 aksara).');
 await db.transaction(async()=>{
  for(const [email,full_name,role,password] of [['admin@fitadapt.com','Pentadbir FitAdapt','admin',adminPassword],['user@fitadapt.com','Aiman Hakimi','user',userPassword]])if(!await db.one('SELECT id FROM users WHERE email=?',[email]))await db.insert('users',{email,full_name,role,password_hash:await bcrypt.hash(password,12),status:'active'});
  for(const item of catalog){if(await db.one('SELECT id FROM exercises WHERE name=?',[item.name]))continue;const {tags,...exercise}=item;const id=await db.insert('exercises',exercise);for(const tag of tags)await db.insert('exercise_limitation_tags',{exercise_id:id,tag});}
  for(const [equipment_level,types] of Object.entries(access))for(const equipment_type of types)if(!await db.one('SELECT * FROM equipment_access WHERE equipment_level=? AND equipment_type=?',[equipment_level,equipment_type]))await db.insert('equipment_access',{equipment_level,equipment_type});
 });
 const user=await db.one('SELECT id FROM users WHERE email=?',['user@fitadapt.com']);if(!await db.one('SELECT id FROM profiles WHERE user_id=?',[user.id]))await require('../services/training').saveProfile(user.id,{goal:'build_muscle',level:'beginner',equipment_level:'full_gym',limitation_notes:'',session_minutes:45,plan_start_date:today(),days:[1,3,5]},true);
 console.log('Seed selesai: admin@fitadapt.com dan user@fitadapt.com. Kata laluan daripada persekitaran.');
}
if(require.main===module)db.init().then(migrate).then(seed).finally(()=>db.close()).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports=seed;
