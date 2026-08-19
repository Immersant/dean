# Standalone Collect New-Chat Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an opt-in standalone `dean-session` Collect form open a fresh, unsent Dean chat draft using the current default provider and model, without binding to or resolving any prior conversation.

**Architecture:** Model standalone Collect forms as a fail-closed discriminated core type with `startNewChat: true` and no conversation fields. Keep answer persistence and draft formatting in the session-sections feature, expose a provider-neutral draft-opening contract through `FeatureHost`, and let `DeanView` exclusively create/populate the new unbound runtime tab. Preserve the newly added bound-Collect **Open chat** flow as a separate regression path.

**Tech Stack:** TypeScript 6, Jest 30 with ts-jest/jsdom, Obsidian plugin APIs, modular CSS built by `scripts/build-css.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-17-standalone-collect-new-chat-design.md`

## Global Constraints

- Keep `SESSION_SECTION_SCHEMA_VERSION` at `1`; the standalone variant is additive.
- A standalone section is `kind: collect` plus `startNewChat: true`; it must omit `conversationId`, `epoch`, and `actions`.
- Bound Act and Collect sections must omit `startNewChat` and retain required `conversationId`/`epoch` behavior.
- Filling or flushing a Collect form remains vault-only; only its explicit new-chat button may request a draft.
- Opening a standalone draft must not call `submitSessionSectionTurn`, create a durable conversation, initialize execution, or reuse an existing unbound draft.
- The new tab must obtain provider/model selection through the existing blank-tab default path; do not pass provider/model values from a section.
- The draft is editable composer text, never HTML, and is not submitted automatically.
- Do not silently attach the source note as execution context; include its vault-relative path in draft text only.
- Preserve the current bound-Collect **Open chat** button and current Act used/reset behavior.
- Follow `src/style/AGENTS.md`: Dean buttons reset host chrome in every interaction state and use Obsidian theme variables.
- Do not edit generated `styles.css` directly; `npm run build` regenerates it.
- Stage only files named by each task because the working tree contains unrelated user changes and vault artifacts.

---

### Task 1: Add the standalone Collect schema variant without regressing bound sections

**Files:**
- Modify: `src/core/session-sections/SessionSection.ts`
- Modify: `src/core/session-sections/validateSessionSection.ts`
- Modify: `src/core/session-sections/SessionSectionCodec.ts`
- Modify: `src/core/session-sections/sessionSectionPrompt.ts`
- Modify: `src/core/session-sections/index.ts`
- Modify: `src/features/session-sections/CollectSessionSectionController.ts`
- Modify: `src/features/session-sections/SessionSectionService.ts`
- Modify: `src/features/session-sections/SessionSectionWidget.ts`
- Modify: `src/features/session-sections/SessionSectionWriteBack.ts`
- Test: `tests/unit/core/session-sections/SessionSectionCodec.test.ts`
- Test: `tests/unit/core/session-sections/sessionSectionPrompt.test.ts`

**Interfaces:**
- Produces: `BoundActSessionSection`, `BoundCollectSessionSection`, `StandaloneCollectSessionSection`, `CollectSessionSection`, `BoundSessionSection`, `SessionSection`.
- Produces: `isBoundSessionSection(section)` and `isStandaloneCollectSessionSection(section)` type guards.
- Preserves: `parseSessionSectionYaml(source): SessionSection` and `serializeSessionSectionYaml(section): string`.
- Later tasks use `StandaloneCollectSessionSection.startNewChat === true` as the discriminant.

- [ ] **Step 1: Write failing schema and authoring-guidance tests**

Add this fixture and the following cases to `SessionSectionCodec.test.ts`:

```ts
const STANDALONE_COLLECT = {
  schemaVersion: 1,
  id: 'standalone_discovery',
  kind: 'collect',
  title: 'Discovery questions',
  status: 'open',
  createdAt: 1710000100000,
  startNewChat: true,
  questions: [
    { id: 'goal', prompt: 'What should we build?', type: 'markdown' },
  ],
  answers: { goal: 'A reviewable workflow.' },
} as const;

it('accepts and round-trips standalone Collect sections without binding fields', () => {
  const section = validateSessionSection(STANDALONE_COLLECT);
  expect(section).toMatchObject({ kind: 'collect', startNewChat: true, actions: [] });
  expect('conversationId' in section).toBe(false);
  expect('epoch' in section).toBe(false);

  const serialized = serializeSessionSectionYaml(section);
  expect(serialized).toContain('startNewChat: true');
  expect(serialized).not.toContain('conversationId:');
  expect(serialized).not.toContain('epoch:');
  expect(parseSessionSectionYaml(serialized)).toEqual(section);
});

it.each([
  ['binding', { ...STANDALONE_COLLECT, conversationId: 'conv-1', epoch: 0 }],
  ['actions', { ...STANDALONE_COLLECT, actions: [{ id: 'go', label: 'Go', prompt: 'Go' }] }],
  ['act kind', { ...STANDALONE_COLLECT, kind: 'act' }],
  ['false flag', { ...COLLECT_SECTION, startNewChat: false }],
])('rejects ambiguous standalone combination: %s', (_label, value) => {
  expect(() => validateSessionSection(value)).toThrow();
});

it('still accepts existing bound Act and Collect sections', () => {
  expect(parseSessionSectionYaml(ACT_YAML).conversationId).toBeTruthy();
  expect(validateSessionSection(COLLECT_SECTION).conversationId).toBeTruthy();
});
```

Add to `sessionSectionPrompt.test.ts`:

```ts
it('documents standalone new-chat Collect forms without invented conversation ids', () => {
  expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('startNewChat: true');
  expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('omit `conversationId` and `epoch`');
  expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('Never invent a conversation id');
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
npm run test:unit -- --runInBand tests/unit/core/session-sections/SessionSectionCodec.test.ts tests/unit/core/session-sections/sessionSectionPrompt.test.ts
```

Expected: FAIL because `startNewChat` is not modeled or serialized and validation still requires `conversationId`.

- [ ] **Step 3: Introduce explicit discriminated types and guards**

