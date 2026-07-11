/* ============================================
   POCKET JOKERS — Minimal JavaScript
   Particles, Navigation, Scroll Reveal,
   Contact Form
   ============================================ */

/* ── Background Visualizer ──
   One full-screen canvas, one rAF loop, one shared audio analyzer + pointer.
   The visual is delegated to one of several independent renderers, picked at
   random on load and re-rolled on every track change. Each renderer is a
   completely different look — particles, flowing lines, aurora, spectrum
   ridge, radial burst — not a variation of the same effect.

   Renderer contract:
     resize(w, h)
     draw(ctx, audio, pointer, time)
       audio   = { bass, mid, treble, avg, data }  (bands 0..1, data: Uint8Array|null)
       pointer = { x, y, active }
       time    = performance.now() in ms
*/

// Shape a raw FFT buffer into `bars` evenly-readable values. Raw spectra dump
// almost all energy into the low (left) bins, so a plain mapping only lifts the
// left edge. A rising gain across the band compensates the natural high-end
// roll-off so the whole width reacts. Returns gentle idle motion when silent.
function sampleSpectrum(data, bars) {
  const out = new Array(bars);
  if (!data) {
    for (let i = 0; i < bars; i++) out[i] = 0.16 + 0.12 * Math.sin(i * 0.4);
    return out;
  }
  // The top FFT bins of real music are essentially silent, so spreading bars
  // across the full range leaves the right half flat. Use only the lower,
  // musically-active portion of the spectrum, and apply a perceptual curve
  // (pow < 1) so quieter mid bands still register visually.
  const usable = Math.max(2, Math.floor(data.length * 0.45));
  for (let i = 0; i < bars; i++) {
    const f = bars > 1 ? i / (bars - 1) : 0;
    const idx = Math.min(usable - 1, Math.floor(f * (usable - 1)));
    const v = Math.pow(data[idx] / 255, 0.6) * (1 + f * 0.6);
    out[i] = Math.min(1, v);
  }
  return out;
}

// Enhanced constellation: white dots + links, colored gradient glow on bass,
// and cursor repulsion so the field reacts to the hand even in silence.
class ParticlesRenderer {
  constructor() {
    this.particles = [];
    this.w = 0;
    this.h = 0;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    const count = Math.min(60, Math.floor((w * h) / 24000));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 1.2 + 0.4,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.3 + 0.05,
      });
    }
  }

  draw(ctx, audio, pointer) {
    const { bass, avg } = audio;
    const bassScale = 1 + bass * bass * 2;
    const speedScale = 1 + avg * 1.5 + Math.pow(bass, 3) * 12;
    const maxDist = 100 + bass * 200;
    const glow = bass * bass;
    const parts = this.particles;

    for (const p of parts) {
      p.x += p.speedX * speedScale;
      p.y += p.speedY * speedScale;

      if (pointer.influence > 0.001) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        const R = 140;
        if (d2 < R * R && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const force = (1 - d / R) * 2.4 * pointer.influence;
          p.x += (dx / d) * force;
          p.y += (dy / d) * force;
        }
      }

      if (p.x < -5) p.x = this.w + 5;
      if (p.x > this.w + 5) p.x = -5;
      if (p.y < -5) p.y = this.h + 5;
      if (p.y > this.h + 5) p.y = -5;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * bassScale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, p.opacity + glow * 0.6)})`;
      ctx.fill();
    }

    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const dx = parts[i].x - parts[j].x;
        const dy = parts[i].y - parts[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const op = (1 - dist / maxDist) * (0.05 + glow * 0.8);
          ctx.strokeStyle = `rgba(255, 255, 255, ${op})`;
          ctx.lineWidth = 0.5 + bass * 1.5;
          ctx.beginPath();
          ctx.moveTo(parts[i].x, parts[i].y);
          ctx.lineTo(parts[j].x, parts[j].y);
          ctx.stroke();
        }
      }
    }

    if (pointer.influence > 0.001) {
      for (const p of parts) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 160) {
          const op = (1 - dist / 160) * 0.22 * pointer.influence;
          ctx.strokeStyle = `rgba(255, 255, 255, ${op})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }
    }
  }
}

