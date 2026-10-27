import { useRef, useState } from 'react'

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [level, setLevel] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const animation = useRef(0)

  const start = async () => {
    const media = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}})
    stream.current = media; chunks.current = []
    const preferred = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
    const instance = new MediaRecorder(media, preferred ? {mimeType:preferred} : undefined)
    recorder.current = instance
    instance.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
    const context = new AudioContext(); const analyser = context.createAnalyser(); context.createMediaStreamSource(media).connect(analyser); const values = new Uint8Array(analyser.frequencyBinCount)
    const meter = () => { analyser.getByteFrequencyData(values); setLevel(values.reduce((a,b)=>a+b,0) / values.length / 255); animation.current=requestAnimationFrame(meter) }; meter()
    instance.start(250); setRecording(true)
  }
  const stop = () => new Promise<Blob>((resolve, reject) => {
    if (!recorder.current) return reject(new Error('Recorder is not active'))
    recorder.current.onstop = () => { cancelAnimationFrame(animation.current); stream.current?.getTracks().forEach(track=>track.stop()); setRecording(false); setLevel(0); resolve(new Blob(chunks.current, {type:recorder.current?.mimeType || 'audio/webm'})) }
    recorder.current.stop()
  })
  return {recording, level, start, stop}
}
