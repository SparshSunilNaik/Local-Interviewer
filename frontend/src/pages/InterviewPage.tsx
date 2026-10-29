import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Mic, Pause, Play, RotateCcw, Send, Square, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AstraOrb } from '../components/AstraOrb'
import { useRecorder } from '../hooks/useRecorder'
import { api } from '../services/api'
import { usePreferences } from '../stores/preferences'

export function InterviewPage() {
  const {id=''}=useParams(); const navigate=useNavigate(); const queryClient=useQueryClient(); const [answer,setAnswer]=useState(''); const [notice,setNotice]=useState(''); const [speaking,setSpeaking]=useState(false); const audio=useRef<HTMLAudioElement | null>(null); const speechRequest=useRef<AbortController | null>(null); const speechGeneration=useRef(0); const autoSpokenQuestion=useRef(''); const prefs=usePreferences(); const rec=useRecorder({echoCancellation:prefs.echoCancellation,noiseSuppression:prefs.noiseSuppression,autoGainControl:prefs.autoGainControl})
  const {data:session,isLoading}=useQuery({queryKey:['interview',id],queryFn:()=>api.interview(id),refetchInterval:5000})
  const update=(value:unknown)=>queryClient.setQueryData(['interview',id],value)
  const submit=useMutation({mutationFn:(text:string)=>api.answer(id,text),onSuccess:(s)=>{update(s);setAnswer('');setNotice('')},onError:e=>setNotice((e as Error).message)})
  const action=useMutation({mutationFn:(a:'pause'|'resume'|'end')=>api.action(id,a),onSuccess:s=>{update(s);if(s.status==='ENDING')navigate(`/report/${id}`)}})
  const stopSpeaking=useCallback(()=>{speechGeneration.current+=1;speechRequest.current?.abort();speechRequest.current=null;if(audio.current){audio.current.pause();audio.current.src='';audio.current=null}setSpeaking(false)},[])
  const speak=useCallback(async()=>{if(!session||prefs.muted)return;stopSpeaking();const generation=speechGeneration.current;const controller=new AbortController();speechRequest.current=controller;setSpeaking(true);try{const blob=await api.speak(session.current_question,prefs.voice,prefs.speed,controller.signal);if(generation!==speechGeneration.current)return;const url=URL.createObjectURL(blob);const element=new Audio(url);audio.current=element;element.volume=prefs.volume;element.onended=()=>{URL.revokeObjectURL(url);if(generation===speechGeneration.current)setSpeaking(false)};await element.play()}catch(e){if((e as Error).name!=='AbortError')setNotice((e as Error).message);if(generation===speechGeneration.current)setSpeaking(false)}},[session,prefs.muted,prefs.voice,prefs.speed,prefs.volume,stopSpeaking])
  const record=async()=>{try{if(rec.recording){const captured=await rec.stop();setNotice('Transcribing locally…');const result=await api.transcribe(captured.blob,{model:prefs.sttModel,recordingId:captured.recordingId});setAnswer(result.text);setNotice(result.needs_review?'Low-confidence or degraded audio: review carefully or record again.':'Review the transcript before submitting.')}else{stopSpeaking();await rec.start()}}catch(e){setNotice((e as Error).message)}}
  useEffect(()=>()=>stopSpeaking(),[stopSpeaking])
  useEffect(()=>{if(session&&session.mode!=='text'&&session.current_question!==autoSpokenQuestion.current){autoSpokenQuestion.current=session.current_question;void speak()}},[session,speak])
  if(isLoading||!session)return <div className="page loading">Preparing interview room…</div>
  const paused=session.status==='PAUSED'; const state=paused?'PAUSED':speaking?'SPEAKING':rec.recording?'LISTENING':session.status
  return <div className="interview-shell">
    <div className="room-top"><Link to="/" aria-label="Leave room"><ChevronLeft/></Link><div><strong>{session.target_role||session.interview_type}</strong><span>{session.difficulty} · {session.duration_minutes} min</span></div><div className="room-status"><span className="status-dot online"/>{state.toLowerCase()}</div></div>
    <div className="room-main"><section className="stage"><div className="stage-status">ASTRA · {state}</div><AstraOrb state={state} level={rec.level}/><div className="question"><p>{session.current_question}</p><button className="icon-button" onClick={speak} aria-label="Repeat question">{prefs.muted?<VolumeX/>:<Volume2/>}</button></div>
      <div className="answer-box"><textarea aria-label="Your answer" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder={rec.recording?'Listening…':'Type your answer, or use the microphone'} disabled={paused}/><div className="answer-controls"><button className={`record-button ${rec.recording?'active':''}`} onClick={record} disabled={paused||speaking||rec.stopping} aria-label={rec.recording?'Stop recording':'Start recording'}>{rec.recording?<Square/>:<Mic/>}</button><div className="meter" aria-hidden="true"><span style={{width:`${Math.max(3,rec.level*100)}%`}}/></div><button className="button primary compact" onClick={()=>answer.trim()&&submit.mutate(answer.trim())} disabled={!answer.trim()||submit.isPending||paused}><Send/>Submit answer</button></div></div>
      {notice&&<div className="notice">{notice}</div>}<div className="room-actions"><button onClick={()=>action.mutate(paused?'resume':'pause')}>{paused?<Play/>:<Pause/>}{paused?'Resume':'Pause'}</button>{speaking?<button onClick={stopSpeaking}><Square/>Stop speaking</button>:<button onClick={speak}><RotateCcw/>Repeat question</button>}<button className="danger-text" onClick={()=>confirm('End this interview and generate feedback?')&&action.mutate('end')}>End interview</button></div>
    </section><aside className="transcript"><div className="transcript-title"><span>Transcript</span><small>{session.turns.length} turns</small></div>{session.turns.map(turn=><div className={`turn ${turn.role}`} key={turn.id}><strong>{turn.role==='assistant'?'Astra':'You'}</strong><p>{turn.content}</p></div>)}</aside></div>
  </div>
}
