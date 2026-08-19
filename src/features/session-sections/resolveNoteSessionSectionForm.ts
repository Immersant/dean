import type { TFile } from 'obsidian';

import {
  resolveSessionSectionForm,
  type SessionSectionFormInput,
  type SessionSectionFormResolveResult,
} from '../../core/session-sections';
import type { FeatureHost } from '../FeatureHost';
import { snapshotCollectSessionSections } from './CollectSessionSectionRegistry';
import { listNoteSessionSections } from './listNoteSessionSections';

export async function resolveNoteSessionSectionForm(
  host: FeatureHost,
  notePath: string,
  formId: string,
): Promise<SessionSectionFormResolveResult> {
  const content = await readNoteMarkdown(host, notePath);
  if (content === null) {
    return {
      ok: false,
      code: 'form-missing',
      message: `Could not read note "${notePath}" to resolve form "${formId}"`,
    };
  }

  const snapshots = new Map(
    snapshotCollectSessionSections(notePath).map(snapshot => [
      snapshot.sectionId,
      snapshot.answers,
    ]),
  );
  const candidates: SessionSectionFormInput[] = listNoteSessionSections(content).map(item => {
    if (!item.section) {
      return { formId: item.formId, parseError: item.parseError ?? 'Invalid session section' };
    }
    const overlay = snapshots.get(item.section.id);
    if (!overlay) {
      return { section: item.section };
    }
    return {
      section: {
        ...item.section,
        answers: { ...item.section.answers, ...overlay },
      },
    };
  });
  return resolveSessionSectionForm(candidates, formId);
}

async function readNoteMarkdown(host: FeatureHost, notePath: string): Promise<string | null> {
  const abstract = host.app.vault.getAbstractFileByPath(notePath);
  if (!isReadableVaultFile(abstract)) {
    return null;
  }
  try {
    return await host.app.vault.read(abstract);
  } catch {
    return null;
  }
}

function isReadableVaultFile(value: unknown): value is TFile {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as { path?: unknown }).path === 'string',
  );
}
