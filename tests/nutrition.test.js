process.env.DB_DRIVER=process.env.TEST_DB_DRIVER||'sqlite';process.env.SQLITE_PATH=':memory:';
if(process.env.DB_DRIVER==='turso')process.env.TURSO_DATABASE_URL='file::memory:';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest');
const db=require('../config/db'),n=require('../services/nutrition'),{today,addDays}=require('../services/dates');
const profile={age:30,sex:'male',height_cm:180,weight_kg:80,activity:'moderate',goal:'gain',eligible:true,diet:'vegetarian',avoid:['milk','peanut']};
let app,user,other,csrf,otherCsrf;
before(async()=>{await db.init();await require('../db/migrate')();app=require('../server').createApp();user=request.agent(app);other=request.agent(app);for(const [agent,email] of [[user,'nutrition@example.test'],[other,'other@example.test']]){await agent.post('/api/auth/register').send({full_name:'Nutrition Tester',email,password:'Nutrition123!',confirm_password:'Nutrition123!',accept_terms:true}).expect(201);const r=await agent.post('/api/auth/login').send({email,password:'Nutrition123!'}).expect(200);if(agent===user)csrf=r.body.csrf;else otherCsrf=r.body.csrf;}});
after(()=>db.close());
test('estimates, guardrails, portion precision and missing data',()=>{
 const male=n.estimate(profile);assert.equal(male.resting,1780);assert.equal(male.calories,3060);assert.equal(n.estimate({...profile,sex:'female'}).resting,1614);
 assert.equal(n.estimate({...profile,goal:'maintain'}).calories,2760);assert.equal(n.estimate({...profile,goal:'lose'}).calories,2460);
 assert.equal(n.estimate({...profile,goal:'lose',weight_kg:50}).reason,'underweight');
 for(const bad of [{age:17},{eligible:false},{weight_kg:0},{height_cm:NaN}])assert.throws(()=>n.estimate({...profile,...bad}));
 const rice=n.foods.find(f=>f.name_en==='White rice, cooked');assert.ok(rice);assert.equal(n.portion(rice,150).calories,195);
 const custom={per100:{calories:100,protein:5,carbs:15,fat:2,fiber:null,sugar:null,sodium:null,calcium:null,iron:null,potassium:null}};
 const total=n.totals([{food:custom,grams:33.3},{food:custom,grams:33.3},{food:custom,grams:33.3}]);assert.equal(total.totals.calories,99.9);assert.equal(total.totals.fiber,null);assert.equal(total.coverage.fiber,0);
 assert.ok(n.suggestions(profile).every(f=>f.vegetarian&&!f.allergens.some(a=>profile.avoid.includes(a))));
});
test('private diary persists, validates, scales, edits and deletes',async()=>{
 await request(app).get('/api/nutrition/day').expect(401);
 await user.put('/api/nutrition/profile').send(profile).expect(403);
 await user.put('/api/nutrition/profile').set('X-CSRF-Token',csrf).send(profile).expect(200);
 let r=await user.get('/api/nutrition/profile').expect(200);assert.equal(r.body.target.calories,3060);
 const rice=n.foods.find(f=>f.name_en==='White rice, cooked');
 const entry={date:today(),meal:'lunch',grams:150,food_id:rice.id,per100:{calories:0}};
 r=await user.post('/api/nutrition/entries').set('X-CSRF-Token',csrf).send(entry).expect(201);const id=r.body.id;
 r=await user.get('/api/nutrition/day').expect(200);assert.equal(r.body.totals.calories,195);assert.equal(r.body.entries.length,1);
 r=await other.get('/api/nutrition/day').expect(200);assert.equal(r.body.entries.length,0);assert.equal(r.body.profile,null);
 await other.put('/api/nutrition/entries/'+id).set('X-CSRF-Token',otherCsrf).send({grams:200,meal:'dinner'}).expect(404);
 await other.delete('/api/nutrition/entries/'+id).set('X-CSRF-Token',otherCsrf).expect(404);
 await user.put('/api/nutrition/entries/'+id).set('X-CSRF-Token',csrf).send({grams:200,meal:'dinner'}).expect(200);
 r=await user.get('/api/nutrition/day').expect(200);assert.equal(r.body.totals.calories,260);assert.equal(r.body.entries[0].meal,'dinner');
 for(const bad of [{grams:0},{grams:5001},{date:addDays(today(),1)},{food_id:'unknown'}]){r=await user.post('/api/nutrition/entries').set('X-CSRF-Token',csrf).send({...entry,...bad});assert.ok([404,422].includes(r.status));}
 r=await user.post('/api/nutrition/entries').set('X-CSRF-Token',csrf).send({date:addDays(today(),-1),meal:'snack',grams:50,custom:{name:'<b>My label</b>',per100:{calories:200,protein:10,carbs:20,fat:8}}}).expect(201);
 r=await user.get('/api/nutrition/day?date='+addDays(today(),-1)).expect(200);assert.equal(r.body.totals.calories,100);assert.equal(r.body.totals.sodium,null);assert.equal(r.body.entries[0].food.name_en,'<b>My label</b>');
 await user.delete('/api/nutrition/entries/'+id).set('X-CSRF-Token',csrf).expect(200);
 r=await user.get('/api/nutrition/day').expect(200);assert.equal(r.body.entries.length,0);
});
