const crypto=require('node:crypto');
const db=require('../config/db');
const {utc}=require('../services/dates');
const {fail}=require('./errors');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function requireAuth(req,res,next){
 const authHeader=req.headers.authorization;
 const bearer=authHeader&&authHeader.startsWith('Bearer ')?authHeader.slice(7):null;
 const token=req.cookies?.fitadapt_session||bearer;
 const row=token&&await db.one('SELECT s.*,u.full_name,u.email,u.role,u.status FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?',[hash(token),utc()]);
 if(!row||row.status!=='active')return next(Object.assign(new Error('Sila log masuk untuk meneruskan.'),{status:401,code:'UNAUTHENTICATED'}));
 row.raw_token=token;
 req.user={id:row.user_id,full_name:row.full_name,email:row.email,role:row.role};req.authSession=row;
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers['x-csrf-token']!==row.csrf_token)return next(Object.assign(new Error('Sesi borang tidak sah. Muat semula halaman.'),{status:403,code:'CSRF_INVALID'}));
 next();
}
const requireRole=role=>(req,res,next)=>{if(req.user.role!==role)return next(Object.assign(new Error('Anda tidak mempunyai akses.'),{status:403,code:'FORBIDDEN'}));next();};
async function createSession(userId,res,req){
 const token=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(32).toString('hex');
 await db.insert('auth_sessions',{id:hash(token),user_id:userId,csrf_token:csrf,expires_at:utc(new Date(Date.now()+7*86400000))});
 const isSecure = Boolean(req && (req.secure || req.headers['x-forwarded-proto'] === 'https')) || process.env.NODE_ENV === 'production';
 res.cookie('fitadapt_session',token,{httpOnly:true,sameSite:isSecure?'none':'lax',secure:isSecure,maxAge:7*86400000,path:'/'});
 return {csrf,token};
}
module.exports={requireAuth,requireRole,createSession,hash};
