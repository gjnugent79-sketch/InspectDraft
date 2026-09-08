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

/** Icon choices for job-only custom optional systems (Custom → Add custom system). */
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
        severity: 'major',
      },
      {
        id: uid(),
        observation: 'Chimney flashing shows minor surface rust; no active leak evidence observed in attic below.',
        recommendation: 'Monitor for staining; further evaluation by a roofing professional if conditions change.',
        severity: 'maintenance',
      },
      {
        id: uid(),
        observation: 'Gutters clogged with debris on the north side.',
        recommendation: 'Clear gutters and downspouts to maintain proper drainage.',
        severity: 'maintenance',
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
        severity: 'major',
      },
      {
        id: uid(),
        observation: 'Two open knockouts at bottom of electrical panel.',
        recommendation: 'Install knockout seals to maintain enclosure integrity.',
        severity: 'safety',
      },
      {
        id: uid(),
        observation: 'GFCI outlet in hall bath did not trip when tested.',
        recommendation: 'Repair or replace GFCI; verify protection for bathroom circuits.',
        severity: 'safety',
      },
      {
        id: uid(),
        observation: 'Smoke detector in upstairs hallway emitting battery chirp.',
        recommendation: 'Replace batteries or unit; test all smoke/CO detectors.',
        severity: 'safety',
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
        severity: 'safety',
      },
      {
        id: uid(),
        observation: 'Exterior hose bib at rear drips when shut off.',
        recommendation: 'Repair or replace hose bib packing/valve to stop drip.',
        severity: 'maintenance',
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
        severity: 'maintenance',
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
        severity: 'major',
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
  // Job-only customs: Custom → Add custom system (name + icon).
  return job;
}

function defaultStore() {
  return {
    jobs: [buildSampleJob()],
    version: 1,
  };
}

/** localStorage key for user-saved comment snippets */
const SNIPPETS_KEY = 'inspectdraft_snippets_custom';

/**
 * Pre-populated US home-inspection style observation snippets by system.
 * Observation-oriented wording — not legal advice or code citations as mandates.
 */
