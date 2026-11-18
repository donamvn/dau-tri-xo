(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const other = (t) => (t === "X" ? "O" : "X");

  const CONFIG = Object.assign({ defaultTime: 30, shuffle: false }, window.GAME_CONFIG || {});
  const QUESTIONS = (Array.isArray(window.QUESTIONS) ? window.QUESTIONS : []).filter(
    (q) => q && typeof q.question === "string" && q.question.trim()
  );
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  const state = {
    names: { X: "Đội X", O: "Đội O" },
    wins: { X: 0, O: 0 },
    board: Array(9).fill(null),
    turn: "X",
    phase: "pick", // pick | opening | asking | checking | result | over
    mode: "main", // main = đang đấu, bonus = mở các câu hỏi còn lại sau khi có đội thắng
    order: [],
    qPos: 0, // số câu đã dùng trong danh sách
    current: null,
    pendingCell: null, // ô đội vừa chọn, chờ trả lời
    revealed: false,
  };

  /* ================= Âm thanh (tự tạo, không cần file) ================= */
  const Sound = {
    on: true,
    ctx: null,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, type = "sine", delay = 0, vol = 0.2) {
      if (!this.on) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    tick() { this.tone(900, 0.08, "square", 0, 0.07); },
    beep() { this.tone(660, 0.18, "square", 0, 0.1); },
    go() { this.tone(1320, 0.4, "square", 0, 0.1); },
    place() { this.tone(520, 0.12, "triangle", 0, 0.25); },
    correct() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, "triangle", i * 0.09, 0.22)); },
    wrong() { this.tone(220, 0.35, "sawtooth", 0, 0.12); this.tone(160, 0.5, "sawtooth", 0.18, 0.12); },
    timeup() { this.tone(330, 0.25, "square", 0, 0.12); this.tone(330, 0.5, "square", 0.3, 0.12); },
    fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.28, "triangle", i * 0.14, 0.22)); },
  };

  /* ================= Nhạc nền cuộc đua (tự sáng tác, phát bằng WebAudio) ================= */
  const Music = {
    // Mỗi ô là 1 nốt móc đơn; 0 = nghỉ. Số là cao độ MIDI.
    melody: [
      72, 0, 76, 79, 0, 76, 79, 81, 79, 0, 76, 0, 74, 76, 72, 0,
      74, 0, 77, 81, 0, 77, 81, 83, 81, 0, 79, 0, 77, 79, 74, 0,
      72, 0, 76, 79, 0, 76, 79, 84, 83, 81, 79, 77, 76, 0, 74, 0,
      77, 76, 74, 72, 74, 76, 77, 79, 81, 79, 77, 76, 74, 0, 72, 0,
    ],
    bass: [48, 55, 52, 55, 48, 55, 52, 55, 50, 57, 53, 57, 50, 57, 53, 57,
           48, 55, 52, 55, 48, 55, 52, 55, 43, 50, 47, 50, 43, 50, 47, 50],
    bpm: 150,
    step: 0,
    nextTime: 0,
    timer: null,
    out: null,
    freq: (m) => 440 * Math.pow(2, (m - 69) / 12),

    note(m, t, dur, type, vol) {
      const ctx = Sound.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(this.freq(m), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    drum(t, accent) {
      const ctx = Sound.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(accent ? 150 : 900, t);
      o.frequency.exponentialRampToValueAtTime(accent ? 40 : 600, t + 0.08);
      g.gain.setValueAtTime(accent ? 0.35 : 0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (accent ? 0.15 : 0.04));
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + 0.2);
    },

    schedule() {
      const ctx = Sound.ctx;
      const stepDur = 60 / this.bpm / 2; // móc đơn
      while (this.nextTime < ctx.currentTime + 0.12) {
        const s = this.step;
        const m = this.melody[s % this.melody.length];
        if (m) this.note(m, this.nextTime, stepDur * 0.9, "square", 0.05);
        if (s % 2 === 0) this.note(this.bass[(s / 2) % this.bass.length], this.nextTime, stepDur * 1.6, "triangle", 0.16);
        this.drum(this.nextTime, s % 4 === 0);
        this.nextTime += stepDur;
        this.step++;
      }
    },

    start() {
      if (!Sound.on || this.timer) return;
      const ctx = Sound.ensure();
      if (!ctx) return;
      this.out = ctx.createGain();
      this.out.gain.value = 0.8;
      this.out.connect(ctx.destination);
      this.bpm = 150;
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.05;
      this.timer = setInterval(() => this.schedule(), 25);
      this.schedule();
    },

    faster() { this.bpm = 185; }, // dồn nhịp khi gần về đích

    stop() {
      if (!this.timer) return;
      clearInterval(this.timer);
      this.timer = null;
      const out = this.out;
      const ctx = Sound.ctx;
      if (out && ctx) {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        setTimeout(() => out.disconnect(), 400);
      }
      this.out = null;
    },
  };

  /* ================= Tiện ích giao diện ================= */
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) =>
      s.classList.toggle("active", s.id === "screen-" + name)
    );
  }

  function renderTeams() {
    document.querySelectorAll("[data-team-name]").forEach((el) => {
      el.textContent = state.names[el.dataset.teamName];
    });
    document.querySelectorAll("[data-wins]").forEach((el) => {
      el.textContent = state.wins[el.dataset.wins];
    });
  }

  function setPhase(phase) {
    ["ready", "asking", "result"].forEach((p) => {
      $("phase-" + p).classList.toggle("active", p === phase);
    });
  }

  function renderTurn() {
    const banner = $("turn-banner");
    if (state.mode === "bonus") {
      banner.className = "turn-banner bonus";
      banner.textContent = "⭐ Câu hỏi thêm";
      return;
    }
    banner.className = "turn-banner " + state.turn;
    banner.textContent = "Lượt của " + state.names[state.turn] + " (" + state.turn + ")";
  }

  function setHint(text, team) {
    const hint = $("board-hint");
    hint.textContent = text || "";
    hint.style.color = team === "X" ? "var(--x)" : team === "O" ? "var(--o)" : "";
  }

  // Trên điện thoại bàn cờ và câu hỏi nằm chồng lên nhau → tự cuộn tới phần đang cần xem
  const isNarrow = () => window.matchMedia("(max-width: 860px)").matches;
  function scrollToEl(el, block) {
    if (!isNarrow() || !el) return;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: block || "start" }));
  }

  function confetti() {
    const box = $("confetti");
    const colors = ["#ef4444", "#2563eb", "#facc15", "#22c55e", "#a855f7", "#f97316"];
    for (let i = 0; i < 140; i++) {
      const p = document.createElement("i");
      p.style.left = rand(0, 100) + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = rand(2.2, 4.2) + "s";
      p.style.animationDelay = rand(0, 0.8) + "s";
      p.style.transform = "rotate(" + rand(0, 360) + "deg)";
      box.appendChild(p);
    }
    setTimeout(() => (box.innerHTML = ""), 5500);
  }

  /* ================= Màn hình chuẩn bị ================= */
  function initSetup() {
    const info = $("question-info");
    if (QUESTIONS.length) {
      info.textContent = "Đã nạp " + QUESTIONS.length + " câu hỏi từ file questions.js.";
    } else {
      info.textContent = "⚠ Chưa có câu hỏi nào! Hãy thêm câu hỏi vào file questions.js.";
      info.style.color = "var(--danger)";
    }
    $("btn-to-race").addEventListener("click", () => {
      Sound.ensure();
      ["X", "O"].forEach((t) => {
        const v = $("name-" + t).value.trim();
        state.names[t] = v || "Đội " + t;
      });
      renderTeams();
      goRace();
    });
  }

  /* ================= Cuộc đua chọn đội trả lời trước ================= */
  let raceRunning = false;
  let raceWinner = null;

  function resetRace() {
    raceRunning = false;
    raceWinner = null;
    Music.stop();
    $("track").classList.remove("running");
    ["X", "O"].forEach((t) => {
      const el = $("racer-" + t);
      el.style.transform = "translateX(0)";
      el.classList.remove("running", "winner");
    });
    $("race-countdown").textContent = "";
    const res = $("race-result");
    res.textContent = "";
    res.className = "race-result";
    $("btn-race").disabled = false;
    $("btn-race").classList.remove("hidden");
    $("btn-to-game").classList.add("hidden");
  }

  function goRace() {
    resetRace();
    showScreen("race");
  }

  function startRace() {
    if (raceRunning) return;
    raceRunning = true;
    $("btn-race").disabled = true;
    const cd = $("race-countdown");
    const steps = ["3", "2", "1", "Chạy!"];
    steps.forEach((s, i) => {
      setTimeout(() => {
        cd.textContent = s;
        cd.classList.remove("pop");
        void cd.offsetWidth; // khởi động lại hiệu ứng
        cd.classList.add("pop");
        if (i < steps.length - 1) Sound.beep();
        else {
          Sound.go();
          Music.start();
          runRace();
          setTimeout(() => (cd.textContent = ""), 600);
        }
      }, i * 800);
    });
  }

  function runRace() {
    const finish = document.querySelector(".finish-line");
    const racers = ["X", "O"].map((t) => {
      const el = $("racer-" + t);
      el.classList.add("running");
      return { t, el, pos: 0, speed: 0, nextChange: 0 };
    });
    const startLeft = racers[0].el.offsetLeft;
    const width = racers[0].el.offsetWidth;
    const dist = finish.offsetLeft + finish.offsetWidth / 2 - startLeft - width;

    $("track").classList.add("running"); // cho cây cối, đồi núi chạy
    const res = $("race-result");
    let leader = null;
    let sprint = false;
    let last = performance.now();
    let elapsed = 0;

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      for (const r of racers) {
        if (elapsed >= r.nextChange) {
          const boost = Math.random() < 0.12; // thỉnh thoảng tăng tốc bất ngờ
          r.speed = boost ? rand(0.17, 0.23) : rand(0.06, 0.14); // ~9–10 giây mới về đích
          r.nextChange = elapsed + rand(0.4, 1.0);
        }
        r.pos += r.speed * dt;
        r.el.style.transform = "translateX(" + Math.min(r.pos, 1) * dist + "px)";
      }

      // Bình luận trực tiếp: ai đang dẫn trước
      const [a, b] = racers;
      const lead = Math.abs(a.pos - b.pos) < 0.015 ? null : a.pos > b.pos ? a.t : b.t;
      if (!sprint && Math.max(a.pos, b.pos) > 0.8) {
        sprint = true; // sắp về đích: nhạc dồn nhịp, đổi lời bình
        Music.faster();
        leader = null;
      }
      if (elapsed > 1 && lead && lead !== leader) {
        leader = lead;
        res.className = "race-result live " + lead.toLowerCase();
        res.textContent = (sprint ? "⚡ Nước rút! " : "🔥 ") + state.names[lead] + " đang dẫn trước!";
      }
      const done = racers.filter((r) => r.pos >= 1);
      if (done.length) {
        done.sort((a, b) => b.pos - a.pos);
        endRace(done[0].t, racers);
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function endRace(winner, racers) {
    raceWinner = winner;
    Music.stop();
    $("track").classList.remove("running");
    racers.forEach((r) => r.el.classList.remove("running"));
    $("racer-" + winner).classList.add("winner");
    const res = $("race-result");
    res.className = "race-result " + winner.toLowerCase();
    res.textContent = "🏆 " + state.names[winner] + " về nhất – được trả lời trước!";
    Sound.fanfare();
    $("btn-race").classList.add("hidden");
    $("btn-to-game").classList.remove("hidden");
  }

  /* ================= Câu hỏi (luôn hỏi theo thứ tự trong file) ================= */
  function buildOrder() {
    state.order = QUESTIONS.map((_, i) => i);
    if (CONFIG.shuffle) {
      for (let i = state.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
      }
    }
    state.qPos = 0;
  }

  const remainingQuestions = () => state.order.length - state.qPos;
  const emptyCells = () => state.board.filter((v) => !v).length;
  const canOpenBonus = () => remainingQuestions() > 0 && emptyCells() > 0;

  function takeQuestion() {
    if (state.qPos >= state.order.length) return null; // hết danh sách
    return QUESTIONS[state.order[state.qPos++]];
  }

  function correctOptionIndex(q) {
    if (!Array.isArray(q.options) || typeof q.answer !== "string") return -1;
    const a = q.answer.trim().toUpperCase();
    if (/^[A-Z]$/.test(a)) {
      const idx = a.charCodeAt(0) - 65;
      return idx < q.options.length ? idx : -1;
    }
    return q.options.findIndex((o) => String(o).trim().toUpperCase() === a);
  }

  // Câu trắc nghiệm có đáp án rõ ràng → máy tự chấm khi bấm vào lựa chọn
  const isAuto = (q) => !!q && correctOptionIndex(q) >= 0;

  function answerText(q) {
    if (!q || q.answer === undefined || q.answer === null || q.answer === "") return "";
    const idx = correctOptionIndex(q);
    if (idx >= 0) return "Đáp án: " + String.fromCharCode(65 + idx) + ". " + q.options[idx];
    return "Đáp án: " + q.answer;
  }

  function renderQuestion(q) {
    $("q-number").textContent =
      (state.mode === "bonus" ? "⭐ Câu hỏi thêm · " : "") +
      "Câu hỏi số " + state.qPos;
    $("q-text").textContent = q.question;

    const img = $("q-image");
    if (q.image) {
      img.src = q.image;
      img.classList.remove("hidden");
    } else {
      img.removeAttribute("src");
      img.classList.add("hidden");
    }

    const auto = isAuto(q);
    const list = $("q-options");
    list.innerHTML = "";
    if (Array.isArray(q.options) && q.options.length) {
      q.options.forEach((o, i) => {
        const li = document.createElement("li");
        li.textContent = o;
        li.dataset.i = i;
        if (auto) {
          li.setAttribute("role", "button");
          li.tabIndex = 0;
        }
        list.appendChild(li);
      });
      list.classList.remove("hidden");
    } else {
      list.classList.add("hidden");
    }
    list.classList.toggle("choosable", auto);
    // Câu trắc nghiệm: ẩn nút Đúng/Sai vì máy tự chấm; câu tự luận: người dẫn chấm
    document.querySelector(".judge").classList.toggle("hidden", auto);
    $("auto-hint").classList.toggle("hidden", !auto);
    $("btn-skip").disabled = remainingQuestions() === 0;

    const ans = $("q-answer");
    ans.textContent = "";
    ans.classList.add("hidden");
  }

  function pickOption(idx) {
    const q = state.current;
    if (state.phase !== "asking" || !isAuto(q) || state.revealed) return;
    const correct = correctOptionIndex(q);
    const ok = idx === correct;
    state.phase = "checking";
    stopTimer();
    $("btn-pause").disabled = true;
    $("q-options").classList.remove("choosable");
    $("auto-hint").classList.add("hidden");
    const items = $("q-options").children;
    if (idx >= 0) {
      items[idx].classList.add(ok ? "correct" : "chosen-wrong");
      if (ok) Sound.correct();
      else Sound.wrong();
    }
    if (!ok) setTimeout(() => items[correct].classList.add("correct"), 500);
    setTimeout(() => judge(ok, { silent: true, timeout: idx < 0 }), 1600);
  }

  function revealAnswer() {
    const q = state.current;
    if (!q) return;
    if (state.phase === "asking") {
      // Đã lộ đáp án thì không cho bấm chọn nữa – người dẫn tự chấm bằng nút Đúng/Sai
      state.revealed = true;
      $("q-options").classList.remove("choosable");
      $("auto-hint").classList.add("hidden");
      document.querySelector(".judge").classList.remove("hidden");
    }
    const ans = $("q-answer");
    ans.textContent = answerText(q) || "(Câu này chưa có đáp án trong file)";
    ans.classList.remove("hidden");
    const idx = correctOptionIndex(q);
    if (idx >= 0) $("q-options").children[idx].classList.add("correct");
  }

  function showQuestion() {
    const q = takeQuestion();
    if (!q) return toPick(); // toPick tự xử lý khi hết câu
    state.current = q;
    state.revealed = false;
    state.phase = "asking";
    renderQuestion(q);
    setPhase("asking");
    setHint(
      state.mode === "bonus" ? "Đang trả lời câu hỏi thêm…" : state.names[state.turn] + " đang trả lời…",
      state.mode === "bonus" ? null : state.turn
    );
    const t = Number(q.time) > 0 ? Number(q.time) : CONFIG.defaultTime;
    startTimer(t);
    scrollToEl(document.querySelector(".question-card"), "start");
  }

  /* ================= Đồng hồ đếm ngược ================= */
  const T = { total: 0, remaining: 0, running: false, handle: null, last: 0, lastWhole: 0 };

  function startTimer(sec) {
    stopTimer();
    T.total = sec;
    T.remaining = sec;
    T.lastWhole = Math.ceil(sec);
    T.last = performance.now();
    T.running = true;
    T.handle = setInterval(tickTimer, 100);
    $("btn-pause").disabled = false;
    $("btn-pause").textContent = "⏸ Tạm dừng";
    renderTimer();
  }

  function stopTimer() {
    T.running = false;
    clearInterval(T.handle);
    T.handle = null;
  }

  function tickTimer() {
    if (!T.running) return;
    const now = performance.now();
    T.remaining = Math.max(0, T.remaining - (now - T.last) / 1000);
    T.last = now;
    const whole = Math.ceil(T.remaining);
    if (whole < T.lastWhole) {
      T.lastWhole = whole;
      if (whole > 0 && whole <= 5) Sound.tick();
    }
    if (T.remaining <= 0) {
      stopTimer();
      Sound.timeup();
      $("btn-pause").disabled = true;
      // Câu trắc nghiệm hết giờ mà chưa chọn → tự tính là sai
      if (isAuto(state.current) && !state.revealed) {
        renderTimer();
        pickOption(-1);
        return;
      }
    }
    renderTimer();
  }

  function togglePause() {
    if (T.remaining <= 0 || state.phase !== "asking") return;
    if (T.running) {
      T.running = false;
      $("btn-pause").textContent = "▶ Tiếp tục";
    } else {
      T.last = performance.now();
      T.running = true;
      $("btn-pause").textContent = "⏸ Tạm dừng";
    }
    renderTimer();
  }

  function renderTimer() {
    const text = $("timer-text");
    const fill = $("timer-fill");
    const pct = T.total ? (T.remaining / T.total) * 100 : 0;
    fill.style.width = pct + "%";
    fill.classList.toggle("mid", pct <= 50 && pct > 20);
    fill.classList.toggle("low", pct <= 20);
    text.textContent = T.remaining <= 0 ? "⏰ Hết giờ!" : Math.ceil(T.remaining) + " giây";
    text.classList.toggle("low", T.remaining > 0 && T.remaining <= 5 && T.running);
    text.classList.toggle("paused", !T.running && T.remaining > 0);
  }

  /* ================= Chọn ô → trả lời câu hỏi ================= */
  function cellEl(i) {
    return document.querySelector('.cell[data-i="' + i + '"]');
  }

  function setResultButtons(nextLabel, showBonus) {
    const btn = $("btn-next-turn");
    btn.textContent = nextLabel;
    btn.classList.toggle("hidden", !nextLabel);
    $("btn-bonus").classList.toggle("hidden", !showBonus);
    $("btn-bonus").textContent = "⭐ Mở các câu hỏi còn lại";
  }

  // Chờ đội (hoặc cả lớp, ở phần câu hỏi thêm) chọn 1 ô trống
  function toPick() {
    state.current = null;
    state.pendingCell = null;
    renderTurn();

    if (state.mode === "bonus") {
      if (!canOpenBonus()) return endBonus();
    } else if (remainingQuestions() === 0) {
      return endNoQuestions();
    }

    state.phase = "pick";
    $("board").className = "board pick-" + (state.mode === "bonus" ? "bonus" : state.turn);
    setPhase("ready");
    if (state.mode === "bonus") {
      $("ready-msg").textContent = "Chọn 1 ô còn trống để mở câu hỏi";
      $("ready-msg").style.color = "#7c3aed";
      setHint("👉 Bấm vào 1 ô còn trống", null);
    } else {
      $("ready-msg").textContent = "👉 " + state.names[state.turn] + " chọn 1 ô trên bàn cờ";
      $("ready-msg").style.color = state.turn === "X" ? "var(--x)" : "var(--o)";
      setHint("👉 " + state.names[state.turn] + " hãy chọn 1 ô", state.turn);
    }
    scrollToEl(document.querySelector(".board-card"), "center");
  }

  function onCellClick(e) {
    const cell = e.target.closest(".cell");
    if (!cell || state.phase !== "pick") return;
    const i = Number(cell.dataset.i);
    if (state.board[i]) return;
    state.pendingCell = i;
    state.phase = "opening";
    $("board").className = "board";
    cell.classList.add("selected", "sel-" + (state.mode === "bonus" ? "bonus" : state.turn));
    Sound.place();
    setTimeout(showQuestion, 450);
  }

  function clearSelection() {
    if (state.pendingCell === null) return;
    cellEl(state.pendingCell).classList.remove("selected", "sel-X", "sel-O", "sel-bonus");
  }

  function judge(isCorrect, opts) {
    opts = opts || {};
    if (state.phase !== "asking" && state.phase !== "checking") return;
    stopTimer();
    $("result-answer").textContent = answerText(state.current);
    setPhase("result");
    state.phase = "result";
    if (isCorrect && !opts.silent) Sound.correct();
    if (!isCorrect && !opts.silent) Sound.wrong();

    const msg = $("result-msg");
    msg.textContent = isCorrect ? "✓ Chính xác!" : opts.timeout ? "⏰ Hết giờ rồi!" : "✗ Chưa đúng rồi!";
    msg.style.color = isCorrect ? "var(--success)" : "var(--danger)";

    const i = state.pendingCell;
    clearSelection();
    const cell = cellEl(i);

    // Phần câu hỏi thêm: chỉ đánh dấu ô đã mở
    if (state.mode === "bonus") {
      state.board[i] = "used";
      cell.textContent = isCorrect ? "✓" : "✗";
      cell.classList.add(isCorrect ? "bonus-ok" : "bonus-no", "placed");
      $("result-sub").textContent = "";
      if (canOpenBonus()) {
        setResultButtons("Mở câu tiếp theo ▶", false);
        setHint("👉 Bấm vào 1 ô còn trống để mở câu tiếp theo", null);
      } else {
        endBonus();
      }
      return;
    }

    const team = state.turn;
    if (isCorrect) {
      state.board[i] = team;
      cell.textContent = team;
      cell.classList.add(team, "placed");
      setTimeout(() => Sound.place(), 250);
      const win = findWinner();
      if (win) return finishGame(win);
      if (emptyCells() === 0) return finishGame(null);
      $("result-sub").textContent = state.names[team] + " được đánh " + team + " vào ô đã chọn.";
      setHint(state.names[team] + " đã đánh " + team, team);
    } else {
      $("result-sub").textContent = "Ô vẫn để trống – lượt sau vẫn chọn lại được.";
      setHint("Không được đánh ô nào lượt này.", null);
    }

    if (remainingQuestions() === 0) {
      setResultButtons("Xem kết quả ▶", false);
    } else {
      setResultButtons("Lượt của " + state.names[other(team)] + " ▶", false);
    }
  }

  function onNextClick() {
    if (state.phase === "over") return goRace();
    if (state.phase !== "result") return;
    if (state.mode === "main") state.turn = other(state.turn);
    toPick();
  }

  /* ================= Thắng / hòa / hết câu ================= */
  function findWinner() {
    for (const line of LINES) {
      const [a, b, c] = line;
      const v = state.board[a];
      if ((v === "X" || v === "O") && v === state.board[b] && v === state.board[c]) {
        return { team: v, line };
      }
    }
    return null;
  }

  function showOverlay(markText, markClass, title, sub) {
    const mark = $("overlay-mark");
    mark.textContent = markText;
    mark.className = "overlay-mark " + (markClass || "");
    $("overlay-title").textContent = title;
    $("overlay-sub").textContent = sub;
    const bonus = canOpenBonus();
    $("btn-open-bonus").classList.toggle("hidden", !bonus);
    $("btn-open-bonus").textContent = "⭐ Mở các câu hỏi còn lại";
  }

  function bonusNote() {
    return canOpenBonus()
      ? " Vẫn còn câu hỏi chưa dùng – có thể bấm vào các ô trống để mở tiếp."
      : "";
  }

  function finishGame(win) {
    state.phase = "over";
    $("board").className = "board";
    if (win) {
      state.wins[win.team]++;
      renderTeams();
      win.line.forEach((i) => cellEl(i).classList.add("win"));
      $("result-msg").textContent = "🏆 " + state.names[win.team] + " thắng!";
      $("result-msg").style.color = win.team === "X" ? "var(--x)" : "var(--o)";
      $("result-sub").textContent = "Xếp được 3 " + win.team + " thẳng hàng." + bonusNote();
      setHint(state.names[win.team] + " có 3 ô thẳng hàng!", win.team);
      showOverlay(
        win.team, win.team, state.names[win.team] + " chiến thắng!",
        "Tỉ số: " + state.names.X + " " + state.wins.X + " – " + state.wins.O + " " + state.names.O + "." + bonusNote()
      );
      Sound.fanfare();
      confetti();
    } else {
      $("result-msg").textContent = "🤝 Hòa!";
      $("result-msg").style.color = "";
      $("result-sub").textContent = "Bàn cờ đã kín mà chưa đội nào có 3 ô thẳng hàng.";
      setHint("Bàn cờ đã kín ô.", null);
      showOverlay("🤝", "", "Hòa nhau!", "Bàn cờ đã kín mà chưa đội nào có 3 ô thẳng hàng.");
      Sound.beep();
    }
    setResultButtons("Ván mới (đua lại) 🏁", canOpenBonus());
    setTimeout(() => $("overlay").classList.remove("hidden"), win ? 700 : 300);
  }

  // Hết danh sách câu hỏi mà chưa đội nào thắng
  function endNoQuestions() {
    state.phase = "over";
    $("board").className = "board";
    setPhase("result");
    $("result-msg").textContent = "📋 Đã hết câu hỏi!";
    $("result-msg").style.color = "";
    $("result-answer").textContent = "";
    $("result-sub").textContent = "Chưa đội nào xếp được 3 ô thẳng hàng – ván này hòa.";
    setHint("Đã dùng hết câu hỏi.", null);
    setResultButtons("Ván mới (đua lại) 🏁", false);
    showOverlay("📋", "", "Đã hết câu hỏi!", "Chưa đội nào xếp được 3 ô thẳng hàng – ván này hòa.");
    Sound.beep();
    setTimeout(() => $("overlay").classList.remove("hidden"), 300);
  }

  function startBonus() {
    $("overlay").classList.add("hidden");
    state.mode = "bonus";
    toPick();
  }

  function endBonus() {
    state.phase = "over";
    $("board").className = "board";
    setPhase("result");
    const noQ = remainingQuestions() === 0;
    // Gọi từ toPick (không có câu đang hỏi) → thay thông báo; gọi ngay sau khi chấm → giữ kết quả câu vừa rồi
    if (state.current === null) {
      $("result-msg").textContent = "⭐ Kết thúc phần câu hỏi thêm";
      $("result-msg").style.color = "#7c3aed";
      $("result-answer").textContent = "";
    }
    $("result-sub").textContent = noQ
      ? "🎉 Đã mở hết các câu hỏi!"
      : "Bàn cờ đã kín ô.";
    setHint(noQ ? "Đã mở hết các câu hỏi." : "Không còn ô trống.", null);
    setResultButtons("Ván mới (đua lại) 🏁", false);
  }

  function newGame(firstTeam) {
    state.board = Array(9).fill(null);
    state.mode = "main";
    buildOrder(); // mỗi ván mới hỏi lại từ câu 1
    document.querySelectorAll(".cell").forEach((c) => {
      c.textContent = "";
      c.className = "cell";
    });
    state.turn = firstTeam;
    showScreen("game");
    toPick();
  }

  /* ================= Gắn sự kiện ================= */
  function init() {
    // iPhone/Android chỉ cho phát âm thanh sau lần chạm đầu tiên
    document.addEventListener("pointerdown", () => Sound.on && Sound.ensure(), { once: true });
    buildOrder();
    renderTeams();
    initSetup();

    $("btn-race").addEventListener("click", startRace);
    $("btn-to-game").addEventListener("click", () => newGame(raceWinner || "X"));

    $("btn-correct").addEventListener("click", () => judge(true));
    $("btn-wrong").addEventListener("click", () => judge(false));
    $("btn-reveal").addEventListener("click", revealAnswer);
    $("btn-pause").addEventListener("click", togglePause);
    $("btn-skip").addEventListener("click", () => {
      // Bỏ câu hiện tại, lấy câu kế tiếp trong danh sách cho cùng ô đó
      if (state.phase === "asking" && remainingQuestions() > 0) showQuestion();
    });
    $("btn-next-turn").addEventListener("click", onNextClick);
    $("btn-bonus").addEventListener("click", startBonus);
    $("board").addEventListener("click", onCellClick);

    const pickFromEvent = (e) => {
      const li = e.target.closest("li[data-i]");
      if (li) pickOption(Number(li.dataset.i));
    };
    $("q-options").addEventListener("click", pickFromEvent);
    $("q-options").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pickFromEvent(e);
      }
    });

    $("btn-new-round").addEventListener("click", () => {
      $("overlay").classList.add("hidden");
      goRace();
    });
    $("btn-open-bonus").addEventListener("click", startBonus);
    $("btn-close-overlay").addEventListener("click", () => $("overlay").classList.add("hidden"));

    $("btn-sound").addEventListener("click", () => {
      Sound.on = !Sound.on;
      $("btn-sound").textContent = Sound.on ? "🔊" : "🔇";
      if (Sound.on) {
        Sound.ensure();
        if ($("track").classList.contains("running")) Music.start();
      } else {
        Music.stop();
      }
    });
  }

  init();
})();