Replace the monolithic `SessionSection` interface in `SessionSection.ts` with:

```ts
interface SessionSectionBase {
  readonly schemaVersion: typeof SESSION_SECTION_SCHEMA_VERSION;
  readonly id: string;
  readonly title: string;
  readonly status: SessionSectionStatus;
  readonly createdAt: number;
  readonly questions: readonly SessionSectionQuestion[];
  readonly answers: SessionSectionAnswers;
}

export interface BoundActSessionSection extends SessionSectionBase {
  readonly kind: 'act';
  readonly conversationId: string;
  readonly epoch: number;
  readonly actions: readonly SessionSectionAction[];
  readonly startNewChat?: never;
}

export interface BoundCollectSessionSection extends SessionSectionBase {
  readonly kind: 'collect';
  readonly conversationId: string;
  readonly epoch: number;
  readonly actions: readonly SessionSectionAction[];
  readonly startNewChat?: never;
}

export interface StandaloneCollectSessionSection extends SessionSectionBase {
  readonly kind: 'collect';
  readonly startNewChat: true;
  readonly actions: readonly [];
  readonly conversationId?: never;
  readonly epoch?: never;
}

export type BoundSessionSection = BoundActSessionSection | BoundCollectSessionSection;
export type CollectSessionSection = BoundCollectSessionSection | StandaloneCollectSessionSection;
export type SessionSection = BoundSessionSection | StandaloneCollectSessionSection;

export function isStandaloneCollectSessionSection(
  section: SessionSection,
): section is StandaloneCollectSessionSection {
  return section.kind === 'collect' && section.startNewChat === true;
}

export function isBoundSessionSection(
  section: SessionSection,
): section is BoundSessionSection {
  return !isStandaloneCollectSessionSection(section);
}
```

Export all new types and guards from `src/core/session-sections/index.ts`.

- [ ] **Step 4: Implement fail-closed conditional validation and serialization**

In `validateSessionSection.ts`, parse common fields, questions, actions, and `startNewChat` before conversation binding. Use this branch:

```ts
if (raw.startNewChat !== undefined && raw.startNewChat !== true) {
  throw new SessionSectionValidationError('startNewChat must be true when present');
}

if (raw.startNewChat === true) {
  if (kind !== 'collect') {
    throw new SessionSectionValidationError('startNewChat is only allowed for collect sections');
  }
  if (raw.conversationId !== undefined || raw.epoch !== undefined) {
    throw new SessionSectionValidationError(
      'standalone collect sections must omit conversationId and epoch',
    );
  }
  if (raw.actions !== undefined) {
    throw new SessionSectionValidationError('standalone collect sections must omit actions');
  }
  return {
    schemaVersion: SESSION_SECTION_SCHEMA_VERSION,
    id,
    kind: 'collect',
    title,
    status,
    createdAt,
    startNewChat: true,
    actions: [],
    questions,
    answers,
  };
}
```

Only after the standalone return, validate `conversationId` and decode `epoch` for a bound return. Keep every existing duplicate-id, size, required-action, required-question, and forbidden-key check.

In `SessionSectionCodec.ts`, construct binding fields conditionally:

```ts
if (isStandaloneCollectSessionSection(validated)) {
  payload.startNewChat = true;
} else {
  payload.conversationId = validated.conversationId;
  payload.epoch = validated.epoch;
}
```

Keep existing question/answer serialization and serialize actions only when present.

- [ ] **Step 5: Narrow all current consumers before accessing binding fields**

- Type `CollectSessionSectionControllerOptions.section` and `baseSection` as `CollectSessionSection`.
- In `SessionSectionService`, reject a standalone parsed section before conversation lookup; type `buildSessionSectionTurnRequest` as accepting `BoundSessionSection`.
- In `SessionSectionWidget`, set `data-conversation-id` and render existing **Open chat** only inside `isBoundSessionSection(section)`.
- Keep Collect controls available for both Collect variants.
- In `SessionSectionWriteBack`, replace direct diagnostic `conversationId` assignments with this spread:

```ts
function sectionDiagnosticBinding(section: SessionSection): { conversationId?: string } {
  return isBoundSessionSection(section)
    ? { conversationId: section.conversationId }
    : {};
}
```

Update `SESSION_SECTION_AUTHORING_APPENDIX` with separate bound and standalone Collect rules. Standalone guidance must say `startNewChat: true`, omit binding/actions, and open an unsent draft.

- [ ] **Step 6: Run core tests and typecheck**

```bash
npm run test:unit -- --runInBand tests/unit/core/session-sections/SessionSectionCodec.test.ts tests/unit/core/session-sections/sessionSectionPrompt.test.ts
npm run typecheck
```

Expected: PASS; no standalone section reaches bound APIs without narrowing.

- [ ] **Step 7: Commit the schema slice**

```bash
git add src/core/session-sections/SessionSection.ts src/core/session-sections/validateSessionSection.ts src/core/session-sections/SessionSectionCodec.ts src/core/session-sections/sessionSectionPrompt.ts src/core/session-sections/index.ts src/features/session-sections/CollectSessionSectionController.ts src/features/session-sections/SessionSectionService.ts src/features/session-sections/SessionSectionWidget.ts src/features/session-sections/SessionSectionWriteBack.ts tests/unit/core/session-sections/SessionSectionCodec.test.ts tests/unit/core/session-sections/sessionSectionPrompt.test.ts
git commit -m "feat: model standalone collect sections"
```

---

### Task 2: Make Collect persistence observable and format the reviewable draft

**Files:**
- Create: `src/features/session-sections/StandaloneCollectDraft.ts`
- Modify: `src/features/session-sections/CollectSessionSectionController.ts`
- Modify: `src/features/session-sections/index.ts`
- Modify: `src/i18n/locales/en.json`
- Create: `tests/unit/features/session-sections/StandaloneCollectDraft.test.ts`
- Modify: `tests/unit/features/session-sections/CollectSessionSectionController.test.ts`
- Modify: `tests/unit/features/session-sections/SessionSectionWriteBack.test.ts`