const SNIPPET_LIBRARY = {
  roof: [
    { text: 'Asphalt shingles show granule loss and weathering consistent with age; remaining service life appears limited in areas observed.', severity: 'maintenance' },
    { text: 'Lifted or missing shingle tabs noted at slope; fasteners/underlayment may be exposed to weather.', severity: 'major' },
    { text: 'Flashing at chimney/wall intersection shows gaps, rust, or incomplete sealant; potential moisture entry point.', severity: 'major' },
    { text: 'Gutters and/or downspouts clogged with debris or disconnected; roof drainage may not discharge clear of the foundation.', severity: 'maintenance' },
    { text: 'Roof covering inspected from ground / edges only due to pitch or access; center areas not walked.', severity: '' },
    { text: 'Evidence of prior repairs (patched areas / mismatched materials) observed; no active leak confirmed from limited view.', severity: 'maintenance' },
  ],
  exterior: [
    { text: 'Siding/trim shows peeling finish and/or soft spots near grade; moisture exposure may continue if unfinished.', severity: 'major' },
    { text: 'Gaps in caulk/sealant at window and door trim; weather intrusion possible at openings.', severity: 'maintenance' },
    { text: 'Exterior grade or hardscape slopes toward the foundation in area(s) noted; surface water may concentrate at the wall.', severity: 'major' },
    { text: 'Cracks in exterior cladding or stucco; typical shrinkage vs structural movement not fully determined from visual inspection.', severity: 'maintenance' },
    { text: 'Fascia/soffit damage or openings that may allow pest or weather entry.', severity: 'maintenance' },
    { text: 'Exterior hose bib drips when shut off or lacks backflow protection where expected.', severity: 'maintenance' },
  ],
  structure: [
    { text: 'Visible cracks in foundation wall or slab; width/pattern noted for monitoring. Full structural analysis beyond scope of this inspection.', severity: 'major' },
    { text: 'Wood framing members show staining, notching, or prior modification in accessible areas.', severity: 'maintenance' },
    { text: 'Settlement or out-of-level floors observed in area(s) noted; further evaluation by a structural professional recommended if progressive.', severity: 'major' },
    { text: 'Crawlspace or basement shows elevated moisture indicators (staining, efflorescence, musty odor) where accessed.', severity: 'major' },
    { text: 'Support posts/piers appear out of plumb or lacking positive connection where visible.', severity: 'safety' },
    { text: 'Limited structural view due to finishes, insulation, or stored items — observations from accessible areas only.', severity: '' },
  ],
  electrical: [
    { text: 'GFCI receptacle did not trip when tested; ground-fault protection may not be functional at this outlet.', severity: 'safety' },
    { text: 'Open knockouts or missing cover(s) at panel/junction; enclosure integrity incomplete.', severity: 'safety' },
    { text: 'Double-tapped breaker(s) or shared neutral concerns observed at the service panel where visible.', severity: 'safety' },
    { text: 'Smoke and/or CO detector missing, chirping, or not responding to test in area(s) noted.', severity: 'safety' },
    { text: 'Ungrounded three-prong receptacles present; equipment grounding path not verified at those locations.', severity: 'major' },
    { text: 'Panel directory incomplete or inaccurate; circuit identification should be updated for safety.', severity: 'maintenance' },
    { text: 'Extension cords or temporary wiring used as permanent circuits in area(s) observed.', severity: 'safety' },
  ],
  plumbing: [
    { text: 'Active drip or evidence of prior leak under sink/fixture; supply or drain components may need repair.', severity: 'major' },
    { text: 'TPR valve discharge pipe on water heater missing, capped, or terminates improperly relative to floor/drain.', severity: 'safety' },
    { text: 'Water heater age/condition suggests limited remaining service life; no active leak observed at time of inspection.', severity: 'maintenance' },
    { text: 'Low flow, noisy valves, or fixture not secured; functional issue noted at location inspected.', severity: 'maintenance' },
    { text: 'Supply piping is galvanized or mixed materials; corrosion/restriction possible over time.', severity: 'maintenance' },
    { text: 'Main shutoff location identified / not readily accessible — confirm for emergency use.', severity: '' },
  ],
  hvac: [
    { text: 'Filter dirty or overdue for replacement; airflow and indoor air quality may be affected.', severity: 'maintenance' },
    { text: 'System operated at time of inspection; unusual noise, odor, or weak airflow noted at register(s) sampled.', severity: 'major' },
    { text: 'Condensate drain or pan shows algae, standing water, or improper termination.', severity: 'maintenance' },
    { text: 'Outdoor condenser coils dirty or clearance restricted by vegetation/debris.', severity: 'maintenance' },
    { text: 'Combustion appliance flue/venting concerns (clearance, slope, termination) where visible — further evaluation advised.', severity: 'safety' },
    { text: 'No heat/cool call possible due to outdoor temperature or thermostat setback; limited operational test performed.', severity: '' },
  ],
  interior: [
    { text: 'Doors/windows bind, do not latch, or show out-of-square openings in area(s) noted.', severity: 'maintenance' },
    { text: 'Ceiling or wall stains consistent with prior moisture; source not confirmed active at time of inspection.', severity: 'major' },
    { text: 'Missing or loose handrail / guardrail at stairs or elevated areas.', severity: 'safety' },
    { text: 'Floor covering damaged, loose, or uneven transitions creating trip potential.', severity: 'safety' },
    { text: 'Interior finishes show typical wear; cosmetic items noted for buyer awareness only.', severity: 'maintenance' },
    { text: 'Attic access restricted by stored items or insulation — partial visual inspection only.', severity: '' },
  ],
  insulation: [
    { text: 'Attic insulation depth appears below current common practice in areas viewed; energy performance may be limited.', severity: 'maintenance' },
    { text: 'Bath/kitchen exhaust does not terminate outdoors or duct is disconnected/damaged where visible.', severity: 'major' },
    { text: 'Attic ventilation (soffit/ridge/gable) appears blocked or insufficient relative to attic size.', severity: 'maintenance' },
    { text: 'Evidence of moisture or fungal growth on roof sheathing in attic where accessed.', severity: 'major' },
    { text: 'Crawlspace vapor barrier missing, incomplete, or standing water present where entered.', severity: 'major' },
  ],
  appliances: [
    { text: 'Appliance operated through basic cycle where accessible; unusual noise, leak, or failure to start noted.', severity: 'major' },
    { text: 'Dishwasher drain/high loop or air gap arrangement appears improper where visible.', severity: 'maintenance' },
    { text: 'Range anti-tip bracket not confirmed installed; tip-over risk if missing.', severity: 'safety' },
    { text: 'Garbage disposer hums or does not operate; further evaluation/repair recommended.', severity: 'maintenance' },
    { text: 'Built-in appliances aged; remaining life uncertain — budget for eventual replacement.', severity: 'maintenance' },
  ],
  garage: [
    { text: 'Garage door opener auto-reverse / photo-eye safety features did not respond as expected when tested.', severity: 'safety' },
    { text: 'Fire separation (door/drywall) between garage and living space incomplete or damaged where visible.', severity: 'safety' },
    { text: 'Vehicle door springs, cables, or tracks show wear; professional service recommended before failure.', severity: 'major' },
    { text: 'Floor drain or slab cracks with moisture evidence in garage.', severity: 'maintenance' },
    { text: 'Gas-fired appliance in garage lacks adequate elevation/protection from vehicle impact where required by common practice.', severity: 'safety' },
  ],
  grounds: [
    { text: 'Grading and/or drainage directs surface water toward the foundation in area(s) noted.', severity: 'major' },
    { text: 'Trees/vegetation in contact with roof or siding; abrasion and moisture retention possible.', severity: 'maintenance' },
    { text: 'Walkways/driveway have trip hazards, settled sections, or significant cracking.', severity: 'safety' },
    { text: 'Fence/gate hardware damaged or gates do not latch securely.', severity: 'maintenance' },
    { text: 'Retaining wall shows lean, cracks, or drainage weep concerns where visible.', severity: 'major' },
  ],
  limitations: [
    { text: 'Area not inspected due to lack of access, locked spaces, or unsafe conditions at time of visit.', severity: '' },
    { text: 'Systems shut down, winterized, or utilities off — operational testing limited or not performed.', severity: '' },
    { text: 'Inspection is visual and non-invasive; concealed conditions may exist behind finishes.', severity: '' },
    { text: 'Weather / lighting / occupancy limited full evaluation of exterior or roof surfaces.', severity: '' },
  ],
  pool_spa: [
    { text: 'Pool/spa barrier, gate self-close/self-latch, or alarms do not appear to meet common safety expectations where checked.', severity: 'safety' },
    { text: 'Equipment (pump/filter/heater) leaked, noisy, or did not operate during limited test.', severity: 'major' },
    { text: 'Visible cracks, staining, or deterioration at shell/deck; further evaluation by a pool specialist recommended.', severity: 'major' },
    { text: 'Electrical bonding/equipotential grid and GFCI protection not fully verified — specialist evaluation advised.', severity: 'safety' },
  ],
  irrigation: [
    { text: 'Sprinkler heads broken, misaligned, or spraying structure/hardscape excessively.', severity: 'maintenance' },
    { text: 'Backflow prevention device missing, damaged, or due for testing where visible.', severity: 'major' },
    { text: 'Controller/zones not fully tested; seasonal or manual operation only at time of inspection.', severity: '' },
  ],
  outbuildings: [
    { text: 'Detached structure shows weather damage, settlement, or unsafe steps/landing.', severity: 'major' },
    { text: 'Electrical in outbuilding appears improvised or unprotected; safety evaluation recommended.', severity: 'safety' },
    { text: 'Outbuilding inspected visually only; utilities and finishes limited in scope.', severity: '' },
  ],
  dock: [
    { text: 'Dock/deck boards, connections, or pilings show rot, movement, or missing fasteners where accessible.', severity: 'safety' },
    { text: 'Shoreline / waterfront structure access limited by water level or safety; partial inspection only.', severity: '' },
  ],
  general: [
    { text: 'Condition noted for further evaluation by a qualified specialist in this trade.', severity: 'major' },
    { text: 'Monitor condition and repair as needed as part of routine home maintenance.', severity: 'maintenance' },
    { text: 'Safety concern — recommend prompt attention by a qualified professional.', severity: 'safety' },
  ],
};

