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
 app.use(helmet({contentSecurityPolicy:{directives:{'script-src':["'self'"],'style-src':["'self'","'unsafe-inline'"],'img-src':["'self'",'data:','https:'],'upgrade-insecure-requests':process.env.NODE_ENV==='production'?[]:null}},strictTransportSecurity:process.env.NODE_ENV==='production'?undefined:false}));
 app.use(express.json({limit:'100kb'}));app.use(cookieParser());
 app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){let origin;try{origin=new URL(req.headers.origin).host;}catch{}if(origin!==req.headers.host)return res.status(403).json({error:{code:'ORIGIN_REJECTED',message:'Permintaan tidak dibenarkan.'}});}next();});
 app.get('/api/health',async(req,res)=>{await db.query('SELECT 1 AS ok');res.json({status:'ok',database:db.driver});});
 app.use('/api/auth',require('./routes/auth'));app.use('/api/admin',require('./routes/admin'));app.use('/api',require('./routes/user'));
 app.use('/api',(req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Laluan tidak ditemui.'}}));
 app.get('/vendor/chart.js',(req,res)=>res.sendFile(path.join(__dirname,'node_modules/chart.js/dist/chart.umd.js')));
 app.use(express.static(path.join(__dirname,'public')));app.use(errors);return app;
}
async function start(){await db.init();await migrate();const app=createApp();const task=cron.schedule('5 0 * * *',()=>require('./services/scheduler').runDaily(),{timezone:'Asia/Kuala_Lumpur'});const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||3000);const server=app.listen(port,host,()=>console.log(`FitAdapt: http://${host}:${port} (${db.driver})`));const stop=()=>{task.stop();server.close(()=>db.close().then(()=>process.exit(0)));};process.on('SIGINT',stop);process.on('SIGTERM',stop);}
if(require.main===module)start().catch(e=>{console.error('Tidak dapat memulakan FitAdapt:',e.message);process.exit(1);});
module.exports={createApp,start};