// Stacked sine waves painted with a horizontal gradient — oscilloscope/aurora
// feel. Amplitude tracks bass/mid; the cursor locally bends the strands.
class FlowLinesRenderer {
  constructor() {
    this.w = 0;
    this.h = 0;
    this.phase = 0;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  draw(ctx, audio, pointer) {
    const { bass, mid, treble } = audio;
    this.phase += 0.012 + bass * 0.03;
    const lines = 5;

    for (let l = 0; l < lines; l++) {
      const t = l / (lines - 1);
      const baseY = this.h * (0.3 + t * 0.4);
      const amp = 34 + bass * 130 * (1 - t * 0.4) + mid * 55;
      const freq = 0.004 + t * 0.003;

      const grad = ctx.createLinearGradient(0, 0, this.w, 0);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      grad.addColorStop(0.5, `rgba(255, 255, 255, ${0.30 - l * 0.03 + treble * 0.5})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6 + bass * 2.4;
      ctx.beginPath();

      for (let x = 0; x <= this.w; x += 8) {
        let y = baseY
          + Math.sin(x * freq + this.phase + l) * amp
          + Math.sin(x * freq * 2.3 + this.phase * 1.5) * amp * 0.3;
        if (pointer.influence > 0.001) {
          const dx = x - pointer.x;
          const falloff = Math.exp(-(dx * dx) / (2 * 120 * 120));
          y += (pointer.y - baseY) * falloff * 0.4 * pointer.influence;
        }
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}

// Soft, drifting gradient blobs blended additively — an ambient aurora that
// breathes with the bass and gently leans toward the cursor.
class AuroraRenderer {
  constructor() {
    this.blobs = [];
    this.w = 0;
    this.h = 0;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    const cols = [[120, 180, 255], [180, 120, 255], [120, 255, 220], [255, 140, 200]];
    this.blobs = [];
    for (let i = 0; i < 4; i++) {
      this.blobs.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: Math.min(w, h) * (0.25 + Math.random() * 0.2),
        col: cols[i % cols.length],
      });
    }
  }

  draw(ctx, audio, pointer) {
    const { bass, avg } = audio;
    ctx.globalCompositeOperation = 'lighter';

    for (const b of this.blobs) {
      b.x += b.vx * (1 + avg * 2);
      b.y += b.vy * (1 + avg * 2);
      if (b.x < -b.r) b.x = this.w + b.r;
      if (b.x > this.w + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = this.h + b.r;
      if (b.y > this.h + b.r) b.y = -b.r;

      let cx = b.x;
      let cy = b.y;
      if (pointer.influence > 0.001) {
        cx += (pointer.x - b.x) * 0.05 * pointer.influence;
        cy += (pointer.y - b.y) * 0.05 * pointer.influence;
      }

      const r = b.r * (1 + bass * 0.4);
      const a = 0.05 + bass * 0.12;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${b.col[0]}, ${b.col[1]}, ${b.col[2]}, ${a})`);
      g.addColorStop(1, `rgba(${b.col[0]}, ${b.col[1]}, ${b.col[2]}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }
}

// Rays fired from a point under the title, length and brightness driven by the
// spectrum — a concert "sunburst" that pulses on the bass and slowly rotates.
class RadialBurstRenderer {
  constructor() {
    this.w = 0;
    this.h = 0;
    this.rays = 96;
    this.angle = 0;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  draw(ctx, audio) {
    const { bass } = audio;
    // Fixed centre under the title — the burst doesn't chase the cursor.
    const cx = this.w / 2;
    const cy = this.h * 0.42;
    this.angle += 0.0015 + bass * 0.012;

    const n = this.rays;
    const minSide = Math.min(this.w, this.h);
    const baseLen = minSide * 0.14;
    // Mirror a half-spectrum around the circle so the burst stays symmetrical
    // instead of bunching all the energy into one arc.
    const spectrum = sampleSpectrum(audio.data, Math.ceil(n / 2));

    // Additive blending makes the overlapping cores near the centre glow.
    ctx.globalCompositeOperation = 'lighter';

    // Inner ring anchors the shape so it reads as a circle even when quiet.
    ctx.beginPath();
    ctx.arc(cx, cy, baseLen * 0.52, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(150, 200, 255, ${0.12 + bass * 0.3})`;
    ctx.lineWidth = 1 + bass * 1.5;
    ctx.stroke();

    for (let i = 0; i < n; i++) {
      const a = this.angle + (i / n) * Math.PI * 2;
      const v = spectrum[Math.min(spectrum.length - 1, i < n / 2 ? i : n - i)];
      const len = baseLen + v * minSide * 0.5 + bass * 80;
      const x1 = cx + Math.cos(a) * baseLen * 0.55;
      const y1 = cy + Math.sin(a) * baseLen * 0.55;
      const x2 = cx + Math.cos(a) * len;
      const y2 = cy + Math.sin(a) * len;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, `rgba(190, 220, 255, ${0.22 + bass * 0.3})`);
      grad.addColorStop(1, 'rgba(140, 170, 255, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4 + v * 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
  }
}

class BackgroundVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.audioAnalyzer = null;
    this.dataArray = null;
    this.reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // `influence` (0..1) ramps up quickly on movement and eases back down when
    // the pointer is lost, so cursor-driven effects fade out instead of snapping.
    this.pointer = { x: 0, y: 0, active: false, influence: 0 };
    this._pointerTimer = null;

    this.renderers = [
      new ParticlesRenderer(),
      new FlowLinesRenderer(),
      new AuroraRenderer(),
      new RadialBurstRenderer(),
    ];
    this.activeIndex = Math.floor(Math.random() * this.renderers.length);

    this.resize();
    this.bindEvents();
    this.animate();
  }

  setAnalyzer(analyzer, dataArray) {
    this.audioAnalyzer = analyzer;
    this.dataArray = dataArray;
  }

  // Re-roll the background to a different look (called on every track change).
  nextRandomMode() {
    if (this.renderers.length < 2) return;
    let next;
    do {
      next = Math.floor(Math.random() * this.renderers.length);
    } while (next === this.activeIndex);
    this.activeIndex = next;
  }

  resize() {
    // Rysowanie w skali devicePixelRatio (max 2) — bez tego canvas jest
    // rozmyty na ekranach retina/telefonach
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderers.forEach(r => r.resize(this.w, this.h));
  }

  bindEvents() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.resize(), 200);
    });

    const setPointer = (x, y) => {
      this.pointer.x = x;
      this.pointer.y = y;
      this.pointer.active = true;
      clearTimeout(this._pointerTimer);
      this._pointerTimer = setTimeout(() => { this.pointer.active = false; }, 800);
    };
    window.addEventListener('mousemove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('mouseleave', () => { this.pointer.active = false; });
  }

  computeAudio() {
    const data = this.dataArray;
    let bass = 0;
    let mid = 0;
    let treble = 0;
    let avg = 0;
    if (this.audioAnalyzer && data) {
      this.audioAnalyzer.getByteFrequencyData(data);
      const n = data.length;
      const bEnd = 15;
      const mEnd = Math.floor(n * 0.5);
      let sum = 0;
      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;
      for (let i = 0; i < n; i++) {
        sum += data[i];
        if (i < bEnd) bassSum += data[i];
        else if (i < mEnd) midSum += data[i];
        else trebleSum += data[i];
      }
      avg = sum / n / 255;
      bass = bassSum / bEnd / 255;
      mid = midSum / Math.max(1, mEnd - bEnd) / 255;
      treble = trebleSum / Math.max(1, n - mEnd) / 255;
    }
    return { bass, mid, treble, avg, data };
  }

  animate() {
    this.ctx.clearRect(0, 0, this.w, this.h);

    // Ease the pointer influence toward its target: snappy on acquire, gentle
    // on release so effects glide back to rest instead of jumping.
    const p = this.pointer;
    const target = p.active ? 1 : 0;
    const k = target > p.influence ? 0.16 : 0.035;
    p.influence += (target - p.influence) * k;

    const audio = this.computeAudio();
    this.renderers[this.activeIndex].draw(this.ctx, audio, this.pointer, performance.now());
    if (!this.reduceMotion) {
      requestAnimationFrame(() => this.animate());
    }
  }
}