**Interfaces:**
- Produces: `CollectSessionSectionFlushResult = { status: 'ready' } | { status: 'blocked'; error: string }`.
- Produces: `CollectSessionSectionController.flush(): Promise<CollectSessionSectionFlushResult>`.
- Produces: `formatStandaloneCollectDraft(section, notePath): string`.
- Consumes: `StandaloneCollectSessionSection` from Task 1.

- [ ] **Step 1: Write failing formatter tests**

Create `StandaloneCollectDraft.test.ts`:

```ts
import type { StandaloneCollectSessionSection } from '@/core/session-sections';
import { formatStandaloneCollectDraft } from '@/features/session-sections/StandaloneCollectDraft';

const section: StandaloneCollectSessionSection = {
  schemaVersion: 1,
  id: 'discovery',
  kind: 'collect',
  title: 'Discovery #1',
  status: 'open',
  createdAt: 1710000100000,
  startNewChat: true,
  actions: [],
  questions: [
    { id: 'goal', prompt: 'What should we build?', type: 'markdown' },
    {
      id: 'areas',
      prompt: 'Which areas matter?',
      type: 'multi',
      options: [
        { id: 'a11y', label: 'Accessibility' },
        { id: 'storage', label: 'Persistence' },
      ],
    },
    { id: 'empty', prompt: 'Anything else?', type: 'text' },
  ],
  answers: {
    goal: 'A reviewable workflow.',
    areas: ['a11y', 'storage'],
    empty: '',
  },
};

it('formats standalone answers as editable Markdown', () => {
  expect(formatStandaloneCollectDraft(section, 'Notes/Discovery.md')).toBe([
    '# Discovery \\#1',
    '',
    'Source note: Notes/Discovery.md',
    '',
    '## What should we build?',
    '',
    'A reviewable workflow.',
    '',
    '## Which areas matter?',
    '',
    '- Accessibility',
    '- Persistence',
    '',
    '## Anything else?',
    '',
    '_Not answered_',
  ].join('\n'));
});

it('collapses heading newlines and preserves unknown option ids', () => {
  const changed = {
    ...section,
    title: 'Discovery\nquestions',
    answers: { ...section.answers, areas: ['missing-option'] },
  };
  const draft = formatStandaloneCollectDraft(changed, 'Notes/Discovery.md');
  expect(draft).toContain('# Discovery questions');
  expect(draft).toContain('- missing-option');
});
```

- [ ] **Step 2: Write failing persistence-result tests**

In `CollectSessionSectionController.test.ts`, assert successful and blocked results:

```ts
it('reports ready only after a successful or unchanged flush', async () => {
  jest.mocked(writeSessionSectionToNote).mockResolvedValueOnce({ status: 'written' });
  controller.setAnswer('notes', 'ready');
  await expect(controller.flush()).resolves.toEqual({ status: 'ready' });
});

it.each([
  [{ status: 'skipped', reason: 'no-file' }],
  [{ status: 'skipped', reason: 'no-range' }],
  [{ status: 'failed', error: 'disk full' }],
])('blocks draft creation when write-back is not durable', async (writeResult) => {
  jest.mocked(writeSessionSectionToNote).mockResolvedValueOnce(writeResult as never);
  controller.setAnswer('notes', 'unsaved');
  await expect(controller.flush()).resolves.toMatchObject({ status: 'blocked' });
});
```

In `SessionSectionWriteBack.test.ts`, add a standalone round-trip case that changes answers, writes the note, re-parses the replaced fence, and expects `startNewChat: true` with no `conversationId` or `epoch`.

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
npm run test:unit -- --runInBand tests/unit/features/session-sections/StandaloneCollectDraft.test.ts tests/unit/features/session-sections/CollectSessionSectionController.test.ts tests/unit/features/session-sections/SessionSectionWriteBack.test.ts
```

Expected: FAIL because the formatter does not exist and `flush()` returns `void` while swallowing write-back status.

- [ ] **Step 4: Implement observable flush results**

In `CollectSessionSectionController.ts`, add:

```ts
export type CollectSessionSectionFlushResult =
  | { readonly status: 'ready' }
  | { readonly status: 'blocked'; readonly error: string };

const READY_FLUSH: CollectSessionSectionFlushResult = { status: 'ready' };
```

Change `flushTail` and `flush()` to carry this result. Treat only `written`, `skipped/unchanged`, and the unchanged-digest fast path as `ready`. Convert `no-file`, `no-range`, and `failed` to `blocked` without updating `lastWrittenDigest`, so a later click retries. Existing blur, timer, unload, and Act callers may ignore the result.

- [ ] **Step 5: Implement the pure draft formatter**

Create `StandaloneCollectDraft.ts`:

```ts
import type {
  SessionSectionQuestion,
  StandaloneCollectSessionSection,
} from '../../core/session-sections';
import { t } from '../../i18n/i18n';

export function formatStandaloneCollectDraft(
  section: StandaloneCollectSessionSection,
  notePath: string,
): string {
  const lines = [
    `# ${escapeHeading(section.title)}`,
    '',
    t('settings.sessionSections.newChatDraft.sourceNote', { path: notePath }),
  ];
  for (const question of section.questions) {
    lines.push(
      '',
      `## ${escapeHeading(question.prompt)}`,
      '',
      ...formatAnswer(question, section.answers[question.id]),
    );
  }
  return lines.join('\n');
}

function escapeHeading(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/\\/g, '\\\\').replace(/#/g, '\\#');
}

function formatAnswer(
  question: SessionSectionQuestion,
  answer: string | string[] | undefined,
): string[] {
  const values = Array.isArray(answer) ? answer : answer?.trim() ? [answer] : [];
  if (values.length === 0) {
    return [`_${t('settings.sessionSections.newChatDraft.notAnswered')}_`];
  }
  if (Array.isArray(answer)) {
    return values.map(value => `- ${resolveOptionLabel(question, value)}`);
  }
  return [resolveOptionLabel(question, values[0])];
}

