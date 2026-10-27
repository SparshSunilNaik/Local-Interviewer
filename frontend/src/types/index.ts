export interface Provider {
  id: string; name: string; base_url: string; model: string; is_default: boolean
  temperature: number; context_length: number; max_tokens: number; timeout_seconds: number
  retries: number; keep_alive: string; thinking: boolean
}
export interface Turn { id: string; sequence: number; role: string; content: string; created_at: string; metadata_json: Record<string, unknown> }
export interface Dimension { dimension: string; score: number; weight: number; explanation: string; evidence: string[]; confidence: number; suggested_improvement: string }
export interface Evaluation { overall_score: number; summary: string; strengths: string[]; improvements: string[]; suggested_questions: string[]; dimensions: Dimension[]; confidence: number }
export interface Interview {
  id: string; status: string; interview_type: string; difficulty: string; duration_minutes: number
  target_role: string; mode: string; phase: string; current_question: string; started_at: string | null
  ended_at: string | null; created_at: string; overall_score: number | null; error: string | null
  memory: Record<string, unknown>; turns: Turn[]; evaluation: Evaluation | null
}
