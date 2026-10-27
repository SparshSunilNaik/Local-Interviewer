import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Mic, Pause, Play, RotateCcw, Send, Square, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AstraOrb } from '../components/AstraOrb'
import { useRecorder } from '../hooks/useRecorder'
import { api } from '../services/api'
import { usePreferences } from '../stores/preferences'

export function InterviewPage() {
  const {id=''}=useParams(); const navigate=useNavigate(); const queryClient=useQueryClient(); const [answer,setAnswer]=useState(''); const [notice,setNotice]=useState(''); const [speaking,setSpeaking]=useState(false); const audio=useRef<HTMLAudioElement | null>(null); const rec=useRecorder(); const prefs=usePreferences()
  const {data:session,isLoading}=useQuery({queryKey:['interview',id],queryFn:()=>api.interview(id),refetchInterval:5000})
  const update=(value:unknown)=>queryClient.setQueryData(['interview',id],value)
  const submit=useMutation({mutationFn:(text:string)=>api.answer(id,text),onSuccess:(s)=>{update(s);setAnswer('');setNotice('')},onError:e=>setNotice((e as Error).message)})
  const action=useMutation({mutationFn:(a:'pause'|'resume'|'end')=>api.action(id,a),onSuccess:s=>{update(s);if(s.status==='ENDING')navigate(`/report/${id}`)}})
  const speak=async()=>{if(!session||prefs.muted)return; audio.current?.pause(); setSpeaking(true);try{const blob=await api.speak(session.current_question,prefs.voice,prefs.speed);const element=new Audio(URL.createObjectURL(blob));audio.current=element;element.volume=prefs.volume;element.onended=()=>setSpeaking(false);await element.play()}catch(e){setNotice((e as Error).message);setSpeaking(false)}}
  const record=async()=>{try{if(rec.recording){const blob=await rec.stop();setNotice('Transcribing locally…');const result=await api.transcribe(blob);setAnswer(result.text);setNotice(result.confidence===null?'Review the transcript before submitting. Confidence is unavailable.':'Review the transcript before submitting.')}else{audio.current?.pause();setSpeaking(false);await rec.start()}}catch(e){setNotice((e as Error).message)}}
  useEffect(()=>()=>audio.current?.pause(),[])
  if(isLoading||!session)return <div className="page loading">Preparing interview room…</div>
  const paused=session.status==='PAUSED'; const state=paused?'PAUSED':speaking?'SPEAKING':rec.recording?'LISTENING':session.status
  return <div className="interview-shell">
    <div className="room-top"><Link to="/" aria-label="Leave room"><ChevronLeft/></Link><div><strong>{session.target_role||session.interview_type}</strong><span>{session.difficulty} · {session.duration_minutes} min</span></div><div className="room-status"><span className="status-dot online"/>{state.toLowerCase()}</div></div>
    <div className="room-main"><section className="stage"><div className="stage-status">ASTRA · {state}</div><AstraOrb state={state} level={rec.level}/><div className="question"><p>{session.current_question}</p><button className="icon-button" onClick={speak} aria-label="Repeat question">{prefs.muted?<VolumeX/>:<Volume2/>}</button></div>
      <div className="answer-box"><textarea aria-label="Your answer" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder={rec.recording?'Listening…':'Type your answer, or use the microphone'} disabled={paused}/><div className="answer-controls"><button className={`record-button ${rec.recording?'active':''}`} onClick={record} disabled={paused||speaking} aria-label={rec.recording?'Stop recording':'Start recording'}>{rec.recording?<Square/>:<Mic/>}</button><div className="meter" aria-hidden="true"><span style={{width:`${Math.max(3,rec.level*100)}%`}}/></div><button className="button primary compact" onClick={()=>answer.trim()&&submit.mutate(answer.trim())} disabled={!answer.trim()||submit.isPending||paused}><Send/>Submit answer</button></div></div>
      {notice&&<div className="notice">{notice}</div>}<div className="room-actions"><button onClick={()=>action.mutate(paused?'resume':'pause')}>{paused?<Play/>:<Pause/>}{paused?'Resume':'Pause'}</button><button onClick={speak}><RotateCcw/>Repeat question</button><button className="danger-text" onClick={()=>confirm('End this interview and generate feedback?')&&action.mutate('end')}>End interview</button></div>
    </section><aside className="transcript"><div className="transcript-title"><span>Transcript</span><small>{session.turns.length} turns</small></div>{session.turns.map(turn=><div className={`turn ${turn.role}`} key={turn.id}><strong>{turn.role==='assistant'?'Astra':'You'}</strong><p>{turn.content}</p></div>)}</aside></div>
  </div>
}
