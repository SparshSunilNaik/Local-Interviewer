import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecorder } from './useRecorder'
import type { RecordedAudio } from './useRecorder'

class FakeRecorder {
  static isTypeSupported = () => true
  state: RecordingState = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((event: {data: Blob}) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}
  start() {
    this.state = 'recording'
    this.ondataavailable?.({data:new Blob(['first'])})
    this.ondataavailable?.({data:new Blob(['second'])})
  }
  stop() {
    this.ondataavailable?.({data:new Blob(['final'])})
    this.state = 'inactive'
    this.onstop?.()
  }
}

const stopTrack = vi.fn()
const mediaStream = {
  getTracks: () => [{stop:stopTrack}],
  getAudioTracks: () => [{getSettings:() => ({sampleRate:48000, channelCount:1})}],
} as unknown as MediaStream

class FakeAudioContext {
  state = 'running'
  createAnalyser() { return {fftSize:512, getFloatTimeDomainData:(values:Float32Array)=>values.fill(.02)} }
  createMediaStreamSource() { return {connect:vi.fn()} }
  close() { this.state = 'closed'; return Promise.resolve() }
}

describe('useRecorder', () => {
  beforeEach(() => {
    stopTrack.mockClear()
    Object.defineProperty(navigator, 'mediaDevices', {configurable:true, value:{getUserMedia:vi.fn(async()=>mediaStream)}})
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  it('waits for the final flush and includes each ordered chunk once', async () => {
    const {result} = renderHook(() => useRecorder())
    await act(async () => { await result.current.start() })
    let captured: RecordedAudio | undefined
    await act(async () => { captured = await result.current.stop() })
    expect(captured!.chunkCount).toBe(3)
    expect(await captured!.blob.text()).toBe('firstsecondfinal')
    expect(captured!.trackSettings.sampleRate).toBe(48000)
    expect(stopTrack).toHaveBeenCalledOnce()
  })

  it('releases the microphone when recording is cancelled', async () => {
    const {result} = renderHook(() => useRecorder())
    await act(async () => { await result.current.start() })
    await act(async () => { await result.current.cancel() })
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(result.current.recording).toBe(false)
  })
})
