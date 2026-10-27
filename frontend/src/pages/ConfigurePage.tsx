import { useMutation, useQuery } from '@tanstack/react-query'
import { FileText, LockKeyhole, Mic, Upload } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'

const TYPES = ['General HR','Behavioral','Software Engineering','Python','Backend Engineering','Full-Stack Development','Artificial Intelligence / Machine Learning','Generative AI / LLM Engineering','Agentic AI','Computer Vision','Robotics / VLA','Data Structures and Algorithms','System Design','Custom interview']

export function ConfigurePage() {
  const navigate = useNavigate(); const [params] = useSearchParams(); const quick = params.get('quick') === 'true'
  const {data: providers=[]} = useQuery({queryKey:['providers'], queryFn:api.providers})
  const [resume,setResume] = useState(''); const [job,setJob] = useState(''); const [error,setError] = useState('')
  const create = useMutation({mutationFn:api.createInterview, onSuccess:(session)=>navigate(`/interview/${session.id}`), onError:(e)=>setError((e as Error).message)})
  const upload = async (file: File, setter:(text:string)=>void) => { try { setter((await api.extract(file)).text) } catch(e){setError((e as Error).message)} }
  const submit = (event:FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); create.mutate({
    target_role:form.get('role'), interview_type:form.get('type'), difficulty:form.get('difficulty'), duration_minutes:Number(form.get('duration')),
    mode:form.get('mode'), provider_id:form.get('provider') || null, resume_text:resume, job_description:job, custom_instructions:form.get('instructions'), record_audio:form.get('record')==='on'
  }) }
  return <div className="page narrow"><div className="page-title"><span className="kicker">NEW SESSION</span><h1>Shape your interview</h1><p>Give Astra enough context to make every question count.</p></div>
    <form className="config-form" onSubmit={submit}>
      <section className="panel"><div className="panel-title"><span>01</span><div><h2>Interview focus</h2><p>Set the role, format, and challenge level.</p></div></div>
        <div className="field-grid"><label>Target role<input name="role" placeholder="e.g. Senior Backend Engineer" required/></label><label>Interview type<select name="type" defaultValue={quick?'Python':'Software Engineering'}>{TYPES.map(x=><option key={x}>{x}</option>)}</select></label><label>Difficulty<select name="difficulty" defaultValue="Intermediate"><option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></select></label><label>Duration<select name="duration" defaultValue={quick?'10':'30'}><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label></div>
      </section>
      <section className="panel"><div className="panel-title"><span>02</span><div><h2>Context</h2><p>Optional documents are parsed locally and treated as untrusted reference material.</p></div></div>
        <div className="upload-grid"><label className="dropzone"><Upload/><strong>Resume</strong><span>{resume ? 'Text extracted successfully' : 'PDF, DOCX, or TXT · max 10 MB'}</span><input type="file" accept=".pdf,.docx,.txt" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0],setResume)}/></label><label className="dropzone"><FileText/><strong>Job description</strong><span>{job ? 'Text extracted successfully' : 'Upload PDF, DOCX, or TXT'}</span><input type="file" accept=".pdf,.docx,.txt" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0],setJob)}/></label></div>
        <label>Or paste a job description<textarea rows={4} value={job} onChange={e=>setJob(e.target.value)} placeholder="Paste the role requirements here…"/></label><label>Custom instructions<textarea name="instructions" rows={3} placeholder="Topics to emphasize or avoid…"/></label>
      </section>
      <section className="panel"><div className="panel-title"><span>03</span><div><h2>Experience & privacy</h2><p>Choose interaction mode and local inference profile.</p></div></div>
        <div className="field-grid"><label>Conversation mode<select name="mode" defaultValue="text"><option value="text">Text only</option><option value="push-to-talk">Push to talk</option><option value="automatic">Automatic turn-taking</option></select></label><label>Ollama profile<select name="provider" defaultValue={providers.find(p=>p.is_default)?.id||''}><option value="">Offline question bank</option>{providers.map(p=><option value={p.id} key={p.id}>{p.name} · {p.model}</option>)}</select></label></div>
        <label className="check"><input type="checkbox" name="record"/><span><strong>Keep raw audio recordings</strong><small>Off by default. Transcripts are still saved.</small></span></label>
      </section>
      {error&&<div className="error-banner">{error}</div>}<div className="form-footer"><span><LockKeyhole/>Everything stays on your configured machine</span><button className="button primary" disabled={create.isPending}><Mic/>{create.isPending?'Preparing…':'Enter interview room'}</button></div>
    </form>
  </div>
}