const SEVERITY_OPTIONS = [
  { id: '', label: 'None' },
  { id: 'safety', label: 'Safety' },
  { id: 'major', label: 'Major' },
  { id: 'maintenance', label: 'Maintenance' },
];


function severityLabel(id) {
  const s = SEVERITY_OPTIONS.find((x) => x.id === id);
  return s ? s.label : '';
}

/** Severities that auto-include a finding on the punch list (US) / snagging list (UK). */
const PUNCH_SEVERITIES = ['safety', 'major', 'maintenance'];
const PUNCH_SEV_RANK = { safety: 0, major: 1, maintenance: 2 };

function isPunchSeverity(sev) {
  return PUNCH_SEVERITIES.includes(sev);
}

/** True when finding has a punch severity or was manually flagged onPunchList. */
function isOnPunchList(finding) {
  if (!finding) return false;
  if (isPunchSeverity(finding.severity)) return true;
  return !!finding.onPunchList;
}

/**
 * Collect punch-list items across active systems (not a 13th building system).
 * Sorted: Safety → Major → Maintenance → manual adds; then by system name.
 */
function collectPunchListItems(job) {
  ensureJobShape(job);
  const items = [];
  getActiveSections(job).forEach((sec) => {
    const data = job.sections[sec.id];
    if (!data || !Array.isArray(data.findings)) return;
    data.findings.forEach((f) => {
      if (!f || !String(f.observation || '').trim()) return;
      if (!isOnPunchList(f)) return;
      items.push({
        sectionId: sec.id,
        sectionName: sec.name,
        sectionIcon: sec.icon,
        finding: f,
        viaSeverity: isPunchSeverity(f.severity),
      });
    });
  });
  items.sort((a, b) => {
    const ra = a.viaSeverity ? (PUNCH_SEV_RANK[a.finding.severity] ?? 8) : 9;
    const rb = b.viaSeverity ? (PUNCH_SEV_RANK[b.finding.severity] ?? 8) : 9;
    if (ra !== rb) return ra - rb;
    const bySec = a.sectionName.localeCompare(b.sectionName);
    if (bySec) return bySec;
    return String(a.finding.observation || '').localeCompare(String(b.finding.observation || ''));
  });
  return items;
}

