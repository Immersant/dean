# Session Sections (feature)

Obsidian editor widgets for durable `dean-session` fences: Act buttons and Collect forms.

## Ownership

| Module | Authority |
| --- | --- |
| `renderSessionSectionBlock` | Markdown code-block processor entry; gating (flag, path, Dean containers). |
| `SessionSectionWidget` | DOM for one fence (title, Act buttons, Collect form controls). Applies author `cssClass`/`style` maps. |
| `CollectSessionSectionController` | In-memory Collect answers; flush on blur/destroy. |
| `CollectSessionSectionRegistry` | Live Collect controllers per note; snapshot and note-wide flush before Act / Start new chat. |
| `DeanSessionFenceScan` / `listNoteSessionSections` | Shared fence walk and document-ordered parse of every `dean-session` block in a note. |
| `resolveNoteSessionSectionForm` | Read the host note, overlay live answers, resolve a `formId` group. |
| `StandaloneCollectDraftService` | Snapshot standalone Collect answers, require durable write-back, merge `formId` siblings, and request a fresh unsent draft. |
| `SessionSectionWriteBack` | Sole vault writer for Collect fences (`getSectionInfo` + `vault.modify`). |
| `SessionSectionService` | Re-parse fence, resolve `formId` answers, confirm Act, then submit to the bound conversation or request a fresh unsent draft. |
| `SessionSectionConfirmModal` | Full-draft Act / standalone Collect confirmation (plain text, no markdown rendering). |
| `SessionSectionDiagnostics` | Bounded ring buffer for click/send outcomes (no `console.*`). |

## Boundaries

- Bound Act / Collect action confirmations offer both `Send` to the bound conversation and `New chat` for an unsent fresh draft. Standalone Collect confirmations offer only `New chat` because no bound conversation exists. The legacy action-level `startNewChat` field is accepted but does not change the available choices. Collect write-back stays vault-only.
- Collect forms may call `FeatureHost.focusSessionSectionChat` to open and focus the bound sidebar conversation. That path must not submit a turn.
- Standalone Collect forms set `startNewChat` to a required submit-button label and have no conversation binding or Act actions.
- `FeatureHost.openSessionSectionDraft` may open only an unsent fresh draft; it must not resolve a conversation or initialize provider execution.
- Bound Collect `Open chat`, bound Act actions, and standalone `Start new chat` are separate paths and must not fall back to one another.
- Optional `formId` groups multiple fences in one note. Bound forms include merged questions and answers in either the submitted turn or new-chat draft; standalone forms compose them into the new-chat draft. Mixed bound/standalone groups fail closed.
- Act / Start new chat render only on the last `formId` member in document order. Earlier members are fields only. **Open chat** is not a submit control.
- Act buttons stay disabled after click until the adjacent reset control is used. Used-state is in-memory per note/section/action so Collect remounts keep the button spent.
- Collect flushes on blur and widget destroy, not every keystroke (writes remount the processor).
- Multi-leaf: last `vault.modify` wins; no cross-leaf debounce.
- Must not import `InputController`, `TabManager`, `DeanPlugin`, or `src/app/`.
- Schema/codec ownership stays in `src/core/session-sections/`.
- Layout is author CSS (`cssClass` / `style`), not a named-layout allowlist. Do not apply reserved `dean-` classes or unsafe CSS values.
- Invalid fences render an error callout with no buttons.

## Verification

- Unit tests under `tests/unit/features/session-sections/`.
- Processor must not activate in chat (`sourcePath === ''`) or inside Dean UI containers.
