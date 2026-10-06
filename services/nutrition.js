const db=require('../config/db');
const {z}=require('zod');
const {today,utc}=require('./dates');
const {fail}=require('../middleware/errors');
const foods=require('../db/nutrition-foods.json');
const foodMap=new Map(foods.map(food=>[food.id,food]));
const nutrientKeys=['calories','protein','carbs','fat','fiber','sugar','sodium','calcium','iron','potassium'];
const activityFactors={sedentary:1.2,light:1.375,moderate:1.55,active:1.725};
const round=value=>Math.round((value+Number.EPSILON)*100)/100;
const number=(min,max)=>z.number().finite().min(min).max(max);
const profileSchema=z.object({age:number(18,78).int(),sex:z.enum(['female','male']),height_cm:number(120,230),weight_kg:number(30,300),activity:z.enum(['sedentary','light','moderate','active']),goal:z.enum(['maintain','gain','lose']),diet:z.enum(['all','vegetarian']).default('all'),avoid:z.array(z.enum(['milk','egg','fish','soy','peanut','tree_nut','wheat'])).max(7).default([]),eligible:z.literal(true)});
const dateSchema=z.iso.date().refine(value=>value>= '2000-01-01'&&value<=today(),'Pilih tarikh hari ini atau sebelumnya.');
const mealSchema=z.enum(['breakfast','lunch','dinner','snack']);
const gramsSchema=number(1,5000);
const per100Schema=z.object(Object.fromEntries(nutrientKeys.map(key=>[key, ['calories','protein','carbs','fat'].includes(key)?number(0,key==='calories'?1000:100):number(0,['fiber','sugar'].includes(key)?100:100000).nullable().default(null)])))
 .refine(n=>n.protein+n.carbs+n.fat<=105,'Semak nilai label bagi setiap 100 g.')
 .refine(n=>n.sugar===null||n.sugar<=n.carbs+1,'Semak nilai label bagi setiap 100 g.');