/** Findings that are not on the punch list (for secondary “Other findings” UI). */
function collectOtherFindings(job) {
  ensureJobShape(job);
  const items = [];
  getActiveSections(job).forEach((sec) => {
    if (sec.id === 'limitations') return;
    const data = job.sections[sec.id];
    if (!data || !Array.isArray(data.findings)) return;
    data.findings.forEach((f) => {
      if (!f || !String(f.observation || '').trim()) return;
      if (isOnPunchList(f)) return;
      items.push({
        sectionId: sec.id,
        sectionName: sec.name,
        sectionIcon: sec.icon,
        finding: f,
      });
    });
  });
  return items;
}


function loadCustomSnippets() {
  try {
    const raw = localStorage.getItem(SNIPPETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => s && typeof s.text === 'string' && s.text.trim())
      .map((s) => ({
        id: s.id || uid(),
        category: String(s.category || 'general'),
        text: String(s.text).trim(),
        severity: ['safety', 'major', 'maintenance'].includes(s.severity) ? s.severity : '',
        custom: true,
      }));
  } catch (_) {
    return [];
  }
}

function saveCustomSnippets(list) {
  localStorage.setItem(SNIPPETS_KEY, JSON.stringify(list || []));
}

function addCustomSnippet(category, text, severity) {
  const t = String(text || '').trim();
  if (!t) return null;
  const list = loadCustomSnippets();
  const entry = {
    id: uid(),
    category: category || 'general',
    text: t,
    severity: ['safety', 'major', 'maintenance'].includes(severity) ? severity : '',
    custom: true,
  };
  list.unshift(entry);
  saveCustomSnippets(list.slice(0, 80));
  return entry;
}

function deleteCustomSnippet(id) {
  const list = loadCustomSnippets().filter((s) => s.id !== id);
  saveCustomSnippets(list);
  return list;
}

/** Built-in + custom snippets for a section id (falls back to general). */
function getSnippetsForSection(sectionId) {
  let key = sectionId;
  if (typeof key === 'string' && key.startsWith('custom_')) key = 'general';
  const builtin = (SNIPPET_LIBRARY[key] || SNIPPET_LIBRARY.general || []).map((s, i) => ({
    id: 'b_' + key + '_' + i,
    category: key,
    text: s.text,
    severity: s.severity || '',
    custom: false,
  }));
  const custom = loadCustomSnippets().filter(
    (s) => s.category === key || s.category === 'general' || s.category === sectionId
  );
  return custom.concat(builtin);
}

function formatNominatimAddress(item) {
  if (!item) return '';
  const a = item.address || {};
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || '';
  // Prefer US state abbreviation when Nominatim provides ISO3166-2-lvl4 (e.g. US-TX)
  let state = a.state || '';
  const iso = a['ISO3166-2-lvl4'] || a['ISO3166-2-lvl3'] || '';
  if (typeof iso === 'string' && /^US-[A-Z]{2}$/i.test(iso)) {
    state = iso.slice(3).toUpperCase();
  }
  const zip = a.postcode || '';
  const parts = [street, city, state, zip].filter(Boolean);
  if (street && (city || state || zip)) {
    // US-friendly: "123 Main St, City, ST 78745"
    let line = street;
    if (city) line += ', ' + city;
    if (state) line += ', ' + state;
    if (zip) line += (state ? ' ' : ', ') + zip;
    return line;
  }
  return item.display_name || parts.join(', ');
}