function resolveOptionLabel(question: SessionSectionQuestion, value: string): string {
  return question.options?.find(option => option.id === value)?.label ?? value;
}
```

Export the formatter and flush-result type from `src/features/session-sections/index.ts`. Add the typed English keys used by the formatter:

```json
"newChatDraft": {
  "sourceNote": "Source note: {path}",
  "notAnswered": "Not answered"
}
```

- [ ] **Step 6: Run focused tests and typecheck**

```bash
npm run test:unit -- --runInBand tests/unit/features/session-sections/StandaloneCollectDraft.test.ts tests/unit/features/session-sections/CollectSessionSectionController.test.ts tests/unit/features/session-sections/SessionSectionWriteBack.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit persistence and formatting**

```bash
git add src/features/session-sections/StandaloneCollectDraft.ts src/features/session-sections/CollectSessionSectionController.ts src/features/session-sections/index.ts src/i18n/locales/en.json tests/unit/features/session-sections/StandaloneCollectDraft.test.ts tests/unit/features/session-sections/CollectSessionSectionController.test.ts tests/unit/features/session-sections/SessionSectionWriteBack.test.ts
git commit -m "feat: format standalone collect drafts"
```

---

### Task 3: Add the provider-neutral fresh-draft host and view flow

**Files:**
- Create: `src/core/session-sections/SessionSectionDraft.ts`
- Modify: `src/core/session-sections/index.ts`
- Modify: `src/features/FeatureHost.ts`
- Modify: `src/features/chat/DeanView.ts`
- Modify: `src/main.ts`
- Modify: `src/i18n/locales/en.json`
- Test: `tests/unit/features/chat/DeanView.test.ts`
- Test: `tests/integration/main.test.ts`

**Interfaces:**
- Produces: `SessionSectionDraftRequest { content: string; sourceNotePath: string }`.
- Produces: `SessionSectionDraftResult = { status: 'opened' } | { status: 'blocked'; reason: SessionSectionDraftBlockReason }`.
- Produces: `FeatureHost.openSessionSectionDraft(request)`.
- Produces: `FeatureViewHost.openNewChatDraft(content)` and `DeanView.openNewChatDraft(content)`.
- Does not consume a conversation id, provider id, model, or execution request.

- [ ] **Step 1: Write failing DeanView tests for fresh creation and cleanup**

Add `describe('DeanView standalone Collect drafts')` to `DeanView.test.ts`:

```ts
it('creates a fresh unbound tab, fills its composer, and does not send', async () => {
  const inputEl = createMockEl('textarea') as unknown as HTMLTextAreaElement;
  const inputHandler = jest.fn();
  inputEl.addEventListener('input', inputHandler);
  inputEl.focus = jest.fn();
  const sendMessage = jest.fn();
  const addFile = jest.fn();
  const ensureExecutionInitialized = jest.fn();
  const tab = {
    id: 'draft-tab',
    conversationId: null,
    dom: { inputEl },
    controllers: { inputController: { sendMessage } },
    session: { userOwnershipRevision: 0 },
    ui: { fileContextManager: { addFile } },
  };
  const view = Object.create(DeanView.prototype) as any;
  view.tabManager = {
    createTab: jest.fn().mockResolvedValue(tab),
    discardTab: jest.fn(),
  };
  view.updateTabBarVisibility = jest.fn();
  view.ensureExecutionInitialized = ensureExecutionInitialized;

  await expect(view.openNewChatDraft('Draft body')).resolves.toEqual({ status: 'opened' });

  expect(view.tabManager.createTab).toHaveBeenCalledWith();
  expect(inputEl.value).toBe('Draft body');
  expect(inputHandler).toHaveBeenCalledTimes(1);
  expect(inputEl.focus).toHaveBeenCalledTimes(1);
  expect(sendMessage).not.toHaveBeenCalled();
  expect(ensureExecutionInitialized).not.toHaveBeenCalled();
  expect(addFile).not.toHaveBeenCalled();
  expect(view.tabManager.discardTab).not.toHaveBeenCalled();
});

it('does not reuse or overwrite an existing unbound draft', async () => {
  const existing = { conversationId: null, dom: { inputEl: { value: 'Keep me' } } };
  const targetInput = createMockEl('textarea') as unknown as HTMLTextAreaElement;
  const target = {
    id: 'fresh-tab',
    conversationId: null,
    dom: { inputEl: targetInput },
    session: { userOwnershipRevision: 0 },
  };
  const view = Object.create(DeanView.prototype) as any;
  view.tabManager = {
    getActiveTab: jest.fn().mockReturnValue(existing),
    createTab: jest.fn().mockResolvedValue(target),
    discardTab: jest.fn(),
  };
  view.updateTabBarVisibility = jest.fn();

  await view.openNewChatDraft('New draft');

  expect(existing.dom.inputEl.value).toBe('Keep me');
  expect(view.tabManager.createTab).toHaveBeenCalledTimes(1);
  expect(targetInput.value).toBe('New draft');
});

it('discards a newly created untouched tab when composer population fails', async () => {
  const inputEl = createMockEl('textarea') as unknown as HTMLTextAreaElement;
  inputEl.dispatchEvent = jest.fn(() => { throw new Error('dispatch failed'); }) as never;
  const tab = {
    id: 'failed-tab',
    conversationId: null,
    dom: { inputEl },
    session: { userOwnershipRevision: 0 },
  };
  const discardTab = jest.fn().mockResolvedValue(true);
  const view = Object.create(DeanView.prototype) as any;
  view.tabManager = {
    createTab: jest.fn().mockResolvedValue(tab),
    discardTab,
  };
  view.updateTabBarVisibility = jest.fn();

  await expect(view.openNewChatDraft('Draft')).resolves.toEqual({
    status: 'blocked',
    reason: 'composer-unavailable',
  });
  expect(discardTab).toHaveBeenCalledWith('failed-tab');
});
```

- [ ] **Step 2: Write failing DeanPlugin integration tests**

Add `describe('openSessionSectionDraft')` to `tests/integration/main.test.ts`:

