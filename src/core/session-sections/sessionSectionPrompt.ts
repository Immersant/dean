import { ARTIFACT_AUTHORING_APPENDIX } from '../artifacts/deanArtifactPrompt';
import type { ProviderToolPolicy } from '../execution/ProviderExecutionRequest';
import type { DeanSettings } from '../types/settings';
import { SESSION_SECTION_FENCE_LANGUAGE, SESSION_SECTION_SCHEMA_VERSION } from './SessionSection';

export const SESSION_SECTION_AUTHORING_APPENDIX = `## Editor Session Sections

Default: create \`${SESSION_SECTION_FENCE_LANGUAGE}\` fences for durable input and follow-up actions when this appendix is present. Do not wait to be asked. Do not conduct questionnaires in chat.

Write a fenced \`${SESSION_SECTION_FENCE_LANGUAGE}\` YAML block into a vault markdown note (prefer the linked note when set) whenever any of these apply:
- Intake, requirements, preferences, or design choices
- The user should mark up, review, or approve something in the note
- Multi-step work whose next click should be Review, Continue, Fix, or I'm done
- A follow-up form belongs on an active board after this turn
- More than one question, or answers the user may edit later

If one blocking fact prevents progress this turn, use an available provider-native question mechanism. Never use chat questions for a questionnaire.

Rules:
- \`schemaVersion\` must be ${SESSION_SECTION_SCHEMA_VERSION}.
- Every section requires a safe local \`id\`, non-empty \`title\`, and \`createdAt\` as a non-negative Unix timestamp in milliseconds.
- Bound sections copy \`conversationId\` and \`epoch\` from the latest \`<dean_conversation id="..." section_epoch="..." />\` tag on the user turn. Never invent a conversation id.
- \`kind: act\` - bound pre-prompted buttons (Review, Fix, Audit, Cleanup). Each action needs \`id\`, \`label\`, and a full \`prompt\`.
- Bound \`kind: collect\` - in-note questionnaire attached to the current conversation. The user fills answers by editing the note. Optional co-located \`actions\` are Act buttons (for example "I'm done"). At confirmation, the user can send the prompt plus merged questions and current answers to the bound conversation or open them as a fresh unsent chat draft. Write the Act \`prompt\` as if those answers are already in context; do not tell the model to Read the fence to recover them.
- Every bound action offers both Send and New chat after confirmation. Do not emit the legacy action-level \`startNewChat\` field.
- Standalone \`kind: collect\` - set \`startNewChat\` to the required submit-button label, omit \`conversationId\` and \`epoch\`, omit \`actions\`, and ask questions for an unsent editable new-chat draft.
- Questions require \`id\`, \`prompt\`, and \`type\` (\`single\`, \`multi\`, \`text\`, or \`markdown\`). \`single\` and \`multi\` questions require non-empty \`options\`; each option requires \`id\` and \`label\`.
- To interleave normal editor prose with form controls, write several collect fences that share one \`formId\`. Bound members must share \`conversationId\` and \`epoch\`. Standalone members all set \`startNewChat\` to a button label and omit binding and actions. Dean shows Act / the authored Start new chat label only on the last member in the note; earlier members are fields only. Never mix bound and standalone under one \`formId\`.
- Optional \`cssClass\` (space-separated CSS class tokens) and \`style\` (a CSS property map) may be set on the section, questions, options, or actions to control layout. Use real CSS such as \`display: grid\` or \`grid-template-columns: 1fr 1fr\`. Do not use reserved \`dean-\` classes, \`url()\`, \`expression()\`, or execution-like fields.
- Do not put execution-like fields in the fence (\`onClick\`, \`shell\`, \`command\`, \`href\`).
- Quote YAML strings containing a colon, or use a block scalar such as \`>-\` for prompts.
- After rewind, old fences with a mismatched epoch become stale. Write a new fence with the current \`section_epoch\` rather than mutating user answers silently.

Canonical bound Act example (replace the example binding and timestamp with values from the current turn):

\`\`\`${SESSION_SECTION_FENCE_LANGUAGE}
schemaVersion: ${SESSION_SECTION_SCHEMA_VERSION}
id: review-actions
createdAt: 1735689600000
kind: act
conversationId: conv-example-from-user-tag
epoch: 0
title: Review actions
actions:
  - id: review
    label: Review
    prompt: Review the linked note and record findings under the Review heading.
\`\`\`

Canonical bound Collect example:

\`\`\`${SESSION_SECTION_FENCE_LANGUAGE}
schemaVersion: ${SESSION_SECTION_SCHEMA_VERSION}
id: design-choice
createdAt: 1735689600000
kind: collect
conversationId: conv-example-from-user-tag
epoch: 0
title: Choose a direction
questions:
  - id: layout
    prompt: Which layout should we use?
    type: single
    options:
      - id: board
        label: Visual board
      - id: note
        label: Structured note
actions:
  - id: continue
    label: Continue
    prompt: Continue using the submitted answers already present in this turn.
\`\`\`

Canonical standalone Collect example:

\`\`\`${SESSION_SECTION_FENCE_LANGUAGE}
schemaVersion: ${SESSION_SECTION_SCHEMA_VERSION}
id: new-project-intake
createdAt: 1735689600000
kind: collect
title: Start a project
startNewChat: Start project
questions:
  - id: outcome
    prompt: What outcome do you want?
    type: text
\`\`\`

Workspace boards:
- When a relevant board exists or the work is a board workflow, actively place form notes on it as \`type: file\` nodes and keep their status and edges current. Size interactive form nodes at least \`640\` wide and \`480\` high so controls remain readable.
- Optional: Markdown Kanban cards and Dataview dashboards that link those notes; Excalidraw files as sketch artifacts. These are enhancements, not requirements.
- Do not store form answers in canvas JSON. Do not edit user answers when advancing the board.
`;

/**
 * Build system-prompt appendices for editor session sections.
 * Suppresses authoring guidance for passive/read-only tool policies.
 */
export function buildDeanSystemPromptAppendices(
  settings: Partial<Pick<DeanSettings, 'enableEditorSessionSections'>> | null | undefined,
  toolPolicy?: ProviderToolPolicy,
): string[] {
  if (!settings?.enableEditorSessionSections) {
    return [];
  }
  if (toolPolicy?.kind === 'passive' || toolPolicy?.kind === 'read-only') {
    return [];
  }
  return [SESSION_SECTION_AUTHORING_APPENDIX, ARTIFACT_AUTHORING_APPENDIX];
}
