import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ARTIFACT_FENCE_LANGUAGE,
  DeanArtifactCodecError,
  parseDeanArtifactFence,
} from '@/core/artifacts';

const VALID_FENCE = `
schemaVersion: 1
id: sprint-health
title: Sprint health
createdAt: 1735689600000

<div class="row">
  <div>
    <strong>Open</strong>
    <span>12</span>
  </div>
</div>
`.trim();

describe('parseDeanArtifactFence', () => {
  it('parses a YAML header and HTML fragment into element nodes', () => {
    const artifact = parseDeanArtifactFence(VALID_FENCE);
    expect(artifact.id).toBe('sprint-health');
    expect(artifact.title).toBe('Sprint health');
    expect(artifact.schemaVersion).toBe(1);
    expect(artifact.createdAt).toBe(1735689600000);
    expect(artifact.nodes).toHaveLength(1);
    const root = artifact.nodes[0];
    expect(root).toMatchObject({ type: 'element', tag: 'div', className: 'row' });
    if (root.type !== 'element') {
      throw new Error('expected element');
    }
    expect(root.children.some((child) => child.type === 'element' && child.tag === 'div')).toBe(true);
  });

  it('accepts --- as the header/body separator', () => {
    const artifact = parseDeanArtifactFence(`
schemaVersion: 1
id: sep
title: Separator
createdAt: 1
---
<p>Hello</p>
`.trim());
    expect(artifact.nodes[0]).toMatchObject({ type: 'element', tag: 'p' });
  });

  it('keeps table structure and plain text cells', () => {
    const artifact = parseDeanArtifactFence(`
schemaVersion: 1
id: board
title: Board
createdAt: 1

<table>
  <thead><tr><th>Name</th></tr></thead>
  <tbody><tr><td>Alpha</td></tr></tbody>
</table>
`.trim());
    const table = artifact.nodes[0];
    expect(table).toMatchObject({ type: 'element', tag: 'table' });
    const text = collectText(artifact.nodes);
    expect(text).toContain('Name');
    expect(text).toContain('Alpha');
  });

  it('rejects missing HTML after the header', () => {
    expect(() => parseDeanArtifactFence(`
schemaVersion: 1
id: empty
title: Empty
createdAt: 1
`.trim())).toThrow(DeanArtifactCodecError);
  });

  it('rejects a script tag', () => {
    expect(() => parseDeanArtifactFence(`
schemaVersion: 1
id: xss
title: XSS
createdAt: 1

<div><script>alert(1)</script></div>
`.trim())).toThrow(/script/i);
  });

  it('rejects an iframe tag', () => {
    expect(() => parseDeanArtifactFence(`
schemaVersion: 1
id: frame
title: Frame
createdAt: 1

<iframe src="https://example.com"></iframe>
`.trim())).toThrow(/iframe/i);
  });

  it('rejects onclick handlers', () => {
    expect(() => parseDeanArtifactFence(`
schemaVersion: 1
id: click
title: Click
createdAt: 1

<div onclick="alert(1)">Hi</div>
`.trim())).toThrow(/onclick/i);
  });

  it('rejects href and src attributes', () => {
    expect(() => parseDeanArtifactFence(`
schemaVersion: 1
id: link
title: Link
createdAt: 1

<div src="https://exfil.example"></div>
`.trim())).toThrow(/src/i);
  });

  it('rejects unsafe CSS url() in style', () => {
    expect(() => parseDeanArtifactFence(`
schemaVersion: 1
id: css
title: CSS
createdAt: 1

<div style="background: url(https://exfil.example)"></div>
`.trim())).toThrow(/unsafe/i);
  });

  it('rejects reserved dean- class tokens', () => {
    expect(() => parseDeanArtifactFence(`
schemaVersion: 1
id: cls
title: Class
createdAt: 1

<div class="dean-artifact-hack"></div>
`.trim())).toThrow(/dean-/i);
  });

  it('rejects unknown tags', () => {
    expect(() => parseDeanArtifactFence(`
schemaVersion: 1
id: custom
title: Custom
createdAt: 1

<custom-widget></custom-widget>
`.trim())).toThrow(/custom-widget/i);
  });

  it('rejects forbidden YAML keys', () => {
    expect(() => parseDeanArtifactFence(`
schemaVersion: 1
id: exec
title: Exec
createdAt: 1
href: https://example.com

<p>Hi</p>
`.trim())).toThrow(/href/i);
  });

  it('rejects an html YAML field', () => {
    expect(() => parseDeanArtifactFence(`
schemaVersion: 1
id: nested
title: Nested
createdAt: 1
html: <div>no</div>

<div>yes</div>
`.trim())).toThrow(/html/i);
  });

  it('uses the dean-artifact fence language constant', () => {
    expect(ARTIFACT_FENCE_LANGUAGE).toBe('dean-artifact');
  });

  it('parses the vault artifact-board example', () => {
    const note = readFileSync(join(process.cwd(), 'artifact-board.md'), 'utf8');
    const match = note.match(/```dean-artifact\n([\s\S]*?)\n```/);
    if (!match?.[1]) {
      throw new Error('expected artifact example fence');
    }
    const artifact = parseDeanArtifactFence(match[1]);
    expect(artifact.id).toBe('editor-artifact-board');
    expect(collectText(artifact.nodes)).toContain('createEl');
    expect(collectText(artifact.nodes)).toContain('dean-session');
  });

  it('parses the vault mobile-layout-drafts example', () => {
    const note = readFileSync(join(process.cwd(), 'mobile-layout-drafts.md'), 'utf8');
    const match = note.match(/```dean-artifact\n([\s\S]*?)\n```/);
    if (!match?.[1]) {
      throw new Error('expected artifact example fence');
    }
    const artifact = parseDeanArtifactFence(match[1]);
    expect(artifact.id).toBe('mobile-layout-drafts');
    const text = collectText(artifact.nodes);
    expect(text).toContain('HOME / FEED');
    expect(text).toContain('COMPOSER');
    expect(text).toContain('SETTINGS');
    expect(text).toContain('THEME / BRANDING');
  });
});

function collectText(nodes: ReturnType<typeof parseDeanArtifactFence>['nodes']): string {
  const parts: string[] = [];
  const walk = (list: typeof nodes): void => {
    for (const node of list) {
      if (node.type === 'text') {
        parts.push(node.text);
      } else {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return parts.join('');
}