```ts
it('opens a fresh view draft without resolving a conversation', async () => {
  plugin.settings.enableEditorSessionSections = true;
  const openNewChatDraft = jest.fn().mockResolvedValue({ status: 'opened' });
  (plugin as unknown as { ensureViewOpen: jest.Mock }).ensureViewOpen = jest.fn()
    .mockResolvedValue({ openNewChatDraft });
  const getConversationById = jest.spyOn(plugin, 'getConversationById');
  const createConversation = jest.spyOn(plugin, 'createConversation');

  await expect(plugin.openSessionSectionDraft({
    content: '# Discovery',
    sourceNotePath: 'Notes/Discovery.md',
  })).resolves.toEqual({ status: 'opened' });

  expect(openNewChatDraft).toHaveBeenCalledWith('# Discovery');
  expect(getConversationById).not.toHaveBeenCalled();
  expect(createConversation).not.toHaveBeenCalled();
});

it('fails closed for disabled sections and invalid empty drafts', async () => {
  plugin.settings.enableEditorSessionSections = false;
  await expect(plugin.openSessionSectionDraft({
    content: '# Discovery',
    sourceNotePath: 'Notes/Discovery.md',
  })).resolves.toEqual({ status: 'blocked', reason: 'flag-off' });

  plugin.settings.enableEditorSessionSections = true;
  await expect(plugin.openSessionSectionDraft({
    content: '   ',
    sourceNotePath: 'Notes/Discovery.md',
  })).resolves.toEqual({ status: 'blocked', reason: 'invalid-request' });
});
```

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
npm run test:unit -- --runInBand tests/unit/features/chat/DeanView.test.ts
npm run test:unit -- --runInBand tests/integration/main.test.ts -t openSessionSectionDraft
```

Expected: FAIL because the draft contracts and methods do not exist.

- [ ] **Step 4: Add core and feature-host contracts**

Create `SessionSectionDraft.ts`:

```ts
export interface SessionSectionDraftRequest {
  readonly content: string;
  readonly sourceNotePath: string;
}

export type SessionSectionDraftBlockReason =
  | 'flag-off'
  | 'invalid-request'
  | 'view-unavailable'
  | 'tab-not-ready'
  | 'composer-unavailable';

export type SessionSectionDraftResult =
  | { readonly status: 'opened' }
  | { readonly status: 'blocked'; readonly reason: SessionSectionDraftBlockReason };
```

Export these types from the core barrel. Add to `FeatureHost.ts`:

```ts
export interface FeatureViewHost extends TabManagerViewHost {
  openNewChatDraft(content: string): Promise<SessionSectionDraftResult>;
}

export interface FeatureHost {
  openSessionSectionDraft(
    request: SessionSectionDraftRequest,
  ): Promise<SessionSectionDraftResult>;
}
```

- [ ] **Step 5: Implement fresh tab creation in DeanView**

Add `openNewChatDraft` near `createNewTab()`. It must call `this.tabManager.createTab()` directly, never `activateOrCreateDraftTab()`:

```ts
async openNewChatDraft(content: string): Promise<SessionSectionDraftResult> {
  const manager = this.tabManager;
  if (!manager || !content.trim()) {
    return { status: 'blocked', reason: 'tab-not-ready' };
  }

  let tab: AssembledTabRuntime | null = null;
  try {
    tab = await manager.createTab();
    if (!tab) return { status: 'blocked', reason: 'tab-not-ready' };
    this.updateTabBarVisibility();

    const inputEl = tab.dom.inputEl;
    if (
      tab.conversationId !== null
      || inputEl.value !== ''
      || tab.session.userOwnershipRevision !== 0
    ) {
      await manager.discardTab(tab.id);
      return { status: 'blocked', reason: 'composer-unavailable' };
    }

    inputEl.value = content;
    const EventConstructor = inputEl.ownerDocument.defaultView?.Event ?? Event;
    inputEl.dispatchEvent(new EventConstructor('input', { bubbles: true }));
    inputEl.selectionStart = content.length;
    inputEl.selectionEnd = content.length;
    inputEl.focus();
    return { status: 'opened' };
  } catch {
    if (tab && tab.conversationId === null && tab.session.userOwnershipRevision === 0) {
      await manager.discardTab(tab.id).catch(() => false);
    }
    return { status: 'blocked', reason: 'composer-unavailable' };
  }
}
```

The input event may claim ownership after successful population. That is desired; cleanup is allowed only before ownership changes.

- [ ] **Step 6: Implement DeanPlugin delegation without conversation resolution**

Add beside the current focus/submit methods:

```ts
async openSessionSectionDraft(
  request: SessionSectionDraftRequest,
): Promise<SessionSectionDraftResult> {
  if (!this.settings.enableEditorSessionSections) {
    new Notice(t('settings.sessionSections.blocked.flagOff'));
    return { status: 'blocked', reason: 'flag-off' };
  }
  if (!request?.content?.trim() || !request.sourceNotePath?.trim()) {
    new Notice(t('settings.sessionSections.blocked.invalidRequest'));
    return { status: 'blocked', reason: 'invalid-request' };
  }

  const view = await this.ensureViewOpen();
  if (!view) {
    new Notice(t('settings.sessionSections.blocked.viewUnavailable'));
    return { status: 'blocked', reason: 'view-unavailable' };
  }

  const result = await view.openNewChatDraft(request.content);
  if (result.status === 'blocked') {
    new Notice(t(result.reason === 'composer-unavailable'
      ? 'settings.sessionSections.blocked.composerUnavailable'
      : 'settings.sessionSections.blocked.tabNotReady'));
  }
  return result;
}
```

Add English `blocked.composerUnavailable` now so the typed translation compiles. Do not call conversation resolution, `createConversation`, `submitProgrammaticTurn`, or execution initialization.

- [ ] **Step 7: Run view, integration, architecture, and type checks**

```bash
npm run test:unit -- --runInBand tests/unit/features/chat/DeanView.test.ts
npm run test:unit -- --runInBand tests/integration/main.test.ts -t openSessionSectionDraft
npm run test:architecture
npm run typecheck
```

Expected: PASS. `createTab()` receives no provider/model arguments, demonstrating current-default selection.

- [ ] **Step 8: Commit the host flow**

```bash
git add src/core/session-sections/SessionSectionDraft.ts src/core/session-sections/index.ts src/features/FeatureHost.ts src/features/chat/DeanView.ts src/main.ts src/i18n/locales/en.json tests/unit/features/chat/DeanView.test.ts tests/integration/main.test.ts
git commit -m "feat: open standalone collect chat drafts"
```

---

### Task 4: Wire the explicit Start new chat control into standalone Collect widgets

**Files:**
- Create: `src/features/session-sections/StandaloneCollectDraftService.ts`
- Modify: `src/features/session-sections/SessionSectionWidget.ts`
- Modify: `src/features/session-sections/index.ts`
- Modify: `src/style/features/session-sections.css`
- Modify: `src/style/accessibility.css`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/es.json`
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/ja.json`
- Modify: `src/i18n/locales/ko.json`
- Modify: `src/i18n/locales/pt.json`
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/zh-TW.json`
- Create: `tests/unit/features/session-sections/StandaloneCollectDraftService.test.ts`
- Modify: `tests/unit/features/session-sections/SessionSectionWidget.collect.test.ts`
- Test: `tests/unit/i18n/locales.test.ts`

