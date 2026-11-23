/* Local Interviewer guide */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var L = window.InterviewerEngine;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- live app ---------- */
  function fit() { var s = $("screen"), f = s.querySelector("iframe"); if (f) f.style.transform = "scale(" + (s.clientWidth / 1440) + ")"; }
  $("boot").addEventListener("click", function () {
    var f = document.createElement("iframe");
    f.src = "app/"; f.title = "Local Interviewer app running in the browser";
    f.setAttribute("allow", "microphone");
    $("screen").appendChild(f); fit(); $("cover").remove();
  });
  addEventListener("resize", fit);
  var tour = document.querySelectorAll("#tour li"), saved = (store("li-tour") || "").split(",");
  tour.forEach(function (li, i) {
    var cb = li.querySelector("input");
    cb.checked = saved.indexOf(String(i)) >= 0; li.classList.toggle("done", cb.checked);
    cb.addEventListener("change", function () {
      li.classList.toggle("done", cb.checked);
      var on = []; tour.forEach(function (l, j) { if (l.querySelector("input").checked) on.push(j); });
      store("li-tour", on.join(","));
    });
  });

  /* ---------- how Astra decides ---------- */
  var RULES = [
    ["answer_clarification", "Microphone check", "10 words or fewer, mentions mic, microphone, test or testing, and none of python, api, database or system."],
    ["conceptual_reframe", "Uncertainty", "Says not sure, don't know or unsure in 16 words or fewer. Astra reframes with a simpler scenario."],
    ["python_gil", "GIL misconception", "Mentions gil, parallel and threads, plus all or makes. Astra asks for a test rather than correcting."],
    ["clarification", "Short answer", "Fewer than 18 words and no follow-up used yet. Astra asks for a concrete example."],
    ["transition", "Follow-ups used up", "Two follow-ups already used, so Astra moves to the next question in the bank."],
    ["ask", "Next bank question", "Otherwise Astra asks the next question in the bank."]
  ];
  var FU = 0;
  L.CATEGORIES.forEach(function (c) { var o = document.createElement("option"); o.textContent = c; $("cat").appendChild(o); });
  $("cat").value = "Python";
  function decide() {
    var answer = $("ans").value.replace(/^\s+|\s+$/g, ""), rec = answer ? L.recoveryAction(answer) : null, act, hit;
    var session = { interview_type: $("cat").value, memory: { follow_up_count: FU, bank_index: 1 } };
    if (rec) { act = rec; hit = RULES.map(function (r) { return r[0]; }).indexOf(rec.topic); }
    else { act = new L.Engine({}).fallback(session, answer); hit = act.action === "transition" ? 4 : act.action === "clarify" ? 3 : 5; }
    $("rules").innerHTML = RULES.map(function (r, i) { return '<li class="' + (i === hit ? "hit" : i < hit ? "skip" : "") + '"><i></i><span><b>' + r[1] + '</b><br>' + r[2] + '</span></li>'; }).join("");
    $("reply").textContent = act.question;
    var after = (act.action === "transition" || act.action === "end") ? 0 : Math.min(2, parseInt(session.memory.follow_up_count || 0, 10) + 1);
    var chips = ['<span class="chip acc">action ' + act.action + '</span>', '<span class="chip">topic ' + esc(act.topic) + '</span>', '<span class="chip">follow-ups after this turn: ' + after + '</span>'];
    if (!rec && act.action === "clarify") chips.push('<span class="chip warn">counted twice: the next answer forces a new topic</span>');
    if (!rec && act.action === "ask") chips.push('<span class="chip warn">a new question counts as a follow-up</span>');
    if (act.knowledge_gaps && act.knowledge_gaps.length) chips.push('<span class="chip bad">gap noted: ' + esc(act.knowledge_gaps[0]) + '</span>');
    $("meta").innerHTML = chips.join("");
    document.querySelectorAll("#fu button").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.v === FU)); });
  }
  $("ans").addEventListener("input", decide);
  $("cat").addEventListener("change", decide);
  $("fu").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { FU = +b.dataset.v; decide(); } });
  document.querySelectorAll("[data-a]").forEach(function (b) { b.addEventListener("click", function () { $("ans").value = b.dataset.a; FU = 0; decide(); }); });
  decide();

  /* ---------- state machine ---------- */
  var T = {
    IDLE: ["PREPARING"], PREPARING: ["READY", "FAILED"], READY: ["INTRODUCING", "FAILED"], INTRODUCING: ["SPEAKING", "LISTENING", "FAILED"],
    ASKING: ["SPEAKING", "LISTENING", "FAILED"], SPEAKING: ["LISTENING", "PAUSED", "FAILED"], LISTENING: ["TRANSCRIBING", "THINKING", "PAUSED", "ENDING", "FAILED"],
    TRANSCRIBING: ["LISTENING", "THINKING", "FAILED"], THINKING: ["ASKING", "ENDING", "RECOVERING", "FAILED"], RECOVERING: ["THINKING", "ASKING", "LISTENING", "ENDING", "FAILED"],
    PAUSED: ["LISTENING", "SPEAKING", "ENDING", "FAILED"], ENDING: ["EVALUATING", "COMPLETED", "FAILED"], EVALUATING: ["COMPLETED", "FAILED"], FAILED: ["RECOVERING", "ENDING"], COMPLETED: []
  };
  // moves the FastAPI routes make by assigning session.status directly
  var API = [["PREPARING", "LISTENING", "start"], ["LISTENING", "THINKING", "answer"], ["ENDING", "THINKING", "answer after closing"], ["RECOVERING", "THINKING", "answer"], ["THINKING", "LISTENING", "next question"], ["THINKING", "ENDING", "closing"],
    ["LISTENING", "PAUSED", "pause"], ["PAUSED", "LISTENING", "resume"], ["LISTENING", "ENDING", "end"], ["PAUSED", "ENDING", "end"], ["ENDING", "EVALUATING", "evaluate"], ["LISTENING", "EVALUATING", "evaluate"], ["EVALUATING", "COMPLETED", "graded"], ["EVALUATING", "ENDING", "grading error"]];
  var POS = {}, W = 940, H = 330, NW = 124, NH = 40;
  [["IDLE", "PREPARING", "READY", "INTRODUCING"], ["ASKING", "SPEAKING", "LISTENING", "TRANSCRIBING", "THINKING"], ["PAUSED", "RECOVERING", "FAILED", "ENDING", "EVALUATING", "COMPLETED"]].forEach(function (row, r) {
    var gap = (W - row.length * NW) / (row.length + 1);
    row.forEach(function (s, i) { POS[s] = { x: gap + i * (NW + gap), y: 22 + r * 120 }; });
  });
  var SEL = "LISTENING";
  function allowed(a, b) { return T[a].indexOf(b) >= 0; }
  function edge(a, b, color, dash, label) {
    var p = POS[a], q = POS[b], x1 = p.x + NW / 2, y1 = p.y + NH / 2, x2 = q.x + NW / 2, y2 = q.y + NH / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    var sx = x1 + dx / len * 34, sy = y1 + dy / len * 22, ex = x2 - dx / len * 40, ey = y2 - dy / len * 24, mx = (sx + ex) / 2 - dy / len * 26, my = (sy + ey) / 2 + dx / len * 26;
    return '<path d="M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1) + '" fill="none" stroke="' + color + '" stroke-width="2" ' + (dash ? 'stroke-dasharray="6 5" ' : "") + 'marker-end="url(#ar-' + (color === "var(--bad)" ? "bad" : color === "var(--cyan)" ? "cyan" : "acc") + ')"/>' + (label ? '<text x="' + mx.toFixed(1) + '" y="' + (my - 4).toFixed(1) + '" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="' + color + '">' + label + '</text>' : "");
  }
  function drawStates() {
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Interview state machine. Selected state: ' + SEL + '"><defs>' +
      ["acc", "bad", "cyan"].map(function (k) { return '<marker id="ar-' + k + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--' + (k === "acc" ? "accent" : k) + ')"/></marker>'; }).join("") + '</defs>';
    T[SEL].forEach(function (b) { s += edge(SEL, b, "var(--accent)", false); });
    API.filter(function (e) { return e[0] === SEL; }).forEach(function (e) { s += edge(e[0], e[1], allowed(e[0], e[1]) ? "var(--cyan)" : "var(--bad)", true, allowed(e[0], e[1]) ? "" : e[2]); });
    Object.keys(POS).forEach(function (k) {
      var p = POS[k], on = k === SEL, tgt = T[SEL].indexOf(k) >= 0;
      s += '<g class="st-node" data-s="' + k + '" tabindex="0" role="button" aria-label="' + k + '"><rect x="' + p.x + '" y="' + p.y + '" width="' + NW + '" height="' + NH + '" rx="9" fill="' + (on ? "var(--accent)" : tgt ? "var(--accent-soft)" : "var(--surface-2)") + '" stroke="' + (on || tgt ? "var(--accent)" : "var(--line)") + '" stroke-width="1.5"/><text x="' + (p.x + NW / 2) + '" y="' + (p.y + 25) + '" text-anchor="middle" font-size="12.5" font-family="var(--mono)" fill="' + (on ? "var(--surface)" : "var(--ink)") + '">' + k + '</text></g>';
    });
    s += '</svg><div class="legend"><span><i style="background:var(--accent)"></i>allowed by the transition table</span><span><i style="background:var(--cyan)"></i>move the API makes, allowed</span><span><i style="background:var(--bad)"></i>move the API makes that the table forbids</span></div>';
    $("states").innerHTML = s;
    var bad = API.filter(function (e) { return e[0] === SEL && !allowed(e[0], e[1]); });
    $("st-info").innerHTML = "<b>" + SEL + "</b> can move to " + (T[SEL].length ? T[SEL].join(", ") : "nothing; it is final") + "." + (bad.length ? ' The API also moves it to <b style="color:var(--bad)">' + bad.map(function (e) { return e[1] + " (" + e[2] + ")"; }).join(", ") + "</b>, which the table would reject." : "");
  }
  $("states").addEventListener("click", function (e) { var g = e.target.closest(".st-node"); if (g) { SEL = g.dataset.s; drawStates(); } });
  $("states").addEventListener("keydown", function (e) { var g = e.target.closest(".st-node"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); SEL = g.dataset.s; drawStates(); } });
  drawStates();

  /* ---------- evidence check ---------- */
  var QUOTES = ["added idempotency keys to the payments API", "Duplicate   charges FALLING to zero", "reduced latency by 40%", ""];
  function drawQuotes() {
    var res = L.enforceEvidence(QUOTES, [$("ev-answer").value]);
    $("quotes").innerHTML = res.map(function (r, i) { return '<li class="' + (r.kept ? "" : "gone") + '"><span style="flex:1;min-width:0"><input value="' + esc(r.quote) + '" data-i="' + i + '" aria-label="Quote ' + (i + 1) + '" placeholder="(empty quote)"></span><span class="chip ' + (r.kept ? (r.quote.trim() ? "ok" : "warn") : "bad") + '">' + (r.kept ? (r.quote.trim() ? "kept" : "kept, but empty") : "removed") + '</span></li>'; }).join("");
  }
  $("ev-answer").addEventListener("input", drawQuotes);
  $("quotes").addEventListener("change", function (e) { var i = e.target.dataset.i; if (i != null) { QUOTES[+i] = e.target.value; drawQuotes(); } });
  drawQuotes();

  /* ---------- fallback score ---------- */
  function drawFallback() {
    var avg = +$("avg").value, W2 = 460, H2 = 230, Lm = 34, R = 10, T2 = 12, B = 30, x = function (v) { return Lm + v / 100 * (W2 - Lm - R); }, y = function (v) { return T2 + (1 - v / 100) * (H2 - T2 - B); };
    var dep = function (a) { return Math.min(80, 40 + a * 0.6); }, cla = function (a) { return Math.min(80, 45 + Math.min(a, 50) * 0.5); };
    var line = function (f) { var p = []; for (var a = 0; a <= 100; a += 1) p.push(x(a).toFixed(1) + "," + y(f(a)).toFixed(1)); return p.join(" "); };
    var s = '<svg viewBox="0 0 ' + W2 + ' ' + H2 + '" role="img" aria-label="Fallback scores rise with average words per answer and stop at 80">';
    [0, 40, 80, 100].forEach(function (v) { s += '<line x1="' + Lm + '" x2="' + (W2 - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line)"/><text x="' + (Lm - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" font-family="var(--mono)" fill="var(--ink-3)">' + v + '</text>'; });
    s += '<polyline points="' + line(dep) + '" fill="none" stroke="var(--accent)" stroke-width="2.5"/><polyline points="' + line(cla) + '" fill="none" stroke="var(--cyan)" stroke-width="2.5"/>';
    s += '<line x1="' + x(avg) + '" x2="' + x(avg) + '" y1="' + T2 + '" y2="' + (H2 - B) + '" stroke="var(--ink-3)" stroke-dasharray="3 4"/>';
    s += '<circle cx="' + x(avg) + '" cy="' + y(dep(avg)) + '" r="5" fill="var(--accent)"/><circle cx="' + x(avg) + '" cy="' + y(cla(avg)) + '" r="5" fill="var(--cyan)"/>';
    s += '<text x="' + Lm + '" y="' + (H2 - 9) + '" font-size="11" font-family="var(--mono)" fill="var(--ink-3)">0 words</text><text x="' + (W2 - R) + '" y="' + (H2 - 9) + '" text-anchor="end" font-size="11" font-family="var(--mono)" fill="var(--ink-3)">100 words per answer</text></svg>';
    var overall = L.pyRound((dep(avg) + cla(avg)) / 2, 1);
    s += '<div class="legend"><span><i style="background:var(--accent)"></i>Depth of explanation ' + L.pyRound(dep(avg), 1) + '</span><span><i style="background:var(--cyan)"></i>Communication clarity ' + L.pyRound(cla(avg), 1) + '</span><span><b>Overall ' + overall + '</b></span></div>';
    $("fallback").innerHTML = s; $("avg-out").textContent = avg + " words";
  }
  $("avg").addEventListener("input", drawFallback);
  drawFallback();

  /* ---------- audio pipeline ---------- */
  function box(x, y, w, t, sub, c) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="62" rx="11" fill="var(--surface-2)" stroke="' + c + '" stroke-width="1.6"/><text x="' + (x + 14) + '" y="' + (y + 26) + '" font-size="15" font-weight="600" fill="var(--ink)">' + t + '</text><text x="' + (x + 14) + '" y="' + (y + 46) + '" font-size="11.5" font-family="var(--mono)" fill="var(--ink-3)">' + sub + '</text>'; }
  function arr(x1, y1, x2, y2) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="var(--ink-3)" stroke-width="1.6" marker-end="url(#pa)"/>'; }
  $("pipe").innerHTML = '<svg viewBox="0 0 1000 250" role="img" aria-label="Voice in: microphone, FFmpeg, Whisper, your review. Voice out: Astra text, Kokoro or macOS say, playback."><defs><marker id="pa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink-3)"/></marker></defs>' +
    '<text x="0" y="16" font-size="12" font-family="var(--mono)" fill="var(--accent)">your voice in</text>' +
    box(0, 28, 220, "Microphone", "MediaRecorder, 250 ms chunks", "var(--accent)") + arr(222, 59, 256, 59) +
    box(258, 28, 220, "FFmpeg", "mono 16 kHz WAV", "var(--accent)") + arr(480, 59, 514, 59) +
    box(516, 28, 230, "Whisper medium.en", "MLX, one worker at a time", "var(--accent)") + arr(748, 59, 782, 59) +
    box(784, 28, 216, "You review", "edit, retry or submit", "var(--accent)") +
    '<text x="0" y="156" font-size="12" font-family="var(--mono)" fill="var(--cyan)">Astra\'s voice out</text>' +
    box(0, 168, 220, "Astra's question", "dialogue only, capped", "var(--cyan)") + arr(222, 199, 256, 199) +
    box(258, 168, 220, "Kokoro or say", "Kokoro detected, not enabled", "var(--cyan)") + arr(480, 199, 514, 199) +
    box(516, 168, 230, "24 kHz WAV", "latency in a header", "var(--cyan)") + arr(748, 199, 782, 199) +
    box(784, 168, 216, "Playback", "mic disabled meanwhile", "var(--cyan)") + '</svg>';
  var PRIV = [
    ["Bound to this machine", "Both servers listen on 127.0.0.1. No cloud sign-in, telemetry or analytics."],
    ["Only approved model servers", "Ollama URLs must be plain HTTP(S) origins with no credentials. Redirects, proxies and metadata or link-local addresses are refused."],
    ["Documents are data, not instructions", "CVs and job descriptions up to 10 MB are parsed to text only, and the prompts mark them untrusted."],
    ["Audio off by default", "Raw recordings are only kept if you tick the box. Transcripts are saved, and everything can be deleted in Settings."],
    ["Model output is checked", "Astra's decisions and the evaluation must match a schema. Hidden reasoning is discarded and nothing the model says is executed."],
    ["Fair scoring rules", "Accent, name, gender, nationality and disability are banned as criteria, and every report says it is practice feedback."]
  ];
  $("privacy").innerHTML = PRIV.map(function (p) { return '<div class="card"><h3>' + p[0] + '</h3><p>' + p[1] + '</p></div>'; }).join("");

  /* ---------- notes ---------- */
  var NOTES = [
    ["bad", "Engine", "The follow-up counter counts wrongly", "A brand-new bank question counts as a follow-up, so a short answer to it gets no clarification. In offline mode a clarification is counted twice, so the next answer always forces a new topic."],
    ["bad", "Engine", "The state machine is not enforced", "The StateMachine class is only used by its own test. The API sets statuses directly and makes moves the table forbids, such as PREPARING to LISTENING and THINKING to LISTENING on every answer."],
    ["warn", "API", "New turns arrive late", "The answer response is built from the already-loaded session, whose turn list SQLAlchemy does not refresh. The transcript in the room lags until the next 5-second refresh."],
    ["warn", "Offline", "Longer interviews repeat themselves", "Each type has 5 offline questions and the index wraps, so Astra asks 'Please introduce yourself' again. A 30-minute interview needs 7 answers. Length is counted in answers, not minutes."],
    ["warn", "Scoring", "The fallback score rewards length", "Without a model, both dimensions rise with average words per answer and stop at 80. The confidence check is always true for real answers, so it is always 40%."],
    ["warn", "Scoring", "An empty quote counts as evidence", "The verbatim check accepts an empty string, because an empty string is part of every answer."],
    ["acc", "UI", "Technical is missing", "The back end and README list 15 types, but the new-interview form offers 14. The browser tab is titled 'frontend', from the Vite template."],
    ["acc", "Docs", "A personal path in commands.txt", "It starts with cd into a folder under the author's home directory, which will not exist for anyone else."],
    ["acc", "License", "No license yet", "The README says all rights are reserved until one is chosen, so others cannot legally reuse the code."]
  ];
  $("notes-list").innerHTML = NOTES.map(function (n) { return '<div class="card"><span class="chip ' + n[0] + '">' + n[1] + '</span><h3>' + n[2] + '</h3><p>' + esc(n[3]) + '</p></div>'; }).join("");

  document.addEventListener("click", function (e) {
    var b = e.target.closest(".copy"); if (!b) return;
    var t = b.previousElementSibling.textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = "Copied"; }, function () { b.textContent = "Select it"; });
    setTimeout(function () { b.textContent = "Copy"; }, 1400);
  });
})();
