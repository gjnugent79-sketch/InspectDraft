/* InspectDraft — sections, seed data, stub AI structuring */

const SECTIONS = [
  { id: 'roof', name: 'Roof', icon: '🏠' },
  { id: 'exterior', name: 'Exterior', icon: '🧱' },
  { id: 'structure', name: 'Structure', icon: '🏗' },
  { id: 'electrical', name: 'Electrical', icon: '⚡' },
  { id: 'plumbing', name: 'Plumbing', icon: '🚿' },
  { id: 'hvac', name: 'HVAC', icon: '🌡' },
  { id: 'interior', name: 'Interior', icon: '🚪' },
  { id: 'insulation', name: 'Insulation / Ventilation', icon: '💨' },
  { id: 'appliances', name: 'Appliances', icon: '🔌' },
  { id: 'garage', name: 'Garage', icon: '🚗' },
  { id: 'grounds', name: 'Grounds', icon: '🌳' },
  { id: 'limitations', name: 'Limitations / Not Inspected', icon: '⚠' },
];

/** Opt-in extras — not in the section list or PDF until the inspector adds them to a job. */
const OPTIONAL_SECTIONS = [
  { id: 'pool_spa', name: 'Pool / Spa', icon: '🏊' },
  { id: 'irrigation', name: 'Irrigation / Sprinklers', icon: '💦' },
  { id: 'outbuildings', name: 'Outbuildings / Detached structures', icon: '🏚️' },
  { id: 'dock', name: 'Dock / Waterfront', icon: '⚓' },
];

const STORAGE_KEY = 'inspectdraft_v1';
const THEME_KEY = 'inspectdraft_theme';

function uid() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function emptySection() {
  return { notes: '', photos: [], findings: [] };
}

/** Icon choices for job-only custom optional systems (☰ → Add custom system). */
const CUSTOM_ICONS = [
  { key: 'house', icon: '🏠', label: 'House' },
  { key: 'pool', icon: '🏊', label: 'Pool' },
  { key: 'sun', icon: '☀️', label: 'Solar' },
  { key: 'tree', icon: '🌳', label: 'Tree' },
  { key: 'fence', icon: '🚧', label: 'Fence' },
  { key: 'flame', icon: '🔥', label: 'Flame' },
  { key: 'droplet', icon: '💧', label: 'Water' },
  { key: 'wrench', icon: '🔧', label: 'Wrench' },
  { key: 'camera', icon: '📷', label: 'Camera' },
  { key: 'bolt', icon: '⚡', label: 'Bolt' },
  { key: 'shield', icon: '🛡️', label: 'Shield' },
  { key: 'warehouse', icon: '🏭', label: 'Warehouse' },
];

function createJob(meta) {
  const sections = {};
  SECTIONS.forEach((s) => { sections[s.id] = emptySection(); });
  return {
    id: uid(),
    address: meta.address || '',
    client: meta.client || '',
    date: meta.date || new Date().toISOString().slice(0, 10),
    inspector: meta.inspector || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSample: !!meta.isSample,
    /** Ids from OPTIONAL_SECTIONS the inspector opted into for this job. Default: none. */
    optionalSectionIds: Array.isArray(meta.optionalSectionIds) ? meta.optionalSectionIds.slice() : [],
    /** Job-only custom optionals: { id, title, iconKey }. Default: none. */
    customSections: Array.isArray(meta.customSections) ? meta.customSections.map(normalizeCustomSection).filter(Boolean) : [],
    sections,
  };
}

function normalizeCustomSection(c) {
  if (!c || typeof c !== 'object') return null;
  const title = String(c.title || '').trim();
  if (!title) return null;
  let id = String(c.id || '').trim();
  if (!id) id = 'custom_' + uid().replace(/^id_/, '');
  if (!id.startsWith('custom_')) id = 'custom_' + id;
  const iconKey = CUSTOM_ICONS.some((i) => i.key === c.iconKey) ? c.iconKey : CUSTOM_ICONS[0].key;
  return { id, title, iconKey };
}

function getCustomIcon(iconKey) {
  const found = CUSTOM_ICONS.find((i) => i.key === iconKey);
  return found || CUSTOM_ICONS[0];
}