**Interfaces:**
- Consumes: `formatStandaloneCollectDraft`, observable `collect.flush()`, and `FeatureHost.openSessionSectionDraft`.
- Produces: `openStandaloneCollectDraft(options)` with local `writeback-failed` blocking.
- Preserves: bound Collect **Open chat** calls only `focusSessionSectionChat(conversationId)`.
- Preserves: Act buttons continue through `activateSessionSectionAction` and used/reset state.

- [ ] **Step 1: Write failing orchestration tests**

Create `StandaloneCollectDraftService.test.ts`:

```ts
it('snapshots answers, flushes, then opens an unsent draft', async () => {
  const getAnswers = jest.fn().mockReturnValue({ goal: 'Use a fresh chat' });
  const flush = jest.fn().mockResolvedValue({ status: 'ready' });
  const openSessionSectionDraft = jest.fn().mockResolvedValue({ status: 'opened' });

  await expect(openStandaloneCollectDraft({
    host: { openSessionSectionDraft } as unknown as FeatureHost,
    section: STANDALONE_SECTION,
    notePath: 'Notes/Discovery.md',
    collect: { getAnswers, flush } as unknown as CollectSessionSectionController,
  })).resolves.toEqual({ status: 'opened' });

  expect(getAnswers).toHaveBeenCalledTimes(1);
  expect(flush).toHaveBeenCalledTimes(1);
  expect(openSessionSectionDraft).toHaveBeenCalledWith(expect.objectContaining({
    sourceNotePath: 'Notes/Discovery.md',
    content: expect.stringContaining('Use a fresh chat'),
  }));
  expect(getAnswers.mock.invocationCallOrder[0]).toBeLessThan(flush.mock.invocationCallOrder[0]);
  expect(flush.mock.invocationCallOrder[0])
    .toBeLessThan(openSessionSectionDraft.mock.invocationCallOrder[0]);
});

it('does not open a chat when answer write-back is blocked', async () => {
  const openSessionSectionDraft = jest.fn();
  const result = await openStandaloneCollectDraft({
    host: { openSessionSectionDraft } as unknown as FeatureHost,
    section: STANDALONE_SECTION,
    notePath: 'Notes/Discovery.md',
    collect: {
      getAnswers: () => ({ goal: 'Unsaved' }),
      flush: jest.fn().mockResolvedValue({ status: 'blocked', error: 'disk full' }),
    } as unknown as CollectSessionSectionController,
  });
  expect(result).toEqual({ status: 'blocked', reason: 'writeback-failed' });
  expect(openSessionSectionDraft).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Write failing widget behavior tests**

Extend `SessionSectionWidget.collect.test.ts` with a standalone fixture and these cases:

```ts
it('renders Start new chat instead of Open chat for standalone Collect', () => {
  renderSessionSectionWidget({
    host,
    containerEl: el,
    source: STANDALONE_BODY,
    notePath: 'Notes/Discovery.md',
    section: STANDALONE_SECTION,
    ctx,
  });
  expect(findByClass(el, 'dean-session-section-start-chat')).not.toBeNull();
  expect(findByClass(el, 'dean-session-section-open-chat')).toBeNull();
  expect(el.getAttribute('data-conversation-id')).toBeNull();
});

it('disables duplicate Start new chat clicks while opening', async () => {
  const opening = deferred<{ status: 'opened' }>();
  jest.mocked(openStandaloneCollectDraft).mockReturnValue(opening.promise);
  renderStandaloneWidget();
  const button = findByClass(el, 'dean-session-section-start-chat');
  button.click();
  button.click();
  expect(openStandaloneCollectDraft).toHaveBeenCalledTimes(1);
  expect(button.hasAttribute('disabled')).toBe(true);
  expect(button.getAttribute('aria-busy')).toBe('true');
  opening.resolve({ status: 'opened' });
  await opening.promise;
});

it('keeps bound Open chat and Act actions on their existing paths', async () => {
  renderBoundCollectWidget();
  findByClass(el, 'dean-session-section-open-chat').click();
  expect(host.focusSessionSectionChat).toHaveBeenCalledWith('conv-1');
  expect(host.openSessionSectionDraft).not.toHaveBeenCalled();
  expect(host.submitSessionSectionTurn).not.toHaveBeenCalled();
});
```

Also assert that a standalone widget without a processor context renders Start new chat disabled because it cannot durably flush answers.

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
npm run test:unit -- --runInBand tests/unit/features/session-sections/StandaloneCollectDraftService.test.ts tests/unit/features/session-sections/SessionSectionWidget.collect.test.ts
```

Expected: FAIL because the service and standalone control do not exist.

- [ ] **Step 4: Implement standalone draft orchestration**

Create `StandaloneCollectDraftService.ts`:

