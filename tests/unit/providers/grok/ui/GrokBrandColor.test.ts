import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Grok brand color', () => {
  const variablesCss = fs.readFileSync(
    path.join(process.cwd(), 'src/style/base/variables.css'),
    'utf8',
  );
  const tabsCss = fs.readFileSync(
    path.join(process.cwd(), 'src/style/components/tabs.css'),
    'utf8',
  );

  it('uses white in dark mode and black in light mode', () => {
    expect(variablesCss).toContain('--dean-brand-grok: #ffffff;');
    expect(variablesCss).toContain('--dean-brand-grok-rgb: 255, 255, 255;');
    expect(variablesCss).toMatch(
      /body\.theme-light \.dean-container \{[\s\S]*?--dean-brand-grok: #000000;[\s\S]*?--dean-brand-grok-rgb: 0, 0, 0;[\s\S]*?\}/,
    );
  });

  it('routes active and streaming Grok surfaces through its brand token', () => {
    expect(variablesCss).toMatch(
      /\.dean-container\[data-provider="grok"\] \{[\s\S]*?--dean-brand: var\(--dean-brand-grok\);[\s\S]*?--dean-brand-rgb: var\(--dean-brand-grok-rgb\);[\s\S]*?\}/,
    );
    expect(tabsCss).toMatch(
      /\.dean-tab-badge-streaming\[data-provider="grok"\] \{[\s\S]*?border-color: var\(--dean-brand-grok, #ffffff\);[\s\S]*?\}/,
    );
  });
});
