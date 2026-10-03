'use client';
import {useState, type PointerEvent} from 'react';
import {motion, useReducedMotion, useSpring} from 'framer-motion';
import {AuthFormSplitScreen, type AuthFormSplitScreenProps} from './login';

export function Component(props:AuthFormSplitScreenProps){
 const reduced=useReducedMotion();
 const [paused,setPaused]=useState(false);
 const [focused,setFocused]=useState(false);
 const still=!!reduced||paused||focused;
 const rotateX=useSpring(0,{stiffness:150,damping:24});
 const rotateY=useSpring(0,{stiffness:150,damping:24});
 const reset=()=>{rotateX.set(0);rotateY.set(0);};
 const move=(event:PointerEvent<HTMLDivElement>)=>{
  if(still||event.pointerType!=='mouse')return;
  const rect=event.currentTarget.getBoundingClientRect();
  rotateX.set(-(event.clientY-rect.top-rect.height/2)/rect.height*7);
  rotateY.set((event.clientX-rect.left-rect.width/2)/rect.width*7);
 };
 return <div className="simple-auth auth-3d" data-still={still}>
  <button className="auth-motion-control" type="button" aria-pressed={paused} onClick={()=>{setPaused(!paused);reset();}}>{paused?'Hidupkan animasi':'Jeda animasi'}</button>
  <motion.div className="auth-3d-stage" initial={reduced?false:{opacity:0,y:36,rotateX:9,scale:.97}} animate={{opacity:1,y:0,rotateX:0,scale:1}} transition={{duration:.85,ease:[.16,1,.3,1]}}>
   <motion.div className="auth-3d-card" style={still?{rotateX:0,rotateY:0}:{rotateX,rotateY}} onPointerMove={move} onPointerLeave={reset} onFocusCapture={()=>{setFocused(true);reset();}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false);}}>
    <div className="auth-3d-rim" aria-hidden="true"/>
    <AuthFormSplitScreen {...props}/>
   </motion.div>
  </motion.div>
 </div>;
}
