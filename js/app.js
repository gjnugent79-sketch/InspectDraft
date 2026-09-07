/* InspectDraft — SPA controller */
(function () {
  'use strict';

  // ——— State ———
  let store = loadStore();
  let view = 'landing'; // landing | jobs | job-form | sections | section | preview | export
  let currentJobId = null;
  let currentSectionId = null;
  let editingFindingId = null;

  const $main = document.getElementById('main');
  const $header = document.getElementById('app-header');
  const $headerTitle = document.getElementById('header-title');
  const $headerSub = document.getElementById('header-sub');
  const $btnBack = document.getElementById('btn-back');
  const $bottomNav = document.getElementById('bottom-nav');
  const $modalRoot = document.getElementById('modal-root');

  // Theme
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme === 'dark' ? 'dark' : 'light');
  document.getElementById('btn-theme').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
  });

  $btnBack.addEventListener('click', onBack);
  $bottomNav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    const v = btn.dataset.view;
    if (v === 'sections') navigate('sections');
    else if (v === 'preview') navigate('preview');
    else if (v === 'export') navigate('export');
  });

  // ——— Persistence ———
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.jobs)) {
          parsed.jobs.forEach(ensureJobShape);
          return parsed;
        }
      }
    } catch (_) {}
    const s = defaultStore();
    s.jobs.forEach(ensureJobShape);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  }

  function saveStore() {
    store.jobs.forEach((j) => {
      if (j.id === currentJobId) j.updatedAt = new Date().toISOString();
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function getJob(id) {
    return store.jobs.find((j) => j.id === id) || null;
  }

  function currentJob() {
    return getJob(currentJobId);
  }

  function getSampleJob() {
    return store.jobs.find((j) => j.isSample) || store.jobs[0] || null;
  }

  // ——— Navigation ———
  function navigate(next, opts) {
    view = next;
    if (opts && opts.jobId) currentJobId = opts.jobId;
    if (opts && opts.sectionId) currentSectionId = opts.sectionId;
    if (opts && opts.sectionId === null) currentSectionId = null;
    editingFindingId = null;
    closeModal();
    render();
    window.scrollTo(0, 0);
  }

  function onBack() {
    if (view === 'section') navigate('sections');
    else if (view === 'sections' || view === 'preview' || view === 'export') navigate('jobs');
    else if (view === 'job-form') navigate('jobs');
    else if (view === 'jobs') navigate('landing');
    else navigate('landing');
  }

  // ——— Helpers ———
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) {
      return iso;
    }
  }

  function sectionStats(job, sectionId) {
    const s = job.sections[sectionId] || emptySection();
    const hasNotes = !!(s.notes && s.notes.trim());
    const hasFindings = s.findings && s.findings.length > 0;
    const hasPhotos = s.photos && s.photos.length > 0;
    return { hasNotes, hasFindings, hasPhotos, empty: !hasNotes && !hasFindings && !hasPhotos };
  }

  function jobProgress(job) {
    const active = getActiveSections(job);
    let filled = 0;
    active.forEach((sec) => {
      if (!sectionStats(job, sec.id).empty) filled++;
    });
    const total = active.length || 1;
    return { filled, total: active.length, pct: Math.round((filled / total) * 100) };
  }

  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.toggle('no-nav', view === 'landing' || view === 'jobs' || view === 'job-form' || view === 'section');
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function closeModal() {
    $modalRoot.classList.add('hidden');
    $modalRoot.innerHTML = '';
  }

  function openModal(html) {
    $modalRoot.innerHTML = html;
    $modalRoot.classList.remove('hidden');
    $modalRoot.onclick = (e) => {
      if (e.target === $modalRoot) closeModal();
    };
  }

  // ——— File / photo helpers ———
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function compressImage(dataUrl, maxW) {
    maxW = maxW || 1280;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } catch (_) {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // ——— Render ———
  function render() {
    const inJob = ['sections', 'section', 'preview', 'export'].includes(view);
    const isLanding = view === 'landing';
    $bottomNav.classList.toggle('hidden', !inJob || view === 'section');
    $main.classList.toggle('no-nav', !inJob || view === 'section' || isLanding);
    $main.classList.toggle('is-landing', isLanding);
    $header.classList.toggle('is-landing', isLanding);
    $btnBack.classList.toggle('hidden', view === 'landing');

    document.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.view === view || (view === 'section' && el.dataset.view === 'sections'));
    });

    const job = currentJob();

    const $headerLogo = document.getElementById('header-logo');
    if ($headerLogo) $headerLogo.classList.toggle('hidden', !(view === 'landing' || view === 'jobs'));

    if (view === 'landing') {
      $headerTitle.innerHTML = '<span style="color:#fff">Inspect</span><span style="color:#00C853">Draft</span>';
      $headerSub.textContent = 'INSPECT / CAPTURE / REPORT';
      renderLanding();
    } else if (view === 'jobs') {
      $headerTitle.innerHTML = '<span style="color:#fff">Inspect</span><span style="color:#00C853">Draft</span>';
      $headerSub.textContent = 'INSPECT / CAPTURE / REPORT';
      renderJobs();
    } else if (view === 'job-form') {
      $headerTitle.textContent = 'New Job';
      $headerSub.textContent = 'Inspection details';
      renderJobForm();
    } else if (view === 'sections' && job) {
      $headerTitle.textContent = job.address.split(',')[0] || 'Job';
      $headerSub.textContent = job.client || 'Sections';
      renderSections(job);
    } else if (view === 'section' && job) {
      ensureJobShape(job);
      const sec = getSectionDef(currentSectionId);
      const onJob = sec && (SECTIONS.some((s) => s.id === sec.id) || job.optionalSectionIds.includes(sec.id));
      if (!sec || !onJob) {
        navigate('sections');
        return;
      }
      $headerTitle.textContent = sec.name;
      $headerSub.textContent = job.address.split(',')[0];
      renderSectionDetail(job, sec);
    } else if ((view === 'preview' || view === 'export') && job) {
      $headerTitle.textContent = view === 'export' ? 'Export' : 'Preview';
      $headerSub.textContent = job.address.split(',')[0];
      renderReport(job, view === 'export');
    } else {
      navigate('landing');
    }
  }

  // ——— Views ———
  function renderLanding() {
    $main.innerHTML = `
      <section class="landing">
        <div class="stripe-accent" aria-hidden="true"></div>
        <div class="landing-hero">
          <div class="landing-kicker">
            <img class="logo-svg" src="assets/brand/logo-mark-navy.svg" alt="" width="28" height="28" />
            <span class="brand-wordmark"><span class="inspect">Inspect</span><span class="draft">Draft</span></span>
          </div>
          <h2>Smarter home inspections. Faster, easier, more accurate.</h2>
          <p class="landing-lede">The modern way to inspect properties. Capture notes and photos by system on site, structure them into an editable draft, then print or save PDF when you’re ready to review.</p>

          <ul class="landing-benefits">
            <li>
              <span class="b-icon">✓</span>
              <div>
                <strong>Capture notes &amp; photos on site</strong>
                <span>Twelve core systems, plus optional extras when needed. Empty exports as “Not recorded” — blank never means pass.</span>
              </div>
            </li>
            <li>
              <span class="b-icon">✓</span>
              <div>
                <strong>Let AI turn findings into a report</strong>
                <span>Stub AI structures your field notes into editable findings. Your words only — never invents defects.</span>
              </div>
            </li>
            <li>
              <span class="b-icon">✓</span>
              <div>
                <strong>Save time. Increase accuracy.</strong>
                <span>Preview → Print / PDF with disclaimer. Review every finding before delivery.</span>
              </div>
            </li>
          </ul>

          <div class="landing-ctas">
            <button type="button" class="btn btn-primary" id="btn-try-sample">Try sample job</button>
            <button type="button" class="btn btn-navy" id="btn-open-app">Open app</button>
          </div>
          <p class="landing-fine">AI only structures <em>your</em> words — it never invents defects.</p>
          <p class="landing-mission">Built for the people who keep homes safe.</p>
        </div>

        <p class="landing-strip-label">Product walkthrough</p>
        <div class="landing-strip">
          <figure>
            <img src="assets/screenshots/01-jobs.png" alt="Jobs list" loading="lazy" />
            <figcaption>Jobs</figcaption>
          </figure>
          <figure>
            <img src="assets/screenshots/02-sections.png" alt="Sections list" loading="lazy" />
            <figcaption>Sections</figcaption>
          </figure>
          <figure>
            <img src="assets/screenshots/03-section-roof.png" alt="Section capture" loading="lazy" />
            <figcaption>Capture</figcaption>
          </figure>
        </div>
      </section>
    `;

    document.getElementById('btn-open-app').onclick = () => navigate('jobs');
    document.getElementById('btn-try-sample').onclick = () => {
      const sample = getSampleJob();
      if (!sample) {
        store = defaultStore();
        saveStore();
      }
      const job = getSampleJob();
      if (job) navigate('sections', { jobId: job.id });
      else navigate('jobs');
    };
  }

  function renderJobs() {
    const jobs = [...store.jobs].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    let listHtml = '';
    if (!jobs.length) {
      listHtml = `
        <div class="empty-state">
          <div class="emoji">📋</div>
          <h3>No jobs yet</h3>
          <p>Create a job after walking a house to draft the report.</p>
          <p class="empty-state-hint">Walk a system, add notes, structure, export.</p>
        </div>`;
    } else {
      listHtml = jobs
        .map((j) => {
          const prog = jobProgress(j);
          const badges = [
            `<span class="badge badge-draft">Draft</span>`,
            j.isSample ? `<span class="badge badge-sample">Sample</span>` : '',
            prog.filled
              ? `<span class="badge badge-count">${prog.filled}/${prog.total} sections</span>`
              : '',
          ].join('');
          return `
            <article class="card card-pressable" data-open-job="${j.id}">
              <div class="job-card-header">
                <div>
                  <div class="card-title">${escapeHtml(j.address)}</div>
                  <div class="card-meta">
                    <span>${escapeHtml(j.client || 'No client')}</span>
                    <span>${formatDate(j.date)}</span>
                  </div>
                </div>
              </div>
              <div style="margin-top:8px">${badges}</div>
              <div class="job-card-actions" onclick="event.stopPropagation()">
                <button type="button" class="btn btn-primary btn-sm" data-open-job="${j.id}">Open</button>
                <button type="button" class="btn btn-danger btn-sm" data-delete-job="${j.id}">Delete</button>
              </div>
            </article>`;
        })
        .join('');
    }

    $main.innerHTML = `
      <div class="page-intro">
        <div class="logo-mark">
          <img class="logo-svg sm" src="assets/brand/logo-mark-navy.svg" alt="" width="22" height="22" />
          <span class="logo-word"><span class="inspect">Inspect</span><span class="draft">Draft</span></span>
        </div>
        <h2>Jobs</h2>
        <p>Turn field notes &amp; photos into an editable system-by-system draft. AI structures <em>your</em> words only.</p>
      </div>
      <button type="button" class="btn btn-primary" id="btn-new-job" style="margin-bottom:20px">＋ New Job</button>
      ${listHtml}
    `;

    document.getElementById('btn-new-job').onclick = () => navigate('job-form');
    $main.querySelectorAll('[data-open-job]').forEach((el) => {
      el.addEventListener('click', () => navigate('sections', { jobId: el.getAttribute('data-open-job') }));
    });
    $main.querySelectorAll('[data-delete-job]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteJob(el.getAttribute('data-delete-job'));
      });
    });
  }

  function confirmDeleteJob(id) {
    const job = getJob(id);
    if (!job) return;
    openModal(`
      <div class="modal-sheet">
        <h2>Delete job?</h2>
        <p style="color:var(--text-muted);margin-bottom:8px">${escapeHtml(job.address)}</p>
        <p style="font-size:0.85rem;color:var(--text-dim)">This cannot be undone. Sample job can be restored by clearing site data.</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="modal-cancel">Cancel</button>
          <button type="button" class="btn btn-danger" id="modal-confirm">Delete</button>
        </div>
      </div>`);
    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('modal-confirm').onclick = () => {
      store.jobs = store.jobs.filter((j) => j.id !== id);
      saveStore();
      closeModal();
      toast('Job deleted');
      if (currentJobId === id) currentJobId = null;
      navigate('jobs');
    };
  }

  function renderJobForm() {
    const today = new Date().toISOString().slice(0, 10);
    $main.innerHTML = `
      <div class="page-intro">
        <h2>New inspection job</h2>
        <p>Saved on this device only (localStorage).</p>
      </div>
      <form id="job-form">
        <div class="form-group">
          <label for="f-address">Property address</label>
          <input id="f-address" name="address" required placeholder="123 Main St, City, ST 00000" autocomplete="street-address" />
        </div>
        <div class="form-group">
          <label for="f-client">Client name</label>
          <input id="f-client" name="client" placeholder="Client or buyer name" />
        </div>
        <div class="form-group">
          <label for="f-date">Inspection date</label>
          <input id="f-date" name="date" type="date" value="${today}" required />
        </div>
        <div class="form-group">
          <label for="f-inspector">Inspector name</label>
          <input id="f-inspector" name="inspector" placeholder="Your name" />
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-outline" id="btn-cancel-form">Cancel</button>
          <button type="submit" class="btn btn-primary">Create job</button>
        </div>
      </form>
    `;
    document.getElementById('btn-cancel-form').onclick = () => navigate('jobs');
    document.getElementById('job-form').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const job = createJob({
        address: (fd.get('address') || '').trim(),
        client: (fd.get('client') || '').trim(),
        date: fd.get('date'),
        inspector: (fd.get('inspector') || '').trim(),
      });
      store.jobs.unshift(job);
      saveStore();
      toast('Job created');
      navigate('sections', { jobId: job.id });
    };
  }

  function renderSections(job) {
    ensureJobShape(job);
    const prog = jobProgress(job);
    const active = getActiveSections(job);
    const available = getAvailableOptionals(job);

    const rows = active.map((sec) => {
      const st = sectionStats(job, sec.id);
      const optional = isOptionalSectionId(sec.id);
      let statusClass = '';
      let statusText = 'Not recorded';
      if (st.hasFindings) {
        statusClass = 'has-data';
        statusText = `${job.sections[sec.id].findings.length} finding${job.sections[sec.id].findings.length === 1 ? '' : 's'}`;
        if (st.hasPhotos) statusText += ` · ${job.sections[sec.id].photos.length} photo${job.sections[sec.id].photos.length === 1 ? '' : 's'}`;
      } else if (st.hasNotes || st.hasPhotos) {
        statusClass = 'partial';
        statusText = st.hasNotes ? 'Notes — not structured yet' : `${job.sections[sec.id].photos.length} photo(s)`;
      }
      const trailing = st.hasFindings
        ? `<span class="section-check" aria-label="Completed">✓</span>`
        : `<span class="section-chevron">›</span>`;
      const badge = optional ? `<span class="optional-badge">Optional</span>` : '';
      const removeBtn = optional
        ? `<button type="button" class="btn-icon section-remove-opt" data-remove-optional="${sec.id}" aria-label="Remove ${escapeHtml(sec.name)}" title="Remove optional system">×</button>`
        : '';
      return `
        <div class="section-row-wrap${optional ? ' is-optional' : ''}">
          <button type="button" class="section-row" data-section="${sec.id}">
            <span class="section-icon">${sec.icon}</span>
            <span class="section-info">
              <strong>${escapeHtml(sec.name)}${badge}</strong>
              <span class="section-status ${statusClass}">${statusText}</span>
            </span>
            ${trailing}
          </button>
          ${removeBtn}
        </div>`;
    }).join('');

    $main.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">${escapeHtml(job.address)}</div>
        <div class="card-meta">
          <span>${escapeHtml(job.client || '—')}</span>
          <span>${formatDate(job.date)}</span>
          <span>${escapeHtml(job.inspector || '—')}</span>
        </div>
        <div class="progress-label" style="margin-top:12px">${prog.filled} of ${prog.total} systems have notes or findings</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${prog.pct}%"></div></div>
        <p style="font-size:0.75rem;color:var(--text-dim)">Empty sections export as <strong style="color:var(--text-muted)">Not recorded</strong> — blank does not mean pass. Optional systems appear only after you add them.</p>
      </div>

      <div class="sections-toolbar">
        <button type="button" class="btn btn-outline btn-sm" id="btn-add-optional" ${available.length ? '' : 'disabled'}>
          ＋ Add optional system
        </button>
        <button type="button" class="btn-icon sections-overflow" id="btn-sections-menu" aria-label="More options" title="More">☰</button>
      </div>

      <div class="sections-grid">${rows}</div>
    `;

    $main.querySelectorAll('[data-section]').forEach((el) => {
      el.addEventListener('click', () => navigate('section', { sectionId: el.getAttribute('data-section') }));
    });
    $main.querySelectorAll('[data-remove-optional]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmRemoveOptional(job, el.getAttribute('data-remove-optional'));
      });
    });
    const addBtn = document.getElementById('btn-add-optional');
    if (addBtn) addBtn.onclick = () => openOptionalPicker(job);
    const menuBtn = document.getElementById('btn-sections-menu');
    if (menuBtn) {
      menuBtn.onclick = () => {
        openModal(`
          <div class="modal-sheet">
            <h2>Job options</h2>
            <button type="button" class="picker-item" id="menu-add-optional" ${available.length ? '' : 'disabled'}>
              <span class="picker-icon">＋</span>
              <span class="picker-info">
                <strong>Add optional system</strong>
                <span>Pool / Spa, Irrigation, Outbuildings, Dock…</span>
              </span>
            </button>
            <div class="modal-actions">
              <button type="button" class="btn btn-outline" id="modal-cancel">Close</button>
            </div>
          </div>`);
        document.getElementById('modal-cancel').onclick = closeModal;
        const m = document.getElementById('menu-add-optional');
        if (m && !m.disabled) {
          m.onclick = () => {
            closeModal();
            openOptionalPicker(job);
          };
        }
      };
    }
  }

  function openOptionalPicker(job) {
    ensureJobShape(job);
    const available = getAvailableOptionals(job);
    if (!available.length) {
      toast('All optional systems already added');
      return;
    }
    const items = available
      .map(
        (sec) => `
        <button type="button" class="picker-item" data-add-optional="${sec.id}">
          <span class="picker-icon">${sec.icon}</span>
          <span class="picker-info">
            <strong>${escapeHtml(sec.name)}</strong>
            <span>Adds to this job only — omit from PDF until filled</span>
          </span>
        </button>`
      )
      .join('');
    openModal(`
      <div class="modal-sheet">
        <h2>Add optional system</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px">
          These do not appear in the report until you add them. Empty optionals export as <em>Not recorded</em>, same as core systems.
        </p>
        <div class="picker-list">${items}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="modal-cancel">Cancel</button>
        </div>
      </div>`);
    document.getElementById('modal-cancel').onclick = closeModal;
    $modalRoot.querySelectorAll('[data-add-optional]').forEach((el) => {
      el.onclick = () => {
        const id = el.getAttribute('data-add-optional');
        if (addOptionalToJob(job, id)) {
          saveStore();
          closeModal();
          const def = getSectionDef(id);
          toast(`Added ${def ? def.name : 'system'}`);
          render();
        }
      };
    });
  }

  function confirmRemoveOptional(job, sectionId) {
    ensureJobShape(job);
    const def = getSectionDef(sectionId);
    if (!def || !job.optionalSectionIds.includes(sectionId)) return;
    const st = sectionStats(job, sectionId);
    const hasContent = !st.empty;
    const findingsCount = (job.sections[sectionId] && job.sections[sectionId].findings)
      ? job.sections[sectionId].findings.length
      : 0;
    const warn = hasContent
      ? `<p style="font-size:0.85rem;color:var(--warn);margin-bottom:8px">This system has ${findingsCount ? findingsCount + ' finding(s)' : 'notes or photos'}. Removing it deletes that data from this job and drops it from the PDF.</p>`
      : `<p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:8px">No findings yet. You can add it again later if needed.</p>`;
    openModal(`
      <div class="modal-sheet">
        <h2>Remove ${escapeHtml(def.name)}?</h2>
        ${warn}
        <p style="font-size:0.8rem;color:var(--text-muted)">Optional systems only appear when you add them. Core sections stay.</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="modal-cancel">Cancel</button>
          <button type="button" class="btn btn-danger" id="modal-confirm">Remove</button>
        </div>
      </div>`);
    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('modal-confirm').onclick = () => {
      removeOptionalFromJob(job, sectionId);
      saveStore();
      closeModal();
      toast(`Removed ${def.name}`);
      if (view === 'section' && currentSectionId === sectionId) navigate('sections');
      else render();
    };
  }

  function renderSectionDetail(job, sec) {
    if (!sec) return;
    const data = job.sections[sec.id] || emptySection();
    if (!job.sections[sec.id]) job.sections[sec.id] = data;

    const isEmptySection = sectionStats(job, sec.id).empty;

    const findingsHtml =
      data.findings.length === 0
        ? `<div class="empty-state" style="padding:24px">
             <p>No findings yet. Add notes, then tap <strong>Structure notes</strong> (stub AI), or add a finding manually.</p>
             ${isEmptySection ? `<p class="empty-state-hint">Walk a system, add notes, structure, export.</p>` : ''}
           </div>`
        : data.findings
            .map((f) => {
              if (editingFindingId === f.id) {
                return `
                  <div class="finding-card editing" data-finding="${f.id}">
                    <div class="form-group">
                      <label>Observation</label>
                      <textarea id="edit-obs" rows="3">${escapeHtml(f.observation)}</textarea>
                    </div>
                    <div class="form-group">
                      <label>Recommendation</label>
                      <textarea id="edit-rec" rows="2" placeholder="Optional">${escapeHtml(f.recommendation)}</textarea>
                    </div>
                    <div class="finding-actions">
                      <button type="button" class="btn btn-primary btn-sm" data-save-finding="${f.id}">Save</button>
                      <button type="button" class="btn btn-outline btn-sm" data-cancel-edit>Cancel</button>
                    </div>
                  </div>`;
              }
              return `
                <div class="finding-card" data-finding="${f.id}">
                  <div class="finding-label">Observation</div>
                  <div class="finding-obs">${escapeHtml(f.observation)}</div>
                  ${
                    f.recommendation
                      ? `<div class="finding-label">Recommendation</div><div class="finding-rec">${escapeHtml(f.recommendation)}</div>`
                      : `<div class="finding-label" style="margin-top:8px">Recommendation</div><div class="finding-rec" style="border-color:var(--border);font-style:italic;color:var(--text-dim)">None yet — tap Edit to add</div>`
                  }
                  <div class="finding-actions">
                    <button type="button" class="btn btn-ghost btn-sm" data-edit-finding="${f.id}">Edit</button>
                    <button type="button" class="btn btn-danger btn-sm" data-delete-finding="${f.id}">Delete</button>
                  </div>
                </div>`;
            })
            .join('');

    const photosHtml =
      data.photos.length > 0
        ? `<div class="photo-grid">${data.photos
            .map(
              (p, i) => `
            <div class="photo-thumb">
              <img src="${p.dataUrl}" alt="Photo ${i + 1}" />
              <button type="button" class="photo-remove" data-remove-photo="${i}" aria-label="Remove">×</button>
            </div>`
            )
            .join('')}</div>`
        : '';

    const emptyHero = isEmptySection
      ? `<div class="section-empty-hero">
           <p><strong>Walk a system, add notes, structure, export.</strong><br/>Start with field notes or photos for ${escapeHtml(sec.name)}.</p>
         </div>`
      : '';

    $main.innerHTML = `
      ${emptyHero}

      <div class="ai-banner">
        <strong>Stub AI</strong> structures your notes into findings. It does not invent defects — verify every item before export.
      </div>

      <div class="notes-area">
        <div class="form-group">
          <label for="section-notes">Field notes</label>
          <textarea id="section-notes" placeholder="Dictate or type observations for ${escapeHtml(sec.name)}…">${escapeHtml(data.notes)}</textarea>
          <p class="form-hint">Tip: separate findings with blank lines or bullets. Use “recommend…” to split observation / recommendation.</p>
        </div>
      </div>

      <div class="photo-zone" id="photo-zone">
        <input type="file" id="photo-input" accept="image/*" capture="environment" multiple />
        <div class="photo-zone-label">
          <strong>＋ Add photos</strong>
          Tap to choose files or use camera on mobile
        </div>
        ${photosHtml}
      </div>

      <div class="findings-header">
        <h3>Findings <span class="stub-badge">Editable</span></h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-finding">＋ Add</button>
      </div>
      <div id="findings-list">${findingsHtml}</div>

      <div class="sticky-actions">
        <p class="structure-hero-label">Primary action</p>
        <button type="button" class="btn btn-ai" id="btn-structure">Structure notes <span class="stub-badge" style="background:rgba(255,255,255,0.25);color:#fff">Stub AI</span></button>
        <button type="button" class="btn btn-navy" id="btn-save-section">Save section</button>
      </div>

      ${
        isOptionalSectionId(sec.id)
          ? `<div class="optional-section-footer">
               <span class="optional-badge">Optional system</span>
               <button type="button" class="btn btn-ghost btn-sm" id="btn-remove-optional-section">Remove from job</button>
             </div>`
          : ''
      }
    `;

    const notesEl = document.getElementById('section-notes');
    let saveTimer;
    notesEl.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        data.notes = notesEl.value;
        saveStore();
      }, 400);
    });

    document.getElementById('btn-save-section').onclick = () => {
      data.notes = notesEl.value;
      saveStore();
      toast('Section saved');
    };

    const removeOptBtn = document.getElementById('btn-remove-optional-section');
    if (removeOptBtn) {
      removeOptBtn.onclick = () => confirmRemoveOptional(job, sec.id);
    }

    document.getElementById('btn-structure').onclick = () => {
      data.notes = notesEl.value;
      const structured = structureNotesStub(data.notes);
      if (!structured.length) {
        toast('Add some notes first');
        return;
      }
      openModal(`
        <div class="modal-sheet">
          <h2>Structure notes?</h2>
          <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:12px">
            Stub AI found <strong style="color:var(--text)">${structured.length}</strong> finding(s) from your notes.
            ${data.findings.length ? 'This will <strong style="color:var(--warn)">replace</strong> current findings in this section.' : 'Findings will be added for you to edit.'}
          </p>
          <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:8px">AI-assisted structuring — verify all findings. No defects are invented beyond your text.</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="modal-cancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="modal-confirm">Apply</button>
          </div>
        </div>`);
      document.getElementById('modal-cancel').onclick = closeModal;
      document.getElementById('modal-confirm').onclick = () => {
        data.findings = structured;
        saveStore();
        closeModal();
        toast('Findings structured');
        render();
      };
    };

    document.getElementById('btn-add-finding').onclick = () => {
      data.notes = notesEl.value;
      const f = { id: uid(), observation: '', recommendation: '' };
      data.findings.push(f);
      editingFindingId = f.id;
      saveStore();
      render();
    };

    $main.querySelectorAll('[data-edit-finding]').forEach((el) => {
      el.onclick = () => {
        editingFindingId = el.getAttribute('data-edit-finding');
        render();
      };
    });
    $main.querySelectorAll('[data-cancel-edit]').forEach((el) => {
      el.onclick = () => {
        editingFindingId = null;
        data.findings = data.findings.filter((f) => f.observation.trim() || f.recommendation.trim());
        saveStore();
        render();
      };
    });
    $main.querySelectorAll('[data-save-finding]').forEach((el) => {
      el.onclick = () => {
        const id = el.getAttribute('data-save-finding');
        const f = data.findings.find((x) => x.id === id);
        if (!f) return;
        f.observation = document.getElementById('edit-obs').value.trim();
        f.recommendation = document.getElementById('edit-rec').value.trim();
        if (!f.observation) {
          toast('Observation required');
          return;
        }
        editingFindingId = null;
        saveStore();
        toast('Finding saved');
        render();
      };
    });
    $main.querySelectorAll('[data-delete-finding]').forEach((el) => {
      el.onclick = () => {
        const id = el.getAttribute('data-delete-finding');
        data.findings = data.findings.filter((f) => f.id !== id);
        saveStore();
        toast('Finding removed');
        render();
      };
    });

    const photoZone = document.getElementById('photo-zone');
    const photoInput = document.getElementById('photo-input');
    photoZone.addEventListener('click', (e) => {
      if (e.target.closest('.photo-remove')) return;
      photoInput.click();
    });
    photoInput.addEventListener('change', async () => {
      const files = Array.from(photoInput.files || []);
      if (!files.length) return;
      toast('Adding photos…');
      for (const file of files.slice(0, 8)) {
        try {
          const raw = await readFileAsDataURL(file);
          const compressed = await compressImage(raw);
          data.photos.push({ id: uid(), dataUrl: compressed, name: file.name });
        } catch (_) {}
      }
      photoInput.value = '';
      saveStore();
      toast('Photos added');
      render();
    });
    $main.querySelectorAll('[data-remove-photo]').forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const i = parseInt(el.getAttribute('data-remove-photo'), 10);
        data.photos.splice(i, 1);
        saveStore();
        render();
      };
    });
  }

  function renderReport(job, isExport) {
    ensureJobShape(job);
    const sectionsHtml = getActiveSections(job).map((sec) => {
      const data = job.sections[sec.id] || emptySection();
      const st = sectionStats(job, sec.id);

      if (st.empty) {
        return `
          <div class="report-section">
            <h2>${escapeHtml(sec.name)}</h2>
            <p class="report-not-recorded">Not recorded</p>
          </div>`;
      }

      let findingsBlock = '';
      if (data.findings.length) {
        findingsBlock = data.findings
          .map(
            (f) => `
            <div class="report-finding">
              <div class="obs">${escapeHtml(f.observation)}</div>
              ${f.recommendation ? `<div class="rec"><strong>Recommendation:</strong> ${escapeHtml(f.recommendation)}</div>` : ''}
            </div>`
          )
          .join('');
      } else if (data.notes.trim()) {
        findingsBlock = `<div class="report-notes-raw"><strong>Raw notes (not yet structured):</strong>\n${escapeHtml(data.notes)}</div>`;
      }

      const photosBlock =
        data.photos.length > 0
          ? `<div class="report-photos">${data.photos.map((p) => `<img src="${p.dataUrl}" alt="" />`).join('')}</div>`
          : '';

      return `
        <div class="report-section">
          <h2>${escapeHtml(sec.name)}</h2>
          ${findingsBlock}
          ${photosBlock}
        </div>`;
    }).join('');

    const actions = isExport
      ? `
        <div class="no-print" style="margin-bottom:16px">
          <div class="ai-banner">
            Print or Save as PDF via your browser. Footer disclaimer is included automatically.
          </div>
          <button type="button" class="btn btn-primary" id="btn-print">🖨️ Print / Save as PDF</button>
          <button type="button" class="btn btn-outline" id="btn-copy-html" style="margin-top:8px">Copy report HTML</button>
        </div>`
      : `
        <div class="no-print" style="margin-bottom:16px">
          <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:12px">Live preview of the draft report. Empty systems show as <em>Not recorded</em>.</p>
          <button type="button" class="btn btn-primary" id="btn-goto-export">Continue to Export</button>
        </div>`;

    $main.innerHTML = `
      ${actions}
      <article class="report" id="report-doc">
        <header class="report-header">
          <div class="report-brand-row">
            <img src="assets/brand/logo-mark-navy.svg" alt="InspectDraft" width="36" height="36" />
            <div>
              <div class="brand"><span class="inspect">Inspect</span><span class="draft">Draft</span> · Draft Report</div>
              <div class="brand-sub">INSPECT / CAPTURE / REPORT</div>
            </div>
          </div>
          <h1>${escapeHtml(job.address)}</h1>
          <div class="report-meta">
            <div><strong>Client:</strong> ${escapeHtml(job.client || '—')}</div>
            <div><strong>Inspection date:</strong> ${formatDate(job.date)}</div>
            <div><strong>Inspector:</strong> ${escapeHtml(job.inspector || '—')}</div>
            <div><strong>Generated:</strong> ${formatDate(new Date().toISOString().slice(0, 10))}</div>
          </div>
        </header>
        ${sectionsHtml}
        <footer class="report-footer">
          <p>This document is a working draft assembled from field notes. It is not a final certified inspection report unless reviewed and signed by the inspector of record.</p>
          <div class="report-disclaimer">
            Draft for professional review. AI-assisted structuring — verify all findings.
          </div>
        </footer>
      </article>
    `;

    if (isExport) {
      document.getElementById('btn-print').onclick = () => window.print();
      document.getElementById('btn-copy-html').onclick = async () => {
        const html = document.getElementById('report-doc').outerHTML;
        try {
          await navigator.clipboard.writeText(html);
          toast('Report HTML copied');
        } catch (_) {
          toast('Copy failed — use Print instead');
        }
      };
    } else {
      document.getElementById('btn-goto-export').onclick = () => navigate('export');
    }
  }

  // ——— Boot ———
  if (!store.jobs.length) {
    store = defaultStore();
    saveStore();
  }
  store.jobs.forEach(ensureJobShape);

  // Deep links for demos/screenshots: ?view=landing|jobs|sections|preview|export|section&section=roof
  (function applyDeepLink() {
    const params = new URLSearchParams(location.search);
    const v = params.get('view');
    if (!v) return;
    if (v === 'landing') {
      view = 'landing';
      return;
    }
    if (v === 'jobs' || v === 'job-form') {
      view = v;
      return;
    }
    const sample = store.jobs.find((j) => j.isSample) || store.jobs[0];
    if (!sample) return;
    currentJobId = sample.id;
    if (v === 'section') {
      currentSectionId = params.get('section') || 'roof';
      view = 'section';
    } else if (['sections', 'preview', 'export'].includes(v)) {
      view = v;
    }
  })();

  render();
})();
