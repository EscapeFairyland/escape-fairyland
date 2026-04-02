/* ============================================
   ESCAPE FAIRYLAND — Minimal JavaScript
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
    this.animate();
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

    for (const p of this.particles) {
      p.x += p.speedX;
      p.y += p.speedY;

      if (p.x < -5) p.x = this.canvas.width + 5;
      if (p.x > this.canvas.width + 5) p.x = -5;
      if (p.y < -5) p.y = this.canvas.height + 5;
      if (p.y > this.canvas.height + 5) p.y = -5;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      this.ctx.fill();
    }

    // Subtle connecting lines
    const maxDist = 120;
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const opacity = (1 - dist / maxDist) * 0.06;
          this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
          this.ctx.lineWidth = 0.5;
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
    console.log('Form submitted:', Object.fromEntries(formData));

    this.form.style.display = 'none';
    const success = document.querySelector('.form-success');
    if (success) success.classList.add('show');

    setTimeout(() => {
      this.form.style.display = 'block';
      this.form.reset();
      if (success) success.classList.remove('show');
    }, 3000);
  }
}

// ── Track Player (track list playback) ──
class TrackPlayer {
  constructor() {
    this.audio = document.getElementById('main-audio');
    this.trackItems = document.querySelectorAll('.track-item[data-src]');
    this.playerTitle = document.querySelector('.track-player-title');
    this.playerNumber = document.querySelector('.track-player-number');
    this.playerMeta = document.querySelector('.track-player-meta');
    this.currentTrack = null;

    this.bindEvents();
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

    // Update icon when audio naturally ends
    if (this.audio) {
      this.audio.addEventListener('ended', () => {
        this.resetAllIcons();
        if (this.currentTrack) {
          this.currentTrack.classList.remove('playing');
        }
        this.currentTrack = null;
      });

      this.audio.addEventListener('pause', () => {
        if (this.currentTrack) {
          this.setIcon(this.currentTrack, 'play');
        }
      });

      this.audio.addEventListener('play', () => {
        if (this.currentTrack) {
          this.setIcon(this.currentTrack, 'pause');
        }
      });
    }
  }

  toggleTrack(item) {
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

    // Update meta (safe DOM manipulation — no innerHTML)
    if (this.playerMeta) {
      const duration = item.querySelector('.track-item-duration').textContent;
      this.playerMeta.textContent = '';

      const spanArtist = document.createElement('span');
      spanArtist.textContent = 'Escape Fairyland';
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
  new ParticleSystem('particles-canvas');
  new Navbar();
  new ScrollReveal();
  new BackToTop();
  new ContactForm();
  new TrackPlayer();
});
