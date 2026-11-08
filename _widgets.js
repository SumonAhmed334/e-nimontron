/* ============================================================
   SHARED INVITATION WIDGETS Ã¢â‚¬â€ RSVP, Directions, Calendar, Share, Wishes
   Reads URL params (brideName, groomName, eventDate, eventTime,
   venueName, venueAddress, eventType) and renders interactive
   widgets inside <div id="invite-widgets" data-template-slug="..."></div>
   ============================================================ */

(function () {
  'use strict';

  // ---------- ANTI-INSPECT (preview views only) ----------
  // Block right-click + common DevTools shortcuts in BOTH the standalone
  // "Live Preview" tab (no params) AND the customize Ã¢â€ â€™ preview iframe (has
  // user data params). Published /i/{id} pages (inviteId is set) are NOT
  // affected Ã¢â‚¬â€ guests can still right-click for normal browser actions.
  // Soft deterrent Ã¢â‚¬â€ the browser menu still works.
  (function blockInspectInPreviews() {
    const params = new URLSearchParams(location.search);
    if (params.get('inviteId')) return; // skip published guest pages
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12') { e.preventDefault(); return; }
      const mod = e.ctrlKey || e.metaKey;
      const k = (e.key || '').toUpperCase();
      if (mod && e.shiftKey && (k === 'I' || k === 'J' || k === 'C')) { e.preventDefault(); return; }
      if (mod && k === 'U') { e.preventDefault(); }
    });
  })();

  // ---------- HELPERS ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // ---------- INVITE FX (exposed for templates to use) ----------
  // window.InviteFx provides reusable scroll-driven animation helpers
  // that templates can call from their own scripts.
  const InviteFx = {
    /**
     * Run callback once when target enters viewport.
     * @param {Element|string} target - element or selector
     * @param {Function} cb - called with the element when it enters view
     * @param {Object} opts - { threshold = 0.2, once = true, rootMargin = '0px' }
     */
    onView(target, cb, opts = {}) {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) return null;
      const { threshold = 0.2, once = true, rootMargin = '0px' } = opts;
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            cb(e.target, e);
            if (once) obs.unobserve(e.target);
          }
        });
      }, { threshold, rootMargin });
      obs.observe(el);
      return obs;
    },

    /**
     * Animate number from 0 (or `from`) to a target with easing.
     */
    countUp(el, to, { from = 0, duration = 1400, pad = 2, easing = 'easeOutCubic' } = {}) {
      const easings = {
        linear: (t) => t,
        easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
        easeOutQuint: (t) => 1 - Math.pow(1 - t, 5),
      };
      const ease = easings[easing] || easings.easeOutCubic;
      const start = performance.now();
      const padFn = pad ? (n) => String(Math.round(n)).padStart(pad, '0') : (n) => String(Math.round(n));
      function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        const v = from + (to - from) * ease(t);
        el.textContent = padFn(v);
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    },

    /**
     * Animate stroke-dashoffset on all <path> children of an SVG (or all
     * elements matching `selector`). Lines "draw themselves".
     */
    drawPaths(svgOrSelector, { duration = 1800, stagger = 120, selector = 'path, line, polyline' } = {}) {
      const root = typeof svgOrSelector === 'string'
        ? document.querySelector(svgOrSelector)
        : svgOrSelector;
      if (!root) return;
      const els = [...root.querySelectorAll(selector)];
      els.forEach((el, i) => {
        const len = (typeof el.getTotalLength === 'function') ? el.getTotalLength() : 400;
        el.style.strokeDasharray = len;
        el.style.strokeDashoffset = len;
        // Force reflow so transition kicks in
        void el.getBoundingClientRect();
        el.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) ${i * stagger}ms`;
        requestAnimationFrame(() => {
          el.style.strokeDashoffset = '0';
        });
      });
    },

    /**
     * Bind a scroll-progress value (0..1) to a callback as element passes
     * through viewport. Useful for parallax / scrub-driven scaling.
     * Returns a cleanup function.
     */
    scrollBind(target, cb) {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) return () => {};
      let raf = 0;
      const run = () => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // Progress: 0 when top hits bottom of viewport, 1 when bottom hits top
        const progress = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
        cb(progress, el);
      };
      const onScroll = () => {
        if (!raf) raf = requestAnimationFrame(run);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      run();
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        if (raf) cancelAnimationFrame(raf);
      };
    },

    /**
     * Fire a confetti/particle burst on a generic canvas overlay.
     * Templates that already have their own canvas should call their own
     * fireBurst() instead Ã¢â‚¬â€ this is for templates without one.
     */
    confetti({ x = innerWidth / 2, y = innerHeight / 2, count = 60, colors = ['#c9a961', '#b87b6b', '#94a584', '#e6c878'], shape = 'rect' } = {}) {
      let canvas = document.getElementById('w-fx-canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'w-fx-canvas';
        canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;';
        document.body.appendChild(canvas);
      }
      const ctx = canvas.getContext('2d');
      const resize = () => {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
      };
      resize();
      window.addEventListener('resize', resize, { passive: true });

      const particles = canvas._fxParticles ||= [];
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
        const speed = Math.random() * 12 + 5;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: 0.18,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.25,
          w: Math.random() * 8 + 4,
          h: Math.random() * 4 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          shape,
        });
      }
      if (canvas._fxRunning) return;
      canvas._fxRunning = true;
      const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.vy += p.gravity;
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vrot;
          p.alpha -= 0.008;
          if (p.alpha <= 0 || p.y > canvas.height + 30) {
            particles.splice(i, 1); continue;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          }
          ctx.restore();
        }
        if (particles.length > 0) requestAnimationFrame(tick);
        else { canvas._fxRunning = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
      };
      requestAnimationFrame(tick);
    },
  };

  // Expose globally for templates to call
  window.InviteFx = InviteFx;

  // ============================================================
  // BACKGROUND MUSIC SYSTEM
  // Per-theme tracks loaded from a CDN. Browsers block autoplay
  // until the user interacts, so the button is the explicit
  // play/pause control. To swap tracks: drop your MP3 into
  // public/music/<slug>.mp3 and update MUSIC below.
  // ============================================================
  const MUSIC_BY_SLUG = {
    'muslim-elegance':         '/music/music-1.mp3',  // unchanged
    'royal-walima':            '/music/music-2.mp3',  // unchanged
    'watercolor-purple-green': '/music/music-3.mp3',
    'blue-gold-floral':        '/music/music-4.mp3',
    'blue-watercolor':         '/music/music-4.mp3',  // shares music-4 (blue family)
    'red-cream-indian':        '/music/music-5.mp3',
    'red-pink-traditional':    '/music/music-3.mp3',  // shares music-3
    'red-pink-bodhuboron':     '/music/music-98.mp3',  // custom Bengali bia theme
    'royal-scroll':            '/music/music-5.mp3',  // shares music-5 (maroon traditional)
    'starlit-gold':            '/music/music-2.mp3',  // shares music-2 (royal evening)
    'wedding-rafiul-samiha':   '/music/music-5.mp3',  // custom royal-scroll invite
    'rgb-birthday':            '/music/birthday-music-1.mp3',
    'pink-orange-birthday':    '/music/birthday-music-2.mp3',
  };

  const Audio = {
    el: null,
    on: false,
    button: null,
    iconEl: null,
    url: '',

    iconOn:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    iconOff:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>',

    init(slug) {
      // Remove any per-template sound toggle button so we have one unified control.
      document.querySelectorAll('.sound-toggle').forEach((b) => b.remove());

      this.url = MUSIC_BY_SLUG[slug] || MUSIC_BY_SLUG['muslim-elegance'];

      // Audio element.
      this.el = document.createElement('audio');
      this.el.src = this.url;
      this.el.loop = true;
      this.el.preload = 'auto';
      this.el.volume = 0.4;
      this.el.addEventListener('error', (ev) => {
        console.warn('[InviteAudio] track failed to load:', this.url, ev);
        if (this.button) this.button.title = 'Music unavailable';
      });
      // Sync visual state from the audio element itself
      this.el.addEventListener('play',  () => this.syncVisual());
      this.el.addEventListener('pause', () => this.syncVisual());
      document.body.appendChild(this.el);

      // Button Ã¢â‚¬â€ default-on visual state
      const btn = document.createElement('button');
      btn.className = 'w-music-btn on';
      btn.id = 'w-music-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Toggle music');
      btn.title = 'Pause music';
      const iconWrap = document.createElement('span');
      iconWrap.className = 'w-music-icon';
      iconWrap.innerHTML = this.iconOn;
      btn.appendChild(iconWrap);
      const pulse = document.createElement('span');
      pulse.className = 'w-music-pulse';
      btn.appendChild(pulse);
      btn.addEventListener('click', () => this.toggle());
      document.body.appendChild(btn);
      this.button = btn;
      this.iconEl = iconWrap;

      // Intent: ON by default (the button visual reflects this). But we
      // intentionally do NOT auto-play here. Even though a returning visitor
      // has autoplay unlocked and the browser would let us play immediately,
      // that would skip the curtain reveal and feel inconsistent vs the first
      // visit. Music starts only when:
      //   1. The curtain opens (each curtain handler explicitly calls .play()), or
      //   2. The user taps the music button (.toggle()).
      this.intent = true;
      this.on = true;
      window.__inviteAudioOn = true;
      window.dispatchEvent(new CustomEvent('inviteaudio', { detail: { on: true } }));

      // Pause music while the tab is hidden (background/switched away) and
      // resume only if WE paused it Ã¢â‚¬â€ never override a manual pause. Uses the
      // Page Visibility API which fires on tab switch, minimise, and lock.
      this.__pausedByVisibility = false;
      document.addEventListener('visibilitychange', () => {
        if (!this.el) return;
        if (document.hidden) {
          if (!this.el.paused) {
            this.el.pause();
            this.__pausedByVisibility = true;
          }
        } else if (this.__pausedByVisibility) {
          this.__pausedByVisibility = false;
          // Only resume if the user still wants music on. .play() may reject
          // if the audio context got suspended Ã¢â‚¬â€ silently swallow it.
          if (this.intent) {
            const p = this.el.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          }
        }
      });

      // Belt-and-braces: explicitly stop the audio when the page is being
      // torn down (tab close, navigation away). Most browsers do this for
      // you, but mobile Safari sometimes leaks audio across pagehide.
      window.addEventListener('pagehide', () => {
        if (this.el && !this.el.paused) this.el.pause();
      });
    },

    async toggle() {
      if (!this.el) return;
      if (this.el.paused) {
        this.intent = true;
        try {
          await this.el.play();
        } catch (err) {
          console.warn('[InviteAudio] play() rejected on toggle:', err);
        }
      } else {
        this.intent = false;
        this.el.pause();
      }
      // syncVisual fires via the audio 'play'/'pause' events
    },

    syncVisual() {
      const on = !this.el.paused;
      this.setOn(on);
    },

    setOn(on) {
      this.on = on;
      window.__inviteAudioOn = on;
      if (this.button) {
        this.button.classList.toggle('on', on);
        this.button.title = on ? 'Pause music' : 'Play music';
      }
      if (this.iconEl) this.iconEl.innerHTML = on ? this.iconOn : this.iconOff;
      // Broadcast for any per-template UI ding handlers to sync their state
      window.dispatchEvent(new CustomEvent('inviteaudio', { detail: { on } }));
    },
  };

  // Expose for any template that wants to play/pause programmatically
  window.InviteAudio = Audio;

  // ============================================================
  // CURTAIN REVEAL Ã¢â‚¬â€ full-page two-panel intro animation
  // Activated by data-curtain="true" on #invite-widgets.
  // Optional: data-curtain-text="Open Invitation" to customize CTA.
  // ============================================================
  const Curtain = {
    init() {
      const root = document.getElementById('invite-widgets');
      if (!root || root.dataset.curtain !== 'true') return;

      const ctaText = root.dataset.curtainText || 'Open Invitation';
      const eyebrowText = root.dataset.curtainEyebrow || 'You Are Invited';
      const promptText = root.dataset.curtainPrompt || '';

      // Curtain panels
      const curtain = document.createElement('div');
      curtain.className = 'w-curtain';
      curtain.innerHTML = `
        <div class="w-curtain-half left"></div>
        <div class="w-curtain-half right"></div>
      `;

      // Center overlay (separate sibling so we can fade it independently)
      const center = document.createElement('div');
      center.className = 'w-curtain-center';
      const params = new URLSearchParams(location.search);
      const bride = params.get('brideName');
      const groom = params.get('groomName');
      // For the curtain, prefer the short nickname the host typed Ã¢â‚¬â€ long full
      // names break the curtain layout. Fall back to the older last/first name
      // fields (invitations saved before the form used nicknames), then to the
      // full combined name.
      const brideCurtain =
        params.get('brideNickname') ||
        params.get('brideLastName') ||
        params.get('brideFirstName') ||
        bride;
      const groomCurtain =
        params.get('groomNickname') ||
        params.get('groomLastName') ||
        params.get('groomFirstName') ||
        groom;
      // Birthdays show just the honoree's name (never "Leo & Turns 3").
      // Fall back to the template slug if `occasion` isn't on the URL so
      // birthday-only templates never render the wedding copy below.
      const slug = root && root.dataset ? (root.dataset.templateSlug || '') : '';
      const occasion =
        params.get('occasion') ||
        (slug === 'rgb-birthday' || slug === 'pink-orange-birthday'
          ? 'birthday'
          : 'wedding');
      const isBirthday = occasion === 'birthday';
      // Prefer the honoree's nickname on the curtain, same as the couple above.
      const honoree =
        params.get('honoreeNickname') ||
        params.get('honoreeName') ||
        bride;
      const couple = isBirthday
        ? (honoree || promptText || 'Welcome')
        : ((brideCurtain && groomCurtain) ? `${groomCurtain} & ${brideCurtain}` : (promptText || 'Welcome'));
      // The specific event they chose (e.g. "Wedding", "Walima", "Birthday Party").
      const eventLabel = params.get('eventType') || (isBirthday ? 'Birthday' : 'Wedding');
      center.innerHTML = `
        <div class="w-curtain-eyebrow">Ã¢â‚¬â€ ${eyebrowText} Ã¢â‚¬â€</div>
        <div class="w-curtain-prompt">${couple}</div>
        <div class="w-curtain-event">${eventLabel}</div>
        <button type="button" class="w-curtain-btn">${ctaText}</button>
      `;

      // Decorative tassel
      const tassel = document.createElement('div');
      tassel.className = 'w-curtain-tassel';

      document.body.appendChild(curtain);
      document.body.appendChild(center);
      document.body.appendChild(tassel);

      // Lock scroll while the curtain is up
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // If the name is long (a long nickname, or a full-name fallback), shrink
      // it until it fits the screen so it never overflows the curtain.
      const promptEl = center.querySelector('.w-curtain-prompt');
      const fitPrompt = () => {
        if (!promptEl || !promptEl.isConnected) return;
        promptEl.style.fontSize = '';
        const avail = center.clientWidth - 60; // 30px padding on each side
        if (avail <= 0) return;
        let size = parseFloat(getComputedStyle(promptEl).fontSize) || 72;
        let guard = 0;
        while (promptEl.scrollWidth > avail && size > 28 && guard < 40) {
          size -= 3;
          promptEl.style.fontSize = `${size}px`;
          guard++;
        }
      };
      fitPrompt();
      addEventListener('resize', fitPrompt, { passive: true });

      const open = () => {
        curtain.classList.add('opening');
        document.body.style.overflow = prevOverflow;
        // The user has just made an explicit gesture Ã¢â‚¬â€ perfect moment to
        // kick off the background music (browsers block earlier autoplay).
        // The curtain tap IS a user gesture Ã¢â‚¬â€ the one moment browsers reliably
        // allow audio-with-sound to start. Always attempt; if the src wasn't
        // preloaded yet, .load() first and try once more.
        if (window.InviteAudio && window.InviteAudio.el) {
          const a = window.InviteAudio;
          a.intent = true;
          const p = a.el.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              try { a.el.load(); a.el.play().catch(() => {}); } catch (_) {}
            });
          }
        }
        // Remove the overlay DOM after the transition completes
        setTimeout(() => {
          curtain.classList.add('closed');
          center.remove();
          tassel.remove();
        }, 1800);
      };

      center.querySelector('.w-curtain-btn').addEventListener('click', open);
    },
  };

  // Run the curtain as early as possible (before the rest of widgets render).
  // ready() defers to DOMContentLoaded so #invite-widgets is in the DOM.
  ready(() => Curtain.init());

  // Birthday-only templates Ã¢â‚¬â€ used as a defensive fallback so the shared
  // widgets never render wedding copy on a birthday template even if the
  // `occasion` URL param is missing (older invitations, hand-crafted URLs).
  const BIRTHDAY_SLUGS = new Set(['rgb-birthday', 'pink-orange-birthday']);

  // Placeholder photos for the slideshow. Real invitations pass their own via
  // ?photos=; these keep every theme's preview populated. Two sets, so a
  // birthday theme demos with a child rather than an engaged couple.
  const DEMO_PHOTOS = {
    wedding: [
      '/images/templates/_shared/demo-wedding-1.jpg',
      '/images/templates/_shared/demo-wedding-2.jpg',
      '/images/templates/_shared/demo-wedding-3.jpg',
      '/images/templates/_shared/demo-wedding-4.jpg',
    ],
    birthday: [
      '/images/templates/_shared/demo-birthday-1.jpg',
      '/images/templates/_shared/demo-birthday-2.jpg',
      '/images/templates/_shared/demo-birthday-3.jpg',
    ],
  };
  const MAX_PHOTOS = 5;

  // Whom to call on the day. Optional on a real invitation; these stand-ins
  // keep the block visible in the gallery and in /preview so every theme
  // demos it, exactly like the slideshow's placeholder photos.
  const MAX_CONTACTS = 3;
  // The numbers are masked on purpose: a stand-in that looks like a real
  // number is a number somebody eventually calls. renderContacts() leaves
  // anything undialable as plain text with the buttons switched off.
  const DEMO_CONTACTS = [
    { name: 'Tanvir Ahmed', role: "Groom's Brother", phone: '+880 1XXX XXXXXX' },
    { name: 'Farhana Akter', role: "Bride's Sister", phone: '+880 1XXX XXXXXX' },
  ];

  // The host's note to their guests. Optional on a real invitation; these
  // stand-ins keep the section on screen in the gallery and in /preview so
  // every theme demos it, exactly like the photos and the contacts above.
  const DEMO_MESSAGE = {
    wedding:
      'Your presence is the only gift we ask for. Come share our table, '
      + 'our joy, and the beginning of our life together.',
    birthday:
      'Come eat cake with us! It would not be a party without you Ã¢â‚¬â€ '
      + 'bring your biggest smile and your best dance moves.',
  };

  // Photo sources arrive as URL params, so keep them to real image URLs.
  function isSafePhotoURL(u) {
    if (!u) return false;
    try {
      const { protocol } = new URL(u, location.href);
      return protocol === 'http:' || protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  // Photos the customize form is holding for the customer, read straight out
  // of sessionStorage Ã¢â‚¬â€ this iframe is same-origin with /preview, and the
  // data-URLs are far too big to pass through the query string. Preview only:
  // a live invitation carries real Blob URLs in ?photos= instead.
  function storedPhotos() {
    try {
      const raw = sessionStorage.getItem('invitePhotos');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((u) => typeof u === 'string' && u.indexOf('data:image/') === 0)
        .slice(0, MAX_PHOTOS);
    } catch (e) {
      return [];
    }
  }

  function getParams() {
    const p = new URLSearchParams(location.search);
    const root = document.getElementById('invite-widgets');
    const slug = root && root.dataset ? (root.dataset.templateSlug || '') : '';
    const slugIsBirthday = BIRTHDAY_SLUGS.has(slug);
    // Prefer the URL param; fall back to whatever the template slug implies.
    const occasion = p.get('occasion') || (slugIsBirthday ? 'birthday' : 'wedding');
    const isBirthday = occasion === 'birthday';
    const brideName = p.get('brideName') || (isBirthday ? '' : 'The Bride');
    const groomName = p.get('groomName') || (isBirthday ? '' : 'The Groom');
    const honoree = p.get('honoreeName') || brideName;
    const age = p.get('age') || '';
    const eventType = p.get('eventType') || (isBirthday ? 'Birthday' : 'Wedding');

    // Slideshow photos Ã¢â‚¬â€ ?photos=<url>,<url>... or photo1...photo5.
    const listed = (p.get('photos') || '').split(',');
    const numbered = Array.from({ length: MAX_PHOTOS }, (_, i) => p.get('photo' + (i + 1)) || '');
    const given = (listed.some((u) => u.trim()) ? listed : numbered)
      .map((u) => u.trim())
      .filter(isSafePhotoURL)
      .slice(0, MAX_PHOTOS);

    // A live invitation (/i/{id}) always carries inviteId; the gallery and
    // /preview never do. So a real invitation shows only the photos it was
    // published with Ã¢â‚¬â€ guests never see stand-in stock photos, and the
    // invitations ordered before this feature existed carry none, leaving
    // them exactly as they were. In preview we show the customer's own
    // photos if they picked any, else the demo set, so the slideshow always
    // turns up on every theme in the gallery.
    // A published invitation always carries inviteId. The admin's preview does
    // not Ã¢â‚¬â€ it opens the template with the order's own data so the owner can
    // check it before publishing Ã¢â‚¬â€ so it used to fall back to the stock photos,
    // sample contacts and sample message, and showed a gallery the customer
    // never ordered. `orderPreview=1` says "these are a real order's fields",
    // which keeps every fallback off without making RSVPs post to the server.
    const isLiveInvitation = !!p.get('inviteId') || p.get('orderPreview') === '1';
    const demo = isBirthday
      ? DEMO_PHOTOS.birthday
      : (slug === 'starlit-gold'
          ? [
              '/images/templates/starlit-gold/moment-1.webp',
              '/images/templates/starlit-gold/moment-2.webp',
              '/images/templates/starlit-gold/moment-3.webp',
              '/images/templates/starlit-gold/moment-4.webp',
            ]
          : DEMO_PHOTOS.wedding);
    const stashed = isLiveInvitation ? [] : storedPhotos();
    const fallback = isLiveInvitation ? [] : (stashed.length ? stashed : demo);
    const photos = given.length ? given : fallback;

    // Whom guests can call Ã¢â‚¬â€ contact1Name/contact1Phone, contact2Ã¢â‚¬Â¦, contact3Ã¢â‚¬Â¦
    // All optional: a live invitation shows only the ones it was published
    // with, while the gallery and /preview fall back to the samples.
    const named = [];
    for (let i = 1; i <= MAX_CONTACTS; i++) {
      const name = (p.get(`contact${i}Name`) || '').trim();
      const phone = (p.get(`contact${i}Phone`) || '').trim();
      const role = (p.get(`contact${i}Role`) || '').trim();
      if (name || phone) named.push({ name, role, phone });
    }
    const contacts = named.length ? named : (isLiveInvitation ? [] : DEMO_CONTACTS);

    // Same rule once more for the host's message: a published invitation shows
    // only what its host actually wrote, so leaving the field blank means the
    // section never appears for their guests.
    const written = (p.get('personalMessage') || '').trim();
    const personalMessage = written
      || (isLiveInvitation ? '' : (isBirthday ? DEMO_MESSAGE.birthday : DEMO_MESSAGE.wedding));

    // Occasion-aware display strings used by share / calendar / ICS so a
    // birthday never reads "Leo & Turns 3".
    const who = isBirthday ? honoree : `${groomName} & ${brideName}`;
    const eventTitle = isBirthday
      ? `${honoree}'s ${eventType}`
      : `${groomName} & ${brideName} ${eventType}`;
    const eventDesc = isBirthday
      ? `You're invited to ${honoree}'s ${eventType.toLowerCase()}${age ? ` Ã¢â‚¬â€ turning ${age}!` : '!'}`
      : `You're invited to the ${eventType.toLowerCase()} of ${groomName} & ${brideName}.`;

    return {
      brideName,
      groomName,
      honoree,
      age,
      occasion,
      isBirthday,
      who,
      eventTitle,
      eventDesc,
      eventDate: p.get('eventDate') || '2026-11-27',
      eventTime: p.get('eventTime') || '19:00',
      eventType,
      venueName: p.get('venueName') || 'Meritage Dhaka',
      venueAddress: p.get('venueAddress') || 'Gawsia Twin Pick, (Lift 7), 42 and 43 Satmasjid Road, Dhanmondi 9/A Dhaka 1209, Dhaka, Bangladesh, 1209',
      rsvpDeadline: p.get('rsvpDeadline') || '',
      personalMessage,
      photos,
      contacts,
    };
  }

  // "+880 1712-345678" Ã¢â€ â€™ "+8801712345678" for a tel: link.
  function telHref(s) {
    return String(s).replace(/[^\d+]/g, '');
  }

  // wa.me wants bare digits with the country code. A local Bangladeshi mobile
  // is written 01XXXXXXXXX, so that leading 0 becomes 880 Ã¢â‚¬â€ anything else is
  // left as the host typed it, since we cannot guess another country's trunk.
  function waNumber(s) {
    let d = String(s).replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    else if (/^01\d{9}$/.test(d)) d = '880' + d.slice(1);
    return d;
  }

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg) {
    let toast = $('.w-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'w-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // ---------- ICONS ----------
  const ICONS = {
    rsvp: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    directions: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    googlemaps: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    uber: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13H7v-6h10v6z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2z"/></svg>',
    share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    close: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    photo: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    google: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M22.5 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.32z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.47 1.18 4.96l3.66-2.87z"/><path d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>',
    apple: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.05 12.04c-.03-3.16 2.58-4.69 2.7-4.76-1.47-2.15-3.76-2.45-4.58-2.48-1.94-.2-3.79 1.15-4.78 1.15-.99 0-2.51-1.12-4.13-1.09-2.12.03-4.08 1.24-5.17 3.13-2.21 3.83-.56 9.49 1.59 12.6 1.05 1.52 2.3 3.23 3.93 3.17 1.58-.06 2.18-1.02 4.09-1.02 1.91 0 2.45 1.02 4.13.99 1.71-.03 2.79-1.55 3.83-3.08 1.21-1.77 1.7-3.49 1.73-3.58-.04-.02-3.32-1.27-3.34-5.03zM14.6 3.78c.87-1.06 1.46-2.53 1.3-4-1.25.05-2.77.83-3.67 1.89-.81.94-1.52 2.43-1.33 3.87 1.4.11 2.83-.71 3.7-1.76z"/></svg>',
    outlook: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="1"/><polyline points="3 8 9.5 13 16 8"/><path d="M16 9l5 3-5 3"/></svg>',
    yahoo: '<svg viewBox="0 0 24 24"><polyline points="3 5 8 5 11 12 14 5 19 5"/><line x1="11" y1="12" x2="11" y2="19"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.4-.1-.6.1s-.7.9-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4 0-.2 0-.3 0-.4 0-.1-.6-1.4-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.1-.3-.1-.6-.3z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.7.5 3.4 1.3 4.8L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3C4.1 14.7 3.7 13.4 3.7 12c0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3-3.7 8.3-8.3 8.3z"/></svg>',
    email: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 6 12 13 22 6"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>',
  };

  // ---------- DATE / ICS ----------
  function pad(n) { return String(n).padStart(2, '0'); }

  function formatICSDate(date) {
    return (
      date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      'T' +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      'Z'
    );
  }

  function buildICS(p) {
    const start = new Date(`${p.eventDate}T${p.eventTime}:00`);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // +4h
    const uid = `${p.who}-${p.eventDate}@enimontron`.replace(/\s+/g, '');
    const summary = p.eventTitle;
    const description = p.eventDesc;
    const location = `${p.venueName}${p.venueAddress ? ', ' + p.venueAddress : ''}`;

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//e-Nimontron//Invitation//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  function googleCalendarURL(p) {
    const start = new Date(`${p.eventDate}T${p.eventTime}:00`);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const fmt = d => formatICSDate(d).replace(/Z$/, 'Z');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: p.eventTitle,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: p.eventDesc,
      location: `${p.venueName}${p.venueAddress ? ', ' + p.venueAddress : ''}`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function yahooCalendarURL(p) {
    const start = new Date(`${p.eventDate}T${p.eventTime}:00`);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      v: '60',
      title: p.eventTitle,
      st: formatICSDate(start),
      et: formatICSDate(end),
      desc: p.eventDesc,
      in_loc: `${p.venueName}${p.venueAddress ? ', ' + p.venueAddress : ''}`,
    });
    return `https://calendar.yahoo.com/?${params.toString()}`;
  }

  function downloadICS(p) {
    const ics = buildICS(p);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.who}-invitation.ics`.replace(/\s+/g, '-');
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  }

  // ---------- DIRECTIONS ----------
  function googleMapsURL(p) {
    const dest = encodeURIComponent(`${p.venueName}, ${p.venueAddress}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  }
  function openDirections(p) {
    window.open(googleMapsURL(p), '_blank', 'noopener');
  }
  /**
   * Uber universal link Ã¢â‚¬â€ opens the app if installed, web flow if not.
   * Docs: https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links
   *   action=setPickup with pickup=my_location uses the guest's current GPS
   *   dropoff[formatted_address] is the venue's full address (URL-encoded)
   *   dropoff[nickname] is the venue's display name (shows in the app)
   */
  function uberURL(p) {
    const params = new URLSearchParams({
      action: 'setPickup',
      pickup: 'my_location',
      'dropoff[formatted_address]': `${p.venueName}, ${p.venueAddress}`,
      'dropoff[nickname]': p.venueName,
    });
    return `https://m.uber.com/ul/?${params.toString()}`;
  }
  function openUber(p) {
    window.open(uberURL(p), '_blank', 'noopener');
  }

  // ---------- SHARE ----------
  function buildShareText(p) {
    return `You're invited to ${p.who}'s ${p.eventType} Ã¢â‚¬â€ ${formatPrettyDate(p)}.`;
  }
  function formatPrettyDate(p) {
    const dt = new Date(`${p.eventDate}T${p.eventTime}`);
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
  }
  function formatDeadline(iso) {
    if (!iso) return '';
    const dt = new Date(`${iso}T00:00:00`);
    if (isNaN(dt.getTime())) return '';
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  }

  async function tryNativeShare(p) {
    if (!navigator.share) return false;
    try {
      await navigator.share({
        title: `${p.who} Ã¢â‚¬â€ ${p.eventType}`,
        text: buildShareText(p),
        url: location.href,
      });
      return true;
    } catch {
      return false;
    }
  }

  function shareWhatsApp(p) {
    const txt = encodeURIComponent(`${buildShareText(p)} ${location.href}`);
    window.open(`https://wa.me/?text=${txt}`, '_blank', 'noopener');
  }
  function shareEmail(p) {
    const subject = encodeURIComponent(`${p.who} Ã¢â‚¬â€ ${p.eventType} Invitation`);
    const body = encodeURIComponent(`${buildShareText(p)}\n\nView the invitation: ${location.href}`);
    location.href = `mailto:?subject=${subject}&body=${body}`;
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast('Link Copied');
    } catch {
      showToast('Could not copy');
    }
  }

  // ---------- SERVER MODE ----------
  // When the invitation has been published it is opened at /i/{id}, which loads
  // this template inside an iframe with ?inviteId={id}. In that case RSVPs and
  // wishes are saved to the server (so the host's dashboard can see them).
  // Without an inviteId (live preview / demo) we keep using localStorage so
  // nothing breaks for unpublished invitations.
  const INVITE_ID = new URLSearchParams(location.search).get('inviteId');

  const Server = {
    id: INVITE_ID,
    async submitRSVP(data) {
      const res = await fetch(`/api/invitations/${INVITE_ID}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          attending: data.attending,
          guests: data.guests,
          message: data.message || '',
        }),
      });
      if (!res.ok) throw new Error('rsvp failed');
      return res.json();
    },
    async submitWish(wish) {
      const res = await fetch(`/api/invitations/${INVITE_ID}/wishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: wish.name,
          message: wish.message,
          photo: wish.photo || null,
        }),
      });
      if (!res.ok) throw new Error('wish failed');
      return res.json();
    },
    async fetchWishes() {
      const res = await fetch(`/api/invitations/${INVITE_ID}/wishes`, { cache: 'no-store' });
      if (!res.ok) throw new Error('load failed');
      const j = await res.json();
      return Array.isArray(j.wishes) ? j.wishes : [];
    },
  };
  // Exposed so per-template custom forms (e.g. muslim-elegance) can reuse it.
  window.InviteServer = Server;

  // ---------- RSVP STORAGE ----------
  function rsvpKey(slug) { return `inv:rsvp:${slug || 'default'}`; }

  function saveRSVP(slug, data) {
    const all = JSON.parse(localStorage.getItem(rsvpKey(slug)) || '[]');
    all.push({ ...data, ts: Date.now() });
    localStorage.setItem(rsvpKey(slug), JSON.stringify(all));
  }

  // ---------- WISHES STORAGE ----------
  function wishesKey(slug) { return `inv:wishes:${slug || 'default'}`; }

  function loadWishes(slug) {
    try {
      return JSON.parse(localStorage.getItem(wishesKey(slug)) || '[]');
    } catch { return []; }
  }

  function saveWish(slug, wish) {
    const all = loadWishes(slug);
    all.push({ ...wish, ts: Date.now() });
    // cap at 50 to avoid blowing localStorage with images
    while (all.length > 50) all.shift();
    localStorage.setItem(wishesKey(slug), JSON.stringify(all));
  }

  function relativeTime(ts) {
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  // ---------- VENUE DETAILS ----------
  function renderVenue(root, p) {
    const venue = document.createElement('div');
    venue.className = 'w-venue';
    venue.innerHTML = `
      <div class="w-venue-name">${escapeHTML(p.venueName)}</div>
      <div class="w-venue-address">${escapeHTML(p.venueAddress)}</div>
    `;
    root.appendChild(venue);
    return venue;
  }

  // ---------- RENDERERS ----------
  function renderActionBar(root, p) {
    const bar = document.createElement('div');
    bar.className = 'w-actions';
    bar.innerHTML = `
      <a class="w-btn w-map-link" href="${googleMapsURL(p)}" target="_blank" rel="noopener noreferrer" aria-label="Open venue in Google Maps">
        ${ICONS.directions}<span class="w-btn-label">Google Maps</span>
      </a>
    `;
    root.appendChild(bar);
    return bar;
  }

  function renderRSVP(root, p) {
    const section = document.createElement('div');
    section.className = 'w-rsvp';
    const deadline = formatDeadline(p.rsvpDeadline);
    section.innerHTML = `
      <div class="w-heading">
        <div class="w-heading-script">Kindly RSVP</div>
        <div class="w-heading-sub">${deadline ? 'Please reply by ' + deadline : 'We hope you can celebrate with us'}</div>
      </div>
      <div class="w-rsvp-card">
        <form id="w-rsvp-form" novalidate>
          <div class="w-field">
            <label for="w-rsvp-name">Your Name</label>
            <input type="text" id="w-rsvp-name" name="name" required placeholder="As it appears on your invitation" />
          </div>

          <div class="w-field">
            <label>Will you attend?</label>
            <div class="w-radio-row">
              <label class="w-radio">
                <input type="radio" name="attending" value="yes" required checked />
                <span>Joyfully</span>
              </label>
              <label class="w-radio">
                <input type="radio" name="attending" value="no" />
                <span>Sadly No</span>
              </label>
            </div>
          </div>

          <div class="w-field">
            <label for="w-rsvp-guests">Number of Guests (0Ã¢â‚¬â€œ10)</label>
            <input type="number" id="w-rsvp-guests" name="guests" min="0" max="10" value="0" />
          </div>

          <button type="submit" class="w-submit">Send RSVP</button>
        </form>

        <div class="w-success" id="w-rsvp-success">
          <div class="w-success-circle">${ICONS.check}</div>
          <div class="w-success-title">Thank you!</div>
          <div class="w-success-msg">Your RSVP has been received. We can't wait to celebrate with you.</div>
        </div>
      </div>
    `;
    root.appendChild(section);
    return section;
  }

  function renderWishes(root, slug) {
    const section = document.createElement('div');
    section.className = 'w-wishes';
    section.innerHTML = `
      <div class="w-heading">
        <div class="w-heading-script">Send Your Wishes</div>
        <div class="w-heading-sub">Leave a Private Message</div>
      </div>

      <form class="w-wish-form" id="w-wish-form" novalidate>
        <div class="w-wish-form-title">Send your wish</div>
        <div class="w-wish-form-sub">Your message stays private Ã¢â‚¬â€ it won't be shown here publicly</div>
        <div class="w-field">
          <label for="w-wish-name">Your Name</label>
          <input type="text" id="w-wish-name" name="name" required placeholder="From..." />
        </div>
        <div class="w-field">
          <label for="w-wish-msg">Your Message</label>
          <textarea id="w-wish-msg" name="message" required placeholder="A blessing, a memory, a wish..."></textarea>
        </div>
        <div class="w-field">
          <label class="w-photo-upload" for="w-wish-photo">
            ${ICONS.photo}
            <span>Add a Photo (optional)</span>
            <input type="file" id="w-wish-photo" accept="image/*" />
          </label>
          <div class="w-photo-preview" id="w-photo-preview">
            <img alt="Selected photo" />
            <button type="button" class="w-photo-remove" aria-label="Remove photo">Ãƒâ€”</button>
          </div>
        </div>
        <button type="submit" class="w-submit">Add Your Wish</button>
      </form>

      <div class="w-success" id="w-wish-success">
        <div class="w-success-circle">${ICONS.check}</div>
        <div class="w-success-title">Thank you!</div>
        <div class="w-success-msg">Your wish has been sent.</div>
      </div>
    `;
    root.appendChild(section);
    return section;
  }

  async function renderWishList(slug) {
    const listEl = $('#w-wishes-list');
    if (!listEl) return;
    let wishes;
    if (INVITE_ID) {
      try {
        wishes = (await Server.fetchWishes()).slice().reverse();
      } catch {
        wishes = [];
      }
    } else {
      wishes = loadWishes(slug).slice().reverse();
    }
    if (wishes.length === 0) {
      listEl.innerHTML = `<div class="w-wish-empty">No blessings yet Ã¢â‚¬â€ be the first Ã¢Å“Â¦</div>`;
      return;
    }
    listEl.innerHTML = wishes
      .map(w => {
        const photo = w.photo
          ? `<div class="w-wish-photo"><img src="${w.photo}" alt="From ${escapeHTML(w.name)}" /></div>`
          : '';
        return `
          <article class="w-wish-item">
            <div class="w-wish-header">
              <div class="w-wish-name">${escapeHTML(w.name)}</div>
              <div class="w-wish-time">${relativeTime(w.ts)}</div>
            </div>
            <div class="w-wish-message">${escapeHTML(w.message)}</div>
            ${photo}
          </article>
        `;
      })
      .join('');
  }

  // ---------- IMAGE COMPRESSION (so localStorage can hold a few photos) ----------
  function readAndCompressImage(file, maxDim = 1024, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('image load failed'));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- WIRE EVENTS ----------
  function wireDropdowns(root) {
    $$('.w-dropdown', root).forEach(dd => {
      const btn = $('button', dd);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // close all others
        $$('.w-dropdown').forEach(other => {
          if (other !== dd) other.classList.remove('open');
        });
        dd.classList.toggle('open');
      });
    });
    document.addEventListener('click', () => {
      $$('.w-dropdown').forEach(dd => dd.classList.remove('open'));
    });
  }

  function wireRSVP(section, slug) {
    const form = $('#w-rsvp-form', section);
    const success = $('#w-rsvp-success', section);
    const guests = $('#w-rsvp-guests', section);

    // Hard cap guests at 0Ã¢â‚¬â€œ10 (the form is novalidate, so enforce it ourselves)
    const clampGuests = () => {
      let v = parseInt(guests.value, 10);
      if (isNaN(v)) v = 0;
      guests.value = Math.max(0, Math.min(10, v));
    };
    if (guests) {
      guests.addEventListener('change', clampGuests);
      guests.addEventListener('blur', clampGuests);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.name || !data.name.trim()) {
        $('#w-rsvp-name', form).focus();
        return;
      }
      let g = parseInt(data.guests, 10);
      data.guests = isNaN(g) ? 0 : Math.max(0, Math.min(10, g));

      // Joyfully Accept must include at least 1 guest. Declines/maybe can be 0.
      if (data.attending === 'yes' && data.guests < 1) {
        showToast('Please enter at least 1 guest');
        $('#w-rsvp-guests', form).focus();
        return;
      }

      const submitBtn = $('.w-submit', form);
      if (INVITE_ID) {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'SendingÃ¢â‚¬Â¦'; }
        try {
          await Server.submitRSVP(data);
        } catch {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send RSVP'; }
          showToast('Could not send Ã¢â‚¬â€ please try again');
          return;
        }
      } else {
        saveRSVP(slug, data);
      }
      form.style.display = 'none';
      success.classList.add('show');
    });
  }

  function wireDirections(root, p) {
    const g = $('#w-dir-google');
    const u = $('#w-dir-uber');
    if (g) g.href = googleMapsURL(p);
    if (u) u.href = uberURL(p);
  }

  function wireCalendar(root, p) {
    $('#w-cal-google').href = googleCalendarURL(p);
    $('#w-cal-yahoo').href = yahooCalendarURL(p);
    $('#w-cal-ics').addEventListener('click', (e) => {
      e.preventDefault();
      downloadICS(p);
    });
    $('#w-cal-outlook').addEventListener('click', (e) => {
      e.preventDefault();
      downloadICS(p); // .ics works for Outlook desktop / web import
    });
  }

  function wireShare(root, p) {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-share]');
      if (!btn) return;
      const kind = btn.dataset.share;
      if (kind === 'whatsapp') shareWhatsApp(p);
      else if (kind === 'email') shareEmail(p);
      else if (kind === 'copy') await copyLink();
      // close dropdown
      $$('.w-dropdown').forEach(dd => dd.classList.remove('open'));
    });
    // (The Share button itself toggles the .w-dropdown open/close via the
    //  generic dropdown handler; no extra hookup needed here.)
  }

  function wireWishes(root, slug) {
    const form = $('#w-wish-form', root);
    const photoInput = $('#w-wish-photo', root);
    const photoPreview = $('#w-photo-preview', root);
    const photoImg = photoPreview.querySelector('img');
    const photoRemove = photoPreview.querySelector('.w-photo-remove');

    let pendingPhoto = null;

    photoInput.addEventListener('change', async () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      try {
        pendingPhoto = await readAndCompressImage(file);
        photoImg.src = pendingPhoto;
        photoPreview.classList.add('show');
      } catch {
        showToast('Could not read image');
      }
    });

    photoRemove.addEventListener('click', () => {
      pendingPhoto = null;
      photoInput.value = '';
      photoImg.src = '';
      photoPreview.classList.remove('show');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      const message = String(fd.get('message') || '').trim();
      if (!name || !message) return;

      const wish = { name, message, photo: pendingPhoto || null };
      const submitBtn = $('.w-submit', form);
      if (INVITE_ID) {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'SendingÃ¢â‚¬Â¦'; }
        try {
          await Server.submitWish(wish);
        } catch {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Add Your Wish'; }
          showToast('Could not send Ã¢â‚¬â€ please try again');
          return;
        }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Add Your Wish'; }
      } else {
        saveWish(slug, wish);
      }
      // Success Ã¢â‚¬â€ hide the form and show a thank-you. Guests never see the list
      // of wishes; only the host does, on their private dashboard.
      form.reset();
      pendingPhoto = null;
      photoImg.src = '';
      photoPreview.classList.remove('show');
      form.style.display = 'none';
      const wishSuccess = $('#w-wish-success', root);
      if (wishSuccess) wishSuccess.classList.add('show');
      showToast('Wish Sent Ã¢Å“Â¦');
    });
  }

  // ---------- PHOTO SLIDESHOW ----------
  // A deck of photos that sits just above the "Join Us" block. Every theme
  // shows it in the gallery and in /preview, so the feature sells itself.
  //
  // A LIVE invitation only gets it if that invitation actually has photos Ã¢â‚¬â€
  // see getParams(). Invitations ordered before this feature existed have
  // none saved, so their guest pages are unchanged.
  //
  // A theme can drop the deck with data-slideshow="off" on #invite-widgets,
  // or move it by putting <div id="w-slideshow-mount"></div> where it wants
  // it. Photos come from ?photos=<url>,<url>... or photo1...photo5.
  function renderSlideshow(root, p) {
    if (root.dataset.slideshow === 'off') return;
    const photos = p.photos;
    if (!photos.length) return;
    const target = document.getElementById('w-slideshow-mount') || root;

    const title = root.dataset.slideshowHeading || (p.isBirthday ? 'Sweet Moments' : 'Our Moments');
    const sub = root.dataset.slideshowSub || (p.isBirthday ? 'A Few Favourites' : 'Captured Together');

    const sec = document.createElement('section');
    sec.className = 'w-ss';
    sec.innerHTML = `
      <div class="w-heading">
        <div class="w-heading-script">${escapeHTML(title)}</div>
        <div class="w-heading-sub">${escapeHTML(sub)}</div>
      </div>
      <div class="w-ss-stage" tabindex="0" role="group" aria-roledescription="carousel" aria-label="Photo slideshow">
        <div class="w-ss-deck">
${photos.map((src, i) => `          <figure class="w-ss-slide">
            <img src="${escapeHTML(src)}" alt="Photo ${i + 1} of ${photos.length}" loading="${i === 0 ? 'eager' : 'lazy'}" draggable="false">
          </figure>`).join('\n')}
          <div class="w-ss-count"><span class="w-ss-i">1</span>&thinsp;/&thinsp;${photos.length}</div>
        </div>
        <button class="w-ss-nav prev" type="button" aria-label="Previous photo">${ICONS.chevronLeft}</button>
        <button class="w-ss-nav next" type="button" aria-label="Next photo">${ICONS.chevronRight}</button>
      </div>
      <div class="w-ss-dots">
${photos.map((_, i) => `        <button class="w-ss-dot" type="button" aria-label="Photo ${i + 1}"></button>`).join('\n')}
      </div>
    `;
    target.appendChild(sec);

    const slides = $$('.w-ss-slide', sec);
    const dots = $$('.w-ss-dot', sec);
    const counter = $('.w-ss-i', sec);
    const stage = $('.w-ss-stage', sec);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) sec.classList.add('w-ss-static');
    // A single photo has nothing to page through Ã¢â‚¬â€ drop the arrows, dots
    // and counter and leave just the framed picture.
    if (slides.length < 2) sec.classList.add('w-ss-solo');

    let idx = 0;
    let timer = null;
    let inView = false;

    // The photos sit in a deck: the one being shown is in front, the one
    // before and the one after peek out either side, scaled back and faded.
    // Everything else waits behind the front card until its turn comes round.
    function show(n) {
      const total = slides.length;
      idx = (n + total) % total;
      const nextIdx = (idx + 1) % total;
      const prevIdx = (idx - 1 + total) % total;
      slides.forEach((s, i) => {
        const on = i === idx;
        // With only two photos the other one is both previous and next; show
        // it on the right, since that is the way the deck is travelling.
        s.classList.toggle('is-active', on);
        s.classList.toggle('is-next', !on && i === nextIdx);
        s.classList.toggle('is-prev', !on && i !== nextIdx && i === prevIdx);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
      if (counter) counter.textContent = String(idx + 1);
    }
    const next = () => show(idx + 1);
    const prev = () => show(idx - 1);

    function start() {
      if (timer || reduce || slides.length < 2 || !inView || document.hidden) return;
      timer = setInterval(next, 4500);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    // Re-arm the timer after a manual move so the photo just picked gets a
    // full turn on screen instead of flipping a moment later.
    function bump(fn) {
      return () => { stop(); fn(); start(); };
    }

    show(0);

    $('.w-ss-nav.next', sec).addEventListener('click', bump(next));
    $('.w-ss-nav.prev', sec).addEventListener('click', bump(prev));
    dots.forEach((d, i) => d.addEventListener('click', bump(() => show(i))));
    // The two half-visible cards are the obvious thing to reach for next.
    slides.forEach((s, i) => s.addEventListener('click', bump(() => show(i))));

    stage.addEventListener('mouseenter', stop);
    stage.addEventListener('mouseleave', start);
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); bump(next)(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); bump(prev)(); }
    });

    // Swipe on touch Ã¢â‚¬â€ only when the gesture is clearly horizontal, so
    // scrolling the invitation past the deck still works.
    let x0 = null, y0 = null;
    stage.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      x0 = t.clientX; y0 = t.clientY;
      stop();
    }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
      x0 = y0 = null;
      start();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          inView = en.isIntersecting;
          if (inView) start(); else stop();
        });
      }, { threshold: 0.25 }).observe(sec);
    } else {
      inView = true;
      start();
    }

    // The widget brings its own entrance reveal: each theme's .reveal observer
    // has already collected its elements by the time this runs, so a .reveal
    // class added here would never be switched on. The hidden start state is
    // only applied when we know something can switch it back on, so the photos
    // can never be left invisible.
    if ('IntersectionObserver' in window) {
      sec.classList.add('w-ss-anim');
      InviteFx.onView(sec, (el) => el.classList.add('in'), { threshold: 0.15 });
    }
  }

  // ---------- SCRATCH-TO-REVEAL CARD ----------
  // Themes opt in with data-scratch="on" on #invite-widgets. The card reveals
  // the day/date and time when the user scratches a gold-foil canvas overlay.
  function renderScratchCard(root, p) {
    if (root.dataset.scratch !== 'on') return;
    if (!p.eventDate) return;
    // If the template provides a mount point (#w-scratch-mount) we render
    // there so it sits in the desired position (e.g. above the venue). Falls
    // back to #invite-widgets for templates that don't specify a position.
    const target = document.getElementById('w-scratch-mount') || root;
    const dt = new Date(`${p.eventDate}T${p.eventTime || '19:00'}:00`);
    if (isNaN(dt.getTime())) return;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = p.dayOfWeek || days[dt.getDay()];
    const dateStr = `${dayName}, ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    const [hh, mm] = (p.eventTime || '19:00').split(':');
    const h12 = ((parseInt(hh, 10) + 11) % 12) + 1;
    const ap = parseInt(hh, 10) >= 12 ? 'PM' : 'AM';
    const timeStr = `${h12}:${mm} ${ap}`;

    const sec = document.createElement('div');
    sec.className = 'w-scratch-section';
    sec.innerHTML = `
      <div class="w-heading">
        <div class="w-heading-script">Save The Date</div>
        <div class="w-heading-sub">Scratch to Reveal</div>
      </div>
      <div class="w-scratch-wrap">
        <div class="w-scratch-content">
          <div class="w-scratch-date">${escapeHTML(dateStr)}</div>
          <div class="w-scratch-time">${escapeHTML(timeStr)} onwards</div>
        </div>
        <canvas class="w-scratch-canvas"></canvas>
      </div>
    `;
    target.appendChild(sec);

    const wrap = sec.querySelector('.w-scratch-wrap');
    const canvas = sec.querySelector('.w-scratch-canvas');
    const ctx = canvas.getContext('2d');
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let revealed = false, drawing = false, moveCount = 0;

    function paint(w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#b8923f');
      g.addColorStop(0.25, '#e6c878');
      g.addColorStop(0.5, '#c9a961');
      g.addColorStop(0.75, '#f0d79a');
      g.addColorStop(1, '#8b7028');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255, 252, 240, 0.4)';
      for (let i = 0; i < 46; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(40, 30, 8, 0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 12px Cinzel, serif';
      const label = 'SCRATCH TO REVEAL';
      ctx.font = '600 12px Cinzel, serif';
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, w / 2, h / 2);
      ctx.fillStyle = '#b3203a';
      ctx.font = '16px serif';
      ctx.fillText('\u2665', w / 2 - tw / 2 - 22, h / 2);
      ctx.fillText('\u2665', w / 2 + tw / 2 + 22, h / 2);
    }
    function size() {
      const r = wrap.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(r.width, r.height);
    }
    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function scratchAt(x, y) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    function clearedRatio() {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let clear = 0, total = 0;
      for (let i = 3; i < img.length; i += 4 * 50) {
        total++;
        if (img[i] === 0) clear++;
      }
      return total ? clear / total : 0;
    }
    function reveal() {
      revealed = true;
      wrap.classList.add('revealed');
      canvas.classList.add('revealed');
      const r = wrap.getBoundingClientRect();
      if (window.InviteFx && typeof window.InviteFx.confetti === 'function') {
        window.InviteFx.confetti({
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          count: 120,
          colors: ['#c9a961', '#e6c878', '#8b7028', '#1d4a37', '#b87b6b'],
          shape: 'rect',
        });
      }
    }
    function maybeReveal() {
      if (!revealed && clearedRatio() > 0.70) reveal();
    }
    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      const { x, y } = pos(e);
      scratchAt(x, y);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const { x, y } = pos(e);
      scratchAt(x, y);
      if ((++moveCount % 6) === 0) maybeReveal();
    });
    const stop = () => { if (drawing) { drawing = false; maybeReveal(); } };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointerleave', stop);
    size();
    window.addEventListener('resize', () => { if (!revealed) size(); });
  }

  // ---------- PREVIEW WATERMARK ----------
  // Diagonal "e-Nimontron" watermark Ã¢â‚¬â€ shown on EVERY preview view (the
  // standalone Live Preview tab from the gallery AND the customize-preview
  // iframe). Only published invitations at /i/{id} (INVITE_ID set) stay
  // clean for the actual guests.
  function renderPreviewWatermark() {
    if (INVITE_ID) return;
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'pointer-events:none',
      'user-select:none',
      '-webkit-user-select:none',
      'overflow:hidden',
      'z-index:99999',
    ].join(';');
    const text = document.createElement('span');
    text.textContent = 'e-Nimontron';
    text.style.cssText = [
      'transform:rotate(-22deg)',
      "font-family:'Cinzel',serif",
      'font-size:clamp(38px,8vw,80px)',
      'letter-spacing:0.32em',
      'font-weight:600',
      'color:#0f3024',
      'opacity:0.12',
      'text-transform:uppercase',
      'white-space:nowrap',
    ].join(';');
    wrap.appendChild(text);
    document.body.appendChild(wrap);
  }

  // ---------- PERSONAL MESSAGE ----------
  // The host's "A Personal Message to Your Guests" (personalMessage param) Ã¢â‚¬â€
  // its own section, directly above the RSVP, so a guest reads why they are
  // being asked before being asked. Optional: a published invitation whose
  // host left the field blank has no section at all. A theme can drop it with
  // data-message="off", retitle it with data-message-heading / -sub, or move it
  // by placing <div id="w-message-mount"></div> where it wants it.
  function renderMessage(root, p) {
    if (!p.personalMessage || root.dataset.message === 'off') return;
    const target = document.getElementById('w-message-mount') || root;

    const title = root.dataset.messageHeading || 'A Note For You';
    const sub = root.dataset.messageSub
      || (p.isBirthday ? 'From The Family' : 'From The Couple');

    const sec = document.createElement('div');
    sec.className = 'w-message';
    // Trim only the outer blank lines/spaces Ã¢â‚¬â€ the interior newlines and blank
    // lines are preserved (see .w-message-text white-space: pre-wrap) so the
    // message reads exactly as the host typed it, paragraphs and all.
    sec.innerHTML = `
      <div class="w-heading">
        <div class="w-heading-script">${escapeHTML(title)}</div>
        <div class="w-heading-sub">${escapeHTML(sub)}</div>
      </div>
      <div class="w-message-card">
        <div class="w-message-quote" aria-hidden="true">&ldquo;</div>
        <div class="w-message-text">${escapeHTML(p.personalMessage.replace(/^\s+|\s+$/g, ''))}</div>
      </div>
    `;
    target.appendChild(sec);
  }

  // ---------- COUNTDOWN SECTION HEADING ----------
  // Wraps each opt-in template's countdown with a "Counting Down Ã¢â‚¬â€ X days until
  // the dream <event>" heading. The X tracks the days cell live (so it ticks
  // the moment that cell updates). Muslim/Royal-Walima have their own section
  // headings already and are skipped via the data-scratch="on" gate.
  function decorateCountdown(root, p) {
    if (root.dataset.scratch !== 'on') return;
    const cds = document.querySelectorAll('.countdown');
    cds.forEach((cd) => {
      if (cd.previousElementSibling && cd.previousElementSibling.classList.contains('w-cd-heading')) return;
      const evt = (p.eventType || 'Big Day').trim();
      const title = p.isBirthday
        ? 'until your big celebration'
        : `until your dream ${evt.toLowerCase()}`;
      const heading = document.createElement('div');
      heading.className = 'w-cd-heading';
      heading.innerHTML = `
        <div class="w-cd-eyebrow">&mdash; Counting Down &mdash;</div>
	<div class="w-cd-title">
          <span class="w-cd-days-text">Ã¢â‚¬â€</span>
          <span class="w-cd-days-label">days</span>
          <span class="w-cd-tail">${escapeHTML(title)}</span>
        </div>
      `;
      cd.parentNode.insertBefore(heading, cd);

      // Keep the inline days number in sync with the days cell as it ticks.
      const daysCell =
        cd.querySelector('#cd-days') ||
        cd.querySelector('#days') ||
        cd.querySelector('.ct .n') ||
        cd.querySelector('.count-num');
      const daysText = heading.querySelector('.w-cd-days-text');
      if (daysCell && daysText) {
        const sync = () => {
          const v = parseInt(daysCell.textContent, 10);
          if (!isNaN(v)) daysText.textContent = v;
        };
        sync();
        new MutationObserver(sync).observe(daysCell, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
    });
  }

  // ---------- COUNTDOWN FLIP ----------
  // Watch each countdown number for content changes and apply the flip class.
  // Pairs with the .w-cd-flip animation in _widgets.css. Each theme's own
  // cell animation runs on the .ct wrapper; the flip runs on the .n inside.
  function hookCountdownFlip() {
    const nums = document.querySelectorAll('.countdown .n, .countdown .count-num');
    nums.forEach((el) => {
      let prev = el.textContent;
      const obs = new MutationObserver(() => {
        const curr = el.textContent;
        if (curr === prev) return;
        prev = curr;
        el.classList.remove('w-cd-flip');
        // Force reflow so the animation can restart cleanly
        void el.offsetWidth;
        el.classList.add('w-cd-flip');
      });
      obs.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  // ---------- ENTRY ----------
  ready(() => {
    const root = document.getElementById('invite-widgets');
    if (!root) return;

    const slug = root.dataset.templateSlug || location.pathname.split('/').pop().replace('.html', '');
    const p = getParams();

    // Mount the music button + audio element for this theme.
    Audio.init(slug);

    // Tiled "e-Nimontron" watermark across the invitation (preview only Ã¢â‚¬â€ never on /i/{id}).

    // Scratch-to-reveal Save-The-Date card (opt-in via data-scratch="on").
    renderScratchCard(root, p);

    // Photo slideshow Ã¢â‚¬â€ the last thing before the "Join Us" block.
    renderSlideshow(root, p);

    // Heading
    const heading = document.createElement('div');
    heading.className = 'w-heading';
    heading.innerHTML = `
      <div class="w-heading-script">Join Us</div>
    `;
    root.appendChild(heading);

    // Venue name and address sit with the Join Us / Google Maps section.
    renderVenue(root, p);

    // One direct Google Maps link, pre-filled with the venue address.
    renderActionBar(root, p);

    // The host's note to their guests, immediately above the ask.
    renderMessage(root, p);

    // Inline RSVP form Ã¢â‚¬â€ themes that build their own set data-rsvp="off"
    if (root.dataset.rsvp !== 'off') {
      const rsvp = renderRSVP(root, p);
      wireRSVP(rsvp, slug);
    }

    // Whom to call on the day Ã¢â‚¬â€ optional, and right where a guest who cannot
    // reply through the form will look for it.

    // Wishes Ã¢â‚¬â€ guests submit a private message; only the host sees them on the
    // dashboard, so we do NOT render a public wishes list here.
    renderWishes(root, slug);
    wireWishes(root, slug);

    // "Made with Ã¢â„¢Â¥ by e-Nimontron" credit (shows in preview and published views)

    // Wrap the countdown with a "Counting Down Ã¢â‚¬â€ X days until Ã¢â‚¬Â¦" heading.
    decorateCountdown(root, p);

    // Per-theme countdown cells already have their own pulse/halo/bounce
    // animations; this layers a flip on every number change.
    hookCountdownFlip();
  });
})();

