(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  // Mobile menu
  const toggle = $('.nav-toggle');
  const nav = $('#site-nav');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav?.classList.contains('open')) {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
      toggle.focus();
    }
  });

  // The header battery charges as you scroll
  const fill = $('.scroll-battery-fill');
  if (fill) {
    let queued = false;
    const paint = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      fill.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 1})`;
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
    addEventListener('resize', paint);
    paint();
  }

  // Hero phone charges from 4% on load
  const num = $('[data-charge-number]');
  const bar = $('[data-charge-bar]');
  if (num && bar && !reduced) {
    const phone = num.closest('.phone');
    const paint = (v) => {
      num.textContent = Math.round(v);
      bar.style.transform = `scaleX(${v / 100})`;
      phone.classList.toggle('is-low', v < 20);
    };
    paint(4);
    const start = performance.now() + 700;
    const dur = 2600;
    const tick = (now) => {
      const t = Math.max(0, Math.min(1, (now - start) / dur));
      paint(4 + 96 * easeOut(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Day chart: draw the lines once in view, hover for values
  const chart = $('[data-chart]');
  if (chart) {
    const lines = $$('[data-draw]', chart);
    if (!reduced && 'IntersectionObserver' in window) {
      lines.forEach((l) => {
        const len = l.getTotalLength();
        l.style.strokeDasharray = len;
        l.style.strokeDashoffset = len;
      });
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        lines.forEach((l) => {
          l.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(.22,1,.36,1)';
          l.style.strokeDashoffset = 0;
        });
      }, { threshold: 0.3 });
      io.observe(chart);
    }

    // hour, % with, % without
    const pts = [[8, 100, 100], [10, 74, 74], [12, 47, 47], [14, 19, 19], [15.5, 67, 4], [16, 77, 0], [16.5, 88, 0], [22, 38, 0]];
    const lerp = (h) => {
      for (let i = 1; i < pts.length; i++) {
        if (h <= pts[i][0]) {
          const [a, b] = [pts[i - 1], pts[i]];
          const t = (h - a[0]) / (b[0] - a[0]);
          return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        }
      }
      return [pts.at(-1)[1], pts.at(-1)[2]];
    };
    const svg = $('svg', chart);
    const tip = $('.chart-tip', chart);
    const cross = $('.crosshair', chart);
    const dm = $('.hover-mint', chart);
    const dc = $('.hover-coral', chart);
    const fmt = (h) => {
      const hr = Math.floor(h);
      const m = Math.round((h - hr) * 60 / 15) * 15;
      const hh = hr + (m === 60 ? 1 : 0);
      const mm = m === 60 ? 0 : m;
      return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'pm' : 'am'}`;
    };
    const show = (clientX) => {
      const r = svg.getBoundingClientRect();
      const x = Math.max(60, Math.min(710, (clientX - r.left) / r.width * 720));
      const h = 8 + (x - 60) / 46.43;
      const [w, wo] = lerp(h);
      const yw = 320 - w * 2.8;
      const yo = 320 - wo * 2.8;
      cross.setAttribute('x1', x); cross.setAttribute('x2', x);
      dm.setAttribute('cx', x); dm.setAttribute('cy', yw);
      dc.setAttribute('cx', x); dc.setAttribute('cy', yo);
      tip.innerHTML = `<b>${fmt(h)}</b><span><i class="swatch swatch-mint"></i>With: ${Math.round(w)}%</span><span><i class="swatch swatch-coral"></i>Without: ${Math.round(wo)}%</span>`;
      const left = x / 720 * r.width;
      tip.style.transform = `translateX(${left > r.width * 0.6 ? left - tip.offsetWidth - 14 : left + 14}px)`;
      chart.classList.add('is-hover');
    };
    chart.addEventListener('pointermove', (e) => show(e.clientX));
    chart.addEventListener('pointerleave', () => chart.classList.remove('is-hover'));
  }

  // Rental cost calculator: hourly up to the max rental, then late fees until the cap
  const calc = $('[data-calc]');
  if (calc && window.POWERUP) {
    const p = POWERUP.pricing;
    const hours = $('#calc-hours');
    const first = $('#calc-first');
    const usd = (n) => `$${n}`;
    const run = () => {
      const h = +hours.value;
      const rental = p.hourly * Math.min(h, p.maxHours);
      const lateHours = Math.max(0, h - p.maxHours);
      const late = p.lateHourly * lateHours;
      const free = first.checked ? Math.min(rental, p.hourly * p.studentFreeMinutes / 60) : 0;
      $('[data-hours-out]').textContent = h === 1 ? '1 hour' : `${h} hours`;
      $('[data-calc-total]').textContent = usd(rental + late - free);
      $('[data-calc-rental]').textContent = usd(rental);
      $('[data-calc-free]').textContent = `-${usd(free)}`;
      $('[data-calc-free-row]').hidden = !free;
      $('[data-calc-late]').textContent = usd(late);
      $('[data-calc-late-row]').hidden = !late;
      $('[data-calc-note]').textContent = !late
        ? `Return it within ${p.maxHours} hours and there are no late fees.`
        : lateHours >= p.lateMaxHours
          ? 'Late fees have hit their cap. The charger now counts as not returned.'
          : `${lateHours} ${lateHours === 1 ? 'hour' : 'hours'} late. Late fees stop after ${p.lateMaxHours} hours.`;
    };
    calc.addEventListener('input', run);
    calc.addEventListener('submit', (e) => e.preventDefault());
    run();
  }

  // Station finder: list and map stay in sync
  const list = $('.station-list');
  if (list) {
    const stations = $$('.station', list);
    const pins = $$('.pin');
    const select = (id, { scroll = false } = {}) => {
      stations.forEach((s) => {
        const on = s.dataset.station === id;
        s.classList.toggle('is-active', on);
        $('.station-btn', s).setAttribute('aria-pressed', String(on));
        if (on && scroll) s.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      });
      pins.forEach((pin) => pin.classList.toggle('is-active', pin.dataset.station === id));
    };
    stations.forEach((s) => $('.station-btn', s).addEventListener('click', () => select(s.dataset.station)));
    pins.forEach((pin) => {
      pin.addEventListener('click', () => select(pin.dataset.station, { scroll: true }));
      pin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select(pin.dataset.station, { scroll: true });
        }
      });
    });
    const filters = $$('.filter');
    filters.forEach((btn) => btn.addEventListener('click', () => {
      filters.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      const t = btn.dataset.filter;
      const match = (el) => t === 'All' || el.dataset.type === t;
      stations.forEach((s) => { s.hidden = !match(s); });
      pins.forEach((pin) => pin.classList.toggle('is-dim', !match(pin)));
      const first = stations.find((s) => !s.hidden);
      if (first && !$('.station.is-active:not([hidden])', list)) select(first.dataset.station);
    }));
    const fromHash = location.hash.slice(1);
    select(stations.some((s) => s.dataset.station === fromHash) ? fromHash : stations[0].dataset.station);
  }

  // Forms: validate here. A static site can't send mail itself, so a real address opens the
  // visitor's email app. Until the group has one, say honestly that nothing was sent.
  $$('[data-form]').forEach((form) => {
    const status = $('.form-status', form);
    const check = (field) => {
      const input = $('input,textarea,select', field);
      const err = $('.err', field);
      if (!err) return true;
      const ok = input.checkValidity();
      err.hidden = ok;
      input.setAttribute('aria-invalid', String(!ok));
      return ok;
    };
    const fields = $$('.field', form);
    // Re-check while typing, not on blur: clearing an error on blur shifts the Send button
    // up just as the mouse goes down on it, and the click misses.
    fields.forEach((f) => $('input,textarea', f)?.addEventListener('input', () => { if (f.querySelector('[aria-invalid="true"]')) check(f); }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const results = fields.map(check);
      if (results.includes(false)) {
        status.textContent = 'Please fix the highlighted fields.';
        $('[aria-invalid="true"]', form)?.focus();
        return;
      }
      const { email, isPlaceholder } = POWERUP.contact;
      if (isPlaceholder) {
        status.textContent = "Thanks! PowerUp's inbox isn't live yet, so this message wasn't sent.";
        return;
      }
      const body = [...new FormData(form)].map(([k, v]) => `${k}: ${v}`).join('\n');
      location.href = `mailto:${email}?subject=${encodeURIComponent(form.dataset.form)}&body=${encodeURIComponent(body)}`;
      status.textContent = 'Opening your email app to send this.';
    });
  });
})();
