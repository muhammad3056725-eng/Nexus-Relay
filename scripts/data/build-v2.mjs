#!/usr/bin/env node
// NEXUS RELAY — dataset v2 validator + index builder.
//
//   node scripts/data/build-v2.mjs            validate, then write index.json
//   node scripts/data/build-v2.mjs --check    validate only; also fails if
//                                             index.json is stale
//   node scripts/data/build-v2.mjs --only stars   validate one category file
//
// Exit code 1 on any error. Warnings are printed but do not fail.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORIES,
  validateSubjects,
  buildIndex,
  makeResolver,
} from "./v2lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir = join(root, "public", "data", "v2");
const subjDir = join(dataDir, "subjects");
const args = process.argv.slice(2);
const check = args.includes("--check");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

export function loadAll() {
  const subjects = [];
  const errors = [];
  if (!existsSync(subjDir)) return { subjects, errors: [`missing ${subjDir}`] };
  for (const f of readdirSync(subjDir).filter((f) => f.endsWith(".json")).sort()) {
    const cat = f.replace(/\.json$/, "");
    if (only && cat !== only) continue;
    let doc;
    try {
      doc = JSON.parse(readFileSync(join(subjDir, f), "utf8"));
    } catch (e) {
      errors.push(`${f}: invalid JSON (${e.message})`);
      continue;
    }
    if (doc.category !== cat) errors.push(`${f}: "category" must be "${cat}"`);
    for (const s of doc.subjects ?? []) {
      if (s.category !== cat) errors.push(`${f}: subject ${s.id} has category ${s.category}`);
      subjects.push(s);
    }
  }
  return { subjects, errors };
}

const { subjects, errors: loadErrors } = loadAll();
const { errors, warnings } = validateSubjects(subjects);
const allErrors = [...loadErrors, ...errors].filter(
  // --only: category-size errors for the other files are irrelevant
  (e) => !(only && /^category \w+ has only/.test(e) && !e.includes(` ${only} `))
);

const resolve = makeResolver(subjects);
let linksResolved = 0;
let linksTotal = 0;
for (const s of subjects) {
  for (const l of s.links ?? []) {
    linksTotal++;
    if (resolve(l.name)) linksResolved++;
  }
}

const perCat = CATEGORIES.map((c) => `${c.id}=${subjects.filter((s) => s.category === c.id).length}`);
console.log(`subjects: ${subjects.length} (${perCat.join(", ")})`);
console.log(`links: ${linksTotal} (${linksResolved} resolve to dataset subjects)`);
for (const w of warnings) console.log(`warn: ${w}`);
for (const e of allErrors) console.log(`ERROR: ${e}`);

if (allErrors.length) {
  console.log(`FAILED with ${allErrors.length} error(s)`);
  process.exit(1);
}
if (!only) {
  const index = buildIndex(subjects);
  const text = JSON.stringify(index) + "\n";
  const indexPath = join(dataDir, "index.json");
  if (check) {
    const cur = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
    if (cur !== text) {
      console.log("ERROR: index.json is stale — run node scripts/data/build-v2.mjs");
      process.exit(1);
    }
    console.log("OK (index.json up to date)");
  } else {
    writeFileSync(indexPath, text);
    console.log(`OK — wrote ${indexPath} (${text.length} bytes)`);
  }
} else {
  console.log(`OK (${only} only)`);
}
