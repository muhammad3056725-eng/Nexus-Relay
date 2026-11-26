// NEXUS RELAY — dataset v2 shared library (schema, leakage audit,
// validation, index builder). Plain ESM JavaScript so it runs under
// bare Node (scripts/data/build-v2.mjs) AND is imported by the vitest
// suite (apps/web/test/dataset.test.ts) — one source of truth.
//
// Authored source of truth: public/data/v2/subjects/<category>.json
//   { "category": "<id>", "subjects": [ Subject, ... ] }
// Derived (generated, committed): public/data/v2/index.json
//
// Subject:
//   id          slug of name (lowercase a-z0-9 and "-"), unique
//   name        display name
//   aliases     accepted alternative spellings (may be [])
//   category    one of CATEGORIES ids (must match the file)
//   sub         subcategory label, Title Case (e.g. "Footballer")
//   year        signed integer anchor (birth year for people,
//               release / build / event year otherwise) or null
//   region      one of REGIONS
//   difficulty  1 (very well known) .. 3 (known to keen players)
//   clues       exactly 5 strings, vague -> obvious, never naming
//               the answer (see leakProblems)
//   links       1-3 { name, rel } real connections ("<name of
//               subject> <rel> <link name>", e.g. "stands in")
//   fact        optional one-line fun fact shown after the reveal

export const CATEGORIES = [
  { id: "stars", name: "Film & TV Stars", icon: "🎬" },
  { id: "music", name: "Music Legends", icon: "🎵" },
  { id: "sport", name: "Sports", icon: "🏆" },
  { id: "minds", name: "Great Minds", icon: "🧪" },
  { id: "history", name: "History & Leaders", icon: "🏛️" },
  { id: "places", name: "Countries & Cities", icon: "🌍" },
  { id: "landmarks", name: "Landmarks & Wonders", icon: "🗼" },
  { id: "screen", name: "Movies, TV & Games", icon: "🍿" },
  { id: "nature", name: "Animals & Nature", icon: "🐾" },
  { id: "food", name: "Food & Drink", icon: "🍕" },
  { id: "tech", name: "Tech & Brands", icon: "💡" },
  { id: "arts", name: "Art, Books & Myths", icon: "🎨" },
  { id: "space", name: "Space", icon: "🚀" },
];

export const REGIONS = [
  "Europe",
  "North America",
  "Latin America",
  "Africa",
  "Middle East",
  "South Asia",
  "East Asia",
  "Southeast Asia",
  "Oceania",
  "Global",
  "Space",
];

const STOP = new Set(
  ("the of and a an in on at to for with from by de la le les el los las " +
    "van von der den da di du des del y e o saint st mr mrs dr sir")
    .split(" ")
);

// Generic words that may appear in a clue even when they are part of
// the answer's name ("This suspension bridge…" for Golden Gate Bridge).
// The FULL name phrase is still always forbidden.
const GENERIC = new Set(
  ("great grand big little old new north south east west northern southern " +
    "eastern western central upper lower river lake mount mountain mountains " +
    "falls island islands sea ocean bay desert canyon forest park national " +
    "tower bridge palace castle temple cathedral church abbey mosque wall " +
    "square house museum statue city state states united kingdom republic " +
    "empire war wars world battle revolution first second third king queen " +
    "prince princess lord lady game games show movie film series story man " +
    "men woman women boy girl day night star stars black white red blue " +
    "green golden gold silver one two three ii iii iv vi " +
    "company inc corp group band club cup league team " +
    "dog cat bear fish bird tree flower cheese cake bread soup sauce " +
    "chicken rice pie tea juice wine beer coffee salad")
    .split(" ")
);

/** Lowercase, strip diacritics, unify apostrophes/ampersands. */
export function normalize(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "");
}

export function words(s) {
  return normalize(s).split(/[^a-z0-9]+/).filter(Boolean);
}

export function slug(s) {
  return words(s).join("-");
}

/** Identifying tokens of a name: not stopwords, not generic, len >= 3. */
export function nameTokens(name) {
  return words(name).filter(
    (t) => t.length >= 3 && !STOP.has(t) && !GENERIC.has(t)
  );
}

function tokenHit(token, word) {
  if (word === token) return true;
  if (token.length >= 5) {
    return word.startsWith(token.slice(0, Math.max(4, token.length - 2)));
  }
  if (token.length === 4) {
    return word.startsWith(token) && word.length <= 7;
  }
  return false;
}

/**
 * Leakage audit for one subject: no clue may contain the answer's
 * name / alias phrase, or any identifying token of them (or an
 * obvious lexical root, e.g. "Italian" for Italy). Returns a list of
 * human-readable problems ([] = clean).
 */
export function leakProblems(subject) {
  const problems = [];
  const forms = [subject.name, ...(subject.aliases ?? [])];
  const phrases = forms.map((f) => words(f).join(" ")).filter(Boolean);
  const tokens = [...new Set(forms.flatMap(nameTokens))];
  (subject.clues ?? []).forEach((clue, i) => {
    const cw = words(clue);
    const joined = " " + cw.join(" ") + " ";
    for (const p of phrases) {
      if (joined.includes(" " + p + " ")) {
        problems.push(`clue ${i + 1} contains the name phrase "${p}"`);
      }
    }
    for (const t of tokens) {
      const hit = cw.find((w) => tokenHit(t, w));
      if (hit) problems.push(`clue ${i + 1} leaks "${t}" (word "${hit}")`);
    }
  });
  return problems;
}

