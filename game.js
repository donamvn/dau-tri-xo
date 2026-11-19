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
      if (this.ctx) Object.values(Tracks).forEach((t) => t.decode()); // giải mã sẵn nhạc mp3 ngay khi có thể
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
    // Di chuột qua ô: mỗi ô một nốt (âm giai ngũ cung) cho vui tai
    hover(i) {
      const f = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568][i] || 660;
      this.tone(f, 0.12, "sine", 0, 0.16);
      this.tone(f * 2, 0.06, "triangle", 0.02, 0.04);
    },
    correct() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, "triangle", i * 0.09, 0.22)); },
    wrong() { this.tone(220, 0.35, "sawtooth", 0, 0.12); this.tone(160, 0.5, "sawtooth", 0.18, 0.12); },
    timeup() { this.tone(330, 0.25, "square", 0, 0.12); this.tone(330, 0.5, "square", 0.3, 0.12); },
    fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.28, "triangle", i * 0.14, 0.22)); },
  };

  /* ================= Nhạc nền (tự sáng tác, phát bằng WebAudio – không cần file nhạc) =================
   * Mỗi bài chia thành các nhịp 16 bước (nốt móc kép).
   *   lead : chuỗi số MIDI, "-" = ngân tiếp nốt trước, "." = nghỉ
   *   bass : nốt gốc của từng ô nhịp; bassPat: r = gốc, o = quãng 8, f = quãng 5, . = nghỉ
   *   drums: k = trống cái, s = trống lẫy, h = hi-hat, t/c = tiếng đồng hồ tích/tắc
   */
  const SONGS = {
    // Cuộc đua: giọng La thứ, nhịp dồn dập kiểu rượt đuổi
    race: {
      bpm: 138, fastBpm: 166, vol: 0.8,
      leadType: "square", leadVol: 0.05,
      lead:
        "76 - 74 - 72 - 69 - 72 - 74 - 76 - - - " +
        "77 - 76 - 74 - 72 - 69 - 72 - 77 - - - " +
        "79 - 77 - 76 - 74 - 71 - 74 - 79 - 81 - " +
        "80 - - - 76 - - - 71 - 76 - 80 - 83 - " +
        "81 - 81 76 - 76 72 - 76 - 81 - 84 - - - " +
        "84 - 83 - 81 - 77 - 81 - 77 - 72 - - - " +
        "83 - 81 - 79 - 74 - 79 - 83 - 86 - 83 - " +
        "80 - 83 - 84 - 83 - 80 - 76 - 71 - 68 - ",
      bass: [45, 41, 43, 40, 45, 41, 43, 40],
      bassPat: "rrorrrorrrorrror", bassVol: 0.13,
      chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]],
      drums: { k: "x...x...x...x...", s: "....x.......x...", h: "..x...x...x...x." },
      fill: true, // dồn trống ở cuối mỗi 4 ô nhịp
    },
    // Chọn ô: vui tươi, nhẹ nhàng (Đô trưởng, tiếng mộc cầm)
    pick: {
      bpm: 112, vol: 0.5,
      leadType: "marimba", leadVol: 0.16,
      lead:
        "72 . 76 . 79 . 76 . 84 . 79 . 76 . 79 . " +
        "72 . 76 . 81 . 76 . 84 . 81 . 76 . 81 . " +
        "72 . 77 . 81 . 77 . 84 . 81 . 77 . 81 . " +
        "71 . 74 . 79 . 74 . 83 . 79 . 77 . 74 . ",
      bass: [48, 45, 41, 43],
      bassPat: "r.......f.......", bassVol: 0.14,
      drums: { k: "x.......x.......", h: "..x...x...x...x." },
    },
    // Đếm giờ: hồi hộp, tiếng đồng hồ tích tắc (Rê thứ)
    timer: {
      bpm: 104, fastBpm: 132, vol: 0.55,
      leadType: "pluck", leadVol: 0.13,
      lead:
        "62 . 65 . 69 . 65 . 62 . 65 . 69 . 65 . " +
        "62 . 65 . 69 . 70 . 69 . 65 . 64 . 65 . " +
        "58 . 62 . 65 . 62 . 70 . 65 . 62 . 65 . " +
        "57 . 61 . 64 . 61 . 69 . 67 . 64 . 61 . ",
      bass: [50, 50, 46, 45],
      bassPat: "r...r...r...r...", bassVol: 0.15,
      drums: { t: "x.......x.......", c: "....x.......x..." },
    },
  };

  // Chuyển chuỗi giai điệu thành mảng { m: nốt, len: số bước }
  function parseLead(str) {
    const tok = str.trim().split(/\s+/);
    return tok.map((x, i) => {
      if (x === "-" || x === ".") return null;
      let len = 1;
      while (tok[i + len] === "-") len++;
      return { m: Number(x), len };
    });
  }
  Object.values(SONGS).forEach((s) => (s.leadNotes = parseLead(s.lead)));

  const Music = {
    current: null, // tên bài đang phát
    song: null,
    bpm: 120,
    intense: false,
    step: 0,
    nextTime: 0,
    timer: null,
    out: null,
    bassBus: null,
    noise: null,
    freq: (m) => 440 * Math.pow(2, (m - 69) / 12),

    noiseBuffer() {
      if (this.noise) return this.noise;
      const ctx = Sound.ctx;
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return (this.noise = buf);
    },

    note(m, t, dur, type, vol, dest) {
      const ctx = Sound.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const pluck = type === "marimba" || type === "pluck";
      o.type = type === "marimba" ? "sine" : type === "pluck" ? "triangle" : type;
      o.frequency.setValueAtTime(this.freq(m), t);
      const end = pluck ? t + Math.min(dur, type === "marimba" ? 0.45 : 0.3) : t + dur;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      if (!pluck) g.gain.setValueAtTime(vol, Math.max(t + 0.006, end - 0.04));
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      o.connect(g).connect(dest || this.out);
      o.start(t);
      o.stop(end + 0.02);
      if (type === "marimba") this.note(m + 24, t, 0.08, "sine", vol * 0.25, dest); // tiếng gõ sáng
    },

    noiseHit(t, dur, vol, filterType, freq) {
      const ctx = Sound.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.out);
      src.start(t);
      src.stop(t + dur + 0.02);
    },

    drum(kind, t, vol) {
      const ctx = Sound.ctx;
      if (kind === "k") {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.5 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 0.25);
      } else if (kind === "s") {
        this.noiseHit(t, 0.14, 0.22 * vol, "highpass", 1400);
        this.note(55, t, 0.07, "triangle", 0.12 * vol);
      } else if (kind === "h") {
        this.noiseHit(t, 0.035, 0.07 * vol, "highpass", 7000);
      } else if (kind === "t" || kind === "c") {
        // tiếng mõ gỗ: tích (cao) – tắc (thấp)
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(kind === "t" ? 1750 : 1250, t);
        g.gain.setValueAtTime(0.13 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 0.06);
      }
    },

    playStep(s, t, stepDur) {
      const song = this.song;
      const bar = Math.floor(s / 16);
      const pos = s % 16;

      // Giai điệu
      const n = song.leadNotes[s % song.leadNotes.length];
      if (n) this.note(n.m, t, n.len * stepDur * 0.92, song.leadType, song.leadVol);

      // Bè trầm
      const root = song.bass[bar % song.bass.length];
      const p = song.bassPat[pos];
      if (p !== ".") {
        let len = 1;
        while (len < 16 && song.bassPat[(pos + len) % 16] === ".") len++;
        const m = root + (p === "o" ? 12 : p === "f" ? 7 : 0);
        this.note(m, t, len * stepDur * 0.9, "sawtooth", song.bassVol, this.bassBus);
      }

      // Hợp âm nhấn đầu ô nhịp
      if (song.chords && pos === 0) {
        song.chords[bar % song.chords.length].forEach((m) =>
          this.note(m, t, stepDur * 3, "sawtooth", 0.028, this.bassBus)
        );
      }

      // Trống
      const fillBar = song.fill && bar % 4 === 3 && pos >= 12;
      for (const kind in song.drums) {
        if (song.drums[kind][pos] === "x") this.drum(kind, t, 1);
      }
      if (fillBar) this.drum("s", t, 0.7 + (pos - 12) * 0.12);
      if (this.intense && song.drums.h && song.drums.h[pos] !== "x") this.drum("h", t, 0.6);
    },

    schedule() {
      const ctx = Sound.ctx;
      while (this.nextTime < ctx.currentTime + 0.12) {
        const stepDur = 60 / this.bpm / 4; // móc kép
        this.playStep(this.step, this.nextTime, stepDur);
        this.nextTime += stepDur;
        this.step++;
      }
    },

    play(name) {
      if (!Sound.on || !SONGS[name]) return;
      if (this.current === name) return;
      this.stop();
      const ctx = Sound.ensure();
      if (!ctx) return;
      // Đua / đếm giờ: ưu tiên bản nhạc mp3; chưa tải xong thì dùng nhạc tự tạo
      const track = Tracks[name];
      if (track && track.ready()) return this.playFile(ctx, name, track);
      this.song = SONGS[name];
      this.current = name;
      this.bpm = this.song.bpm;
      this.intense = false;
      this.out = ctx.createGain();
      this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.out.gain.linearRampToValueAtTime(this.song.vol, ctx.currentTime + 0.15);
      this.out.connect(ctx.destination);
      this.bassBus = ctx.createBiquadFilter();
      this.bassBus.type = "lowpass";
      this.bassBus.frequency.value = 1100;
      this.bassBus.connect(this.out);
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.05;
      this.timer = setInterval(() => this.schedule(), 25);
      this.schedule();
    },

    // Dồn nhịp: gần về đích / sắp hết giờ
    faster() {
      if (!this.song || this.intense) return;
      this.intense = true;
      if (this.song.fastBpm) this.bpm = this.song.fastBpm;
    },

    playFile(ctx, name, track) {
      this.current = name;
      this.fileTrack = track;
      // Nhạc đếm giờ phát tiếp từ chỗ đang dở (sau khi tạm dừng); nhạc đua luôn phát từ đầu
      const pos = track.resume ? track.pos : 0;
      if (track.buffer) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.linearRampToValueAtTime(track.volume, ctx.currentTime + (pos ? 0.3 : 0.02));
        g.connect(ctx.destination);
        const src = ctx.createBufferSource();
        src.buffer = track.buffer;
        src.loop = !!track.loop;
        src.connect(g);
        src.start(0, pos % track.buffer.duration);
        track.startedAt = ctx.currentTime - pos;
        this.fileSrc = src;
        this.fileGain = g;
      } else {
        const el = track.el; // mở bằng file:// thì phát qua thẻ <audio>
        clearInterval(el._fade);
        el.loop = !!track.loop;
        el.currentTime = pos;
        el.volume = track.volume;
        el.play().catch(() => {});
        this.fileEl = el;
      }
    },

    stop() {
      const ctx = Sound.ctx;
      const track = this.fileTrack;
      this.fileTrack = null;
      // Ghi nhớ vị trí đang phát để lần sau phát tiếp
      if (track && this.fileSrc) track.pos = ctx.currentTime - track.startedAt;
      if (track && this.fileEl) track.pos = this.fileEl.currentTime;
      // Nhạc mp3: giảm dần trong ~0,5 giây cho êm rồi mới dừng
      if (this.fileSrc) {
        const src = this.fileSrc, g = this.fileGain;
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        setTimeout(() => { try { src.stop(); } catch (e) {} g.disconnect(); }, 1000);
        this.fileSrc = this.fileGain = null;
      }
      if (this.fileEl) {
        const el = this.fileEl;
        el._fade = setInterval(() => {
          el.volume = Math.max(0, el.volume - 0.1);
          if (el.volume <= 0) { clearInterval(el._fade); el.pause(); }
        }, 50);
        this.fileEl = null;
      }
      this.current = null;
      if (!this.timer) return;
      clearInterval(this.timer);
      this.timer = null;
      const out = this.out;
      if (out && ctx) {
        out.gain.cancelScheduledValues(ctx.currentTime);
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        setTimeout(() => out.disconnect(), 400);
      }
      this.out = null;
      this.bassBus = null;
      this.song = null;
    },
  };

  /* ================= Nhạc nền từ file mp3 =================
   * music/race.mp3  : nhạc cuộc đua
   * music/timer.mp3 : nhạc lúc đếm giờ trả lời câu hỏi (tự lặp lại nếu hết bài)
   * Muốn đổi nhạc: thay file mp3 tương ứng (giữ nguyên tên). */
  function makeTrack(url, volume, opts) {
    return Object.assign({
      url,
      volume,
      loop: false,
      resume: false,
      pos: 0,
      startedAt: 0,
      data: null,
      buffer: null,
      el: null,
      decoding: false,
      failed: false,
    }, opts, TrackMethods);
  }

  const TrackMethods = {
    preload() {
      fetch(this.url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((d) => { this.data = d; this.decode(); })
        .catch(() => {
          // Mở trực tiếp từ máy (file://) không tải được bằng fetch → dùng thẻ <audio>
          this.el = new Audio(this.url);
          this.el.preload = "auto";
          this.el.addEventListener("error", () => (this.failed = true));
        });
    },
    decode() {
      const ctx = Sound.ctx;
      if (!ctx || !this.data || this.buffer || this.decoding) return;
      this.decoding = true;
      ctx.decodeAudioData(this.data.slice(0), (b) => (this.buffer = b), () => (this.failed = true));
    },
    ready() {
      this.decode();
      return !!this.buffer || (!!this.el && !this.failed && this.el.readyState >= 3);
    },
  };

  const Tracks = {
    race: makeTrack("music/race.mp3", 0.75),
    timer: makeTrack("music/timer.mp3", 0.6, { loop: true, resume: true }),
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
      info.textContent = "";
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
  let raceSprint = false;

  function resetRace() {
    raceRunning = false;
    raceWinner = null;
    $("track").classList.remove("running");
    syncMusic();
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

    $("track").classList.add("running"); // cho cây cối, đồi núi chạy
    syncMusic();
    const res = $("race-result");
    let leader = null;
    raceSprint = false;
    let last = performance.now();
    let elapsed = 0;

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      for (const r of racers) {
        if (elapsed >= r.nextChange) {
          const roll = Math.random();
          if (roll < 0.12) {
            r.speed = rand(0.13, 0.18); // tăng tốc bất ngờ
            r.nextChange = elapsed + rand(0.5, 1.0);
          } else if (roll < 0.18 && r.pos > 0.15) {
            r.speed = rand(0.01, 0.025); // hụt hơi một chút
            r.nextChange = elapsed + rand(0.4, 0.7);
          } else {
            r.speed = rand(0.04, 0.095); // ~13–14 giây mới về đích
            r.nextChange = elapsed + rand(0.4, 1.0);
          }
        }
        r.pos += r.speed * dt;
        r.el.style.transform = "translateX(" + Math.min(r.pos, 1) * dist + "px)";
      }

      // Bình luận trực tiếp: ai đang dẫn trước
      const [a, b] = racers;
      const lead = Math.abs(a.pos - b.pos) < 0.015 ? null : a.pos > b.pos ? a.t : b.t;
      if (!raceSprint && Math.max(a.pos, b.pos) > 0.8) {
        raceSprint = true; // sắp về đích: nhạc dồn nhịp, đổi lời bình
        Music.faster();
        leader = null;
      }
      if (elapsed > 1 && lead && lead !== leader) {
        leader = lead;
        res.className = "race-result live " + lead.toLowerCase();
        res.textContent = (raceSprint ? "⚡ Nước rút! " : "🔥 ") + state.names[lead] + " đang dẫn trước!";
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
    $("track").classList.remove("running");
    syncMusic();
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
    $("q-number").textContent = state.mode === "bonus" ? "⭐ Câu hỏi thêm" : "";
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
    prepareTimer(t); // chờ người dẫn bấm "Bắt đầu tính giờ"
    syncMusic();
    scrollToEl(document.querySelector(".question-card"), "start");
  }

  /* ================= Đồng hồ đếm ngược ================= */
  const T = { total: 0, remaining: 0, running: false, started: false, hurried: false, handle: null, last: 0, lastWhole: 0 };

  // Hiện câu hỏi: đặt sẵn số giây nhưng CHƯA chạy
  function prepareTimer(sec) {
    stopTimer();
    Tracks.timer.pos = 0; // câu mới: nhạc đếm giờ phát lại từ đầu
    T.total = sec;
    T.remaining = sec;
    T.lastWhole = Math.ceil(sec);
    T.started = false;
    T.hurried = false;
    $("btn-start-timer").classList.remove("hidden");
    $("btn-pause").disabled = true;
    $("btn-pause").textContent = "⏸ Tạm dừng";
    renderTimer();
  }

  // Người dẫn bấm "Bắt đầu tính giờ"
  function startTimer() {
    if (state.phase !== "asking" || T.started) return;
    T.started = true;
    T.last = performance.now();
    T.running = true;
    T.handle = setInterval(tickTimer, 100);
    $("btn-start-timer").classList.add("hidden");
    $("btn-pause").disabled = false;
    Sound.go();
    renderTimer();
    syncMusic();
  }

  function stopTimer() {
    T.running = false;
    clearInterval(T.handle);
    T.handle = null;
    $("btn-start-timer").classList.add("hidden");
    syncMusic();
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
    if (!T.hurried && T.remaining <= 10 && T.total > 10) {
      T.hurried = true;
      Music.faster(); // 10 giây cuối: nhạc dồn dập hơn
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
    if (T.remaining <= 0 || state.phase !== "asking" || !T.started) return;
    if (T.running) {
      T.running = false;
      $("btn-pause").textContent = "▶ Tiếp tục";
    } else {
      T.last = performance.now();
      T.running = true;
      $("btn-pause").textContent = "⏸ Tạm dừng";
    }
    renderTimer();
    syncMusic();
  }

  function renderTimer() {
    const text = $("timer-text");
    const fill = $("timer-fill");
    const pct = T.total ? (T.remaining / T.total) * 100 : 0;
    fill.style.width = pct + "%";
    fill.classList.toggle("mid", pct <= 50 && pct > 20);
    fill.classList.toggle("low", pct <= 20);
    const s = Math.ceil(T.remaining);
    text.textContent = T.remaining <= 0 ? "⏰ Hết giờ!"
      : s >= 60 ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") // vd 1:30
      : s + " giây";
    text.classList.toggle("low", T.remaining > 0 && T.remaining <= 5 && T.running);
    text.classList.toggle("paused", T.started && !T.running && T.remaining > 0);
    text.classList.toggle("waiting", !T.started);
  }

  /* ================= Chọn nhạc nền theo tình huống =================
   * Đua: nhạc rượt đuổi · Chọn ô: nhạc vui · Đang đếm giờ: nhạc hồi hộp
   * Lúc mới hiện câu hỏi (chưa bấm tính giờ), tạm dừng, xem kết quả: im lặng */
  function wantedMusic() {
    if ($("track").classList.contains("running")) return "race";
    if (!$("screen-game").classList.contains("active")) return null;
    if (state.phase === "pick") return "pick";
    if (state.phase === "asking" && T.running) return "timer";
    return null;
  }

  function syncMusic() {
    const want = Sound.on ? wantedMusic() : null;
    if (want === Music.current) return;
    Music.stop();
    if (!want) return;
    Music.play(want);
    if (want === "timer" && T.hurried) Music.faster();
    if (want === "race" && raceSprint) Music.faster();
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
    syncMusic(); // nhạc nền lúc chọn ô
  }

  // Di chuột qua ô trống lúc đang chọn → kêu "ting"
  let lastHover = -1;
  function onCellHover(e) {
    if (e.pointerType === "touch") return;
    const cell = e.target.closest(".cell");
    const i = cell ? Number(cell.dataset.i) : -1;
    if (i === lastHover) return;
    lastHover = i;
    if (i < 0 || state.phase !== "pick" || state.board[i]) return;
    Sound.hover(i);
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
    syncMusic(); // vào câu hỏi thì tắt nhạc
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
    $("result-sub").textContent = noQ ? "🎉 Đã mở hết các câu hỏi!" : "";
    setHint(noQ ? "Đã mở hết các câu hỏi." : "", null);
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
    Object.values(Tracks).forEach((t) => t.preload());
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
    $("board").addEventListener("pointerover", onCellHover);
    $("board").addEventListener("pointerleave", () => (lastHover = -1));
    $("btn-start-timer").addEventListener("click", startTimer);
    setInterval(syncMusic, 300); // phòng hờ: luôn giữ đúng nhạc theo tình huống

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
      if (Sound.on) Sound.ensure();
      syncMusic();
    });
  }

  init();
})();
