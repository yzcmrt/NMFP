import {useCallback,useEffect,useRef,useState} from 'react';
import {MiningSession,MiningStatus} from '@/types';
import {miningService} from '@/services/api';
export interface MiningProgress {progress:number;timeLeft:string;timeLeftMs:number;isCompleted:boolean;sessionId?:number}
interface Props {userId:string;sessions:MiningSession[];onProgressUpdate?:(id:number,p:MiningProgress)=>void;onSessionCompleted?:(id:number)=>void}
export function useRealtimeMining(props:Props) {
 const latest=useRef(props);latest.current=props;
 const completed=useRef(new Set<number>());
 const [progressData,setProgressData]=useState<Record<number,MiningProgress>>({});
 const [isConnected,setIsConnected]=useState(false);
 const updateProgress=useCallback(()=>{
  const next:Record<number,MiningProgress>={};
  for(const s of latest.current.sessions) {
   if(s.status!==MiningStatus.ACTIVE)continue;
   const start=Date.parse(s.start_time),end=Date.parse(s.end_time),left=Math.max(0,end-Date.now());
   const seconds=Math.floor(left/1000);
   const p={progress:Math.min(100,Math.max(0,100*(Date.now()-start)/Math.max(1,end-start))),timeLeftMs:left,isCompleted:left===0,sessionId:s.id,timeLeft:[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':')};
   next[s.id]=p;latest.current.onProgressUpdate?.(s.id,p);
   if(p.isCompleted && !completed.current.has(s.id)){completed.current.add(s.id);latest.current.onSessionCompleted?.(s.id);}
  }
  setProgressData(next);
 },[]);
 const refreshProgress=useCallback(async()=>{
  if(!latest.current.userId)return;
  try {await miningService.getAllActiveMiningSessions(latest.current.userId);setIsConnected(true);}catch{setIsConnected(false);}
  updateProgress();
 },[updateProgress]);
 useEffect(()=>{completed.current.clear();updateProgress();const timer=setInterval(updateProgress,1000);return()=>clearInterval(timer);},[props.userId,updateProgress]);
 useEffect(()=>{updateProgress();},[props.sessions,updateProgress]);
 useEffect(()=>{void refreshProgress();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refreshProgress();},15000);return()=>clearInterval(timer);},[props.userId,refreshProgress]);
 return {progressData,isConnected,refreshProgress,updateProgress};
}
