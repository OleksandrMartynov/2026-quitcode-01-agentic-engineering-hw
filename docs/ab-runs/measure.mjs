// Static metrics for the A/B replication outputs in this folder.
// Usage: node docs/ab-runs/measure.mjs [exemplar-app noExemplar-app]
// With the two app paths (the two experiment bases, see ../ab-experiment.md),
// every file is also type-checked inside the project it was written for.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((name) => name.endsWith('.tsx')).sort();
const usage = JSON.parse(readFileSync(join(here, 'usage.json'), 'utf8'));
const SETTINGS_FIELDS = [
  'mode', 'size', 'winLength', 'opponent', 'difficulty', 'turnSeconds', 'playerXName', 'playerOName',
];

const count = (source, pattern) => (source.match(pattern) ?? []).length;

const tscErrors = {};
const [exemplarApp, noExemplarApp] = process.argv.slice(2);
const bases = { exemplar: exemplarApp, noExemplar: noExemplarApp };

const typeCheck = (appPath, batch) => {
  const target = join(appPath, 'components', '__ab__');
  mkdirSync(target, { recursive: true });
  for (const file of batch) cpSync(join(here, file), join(target, file));
  let output = '';
  try {
    execSync('npx tsc --noEmit', { cwd: appPath, stdio: 'pipe' });
  } catch (error) {
    output = String(error.stdout ?? '');
    // tsc exits non-zero both for type errors and for failing to check at all.
    // Only per-file diagnostics, "path(line,col): error TS…", mean the files
    // were checked. No diagnostics (npx failed) or a global one such as
    // TS18003 "No inputs were found" is a broken check, never "0 errors".
    const diagnostics = output.split('\n').filter((line) => /error TS\d+/.test(line));
    const global = diagnostics.filter((line) => !/\(\d+,\d+\): error TS\d+/.test(line));
    if (diagnostics.length === 0 || global.length > 0) {
      const reason = global.join('\n') || String(error.stderr ?? error.message);
      throw new Error(`tsc could not check the files in ${appPath}:\n${reason}`);
    }
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
  for (const file of batch) tscErrors[file] = count(output, new RegExp(`__ab__/${file}\\(`, 'g'));
};

if (exemplarApp && noExemplarApp) {
  for (const [base, appPath] of Object.entries(bases)) {
    typeCheck(appPath, files.filter((file) => usage[basename(file, '.tsx')].base === base));
  }
}

const rows = files.map((file) => {
  const source = readFileSync(join(here, file), 'utf8');
  const pdsComponents = new Set(source.match(/<P[A-Z][A-Za-z]+/g) ?? []);
  return {
    run: basename(file, '.tsx'),
    lines: source.split('\n').length,
    pdsComponents: pdsComponents.size,
    bareControls: count(source, /<(select|input|button|textarea|option)\b/g),
    styleProps: count(source, /\bstyle=\{|<style\b/g),
    classNames: count(source, /\bclassName=/g),
    settingsFieldsUsed: SETTINGS_FIELDS.filter((field) => new RegExp(`\\b${field}\\b`).test(source)).length,
    usesNormalizeSettings: /\bnormalizeSettings\b/.test(source),
    // Declarations only — `import { type Settings }` must not count.
    redefinesTypes: /^\s*(export\s+)?(type|interface)\s+(Settings|GameMode|Difficulty|Opponent)\s*(=|\{|<)/m.test(source),
    tscErrors: tscErrors[file] ?? 'n/a',
    ...usage[basename(file, '.tsx')],
  };
});

console.table(rows);

// Per-cell means: prompt (A/B) x base (exemplar / no exemplar).
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const cells = {};
for (const row of rows) {
  const key = `${row.run[0]} · ${row.base}`;
  (cells[key] ??= []).push(row);
}
const summary = Object.fromEntries(
  Object.entries(cells).map(([key, group]) => [
    key,
    {
      n: group.length,
      lines: mean(group.map((row) => row.lines)).toFixed(0),
      pdsComponents: mean(group.map((row) => row.pdsComponents)).toFixed(1),
      bareControls: mean(group.map((row) => row.bareControls)).toFixed(1),
      styleProps: mean(group.map((row) => row.styleProps)).toFixed(1),
      classNames: mean(group.map((row) => row.classNames)).toFixed(1),
      // A group with an unchecked file has no total: 'n/a' is not 0 errors.
      tscErrorsTotal: group.some((row) => typeof row.tscErrors !== 'number')
        ? 'n/a'
        : group.reduce((sum, row) => sum + row.tscErrors, 0),
      selfTsc: `${group.filter((row) => row.selfTsc).length}/${group.length}`,
      tokens: mean(group.map((row) => row.tokens)).toFixed(0),
      toolUses: mean(group.map((row) => row.toolUses)).toFixed(1),
      seconds: (mean(group.map((row) => row.durationMs)) / 1000).toFixed(1),
    },
  ])
);
console.table(summary);
