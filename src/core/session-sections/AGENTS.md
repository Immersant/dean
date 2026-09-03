# Session Sections (core)

Provider-neutral schema, codec, validation, prompt appendix, and context formatters for editor session sections.

## Ownership

| Module | Authority |
| --- | --- |
| `SessionSectionCodec` / `validateSessionSection` | Only mutator of the parsed `SessionSection` schema. Fail closed on invalid input. |
| `SessionSectionPresentation` | Open `cssClass` / `style` maps. Not a named-layout allowlist; unsafe CSS values fail closed. |
| `decodeSectionEpoch` | Finite non-negative integer decode; missing/invalid → `0`. |
| `sessionSectionPrompt` | Authoring appendix text and when it is attached. |
| `SessionSectionContext` | XML tag format for conversation binding and session-section context. Collect Act turns inline merged questions and answers inside `<session_section>`; chip/display stays separate. |
| `SessionSectionForm` | Note-level `formId` group resolve/merge. Fail closed on mixed mode, binding mismatch, duplicate questions, and cap breaches. |
| `SessionSectionTurn` | DTO types for FeatureHost Act submit and Collect open-chat focus (implemented in features/composition). |

## Boundaries

- Must not import features, `src/app/`, `src/main.ts`, or provider implementations.
- Vault write-back, markdown processors, and Act click UX live in `src/features/session-sections/`.
- Conversation `sectionEpoch` persistence is owned by conversation metadata (`ConversationRepository` / composition shell), not this package.

## Verification

- Unit tests under `tests/unit/core/session-sections/`.
- Invalid fences must not produce interactive widgets (feature processor depends on codec errors).
