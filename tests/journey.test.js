const {test}=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('../services/journey');
test('journey rewards use completed history, preserve earned badges and forecast only scheduled weekdays',()=>{
 const history=[['2026-10-01','completed'],['2026-10-02','completed'],['2026-10-03','missed'],['2026-10-05','partial'],['2026-10-06','completed'],['2026-10-08','completed']].map(([scheduled_date,status])=>({scheduled_date,status,is_rest:0}));
 const d=summarize(history,{days:[1,3,5]},'2026-10-07');
 assert.equal(d.completed,3);assert.equal(d.streak,1);assert.equal(d.milestones[0].achieved,true);assert.equal(d.milestones[0].date,'2026-10-01');assert.equal(d.milestones[1].date,'2026-10-09');assert.equal(d.milestones[1].achieved,false);
 assert.deepEqual(d.weekly,{start:'2026-09-28',end:'2026-10-04',completed:2,partial:0,missed:1,planned:3});
});
test('journey handles no profile and rest days without invented achievements',()=>{
 const d=summarize([{scheduled_date:'2026-10-01',status:'completed',is_rest:1}],null,'2026-10-07');
 assert.equal(d.completed,0);assert.equal(d.streak,0);assert.ok(d.milestones.every(m=>!m.achieved&&m.date===null));
});