const entrySchema=z.object({date:dateSchema,meal:mealSchema,grams:gramsSchema,food_id:z.string().max(40).optional(),custom:z.object({name:z.string().trim().min(1).max(100),per100:per100Schema}).optional()}).refine(v=>Boolean(v.food_id)!==Boolean(v.custom),'Pilih makanan atau masukkan label makanan.');
const portionSchema=z.object({grams:gramsSchema,meal:mealSchema});
let ready;
async function ensureSchema(){await (ready ||= (async()=>{for(const sql of require('../db/nutrition-schema')(db.driver))await db.query(sql);try{await db.query('CREATE INDEX idx_nutrition_day ON nutrition_entries (user_id,logged_date)');}catch(e){if(!/already exists|Duplicate key name/i.test(e.message))throw e;}})().catch(e=>{ready=undefined;throw e;}));}
function estimate(input){
 const p=profileSchema.parse(input),bmi=p.weight_kg/(p.height_cm/100)**2;
 const resting=10*p.weight_kg+6.25*p.height_cm-5*p.age+(p.sex==='male'?5:-161);
 const maintenance=resting*activityFactors[p.activity],adjustment=p.goal==='gain'?300:p.goal==='lose'?-300:0;
 const calories=Math.round((maintenance+adjustment)/10)*10;
 // Do not produce a weight-loss prescription for an underweight person, or an unusually low/high estimate.
 const reason=p.goal==='lose'&&bmi<18.5?'underweight':calories<(p.sex==='male'?1500:1200)||calories>5000?'outside_range':null;
 if(reason)return {status:'guidance',reason};
 return {status:'estimated',calories,maintenance:Math.round(maintenance/10)*10,resting:Math.round(resting),activity_factor:activityFactors[p.activity],adjustment,protein:round(calories*.2/4),carbs:round(calories*.5/4),fat:round(calories*.3/9),method:'mifflin-st-jeor-v1'};
}
async function profile(userId){const row=await db.one('SELECT * FROM nutrition_profiles WHERE user_id=?',[userId]);if(!row)return null;const {avoid_json,eligible,...p}=row;return {...p,age:Number(p.age),height_cm:Number(p.height_cm),weight_kg:Number(p.weight_kg),eligible:!!eligible,avoid:JSON.parse(avoid_json)};}
async function saveProfile(userId,input){const p=profileSchema.parse(input),target=estimate(p);const {avoid,eligible,...values}=p;await db.transaction(async()=>{const old=await db.one('SELECT user_id FROM nutrition_profiles WHERE user_id=?',[userId]);const data={...values,eligible:1,avoid_json:JSON.stringify([...new Set(avoid)]),updated_at:utc()};if(old)await db.update('nutrition_profiles',data,'user_id=?',[userId]);else await db.insert('nutrition_profiles',{user_id:userId,...data});});return {profile:p,target};}
function portion(food,grams){return Object.fromEntries(nutrientKeys.map(key=>[key,food.per100[key]===null?null:round(food.per100[key]*grams/100)]));}
function entry(row){const food=JSON.parse(row.food_snapshot);return {id:row.id,date:row.logged_date,meal:row.meal,grams:Number(row.grams),food,nutrients:portion(food,Number(row.grams))};}
function totals(entries){const result={},coverage={};for(const key of nutrientKeys){const known=entries.filter(e=>e.food.per100[key]!==null);coverage[key]=known.length;result[key]=known.length||!entries.length?round(known.reduce((sum,e)=>sum+e.food.per100[key]*e.grams/100,0)):null;}return {totals:result,coverage};}
function suggestions(p){return foods.filter(f=>(!p||p.diet!=='vegetarian'||f.vegetarian)&&!f.allergens.some(a=>p?.avoid.includes(a))).sort((a,b)=>{const groups=p?.goal==='gain'?['fats','protein','grains','dairy','vegetables','fruit']:['protein','vegetables','grains','fruit','dairy','fats'];return groups.indexOf(a.group)-groups.indexOf(b.group);}).filter((food,index,list)=>list.slice(0,index).filter(f=>f.group===food.group).length<1).slice(0,6);}
async function day(userId,date){date=dateSchema.parse(date);const [p,rows]=await Promise.all([profile(userId),db.query('SELECT * FROM nutrition_entries WHERE user_id=? AND logged_date=? ORDER BY id',[userId,date])]);const entries=rows.map(entry);return {date,entries,...totals(entries),profile:p,target:p?estimate(p):null,suggestions:suggestions(p)};}
async function addEntry(userId,input){const data=entrySchema.parse(input);let food;if(data.food_id){food=foodMap.get(data.food_id);if(!food)fail(404,'FOOD_NOT_FOUND','Makanan tidak ditemui.');}else food={id:null,name_ms:data.custom.name,name_en:data.custom.name,group:'custom',allergens:[],vegetarian:null,source:'label',source_url:null,per100:data.custom.per100};const id=await db.insert('nutrition_entries',{user_id:userId,logged_date:data.date,meal:data.meal,grams:data.grams,food_snapshot:JSON.stringify(food)});return {id};}
async function updateEntry(userId,id,input){const data=portionSchema.parse(input);const result=await db.update('nutrition_entries',data,'id=? AND user_id=?',[id,userId]);if(!result.affectedRows&&!await db.one('SELECT id FROM nutrition_entries WHERE id=? AND user_id=?',[id,userId]))fail(404,'FOOD_NOT_FOUND','Rekod makanan tidak ditemui.');}
async function deleteEntry(userId,id){const result=await db.query('DELETE FROM nutrition_entries WHERE id=? AND user_id=?',[id,userId]);if(!result.affectedRows)fail(404,'FOOD_NOT_FOUND','Rekod makanan tidak ditemui.');}
module.exports={foods,foodMap,nutrientKeys,profileSchema,dateSchema,entrySchema,estimate,portion,totals,suggestions,ensureSchema,profile,saveProfile,day,addEntry,updateEntry,deleteEntry};
