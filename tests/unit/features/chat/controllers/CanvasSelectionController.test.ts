import { createMockEl } from '@test/helpers/MockElement';

import { CanvasSelectionController } from '@/features/chat/controllers/CanvasSelectionController';

function createMockContextTray() {
  return {
    setItems: jest.fn(),
    clearItems: jest.fn(),
  };
}

function createMockCanvasNode(id: string, extras: Record<string, unknown> = {}) {
  return { id, ...extras };
}

describe('CanvasSelectionController', () => {
  let controller: CanvasSelectionController;
  let app: any;
  let contextTray: ReturnType<typeof createMockContextTray>;
  let inputEl: any;
  let canvasView: any;
  let originalDocument: any;

  beforeEach(() => {
    jest.useFakeTimers();

    contextTray = createMockContextTray();
    inputEl = createMockEl();

    const node1 = createMockCanvasNode('abc123');
    const node2 = createMockCanvasNode('def456');

    canvasView = {
      getViewType: () => 'canvas',
      canvas: {
        selection: new Set([node1, node2]),
      },
      file: { path: 'my-canvas.canvas' },
    };

    app = {
      workspace: {
        getActiveViewOfType: jest.fn().mockReturnValue(null),
        getMostRecentLeaf: jest.fn().mockReturnValue({ view: canvasView }),
        getLeavesOfType: jest.fn().mockReturnValue([{ view: canvasView }]),
      },
    };

    controller = new CanvasSelectionController(app, contextTray as any, inputEl);

    originalDocument = (global as any).document;
    (global as any).document = { activeElement: null };
  });

  afterEach(() => {
    controller.stop();
    jest.useRealTimers();
    (global as any).document = originalDocument;
  });

  it('captures canvas selection and updates indicator', () => {
    controller.start();
    jest.advanceTimersByTime(250);

    expect(controller.hasSelection()).toBe(true);
    expect(controller.getContext()).toEqual({
      canvasPath: 'my-canvas.canvas',
      nodeIds: ['abc123', 'def456'],
      nodes: [{ id: 'abc123' }, { id: 'def456' }],
    });
    expect(contextTray.setItems).toHaveBeenLastCalledWith('canvas-selection', [
      expect.objectContaining({
        label: '2 nodes selected',
        title: 'abc123\ndef456',
      }),
    ]);
  });

  it('shows node ID for single selection', () => {
    const singleNode = createMockCanvasNode('single1');
    canvasView.canvas.selection = new Set([singleNode]);

    controller.start();
    jest.advanceTimersByTime(250);

    expect(controller.getContext()).toEqual({
      canvasPath: 'my-canvas.canvas',
      nodeIds: ['single1'],
      nodes: [{ id: 'single1' }],
    });
    expect(contextTray.setItems).toHaveBeenLastCalledWith('canvas-selection', [
      expect.objectContaining({ label: '1 node selected' }),
    ]);
  });

  it('captures selected canvas file node summaries', () => {
    canvasView.canvas.selection = new Set([
      createMockCanvasNode('form-1', {
        type: 'file',
        file: 'Form.md',
        color: '1',
      }),
    ]);

    controller.start();
    jest.advanceTimersByTime(250);

    expect(controller.getContext()).toEqual({
      canvasPath: 'my-canvas.canvas',
      nodeIds: ['form-1'],
      nodes: [{ id: 'form-1', type: 'file', file: 'Form.md', color: '1' }],
    });
    expect(contextTray.setItems).toHaveBeenLastCalledWith('canvas-selection', [
      expect.objectContaining({ label: 'Form.md' }),
    ]);
  });

  it('reads TFile-like file.path and getData summaries', () => {
    canvasView.canvas.selection = new Set([
      createMockCanvasNode('file-1', {
        file: { path: 'Bug report.md' },
      }),
      {
        id: 'text-1',
        getData: () => ({
          type: 'text',
          text: 'Decision notes',
        }),
      },
      createMockCanvasNode('group-1', {
        type: 'group',
        label: 'Review',
      }),
      createMockCanvasNode('link-1', {
        type: 'link',
        url: 'https://example.com/spec',
      }),
    ]);

    controller.start();
    jest.advanceTimersByTime(250);

    expect(controller.getContext()).toEqual({
      canvasPath: 'my-canvas.canvas',
      nodeIds: ['file-1', 'text-1', 'group-1', 'link-1'],
      nodes: [
        { id: 'file-1', file: 'Bug report.md' },
        { id: 'text-1', type: 'text', text: 'Decision notes' },
        { id: 'group-1', type: 'group', label: 'Review' },
        { id: 'link-1', type: 'link', url: 'https://example.com/spec' },
      ],
    });
    expect(contextTray.setItems).toHaveBeenLastCalledWith('canvas-selection', [
      expect.objectContaining({
        label: 'Bug report.md + 3 nodes',
        title: 'Bug report.md\nDecision notes\nReview\nhttps://example.com/spec',
      }),
    ]);
  });

  it('updates when selected text content changes on the same node id', () => {
    const textNode: { id: string; type: string; text: string } = {
      id: 'label',
      type: 'text',
      text: 'before',
    };
    canvasView.canvas.selection = new Set([textNode]);

    controller.start();
    jest.advanceTimersByTime(250);
    expect(controller.getContext()?.nodes?.[0].text).toBe('before');

    contextTray.setItems.mockClear();
    textNode.text = 'after';
    jest.advanceTimersByTime(250);

    expect(controller.getContext()?.nodes?.[0].text).toBe('after');
    expect(contextTray.setItems).toHaveBeenCalled();
  });

  it('clears selection when no nodes selected and input not focused', () => {
    controller.start();
    jest.advanceTimersByTime(250);
    expect(controller.hasSelection()).toBe(true);

    canvasView.canvas.selection = new Set();
    (global as any).document.activeElement = null;

    jest.advanceTimersByTime(250);

    expect(controller.hasSelection()).toBe(false);
    expect(contextTray.clearItems).toHaveBeenCalledWith('canvas-selection');
  });

  it('preserves selection when input is focused (sticky)', () => {
    controller.start();
    jest.advanceTimersByTime(250);
    expect(controller.hasSelection()).toBe(true);

    canvasView.canvas.selection = new Set();
    (global as any).document.activeElement = inputEl;

    jest.advanceTimersByTime(250);

    expect(controller.hasSelection()).toBe(true);
    expect(contextTray.clearItems).not.toHaveBeenCalledWith('canvas-selection');
  });

  it('returns null context when no selection', () => {
    canvasView.canvas.selection = new Set();
    controller.start();
    jest.advanceTimersByTime(250);

    expect(controller.getContext()).toBeNull();
  });

  it('does not update when selection unchanged', () => {
    controller.start();
    jest.advanceTimersByTime(250);

    contextTray.setItems.mockClear();

    jest.advanceTimersByTime(250);

    expect(contextTray.setItems).not.toHaveBeenCalled();
  });

  it('prefers active canvas leaf when multiple canvases are open', () => {
    const activeNode = createMockCanvasNode('active-node');
    const inactiveNode = createMockCanvasNode('inactive-node');
    const inactiveCanvasView = {
      getViewType: () => 'canvas',
      canvas: { selection: new Set([inactiveNode]) },
      file: { path: 'inactive.canvas' },
    };
    const activeCanvasView = {
      getViewType: () => 'canvas',
      canvas: { selection: new Set([activeNode]) },
      file: { path: 'active.canvas' },
    };

    app.workspace.getLeavesOfType.mockReturnValue([
      { view: inactiveCanvasView },
      { view: activeCanvasView },
    ]);
    app.workspace.getMostRecentLeaf.mockReturnValue({ view: activeCanvasView });

    controller.start();
    jest.advanceTimersByTime(250);

    expect(controller.getContext()).toEqual({
      canvasPath: 'active.canvas',
      nodeIds: ['active-node'],
      nodes: [{ id: 'active-node' }],
    });
  });

  it('handles no canvas view gracefully', () => {
    app.workspace.getMostRecentLeaf.mockReturnValue(null);
    app.workspace.getLeavesOfType.mockReturnValue([]);

    controller.start();
    jest.advanceTimersByTime(250);

    expect(controller.hasSelection()).toBe(false);
    expect(controller.getContext()).toBeNull();
  });

  it('clear() resets state and indicator', () => {
    controller.start();
    jest.advanceTimersByTime(250);
    expect(controller.hasSelection()).toBe(true);

    controller.clear();

    expect(controller.hasSelection()).toBe(false);
    expect(contextTray.clearItems).toHaveBeenCalledWith('canvas-selection');
  });

  it('clears selection from the tray remove action', () => {
    controller.start();
    jest.advanceTimersByTime(250);

    const items = contextTray.setItems.mock.calls[0][1];
    items[0].onRemove();

    expect(controller.hasSelection()).toBe(false);
    expect(contextTray.clearItems).toHaveBeenCalledWith('canvas-selection');
  });
});
