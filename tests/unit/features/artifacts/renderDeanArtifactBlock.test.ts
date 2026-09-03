import { createMockEl } from '@test/helpers/MockElement';

import { renderDeanArtifactBlock } from '@/features/artifacts/renderDeanArtifactBlock';
import type { FeatureHost } from '@/features/FeatureHost';

const VALID_ARTIFACT = `
schemaVersion: 1
id: sprint-health
title: Sprint health
createdAt: 1735689600000

<div class="row"><strong>Open</strong><span>12</span></div>
`.trim();

function createHost(overrides: {
  enable?: boolean;
  files?: Record<string, { path: string; extension: string }>;
} = {}): FeatureHost {
  const files = overrides.files ?? {
    'Notes/Spec.md': { path: 'Notes/Spec.md', extension: 'md' },
  };
  return {
    app: {
      vault: {
        getAbstractFileByPath: (path: string) => files[path] ?? null,
      },
    },
    settings: {
      enableEditorSessionSections: overrides.enable ?? true,
    },
  } as unknown as FeatureHost;
}

function createCtx(sourcePath: string) {
  return { sourcePath } as any;
}

function findTag(el: any, tagName: string): any | null {
  if (el?.tagName === tagName) {
    return el;
  }
  for (const child of el?.children ?? []) {
    const found = findTag(child, tagName);
    if (found) {
      return found;
    }
  }
  return null;
}

describe('renderDeanArtifactBlock', () => {
  it('mounts allowlisted HTML elements for a vault note', () => {
    const host = createHost();
    const el = createMockEl() as unknown as HTMLElement;

    renderDeanArtifactBlock(host, VALID_ARTIFACT, el, createCtx('Notes/Spec.md'));

    expect((el as any).classList.contains('dean-artifact')).toBe(true);
    expect(findTag(el, 'STRONG')?.textContent).toBe('Open');
    expect(findTag(el, 'SPAN')?.textContent).toBe('12');
    expect(findTag(el, 'BUTTON')).toBeNull();
  });

  it('does not assign fence HTML to innerHTML', () => {
    const host = createHost();
    const el = createMockEl() as any;
    const seen: string[] = [];
    Object.defineProperty(el, 'innerHTML', {
      configurable: true,
      get() {
        return '';
      },
      set(value: string) {
        seen.push(String(value));
      },
    });

    renderDeanArtifactBlock(host, VALID_ARTIFACT, el, createCtx('Notes/Spec.md'));

    expect(seen.some((value) => value.includes('<strong>'))).toBe(false);
  });

  it('shows inactive code fallback when the feature flag is off', () => {
    const host = createHost({ enable: false });
    const el = createMockEl() as any;

    renderDeanArtifactBlock(host, VALID_ARTIFACT, el, createCtx('Notes/Spec.md'));

    expect(findTag(el, 'STRONG')).toBeNull();
    expect(findTag(el, 'CODE')?.textContent).toContain('sprint-health');
  });

  it('shows inactive fallback for empty sourcePath (chat)', () => {
    const host = createHost();
    const el = createMockEl() as any;

    renderDeanArtifactBlock(host, VALID_ARTIFACT, el, createCtx(''));

    expect(findTag(el, 'STRONG')).toBeNull();
    expect(findTag(el, 'CODE')?.textContent).toContain('sprint-health');
  });

  it('shows inactive fallback inside a Dean chat container', () => {
    const host = createHost();
    const outer = createMockEl() as any;
    outer.classList.add('dean-container');
    const el = createMockEl() as any;
    outer.appendChild(el);

    renderDeanArtifactBlock(host, VALID_ARTIFACT, el, createCtx('Notes/Spec.md'));

    expect(findTag(el, 'STRONG')).toBeNull();
    expect(findTag(el, 'CODE')?.textContent).toContain('sprint-health');
  });

  it('renders an invalid callout without interactive controls for forbidden HTML', () => {
    const host = createHost();
    const el = createMockEl() as unknown as HTMLElement;

    renderDeanArtifactBlock(
      host,
      `
schemaVersion: 1
id: bad
title: Bad
createdAt: 1

<script>alert(1)</script>
`.trim(),
      el,
      createCtx('Notes/Spec.md'),
    );

    expect((el as any).classList.contains('dean-artifact--invalid')).toBe(true);
    expect(findTag(el, 'BUTTON')).toBeNull();
    expect(findTag(el, 'SCRIPT')).toBeNull();
  });
});
