import type { App, ItemView } from 'obsidian';

import {
  canvasSelectionsEqual,
  type CanvasSelectionContext,
  formatCanvasSelectionChipLabel,
  summarizeCanvasSelectionNode,
} from '../../../utils/canvas';
import type { ComposerContextTray } from '../ui/ComposerContextTray';

const CANVAS_POLL_INTERVAL = 250;

type CanvasViewLike = ItemView & {
  canvas?: {
    selection?: Set<unknown>;
  };
  file?: {
    path?: unknown;
  };
};

function nodeChipTitleLine(node: NonNullable<CanvasSelectionContext['nodes']>[number]): string {
  if (node.file) return node.file;
  if (node.label) return node.label;
  if (node.text) return node.text.split(/\r?\n/, 1)[0] ?? node.text;
  if (node.url) return node.url;
  return node.id;
}

export class CanvasSelectionController {
  private app: App;
  private contextTray: ComposerContextTray;
  private inputEl: HTMLElement;
  private onVisibilityChange: (() => void) | null;
  private onUserSelectionChanged: (() => void) | null;
  private storedSelection: CanvasSelectionContext | null = null;
  private pollInterval: number | null = null;

  constructor(
    app: App,
    contextTray: ComposerContextTray,
    inputEl: HTMLElement,
    onVisibilityChange?: () => void,
    onUserSelectionChanged?: () => void,
  ) {
    this.app = app;
    this.contextTray = contextTray;
    this.inputEl = inputEl;
    this.onVisibilityChange = onVisibilityChange ?? null;
    this.onUserSelectionChanged = onUserSelectionChanged ?? null;
  }

  start(): void {
    if (this.pollInterval) return;
    this.pollInterval = window.setInterval(() => this.poll(), CANVAS_POLL_INTERVAL);
  }

  stop(): void {
    if (this.pollInterval) {
      window.clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.clear();
  }

  private poll(): void {
    const canvasView = this.getCanvasView();
    if (!canvasView) return;

    const canvas = canvasView.canvas;
    if (!canvas?.selection) return;

    const selection = canvas.selection;
    const canvasPath = canvasView.file?.path;
    if (typeof canvasPath !== 'string' || !canvasPath) return;

    const nodes = [...selection].flatMap((node) => {
      const summary = summarizeCanvasSelectionNode(node);
      return summary ? [summary] : [];
    });
    const nodeIds = nodes.map(node => node.id);

    if (nodeIds.length > 0) {
      const nextSelection: CanvasSelectionContext = { canvasPath, nodeIds, nodes };
      if (!canvasSelectionsEqual(this.storedSelection, nextSelection)) {
        this.storedSelection = nextSelection;
        this.updateIndicator();
        this.onUserSelectionChanged?.();
      }
    } else if (this.getActiveElement() !== this.inputEl) {
      if (this.storedSelection) {
        this.storedSelection = null;
        this.updateIndicator();
        this.onUserSelectionChanged?.();
      }
    }
  }

  private getActiveElement(): Element | null {
    return this.inputEl.ownerDocument?.activeElement ?? null;
  }

  private getCanvasView(): CanvasViewLike | null {
    const activeLeaf = this.app.workspace.getMostRecentLeaf?.();
    const activeView = activeLeaf?.view as CanvasViewLike | undefined;
    if (activeView?.getViewType?.() === 'canvas' && activeView.file) {
      return activeView;
    }

    const leaves = this.app.workspace.getLeavesOfType('canvas');
    if (leaves.length === 0) return null;
    const leaf = leaves.find(l => (l.view as CanvasViewLike).file);
    return leaf ? (leaf.view as CanvasViewLike) : null;
  }

  private updateIndicator(): void {
    if (this.storedSelection) {
      const label = formatCanvasSelectionChipLabel(this.storedSelection);
      const nodes = this.storedSelection.nodes ?? [];
      const title = nodes.length > 1
        ? nodes.map(nodeChipTitleLine).join('\n')
        : undefined;
      this.contextTray.setItems('canvas-selection', [{
        id: 'canvas-selection',
        kind: 'selection',
        label,
        icon: 'network',
        ariaLabel: label,
        ...(title ? { title } : {}),
        onRemove: () => {
          this.clear();
          this.onUserSelectionChanged?.();
        },
      }]);
    } else {
      this.contextTray.clearItems('canvas-selection');
    }
    this.updateContextRowVisibility();
  }

  updateContextRowVisibility(): void {
    this.onVisibilityChange?.();
  }

  getContext(): CanvasSelectionContext | null {
    if (!this.storedSelection) return null;
    return {
      canvasPath: this.storedSelection.canvasPath,
      nodeIds: [...this.storedSelection.nodeIds],
      ...(this.storedSelection.nodes
        ? { nodes: this.storedSelection.nodes.map(node => ({ ...node })) }
        : {}),
    };
  }

  hasSelection(): boolean {
    return this.storedSelection !== null;
  }

  clear(): void {
    this.storedSelection = null;
    this.updateIndicator();
  }
}
