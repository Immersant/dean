import type { MarkdownPostProcessorContext } from 'obsidian';

import {
  ARTIFACT_FENCE_LANGUAGE,
  DeanArtifactCodecError,
  parseDeanArtifactFence,
} from '../../core/artifacts';
import { t } from '../../i18n/i18n';
import type { FeatureHost } from '../FeatureHost';
import {
  isInsideDeanContainer,
  isSessionSectionProcessorAllowed,
} from '../session-sections/renderSessionSectionBlock';
import {
  renderDeanArtifactWidget,
  renderInactiveDeanArtifactFence,
  renderInvalidDeanArtifact,
} from './mountDeanArtifact';

export function renderDeanArtifactBlock(
  host: FeatureHost,
  source: string,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
): void {
  el.empty();

  if (!isSessionSectionProcessorAllowed(host, el, ctx.sourcePath ?? '')) {
    renderInactiveDeanArtifactFence(el, source);
    return;
  }

  try {
    const artifact = parseDeanArtifactFence(source);
    renderDeanArtifactWidget(el, artifact);
  } catch (error) {
    const message = error instanceof DeanArtifactCodecError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Invalid artifact';
    renderInvalidDeanArtifact(el, message, t('settings.artifacts.invalid.title'));
  }
}

export { ARTIFACT_FENCE_LANGUAGE, isInsideDeanContainer };