```ts
export type StandaloneCollectDraftOpenResult =
  | SessionSectionDraftResult
  | { readonly status: 'blocked'; readonly reason: 'writeback-failed' };

export async function openStandaloneCollectDraft(
  options: OpenStandaloneCollectDraftOptions,
): Promise<StandaloneCollectDraftOpenResult> {
  const answers = options.collect.getAnswers();
  const snapshot = { ...options.section, answers };
  const flush = await options.collect.flush();
  if (flush.status === 'blocked') {
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'new-chat-writeback-failed',
      message: flush.error,
      sectionId: options.section.id,
    });
    return { status: 'blocked', reason: 'writeback-failed' };
  }
  const result = await options.host.openSessionSectionDraft({
    content: formatStandaloneCollectDraft(snapshot, options.notePath),
    sourceNotePath: options.notePath,
  });
  recordSessionSectionDiagnostic({
    level: result.status === 'opened' ? 'info' : 'warn',
    code: result.status === 'opened' ? 'new-chat-draft-opened' : 'new-chat-draft-blocked',
    message: result.status === 'opened' ? 'Opened standalone Collect draft' : result.reason,
    sectionId: options.section.id,
  });
  return result;
}
```

Define `OpenStandaloneCollectDraftOptions` with `host: FeatureHost`, `section: StandaloneCollectSessionSection`, `notePath: string`, and `collect: CollectSessionSectionController`. Export the service from `index.ts`.

- [ ] **Step 5: Render the new button on the standalone path only**

Refactor `SessionSectionWidget.ts` in this order:

1. Render header/badges.
2. For bound Collect, render the existing header **Open chat** button.
3. Create the Collect controller and form for either Collect variant.
4. For standalone Collect, render a dedicated actions row with **Start new chat** after the form.
5. Render Act actions only for bound sections; standalone validation forbids them.

The click handler calls `openStandaloneCollectDraft`, sets `disabled` and `aria-busy="true"`, ignores duplicate clicks, shows `blocked.writeBackFailed` for local persistence failure, and restores state only if the widget remains mounted. It must never read or write `usedActions`.

- [ ] **Step 6: Add complete theme-aware button styles and focus treatment**

Add `.dean-session-section-start-chat` with a full state reset:

```css
.dean-session-section-start-chat {
  padding: 4px 10px;
  border: 1px solid var(--interactive-accent);
  border-radius: 4px;
  background: var(--interactive-accent);
  box-shadow: none;
  color: var(--text-on-accent);
  cursor: pointer;
}

.dean-session-section-start-chat:hover,
.dean-session-section-start-chat:focus-visible,
.dean-session-section-start-chat:active {
  border-color: var(--interactive-accent-hover, var(--interactive-accent));
  background: var(--interactive-accent-hover, var(--interactive-accent));
  box-shadow: none;
  color: var(--text-on-accent);
}

.dean-session-section-start-chat:disabled,
.dean-session-section-start-chat:disabled:hover,
.dean-session-section-start-chat:disabled:focus-visible,
.dean-session-section-start-chat:disabled:active {
  border-color: var(--background-modifier-border);
  background: transparent;
  box-shadow: none;
  color: var(--text-faint);
  cursor: default;
}
```

Add the class to the focus-visible selector in `accessibility.css`. Do not add hard-coded colors or theme listeners; Obsidian variables update live.

- [ ] **Step 7: Add localized copy with structurally identical keys**

Add these English keys under `settings.sessionSections`:

```json
"blocked": {
  "composerUnavailable": "Could not open a new chat draft.",
  "writeBackFailed": "Could not save the form answers. The new chat was not opened."
},
"newChat": {
  "label": "Start new chat",
  "aria": "Start a new Dean chat draft from this form",
  "hint": "Answers save into this note. Start a new chat to review them in an editable draft."
}
```

Keep the English `newChatDraft` keys added in Task 2. Add `blocked.composerUnavailable`, `blocked.writeBackFailed`, `newChat`, and `newChatDraft` with the same structure to all nine non-English locale files, preserving `{path}` exactly. Use these exact values in key order: `label`; `aria`; `hint`; `composerUnavailable`; `writeBackFailed`; `sourceNote`; `notAnswered`.

| Locale | Exact values |
| --- | --- |
| de | `Neuen Chat starten`; `Einen neuen Dean-Chatentwurf aus diesem Formular starten`; `Antworten werden in dieser Notiz gespeichert. Starten Sie einen neuen Chat, um sie in einem bearbeitbaren Entwurf zu prüfen.`; `Ein neuer Chatentwurf konnte nicht geöffnet werden.`; `Die Formularantworten konnten nicht gespeichert werden. Der neue Chat wurde nicht geöffnet.`; `Quellnotiz: {path}`; `Nicht beantwortet` |
| es | `Iniciar chat nuevo`; `Iniciar un nuevo borrador de chat de Dean desde este formulario`; `Las respuestas se guardan en esta nota. Inicia un chat nuevo para revisarlas en un borrador editable.`; `No se pudo abrir un nuevo borrador de chat.`; `No se pudieron guardar las respuestas del formulario. No se abrió el chat nuevo.`; `Nota de origen: {path}`; `Sin respuesta` |
| fr | `Démarrer un nouveau chat`; `Démarrer un nouveau brouillon de discussion Dean depuis ce formulaire`; `Les réponses sont enregistrées dans cette note. Démarrez une nouvelle discussion pour les relire dans un brouillon modifiable.`; `Impossible d’ouvrir un nouveau brouillon de discussion.`; `Impossible d’enregistrer les réponses du formulaire. La nouvelle discussion n’a pas été ouverte.`; `Note source : {path}`; `Sans réponse` |
| ja | `新しいチャットを開始`; `このフォームから新しい Dean チャットの下書きを開始`; `回答はこのノートに保存されます。新しいチャットを開始して、編集可能な下書きで確認してください。`; `新しいチャットの下書きを開けませんでした。`; `フォームの回答を保存できなかったため、新しいチャットは開かれませんでした。`; `元のノート: {path}`; `未回答` |
| ko | `새 채팅 시작`; `이 양식에서 새 Dean 채팅 초안 시작`; `답변은 이 노트에 저장됩니다. 새 채팅을 시작하여 편집 가능한 초안에서 검토하세요.`; `새 채팅 초안을 열 수 없습니다.`; `양식 답변을 저장할 수 없어 새 채팅을 열지 않았습니다.`; `원본 노트: {path}`; `답변 없음` |
| pt | `Iniciar novo chat`; `Começar um novo rascunho de chat do Dean a partir deste formulário`; `As respostas são guardadas nesta nota. Inicie um novo chat para as rever num rascunho editável.`; `Não foi possível abrir um novo rascunho de chat.`; `Não foi possível guardar as respostas do formulário. O novo chat não foi aberto.`; `Nota de origem: {path}`; `Sem resposta` |
| ru | `Начать новый чат`; `Начать новый черновик чата Dean из этой формы`; `Ответы сохраняются в этой заметке. Начните новый чат, чтобы проверить их в редактируемом черновике.`; `Не удалось открыть новый черновик чата.`; `Не удалось сохранить ответы формы. Новый чат не был открыт.`; `Исходная заметка: {path}`; `Нет ответа` |
| zh-CN | `开始新聊天`; `从此表单开始新的 Dean 聊天草稿`; `答案会保存到此笔记中。开始新聊天以在可编辑草稿中查看答案。`; `无法打开新的聊天草稿。`; `无法保存表单答案，因此未打开新聊天。`; `源笔记：{path}`; `未回答` |
| zh-TW | `開始新聊天`; `從此表單開始新的 Dean 聊天草稿`; `答案會儲存到此筆記中。開始新聊天以在可編輯草稿中檢視答案。`; `無法開啟新的聊天草稿。`; `無法儲存表單答案，因此未開啟新聊天。`; `來源筆記：{path}`; `未回答` |

