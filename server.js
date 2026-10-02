const path=require('node:path');
const express=require('express');
const helmet=require('helmet');
const cookieParser=require('cookie-parser');
const cron=require('node-cron');
const db=require('./config/db');
const migrate=require('./db/migrate');
const {errors}=require('./middleware/errors');
function createApp(){
 const app=express();app.disable('x-powered-by');
 app.set('trust proxy', 1);
 app.use(helmet({
  contentSecurityPolicy:{
   directives:{
    defaultSrc:["'self'"],
    scriptSrc:["'self'"],
    styleSrc:["'self'","'unsafe-inline'"],
    imgSrc:["'self'",'data:','https:'],
    frameAncestors:['*'],
    upgradeInsecureRequests:null
   }
  },
  crossOriginResourcePolicy:false,
  crossOriginOpenerPolicy:false,
  frameguard:false,
  strictTransportSecurity:false
 }));
 app.use(express.json({limit:'100kb'}));app.use(cookieParser());
 app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){let origin;try{origin=new URL(req.headers.origin).host;}catch{}const allowed=[req.headers.host,req.headers['x-forwarded-host'],req.get('host')].filter(Boolean);const isAllowed=!origin||allowed.some(h=>h===origin||origin.endsWith(h))||origin.includes('run.app')||origin.includes('localhost')||origin.includes('127.0.0.1')||origin.includes('google.com');if(!isAllowed)return res.status(403).json({error:{code:'ORIGIN_REJECTED',message:'Permintaan tidak dibenarkan.'}});}next();});
 app.get('/api/health',async(req,res)=>{await db.query('SELECT 1 AS ok');res.json({status:'ok',database:db.driver});});
 app.get('/api/cron/daily',async(req,res)=>{
  const secret=process.env.CRON_SECRET;
  if(!secret||req.get('authorization')!==`Bearer ${secret}`)return res.status(401).json({error:{code:'UNAUTHORIZED'}});
  await require('./services/scheduler').runDaily();res.json({status:'ok'});
 });
 app.use('/api/auth',require('./routes/auth'));app.use('/api/admin',require('./routes/admin'));app.use('/api',require('./routes/user'));
 app.use('/api',(req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Laluan tidak ditemui.'}}));
 app.get('/vendor/chart.js',(req,res)=>res.sendFile(path.join(__dirname,'node_modules/chart.js/dist/chart.umd.js')));
 app.use(express.static(path.join(__dirname,'public')));app.use(errors);return app;
}
async function start(){await db.init();await migrate();try{await require('./db/seed')();}catch(e){console.warn('Seed status:',e.message);}const app=createApp();const task=cron.schedule('5 0 * * *',()=>require('./services/scheduler').runDaily(),{timezone:'Asia/Kuala_Lumpur'});const host='0.0.0.0',port=3000;const server=app.listen(port,host,()=>console.log(`FitAdapt: http://${host}:${port} (${db.driver})`));const stop=()=>{task.stop();server.close(()=>db.close().then(()=>process.exit(0)));};process.on('SIGINT',stop);process.on('SIGTERM',stop);}
if(require.main===module)start().catch(e=>{console.error('Tidak dapat memulakan FitAdapt:',e.message);process.exit(1);});
// Vercel imports this handler; initialize once per instance before serving APIs.
let ready;
const app=createApp();
async function handler(req,res,next){
 try{await (ready ||= db.init().catch(error=>{ready=undefined;throw error;}));return app(req,res,next);}
 catch(error){return errors(error,req,res,next);}
}
module.exports=handler;
module.exports.createApp=createApp;
module.exports.start=start;
