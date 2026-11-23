/* Local Interviewer, offline mode in the browser.
   A JavaScript port of backend/app: the question bank (services/interview/questions.py), the interview engine's
   deterministic path (services/interview/engine.py), the fallback grader (services/evaluation/grader.py), the
   Markdown/JSON exporter, and the API routes the React app calls. State lives in localStorage. */
(function (root) {
  "use strict";

  /* ---------- questions.py ---------- */
  var CATEGORIES = ["General HR", "Behavioral", "Technical", "Software Engineering", "Python", "Backend Engineering", "Full-Stack Development", "Artificial Intelligence / Machine Learning", "Generative AI / LLM Engineering", "Agentic AI", "Computer Vision", "Robotics / VLA", "Data Structures and Algorithms", "System Design", "Custom interview"];
  var COMMON = [
    ["introduction", "Please introduce yourself and tell me what drew you to this role."],
    ["reflection", "What is one skill you are deliberately improving right now, and how?"],
    ["candidate_questions", "What would you like to ask about the role or team?"]
  ];
  var QUESTION_BANK = {
    "General HR": [["motivation", "What matters most to you in your next role?"], ["collaboration", "Describe the environment in which you do your best work."]],
    "Behavioral": [["ownership", "Tell me about a time you took ownership of a difficult outcome."], ["conflict", "Walk me through a disagreement you handled constructively."]],
    "Technical": [["debugging", "Describe your systematic approach to diagnosing an unfamiliar technical failure."], ["tradeoffs", "How do you decide when a solution is sufficiently robust to ship?"]],
    "Software Engineering": [["design", "How would you structure a service so it remains maintainable as the team grows?"], ["quality", "Tell me about a subtle production defect you found and how you prevented recurrence."]],
    "Python": [["runtime", "Explain Python's object model and how mutability can create surprising behavior."], ["concurrency", "When would you choose asyncio, threads, or processes in Python?"]],
    "Backend Engineering": [["api", "Design an idempotent API for a payment-like operation."], ["reliability", "How would you make a service resilient to a slow downstream dependency?"]],
    "Full-Stack Development": [["boundaries", "How do you decide which logic belongs in the browser versus the server?"], ["delivery", "Walk through shipping a user-facing feature from schema to accessible UI."]],
    "Artificial Intelligence / Machine Learning": [["evaluation", "How would you establish that a model improves on a meaningful baseline?"], ["drift", "How would you detect and respond to data or concept drift?"]],
    "Generative AI / LLM Engineering": [["rag", "Design and evaluate a retrieval-augmented generation system for high-stakes documents."], ["inference", "What trade-offs govern latency, quality, and cost in LLM inference?"]],
    "Agentic AI": [["control", "How would you constrain and evaluate an agent that can call external tools?"], ["memory", "What should an agent remember, and how would you prevent memory from becoming harmful?"]],
    "Computer Vision": [["metrics", "How would you choose metrics for a highly imbalanced detection problem?"], ["deployment", "What changes when a vision model moves from a notebook to an edge device?"]],
    "Robotics / VLA": [["safety", "How would you validate a learned policy before allowing it to control real hardware?"], ["generalization", "How would you diagnose poor sim-to-real transfer in a manipulation task?"]],
    "Data Structures and Algorithms": [["complexity", "Given a stream too large for memory, how would you find frequent items?"], ["graphs", "How would you detect and explain a dependency cycle in a large graph?"]],
    "System Design": [["scale", "Design a notification system that supports retries without duplicate delivery."], ["consistency", "Where would you accept eventual consistency in a collaborative application, and why?"]],
    "Custom interview": [["objective", "What experience best demonstrates your fit for the objective of this interview?"], ["depth", "Choose a relevant project and explain the hardest decision you made."]]
  };
  function questionsFor(category) {
    var bank = Object.prototype.hasOwnProperty.call(QUESTION_BANK, category) ? QUESTION_BANK[category] : QUESTION_BANK["Custom interview"];
    return [COMMON[0]].concat(bank, COMMON.slice(1));
  }

  /* ---------- helpers ---------- */
  function pyRound(x, n) { // Python round(): correctly rounded, exact binary ties go to even
    if (!isFinite(x)) return x;
    var exact = Math.abs(x).toFixed(Math.min(100, n + 60)), dot = exact.indexOf("."), rest = exact.slice(dot + 1 + n);
    if (/^50*$/.test(rest)) {
      var lastDigit = n ? +exact.charAt(dot + n) : +exact.charAt(dot - 1), down = +(exact.slice(0, dot + 1 + n));
      var v = lastDigit % 2 === 0 ? down : down + Math.pow(10, -n);
      return (x < 0 ? -1 : 1) * +v.toFixed(n);
    }
    return +x.toFixed(n);
  }
  function pySplit(s) { var t = String(s).trim(); return t ? t.split(/\s+/) : []; }
  function pyStrip(s) { return String(s).replace(/^\s+|\s+$/g, ""); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function uuid() { return root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }); }
  function nowIso(t) { return new Date(t).toISOString(); }
  function sliceCodepoints(s, n) { return Array.from(s).slice(0, n).join(""); }
  function action(a) { return Object.assign({ action: "ask", rationale: "", demonstrated_strengths: [], knowledge_gaps: [] }, a); }

  /* ---------- engine.py (offline path) ---------- */
  function Engine(state, opts) { this.s = state; this.opts = opts || {}; }
  Engine.prototype.now = function () { return this.opts.now ? this.opts.now() : Date.now(); };
  Engine.prototype.addTurn = function (session, sequence, role, content, questionId) {
    session.turns.push({ id: uuid(), sequence: sequence, role: role, content: content, created_at: nowIso(this.now()), metadata_json: {}, question_id: questionId || null });
  };
  Engine.prototype.start = function (session) {
    var bank = questionsFor(session.interview_type), topic = bank[0][0], question = bank[0][1];
    var greeting = "Welcome. I'm Astra, and I'll guide this " + session.duration_minutes + "-minute interview. " + question;
    session.status = "LISTENING"; session.phase = "warm-up"; session.current_question = greeting;
    session.memory = Object.assign({}, session.memory, { covered_topics: [topic], questions_asked: [greeting], follow_up_count: 0, strengths: [], knowledge_gaps: [], message_ids: [], bank_index: 1 });
    this.addTurn(session, 1, "assistant", greeting, topic);
    return greeting;
  };
  Engine.prototype.acceptAnswer = function (session, answer, messageId) {
    var memory = clone(session.memory);
    if ((memory.message_ids || []).indexOf(messageId) >= 0) return [session.current_question, false];
    // SQLAlchemy does not add the new turn to the loaded session.turns collection, so counts below exclude it.
    var priorTurns = session.turns.slice(), sequence = priorTurns.length + 1;
    var pending = { id: uuid(), sequence: sequence, role: "candidate", content: answer, created_at: nowIso(this.now()), metadata_json: {}, question_id: null };
    (memory.message_ids = memory.message_ids || []).push(messageId);
    memory.message_ids = memory.message_ids.slice(-100);
    session.status = "THINKING"; session.memory = memory;
    var view = { turns: priorTurns, duration_minutes: session.duration_minutes };
    var act = this.nextAction(session, answer), question;
    if (act.action === "end" || shouldEnd(view)) {
      session.status = "ENDING"; session.phase = "closing";
      question = "Thank you for your time. Before we close, is there anything important you would like to add?";
    } else {
      question = act.question; session.status = "LISTENING"; session.phase = phase(view);
    }
    memory = clone(session.memory);
    (memory.covered_topics = memory.covered_topics || []).push(act.topic);
    (memory.questions_asked = memory.questions_asked || []).push(question);
    memory.follow_up_count = (act.action === "transition" || act.action === "end") ? 0 : Math.min(2, parseInt(memory.follow_up_count || 0, 10) + 1);
    memory.strengths = dedupe((memory.strengths || []).concat(act.demonstrated_strengths)).slice(-10);
    memory.knowledge_gaps = dedupe((memory.knowledge_gaps || []).concat(act.knowledge_gaps)).slice(-10);
    session.memory = memory; session.current_question = question;
    session.turns.push(pending);
    this.addTurn(session, sequence + 1, "assistant", question, act.topic);
    return [question, true];
  };
  function dedupe(a) { var seen = {}, out = []; a.forEach(function (x) { var k = JSON.stringify(x); if (!seen[k]) { seen[k] = 1; out.push(x); } }); return out; }
  Engine.prototype.nextAction = function (session, answer) {
    return recoveryAction(answer) || this.fallback(session, answer);
  };
  Engine.prototype.fallback = function (session, answer) {
    var memory = session.memory, followups = parseInt(memory.follow_up_count || 0, 10), bank, index, t;
    if (followups >= 2) {
      bank = questionsFor(session.interview_type); index = parseInt(memory.bank_index || 1, 10); t = bank[index % bank.length];
      memory.bank_index = index + 1; memory.follow_up_count = 0; session.memory = memory;
      return action({ action: "transition", topic: t[0], question: t[1] });
    }
    if (pySplit(answer).length < 18 && followups < 1) {
      memory.follow_up_count = followups + 1; session.memory = memory;
      return action({ action: "clarify", topic: "clarification", question: "Could you walk me through a concrete example and your specific contribution?" });
    }
    bank = questionsFor(session.interview_type); index = parseInt(memory.bank_index || 1, 10); t = bank[index % bank.length];
    memory.bank_index = index + 1; memory.follow_up_count = 0; session.memory = memory;
    return action({ action: "ask", topic: t[0], question: t[1] });
  };
  function recoveryAction(answer) {
    var normalized = answer.toLowerCase().replace(/[^a-z0-9 ]/g, " "), words = pySplit(normalized), set = {};
    words.forEach(function (w) { set[w] = 1; });
    var has = function (w) { return !!set[w]; };
    if (words.length <= 10 && ["mic", "microphone", "testing", "test"].some(has) && !["python", "api", "database", "system"].some(has)) {
      return action({ action: "clarify", topic: "answer_clarification", question: "It sounds like that may have been a microphone test. Would you like me to repeat the question before you answer?", rationale: "The response does not address the interview question." });
    }
    if (["not sure", "don t know", "do not know", "unsure"].some(function (m) { return normalized.indexOf(m) >= 0; }) && words.length <= 16) {
      return action({ action: "clarify", topic: "conceptual_reframe",
        question: ["database", "index", "indexing"].some(has) ? "Let's make it concrete: if a database lookup slows as a table grows, what would you investigate first?" : "Let's take a simpler angle: what part of that problem would you investigate first, and how would you test your understanding?",
        rationale: "Reframe uncertainty with an approachable scenario." });
    }
    if (has("gil") && has("parallel") && has("threads") && (has("all") || has("makes"))) {
      return action({ action: "clarify", topic: "python_gil", question: "How would you test that claim with a CPU-bound Python task, and what result would you expect as you add threads?", rationale: "Probe a likely misconception without revealing the answer.", knowledge_gaps: ["Python GIL and CPU-bound threading"] });
    }
    return null;
  }
  function candidateCount(view) { return view.turns.filter(function (t) { return t.role === "candidate"; }).length; }
  function shouldEnd(view) { return candidateCount(view) >= Math.max(4, Math.floor(view.duration_minutes / 4)); }
  function phase(view) {
    var n = candidateCount(view);
    if (n <= 1) return "background";
    if (n < Math.max(3, Math.floor(view.duration_minutes / 5))) return "core";
    return "scenario";
  }

  /* ---------- grader.py (deterministic fallback, used without a model) ---------- */
  function deterministicGrade(answers) {
    var words = answers.map(pySplit), average = words.reduce(function (a, w) { return a + w.length; }, 0) / words.length;
    var evidenceScore = Math.min(80, 40 + average * 0.6), clarityScore = Math.min(80, 45 + Math.min(average, 50) * 0.5);
    var anyWord = words.some(function (w) { return w.length > 0; });
    var evidence = answers.slice(0, 2).map(function (a) { return sliceCodepoints(a, 180); });
    return {
      overall_score: pyRound((evidenceScore + clarityScore) / 2, 1),
      summary: "Limited local fallback assessment. Connect an Ollama profile for deeper technical evaluation.",
      strengths: average >= 20 ? ["Completed the interview with substantive answers"] : [],
      improvements: ["Add concrete evidence and explicit trade-offs"],
      suggested_questions: ["Describe a failure, its root cause, and what changed afterward."],
      dimensions: [
        { dimension: "Depth of explanation", score: evidenceScore, weight: 0.5, explanation: "Based on the specificity and development of the submitted answers.", evidence: evidence, confidence: 0.45, suggested_improvement: "Use a concrete example with decisions, trade-offs, and a measured outcome." },
        { dimension: "Communication clarity", score: clarityScore, weight: 0.5, explanation: "Based on answer structure and completeness; content was not fact-checked.", evidence: evidence, confidence: 0.4, suggested_improvement: "Lead with the conclusion, then support it with concise evidence." }
      ],
      confidence: anyWord ? 0.4 : 0.3
    };
  }
  // The model-path evidence check, used by the guide page to show which quotes survive.
  function enforceEvidence(quotes, answers) {
    var norm = function (s) { return pySplit(s).join(" ").toLowerCase(); }, normalizedAnswers = answers.map(norm);
    return quotes.map(function (q) { var n = norm(q); return { quote: q, kept: normalizedAnswers.some(function (a) { return a.indexOf(n) >= 0; }) }; });
  }

  /* ---------- exporter.py ---------- */
  function asDict(s) {
    var e = s.evaluation;
    return { schema_version: "1.0", session: { id: s.id, type: s.interview_type, difficulty: s.difficulty, target_role: s.target_role, status: s.status, created_at: s.created_at, overall_score: s.overall_score },
      evaluation: e ? { summary: e.summary, strengths: e.strengths, improvements: e.improvements, dimensions: e.dimensions, confidence: e.confidence } : null,
      transcript: s.turns.map(function (t) { return { role: t.role, content: t.content, timestamp: t.created_at }; }),
      disclaimer: "AI-generated practice feedback; not a validated hiring decision." };
  }
  function markdown(s) {
    var d = asDict(s), lines = ["# Local Interviewer Report", "", "**Role:** " + (s.target_role || "Not specified"), "**Interview:** " + s.interview_type + " · " + s.difficulty, "**Status:** " + s.status];
    if (s.overall_score != null) lines.push("**Practice score:** " + s.overall_score.toFixed(1) + "/100");
    lines.push("", "> AI-generated practice feedback; not a validated hiring decision.", "");
    if (d.evaluation) {
      lines.push("## Summary", d.evaluation.summary, "", "## Strengths");
      d.evaluation.strengths.forEach(function (x) { lines.push("- " + x); });
      lines.push("", "## Improvements");
      d.evaluation.improvements.forEach(function (x) { lines.push("- " + x); });
    }
    lines.push("", "## Transcript");
    s.turns.forEach(function (t) { lines.push("", "**" + (t.role === "assistant" ? "Astra" : "Candidate") + ":** " + t.content); });
    return lines.join("\n");
  }

  /* ---------- API ---------- */
  var KEY = "local-interviewer-demo-v1";
  function fresh() { return { sessions: [], providers: [], settings: null }; }
  function load() { try { var j = root.localStorage && root.localStorage.getItem(KEY); if (j) return JSON.parse(j); } catch (e) {} return fresh(); }
  function save(s) { try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function res(status, body, type) { return { status: status, body: body, type: type || "application/json" }; }
  function err(status, detail) { return res(status, { detail: detail }); }
  function read(s) {
    var out = clone(s);
    out.turns = out.turns.slice().sort(function (a, b) { return a.sequence - b.sequence; }).map(function (t) { return { id: t.id, sequence: t.sequence, role: t.role, content: t.content, created_at: t.created_at, metadata_json: t.metadata_json }; });
    ["provider_id", "config_snapshot", "custom_instructions"].forEach(function (k) { delete out[k]; });
    return out;
  }
  var DIFFS = ["Beginner", "Intermediate", "Advanced", "Expert"], MODES = ["text", "push-to-talk", "automatic"];
  var LOCAL_ONLY = "This browser demo runs the offline question bank. Ollama, speech recognition and voice need the app running on your own machine.";

  function handle(method, url, body, opts) {
    var st = (opts && opts.state) || load(), E = new Engine(st, opts), u = new URL(url, "http://x"), path = u.pathname.replace(/^.*\/api\/v1/, ""), m, out, s;
    var find = function (id) { return st.sessions.filter(function (x) { return x.id === id; })[0]; };
    try {
      if (method === "GET" && path === "/health") out = res(200, { status: "ok", service: "local-interviewer", version: "1.0.0" });
      else if (method === "GET" && path === "/diagnostics") out = res(200, { stt: { "mlx-whisper": false, "faster-whisper": false }, tts: { kokoro: false, "macos-say": false }, ffmpeg: false, mode: "browser demo, offline question bank", privacy: "Nothing you type leaves this browser. Install the app locally for Ollama, Whisper and voice." });
      else if (method === "GET" && path === "/interviews/templates") out = res(200, { types: CATEGORIES, difficulties: DIFFS, durations: [10, 15, 30, 45, 60] });
      else if (method === "GET" && path === "/interviews") {
        var list = st.sessions.slice().sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); });
        var off = +(u.searchParams.get("offset") || 0), lim = +(u.searchParams.get("limit") || 30);
        out = res(200, list.slice(off, off + lim).map(read));
      }
      else if (method === "POST" && path === "/interviews") {
        var p = body || {};
        if (!p.interview_type || DIFFS.indexOf(p.difficulty) < 0 || !(p.duration_minutes >= 5 && p.duration_minutes <= 180) || (p.mode && MODES.indexOf(p.mode) < 0)) out = err(422, "Invalid interview configuration");
        else if (p.provider_id && !st.providers.some(function (x) { return x.id === p.provider_id; })) out = err(400, "Selected provider does not exist");
        else {
          var t = nowIso(E.now());
          s = { id: uuid(), status: "PREPARING", interview_type: p.interview_type, difficulty: p.difficulty, duration_minutes: p.duration_minutes, target_role: p.target_role || "", custom_instructions: p.custom_instructions || "", mode: p.mode || "text", phase: "greeting", provider_id: p.provider_id || null, current_question: "", started_at: t, ended_at: null, created_at: t, overall_score: null, error: null,
            memory: { candidate_profile: String(p.resume_text || "").slice(0, 12000), job_description: String(p.job_description || "").slice(0, 12000), record_audio: !!p.record_audio }, turns: [], evaluation: null };
          st.sessions.push(s); E.start(s); out = res(201, read(s));
        }
      }
      else if ((m = path.match(/^\/interviews\/([^/]+)\/export\/(markdown|json|pdf)$/))) {
        s = find(m[1]);
        if (!s) out = err(404, "Interview not found");
        else if (m[2] === "pdf") out = err(501, "PDF export uses ReportLab on the local back end. Markdown and JSON work in this demo.");
        else out = m[2] === "json" ? res(200, JSON.stringify(asDict(s), null, 2), "application/json") : res(200, markdown(s), "text/markdown");
        if (out.status === 200) out.filename = "interview-" + s.id + "." + (m[2] === "json" ? "json" : "md");
      }
      else if ((m = path.match(/^\/interviews\/([^/]+)\/(answers|pause|resume|end|evaluation)$/)) && method === "POST") {
        s = find(m[1]);
        if (!s) out = err(404, "Interview not found");
        else if (m[2] === "answers") {
          if (!body || typeof body.content !== "string" || body.content.length < 1 || !body.message_id || body.message_id.length < 8) out = err(422, "Invalid answer");
          else if (["LISTENING", "RECOVERING", "ENDING"].indexOf(s.status) < 0) out = err(409, "Cannot answer while session is " + s.status);
          else {
            // The FastAPI route answers from the already-loaded session, whose turn list SQLAlchemy does not refresh,
            // so the response carries the turns as they were before this answer. The next GET includes them.
            var before = clone(s.turns); E.acceptAnswer(s, pyStrip(body.content), body.message_id);
            var r0 = read(Object.assign({}, s, { turns: before })); out = res(200, r0);
          }
        } else if (m[2] === "pause") {
          if (["LISTENING", "SPEAKING"].indexOf(s.status) < 0) out = err(409, "Interview cannot be paused in its current state");
          else { s.status = "PAUSED"; out = res(200, read(s)); }
        } else if (m[2] === "resume") {
          if (s.status !== "PAUSED") out = err(409, "Interview is not paused");
          else { s.status = "LISTENING"; out = res(200, read(s)); }
        } else if (m[2] === "end") {
          if (s.status !== "COMPLETED") { s.status = "ENDING"; s.phase = "evaluation"; s.ended_at = nowIso(E.now()); }
          out = res(200, read(s));
        } else {
          s.status = "EVALUATING";
          var answers = s.turns.filter(function (x) { return x.role === "candidate"; }).map(function (x) { return x.content; });
          if (!answers.length) { s.status = "ENDING"; out = err(422, "At least one candidate answer is required for evaluation"); }
          else { var ev = deterministicGrade(answers); s.evaluation = ev; s.overall_score = ev.overall_score; s.status = "COMPLETED"; out = res(200, clone(ev)); }
        }
      }
      else if ((m = path.match(/^\/interviews\/([^/]+)$/))) {
        s = find(m[1]);
        if (!s) out = err(404, "Interview not found");
        else if (method === "GET") out = res(200, read(s));
        else if (method === "DELETE") { st.sessions.splice(st.sessions.indexOf(s), 1); out = res(204, null); }
      }
      else if (method === "GET" && path === "/providers") out = res(200, clone(st.providers));
      else if (method === "POST" && path === "/providers") {
        var pr = Object.assign({ id: uuid() }, body || {});
        if (pr.is_default) st.providers.forEach(function (x) { x.is_default = false; });
        st.providers.push(pr); out = res(201, clone(pr));
      }
      else if ((m = path.match(/^\/providers\/([^/]+)\/test$/))) out = res(200, { ok: false, error: LOCAL_ONLY });
      else if ((m = path.match(/^\/providers\/([^/]+)\/models/))) out = err(503, LOCAL_ONLY);
      else if ((m = path.match(/^\/providers\/([^/]+)$/))) {
        var i = st.providers.map(function (x) { return x.id; }).indexOf(m[1]);
        if (i < 0) out = err(404, "Provider profile not found");
        else if (method === "PUT") { st.providers[i] = Object.assign({ id: m[1] }, body || {}); out = res(200, clone(st.providers[i])); }
        else if (method === "DELETE") { st.providers.splice(i, 1); out = res(204, null); }
      }
      else if (path === "/settings" && method === "GET") out = res(200, st.settings || { audio: {}, privacy: {}, onboarding_complete: false, developer: {} });
      else if (path === "/settings" && method === "PUT") { st.settings = body; out = res(200, body); }
      else if (path === "/settings/data" && method === "DELETE") {
        if (!body || body.confirmation !== "DELETE ALL LOCAL DATA") out = err(400, "Confirmation phrase does not match");
        else { var f = fresh(); st.sessions = f.sessions; st.providers = f.providers; st.settings = f.settings; out = res(200, { deleted: true }); }
      }
      else if (path === "/stt/transcribe" || path === "/tts/synthesize" || path === "/documents/extract") out = err(503, LOCAL_ONLY);
      if (!out) out = err(404, "Not Found");
    } finally { if (!(opts && opts.state)) save(st); }
    return out;
  }

  var api = { handle: handle, Engine: Engine, questionsFor: questionsFor, CATEGORIES: CATEGORIES, QUESTION_BANK: QUESTION_BANK, COMMON: COMMON, recoveryAction: recoveryAction, deterministicGrade: deterministicGrade, enforceEvidence: enforceEvidence, shouldEnd: shouldEnd, phase: phase, fresh: fresh, pyRound: pyRound,
    reset: function () { try { root.localStorage.removeItem(KEY); } catch (e) {} } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.InterviewerEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
/* Sends the React app's API calls to the in-browser engine instead of the FastAPI server. */
(function () {
  var BASE = "https://local-interviewer-demo.invalid/api/v1";
  var E = window.InterviewerEngine, realFetch = window.fetch.bind(window);
  function call(method, url, rawBody) {
    var body = null;
    if (typeof rawBody === "string") { try { body = JSON.parse(rawBody); } catch (e) {} }
    return E.handle(method, url, body);
  }
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input && input.url;
    if (!url || url.indexOf(BASE) !== 0) return realFetch(input, init);
    init = init || {};
    var out = call((init.method || "GET").toUpperCase(), url, init.body);
    var delay = /\/(answers|evaluation)$/.test(url) ? 450 + Math.random() * 400 : 30 + Math.random() * 40;
    return new Promise(function (resolve, reject) {
      if (init.signal && init.signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
      setTimeout(function () {
        var payload = out.status === 204 ? null : (typeof out.body === "string" ? out.body : JSON.stringify(out.body));
        resolve(new Response(payload, { status: out.status, headers: { "Content-Type": out.type } }));
      }, delay);
    });
  };

  function toast(text) {
    var t = document.createElement("div");
    t.setAttribute("role", "status");
    t.textContent = text;
    t.style.cssText = "position:fixed;left:50%;bottom:72px;transform:translateX(-50%);z-index:2147483001;max-width:min(520px,90vw);padding:10px 14px;border-radius:10px;background:#141a33;color:#e6e9ff;border:1px solid #303a6b;font:500 14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 5200);
  }
  // Export links are plain <a href> to the API; turn them into local downloads.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href^='" + BASE + "']");
    if (!a) return;
    e.preventDefault();
    var out = call("GET", a.getAttribute("href"));
    if (out.status !== 200) { toast(out.body && out.body.detail || "Export failed"); return; }
    var blob = new Blob([out.body], { type: out.type }), link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = out.filename; document.body.appendChild(link); link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
  }, true);

  function badge() {
    if (window.self !== window.top || document.getElementById("li-demo-badge")) return;
    var d = document.createElement("div");
    d.id = "li-demo-badge";
    d.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483000;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;padding:6px 6px 6px 12px;border-radius:999px;background:#0e1226;color:#dfe3ff;font:600 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4);border:1px solid #2a3263";
    d.innerHTML = '<span>Browser demo: offline question bank, text answers</span>' +
      '<button type="button" style="border:0;border-radius:999px;padding:6px 10px;background:#1f2650;color:#dfe3ff;font:inherit;cursor:pointer">Reset data</button>' +
      '<a href="/Local-Interviewer/" style="border-radius:999px;padding:6px 10px;background:#5b6cff;color:#fff;text-decoration:none">Guide</a>';
    d.querySelector("button").addEventListener("click", function () {
      if (!confirm("Delete the interviews stored by this demo in your browser?")) return;
      E.reset(); location.href = "/Local-Interviewer/app/";
    });
    document.body.appendChild(d);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", badge); else badge();
})();
