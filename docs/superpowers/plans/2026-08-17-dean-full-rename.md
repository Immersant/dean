# Dean Full Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename every product-owned Claudian identity in the complete repository to Dean without preserving Claudian IDs, storage paths, or compatibility aliases.

**Architecture:** Treat the rename as an identity-contract change across metadata, application-owned symbols and persistence, tooling, and documentation. Keep Claude/Anthropic provider terminology intact, remove stale Claudian-specific external destinations instead of inventing Dean URLs, and verify the result with Node static-contract tests plus the full repository checks.

**Tech Stack:** TypeScript 6, Node.js 24, Node test runner, npm/Bun lockfiles, Obsidian plugin manifest, Markdown.

## Global Constraints

- Use `Dean`, `dean`, and `DEAN` for display, lowercase identity/path, and constant naming respectively.
- Preserve legitimate Claude provider, Claude CLI, and Anthropic SDK names.
- Use a clean slate: do not retain migration reads, aliases, legacy constants, or compatibility exports for Claudian identity.
- Do not invent replacement GitHub, Obsidian community, badge, sponsorship, or release URLs.
- The initially partial checkout was restored from `HEAD` before implementation at the user's request.
- Treat the recorded 16 Windows-specific failing suites as the baseline; the rename must not add failures.

---

### Task 1: Package and Obsidian identity

**Files:**
- Create: `scripts/check-product-identity.test.mjs`
- Modify: `scripts/run-tests.js`
- Modify: `package.json`
- Modify: `manifest.json`
- Modify: `bun.lock`
- Regenerate: `package-lock.json`

**Interfaces:**
- Consumes: Node's built-in test runner and the existing JSON metadata formats.
- Produces: canonical package name `dean`, manifest ID `dean`, manifest display name `Dean`, and a static identity test included by `npm test`.

- [ ] **Step 1: Write the failing identity test**

Create `scripts/check-product-identity.test.mjs` with:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const retiredIdentity = ['clau', 'dian'].join('');

test('package and Obsidian identities are Dean', () => {
  const packageJson = readJson('package.json');
  const manifest = readJson('manifest.json');

  assert.equal(packageJson.name, 'dean');
  assert.match(packageJson.description, /^Dean\b/);
  assert.equal(manifest.id, 'dean');
  assert.equal(manifest.name, 'Dean');
});