- [ ] **Step 8: Run widget, locale, CSS, and type checks**

```bash
npm run test:unit -- --runInBand tests/unit/features/session-sections/StandaloneCollectDraftService.test.ts tests/unit/features/session-sections/SessionSectionWidget.collect.test.ts tests/unit/i18n/locales.test.ts
npm run build:css
npm run typecheck
```

Expected: PASS. Confirm the ignored generated `styles.css` contains `.dean-session-section-start-chat` after the CSS build; do not stage it.

- [ ] **Step 9: Commit the widget slice**

```bash
git add src/features/session-sections/StandaloneCollectDraftService.ts src/features/session-sections/SessionSectionWidget.ts src/features/session-sections/index.ts src/style/features/session-sections.css src/style/accessibility.css src/i18n/locales/en.json src/i18n/locales/de.json src/i18n/locales/es.json src/i18n/locales/fr.json src/i18n/locales/ja.json src/i18n/locales/ko.json src/i18n/locales/pt.json src/i18n/locales/ru.json src/i18n/locales/zh-CN.json src/i18n/locales/zh-TW.json tests/unit/features/session-sections/StandaloneCollectDraftService.test.ts tests/unit/features/session-sections/SessionSectionWidget.collect.test.ts
git commit -m "feat: start new chats from collect forms"
```

---

### Task 5: Document final behavior and run repository-wide verification

**Files:**
- Modify: `src/features/session-sections/AGENTS.md`
- Modify: `docs/features.md`
- Add: `docs/superpowers/specs/2026-08-17-standalone-collect-new-chat-design.md`
- Add: `docs/superpowers/plans/2026-08-18-standalone-collect-new-chat.md`

**Interfaces:**
- Documents the distinction among bound **Open chat**, bound Act execution, and standalone **Start new chat** draft creation.
- Produces no runtime API.

- [ ] **Step 1: Update scoped execution guidance**

Add an ownership row for `StandaloneCollectDraftService` and these invariants to `src/features/session-sections/AGENTS.md`:

```markdown
- Standalone Collect forms use `startNewChat: true` and have no conversation binding or Act actions.
- `FeatureHost.openSessionSectionDraft` may open only an unsent fresh draft; it must not resolve a conversation or initialize provider execution.
- Bound Collect `Open chat`, bound Act actions, and standalone `Start new chat` are separate paths and must not fall back to one another.
```

- [ ] **Step 2: Add user-facing feature documentation**

Add `## Editor session sections` to `docs/features.md`. State that the setting is opt-in; bound Act submits after confirmation; bound Collect saves answers and can focus its existing conversation; standalone Collect declares `startNewChat: true`, omits `conversationId`, `epoch`, and actions, and opens an unsent draft using current defaults. State that the source note appears as draft text and is not automatically attached. Include this copyable example:

````markdown
```dean-session
schemaVersion: 1
id: discovery
kind: collect
title: Discovery questions
status: open
createdAt: 1786992000000
startNewChat: true
questions:
  - id: goal
    prompt: What should we build?
    type: markdown
answers: {}
```
````

- [ ] **Step 3: Run the complete verification suite**

Run each command separately so failures are attributable:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Expected: every command exits `0`. `npm run test` includes unit, integration, architecture, and repository identity checks; `npm run build` regenerates CSS and bundles production code.

- [ ] **Step 4: Inspect final scope and generated artifacts**

```bash
git status --short
git diff --stat
git diff -- src/core/session-sections src/features/session-sections src/features/FeatureHost.ts src/features/chat/DeanView.ts src/main.ts src/style/features/session-sections.css src/style/accessibility.css src/i18n docs/features.md
```

Expected: only planned implementation, tests, locale files, the restored approved spec, and this plan appear. `styles.css` remains ignored. Do not stage unrelated root docs, `.dean/`, Canvas/Markdown/Excalidraw vault artifacts, or other untracked plans/specs.

- [ ] **Step 5: Commit documentation and final verification state**

```bash
git add src/features/session-sections/AGENTS.md docs/features.md docs/superpowers/specs/2026-08-17-standalone-collect-new-chat-design.md docs/superpowers/plans/2026-08-18-standalone-collect-new-chat.md
git commit -m "docs: document standalone collect drafts"
```

- [ ] **Step 6: Record final evidence for review**

Report the five verification command exit codes, commits from Tasks 1-5, and these verified facts:

- standalone form round-trips without binding fields;
- answer write-back completes before draft creation;
- a fresh default-backed unbound tab is always created;
- composer content remains unsent and editable;
- bound Open chat and Act actions retain their previous behavior.
