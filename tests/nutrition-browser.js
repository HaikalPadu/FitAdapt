process.env.DB_DRIVER='sqlite';process.env.SQLITE_PATH=':memory:';
const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict');
const db=require('../config/db');
(async()=>{
 await db.init();await require('../db/migrate')();await require('../db/seed')();
 const server=require('../server').createApp().listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/#login');await page.locator('[data-preference=language]').selectOption('en');
  await page.getByLabel('Email',{exact:true}).fill('user@fitadapt.com');await page.getByLabel('Password',{exact:true}).fill('User1234!');await page.getByRole('button',{name:'Log in',exact:true}).click();
  await page.waitForURL('**/#dashboard');await page.goto(base+'/#nutrition');
  await expect(page.getByRole('heading',{name:'Nutrition Lab',exact:true})).toBeVisible();
  await page.goto(base+'/#profile');await expect(page.locator('#nutrition-profile-summary')).toContainText('Add nutrition profile');
  await page.goto(base+'/#progress');await expect(page.locator('#nutrition-progress')).toContainText('Start your nutrition story');
  await page.goto(base+'/#nutrition');await page.locator('#nutrition-goal').waitFor();
  await page.locator('#nutrition-goal').click();await page.locator('#nutrition-profile-age').fill('30');await page.locator('#nutrition-profile-sex').selectOption('male');await page.locator('#nutrition-profile-height_cm').fill('180');await page.locator('#nutrition-profile-weight_kg').fill('80');await page.locator('#nutrition-profile-activity').selectOption('moderate');await page.locator('#nutrition-profile-goal').selectOption('gain');await page.locator('[name=eligible]').check();
  await page.getByRole('button',{name:'Calculate & save guide'}).click();await expect(page.locator('.nutrition-energy')).toContainText('3,060');
  await page.locator('#nutrition-search').fill('white rice');await page.locator('#nutrition-grams').fill('150');await expect(page.locator('#nutrition-portion')).toContainText('195 kcal');await page.locator('#nutrition-add').click();await expect(page.locator('.nutrition-entry')).toContainText('150 g · 195 kcal');
  await page.locator('[data-nutrition-edit]').click();await page.locator('#edit_grams').fill('200');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.locator('.nutrition-entry')).toContainText('200 g · 260 kcal');
  await page.reload();await expect(page.locator('.nutrition-entry')).toContainText('260 kcal');
  await page.locator('.nutrition-custom>summary').click();await page.locator('#custom_name').fill('<b>My breakfast</b>');for(const [key,value] of Object.entries({calories:200,protein:10,carbs:20,fat:8,grams:50}))await page.locator('#custom_'+key).fill(String(value));
  await expect(page.locator('#custom-calculation')).toContainText('100 kcal');await page.getByRole('button',{name:'Log custom food',exact:true}).click();await expect(page.locator('.nutrition-diary')).toContainText('<b>My breakfast</b>');assert.equal(await page.locator('.nutrition-entry b').count(),0);
  await expect(page.locator('.nutrition-ring')).toContainText('360');
  for(const lang of ['ms','en'])for(const theme of ['light','dark']){
   await page.locator('#display-toolbar [data-preference=language]').selectOption(lang);await page.locator('#nutrition-add').waitFor();await page.locator('#display-toolbar [data-preference=theme]').selectOption(theme);
   for(const width of [375,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${lang} ${theme} ${width}`);if(width!==768)await page.screenshot({path:`test-results/nutrition-${lang}-${theme}-${width}.png`,fullPage:true,animations:'disabled'});}
  }
  await page.locator('#nutrition-prev').click();await expect(page.locator('.nutrition-entry')).toHaveCount(0);await page.locator('#nutrition-today').click();await expect(page.locator('.nutrition-entry')).toHaveCount(2);
  await page.locator('[data-nutrition-delete]').first().click();await page.locator('#confirm-action').click();await expect(page.locator('.nutrition-entry')).toHaveCount(1);
  await page.goto(base+'/#progress');await expect(page.locator('#nutrition-progress')).toContainText('Nutrition progress');await expect(page.locator('.nutrition-progress-stats').first()).toContainText('100');
  await page.locator('[data-range=week]').click();await expect(page.locator('.nutrition-progress-stats').first()).toContainText('1 / 7');
  await page.goto(base+'/#profile');await expect(page.locator('#nutrition-profile-summary')).toContainText('3,060');
  await page.locator('#full_name').fill('Unsaved name');await page.locator('#profile-edit-nutrition').click();await page.locator('#nutrition-profile-weight_kg').fill('85');await page.getByRole('button',{name:'Calculate & save guide'}).click();await expect(page.locator('#nutrition-profile-summary')).toContainText('3,140');await expect(page.locator('#full_name')).toHaveValue('Unsaved name');
  await page.goto(base+'/#nutrition');await expect(page.locator('.nutrition-energy')).toContainText('3,140');
  for(const route of ['profile','progress'])for(const lang of ['ms','en'])for(const theme of ['light','dark']){
   await page.goto(base+'/#'+route);await page.locator('#display-toolbar [data-preference=language]').selectOption(lang);await page.locator('#display-toolbar [data-preference=theme]').selectOption(theme);
   const panel=page.locator(route==='profile'?'#nutrition-profile-summary':'#nutrition-progress');await expect(panel).toContainText('3,140');
   for(const width of [375,1440]){await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),{message:`Overflow ${route} ${lang} ${theme} ${width}`}).toBe(true);await page.screenshot({path:`test-results/nutrition-${route}-${lang}-${theme}-${width}.png`,fullPage:true,animations:'disabled'});}
  }
  assert.deepEqual(errors,[]);console.log('Nutrition browser journey passed, including Progress ranges and shared Profile editing in both languages and themes.');
 }finally{await browser.close();await new Promise(r=>server.close(r));await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
