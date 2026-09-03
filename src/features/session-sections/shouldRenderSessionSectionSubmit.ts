import type { App } from 'obsidian';

import {
  isLastSessionSectionFormMember,
  type SessionSection,
} from '../../core/session-sections';
import { listNoteSessionSections } from './listNoteSessionSections';

/**
 * Act / Start new chat only on the last formId member in the note.
 * Ungrouped fences keep the submit they already authored.
 */
export function shouldRenderSessionSectionSubmit(
  section: SessionSection,
  noteContent: string | null | undefined,
): boolean {
  if (!section.formId) {
    return true;
  }
  if (typeof noteContent !== 'string') {
    return true;
  }
  const members = listNoteSessionSections(noteContent).map(item => (
    item.section
      ? { section: item.section }
      : { formId: item.formId, parseError: item.parseError }
  ));
  return isLastSessionSectionFormMember(section, members);
}

export function readOpenMarkdownNote(app: App, notePath: string): string | null {
  const workspace = app.workspace as {
    getLeavesOfType?: (type: string) => readonly { view?: unknown }[];
    iterateAllLeaves?: (callback: (leaf: { view?: unknown }) => void) => void;
  } | undefined;
  if (!workspace) {
    return null;
  }

  const leaves: { view?: unknown }[] = [];
  if (typeof workspace.getLeavesOfType === 'function') {
    leaves.push(...workspace.getLeavesOfType('markdown'));
  }
  if (typeof workspace.iterateAllLeaves === 'function') {
    workspace.iterateAllLeaves(leaf => {
      leaves.push(leaf);
    });
  }

  for (const leaf of leaves) {
    const text = noteTextFromView(leaf.view, notePath);
    if (text !== null) {
      return text;
    }
  }
  return null;
}

function noteTextFromView(view: unknown, notePath: string): string | null {
  if (!view || typeof view !== 'object') {
    return null;
  }
  const candidate = view as {
    file?: { path?: unknown };
    editor?: { getValue?: () => unknown };
    data?: unknown;
  };
  if (candidate.file?.path !== notePath) {
    return null;
  }
  if (typeof candidate.editor?.getValue === 'function') {
    const value = candidate.editor.getValue();
    if (typeof value === 'string') {
      return value;
    }
  }
  return typeof candidate.data === 'string' ? candidate.data : null;
}
