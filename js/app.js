/* InspectDraft — SPA controller */
(function () {
  'use strict';

  // ——— State ———
  let store = loadStore();
  let view = 'landing'; // landing | jobs | job-form | sections | section | preview | export
  let currentJobId = null;
  let currentSectionId = null;
  let editingFindingId = null;
  let editingJobId = null; // when set, job-form edits existing job

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
    if (opts && opts.editingJobId !== undefined) editingJobId = opts.editingJobId;
    else if (next !== 'job-form') editingJobId = null;
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
      $headerTitle.textContent = editingJobId ? 'Edit Job' : 'New Job';
      $headerSub.textContent = 'Inspection details';
      renderJobForm();
    } else if (view === 'sections' && job) {
      $headerTitle.textContent = job.address.split(',')[0] || 'Job';
      $headerSub.textContent = job.client || 'Sections';
      renderSections(job);
    } else if (view === 'section' && job) {
      ensureJobShape(job);
      const sec = getSectionDef(currentSectionId, job);
      const onJob = sec && isSectionOnJob(job, sec.id);
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
    const editing = editingJobId ? getJob(editingJobId) : null;
    const today = new Date().toISOString().slice(0, 10);
    const addr = editing ? editing.address : '';
    const client = editing ? editing.client : '';
    const date = editing ? editing.date : today;
    const inspector = editing ? editing.inspector : '';
    $main.innerHTML = `
      <div class="page-intro">
        <h2>${editing ? 'Edit inspection job' : 'New inspection job'}</h2>
        <p>Saved on this device only (localStorage).</p>
      </div>
      <form id="job-form">
        <div class="form-group address-autocomplete">
          <label for="f-address">Property address</label>
          <div class="ac-wrap">
            <input id="f-address" name="address" required placeholder="Start typing an address…" autocomplete="off" value="${escapeHtml(addr)}" />
            <ul id="ac-list" class="ac-list hidden" role="listbox" aria-label="Address suggestions"></ul>
          </div>
          <p class="form-hint ac-attrib">Suggestions via Nominatim · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> — free text always works</p>
        </div>
        <div class="form-group">
          <label for="f-client">Client name</label>
          <input id="f-client" name="client" placeholder="Client or buyer name" value="${escapeHtml(client)}" />
        </div>
        <div class="form-group">
          <label for="f-date">Inspection date</label>
          <input id="f-date" name="date" type="date" value="${escapeHtml(date)}" required />
        </div>
        <div class="form-group">
          <label for="f-inspector">Inspector name</label>
          <input id="f-inspector" name="inspector" placeholder="Your name" value="${escapeHtml(inspector)}" />
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-outline" id="btn-cancel-form">Cancel</button>
          <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Create job'}</button>
        </div>
      </form>
    `;
    document.getElementById('btn-cancel-form').onclick = () => {
      if (editing) navigate('sections', { jobId: editing.id });
      else navigate('jobs');
    };
    wireAddressAutocomplete(document.getElementById('f-address'), document.getElementById('ac-list'));
    document.getElementById('job-form').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const meta = {
        address: (fd.get('address') || '').trim(),
        client: (fd.get('client') || '').trim(),
        date: fd.get('date'),
        inspector: (fd.get('inspector') || '').trim(),
      };
      if (editing) {
        editing.address = meta.address;
        editing.client = meta.client;
        editing.date = meta.date;
        editing.inspector = meta.inspector;
        saveStore();
        toast('Job updated');
        editingJobId = null;
        navigate('sections', { jobId: editing.id });
        return;
      }
      const job = createJob(meta);
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
      const optional = isOptionalSectionId(sec.id, job);
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
        <button type="button" class="btn btn-ghost btn-sm" id="btn-edit-job" style="margin-top:10px">✎ Edit job details</button>
      </div>

      <div class="sections-toolbar">
        <button type="button" class="btn btn-outline btn-sm" id="btn-add-optional" ${available.length ? '' : 'disabled'}>
          ＋ Add optional system
        </button>
        <button type="button" class="btn btn-outline btn-sm btn-add-custom" id="btn-add-custom" aria-label="Add custom system" title="Add custom system">
          ✎ ＋ Custom
        </button>
      </div>
      <p class="sections-toolbar-hint">Presets · Custom name + icon</p>

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
    const customBtn = document.getElementById('btn-add-custom');
    if (customBtn) customBtn.onclick = () => openCustomSystemModal(job);
    const editJobBtn = document.getElementById('btn-edit-job');
    if (editJobBtn) {
      editJobBtn.onclick = () => navigate('job-form', { editingJobId: job.id, jobId: job.id });
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
          const def = getSectionDef(id, job);
          toast(`Added ${def ? def.name : 'system'}`);
          render();
        }
      };
    });
  }

  function openCustomSystemModal(job) {
    ensureJobShape(job);
    let selectedIcon = CUSTOM_ICONS[0].key;
    const iconCells = CUSTOM_ICONS.map(
      (ic) => `
        <button type="button" class="icon-pick${ic.key === selectedIcon ? ' is-selected' : ''}" data-icon-key="${ic.key}" aria-label="${escapeHtml(ic.label)}" title="${escapeHtml(ic.label)}">
          <span aria-hidden="true">${ic.icon}</span>
        </button>`
    ).join('');
    openModal(`
      <div class="modal-sheet">
        <h2>Add custom system</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px">
          Name a system unique to this property (e.g. Guest house, Solar array). It appears only on this job — empty exports as <em>Not recorded</em>.
        </p>
        <div class="form-group">
          <label for="custom-system-name">System name</label>
          <input type="text" id="custom-system-name" maxlength="80" placeholder="e.g. Guest house, Solar array" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>Icon</label>
          <div class="icon-pick-grid" role="listbox" aria-label="Choose an icon">${iconCells}</div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="modal-cancel">Cancel</button>
          <button type="button" class="btn btn-primary" id="modal-add-custom">Add system</button>
        </div>
      </div>`);
    document.getElementById('modal-cancel').onclick = closeModal;
    const nameInput = document.getElementById('custom-system-name');
    nameInput.focus();
    $modalRoot.querySelectorAll('[data-icon-key]').forEach((el) => {
      el.onclick = () => {
        selectedIcon = el.getAttribute('data-icon-key');
        $modalRoot.querySelectorAll('[data-icon-key]').forEach((b) => {
          b.classList.toggle('is-selected', b.getAttribute('data-icon-key') === selectedIcon);
        });
      };
    });
    const submit = () => {
      const entry = addCustomToJob(job, nameInput.value, selectedIcon);
      if (!entry) {
        toast('Enter a system name');
        nameInput.focus();
        return;
      }
      saveStore();
      closeModal();
      toast(`Added ${entry.title}`);
      render();
    };
    document.getElementById('modal-add-custom').onclick = submit;
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  }

  function confirmRemoveOptional(job, sectionId) {
    ensureJobShape(job);
    const def = getSectionDef(sectionId, job);
    if (!def || !isSectionOnJob(job, sectionId) || !isOptionalSectionId(sectionId, job)) return;
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
                const sev = f.severity || '';
                return `
                  <div class="finding-card editing" data-finding="${f.id}">
                    <div class="form-group">
                      <label>Observation</label>
                      <textarea id="edit-obs" rows="3">${escapeHtml(f.observation)}</textarea>
                      <div class="snippet-toolbar">
                        <button type="button" class="btn btn-outline btn-sm" data-lib-finding="${f.id}">📚 Library</button>
                      </div>
                    </div>
                    <div class="form-group">
                      <label>Recommendation</label>
                      <textarea id="edit-rec" rows="2" placeholder="Optional">${escapeHtml(f.recommendation)}</textarea>
                    </div>
                    <div class="form-group">
                      <label for="edit-sev">Severity <span class="form-hint-inline">(optional)</span></label>
                      <select id="edit-sev">
                        <option value="" ${sev === '' ? 'selected' : ''}>None</option>
                        <option value="safety" ${sev === 'safety' ? 'selected' : ''}>Safety</option>
                        <option value="major" ${sev === 'major' ? 'selected' : ''}>Major</option>
                        <option value="maintenance" ${sev === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                      </select>
                    </div>
                    <div class="finding-actions">
                      <button type="button" class="btn btn-primary btn-sm" data-save-finding="${f.id}">Save</button>
                      <button type="button" class="btn btn-outline btn-sm" data-cancel-edit>Cancel</button>
                    </div>
                  </div>`;
              }
              const sevBadge = f.severity
                ? `<span class="sev-badge sev-${escapeHtml(f.severity)}">${escapeHtml(severityLabel(f.severity))}</span>`
                : '';
              return `
                <div class="finding-card" data-finding="${f.id}">
                  <div class="finding-label">Observation ${sevBadge}</div>
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
              <img src="${p.dataUrl}" alt="Photo ${i + 1}" data-markup-photo="${i}" title="Tap to mark up" />
              <button type="button" class="btn-ghost btn-sm photo-markup-btn" data-markup-photo="${i}" title="Mark up">✎</button>
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
          <div class="label-row">
            <label for="section-notes">Field notes</label>
            <button type="button" class="btn btn-outline btn-sm" id="btn-notes-library">📚 Library</button>
          </div>
          <textarea id="section-notes" placeholder="Dictate or type observations for ${escapeHtml(sec.name)}…">${escapeHtml(data.notes)}</textarea>
          <p class="form-hint">Tip: separate findings with blank lines or bullets. Use “recommend…” to split observation / recommendation. Library inserts observation snippets.</p>
        </div>
      </div>

      <div class="photo-zone" id="photo-zone">
        <input type="file" id="photo-input-camera" accept="image/*" capture="environment" />
        <input type="file" id="photo-input-library" accept="image/*" multiple />
        <div class="photo-zone-label">
          <strong>Add photos</strong>
          Camera or existing pictures — tap a thumbnail to mark up
        </div>
        <div class="photo-add-actions">
          <button type="button" class="btn btn-navy btn-sm" id="btn-photo-camera">📷 Camera</button>
          <button type="button" class="btn btn-outline btn-sm" id="btn-photo-library">🖼 Photo library</button>
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
        isOptionalSectionId(sec.id, job)
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

    const notesLibBtn = document.getElementById('btn-notes-library');
    if (notesLibBtn) {
      notesLibBtn.onclick = () => {
        openSnippetLibrary(sec.id, {
          mode: 'notes',
          currentText: notesEl.value,
          onInsert: (snippet) => {
            const cur = notesEl.value;
            const sep = cur && !cur.endsWith('\n') ? '\n\n' : (cur ? '\n' : '');
            notesEl.value = cur + sep + snippet.text;
            data.notes = notesEl.value;
            saveStore();
            toast('Snippet added to notes');
          },
        });
      };
    }

    $main.querySelectorAll('[data-lib-finding]').forEach((el) => {
      el.onclick = () => {
        const id = el.getAttribute('data-lib-finding');
        const f = data.findings.find((x) => x.id === id);
        if (!f) return;
        openSnippetLibrary(sec.id, {
          mode: 'finding',
          currentText: (document.getElementById('edit-obs') || {}).value || f.observation || '',
          onInsert: (snippet) => {
            const obs = document.getElementById('edit-obs');
            if (obs) {
              const cur = obs.value.trim();
              obs.value = cur ? cur + ' ' + snippet.text : snippet.text;
            }
            if (snippet.severity) {
              const sev = document.getElementById('edit-sev');
              if (sev && !sev.value) sev.value = snippet.severity;
            }
            toast('Snippet inserted');
          },
        });
      };
    });

    document.getElementById('btn-add-finding').onclick = () => {
      data.notes = notesEl.value;
      const f = { id: uid(), observation: '', recommendation: '', severity: '' };
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
        const sevEl = document.getElementById('edit-sev');
        f.severity = sevEl ? (sevEl.value || '') : (f.severity || '');
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

    async function addPhotosFromInput(input) {
      const files = Array.from(input.files || []);
      input.value = '';
      if (!files.length) return;
      toast('Adding photos…');
      const startLen = data.photos.length;
      for (const file of files.slice(0, 8)) {
        try {
          const raw = await readFileAsDataURL(file);
          const compressed = await compressImage(raw);
          data.photos.push({ id: uid(), dataUrl: compressed, name: file.name || 'photo' });
        } catch (_) {}
      }
      saveStore();
      const added = data.photos.length - startLen;
      if (!added) {
        toast('Could not add photos');
        return;
      }
      // Single add (typical camera): open markup immediately. Multi library pick: stay on grid.
      if (added === 1) {
        const photo = data.photos[data.photos.length - 1];
        render();
        openPhotoMarkup(photo, (newUrl) => {
          photo.dataUrl = newUrl;
          saveStore();
          toast('Markup saved');
          render();
        });
      } else {
        toast('Photos added — tap a photo to mark up');
        render();
      }
    }

    const camInput = document.getElementById('photo-input-camera');
    const libInput = document.getElementById('photo-input-library');
    const camBtn = document.getElementById('btn-photo-camera');
    const libBtn = document.getElementById('btn-photo-library');
    if (camBtn && camInput) {
      camBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        camInput.click();
      };
      camInput.addEventListener('change', () => addPhotosFromInput(camInput));
    }
    if (libBtn && libInput) {
      libBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        libInput.click();
      };
      libInput.addEventListener('change', () => addPhotosFromInput(libInput));
    }
    $main.querySelectorAll('[data-remove-photo]').forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const i = parseInt(el.getAttribute('data-remove-photo'), 10);
        data.photos.splice(i, 1);
        saveStore();
        render();
      };
    });
    $main.querySelectorAll('[data-markup-photo]').forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const i = parseInt(el.getAttribute('data-markup-photo'), 10);
        const photo = data.photos[i];
        if (!photo) return;
        openPhotoMarkup(photo, (newUrl) => {
          photo.dataUrl = newUrl;
          saveStore();
          toast('Markup saved');
          render();
        });
      };
    });
  }

  // ——— Address autocomplete (Nominatim / OSM) ———
  function wireAddressAutocomplete(input, listEl) {
    if (!input || !listEl) return;
    let timer = null;
    let abort = null;
    let items = [];

    function hideList() {
      listEl.classList.add('hidden');
      listEl.innerHTML = '';
    }

    function renderList(results) {
      items = results;
      if (!results.length) {
        hideList();
        return;
      }
      listEl.innerHTML = results
        .map((r, i) => {
          const label = formatNominatimAddress(r);
          return `<li class="ac-item" role="option" data-ac-i="${i}">${escapeHtml(label)}</li>`;
        })
        .join('');
      listEl.classList.remove('hidden');
      listEl.querySelectorAll('[data-ac-i]').forEach((el) => {
        el.onmousedown = (ev) => ev.preventDefault();
        el.onclick = () => {
          const r = items[parseInt(el.getAttribute('data-ac-i'), 10)];
          if (!r) return;
          input.value = formatNominatimAddress(r);
          hideList();
        };
      });
    }

    async function search(q) {
      if (abort) abort.abort();
      abort = new AbortController();
      const url =
        'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=' +
        encodeURIComponent(q);
      try {
        const res = await fetch(url, {
          signal: abort.signal,
          headers: {
            Accept: 'application/json',
            'Accept-Language': (navigator.language || 'en') + ',en;q=0.8',
          },
        });
        if (!res.ok) throw new Error('nominatim ' + res.status);
        const json = await res.json();
        if (input.value.trim() !== q) return;
        renderList(Array.isArray(json) ? json : []);
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        hideList();
        toast(navigator.onLine === false ? 'Address search offline — keep typing' : 'Address search unavailable — keep typing');
      }
    }

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 3) {
        hideList();
        return;
      }
      timer = setTimeout(() => search(q), 350);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideList();
    });
    input.addEventListener('blur', () => {
      setTimeout(hideList, 200);
    });
  }

  // ——— Comment / defect snippet library ———
  function openSnippetLibrary(sectionId, opts) {
    opts = opts || {};
    const job = currentJob();
    const def = getSectionDef(sectionId, job);
    const catName = def ? def.name : 'General';

    function paint() {
      const snippets = getSnippetsForSection(sectionId);
      const items = snippets.length
        ? snippets
            .map((s) => {
              const sev = s.severity
                ? `<span class="sev-badge sev-${escapeHtml(s.severity)}">${escapeHtml(severityLabel(s.severity))}</span>`
                : '';
              const del = s.custom
                ? `<button type="button" class="btn-icon snippet-del" data-del-snip="${s.id}" aria-label="Delete saved snippet">×</button>`
                : '';
              const tag = s.custom ? `<span class="snippet-custom-tag">Saved</span>` : '';
              return `
                <div class="snippet-item">
                  <button type="button" class="snippet-pick" data-snip-id="${s.id}">
                    <span class="snippet-text">${escapeHtml(s.text)}</span>
                    <span class="snippet-meta">${tag}${sev}</span>
                  </button>
                  ${del}
                </div>`;
            })
            .join('')
        : '<p class="form-hint">No snippets for this system yet.</p>';

      const canSave = !!(opts.currentText && String(opts.currentText).trim());
      $modalRoot.innerHTML = `
        <div class="modal-sheet snippet-sheet">
          <h2>Comment library</h2>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px">
            ${escapeHtml(catName)} — observation-oriented wording, not legal advice. Tap a snippet to insert.
          </p>
          <div class="snippet-list">${items}</div>
          <div class="modal-actions snippet-actions">
            <button type="button" class="btn btn-outline" id="modal-cancel">Close</button>
            <button type="button" class="btn btn-navy" id="btn-save-snippet" ${canSave ? '' : 'disabled'}>Save current as snippet</button>
          </div>
        </div>`;
      $modalRoot.classList.remove('hidden');
      $modalRoot.onclick = (e) => {
        if (e.target === $modalRoot) closeModal();
      };
      document.getElementById('modal-cancel').onclick = closeModal;
      $modalRoot.querySelectorAll('[data-snip-id]').forEach((el) => {
        el.onclick = () => {
          const id = el.getAttribute('data-snip-id');
          const snip = getSnippetsForSection(sectionId).find((s) => s.id === id);
          if (!snip) return;
          closeModal();
          if (opts.onInsert) opts.onInsert(snip);
        };
      });
      $modalRoot.querySelectorAll('[data-del-snip]').forEach((el) => {
        el.onclick = (e) => {
          e.stopPropagation();
          deleteCustomSnippet(el.getAttribute('data-del-snip'));
          toast('Snippet removed');
          paint();
        };
      });
      const saveBtn = document.getElementById('btn-save-snippet');
      if (saveBtn) {
        saveBtn.onclick = () => {
          const text = String(opts.currentText || '').trim();
          if (!text) {
            toast('Type notes first');
            return;
          }
          addCustomSnippet(sectionId, text, '');
          toast('Snippet saved on this device');
          paint();
        };
      }
    }

    paint();
  }

  // ——— Photo markup (circle / arrow / pen on canvas) ———
  function openPhotoMarkup(photo, onDone) {
    if (!photo || !photo.dataUrl) return;
    openModal(`
      <div class="modal-sheet markup-sheet">
        <h2>Mark up photo</h2>
        <p class="form-hint">Circle, arrow, or free pen in orange. Undo if needed. Done writes back over the photo.</p>
        <div class="markup-tools" role="toolbar" aria-label="Markup tools">
          <button type="button" class="btn btn-navy btn-sm markup-tool is-active" data-tool="circle">○ Circle</button>
          <button type="button" class="btn btn-outline btn-sm markup-tool" data-tool="arrow">↗ Arrow</button>
          <button type="button" class="btn btn-outline btn-sm markup-tool" data-tool="pen">✎ Pen</button>
        </div>
        <div class="markup-canvas-wrap">
          <canvas id="markup-canvas"></canvas>
        </div>
        <div class="modal-actions markup-actions">
          <button type="button" class="btn btn-outline" id="markup-cancel">Cancel</button>
          <button type="button" class="btn btn-ghost" id="markup-undo">Undo</button>
          <button type="button" class="btn btn-primary" id="markup-done">Done</button>
        </div>
      </div>`);
    $modalRoot.onclick = null;

    const canvas = document.getElementById('markup-canvas');
    const ctx = canvas.getContext('2d');
    const ink = '#FF4D00';
    const strokes = [];
    let tool = 'circle';
    let draft = null;
    let drawing = false;
    const img = new Image();

    function setTool(next) {
      tool = next;
      $modalRoot.querySelectorAll('.markup-tool').forEach((b) => {
        const on = b.getAttribute('data-tool') === tool;
        b.classList.toggle('is-active', on);
        b.classList.toggle('btn-navy', on);
        b.classList.toggle('btn-outline', !on);
      });
    }

    $modalRoot.querySelectorAll('.markup-tool').forEach((b) => {
      b.onclick = () => setTool(b.getAttribute('data-tool'));
    });

    function fit() {
      const wrap = canvas.parentElement;
      const maxW = Math.max(240, wrap.clientWidth || 320);
      const maxH = Math.min(window.innerHeight * 0.48, 520);
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (!w || !h) return;
      const scale = Math.min(maxW / w, maxH / h, 1);
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      redraw();
    }

    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      strokes.forEach(drawStroke);
      if (draft) drawStroke(draft);
    }

    function drawStroke(s) {
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = s.type === 'pen' ? 4 : 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.type === 'circle') {
        ctx.beginPath();
        ctx.arc(s.cx, s.cy, Math.max(6, s.r), 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'arrow') {
        drawArrow(s.x1, s.y1, s.x2, s.y2);
      } else if (s.type === 'pen' && s.points && s.points.length) {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawArrow(x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const head = Math.min(22, Math.max(12, len * 0.28));
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - ux * head - uy * head * 0.45, y2 - uy * head + ux * head * 0.45);
      ctx.lineTo(x2 - ux * head + uy * head * 0.45, y2 - uy * head - ux * head * 0.45);
      ctx.closePath();
      ctx.fill();
    }

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const src = e.touches && e.touches[0] ? e.touches[0] : e;
      const x = ((src.clientX - r.left) / r.width) * canvas.width;
      const y = ((src.clientY - r.top) / r.height) * canvas.height;
      return { x: x, y: y };
    }

    function onDown(e) {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      drawing = true;
      const p = pos(e);
      if (tool === 'circle') draft = { type: 'circle', cx: p.x, cy: p.y, r: 6 };
      else if (tool === 'arrow') draft = { type: 'arrow', x1: p.x, y1: p.y, x2: p.x, y2: p.y };
      else draft = { type: 'pen', points: [p] };
      redraw();
    }

    function onMove(e) {
      if (!drawing || !draft) return;
      e.preventDefault();
      const p = pos(e);
      if (draft.type === 'circle') {
        draft.r = Math.max(6, Math.hypot(p.x - draft.cx, p.y - draft.cy));
      } else if (draft.type === 'arrow') {
        draft.x2 = p.x;
        draft.y2 = p.y;
      } else {
        draft.points.push(p);
      }
      redraw();
    }

    function onUp(e) {
      if (!drawing) return;
      e.preventDefault();
      drawing = false;
      if (draft) strokes.push(draft);
      draft = null;
      redraw();
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', (e) => {
      if (drawing) onUp(e);
    });
    try {
      canvas.style.touchAction = 'none';
    } catch (_) {}

    img.onload = fit;
    img.onerror = () => toast('Could not load photo for markup');
    img.src = photo.dataUrl;

    document.getElementById('markup-cancel').onclick = () => {
      closeModal();
    };
    document.getElementById('markup-undo').onclick = () => {
      if (draft) draft = null;
      else strokes.pop();
      redraw();
    };
    document.getElementById('markup-done').onclick = () => {
      let out = photo.dataUrl;
      try {
        out = canvas.toDataURL('image/jpeg', 0.82);
      } catch (_) {}
      closeModal();
      if (onDone) onDone(out);
    };
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
              <div class="obs">${f.severity ? `<span class="sev-badge sev-${escapeHtml(f.severity)}">${escapeHtml(severityLabel(f.severity))}</span> ` : ''}${escapeHtml(f.observation)}</div>
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
