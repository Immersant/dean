import * as fs from 'node:fs';
import * as path from 'node:path';

describe('session-section styles', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/style/features/session-sections.css'),
    'utf8',
  );

  it('keeps embedded widgets and their controls large enough to read and operate', () => {
    const rootRule = css.match(/\.dean-session-section \{([\s\S]*?)\}/)?.[1] ?? '';
    expect(rootRule).toContain('font-size: max(16px, var(--font-text-size));');
    expect(rootRule).toContain('padding: 16px 18px;');
    expect(css).toMatch(
      /\.dean-session-section-action \{[\s\S]*?min-height: 44px;[\s\S]*?font-size: 14px;/,
    );
    expect(css).toMatch(
      /\.dean-session-section-question-input \{[\s\S]*?min-height: 44px;[\s\S]*?font-size: 15px;/,
    );
  });

  it('stacks actions on narrow canvas and editor panes', () => {
    expect(css).toContain('@container (max-width: 420px)');
    expect(css).toMatch(
      /@container \(max-width: 420px\) \{[\s\S]*?\.dean-session-section-action-row[\s\S]*?width: 100%;/,
    );
  });

  it('keeps the chat origin chip toggle on the same row as the label', () => {
    const chipRule = css.match(/\.dean-session-section-message-chip \{([\s\S]*?)\}/)?.[1] ?? '';
    const barRule = css.match(/\.dean-session-section-message-chip-bar \{([\s\S]*?)\}/)?.[1] ?? '';
    const mainRule = css.match(/\.dean-session-section-message-chip-main \{([\s\S]*?)\}/)?.[1] ?? '';

    expect(chipRule).not.toContain('flex-wrap: wrap;');
    expect(barRule).toContain('display: flex;');
    expect(barRule).toContain('flex-wrap: nowrap;');
    expect(barRule).toContain('max-width: 100%;');
    expect(barRule).toContain('min-width: 0;');
    expect(mainRule).toContain('min-width: 0;');
    expect(mainRule).toContain('overflow: hidden;');
    expect(css).toMatch(
      /button\.dean-session-section-message-chip-main \{[\s\S]*?width:\s*auto;/,
    );
    expect(css).toMatch(
      /button\.dean-session-section-message-chip-toggle \{[\s\S]*?width:\s*auto;/,
    );
  });
});
