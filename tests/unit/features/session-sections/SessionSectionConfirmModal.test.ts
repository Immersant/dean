import { createMockEl } from '@test/helpers/MockElement';

import { SessionSectionConfirmModal } from '@/features/session-sections/SessionSectionConfirmModal';

describe('SessionSectionConfirmModal', () => {
  it('renders the full prompt as a text pre via createEl text, never script-executing HTML', () => {
    const contentEl = createMockEl('div');
    const modalEl = createMockEl('div');
    const app = {} as any;
    let resolveValue: string | undefined;

    const modal = new SessionSectionConfirmModal(
      app,
      {
        notePath: 'Notes/Spec.md',
        actionLabel: 'Review',
        draft: 'Do the full review.\n<script>alert(1)</script>',
        allowSend: true,
      },
      (value) => {
        resolveValue = value;
      },
    );

    (modal as any).contentEl = contentEl;
    (modal as any).modalEl = modalEl;
    (modal as any).setTitle = jest.fn();
    // Obsidian Modal mock assigns onOpen/onClose as jest.fn instance fields.
    // Call the real subclass implementations explicitly.
    SessionSectionConfirmModal.prototype.onOpen.call(modal);

    const preChildren = contentEl.children.filter(
      (child: { tagName?: string }) => child.tagName === 'PRE',
    );
    expect(preChildren.length).toBe(1);
    expect(preChildren[0].textContent).toBe('Do the full review.\n<script>alert(1)</script>');
    expect(preChildren[0].hasClass('dean-session-section-confirm-prompt')).toBe(true);
    // createEl text path must not produce nested script elements.
    expect(
      contentEl.children.some((child: { tagName?: string }) => child.tagName === 'SCRIPT'),
    ).toBe(false);
    expect((modal as any).setTitle).toHaveBeenCalledWith('Send section action');
    expect(contentEl.querySelector('.dean-session-section-confirm-send')?.textContent)
      .toBe('Send');
    expect(contentEl.querySelector('.dean-session-section-confirm-new-chat')?.textContent)
      .toBe('New chat');
    expect(contentEl.textContent).not.toContain('Conversation');

    SessionSectionConfirmModal.prototype.onClose.call(modal);
    expect(resolveValue).toBe('cancelled');
  });
});
