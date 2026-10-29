import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { MicrophoneDiagnostics } from './MicrophoneDiagnostics'

const stop = vi.fn(async () => ({
  blob: new Blob(['recorded audio'], {type:'audio/webm'}),
  recordingId: 'recording-1', durationMs: 2100, chunkCount: 9,
  mimeType: 'audio/webm;codecs=opus', trackSettings: {sampleRate: 48000},
}))

vi.mock('../../hooks/useRecorder', () => ({
  useRecorder: () => ({recording:true, stopping:false, level:.3, start:vi.fn(), stop, cancel:vi.fn()}),
}))
vi.mock('../../services/api', () => ({api:{transcribe:vi.fn(async () => ({
  text:'Hello 123 123 mic testing.', confidence:.8, needs_review:false, latency_ms:900,
  audio_metrics:{normalized_duration_seconds:2.1}, error_rates:{wer:0,cer:0},
}))}}))

describe('MicrophoneDiagnostics', () => {
  beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:diagnostic')
    URL.revokeObjectURL = vi.fn()
  })
  it('keeps a completed recording available for playback and model comparison', async () => {
    render(<MicrophoneDiagnostics/>)
    fireEvent.click(screen.getByRole('button', {name:'Stop diagnostic recording'}))
    expect(await screen.findByLabelText('Playback original recording')).toBeInTheDocument()
    expect(screen.getByText(/2.10 s · 9 chunks/)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/Paste what you said/), {target:{value:'Hello 123 123 mic testing.'}})
    fireEvent.click(screen.getByRole('button', {name:'Transcribe small.en'}))
    await waitFor(() => expect(screen.getByText('WER 0.0% · CER 0.0%')).toBeInTheDocument())
  })
})
