import type { App, MarkdownView } from 'obsidian';
import { MarkdownView as ObsidianMarkdownView } from 'obsidian';

/**
 * Force open markdown leaves to re-run processors so flag toggle removes/adds widgets.
 */
export function refreshSessionSectionPreviews(app: App): void {
  const leaves = app.workspace.getLeavesOfType('markdown');
  for (const leaf of leaves) {
    const view = leaf.view;
    if (!isMarkdownView(view)) {
      continue;
    }
    try {
      const preview = (view as MarkdownView & {
        previewMode?: { rerender?: (full?: boolean) => void };
      }).previewMode;
      preview?.rerender?.(true);
    } catch {
      // Best-effort refresh; ignore host differences.
    }
    try {
      // Nudge Live Preview / editor state so the processor re-runs.
      view.editor?.refresh?.();
    } catch {
      // Optional API.
    }
  }
}

function isMarkdownView(view: unknown): view is MarkdownView {
  if (view instanceof ObsidianMarkdownView) {
    return true;
  }
  return !!view
    && typeof view === 'object'
    && (view as { getViewType?: () => string }).getViewType?.() === 'markdown';
}