function customToSectionDef(c) {
  const icon = getCustomIcon(c.iconKey);
  return { id: c.id, name: c.title, icon: icon.icon, iconKey: icon.key, custom: true };
}

function allSectionDefs() {
  return SECTIONS.concat(OPTIONAL_SECTIONS);
}

function getSectionDef(id, job) {
  const core = allSectionDefs().find((s) => s.id === id);
  if (core) return core;
  if (job) {
    ensureJobShape(job);
    const c = job.customSections.find((x) => x.id === id);
    if (c) return customToSectionDef(c);
  }
  return null;
}

function isPresetOptionalId(id) {
  return OPTIONAL_SECTIONS.some((s) => s.id === id);
}

/** True for preset optionals, or custom_* ids (optionally verified against a job). */
function isOptionalSectionId(id, job) {
  if (isPresetOptionalId(id)) return true;
  if (typeof id === 'string' && id.startsWith('custom_')) {
    if (!job) return true;
    ensureJobShape(job);
    return job.customSections.some((c) => c.id === id);
  }
  return false;
}

function isSectionOnJob(job, id) {
  ensureJobShape(job);
  if (SECTIONS.some((s) => s.id === id)) return true;
  if (job.optionalSectionIds.includes(id)) return true;
  return job.customSections.some((c) => c.id === id);
}

