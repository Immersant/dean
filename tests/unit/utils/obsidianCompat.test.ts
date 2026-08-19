import type { App, Workspace, WorkspaceLeaf } from 'obsidian';

import { openWorkspaceLink, revealWorkspaceLeaf } from '@/utils/obsidianCompat';

function createApp(openLinkText = jest.fn().mockResolvedValue(undefined)): App {
  return {
    workspace: { openLinkText },
  } as unknown as App;
}

describe('obsidianCompat', () => {
  describe('revealWorkspaceLeaf', () => {
    it('activates and reveals the workspace leaf', async () => {
      const leaf = {} as WorkspaceLeaf;
      const workspace = {
        setActiveLeaf: jest.fn(),
        revealLeaf: jest.fn().mockResolvedValue(undefined),
      } as unknown as Workspace;

      await revealWorkspaceLeaf(workspace, leaf);

      expect((workspace as unknown as { setActiveLeaf: jest.Mock }).setActiveLeaf)
        .toHaveBeenCalledWith(leaf, { focus: true });
      expect((workspace as unknown as { revealLeaf: jest.Mock }).revealLeaf).toHaveBeenCalledWith(leaf);
    });
  });

  describe('openWorkspaceLink', () => {
    it('opens with native getLeaf(false) behavior when there is no modifier', async () => {
      const openLinkText = jest.fn().mockResolvedValue(undefined);
      await openWorkspaceLink(createApp(openLinkText), 'Notes/Spec.md');
      expect(openLinkText).toHaveBeenCalledWith('Notes/Spec.md', '', false);
    });

    it('opens in a new tab for Mod-click or middle-click', async () => {
      const openLinkText = jest.fn().mockResolvedValue(undefined);
      const app = createApp(openLinkText);
      await openWorkspaceLink(app, 'Notes/Spec.md', '', { metaKey: true } as MouseEvent);
      expect(openLinkText).toHaveBeenCalledWith('Notes/Spec.md', '', 'tab');

      openLinkText.mockClear();
      await openWorkspaceLink(app, 'Notes/Spec.md', '', { button: 1 } as MouseEvent);
      expect(openLinkText).toHaveBeenCalledWith('Notes/Spec.md', '', 'tab');
    });

    it('opens a split or window from native modifier chords', async () => {
      const openLinkText = jest.fn().mockResolvedValue(undefined);
      const app = createApp(openLinkText);
      await openWorkspaceLink(app, 'Notes/Spec.md', '', {
        ctrlKey: true,
        altKey: true,
      } as MouseEvent);
      expect(openLinkText).toHaveBeenCalledWith('Notes/Spec.md', '', 'split');

      openLinkText.mockClear();
      await openWorkspaceLink(app, 'Notes/Spec.md', '', {
        ctrlKey: true,
        altKey: true,
        shiftKey: true,
      } as MouseEvent);
      expect(openLinkText).toHaveBeenCalledWith('Notes/Spec.md', '', 'window');
    });
  });
});
