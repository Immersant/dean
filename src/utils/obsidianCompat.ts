import type { App, TFile, UserEvent, Workspace, WorkspaceLeaf } from 'obsidian';
import { Keymap } from 'obsidian';

export function getVaultFileByPath(app: App, filePath: string): TFile | null {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (isVaultFile(file)) {
    return file;
  }
  return null;
}

export async function revealWorkspaceLeaf(workspace: Workspace, leaf: WorkspaceLeaf): Promise<void> {
  if (typeof workspace.setActiveLeaf === 'function') {
    workspace.setActiveLeaf(leaf, { focus: true });
  }
  await workspace.revealLeaf(leaf);
}

/**
 * Open a vault link the same way Obsidian does: `openLinkText` plus
 * `Keymap.isModEvent` (plain click, new tab, split, or window).
 */
export async function openWorkspaceLink(
  app: App,
  linkText: string,
  sourcePath = '',
  event?: UserEvent | null,
): Promise<void> {
  await app.workspace.openLinkText(linkText, sourcePath, Keymap.isModEvent(event));
}

function isVaultFile(value: unknown): value is TFile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TFile>;
  return typeof candidate.path === 'string'
    && typeof candidate.basename === 'string';
}