// ── Scroll Reveal ──
class ScrollReveal {
  constructor() {
    this.elements = document.querySelectorAll('.reveal');
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    this.elements.forEach(el => this.observer.observe(el));
  }
}

// ── Navbar ──
class Navbar {
  constructor() {
    this.navbar = document.querySelector('.navbar');
    this.hamburger = document.querySelector('.hamburger');
    this.mobileMenu = document.querySelector('.mobile-menu');
    this.navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');
    this.sections = document.querySelectorAll('section[id]');
    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    if (this.hamburger) {
      this.hamburger.addEventListener('click', () => this.toggleMobile());
    }
    this.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
          this.closeMobile();
        }
      });
    });
  }

  onScroll() {
    if (window.scrollY > 50) {
      this.navbar.classList.add('scrolled');
    } else {
      this.navbar.classList.remove('scrolled');
    }

    let current = '';
    this.sections.forEach(section => {
      const sectionTop = section.offsetTop - 100;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });

    this.navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  }

  toggleMobile() {
    const open = this.mobileMenu.classList.toggle('open');
    this.hamburger.classList.toggle('active', open);
    this.hamburger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  closeMobile() {
    this.hamburger.classList.remove('active');
    this.hamburger.setAttribute('aria-expanded', 'false');
    this.mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// ── Back to Top ──
class BackToTop {
  constructor() {
    this.btn = document.querySelector('.back-to-top');
    if (!this.btn) return;
    window.addEventListener('scroll', () => {
      this.btn.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });
    this.btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

// ── Contact Form ──
class ContactForm {
  constructor() {
    this.form = document.getElementById('contact-form');
    if (!this.form) return;
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(this.form);
    const submitBtn = this.form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : 'Wyślij';
    
    if (submitBtn) {
      submitBtn.textContent = 'Wysyłanie...';
      submitBtn.disabled = true;
    }

    // Zamieniamy url na AJAX dla braku przekierowania ze strony
    const ajaxUrl = this.form.action.replace("formsubmit.co", "formsubmit.co/ajax");
    const plainFormData = Object.fromEntries(formData.entries());

    fetch(ajaxUrl, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(plainFormData)
    })
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(data => {
      this.form.style.display = 'none';
      const success = document.querySelector('.form-success');
      if (success) {
        success.classList.add('show');
        // Pokaż powiadomienie że formularz wymaga aktywacji jeśli to pierwszy raz
        if (data.message && data.message.includes('activation')) {
          success.textContent = 'Wysłano! Sprawdź skrzynkę ' + this.form.action.split('/').pop() + ' aby jednorazowo aktywować formularz.';
        } else {
          success.textContent = '✓ Wiadomość wysłana. Odezwiemy się wkrótce.';
        }
      }

      setTimeout(() => {
        this.form.style.display = 'block';
        this.form.reset();
        if (success) success.classList.remove('show');
        if (submitBtn) {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      }, 6000);
    })
    .catch(error => {
      console.error(error);
      if (submitBtn) {
        submitBtn.textContent = 'Błąd. Spróbuj później.';
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }, 3000);
      }
    });
  }
}

// ── Track Player (track list playback) ──
class TrackPlayer {
  constructor() {
    this.audio = document.getElementById('main-audio');
    if (this.audio) {
      this.audio.volume = 0.3;
    }
    this.trackItems = Array.from(document.querySelectorAll('.track-item[data-src]'));
    this.playerTitle = document.querySelector('.track-player-title');
    this.playerNumber = document.querySelector('.track-player-number');
    this.playerMeta = document.querySelector('.track-player-meta');
    this.currentTrack = null;

    // Sticky Player UI
    this.stickyPlayer = document.getElementById('sticky-player');
    this.stickyTitle = document.querySelector('.sticky-player-title');
    this.stickyPlayBtn = document.getElementById('sticky-play-btn');
    this.stickyProgress = document.getElementById('sticky-player-progress');
    this.stickyProgressContainer = document.getElementById('sticky-progress-container');
    this.stickyTimeCurrent = document.getElementById('sticky-time-current');
    this.stickyTimeTotal = document.getElementById('sticky-time-total');
    this.stickyNextBtn = document.getElementById('sticky-next-btn');
    this.stickyPrevBtn = document.getElementById('sticky-prev-btn');
    this.stickyLoopBtn = document.getElementById('sticky-loop-btn');
    this.stickyInfoBtn = document.getElementById('sticky-player-info');

    if (this.stickyPlayBtn) {
      this.iconPlay = this.stickyPlayBtn.querySelector('.icon-play');
      this.iconPause = this.stickyPlayBtn.querySelector('.icon-pause');
    }

    // Full Player UI
    this.fullPlayer = document.getElementById('full-player');
    this.fullCloseBtn = document.getElementById('full-player-close');
    this.fullTitle = document.getElementById('full-player-title');
    this.fullTimeCurrent = document.getElementById('full-time-current');
    this.fullTimeTotal = document.getElementById('full-time-total');
    this.fullProgressContainer = document.getElementById('full-progress-container');
    this.fullProgress = document.getElementById('full-player-progress');
    this.fullPlayBtn = document.getElementById('full-play-btn');
    this.fullPrevBtn = document.getElementById('full-prev-btn');
    this.fullNextBtn = document.getElementById('full-next-btn');
    this.fullLoopBtn = document.getElementById('full-loop-btn');
    
    // Hero Player UI
    this.heroPlayBtn = document.getElementById('hero-play-btn');
    if (this.heroPlayBtn) {
      this.heroIconPlay = this.heroPlayBtn.querySelector('.icon-play');
      this.heroIconPause = this.heroPlayBtn.querySelector('.icon-pause');
    }

    // Hero "Posłuchaj" cue — plays/pauses without leaving the hero
    this.heroCue = document.getElementById('hero-cue');
    if (this.heroCue) {
      this.heroCueIconPlay = this.heroCue.querySelector('.icon-play');
      this.heroCueIconPause = this.heroCue.querySelector('.icon-pause');
      this.heroCueText = this.heroCue.querySelector('.hero-cue-text');
    }

    if (this.fullPlayBtn) {
      this.fullIconPlay = this.fullPlayBtn.querySelector('.icon-play');
      this.fullIconPause = this.fullPlayBtn.querySelector('.icon-pause');
    }

    this.audioContext = null;

    // Bass-reactive glow level (0..1) fed to the sticky player via a CSS var.
    this._level = 0;
    this._levelRaf = null;
    this.reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.bindEvents();
  }

  // Smoothly track the bass and expose it as --level on the sticky player so
  // the progress bar and accents can pulse with the music (CSS does the rest).
  // Pętla rAF startuje w zdarzeniu 'play' i sama gaśnie, gdy po pauzie
  // poświata zjedzie do zera — nie kręci się bez końca, gdy nic nie gra.
  updateLevel() {
    let target = 0;
    if (this.analyzer && this.freqData && this.audio && !this.audio.paused) {
      this.analyzer.getByteFrequencyData(this.freqData);
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += this.freqData[i];
      target = Math.min(1, (sum / 12 / 255) * 1.4);
    }
    this._level += (target - this._level) * 0.18;
    if (this.stickyPlayer) {
      this.stickyPlayer.style.setProperty('--level', this._level.toFixed(3));
    }
    const playing = this.audio && !this.audio.paused;
    if (playing || this._level > 0.005) {
      this._levelRaf = requestAnimationFrame(() => this.updateLevel());
    } else {
      this._level = 0;
      if (this.stickyPlayer) this.stickyPlayer.style.setProperty('--level', '0');
      this._levelRaf = null;
    }
  }

  startLevelLoop() {
    if (this.reduceMotion || this._levelRaf !== null) return;
    this._levelRaf = requestAnimationFrame(() => this.updateLevel());
  }

  initAudioContext() {
    if (!this.audioContext) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
        // Remove crossOrigin restriction to fix local npx serve issues
        // this.audio.crossOrigin = "anonymous";
        const source = this.audioContext.createMediaElementSource(this.audio);
        const analyzer = this.audioContext.createAnalyser();
        
        this.gainNode = this.audioContext.createGain();
        
        analyzer.fftSize = 256;
        source.connect(analyzer);
        analyzer.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        
        if (this.audio) this.audio.volume = 1;
        this.gainNode.gain.value = this.currentVolume !== undefined ? this.currentVolume : 0.3;
        
        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Keep a reference so the sticky player can pulse with the bass too.
        this.analyzer = analyzer;
        this.freqData = dataArray;

        if (window.particleSystem) {
          window.particleSystem.setAnalyzer(analyzer, dataArray);
        }
      } catch (e) {
        console.warn("Web Audio API AudioContext error", e);
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  toggleLoop() {
    if (!this.audio) return;
    this.audio.loop = !this.audio.loop;
    if (this.fullLoopBtn) {
      this.fullLoopBtn.classList.toggle('active', this.audio.loop);
    }
    if (this.stickyLoopBtn) {
      this.stickyLoopBtn.classList.toggle('active', this.audio.loop);
    }
  }

  setCueState(playing) {
    if (!this.heroCue) return;
    this.heroCue.classList.toggle('playing', playing);
    if (this.heroCueIconPlay) this.heroCueIconPlay.style.display = playing ? 'none' : 'block';
    if (this.heroCueIconPause) this.heroCueIconPause.style.display = playing ? 'block' : 'none';
    if (this.heroCueText) this.heroCueText.textContent = playing ? 'Pauza' : 'Posłuchaj';
  }

  playNext() {
    if (!this.currentTrack) return;
    let index = this.trackItems.indexOf(this.currentTrack);
    if (index >= 0 && index < this.trackItems.length - 1) {
      this.toggleTrack(this.trackItems[index + 1]);
    }
  }

  playPrev() {
    if (!this.currentTrack) return;
    
    // Jeśli utwór leci już ponad 3 sekundy, przycisk w tył standardowo cofa do początku
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    let index = this.trackItems.indexOf(this.currentTrack);
    if (index > 0) {
      this.toggleTrack(this.trackItems[index - 1]);
    } else {
      // Jeśli to pierwszy utwór i ma poniżej 3 sekund - też cofnij na sam początek
      this.audio.currentTime = 0;
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // play() zwraca promise, który przeglądarka może odrzucić (np. polityka
  // autoplay) — bez catch każde odrzucenie sypie błędem w konsoli
  tryPlay() {
    if (!this.audio) return;
    const p = this.audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(err => console.warn('Odtwarzanie zablokowane:', err));
    }
  }

  bindEvents() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        this.initAudioContext();
        this.tryPlay();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.audio) this.audio.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.playPrev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.playNext();
      });
    }

    this.trackItems.forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.track-item-download')) {
          e.stopPropagation(); // Only download, do not play
          return;
        }
        this.toggleTrack(item);
      });
    });

    if (this.heroPlayBtn) {
      this.heroPlayBtn.addEventListener('click', () => {
        if (this.trackItems.length > 0) {
          this.toggleTrack(this.trackItems[0]);
        }
      });
    }

    if (this.heroCue) {
      this.heroCue.addEventListener('click', () => {
        if (!this.currentTrack) {
          // Nothing loaded yet — start the first track, stay on the hero
          if (this.trackItems.length > 0) this.toggleTrack(this.trackItems[0]);
        } else if (this.audio.paused) {
          this.initAudioContext();
          this.tryPlay();
        } else {
          this.audio.pause();
        }
      });
    }

    if (this.stickyPlayBtn) {
      this.stickyPlayBtn.addEventListener('click', () => {
        if (this.audio.paused) {
          this.initAudioContext();
          this.tryPlay();
        } else {
          this.audio.pause();
        }
      });
    }

    if (this.fullPlayBtn) {
      this.fullPlayBtn.addEventListener('click', () => {
        if (this.audio.paused) {
          this.initAudioContext();
          this.tryPlay();
        } else {
          this.audio.pause();
        }
      });
    }

    if (this.stickyNextBtn) this.stickyNextBtn.addEventListener('click', () => this.playNext());
    if (this.stickyPrevBtn) this.stickyPrevBtn.addEventListener('click', () => this.playPrev());
    if (this.fullNextBtn) this.fullNextBtn.addEventListener('click', () => this.playNext());
    if (this.fullPrevBtn) this.fullPrevBtn.addEventListener('click', () => this.playPrev());

    if (this.stickyInfoBtn) {
      this.stickyInfoBtn.addEventListener('click', () => {
        if (this.fullPlayer) this.fullPlayer.classList.remove('hidden');
      });
    }

    if (this.fullCloseBtn) {
      this.fullCloseBtn.addEventListener('click', () => {
        if (this.fullPlayer) this.fullPlayer.classList.add('hidden');
      });
    }

    if (this.fullLoopBtn) {
      this.fullLoopBtn.addEventListener('click', () => this.toggleLoop());
    }
    
    if (this.stickyLoopBtn) {
      this.stickyLoopBtn.addEventListener('click', () => this.toggleLoop());
    }

    // Volume popup logic
    this.volumeWrappers = document.querySelectorAll('.volume-wrapper');
    this.volumeBtns = document.querySelectorAll('.volume-toggle-btn');
    
    this.volumeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrapper = btn.closest('.volume-wrapper');
        const isExpanded = wrapper.classList.contains('expanded');
        this.volumeWrappers.forEach(w => w.classList.remove('expanded'));
        if (!isExpanded) {
          wrapper.classList.add('expanded');
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.volume-wrapper')) {
        this.volumeWrappers.forEach(w => w.classList.remove('expanded'));
      }
    });

    this.stickyVolumeSlider = document.getElementById('sticky-volume-slider');
    this.fullVolumeSlider = document.getElementById('full-volume-slider');
    
    this.currentVolume = this.audio ? this.audio.volume : 0.3;

    const updateVolumeUI = (val) => {
      this.currentVolume = parseFloat(val);
      if (this.gainNode) {
        this.gainNode.gain.value = this.currentVolume;
      } else if (this.audio) {
        this.audio.volume = this.currentVolume;
      }

      const vol = this.currentVolume;
      if (this.stickyVolumeSlider) this.stickyVolumeSlider.value = vol;
      if (this.fullVolumeSlider) this.fullVolumeSlider.value = vol;
      document.querySelectorAll('.vol-wave-1').forEach(w => {
        w.style.opacity = vol === 0 ? '0' : '1';
        w.style.transition = 'opacity 0.2s';
      });
      document.querySelectorAll('.vol-wave-2').forEach(w => {
        w.style.opacity = vol < 0.5 ? '0' : '1';
        w.style.transition = 'opacity 0.2s';
      });
    };

    if (this.stickyVolumeSlider) {
      this.stickyVolumeSlider.addEventListener('input', (e) => updateVolumeUI(e.target.value));
    }
    if (this.fullVolumeSlider) {
      this.fullVolumeSlider.addEventListener('input', (e) => updateVolumeUI(e.target.value));
    }
    
    // Initial sync
    updateVolumeUI(this.audio ? this.audio.volume : 0.3);

    this.stickyProgressContainer = document.getElementById('sticky-progress-container');
    if (this.stickyProgressContainer && this.audio) {
      this.stickyProgressContainer.addEventListener('click', (e) => {
        if (!this.audio.duration) return;
        const rect = this.stickyProgressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        this.audio.currentTime = percentage * this.audio.duration;
      });
    }

    // Update icon when audio naturally ends
    if (this.audio) {
      this.audio.addEventListener('ended', () => {
        let index = this.trackItems.indexOf(this.currentTrack);
        if (index >= 0 && index < this.trackItems.length - 1) {
          this.playNext();
        } else {
          this.resetAllIcons();
          if (this.currentTrack) {
            this.currentTrack.classList.remove('playing');
          }
          this.currentTrack = null;
          if (this.stickyPlayer) {
            this.stickyPlayer.classList.add('hidden');
            document.body.classList.remove('has-sticky-player');
          }
          if (this.fullPlayer) {
            this.fullPlayer.classList.add('hidden');
            this.fullPlayer.classList.remove('is-playing');
          }
          if (this.heroIconPlay && this.heroIconPause) {
            this.heroIconPlay.style.display = 'block';
            this.heroIconPause.style.display = 'none';
          }
          this.setCueState(false);
        }
      });

      this.audio.addEventListener('pause', () => {
        if (this.fullPlayer) this.fullPlayer.classList.remove('is-playing');
        if (this.currentTrack) {
          this.setIcon(this.currentTrack, 'play');
          this.currentTrack.classList.add('is-paused');
        }
        if (this.iconPlay && this.iconPause) {
          this.iconPlay.style.display = 'block';
          this.iconPause.style.display = 'none';
        }
        if (this.fullIconPlay && this.fullIconPause) {
          this.fullIconPlay.style.display = 'block';
          this.fullIconPause.style.display = 'none';
        }
        if (this.heroIconPlay && this.heroIconPause) {
          this.heroIconPlay.style.display = 'block';
          this.heroIconPause.style.display = 'none';
        }
        this.setCueState(false);
      });

      this.audio.addEventListener('play', () => {
        this.startLevelLoop();
        if (this.fullPlayer) this.fullPlayer.classList.add('is-playing');
        if (this.currentTrack) {
          this.setIcon(this.currentTrack, 'pause');
          this.currentTrack.classList.remove('is-paused');
        }
        if (this.iconPlay && this.iconPause) {
          this.iconPlay.style.display = 'none';
          this.iconPause.style.display = 'block';
        }
        if (this.fullIconPlay && this.fullIconPause) {
          this.fullIconPlay.style.display = 'none';
          this.fullIconPause.style.display = 'block';
        }
        if (this.heroIconPlay && this.heroIconPause) {
          if (this.currentTrack === this.trackItems[0]) {
            this.heroIconPlay.style.display = 'none';
            this.heroIconPause.style.display = 'block';
          } else {
            this.heroIconPlay.style.display = 'block';
            this.heroIconPause.style.display = 'none';
          }
        }
        this.setCueState(true);
      });

      this.audio.addEventListener('timeupdate', () => {
        if (this.audio.duration) {
          const progress = (this.audio.currentTime / this.audio.duration) * 100;
          if (this.stickyProgress) this.stickyProgress.style.width = `${progress}%`;
          if (this.fullProgress) this.fullProgress.style.width = `${progress}%`;

          const current = this.formatTime(this.audio.currentTime);
          const total = this.formatTime(this.audio.duration);
          if (this.fullTimeCurrent) this.fullTimeCurrent.textContent = current;
          if (this.fullTimeTotal) this.fullTimeTotal.textContent = total;
          if (this.stickyTimeCurrent) this.stickyTimeCurrent.textContent = current;
          if (this.stickyTimeTotal) this.stickyTimeTotal.textContent = total;
        }
      });

      const seekFrom = (container, e) => {
        if (!this.audio.duration) return;
        const rect = container.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        this.audio.currentTime = Math.max(0, Math.min(1, percentage)) * this.audio.duration;
      };

      if (this.fullProgressContainer) {
        this.fullProgressContainer.addEventListener('click', (e) => seekFrom(this.fullProgressContainer, e));
      }
      if (this.stickyProgressContainer) {
        this.stickyProgressContainer.addEventListener('click', (e) => seekFrom(this.stickyProgressContainer, e));
      }
    }

    document.addEventListener('keydown', (e) => {
      // Zignoruj, jeśli użytkownik pisze w formularzu kontaktowym
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      // Skróty odtwarzacza działają dopiero po wybraniu utworu — wcześniej
      // spacja i strzałki muszą normalnie przewijać stronę
      if (!this.currentTrack || !this.audio) return;

      const fullPlayerOpen = this.fullPlayer && !this.fullPlayer.classList.contains('hidden');

      switch(e.key) {
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          this.initAudioContext();
          if (this.audio.paused) this.tryPlay();
          else this.audio.pause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.playNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.playPrev();
          break;
        case 'ArrowUp':
          // Głośność tylko w pełnym odtwarzaczu — na stronie strzałki przewijają
          if (!fullPlayerOpen) return;
          e.preventDefault();
          updateVolumeUI(Math.min(1, this.currentVolume + 0.1));
          break;
        case 'ArrowDown':
          if (!fullPlayerOpen) return;
          e.preventDefault();
          updateVolumeUI(Math.max(0, this.currentVolume - 0.1));
          break;
      }
    });

  }

  toggleTrack(item) {
    this.initAudioContext();
    const src = item.dataset.src;
    const title = item.dataset.title;
    const number = item.dataset.number;

    if (this.currentTrack === item) {
      // Toggle play/pause on same track
      if (this.audio.paused) {
        this.audio.play();
      } else {
        this.audio.pause();
      }
      return;
    }

    // Re-roll the background only when switching between tracks — the first
    // play keeps whatever effect was randomly chosen on page load.
    if (this.currentTrack && window.particleSystem && window.particleSystem.nextRandomMode) {
      window.particleSystem.nextRandomMode();
    }

    if (this.currentTrack) {
      this.currentTrack.classList.remove('playing');
      this.currentTrack.classList.remove('is-paused');
      this.setIcon(this.currentTrack, 'play');
    }

    this.currentTrack = item;
    item.classList.add('playing');
    item.classList.remove('is-paused');

    // Update main player info
    if (this.playerTitle) this.playerTitle.textContent = title;
    if (this.playerNumber) this.playerNumber.textContent = number;
    
    // Update sticky title and reveal it
    if (this.stickyTitle) this.stickyTitle.textContent = title;
    if (this.stickyPlayer) {
      this.stickyPlayer.classList.remove('hidden');
      document.body.classList.add('has-sticky-player');
    }
    
    // Update full player title
    if (this.fullTitle) this.fullTitle.textContent = title;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: 'Pocket Jokers',
        album: 'EP 2025',
        artwork: [
          { src: 'assets/icon.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: 'assets/album-cover.png', sizes: '512x512', type: 'image/png' }
        ]
      });
    }

    // Update meta (safe DOM manipulation — no innerHTML)
    if (this.playerMeta) {
      const duration = item.querySelector('.track-item-duration').textContent;
      this.playerMeta.textContent = '';

      const spanArtist = document.createElement('span');
      spanArtist.textContent = 'Pocket Jokers';
      const dot1 = document.createElement('span');
      dot1.className = 'meta-dot';
      dot1.textContent = '•';
      const spanAlbum = document.createElement('span');
      spanAlbum.textContent = 'EP 2025';
      const dot2 = document.createElement('span');
      dot2.className = 'meta-dot';
      dot2.textContent = '•';
      const spanDur = document.createElement('span');
      spanDur.className = 'track-duration';
      spanDur.textContent = duration;

      this.playerMeta.append(spanArtist, dot1, spanAlbum, dot2, spanDur);
    }

    // Load and play
    if (this.audio) {
      this.audio.src = src;
      this.audio.load();
      this.tryPlay();
    }
  }

  setIcon(item, type) {
    const svg = item.querySelector('.track-item-play svg');
    if (!svg) return;
    // Safe SVG manipulation — no innerHTML
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const NS = 'http://www.w3.org/2000/svg';
    if (type === 'play') {
      const poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', '5,3 19,12 5,21');
      svg.appendChild(poly);
    } else {
      const r1 = document.createElementNS(NS, 'rect');
      r1.setAttribute('x', '5'); r1.setAttribute('y', '3');
      r1.setAttribute('width', '4'); r1.setAttribute('height', '18');
      const r2 = document.createElementNS(NS, 'rect');
      r2.setAttribute('x', '15'); r2.setAttribute('y', '3');
      r2.setAttribute('width', '4'); r2.setAttribute('height', '18');
      svg.append(r1, r2);
    }
  }

  resetAllIcons() {
    this.trackItems.forEach(item => {
      this.setIcon(item, 'play');
    });
  }
}

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  window.particleSystem = new BackgroundVisualizer('particles-canvas');
  new Navbar();
  new ScrollReveal();
  new BackToTop();
  new ContactForm();
  new TrackPlayer();
});

// ── Service Worker Registration (PWA) ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(err => {
      console.warn('PWA Service Worker registration failed:', err);
    });
  });
}
