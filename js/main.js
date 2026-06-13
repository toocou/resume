/* ============================================================
   Toby Coulthard — Portfolio
   GSAP choreography, Lenis smooth scroll, interactions
   ============================================================ */
(() => {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ----------------------------------------------------------
     Smooth scroll (Lenis) — skipped for reduced motion
     ---------------------------------------------------------- */
  let lenis = null;
  if (!prefersReducedMotion) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const scrollToTarget = (target) => {
    if (lenis) lenis.scrollTo(target, { offset: 0 });
    else (typeof target === 'string' ? document.querySelector(target) : target)
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  /* ----------------------------------------------------------
     Text splitting helpers
     ---------------------------------------------------------- */
  const splitChars = (el) => {
    const text = el.textContent;
    el.textContent = '';
    el.setAttribute('aria-hidden', 'true');
    return [...text].map((ch) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(span);
      return span;
    });
  };

  const splitWords = (el) => {
    const text = el.textContent.trim();
    el.textContent = '';
    return text.split(/\s+/).map((word, i, arr) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = word;
      el.appendChild(span);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
      return span;
    });
  };

  /* ----------------------------------------------------------
     Fit display headlines to container width
     (Syne is wide; vw-based clamps can't guarantee a fit)
     ---------------------------------------------------------- */
  const fitEls = document.querySelectorAll('[data-fit]');
  const fitHeadlines = () => {
    fitEls.forEach((el) => {
      el.style.fontSize = '';
      const avail = el.clientWidth;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      let scale = Infinity;
      el.querySelectorAll('.hero__line-inner, .contact__mail-inner').forEach((line) => {
        const w = line.getBoundingClientRect().width;
        if (w > 0) scale = Math.min(scale, avail / w);
      });
      if (isFinite(scale)) el.style.fontSize = Math.min(fs * scale * 0.99, 230) + 'px';
    });
  };
  fitHeadlines();

  // Re-fit once the display font is actually rasterised — fonts.ready can
  // resolve before lazily-loaded faces are requested
  if (document.fonts?.load) {
    document.fonts.load('800 100px Syne').then(() => fitHeadlines()).catch(() => {});
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { fitHeadlines(); ScrollTrigger.refresh(); }, 150);
  });

  /* ----------------------------------------------------------
     Preloader → hero intro
     ---------------------------------------------------------- */
  const preloader = document.getElementById('preloader');
  const heroChars = [...document.querySelectorAll('[data-split]')]
    .filter((el) => el.closest('.hero'))
    .flatMap(splitChars);
  const heroFades = gsap.utils.toArray('[data-hero-fade]');

  gsap.set(heroChars, { yPercent: 110 });
  gsap.set(heroFades, { autoAlpha: 0, y: 24 });

  const playIntro = () => {
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.to(preloader, {
      yPercent: -100, duration: 0.9, ease: 'power4.inOut',
      onComplete: () => preloader.remove(),
    })
      .to(heroChars, { yPercent: 0, duration: 1.1, stagger: 0.035 }, '-=0.35')
      .to(heroFades, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12 }, '-=0.7');
  };

  const runPreloader = () => {
    const count = document.getElementById('preloaderCount');
    const bar = document.getElementById('preloaderBar');
    const words = preloader.querySelectorAll('.preloader__word');
    const progress = { value: 0 };

    gsap.set(words, { yPercent: 110, y: 0 });
    const tl = gsap.timeline({ onComplete: playIntro });
    tl.to(words, { yPercent: 0, duration: 0.8, ease: 'power4.out', stagger: 0.12 }, 0.1)
      .to(progress, {
        value: 100, duration: 1.4, ease: 'power2.inOut',
        onUpdate: () => {
          count.textContent = Math.round(progress.value);
          bar.style.width = progress.value + '%';
        },
      }, 0.2);
  };

  if (prefersReducedMotion) {
    preloader.remove();
    gsap.set(heroChars, { yPercent: 0 });
    gsap.set(heroFades, { autoAlpha: 1, y: 0 });
  } else {
    runPreloader();
  }

  /* ----------------------------------------------------------
     Custom cursor
     ---------------------------------------------------------- */
  if (isFinePointer) {
    const cursor = document.getElementById('cursor');
    const label = document.getElementById('cursorLabel');
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3.out' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3.out' });

    window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); });

    document.querySelectorAll('[data-cursor]').forEach((el) => {
      const mode = el.dataset.cursor;
      el.addEventListener('pointerenter', () => {
        if (mode === 'hover') cursor.classList.add('is-hover');
        else {
          cursor.classList.add('is-label');
          label.textContent = mode === 'mail' ? 'Say hi' : 'View';
        }
      });
      el.addEventListener('pointerleave', () => {
        cursor.classList.remove('is-hover', 'is-label');
      });
    });
  }

  /* ----------------------------------------------------------
     Header hide-on-scroll-down
     ---------------------------------------------------------- */
  const header = document.getElementById('siteHeader');
  ScrollTrigger.create({
    start: 'top top',
    end: 'max',
    onUpdate: (self) => {
      const pastHero = self.scroll() > window.innerHeight * 0.6;
      header.classList.toggle('is-hidden', self.direction === 1 && pastHero);
    },
  });

  /* ----------------------------------------------------------
     Fullscreen menu
     ---------------------------------------------------------- */
  const menu = document.getElementById('menuOverlay');
  const menuToggle = document.getElementById('menuToggle');
  const menuLinks = menu.querySelectorAll('.menu__link');
  let menuOpen = false;

  gsap.set(menu, { clipPath: 'inset(0 0 100% 0)', visibility: 'hidden' });

  const menuTl = gsap.timeline({ paused: true })
    .set(menu, { visibility: 'visible' })
    .to(menu, { clipPath: 'inset(0 0 0% 0)', duration: 0.7, ease: 'power4.inOut' })
    .fromTo(menuLinks,
      { yPercent: 60, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, '-=0.25');

  const setMenu = (open) => {
    menuOpen = open;
    menuToggle.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    menuToggle.querySelector('.menu-toggle__label').textContent = open ? 'Close' : 'Menu';
    document.body.classList.toggle('is-locked', open);
    if (open) { lenis?.stop(); menuTl.timeScale(1).play(); }
    else { lenis?.start(); menuTl.timeScale(1.4).reverse(); }
  };

  menuToggle.addEventListener('click', () => setMenu(!menuOpen));
  menuLinks.forEach((link) => link.addEventListener('click', (e) => {
    e.preventDefault();
    setMenu(false);
    gsap.delayedCall(0.5, () => scrollToTarget(link.getAttribute('href')));
  }));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  /* ----------------------------------------------------------
     Anchor links (header / about CTA / back-to-top)
     ---------------------------------------------------------- */
  document.querySelectorAll('.site-header__nav a, .about__cta, .site-header__logo').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToTarget(a.getAttribute('href'));
    });
  });
  document.getElementById('backToTop').addEventListener('click', () => scrollToTarget(0));

  /* ----------------------------------------------------------
     Marquee
     ---------------------------------------------------------- */
  const track = document.getElementById('marqueeTrack');
  track.innerHTML += track.innerHTML; // duplicate for seamless loop
  if (!prefersReducedMotion) {
    gsap.to(track, { xPercent: -50, duration: 22, ease: 'none', repeat: -1 });
  }

  /* ----------------------------------------------------------
     Scroll reveals
     ---------------------------------------------------------- */
  const revealEls = gsap.utils.toArray('[data-reveal]');
  if (prefersReducedMotion) {
    gsap.set(revealEls, { autoAlpha: 1 });
  } else {
    revealEls.forEach((el) => {
      gsap.fromTo(el,
        { autoAlpha: 0, y: 40 },
        {
          autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
        });
    });

    // Section titles: word-by-word rise
    gsap.utils.toArray('[data-split-words]').forEach((el) => {
      const words = splitWords(el);
      gsap.fromTo(words,
        { yPercent: 80, autoAlpha: 0 },
        {
          yPercent: 0, autoAlpha: 1, duration: 0.8, stagger: 0.05, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
        });
    });

    // About lead: rises as one block with slight clip feel
    const lead = document.querySelector('[data-reveal-lines]');
    if (lead) {
      gsap.fromTo(lead,
        { autoAlpha: 0, y: 60 },
        {
          autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out',
          scrollTrigger: { trigger: lead, start: 'top 85%' },
        });
    }

    // Portrait parallax
    gsap.utils.toArray('[data-parallax]').forEach((el) => {
      gsap.fromTo(el, { y: 50 }, {
        y: -50, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Experience rows cascade in
    gsap.utils.toArray('[data-exp]').forEach((el) => {
      gsap.fromTo(el,
        { autoAlpha: 0, y: 36 },
        {
          autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 92%' },
        });
    });

    // Contact mega-link
    const mailInners = gsap.utils.toArray('.contact__mail-inner');
    gsap.fromTo(mailInners,
      { yPercent: 110 },
      {
        yPercent: 0, duration: 1.1, stagger: 0.12, ease: 'power4.out',
        scrollTrigger: { trigger: '.contact__mail', start: 'top 88%' },
      });
  }

  /* ----------------------------------------------------------
     Experience accordion
     ---------------------------------------------------------- */
  document.querySelectorAll('.exp').forEach((item) => {
    const row = item.querySelector('.exp__row');
    const panel = item.querySelector('.exp__panel');

    row.addEventListener('click', () => {
      const isOpen = row.getAttribute('aria-expanded') === 'true';
      row.setAttribute('aria-expanded', String(!isOpen));
      gsap.to(panel, {
        height: isOpen ? 0 : 'auto',
        duration: prefersReducedMotion ? 0 : 0.55,
        ease: 'power3.inOut',
        onComplete: () => ScrollTrigger.refresh(),
      });
    });
  });

  // Open the first (current) role by default
  const firstRow = document.querySelector('.exp__row');
  if (firstRow) {
    firstRow.setAttribute('aria-expanded', 'true');
    gsap.set(firstRow.nextElementSibling, { height: 'auto' });
  }

  /* ----------------------------------------------------------
     NYC clock
     ---------------------------------------------------------- */
  const timeEls = [document.getElementById('nycTime'), document.getElementById('nycTimeFooter')];
  const tickClock = () => {
    const now = new Date().toLocaleTimeString('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true,
    });
    timeEls.forEach((el) => { if (el) el.textContent = now; });
  };
  tickClock();
  setInterval(tickClock, 30000);

  /* ----------------------------------------------------------
     Refresh triggers once fonts are ready (layout shifts)
     ---------------------------------------------------------- */
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => { fitHeadlines(); ScrollTrigger.refresh(); });
  }
})();