/** Era label derived from the year anchor. */
export function eraLabel(year) {
  if (year == null) return "Timeless";
  if (year < 0) {
    const c = Math.ceil(-year / 100);
    return `${ordinal(c)} century BCE`;
  }
  if (year >= 1900) return `${Math.floor(year / 10) * 10}s`;
  return `${ordinal(Math.floor((year - 1) / 100) + 1)} century`;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Validate all subjects. Returns { errors: string[], warnings: string[] }. */
export function validateSubjects(subjects) {
  const errors = [];
  const warnings = [];
  const catIds = new Set(CATEGORIES.map((c) => c.id));
  const ids = new Map();
  const names = new Map();
  const bySub = new Map();
  for (const s of subjects) {
    const where = `[${s.category}/${s.id ?? s.name}]`;
    const err = (m) => errors.push(`${where} ${m}`);
    if (typeof s.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id))
      err("bad id");
    if (typeof s.name !== "string" || s.name.trim().length < 2) err("bad name");
    if (s.id !== slug(s.name)) err(`id should be "${slug(s.name)}"`);
    if (ids.has(s.id)) err(`duplicate id (also in ${ids.get(s.id)})`);
    ids.set(s.id, s.category);
    const nk = words(s.name).join(" ");
    if (names.has(nk)) err(`duplicate name (also in ${names.get(nk)})`);
    names.set(nk, s.category);
    if (!Array.isArray(s.aliases)) err("aliases must be an array");
    if (!catIds.has(s.category)) err("unknown category");
    if (typeof s.sub !== "string" || s.sub.length < 2) err("bad sub");
    if (!(s.year === null || Number.isInteger(s.year))) err("year must be int or null");
    if (Number.isInteger(s.year) && (s.year < -5000 || s.year > 2026))
      err(`year out of range: ${s.year}`);
    if (!REGIONS.includes(s.region)) err(`bad region "${s.region}"`);
    if (![1, 2, 3].includes(s.difficulty)) err("difficulty must be 1-3");
    if (!Array.isArray(s.clues) || s.clues.length !== 5) {
      err("needs exactly 5 clues");
    } else {
      s.clues.forEach((c, i) => {
        if (typeof c !== "string" || c.trim().length < 12)
          err(`clue ${i + 1} too short`);
        else if (c.length > 160) err(`clue ${i + 1} too long (${c.length})`);
      });
      if (new Set(s.clues).size !== 5) err("duplicate clues");
    }
    if (!Array.isArray(s.links) || s.links.length < 1 || s.links.length > 3) {
      err("needs 1-3 links");
    } else {
      for (const l of s.links) {
        if (!l || typeof l.name !== "string" || l.name.length < 2)
          err("link missing name");
        else if (typeof l.rel !== "string" || l.rel.length < 2)
          err(`link "${l.name}" missing rel`);
        else if (words(l.name).join(" ") === nk) err("links to itself");
      }
    }
    if (s.fact != null && (typeof s.fact !== "string" || s.fact.length > 200))
      err("fact must be a string <= 200 chars");
    for (const p of leakProblems(s)) err(p);
    const key = `${s.category}|${s.sub}`;
    bySub.set(key, (bySub.get(key) ?? 0) + 1);
  }
  // Category balance + distractor supply.
  for (const c of CATEGORIES) {
    const n = subjects.filter((s) => s.category === c.id).length;
    if (n < 4) errors.push(`category ${c.id} has only ${n} subjects`);
    else if (n < 40) warnings.push(`category ${c.id} has only ${n} subjects`);
  }
  for (const [key, n] of bySub) {
    if (n < 4) warnings.push(`subcategory ${key} has ${n} subject(s) (<4: distractors borrow from the category)`);
  }
  return { errors, warnings };
}

/** Resolve a link name to a subject id via name / alias, or null. */
export function makeResolver(subjects) {
  const m = new Map();
  for (const s of subjects) {
    for (const f of [s.name, ...(s.aliases ?? [])]) {
      const k = words(f).join(" ");
      if (!m.has(k)) m.set(k, s.id);
    }
  }
  return (name) => m.get(words(name).join(" ")) ?? null;
}

/** Lightweight index the client loads first (no clues). */
export function buildIndex(subjects, version = "2.0.0") {
  const counts = new Map();
  for (const s of subjects) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  const sorted = [...subjects].sort(
    (a, b) =>
      CATEGORIES.findIndex((c) => c.id === a.category) -
        CATEGORIES.findIndex((c) => c.id === b.category) ||
      a.id.localeCompare(b.id)
  );
  return {
    version,
    count: subjects.length,
    categories: CATEGORIES.map((c) => ({
      ...c,
      file: `subjects/${c.id}.json`,
      count: counts.get(c.id) ?? 0,
    })),
    subjects: sorted.map((s) => {
      const row = {
        id: s.id,
        n: s.name,
        c: s.category,
        s: s.sub,
        y: s.year,
        r: s.region,
        d: s.difficulty,
      };
      if (s.aliases && s.aliases.length) row.a = s.aliases;
      return row;
    }),
  };
}
