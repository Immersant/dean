import type { ArtifactNode, DeanArtifact } from '../../core/artifacts';
import { applySessionSectionPresentation } from '../session-sections/applySessionSectionPresentation';
import { enableInteractiveEmbed } from '../session-sections/SessionSectionWidget';

export function renderDeanArtifactWidget(
  containerEl: HTMLElement,
  artifact: DeanArtifact,
): void {
  containerEl.empty();
  containerEl.addClass('dean-artifact');
  applySessionSectionPresentation(containerEl, artifact);
  enableInteractiveEmbed(containerEl);
  containerEl.setAttribute('data-artifact-id', artifact.id);

  const header = containerEl.createDiv({ cls: 'dean-artifact-header' });
  header.createDiv({
    cls: 'dean-artifact-title',
    text: artifact.title,
  });

  const body = containerEl.createDiv({ cls: 'dean-artifact-body' });
  mountDeanArtifactNodes(body, artifact.nodes);
}

export function mountDeanArtifactNodes(
  container: HTMLElement,
  nodes: readonly ArtifactNode[],
): void {
  for (const node of nodes) {
    mountNode(container, node);
  }
}

function mountNode(parent: HTMLElement, node: ArtifactNode): void {
  if (node.type === 'text') {
    parent.appendText(node.text);
    return;
  }

  const el = parent.createEl(node.tag, {
    ...(node.className ? { cls: node.className } : {}),
    ...(node.attrs ? { attr: { ...node.attrs } } : {}),
  });
  if (node.style) {
    applySessionSectionPresentation(el, { style: node.style });
  }
  for (const child of node.children) {
    mountNode(el, child);
  }
}

export function renderInvalidDeanArtifact(
  containerEl: HTMLElement,
  message: string,
  invalidTitle: string,
): void {
  containerEl.empty();
  containerEl.addClass('dean-artifact');
  containerEl.addClass('dean-artifact--invalid');
  containerEl.createDiv({
    cls: 'dean-artifact-invalid-title',
    text: invalidTitle,
  });
  containerEl.createDiv({
    cls: 'dean-artifact-invalid-message',
    text: message,
  });
}

export function renderInactiveDeanArtifactFence(
  el: HTMLElement,
  source: string,
): void {
  el.empty();
  const pre = el.createEl('pre', { cls: 'dean-artifact-inactive language-dean-artifact' });
  pre.createEl('code', {
    cls: 'language-dean-artifact',
    text: source,
  });
}
