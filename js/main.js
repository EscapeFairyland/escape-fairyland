/* ============================================
   POCKET JOKERS — Minimal JavaScript
   Particles, Navigation, Scroll Reveal,
   Contact Form
   ============================================ */

// ── Particle System (subtle white dots) ──
class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.resizeCanvas();
    this.createParticles();
    this.bindEvents();
    
    this.audioAnalyzer = null;
    this.dataArray = null;
    
    this.animate();
  }

  setAnalyzer(analyzer, dataArray) {
    this.audioAnalyzer = analyzer;
    this.dataArray = dataArray;
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createParticles() {
    const count = Math.min(50, Math.floor((this.canvas.width * this.canvas.height) / 25000));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 1.2 + 0.3,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.3 + 0.05,
      });
    }
  }

  bindEvents() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.resizeCanvas();
        this.createParticles();
      }, 200);
    });
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let averageFrequency = 0;
    let bass = 0;
    if (this.audioAnalyzer && this.dataArray) {
      this.audioAnalyzer.getByteFrequencyData(this.dataArray);
      let sum = 0;
      let bassSum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
        if (i < 15) bassSum += this.dataArray[i]; // Lower bins for bass
      }
      averageFrequency = sum / this.dataArray.length;
      bass = bassSum / 15;
    }

    // More aggressive scaling based on bass and average frequency
    const bassScale = 1 + Math.pow(bass / 255, 2) * 2; 
    const speedScale = 1 + (averageFrequency / 255) * 2;
    const currentMaxDist = 100 + (bass / 255) * 200;

    for (const p of this.particles) {
      p.x += p.speedX * speedScale;
      p.y += p.speedY * speedScale;

      if (p.x < -5) p.x = this.canvas.width + 5;
      if (p.x > this.canvas.width + 5) p.x = -5;
      if (p.y < -5) p.y = this.canvas.height + 5;
      if (p.y > this.canvas.height + 5) p.y = -5;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * bassScale, 0, Math.PI * 2);
      
      // Particles keep their original opacity to avoid heavy flickering
      this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      this.ctx.fill();
    }

    // Dynamic connecting lines
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < currentMaxDist) {
          const baseOpacity = 1 - dist / currentMaxDist;
          // Lines become much brighter when music drops
          const lineOpacity = baseOpacity * (0.05 + Math.pow(bass / 255, 2) * 0.8);
          this.ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
          this.ctx.lineWidth = 0.5 + (bass / 255) * 1.5;
          this.ctx.beginPath();
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.stroke();
        }
      }
    }

    requestAnimationFrame(() => this.animate());
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
    this.hamburger.classList.toggle('active');
    this.mobileMenu.classList.toggle('open');
    document.body.style.overflow = this.mobileMenu.classList.contains('open') ? 'hidden' : '';
  }

  closeMobile() {
    this.hamburger.classList.remove('active');
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
    .then(response => response.json())
    .then(data => {
      this.form.style.display = 'none';
      const success = document.querySelector('.form-success');
      if (success) success.classList.add('show');

      // Pokaż powiadomienie że formularz wymaga aktywacji jeśli to pierwszy raz
      if (data.message && data.message.includes('activation')) {
        success.innerHTML = 'Wysłano! Sprawdź skrzynkę ' + this.form.action.split('/').pop() + ' aby jednorazowo aktywować formularz.';
      } else {
        success.innerHTML = '✓ Wiadomość wysłana. Odezwiemy się wkrótce.';
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
    
    if (this.fullPlayBtn) {
      this.fullIconPlay = this.fullPlayBtn.querySelector('.icon-play');
      this.fullIconPause = this.fullPlayBtn.querySelector('.icon-pause');
    }

    this.audioContext = null;

    this.bindEvents();
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
        
        analyzer.fftSize = 256;
        source.connect(analyzer);
        analyzer.connect(this.audioContext.destination);
        
        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
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

  bindEvents() {
    this.trackItems.forEach(item => {
      item.addEventListener('click', (e) => {
        // Prevent double-firing if the button itself is clicked
        if (e.target.closest('.track-item-play')) {
          this.toggleTrack(item);
        } else {
          this.toggleTrack(item);
        }
      });
    });

    if (this.stickyPlayBtn) {
      this.stickyPlayBtn.addEventListener('click', () => {
        if (this.audio.paused) {
          this.initAudioContext();
          this.audio.play();
        } else {
          this.audio.pause();
        }
      });
    }

    if (this.fullPlayBtn) {
      this.fullPlayBtn.addEventListener('click', () => {
        if (this.audio.paused) {
          this.initAudioContext();
          this.audio.play();
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

    this.fullVolumeSlider = document.getElementById('full-volume-slider');
    if (this.fullVolumeSlider && this.audio) {
      // Sync slider with initial volume
      this.fullVolumeSlider.value = this.audio.volume;
      this.fullVolumeSlider.addEventListener('input', (e) => {
        this.audio.volume = e.target.value;
      });
    }

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
        }
      });

      this.audio.addEventListener('pause', () => {
        if (this.fullPlayer) this.fullPlayer.classList.remove('is-playing');
        if (this.currentTrack) {
          this.setIcon(this.currentTrack, 'play');
        }
        if (this.iconPlay && this.iconPause) {
          this.iconPlay.style.display = 'block';
          this.iconPause.style.display = 'none';
        }
        if (this.fullIconPlay && this.fullIconPause) {
          this.fullIconPlay.style.display = 'block';
          this.fullIconPause.style.display = 'none';
        }
      });

      this.audio.addEventListener('play', () => {
        if (this.fullPlayer) this.fullPlayer.classList.add('is-playing');
        if (this.currentTrack) {
          this.setIcon(this.currentTrack, 'pause');
        }
        if (this.iconPlay && this.iconPause) {
          this.iconPlay.style.display = 'none';
          this.iconPause.style.display = 'block';
        }
        if (this.fullIconPlay && this.fullIconPause) {
          this.fullIconPlay.style.display = 'none';
          this.fullIconPause.style.display = 'block';
        }
      });

      this.audio.addEventListener('timeupdate', () => {
        if (this.audio.duration) {
          const progress = (this.audio.currentTime / this.audio.duration) * 100;
          if (this.stickyProgress) this.stickyProgress.style.width = `${progress}%`;
          if (this.fullProgress) this.fullProgress.style.width = `${progress}%`;
          
          if (this.fullTimeCurrent) this.fullTimeCurrent.textContent = this.formatTime(this.audio.currentTime);
          if (this.fullTimeTotal) this.fullTimeTotal.textContent = this.formatTime(this.audio.duration);
        }
      });
      
      if (this.fullProgressContainer) {
        this.fullProgressContainer.addEventListener('click', (e) => {
          if (!this.audio.duration) return;
          const rect = this.fullProgressContainer.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const percentage = clickX / rect.width;
          this.audio.currentTime = percentage * this.audio.duration;
        });
      }
    }
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

    // Switch to new track
    if (this.currentTrack) {
      this.currentTrack.classList.remove('playing');
      this.setIcon(this.currentTrack, 'play');
    }

    this.currentTrack = item;
    item.classList.add('playing');

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
      this.audio.play();
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
  window.particleSystem = new ParticleSystem('particles-canvas');
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
