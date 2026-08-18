import type { ProviderToolPolicy } from '../execution/ProviderExecutionRequest';
import type { DeanSettings } from '../types/settings';
import { SESSION_SECTION_FENCE_LANGUAGE, SESSION_SECTION_SCHEMA_VERSION } from './SessionSection';

export const SESSION_SECTION_AUTHORING_APPENDIX = `## Editor Session Sections

When the user benefits from durable in-note feedback or later canned actions, write a fenced \`${SESSION_SECTION_FENCE_LANGUAGE}\` YAML block into a vault markdown note (prefer the linked note when set).

Rules:
- Copy \`conversationId\` and \`epoch\` from the latest \`<dean_conversation id="…" section_epoch="…" />\` tag on the user turn. Never invent a conversation id.
- \`schemaVersion\` must be ${SESSION_SECTION_SCHEMA_VERSION}.
- \`kind: act\` — pre-prompted buttons (Review, Fix, Audit, Cleanup). Each action needs \`id\`, \`label\`, and a full \`prompt\`.
- \`kind: collect\` — in-note questionnaire. The user fills answers by editing the note. Optional co-located \`actions\` are Act buttons (for example "I'm done"), not a chat Submit modal.
- Do not put execution-like fields in the fence (\`onClick\`, \`shell\`, \`command\`, \`href\`).
- Do not use in-chat AskUserQuestion for long forms the user should mark up in the note. Use AskUserQuestion only when the turn cannot continue without an immediate answer.
- After rewind, old fences with a mismatched epoch become stale. Write a new fence with the current \`section_epoch\` rather than mutating user answers silently.
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
  return [SESSION_SECTION_AUTHORING_APPENDIX];
}
