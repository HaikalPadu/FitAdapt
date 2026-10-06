"use client";
import {t,useLanguage,systemText} from '../../lib/preferences';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Checkbox } from './checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './form';

const schemaFor = (register: boolean) => z.object({
 email:z.string().trim().email('Masukkan alamat e-mel yang sah.').max(150,'E-mel maksimum 150 aksara.'),
 password:z.string().min(8,'Kata laluan minimum 8 aksara.').max(72,'Kata laluan maksimum 72 aksara.'),
 full_name:z.string(), confirm_password:z.string(), accept_terms:z.boolean(),
}).superRefine((v,ctx)=>{
 if(!register)return;
 if(!v.full_name.trim()||v.full_name.trim().length>100)ctx.addIssue({code:'custom',path:['full_name'],message:'Masukkan nama penuh (maksimum 100 aksara).'});
 if(v.password!==v.confirm_password)ctx.addIssue({code:'custom',path:['confirm_password'],message:'Pengesahan kata laluan tidak sepadan.'});
 if(!v.accept_terms)ctx.addIssue({code:'custom',path:['accept_terms'],message:'Sila setuju dengan terma dan dasar privasi.'});
});
export type AuthValues=z.infer<ReturnType<typeof schemaFor>>;
export interface AuthFormSplitScreenProps {
 register:boolean; initialEmail?:string; successMessage?:string;
 onSubmit:(data:AuthValues)=>Promise<void>;
}
export function AuthFormSplitScreen({register,initialEmail='',successMessage,onSubmit}:AuthFormSplitScreenProps){
 useLanguage();
 const [showPassword,setShowPassword]=React.useState(false);
 const [error,setError]=React.useState('');
 const errorRef=React.useRef<HTMLDivElement>(null);
 const reduced=useReducedMotion();
 const form=useForm<AuthValues>({resolver:zodResolver(schemaFor(register)),defaultValues:{email:initialEmail,password:'',full_name:'',confirm_password:'',accept_terms:false}});
 const busy=form.formState.isSubmitting;
 const item={hidden:{opacity:0,y:20},visible:{opacity:1,y:0,transition:{duration:.2}}};
 const sequence={hidden:{},visible:{transition:{delayChildren:0,staggerChildren:.03}}};
 const submit=async(values:AuthValues)=>{setError('');try{await onSubmit(values);}catch(e){setError(e instanceof Error?e.message:'Permintaan gagal. Sila cuba lagi.');requestAnimationFrame(()=>errorRef.current?.focus());}};
 const textField=(name:'email'|'full_name'|'confirm_password',label:string,type:string,placeholder:string,autoComplete:string)=><FormField control={form.control} name={name} render={({field})=><motion.div variants={item}><FormItem><FormLabel>{t(label)}</FormLabel><FormControl><Input {...field} type={type} placeholder={t(placeholder)} autoComplete={autoComplete} disabled={busy}/></FormControl><FormMessage/></FormItem></motion.div>}/>;
 return <div className="auth-split">
  <main id="main" className="auth-split-form">
   <a className="brand" href="#home" aria-label={t("FitAdapt — halaman utama")}><img src="/img/logo.svg" alt=""/><span>Fit<em>Adapt</em></span></a>
   <motion.div className="auth-split-content" variants={sequence} initial={reduced?false:"hidden"} animate="visible">
    <motion.div variants={item}><span className="auth-eyebrow">{register?t('LANGKAH PERTAMA KAMU'):t('SELAMAT KEMBALI')}</span>
    <h1>{register?t('Cipta akaun kamu'):t('Log masuk')}</h1>
    <p className="auth-description">{register?t('Daftar, log masuk, kemudian pilih matlamat dan jadual latihan kamu.'):t('Masukkan e-mel dan kata laluan untuk membuka latihan kamu.')}</p></motion.div>
    {successMessage&&<div className="auth-success" role="status">{systemText(successMessage)}</div>}
    <Form {...form}><motion.form variants={sequence} onSubmit={form.handleSubmit(submit)} noValidate className="space-y-4">
     {error&&<div ref={errorRef} tabIndex={-1} role="alert" className="auth-error">{systemText(error)}</div>}
     {register&&textField('full_name','Nama penuh','text','Nama kamu','name')}
     {textField('email','E-mel','email','nama@contoh.com','email')}
     <motion.div variants={item}><FormField control={form.control} name="password" render={({field})=><FormItem><FormLabel>{t("Kata laluan")}</FormLabel><div className="auth-password"><FormControl><Input {...field} type={showPassword?'text':'password'} placeholder={t("Minimum 8 aksara")} autoComplete={register?'new-password':'current-password'} disabled={busy}/></FormControl><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?t('Sembunyikan kata laluan'):t('Papar kata laluan')} aria-pressed={showPassword} disabled={busy}>{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div><FormMessage/></FormItem>}/></motion.div>
     {register&&textField('confirm_password','Sahkan kata laluan','password','Masukkan semula kata laluan','new-password')}
     {register&&<motion.div variants={item}><FormField control={form.control} name="accept_terms" render={({field})=><FormItem><div className="auth-terms"><FormControl><Checkbox checked={field.value} onCheckedChange={v=>field.onChange(v===true)} disabled={busy}/></FormControl><FormLabel>{t("Saya bersetuju dengan ")}<a href="#terms" target="_blank" rel="noopener">{t("Terma Penggunaan")}</a>{t(" dan ")}<a href="#privacy" target="_blank" rel="noopener">{t("Dasar Privasi")}</a>.</FormLabel></div><FormMessage/></FormItem>}/></motion.div>}
     <motion.div variants={item}><Button type="submit" className="auth-submit w-full" disabled={busy}>{busy?<><Loader2 className="animate-spin" size={18}/>{t(" Sila tunggu…")}</>:<>{register?t('Daftar akaun'):t('Log masuk')}<ArrowRight size={18}/></>}</Button></motion.div>
    </motion.form></Form>
    <motion.p variants={item} className="auth-switch">{register?t('Sudah ada akaun?'):t('Belum ada akaun?')} <a href={register?'#login':'#register'}>{register?t('Log masuk'):t('Daftar di sini')}</a></motion.p>
    <motion.p variants={item} className="auth-security"><ShieldCheck size={16}/>{t(" Log latihan kamu kekal peribadi.")}</motion.p>
   </motion.div>
   <footer className="auth-footer"><a href="#home">{t("Kembali ke halaman utama")}</a><span>© {new Date().getFullYear()} FitAdapt</span></footer>
  </main>
  <aside className="auth-split-image" aria-label={t("Inspirasi perjalanan latihan")}>
   <span className="auth-studio-label">{t('STUDIO LATIHAN PERIBADI KAMU')}</span><div className="orbit-art" aria-hidden="true"><span>FIT</span><svg className="icon" viewBox="0 0 24 24"><path d="m6 6 12 12 M3 7l4-4 M2 10l8-8 M14 22l8-8 M17 21l4-4 M5 12l7-7 M12 19l7-7"/></svg><small>{t('DIBINA MENGIKUT DIRI KAMU')}</small></div>
   <div className="auth-image-caption"><span>{t("RENTAK KAMU. KEMAJUAN KAMU.")}</span><h2>{t("Satu langkah hari ini.")}<br/>{t("Lebih kuat esok.")}</h2><p>{t("Pelan peribadi, latihan yang fleksibel, dan kemajuan yang boleh kamu lihat.")}</p><div className="auth-image-tags"><span>{t("Ikut jadual kamu")}</span><span>{t("Raikan setiap kemajuan")}</span></div></div>
  </aside>
 </div>;
}