/** Migrate older jobs and keep section blobs in sync with optionalSectionIds + customSections. */
function ensureJobShape(job) {
  if (!job) return job;
  if (!job.sections || typeof job.sections !== 'object') job.sections = {};
  if (!Array.isArray(job.optionalSectionIds)) job.optionalSectionIds = [];
  if (!Array.isArray(job.customSections)) job.customSections = [];
  // Dedupe + drop unknown preset optional ids
  const seen = new Set();
  job.optionalSectionIds = job.optionalSectionIds.filter((id) => {
    if (!isPresetOptionalId(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  // Normalize customs; drop empties; dedupe by id
  const customSeen = new Set();
  job.customSections = job.customSections
    .map(normalizeCustomSection)
    .filter((c) => {
      if (!c || customSeen.has(c.id)) return false;
      customSeen.add(c.id);
      return true;
    });
  SECTIONS.forEach((s) => {
    if (!job.sections[s.id]) job.sections[s.id] = emptySection();
  });
  job.optionalSectionIds.forEach((id) => {
    if (!job.sections[id]) job.sections[id] = emptySection();
  });
  job.customSections.forEach((c) => {
    if (!job.sections[c.id]) job.sections[c.id] = emptySection();
  });
  return job;
}

/** Core 12 + selected presets + custom optionals (core first, then optionals as added). */
function getActiveSections(job) {
  ensureJobShape(job);
  const optionals = job.optionalSectionIds
    .map((id) => OPTIONAL_SECTIONS.find((s) => s.id === id))
    .filter(Boolean);
  const customs = job.customSections.map(customToSectionDef);
  return SECTIONS.concat(optionals).concat(customs);
}

function getAvailableOptionals(job) {
  ensureJobShape(job);
  const selected = new Set(job.optionalSectionIds);
  return OPTIONAL_SECTIONS.filter((s) => !selected.has(s.id));
}

function addOptionalToJob(job, sectionId) {
  ensureJobShape(job);
  if (!isPresetOptionalId(sectionId)) return false;
  if (job.optionalSectionIds.includes(sectionId)) return false;
  job.optionalSectionIds.push(sectionId);
  if (!job.sections[sectionId]) job.sections[sectionId] = emptySection();
  return true;
}

/** Create a job-only custom optional system. Returns the entry or null. */
function addCustomToJob(job, title, iconKey) {
  ensureJobShape(job);
  const name = String(title || '').trim();
  if (!name) return null;
  const icon = getCustomIcon(iconKey);
  const id = 'custom_' + uid().replace(/^id_/, '');
  const entry = { id, title: name, iconKey: icon.key };
  job.customSections.push(entry);
  job.sections[id] = emptySection();
  return entry;
}

function removeOptionalFromJob(job, sectionId) {
  ensureJobShape(job);
  let removed = false;
  if (job.optionalSectionIds.includes(sectionId)) {
    job.optionalSectionIds = job.optionalSectionIds.filter((id) => id !== sectionId);
    removed = true;
  }
  const before = job.customSections.length;
  job.customSections = job.customSections.filter((c) => c.id !== sectionId);
  if (job.customSections.length !== before) removed = true;
  if (removed) delete job.sections[sectionId];
  return removed;
}

/**
 * Stub AI: splits inspector notes into Finding {observation, recommendation}.
 * Heuristics only — never invents defects beyond the inspector's words.
 * Label as stub AI in the UI.
 */
function structureNotesStub(rawNotes) {
  if (!rawNotes || !rawNotes.trim()) return [];

  const text = rawNotes.trim();

  // Split on blank lines, numbered items, bullets, or sentence-ish boundaries with defect keywords
  let chunks = text
    .split(/\n\s*\n+|\n(?=[-•*]|\d+[.)]\s)/)
    .map((c) => c.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean);

  // If still one big blob, try splitting on periods that look like separate findings
  if (chunks.length === 1 && text.length > 120) {
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 1) {
      // Group short sentences; keep longer ones as findings
      chunks = [];
      let buf = '';
      sentences.forEach((s) => {
        const t = s.trim();
        if (t.length < 40 && buf) {
          buf += ' ' + t;
        } else if (t.length < 40) {
          buf = t;
        } else {
          if (buf) { chunks.push(buf); buf = ''; }
          chunks.push(t);
        }
      });
      if (buf) chunks.push(buf);
    }
  }

  const recPatterns = [
    /(?:recommend(?:ed|ation)?|suggest(?:ed|ion)?|advise[d]?|should|needs?\s+to|consider|monitor|repair|replace|further\s+evaluat)\b[:\s-]*/i,
    /\b(?:rec\.?|action)\s*[:\-]\s*/i,
  ];

  return chunks.map((chunk) => {
    let observation = chunk;
    let recommendation = '';

    // Explicit "Observation / Recommendation" labels
    const labeled = chunk.match(
      /(?:observation|obs|finding|issue)\s*[:\-]\s*(.+?)(?:\n|(?=(?:recommendation|rec|action)\s*[:\-]))/is
    );
    const labeledRec = chunk.match(/(?:recommendation|rec\.?|action)\s*[:\-]\s*(.+)/is);
    if (labeled && labeledRec) {
      return {
        id: uid(),
        observation: labeled[1].trim(),
        recommendation: labeledRec[1].trim(),
      };
    }

    // Split on recommendation keywords
    for (const re of recPatterns) {
      const m = chunk.match(re);
      if (m && m.index > 10) {
        observation = chunk.slice(0, m.index).trim().replace(/[.;,\s]+$/, '');
        recommendation = chunk.slice(m.index).replace(re, '').trim();
        // Clean leading connector words from recommendation
        recommendation = recommendation.replace(/^(that|to|:|-)\s+/i, '').trim();
        break;
      }
    }

    // If no explicit rec, leave recommendation empty (inspector can fill)
    // Don't invent one — product rule: AI structures inspector's own words only
    if (!recommendation) {
      // Soft hint: if chunk ends with imperative-looking phrase after semicolon
      const semi = chunk.split(/;\s+/);
      if (semi.length === 2 && semi[1].length > 15) {
        observation = semi[0].trim();
        recommendation = semi[1].trim();
      }
    }

    return {
      id: uid(),
      observation: observation || chunk,
      recommendation: recommendation || '',
    };
  }).filter((f) => f.observation.length > 0);
}

function buildSampleJob() {
  const job = createJob({
    address: '1847 Maple Creek Dr, Austin, TX 78745',
    client: 'Jordan & Alex Rivera',
    date: '2026-09-05',
    inspector: 'Gary Nugent',
    isSample: true,
  });

  job.sections.roof = {
    notes:
      'Asphalt shingles appear mid-life, approx 12–15 years. Several lifted tabs at rear slope near ridge vent. Flashing at chimney shows minor surface rust; no active leak evidence in attic below. Gutters clogged with debris on north side.\n\nRecommend sealing or replacing lifted tabs and clearing gutters. Chimney flashing should be monitored; further evaluation by a roofer if staining appears.',
    photos: [],
    findings: [
      {
        id: uid(),
        observation: 'Several lifted asphalt shingle tabs at rear slope near ridge vent; shingles appear mid-life (~12–15 years).',
        recommendation: 'Seal or replace lifted tabs; have a qualified roofer evaluate remaining service life.',
      },
      {
        id: uid(),
        observation: 'Chimney flashing shows minor surface rust; no active leak evidence observed in attic below.',
        recommendation: 'Monitor for staining; further evaluation by a roofing professional if conditions change.',
      },
      {
        id: uid(),
        observation: 'Gutters clogged with debris on the north side.',
        recommendation: 'Clear gutters and downspouts to maintain proper drainage.',
      },
    ],
  };

  job.sections.electrical = {
    notes:
      'Panel is 200A Federal Pacific — double-pole breakers present. Two open knockouts at bottom of panel. GFCI outlet in hall bath did not trip when tested. Smoke detectors present but battery chirp noted in upstairs hallway.',
    photos: [],
    findings: [
      {
        id: uid(),
        observation: 'Service panel labeled Federal Pacific (200A) with double-pole breakers present.',
        recommendation: 'Federal Pacific panels have a history of concerns; recommend evaluation by a licensed electrician for replacement consideration.',
      },
      {
        id: uid(),
        observation: 'Two open knockouts at bottom of electrical panel.',
        recommendation: 'Install knockout seals to maintain enclosure integrity.',
      },
      {
        id: uid(),
        observation: 'GFCI outlet in hall bath did not trip when tested.',
        recommendation: 'Repair or replace GFCI; verify protection for bathroom circuits.',
      },
      {
        id: uid(),
        observation: 'Smoke detector in upstairs hallway emitting battery chirp.',
        recommendation: 'Replace batteries or unit; test all smoke/CO detectors.',
      },
    ],
  };

  job.sections.plumbing = {
    notes:
      'Water heater is 40-gal gas unit, manufactured 2014. TPR valve discharge pipe terminates too high above floor. Soft water supply noted; no active leaks under sinks. Exterior hose bib at rear drips when shut off.',
    photos: [],
    findings: [
      {
        id: uid(),
        observation: 'Water heater TPR valve discharge pipe terminates too high above the floor.',
        recommendation: 'Extend discharge pipe to within 6 inches of floor per typical code guidance; verify with local requirements.',
      },
      {
        id: uid(),
        observation: 'Exterior hose bib at rear drips when shut off.',
        recommendation: 'Repair or replace hose bib packing/valve to stop drip.',
      },
    ],
  };

  job.sections.hvac = {
    notes: 'Furnace and AC operated during inspection. Filter dirty / overdue for change. Condensate drain line clear. Supply temps within expected range at registers sampled.',
    photos: [],
    findings: [
      {
        id: uid(),
        observation: 'HVAC filter dirty / overdue for change.',
        recommendation: 'Replace filter now and maintain on manufacturer schedule.',
      },
    ],
  };

  job.sections.exterior = {
    notes: 'Wood siding at west elevation shows peeling paint and soft spots at lower courses near grade. Caulk gaps at window trim south side.',
    photos: [],
    findings: [],
  };

  job.sections.grounds = {
    notes: 'Grading slopes toward foundation at NW corner. Fence gate latch broken. Driveway has typical hairline cracks.',
    photos: [],
    findings: [
      {
        id: uid(),
        observation: 'Grading slopes toward foundation at northwest corner.',
        recommendation: 'Regrade to slope away from foundation; improve drainage as needed.',
      },
    ],
  };

  job.sections.limitations = {
    notes:
      'Attic access limited by stored items — partial visual only.\nRoof walked at edges only due to pitch; center inspected from ground and drone where available.\nCrawlspace not entered — no access hatch located.\nNot inspected: security system, irrigation controller programming, pool (N/A).',
    photos: [],
    findings: [
      {
        id: uid(),
        observation: 'Attic access limited by stored items — partial visual only.',
        recommendation: '',
      },
      {
        id: uid(),
        observation: 'Crawlspace not entered — no access hatch located.',
        recommendation: '',
      },
    ],
  };

  // Leave structure, interior, insulation, appliances, garage empty → "Not recorded"
  // Preset optionals stay OFF by default — add via "＋ Add optional system".
  // Job-only customs: ☰ Add custom system (name + icon).
  return job;
}

function defaultStore() {
  return {
    jobs: [buildSampleJob()],
    version: 1,
  };
}
