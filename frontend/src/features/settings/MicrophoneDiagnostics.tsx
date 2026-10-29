import { Mic, Play, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useRecorder } from '../../hooks/useRecorder'
import type { RecordedAudio } from '../../hooks/useRecorder'
import { api } from '../../services/api'
import { usePreferences } from '../../stores/preferences'

const MEDIUM_MODEL = 'mlx-community/whisper-medium.en-mlx'

interface TranscriptionResult {
  text: string
  latency_ms: number
  confidence: number | null
  needs_review: boolean
  audio_metrics: Record<string, string | number | null>
  error_rates?: {wer: number; cer: number}
}

const metric = (value: string | number | null | undefined, suffix = '') =>
  value == null ? 'Unavailable' : `${value}${suffix}`

export function MicrophoneDiagnostics() {
  const preferences = usePreferences()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [captured, setCaptured] = useState<RecordedAudio | null>(null)
  const [reference, setReference] = useState('')
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const recorder = useRecorder({
    deviceId,
    echoCancellation: preferences.echoCancellation,
    noiseSuppression: preferences.noiseSuppression,
    autoGainControl: preferences.autoGainControl,
  })
  const playbackUrl = useMemo(() => captured ? URL.createObjectURL(captured.blob) : '', [captured])

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    setDevices((await navigator.mediaDevices.enumerateDevices()).filter(item => item.kind === 'audioinput'))
  }
  useEffect(() => () => { if (playbackUrl) URL.revokeObjectURL(playbackUrl) }, [playbackUrl])

  const toggleRecording = async () => {
    setError('')
    if (recorder.recording) {
      const recording = await recorder.stop()
      setCaptured(recording); setResult(null); await refreshDevices()
    } else {
      setCaptured(null); setResult(null); await recorder.start()
    }
  }
  const transcribe = async () => {
    if (!captured) return
    setBusy(true); setError('')
    try {
      setResult(await api.transcribe(captured.blob, {
        model: MEDIUM_MODEL,
        recordingId: captured.recordingId,
        referenceText: reference || undefined,
      }))
    } catch (reason) { setError((reason as Error).message) }
    finally { setBusy(false) }
  }
  const discard = () => { setCaptured(null); setResult(null); setError('') }
  const metrics = result?.audio_metrics

  return <section className="panel mic-diagnostics">
    <div className="panel-title"><Mic/><div><h2>Microphone diagnostics</h2><p>Temporary recording, playback, and local Whisper medium.en transcription.</p></div></div>
    <div className="field-grid">
      <label>Input device<select value={deviceId} onChange={event=>setDeviceId(event.target.value)}><option value="">System default microphone</option>{devices.map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||`Microphone ${index+1}`}</option>)}</select><button type="button" className="button secondary compact" onClick={()=>void refreshDevices()}>Refresh microphones</button></label>
      <label>Speech recognition model<input value="Whisper medium.en (local MLX)" disabled/></label>
    </div>
    <div className="audio-toggles">
      {([['echoCancellation','Echo cancellation'],['noiseSuppression','Noise suppression'],['autoGainControl','Automatic gain']] as const).map(([key,label])=><label className="check" key={key}><input type="checkbox" checked={preferences[key]} onChange={event=>preferences.set({[key]:event.target.checked})}/><span><strong>{label}</strong></span></label>)}
    </div>
    <div className="diagnostic-recorder"><button className={`record-button ${recorder.recording?'active':''}`} onClick={()=>void toggleRecording()} disabled={recorder.stopping} aria-label={recorder.recording?'Stop diagnostic recording':'Start diagnostic recording'}>{recorder.recording?<Square/>:<Mic/>}</button><div className="meter"><span style={{width:`${Math.max(3,recorder.level*100)}%`}}/></div><span>{recorder.recording?'Recording…':recorder.stopping?'Finishing recording…':'Ready'}</span></div>
    {captured&&<div className="diagnostic-sample"><div><strong>Original browser recording</strong><small>{(captured.durationMs/1000).toFixed(2)} s · {captured.chunkCount} chunks · {captured.mimeType} · input {captured.trackSettings.sampleRate||'unknown'} Hz</small></div><audio controls src={playbackUrl} aria-label="Playback original recording"/><button className="icon-button" onClick={discard} aria-label="Discard diagnostic recording"><Trash2/></button></div>}
    <label>Optional exact reference text<textarea rows={3} value={reference} onChange={event=>setReference(event.target.value)} placeholder="Paste what you said to calculate WER and CER."/></label>
    {captured&&<button className="button primary compact" onClick={()=>void transcribe()} disabled={busy}>{busy?'Transcribing with medium.en…':'Transcribe with medium.en'}</button>}
    {error&&<div className="error-banner">{error}</div>}
    {result&&<article className="stt-result"><h3>medium.en transcript</h3><p>{result.text}</p><small>{(result.latency_ms/1000).toFixed(2)} s · heuristic recognition signal {result.confidence==null?'unavailable':`${Math.round(result.confidence*100)}%`}{result.needs_review?' · review recommended':''}</small>{result.error_rates&&<strong>WER {(result.error_rates.wer*100).toFixed(1)}% · CER {(result.error_rates.cer*100).toFixed(1)}%</strong>}<div className="metric-grid"><span>Input duration<strong>{metric(metrics?.input_duration_seconds,' s')}</strong><small>{metrics?.input_duration_source==='decoded_fallback'?'Decoded fallback; container metadata unavailable':'Container metadata'}</small></span><span>Normalized duration<strong>{metric(metrics?.normalized_duration_seconds,' s')}</strong></span><span>Input format<strong>{metric(metrics?.input_mime_type)}</strong></span><span>Sample rate<strong>{metric(metrics?.sample_rate,' Hz')}</strong></span><span>Peak / RMS<strong>{metric(metrics?.peak_amplitude)} / {metric(metrics?.rms_amplitude)}</strong></span><span>Clipping<strong>{metric(metrics?.clipping_percentage,'%')}</strong></span><span>Speech active<strong>{metric(metrics?.speech_active_seconds,' s')}</strong></span></div></article>}
    <p className="privacy-note"><Play/> Audio stays temporary and local. The recognition signal is a heuristic derived from model log probabilities, not a calibrated probability.</p>
  </section>
}