test('lockfiles identify the Dean package', () => {
  const bunLock = fs.readFileSync(path.join(root, 'bun.lock'), 'utf8');
  const packageLock = readJson('package-lock.json');

  assert.match(bunLock, /"name": "dean"/);
  assert.equal(packageLock.name, 'dean');
  assert.equal(packageLock.packages[''].name, 'dean');
});
```

Append `path.join(__dirname, 'check-product-identity.test.mjs')` to the Node `--test` file list in `scripts/run-tests.js`.

- [ ] **Step 2: Run the test and confirm the old identity fails**

Run: `node --test scripts/check-product-identity.test.mjs`

Expected: FAIL because `package.json` is named `claudian`, `manifest.json` uses `realclaudian`/`Claudian`, and `package-lock.json` is currently empty.

- [ ] **Step 3: Change canonical metadata and lockfiles**

Set `package.json` to:

```json
"name": "dean",
"description": "Dean - provider-backed coding agents embedded in the Obsidian sidebar",
```

Set `manifest.json` to:

```json
"id": "dean",
"name": "Dean",
```

Change the root workspace `name` in `bun.lock` from `claudian` to `dean`. Regenerate the zero-byte npm lockfile from the renamed package manifest:

```bash
npm install --package-lock-only --ignore-scripts
```

If dependency resolution requires network access, request approval and rerun the same command; do not hand-author dependency entries.

- [ ] **Step 4: Run the identity test**

Run: `node --test scripts/check-product-identity.test.mjs`

Expected: both tests PASS.

- [ ] **Step 5: Commit only Task 1 files**

```bash
git add -- scripts/check-product-identity.test.mjs scripts/run-tests.js package.json manifest.json bun.lock package-lock.json
git commit --only -m "chore: rename package identity to Dean" -- scripts/check-product-identity.test.mjs scripts/run-tests.js package.json manifest.json bun.lock package-lock.json
```

---

### Task 2: Application symbols and clean-slate settings storage

**Files:**
- Rename: `src/app/providers/ClaudianProviderHost.ts` to `src/app/providers/DeanProviderHost.ts`
- Rename: `src/app/settings/ClaudianSettingsStorage.ts` to `src/app/settings/DeanSettingsStorage.ts`
- Modify: `src/app/settings/ChatModelSelectionCoordinator.ts`
- Modify: `src/app/settings/PinnedLinkedNotePathCoordinator.ts`
- Modify: `scripts/check-architecture-boundaries.test.mjs`
- Modify: `src/app/AGENTS.md`

**Interfaces:**
- Consumes: the existing `ProviderHost`, `SettingsCoordinator<T>`, and vault adapter contracts.
- Produces: `DeanProviderHost`, `DeanPlugin`, `DeanSettings`, `DeanSettingsStorage`, `StoredDeanSettings`, `DEAN_SETTINGS_PATH`, and `DEFAULT_DEAN_SETTINGS` references with no old product-path fallback.

- [ ] **Step 1: Add failing architecture assertions for renamed files**

Add this test to `scripts/check-architecture-boundaries.test.mjs`:

```js
test('application adapters use Dean-owned names', () => {
  const retiredPascal = ['Clau', 'dian'].join('');
  assert.equal(fs.existsSync(path.join(appRoot, 'providers', 'DeanProviderHost.ts')), true);
  assert.equal(
    fs.existsSync(path.join(appRoot, 'providers', `${retiredPascal}ProviderHost.ts`)),
    false,
  );
  assert.equal(fs.existsSync(path.join(appRoot, 'settings', 'DeanSettingsStorage.ts')), true);
  assert.equal(
    fs.existsSync(path.join(appRoot, 'settings', `${retiredPascal}SettingsStorage.ts`)),
    false,
  );
});
```

- [ ] **Step 2: Run the targeted architecture test and confirm failure**

Run: `node --test --test-name-pattern="application adapters use Dean-owned names" scripts/check-architecture-boundaries.test.mjs`

Expected: FAIL because the two Dean-named files do not exist.

- [ ] **Step 3: Rename files, symbols, imports, and architecture allowlists**

Rename the files and apply these exact symbol mappings throughout the complete source and test trees:

```text
ClaudianProviderHost       -> DeanProviderHost
ClaudianPlugin             -> DeanPlugin
ClaudianSettingsStorage    -> DeanSettingsStorage
StoredClaudianSettings     -> StoredDeanSettings
ClaudianSettings           -> DeanSettings
DEFAULT_CLAUDIAN_SETTINGS  -> DEFAULT_DEAN_SETTINGS
CLAUDIAN_SETTINGS_PATH     -> DEAN_SETTINGS_PATH
```

Update every architecture allowlist path to the renamed files, including the Claude provider compatibility-seam paths that refer to `DeanSettingsStorage`.

- [ ] **Step 4: Remove the old product settings-path fallback**

In `DeanSettingsStorage.ts`, import and export only `DEAN_SETTINGS_PATH`. Make `load()` read `DEAN_SETTINGS_PATH` only, make `save()` write only that path, make `exists()` check only that path, remove `LEGACY_CLAUDIAN_SETTINGS_PATH`, remove `deleteLegacyFileIfPresent()`, and simplify `getLoadPath()` to:

```ts
private async getLoadPath(): Promise<string | null> {
  return await this.adapter.exists(DEAN_SETTINGS_PATH)
    ? DEAN_SETTINGS_PATH
    : null;
}
```

Retain schema-normalization logic for settings already stored by Dean; remove only the old product identity/path compatibility behavior.

- [ ] **Step 5: Run the targeted and complete architecture tests**

Run:

```bash
node --test --test-name-pattern="application adapters use Dean-owned names" scripts/check-architecture-boundaries.test.mjs
node --test scripts/check-architecture-boundaries.test.mjs
```

Expected: the targeted and complete architecture tests PASS.

- [ ] **Step 6: Commit only Task 2 files**

```bash
git add -- src/app/providers/DeanProviderHost.ts src/app/providers/ClaudianProviderHost.ts src/app/settings/DeanSettingsStorage.ts src/app/settings/ClaudianSettingsStorage.ts src/app/settings/ChatModelSelectionCoordinator.ts src/app/settings/PinnedLinkedNotePathCoordinator.ts src/app/AGENTS.md scripts/check-architecture-boundaries.test.mjs
git commit --only -m "refactor: rename application identity to Dean" -- src/app/providers/DeanProviderHost.ts src/app/providers/ClaudianProviderHost.ts src/app/settings/DeanSettingsStorage.ts src/app/settings/ClaudianSettingsStorage.ts src/app/settings/ChatModelSelectionCoordinator.ts src/app/settings/PinnedLinkedNotePathCoordinator.ts src/app/AGENTS.md scripts/check-architecture-boundaries.test.mjs
```

---

### Task 3: Development and test tooling identity

**Files:**
- Modify: `esbuild.config.mjs`
- Modify: `eslint.config.mjs`
- Modify: `scripts/build-css.mjs`
- Modify: `scripts/run-jest.js`

**Interfaces:**
- Consumes: the existing Obsidian vault build target, spelling configuration, CSS builder, and Jest bootstrap.
- Produces: Dean-named development output, spelling brand, stylesheet banner, and temporary local-storage filename.

- [ ] **Step 1: Extend the identity test with tooling assertions**

Add to `scripts/check-product-identity.test.mjs`:

```js
test('development tooling uses Dean identity', () => {
  const files = [
    'esbuild.config.mjs',
    'eslint.config.mjs',
    'scripts/build-css.mjs',
    'scripts/run-jest.js',
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, new RegExp(retiredIdentity, 'i'), file);
  }
});
```

- [ ] **Step 2: Run the tooling identity test and confirm failure**

Run: `node --test --test-name-pattern="development tooling uses Dean identity" scripts/check-product-identity.test.mjs`

Expected: FAIL on `esbuild.config.mjs`.

- [ ] **Step 3: Rename tooling-owned values**

Apply these mappings:

```text
.obsidian/plugins/claudian -> .obsidian/plugins/dean
Claudian spelling brand    -> Dean spelling brand
Claudian Plugin Styles     -> Dean Plugin Styles
claudian-localstorage      -> dean-localstorage
```

- [ ] **Step 4: Run the tooling identity test**

Run: `node --test --test-name-pattern="development tooling uses Dean identity" scripts/check-product-identity.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit only Task 3 files**

