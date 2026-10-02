'use client';
import {useState, type PointerEvent} from 'react';
import {motion, useReducedMotion, useSpring} from 'framer-motion';
import {AuthFormSplitScreen, type AuthFormSplitScreenProps} from './login';

// Adapted from the supplied glass-card component; real authentication is shared.
export function Component(props:AuthFormSplitScreenProps){
 const reduced=useReducedMotion();
 const [paused,setPaused]=useState(false);
 const still=!!reduced||paused;
 const rotateX=useSpring(0,{stiffness:180,damping:24});
 const rotateY=useSpring(0,{stiffness:180,damping:24});
 const reset=()=>{rotateX.set(0);rotateY.set(0);};
 const move=(event:PointerEvent<HTMLDivElement>)=>{
  if(still||event.pointerType!=='mouse'||event.currentTarget.contains(document.activeElement))return;
  const rect=event.currentTarget.getBoundingClientRect();
  rotateX.set(-(event.clientY-rect.top-rect.height/2)/rect.height*6);
  rotateY.set((event.clientX-rect.left-rect.width/2)/rect.width*6);
 };
 return <div className="glass-auth-scene" data-still={still}>
  <div className="glass-auth-glow glass-auth-glow-top" aria-hidden="true"/>
  <div className="glass-auth-glow glass-auth-glow-bottom" aria-hidden="true"/>
  <button className="glass-motion-toggle" type="button" aria-pressed={paused} onClick={()=>{setPaused(!paused);reset();}}>{paused?'Hidupkan animasi':'Jeda animasi'}</button>
  <motion.div className="glass-auth-stage" initial={still?false:{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.7}}>
   <motion.div className="glass-auth-card" style={still?{}:{rotateX,rotateY}} onPointerMove={move} onPointerLeave={reset} onFocusCapture={reset}>
    <div className="glass-border-lights" aria-hidden="true"><i/><i/><i/><i/></div>
    <AuthFormSplitScreen {...props}/>
   </motion.div>
  </motion.div>
 </div>;
}
