import { applySessionSectionPresentation } from '@/features/session-sections/applySessionSectionPresentation';

describe('applySessionSectionPresentation', () => {
  it('adds each cssClass token separately so DOMTokenList.add does not reject spaces', () => {
    const added: string[] = [];
    const el = {
      addClass(token: string) {
        if (/\s/.test(token)) {
          throw new DOMException(
            `Failed to execute 'add' on 'DOMTokenList': The token provided ('${token}') contains HTML space characters, which are not valid in tokens.`,
          );
        }
        added.push(token);
      },
      style: {},
    } as unknown as HTMLElement;

    applySessionSectionPresentation(el, {
      cssClass: 'presentation-lab test-card',
      style: { display: 'grid', gap: '12px' },
    });

    expect(added).toEqual(['presentation-lab', 'test-card']);
    expect((el.style as unknown as Record<string, string>).display).toBe('grid');
    expect((el.style as unknown as Record<string, string>).gap).toBe('12px');
  });
});
