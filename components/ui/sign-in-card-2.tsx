'use client';
import {t,useLanguage} from '../../lib/preferences';
import {useState, type PointerEvent} from 'react';
import {motion, useReducedMotion, useSpring} from 'framer-motion';
import {AuthFormSplitScreen, type AuthFormSplitScreenProps} from './login';

export function Component(props:AuthFormSplitScreenProps){
 useLanguage();
 const reduced=useReducedMotion();
 const [paused,setPaused]=useState(false);
 const still=!!reduced||paused;
 const rotateX=useSpring(0,{stiffness:150,damping:24});
 const rotateY=useSpring(0,{stiffness:150,damping:24});
 const reset=()=>{rotateX.set(0);rotateY.set(0);};
 const move=(event:PointerEvent<HTMLDivElement>)=>{
  if(still||event.pointerType!=='mouse')return;
  if((event.target as HTMLElement).closest('input, textarea, select, button')){reset();return;}
  const rect=event.currentTarget.parentElement!.getBoundingClientRect();
  rotateX.set(-(event.clientY-rect.top-rect.height/2)/rect.height*16);
  rotateY.set((event.clientX-rect.left-rect.width/2)/rect.width*16);
 };
 return <div className="simple-auth auth-3d" data-still={still}>
  <button className="auth-motion-control" type="button" aria-pressed={paused} onClick={()=>{setPaused(!paused);reset();}}>{paused?t('Hidupkan animasi'):t('Jeda animasi')}</button>
  <motion.div className="auth-3d-stage" initial={reduced?false:{opacity:0,y:36,rotateX:9,scale:.97}} animate={{opacity:1,y:0,rotateX:0,scale:1}} transition={{duration:.85,ease:[.16,1,.3,1]}}>
   <motion.div className="auth-3d-card" style={{rotateX,rotateY}} onPointerMove={move} onPointerLeave={reset} onFocusCapture={reset}>
    <div className="auth-3d-rim" aria-hidden="true"/>
    <AuthFormSplitScreen {...props}/>
   </motion.div>
  </motion.div>
 </div>;
}