```bash
git add -- scripts/check-product-identity.test.mjs esbuild.config.mjs eslint.config.mjs scripts/build-css.mjs scripts/run-jest.js
git commit --only -m "chore: rename Dean development tooling" -- scripts/check-product-identity.test.mjs esbuild.config.mjs eslint.config.mjs scripts/build-css.mjs scripts/run-jest.js
```

---

### Task 4: Public copy and repository guidance

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: the approved semantic boundary for product versus Claude-provider terminology.
- Produces: Dean-facing documentation with no stale old-product URLs or names.

- [ ] **Step 1: Add a failing repository-text test**

Add to `scripts/check-product-identity.test.mjs`:

```js
test('public documentation uses Dean branding', () => {
  const files = [
    'README.md',
    'CONTRIBUTING.md',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    'AGENTS.md',
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, new RegExp(retiredIdentity, 'i'), file);
  }
});
```

- [ ] **Step 2: Run the documentation test and confirm failure**

Run: `node --test --test-name-pattern="public documentation uses Dean branding" scripts/check-product-identity.test.mjs`

Expected: FAIL on `README.md`.

- [ ] **Step 3: Rename prose and remove stale destinations**

Replace product prose with Dean in all four files. In `README.md`, remove the old repository/community/release/download/star-history badge block, replace community-store instructions with manual installation instructions already supported by the repository, change the checkout directory example to `dean`, replace the old issue URL with neutral text directing users to this repository's issue tracker, and remove Claudian-specific affiliate query parameters or the affected sponsorship link when its destination cannot be verified. Keep all Claude CLI and Claude provider references unchanged.

