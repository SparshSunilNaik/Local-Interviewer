import { useCallback, useEffect, useRef, useState } from 'react'

export interface RecorderOptions {
  deviceId?: string
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
}

export interface RecordedAudio {
  blob: Blob
  recordingId: string
  durationMs: number
  chunkCount: number
  mimeType: string
  trackSettings: MediaTrackSettings
}

const settle = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))

export function useRecorder(options: RecorderOptions = {}) {
  const [recording, setRecording] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [level, setLevel] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const animation = useRef(0)
  const context = useRef<AudioContext | null>(null)
  const recordingId = useRef('')
  const startedAt = useRef(0)

  const cleanup = useCallback(async () => {
    cancelAnimationFrame(animation.current)
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    if (context.current && context.current.state !== 'closed') await context.current.close()
    context.current = null
    recorder.current = null
    setRecording(false)
    setStopping(false)
    setLevel(0)
  }, [])

  const start = async () => {
    if (recorder.current || recording || stopping) throw new Error('A recording is already active')
    const constraints: MediaTrackConstraints = {
      echoCancellation: options.echoCancellation ?? true,
      noiseSuppression: options.noiseSuppression ?? true,
      autoGainControl: options.autoGainControl ?? true,
      ...(options.deviceId ? { deviceId: { exact: options.deviceId } } : {}),
    }
    const media = await navigator.mediaDevices.getUserMedia({ audio: constraints })
    stream.current = media
    chunks.current = []
    recordingId.current = crypto.randomUUID()
    const preferred = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
    const instance = new MediaRecorder(media, preferred ? { mimeType: preferred } : undefined)
    recorder.current = instance
    instance.ondataavailable = event => {
      if (event.data.size > 0 && recorder.current === instance) chunks.current.push(event.data)
    }
    const audioContext = new AudioContext()
    context.current = audioContext
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    audioContext.createMediaStreamSource(media).connect(analyser)
    const values = new Float32Array(analyser.fftSize)
    const meter = () => {
      analyser.getFloatTimeDomainData(values)
      const rms = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length)
      setLevel(Math.min(1, rms * 5))
      animation.current = requestAnimationFrame(meter)
    }
    meter()
    // Let the browser's input processing settle before indicating that speech can begin.
    await settle(150)
    instance.start(250)
    startedAt.current = performance.now()
    setRecording(true)
  }

  const stop = () => new Promise<RecordedAudio>((resolve, reject) => {
    const instance = recorder.current
    if (!instance || instance.state !== 'recording') return reject(new Error('Recorder is not active'))
    setStopping(true)
    // A short tail avoids cutting the final phoneme. MediaRecorder emits its final dataavailable
    // event before stop, so resolving in onstop guarantees every ordered chunk is included once.
    void settle(180).then(() => {
      instance.onstop = () => {
        const trackSettings = stream.current?.getAudioTracks()[0]?.getSettings() || {}
        const result: RecordedAudio = {
          blob: new Blob(chunks.current, { type: instance.mimeType || 'audio/webm' }),
          recordingId: recordingId.current,
          durationMs: Math.round(performance.now() - startedAt.current),
          chunkCount: chunks.current.length,
          mimeType: instance.mimeType || 'audio/webm',
          trackSettings,
        }
        void cleanup().then(() => resolve(result))
      }
      instance.onerror = () => { void cleanup(); reject(new Error('The browser could not finish the recording')) }
      instance.stop()
    })
  })

  const cancel = async () => {
    const instance = recorder.current
    if (instance?.state === 'recording') instance.stop()
    chunks.current = []
    await cleanup()
  }

  useEffect(() => () => { void cleanup() }, [cleanup])
  return { recording, stopping, level, start, stop, cancel }
}
