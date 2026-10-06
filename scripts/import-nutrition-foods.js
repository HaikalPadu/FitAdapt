// Rebuild the curated catalogue from the public USDA SR Legacy CSV download.
// Usage: node scripts/import-nutrition-foods.js <extracted USDA directory>
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
const selection=[
 [168878,'Nasi putih, dimasak','White rice, cooked','grains',[]],
 [169704,'Nasi perang, dimasak','Brown rice, cooked','grains',[]],
 [173904,'Oat kering','Rolled oats, dry','grains',[]],
 [172688,'Roti gandum penuh','Whole-wheat bread','grains',['wheat']],
 [169737,'Pasta, dimasak tanpa garam','Pasta, cooked without salt','grains',['wheat']],
 [170440,'Kentang rebus tanpa kulit dan garam','Potato, boiled without skin or salt','grains',[]],
 [168483,'Isi keledek bakar, tanpa garam','Sweet potato flesh, baked without salt','grains',[]],
 [171477,'Dada ayam panggang, tanpa kulit','Chicken breast, roasted without skin','protein',[],false],
 [175168,'Salmon ternak, dimasak','Farmed salmon, cooked','protein',['fish'],false],
 [173424,'Telur rebus','Egg, hard-boiled','protein',['egg']],
 [172475,'Tauhu pejal mentah, kalsium sulfat','Firm tofu, raw, calcium-set','protein',['soy']],
 [172467,'Tempe, dimasak','Tempeh, cooked','protein',['soy']],
 [172421,'Dal lentil rebus, tanpa garam','Lentils, boiled without salt','protein',[]],
 [175194,'Kacang merah rebus, tanpa garam','Red kidney beans, boiled without salt','protein',[]],
 [171265,'Susu penuh krim, vitamin D tambahan','Whole milk, vitamin D added','dairy',['milk']],
 [170894,'Yogurt Greek asli tanpa lemak','Plain nonfat Greek yogurt','dairy',['milk']],
 [172446,'Minuman soya asli/vanila, tidak diperkaya','Soy drink, original/vanilla, unfortified','dairy',['soy']],
 [173944,'Pisang, mentah','Banana, raw','fruit',[]],
 [171688,'Epal dengan kulit, mentah','Apple with skin, raw','fruit',[]],
 [169097,'Oren, mentah','Orange, raw','fruit',[]],
 [169910,'Mangga, mentah','Mango, raw','fruit',[]],
 [169926,'Betik, mentah','Papaya, raw','fruit',[]],
 [169967,'Brokoli rebus, tanpa garam','Broccoli, boiled without salt','vegetables',[]],
 [168462,'Bayam, mentah','Spinach, raw','vegetables',[]],
 [170393,'Lobak merah, mentah','Carrot, raw','vegetables',[]],
 [168409,'Timun dengan kulit, mentah','Cucumber with peel, raw','vegetables',[]],
 [173806,'Kacang tanah panggang, tanpa garam','Peanuts, dry-roasted without salt','fats',['peanut']],
 [172470,'Mentega kacang halus, tanpa garam','Smooth peanut butter, without salt','fats',['peanut']],
 [171705,'Avokado, mentah','Avocado, raw','fats',[]],
 [171413,'Minyak zaitun','Olive oil','fats',[]]
];
function csv(line){const cells=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(value);value='';}else value+=c;}cells.push(value);return cells;}
async function rows(file,fn){let headers;for await(const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})){const cells=csv(line);if(!headers){headers=cells;continue;}fn(Object.fromEntries(headers.map((h,i)=>[h,cells[i]])));}}
(async()=>{
 const root=process.argv[2];if(!root)throw Error('Provide the extracted USDA CSV directory.');
 const keys={1008:'calories',1003:'protein',1005:'carbs',1004:'fat',1079:'fiber',2000:'sugar',1093:'sodium',1087:'calcium',1089:'iron',1092:'potassium'};
 const foods=new Map(selection.map(([id,ms,en,group,allergens,vegetarian=true])=>[String(id),{id:'usda-'+id,name_ms:ms,name_en:en,group,allergens,vegetarian,fdc_id:id,source:'USDA SR Legacy (2018)',source_url:'https://fdc.nal.usda.gov/food-details/'+id+'/nutrients',per100:Object.fromEntries(Object.values(keys).map(k=>[k,null]))}]));
 await rows(path.join(root,'food.csv'),r=>{if(foods.has(r.fdc_id))foods.get(r.fdc_id).source_description=r.description;});
 await rows(path.join(root,'food_nutrient.csv'),r=>{if(foods.has(r.fdc_id)&&keys[r.nutrient_id]&&r.amount!=='')foods.get(r.fdc_id).per100[keys[r.nutrient_id]]=Number(r.amount);});
 for(const food of foods.values()){if(!food.source_description||['calories','protein','carbs','fat'].some(k=>food.per100[k]===null))throw Error('Missing source data: '+food.id);}
 fs.writeFileSync('db/nutrition-foods.json',JSON.stringify([...foods.values()],null,2)+'\n');
 console.log('Imported '+foods.size+' foods; unknown nutrients retained as null.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