- [ ] **Step 4: Run the documentation identity test**

Run: `node --test --test-name-pattern="public documentation uses Dean branding" scripts/check-product-identity.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit only Task 4 files**

```bash
git add -- scripts/check-product-identity.test.mjs README.md CONTRIBUTING.md .github/ISSUE_TEMPLATE/bug_report.yml AGENTS.md
git commit --only -m "docs: rename product branding to Dean" -- scripts/check-product-identity.test.mjs README.md CONTRIBUTING.md .github/ISSUE_TEMPLATE/bug_report.yml AGENTS.md
```

---

### Task 5: Repository-wide residue guard and verification

**Files:**
- Modify: `scripts/check-product-identity.test.mjs`
- Verify: every repository file outside `.git`, dependencies, and `docs/superpowers`

**Interfaces:**
- Consumes: all rename work from Tasks 1-4.
- Produces: a durable case-insensitive guard against reintroducing the retired product identity.

- [ ] **Step 1: Add the repository-wide residue test**

Add this helper and test to `scripts/check-product-identity.test.mjs` without spelling the retired name as one literal inside the guard itself:

```js
const ignoredDirectories = new Set(['.git', 'node_modules']);

function listTextFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const entryPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, entryPath);
    if (relativePath === path.join('docs', 'superpowers')) return [];
    if (entry.isDirectory()) return listTextFiles(entryPath);
    if (!entry.isFile()) return [];
    return ['.json', '.js', '.mjs', '.md', '.ts', '.yml'].includes(path.extname(entry.name))
      || ['bun.lock'].includes(entry.name)
      ? [entryPath]
      : [];
  });
}

test('repository has no retired product identity', () => {
  const matches = listTextFiles(root).filter((file) => {
    const source = fs.readFileSync(file, 'utf8').toLowerCase();
    return source.includes(retiredIdentity)
      || path.relative(root, file).toLowerCase().includes(retiredIdentity);
  });
  assert.deepEqual(matches.map(file => path.relative(root, file)), []);
});
```

The `docs/superpowers` exclusion deliberately keeps approved design and plan history outside the product residue contract while ordinary documentation remains covered.

- [ ] **Step 2: Run the residue test and inspect any failure**

Run: `node --test --test-name-pattern="repository has no retired product identity" scripts/check-product-identity.test.mjs`

Expected: PASS. If it fails, inspect each reported path and apply the approved semantic mapping; do not change legitimate `Claude` or Anthropic references.

- [ ] **Step 3: Run focused and full verification**

Run:

```bash
node --test scripts/check-product-identity.test.mjs
rg -n -i --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!docs/superpowers/**' "claudian" .
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected: the identity test passes and `rg` prints no matches. Run all four npm checks independently and compare unit-test failures with the recorded Windows baseline.

- [ ] **Step 4: Review the staged scope before committing**

Run:

```bash
git diff --check
git status --short
git diff --cached --name-only
```

Expected: no whitespace errors and only rename-owned paths are changed.

- [ ] **Step 5: Commit the residue guard only**

```bash
git add -- scripts/check-product-identity.test.mjs
git commit --only -m "test: guard Dean product identity" -- scripts/check-product-identity.test.mjs
```

- [ ] **Step 6: Report the final result**

Report the renamed identity, the clean-slate storage behavior, the no-match residue result, each verification command's exit status, and the unchanged Windows-specific test baseline.
