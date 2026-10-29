import { Mic, Play, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useRecorder } from '../../hooks/useRecorder'
import type { RecordedAudio } from '../../hooks/useRecorder'
import { api } from '../../services/api'
import { usePreferences } from '../../stores/preferences'

const BASE_MODEL = 'mlx-community/whisper-base.en-mlx'
const SMALL_MODEL = 'mlx-community/whisper-small.en-mlx'

interface Comparison {
  text: string
  latency_ms: number
  confidence: number | null
  needs_review: boolean
  audio_metrics: Record<string, string | number>
  error_rates?: {wer: number; cer: number}
}

export function MicrophoneDiagnostics() {
  const preferences = usePreferences()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [captured, setCaptured] = useState<RecordedAudio | null>(null)
  const [reference, setReference] = useState('')
  const [results, setResults] = useState<Record<string, Comparison>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const recorder = useRecorder({
    deviceId,
    echoCancellation: preferences.echoCancellation,
    noiseSuppression: preferences.noiseSuppression,
    autoGainControl: preferences.autoGainControl,
  })
  const playbackUrl = useMemo(
    () => captured ? URL.createObjectURL(captured.blob) : '',
    [captured],
  )

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    setDevices((await navigator.mediaDevices.enumerateDevices()).filter(item => item.kind === 'audioinput'))
  }
  useEffect(() => () => { if (playbackUrl) URL.revokeObjectURL(playbackUrl) }, [playbackUrl])

  const toggleRecording = async () => {
    setError('')
    if (recorder.recording) {
      const result = await recorder.stop()
      setCaptured(result); setResults({}); await refreshDevices()
    } else {
      setCaptured(null); setResults({}); await recorder.start()
    }
  }
  const transcribe = async (model: string) => {
    if (!captured) return
    setBusy(model); setError('')
    try {
      const result = await api.transcribe(captured.blob, {
        model,
        recordingId: `${captured.recordingId}-${model.split('/').pop()}`,
        referenceText: reference || undefined,
      })
      setResults(current => ({...current, [model]: result}))
    } catch (reason) { setError((reason as Error).message) }
    finally { setBusy('') }
  }
  const discard = () => { setCaptured(null); setResults({}); setError('') }

  return <section className="panel mic-diagnostics">
    <div className="panel-title"><Mic/><div><h2>Microphone diagnostics</h2><p>Temporary local recording, playback, audio metrics, and identical-model comparison.</p></div></div>
    <div className="field-grid">
      <label>Input device<select value={deviceId} onChange={event=>setDeviceId(event.target.value)}><option value="">System default microphone</option>{devices.map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||`Microphone ${index+1}`}</option>)}</select></label>
      <label>Interview STT model<select value={preferences.sttModel} onChange={event=>preferences.set({sttModel:event.target.value})}><option value={SMALL_MODEL}>Whisper small.en (recommended)</option><option value={BASE_MODEL}>Whisper base.en (faster fallback)</option></select></label>
    </div>
    <div className="audio-toggles">
      {([['echoCancellation','Echo cancellation'],['noiseSuppression','Noise suppression'],['autoGainControl','Automatic gain']] as const).map(([key,label])=><label className="check" key={key}><input type="checkbox" checked={preferences[key]} onChange={event=>preferences.set({[key]:event.target.checked})}/><span><strong>{label}</strong></span></label>)}
    </div>
    <div className="diagnostic-recorder">
      <button className={`record-button ${recorder.recording?'active':''}`} onClick={()=>void toggleRecording()} disabled={recorder.stopping} aria-label={recorder.recording?'Stop diagnostic recording':'Start diagnostic recording'}>{recorder.recording?<Square/>:<Mic/>}</button>
      <div className="meter"><span style={{width:`${Math.max(3,recorder.level*100)}%`}}/></div>
      <span>{recorder.recording?'Recording…':recorder.stopping?'Finishing recording…':'Ready'}</span>
    </div>
    {captured&&<div className="diagnostic-sample">
      <div><strong>Original browser recording</strong><small>{(captured.durationMs/1000).toFixed(2)} s · {captured.chunkCount} chunks · {captured.mimeType} · input {captured.trackSettings.sampleRate||'unknown'} Hz</small></div>
      <audio controls src={playbackUrl} aria-label="Playback original recording"/><button className="icon-button" onClick={discard} aria-label="Discard diagnostic recording"><Trash2/></button>
    </div>}
    <label>Optional exact reference text<textarea rows={3} value={reference} onChange={event=>setReference(event.target.value)} placeholder="Paste what you said to calculate WER and CER."/></label>
    {captured&&<div className="comparison-actions"><button className="button secondary compact" onClick={()=>void transcribe(BASE_MODEL)} disabled={!!busy}>{busy===BASE_MODEL?'Transcribing…':'Transcribe base.en'}</button><button className="button primary compact" onClick={()=>void transcribe(SMALL_MODEL)} disabled={!!busy}>{busy===SMALL_MODEL?'Transcribing…':'Transcribe small.en'}</button></div>}
    {error&&<div className="error-banner">{error}</div>}
    {Object.keys(results).length>0&&<div className="stt-comparison">{[BASE_MODEL,SMALL_MODEL].map(model=>results[model]&&<article key={model}><h3>{model.includes('small')?'small.en':'base.en'}</h3><p>{results[model].text}</p><small>{(results[model].latency_ms/1000).toFixed(2)} s · confidence {results[model].confidence==null?'unavailable':`${Math.round(results[model].confidence!*100)}%`}{results[model].needs_review?' · review recommended':''}</small>{results[model].error_rates&&<strong>WER {(results[model].error_rates!.wer*100).toFixed(1)}% · CER {(results[model].error_rates!.cer*100).toFixed(1)}%</strong>}<pre>{JSON.stringify(results[model].audio_metrics,null,2)}</pre></article>)}</div>}
    <p className="privacy-note"><Play/> Playback never uploads audio anywhere except this loopback FastAPI service. Recordings disappear when discarded or the page closes.</p>
  </section>
}
