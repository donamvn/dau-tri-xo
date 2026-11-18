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
    phase: "ready", // ready | asking | place | result | over
    order: [],
    qPos: 0,
    qCount: 0,
    current: null,
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

    let last = performance.now();
    let elapsed = 0;

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      for (const r of racers) {
        if (elapsed >= r.nextChange) {
          const boost = Math.random() < 0.15; // thỉnh thoảng tăng tốc bất ngờ
          r.speed = boost ? rand(0.38, 0.5) : rand(0.12, 0.3);
          r.nextChange = elapsed + rand(0.25, 0.7);
        }
        r.pos += r.speed * dt;
        r.el.style.transform = "translateX(" + Math.min(r.pos, 1) * dist + "px)";
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
    racers.forEach((r) => r.el.classList.remove("running"));
    $("racer-" + winner).classList.add("winner");
    const res = $("race-result");
    res.className = "race-result " + winner.toLowerCase();
    res.textContent = "🏆 " + state.names[winner] + " về nhất – được trả lời trước!";
    Sound.fanfare();
    $("btn-race").classList.add("hidden");
    $("btn-to-game").classList.remove("hidden");
  }

  /* ================= Câu hỏi ================= */
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

  function takeQuestion() {
    if (!QUESTIONS.length) return null;
    if (state.qPos >= state.order.length) buildOrder(); // hết câu thì quay lại từ đầu
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
    if (q.answer === undefined || q.answer === null || q.answer === "") return "";
    const idx = correctOptionIndex(q);
    if (idx >= 0) return "Đáp án: " + String.fromCharCode(65 + idx) + ". " + q.options[idx];
    return "Đáp án: " + q.answer;
  }

  function renderQuestion(q) {
    $("q-number").textContent = "Câu hỏi số " + state.qCount;
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

  function showQuestion(isSkip) {
    const q = takeQuestion();
    if (!q) {
      alert("Chưa có câu hỏi nào. Hãy thêm câu hỏi vào file questions.js rồi tải lại trang.");
      return;
    }
    if (!isSkip) state.qCount++;
    state.current = q;
    state.revealed = false;
    state.phase = "asking";
    renderQuestion(q);
    setPhase("asking");
    setHint(state.names[state.turn] + " đang trả lời…", state.turn);
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
    if (T.remaining <= 0) {
      text.textContent = "⏰ Hết giờ!";
    } else {
      text.textContent = Math.ceil(T.remaining) + " giây";
    }
    text.classList.toggle("low", T.remaining > 0 && T.remaining <= 5 && T.running);
    text.classList.toggle("paused", !T.running && T.remaining > 0);
  }

  /* ================= Chấm điểm ================= */
  function judge(isCorrect, opts) {
    opts = opts || {};
    if (state.phase !== "asking" && state.phase !== "checking") return;
    stopTimer();
    const team = state.turn;
    $("result-answer").textContent = answerText(state.current);
    setPhase("result");

    if (isCorrect) {
      if (!opts.silent) Sound.correct();
      state.phase = "place";
      $("result-msg").textContent = "✓ Chính xác!";
      $("result-msg").style.color = "var(--success)";
      $("btn-next-turn").classList.add("hidden");
      $("board").className = "board pick-" + team;
      setHint("👉 " + state.names[team] + " hãy chọn 1 ô để đánh " + team, team);
      scrollToEl(document.querySelector(".board-card"), "center");
    } else {
      if (!opts.silent) Sound.wrong();
      state.phase = "result";
      $("result-msg").textContent = opts.timeout ? "⏰ Hết giờ rồi!" : "✗ Chưa đúng rồi!";
      $("result-msg").style.color = "var(--danger)";
      const btn = $("btn-next-turn");
      btn.textContent = "Chuyển lượt cho " + state.names[other(team)] + " ▶";
      btn.classList.remove("hidden");
      setHint("Không được đánh ô nào lượt này.", null);
    }
  }

  function nextTurn() {
    if (state.phase === "over") {
      goRace();
      return;
    }
    state.turn = other(state.turn);
    toReady();
  }

  function toReady() {
    state.phase = "ready";
    state.current = null;
    $("board").className = "board";
    renderTurn();
    setPhase("ready");
    setHint("Chờ câu hỏi cho " + state.names[state.turn], state.turn);
  }

  /* ================= Bàn cờ ================= */
  function findWinner() {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
        return { team: state.board[a], line };
      }
    }
    return null;
  }

  function onCellClick(e) {
    const cell = e.target.closest(".cell");
    if (!cell || state.phase !== "place") return;
    const i = Number(cell.dataset.i);
    if (state.board[i]) return;

    const team = state.turn;
    state.board[i] = team;
    cell.textContent = team;
    cell.classList.add(team, "placed");
    $("board").className = "board";
    Sound.place();

    const win = findWinner();
    if (win) return finishGame(win);
    if (state.board.every(Boolean)) return finishGame(null);

    state.turn = other(team);
    setTimeout(toReady, 500);
    state.phase = "between";
  }

  function finishGame(win) {
    state.phase = "over";
    setPhase("result");
    const btn = $("btn-next-turn");
    btn.textContent = "Ván mới (đua lại) 🏁";
    btn.classList.remove("hidden");
    $("result-answer").textContent = "";

    const mark = $("overlay-mark");
    if (win) {
      state.wins[win.team]++;
      renderTeams();
      win.line.forEach((i) => document.querySelector('.cell[data-i="' + i + '"]').classList.add("win"));
      $("result-msg").textContent = "🏆 " + state.names[win.team] + " thắng!";
      $("result-msg").style.color = win.team === "X" ? "var(--x)" : "var(--o)";
      setHint(state.names[win.team] + " có 3 ô thẳng hàng!", win.team);
      mark.textContent = win.team;
      mark.className = "overlay-mark " + win.team;
      $("overlay-title").textContent = state.names[win.team] + " chiến thắng!";
      $("overlay-sub").textContent = "Đã xếp được 3 " + win.team + " thẳng hàng. Tỉ số: " +
        state.names.X + " " + state.wins.X + " – " + state.wins.O + " " + state.names.O;
      Sound.fanfare();
      confetti();
    } else {
      $("result-msg").textContent = "🤝 Hòa!";
      $("result-msg").style.color = "";
      setHint("Bàn cờ đã kín ô, không đội nào thắng.", null);
      mark.textContent = "🤝";
      mark.className = "overlay-mark";
      $("overlay-title").textContent = "Hòa nhau!";
      $("overlay-sub").textContent = "Bàn cờ đã kín mà chưa đội nào có 3 ô thẳng hàng.";
      Sound.beep();
    }
    setTimeout(() => $("overlay").classList.remove("hidden"), win ? 700 : 300);
  }

  function newGame(firstTeam) {
    state.board = Array(9).fill(null);
    document.querySelectorAll(".cell").forEach((c) => {
      c.textContent = "";
      c.className = "cell";
    });
    state.turn = firstTeam;
    showScreen("game");
    toReady();
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

    $("btn-show-question").addEventListener("click", () => showQuestion(false));
    $("btn-correct").addEventListener("click", () => judge(true));
    $("btn-wrong").addEventListener("click", () => judge(false));
    $("btn-reveal").addEventListener("click", revealAnswer);
    $("btn-pause").addEventListener("click", togglePause);
    $("btn-skip").addEventListener("click", () => {
      if (state.phase === "asking") showQuestion(true);
    });
    $("btn-next-turn").addEventListener("click", nextTurn);
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
    $("board").addEventListener("click", onCellClick);

    $("btn-new-round").addEventListener("click", () => {
      $("overlay").classList.add("hidden");
      goRace();
    });
    $("btn-close-overlay").addEventListener("click", () => $("overlay").classList.add("hidden"));

    $("btn-sound").addEventListener("click", () => {
      Sound.on = !Sound.on;
      $("btn-sound").textContent = Sound.on ? "🔊" : "🔇";
      if (Sound.on) Sound.ensure();
    });
  }

  init();
})();
