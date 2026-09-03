import type { App, Component } from 'obsidian';
import { MarkdownRenderer } from 'obsidian';

import { processFileLinks } from '../../../utils/fileLink';
import { replaceImageEmbedsWithHtml } from '../../../utils/imageEmbed';
import { normalizeLatexMathDelimiters } from '../../../utils/markdownMath';
import { prepareDisplayOnlyCodeFences } from '../../chat/rendering/DisplayOnlyCodeFences';

interface RenderInlineEditMarkdownPreviewOptions {
  app: App;
  component: Component;
  container: HTMLElement;
  markdown: string;
  sourcePath: string;
  mediaFolder?: string;
}

function emptyElement(container: HTMLElement): void {
  if (typeof container.empty === 'function') {
    container.empty();
    return;
  }
  container.replaceChildren();
}

function appendFallback(container: HTMLElement, markdown: string): void {
  container.createDiv({ cls: 'dean-inline-markdown-fallback', text: markdown });
}

export async function renderInlineEditMarkdownPreview({
  app,
  component,
  container,
  markdown,
  sourcePath,
  mediaFolder = '',
}: RenderInlineEditMarkdownPreviewOptions): Promise<void> {
  emptyElement(container);

  try {
    const normalizedMarkdown = normalizeLatexMathDelimiters(markdown);
    // Remap fences so registered processors (e.g. dean-session) cannot instantiate
    // live widgets inside the inline-edit preview.
    const displayOnly = prepareDisplayOnlyCodeFences(normalizedMarkdown);
    const processedMarkdown = replaceImageEmbedsWithHtml(displayOnly.markdown, app, {
      mediaFolder,
      sourcePath,
    });
    await MarkdownRenderer.render(app, processedMarkdown, container, sourcePath, component);

    if (processedMarkdown.includes('[[') && app.metadataCache) {
      processFileLinks(app, container);
    }
  } catch {
    emptyElement(container);
    appendFallback(container, markdown);
  }
}
