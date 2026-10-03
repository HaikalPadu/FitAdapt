const router=require('express').Router();
const bcrypt=require('bcryptjs');
const {rateLimit}=require('express-rate-limit');
const db=require('../config/db');
const {z,str,password}=require('../middleware/validate');
const {fail}=require('../middleware/errors');
const {requireAuth,createSession}=require('../middleware/auth');
const {utc}=require('../services/dates');
const limiter=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,store:new (require('../services/rateLimitStore'))(),message:{error:{code:'RATE_LIMITED',message:'Terlalu banyak cubaan. Cuba lagi selepas 15 minit.'}}});
router.post('/register',limiter,async(req,res)=>{
 const d=z.object({full_name:str(100),email:z.email().max(150).transform(v=>v.toLowerCase()),password,confirm_password:z.string(),accept_terms:z.literal(true)}).refine(d=>d.password===d.confirm_password,'Pengesahan kata laluan tidak sepadan.').parse(req.body);
 const id=await db.insert('users',{full_name:d.full_name,email:d.email,password_hash:await bcrypt.hash(d.password,12),role:'user',status:'active',terms_accepted_at:utc()});
 res.status(201).json({message:'Akaun berjaya didaftarkan. Sila log masuk untuk meneruskan.'});
});
router.post('/login',limiter,async(req,res)=>{
 const d=z.object({email:z.email().transform(v=>v.toLowerCase()),password:z.string().max(200)}).parse(req.body),user=await db.one('SELECT * FROM users WHERE email=?',[d.email]);
 const valid=await bcrypt.compare(d.password,user?.password_hash||'$2b$12$9MtHwxXdXLxIdOGACqA2eOuF7l0RKmFhlGwWxlJ/pHAH.FcoRfUk6');
 if(!user||!valid)fail(401,'INVALID_CREDENTIALS','E-mel atau kata laluan tidak tepat.');
 if(user.status!=='active')fail(403,'ACCOUNT_SUSPENDED','Akaun anda digantung. Sila hubungi pentadbir.');
 const {csrf,token}=await createSession(user.id,res,req);await db.update('users',{last_login_at:utc()},'id=?',[user.id]);const profile=await db.one('SELECT id FROM profiles WHERE user_id=?',[user.id]);res.json({user:{id:user.id,full_name:user.full_name,email:user.email,role:user.role},csrf,token,onboarded:!!profile});
});
router.get('/me',requireAuth,async(req,res)=>res.json({user:req.user,csrf:req.authSession.csrf_token,token:req.authSession.raw_token,onboarded:!!await db.one('SELECT id FROM profiles WHERE user_id=?',[req.user.id])}));
router.post('/logout',requireAuth,async(req,res)=>{await db.query('DELETE FROM auth_sessions WHERE id=?',[req.authSession.id]);res.clearCookie('fitadapt_session',{path:'/'});res.json({message:'Anda telah log keluar.'});});
router.post('/change-password',requireAuth,async(req,res)=>{
 const d=z.object({old_password:z.string().max(200),new_password:password,confirm_password:z.string()}).refine(d=>d.new_password===d.confirm_password,'Pengesahan kata laluan tidak sepadan.').parse(req.body);const u=await db.one('SELECT password_hash FROM users WHERE id=?',[req.user.id]);if(!await bcrypt.compare(d.old_password,u.password_hash))fail(422,'WRONG_PASSWORD','Kata laluan lama tidak tepat.');await db.transaction(async()=>{await db.update('users',{password_hash:await bcrypt.hash(d.new_password,12),updated_at:utc()},'id=?',[req.user.id]);await db.query('DELETE FROM auth_sessions WHERE user_id=?',[req.user.id]);});const {csrf,token}=await createSession(req.user.id,res,req);res.json({message:'Kata laluan berjaya ditukar.',csrf,token});
});
module.exports=router;
