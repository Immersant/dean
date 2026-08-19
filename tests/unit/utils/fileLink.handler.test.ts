import { registerFileLinkHandler } from '@/utils/fileLink';
import { openWorkspaceLink } from '@/utils/obsidianCompat';

jest.mock('@/utils/obsidianCompat', () => {
  const actual = jest.requireActual('@/utils/obsidianCompat');
  return {
    ...actual,
    openWorkspaceLink: jest.fn(),
  };
});

describe('registerFileLinkHandler', () => {
  it('opens data-href target when present', () => {
    const app = {
      workspace: {
        openLinkText: jest.fn(),
      },
    };

    const link: any = {
      dataset: { href: 'note#section' },
      getAttribute: jest.fn().mockReturnValue('note'),
      closest: jest.fn(),
    };
    link.closest.mockReturnValue(link);

    const event = {
      target: link,
      preventDefault: jest.fn(),
    } as any;

    const container = {
      addEventListener: (_event: string, callback: (event: MouseEvent) => void) => {
        callback(event);
      },
      removeEventListener: jest.fn(),
    };

    const cleanup = registerFileLinkHandler(app as any, container as any);
    cleanup();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(openWorkspaceLink).toHaveBeenCalledWith(app, 'note#section', '', event);
    expect(container.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('falls back to href when data-href is missing', () => {
    const app = {
      workspace: {
        openLinkText: jest.fn(),
      },
    };

    const link: any = {
      dataset: {},
      getAttribute: jest.fn().mockReturnValue('note^block'),
      closest: jest.fn(),
    };
    link.closest.mockReturnValue(link);

    const event = {
      target: link,
      preventDefault: jest.fn(),
    } as any;

    const container = {
      addEventListener: (_event: string, callback: (event: MouseEvent) => void) => {
        callback(event);
      },
      removeEventListener: jest.fn(),
    };

    registerFileLinkHandler(app as any, container as any);

    expect(openWorkspaceLink).toHaveBeenCalledWith(app, 'note^block', '', event);
  });

  it('forwards the click event so native modifiers apply', () => {
    const app = {
      workspace: {
        openLinkText: jest.fn(),
      },
    };

    const link: any = {
      dataset: { href: 'note' },
      getAttribute: jest.fn().mockReturnValue('note'),
      closest: jest.fn(),
    };
    link.closest.mockReturnValue(link);

    const event = {
      target: link,
      metaKey: true,
      preventDefault: jest.fn(),
    } as any;

    const container = {
      addEventListener: (_event: string, callback: (event: MouseEvent) => void) => {
        callback(event);
      },
      removeEventListener: jest.fn(),
    };

    registerFileLinkHandler(app as any, container as any);

    expect(openWorkspaceLink).toHaveBeenCalledWith(app, 'note', '', event);
  });
});
