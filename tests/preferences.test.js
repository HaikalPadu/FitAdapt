const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function preferences(saved={}){
 const storage=new Map(Object.entries(saved)),attrs={};
 const scope={window:{addEventListener(){},dispatchEvent(){}},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},document:{documentElement:{dataset:attrs},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}},CustomEvent:class{}};
 vm.createContext(scope);
 for(const file of ['translations','preferences'])vm.runInContext(fs.readFileSync('public/js/'+file+'.js','utf8'),scope);
 return {api:scope.window.FitAdaptPreferences,storage,attrs,document:scope.document};
}
test('preferences use validated defaults and persist language and theme independently',()=>{
 const {api,storage,attrs,document}=preferences({fitadapt_language:'invalid',fitadapt_theme:'invalid'});
 assert.equal(api.language,'ms');assert.equal(api.theme,'dark');
 api.set('language','en');api.set('theme','light');api.set('language','invalid');
 assert.equal(document.documentElement.lang,'en');assert.equal(attrs.theme,'light');
 assert.equal(storage.get('fitadapt_language'),'en');assert.equal(storage.get('fitadapt_theme'),'light');
 api.set('language','ms');assert.equal(api.theme,'light');
});
test('authored fragments translate while interpolated names, notes and markup stay unchanged',()=>{
 const {api}=preferences({fitadapt_language:'en'});
 const name='Rehat',note='Bina otot';
 assert.equal(api.text`<p>Hari ini: ${name} · ${note}</p>`,'<p>Today: Rehat · Bina otot</p>');
 assert.equal(api.text('<label aria-label="Kata laluan">Kata laluan</label>'),'<label aria-label="Password">Password</label>');
 assert.equal(api.text('training-session session_minutes'), 'training-session session_minutes');
 assert.equal(api.system('Rehat'), 'Rehat');
});
test('system copy translates exact messages and generated session notifications without changing unknown content',()=>{
 const {api}=preferences({fitadapt_language:'en'});
 assert.equal(api.system('Sesi Seluruh Badan pada 2026-10-06 terlepas.'),'Session Full Body on 2026-10-06 was missed.');
 assert.equal(api.system('Sesi terlepas dijadualkan semula pada 2026-10-07.'),'The missed session was rescheduled to 2026-10-07.');
 assert.equal(api.system('Arahan tersuai daripada jurulatih'), 'Arahan tersuai daripada jurulatih');
 api.set('language','ms');assert.equal(api.system('Hari rehat'),'Hari rehat');
});
test('Zod validation defaults respect each request language independently',()=>{
 const {z}=require('zod'),{errors}=require('../middleware/errors');
 const error=z.object({days:z.array(z.number()).min(2)}).safeParse({days:[]}).error;
 const response=language=>{let body;errors(error,{headers:{'accept-language':language}},{status(){return this;},json(value){body=value;}},()=>{});return body.error.fields[0].message;};
 const english=response('en'),malay=response('ms');
 assert.notEqual(english,malay);assert.match(english,/Too small/);assert.equal(response('en'),english);
});
