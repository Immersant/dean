import {
  parseSessionSectionYaml,
  SESSION_SECTION_LOCAL_ID_PATTERN,
  type SessionSection,
} from '../../core/session-sections';
import { listDeanSessionFences } from './DeanSessionFenceScan';

export interface ListedNoteSessionSection {
  readonly body: string;
  readonly range: { readonly start: number; readonly end: number };
  readonly section?: SessionSection;
  readonly parseError?: string;
  readonly formId?: string;
}

/**
 * Parse every dean-session fence in a note, preserving document order.
 * Invalid bodies stay in the list so form submit can fail closed on siblings.
 */
export function listNoteSessionSections(fileContent: string): ListedNoteSessionSection[] {
  return listDeanSessionFences(fileContent).map(fence => {
    try {
      const section = parseSessionSectionYaml(fence.body);
      return {
        body: fence.body,
        range: { start: fence.start, end: fence.end },
        section,
        formId: section.formId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid session section';
      return {
        body: fence.body,
        range: { start: fence.start, end: fence.end },
        parseError: message,
        formId: peekSessionSectionFormId(fence.body),
      };
    }
  });
}

export function peekSessionSectionFormId(body: string): string | undefined {
  const match = body.match(/^formId:\s*(?:["']([^"'\n]+)["']|(\S+))\s*$/m);
  const value = match?.[1] ?? match?.[2];
  if (!value || !SESSION_SECTION_LOCAL_ID_PATTERN.test(value)) {
    return undefined;
  }
  return value;
}
