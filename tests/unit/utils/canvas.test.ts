import {
  appendCanvasContext,
  type CanvasSelectionContext,
  canvasSelectionsEqual,
  formatCanvasContext,
  formatCanvasSelectionChipLabel,
  summarizeCanvasSelectionNode,
} from '../../../src/utils/canvas';

describe('canvas utilities', () => {
  describe('formatCanvasContext', () => {
    it('formats single node selection', () => {
      const context: CanvasSelectionContext = {
        canvasPath: 'my-canvas.canvas',
        nodeIds: ['abc123'],
      };
      expect(formatCanvasContext(context)).toBe(
        '<canvas_selection path="my-canvas.canvas">\n<![CDATA[abc123]]>\n</canvas_selection>'
      );
    });

    it('formats multiple node selection as comma-separated list', () => {
      const context: CanvasSelectionContext = {
        canvasPath: 'folder/design.canvas',
        nodeIds: ['node1', 'node2', 'node3'],
      };
      expect(formatCanvasContext(context)).toBe(
        '<canvas_selection path="folder/design.canvas">\n<![CDATA[node1, node2, node3]]>\n</canvas_selection>'
      );
    });

    it('returns empty string for empty node list', () => {
      const context: CanvasSelectionContext = {
        canvasPath: 'test.canvas',
        nodeIds: [],
      };
      expect(formatCanvasContext(context)).toBe('');
    });

    it('escapes the canvas path and a conflicting closing tag', () => {
      const context: CanvasSelectionContext = {
        canvasPath: 'folder/my "canvas" & draft.canvas',
        nodeIds: ['before', '</canvas_selection>'],
      };
      expect(formatCanvasContext(context)).toBe(
        '<canvas_selection path="folder/my &quot;canvas&quot; &amp; draft.canvas">\n<![CDATA[before, </canvas_selection>]]>\n</canvas_selection>',
      );
    });

    it('formats nested node summaries when provided', () => {
      const context: CanvasSelectionContext = {
        canvasPath: 'Board.canvas',
        nodeIds: ['form-1', 'label', 'review-group', 'spec'],
        nodes: [
          { id: 'form-1', type: 'file', file: 'Canvas design build task form.md', color: '1' },
          { id: 'label', type: 'text', text: '# Review stage\nShip the palette.', color: '2' },
          { id: 'review-group', type: 'group', label: 'Review' },
          { id: 'spec', type: 'link', url: 'https://example.com/spec' },
        ],
      };

      expect(formatCanvasContext(context)).toBe(
        [
          '<canvas_selection path="Board.canvas">',
          '<canvas_node id="form-1" type="file" file="Canvas design build task form.md" color="1" />',
          '<canvas_node id="label" type="text" color="2">',
          '<![CDATA[# Review stage\nShip the palette.]]>',
          '</canvas_node>',
          '<canvas_node id="review-group" type="group" label="Review" />',
          '<canvas_node id="spec" type="link" url="https://example.com/spec" />',
          '</canvas_selection>',
        ].join('\n'),
      );
    });

    it('escapes nested summary attributes and text CDATA sequences', () => {
      const context: CanvasSelectionContext = {
        canvasPath: 'folder/my "canvas" & draft.canvas',
        nodeIds: ['n1', 't1'],
        nodes: [
          {
            id: 'n1',
            type: 'file',
            file: 'notes/my "file" & draft.md',
            subpath: '#Heading & Notes',
          },
          {
            id: 't1',
            type: 'text',
            text: 'before ]]> after',
          },
        ],
      };

      expect(formatCanvasContext(context)).toBe(
        [
          '<canvas_selection path="folder/my &quot;canvas&quot; &amp; draft.canvas">',
          '<canvas_node id="n1" type="file" file="notes/my &quot;file&quot; &amp; draft.md" subpath="#Heading &amp; Notes" />',
          '<canvas_node id="t1" type="text">',
          '<![CDATA[before ]]]]><![CDATA[> after]]>',
          '</canvas_node>',
          '</canvas_selection>',
        ].join('\n'),
      );
    });

    it('keeps compact ID list when nodes is empty', () => {
      const context: CanvasSelectionContext = {
        canvasPath: 'Board.canvas',
        nodeIds: ['form-1'],
        nodes: [],
      };
      expect(formatCanvasContext(context)).toBe(
        '<canvas_selection path="Board.canvas">\n<![CDATA[form-1]]>\n</canvas_selection>',
      );
    });
  });

  describe('summarizeCanvasSelectionNode', () => {
    it('summarizes own-property file nodes', () => {
      expect(summarizeCanvasSelectionNode({
        id: 'form-1',
        type: 'file',
        file: 'Form.md',
        color: '1',
      })).toEqual({
        id: 'form-1',
        type: 'file',
        file: 'Form.md',
        color: '1',
      });
    });

    it('reads TFile-like file.path', () => {
      expect(summarizeCanvasSelectionNode({
        id: 'form-1',
        type: 'file',
        file: { path: 'Form.md' },
      })).toEqual({
        id: 'form-1',
        type: 'file',
        file: 'Form.md',
      });
    });

    it('prefers getData() fields and fills gaps from the node', () => {
      expect(summarizeCanvasSelectionNode({
        id: 'form-1',
        color: '4',
        getData: () => ({
          type: 'file',
          file: 'Form.md',
          subpath: '#Intro',
        }),
      })).toEqual({
        id: 'form-1',
        type: 'file',
        file: 'Form.md',
        subpath: '#Intro',
        color: '4',
      });
    });

    it('falls back to own properties when getData throws', () => {
      expect(summarizeCanvasSelectionNode({
        id: 'text-1',
        type: 'text',
        text: 'Hello',
        getData: () => {
          throw new Error('unavailable');
        },
      })).toEqual({
        id: 'text-1',
        type: 'text',
        text: 'Hello',
      });
    });

    it('truncates long text to 200 characters with an ellipsis', () => {
      const text = 'a'.repeat(201);
      expect(summarizeCanvasSelectionNode({
        id: 'text-1',
        type: 'text',
        text,
      })).toEqual({
        id: 'text-1',
        type: 'text',
        text: `${'a'.repeat(200)}…`,
      });
    });

    it('returns null for missing or non-string ids', () => {
      expect(summarizeCanvasSelectionNode(null)).toBeNull();
      expect(summarizeCanvasSelectionNode({})).toBeNull();
      expect(summarizeCanvasSelectionNode({ id: 12 })).toBeNull();
      expect(summarizeCanvasSelectionNode({ id: '' })).toBeNull();
    });
  });

  describe('formatCanvasSelectionChipLabel', () => {
    it('uses the file path for a single file node', () => {
      expect(formatCanvasSelectionChipLabel({
        canvasPath: 'Board.canvas',
        nodeIds: ['form-1'],
        nodes: [{ id: 'form-1', type: 'file', file: 'Form.md' }],
      })).toBe('Form.md');
    });

    it('uses the first line of text for a single text node', () => {
      expect(formatCanvasSelectionChipLabel({
        canvasPath: 'Board.canvas',
        nodeIds: ['label'],
        nodes: [{ id: 'label', type: 'text', text: '# Review stage\nShip it.' }],
      })).toBe('# Review stage');
    });

    it('uses the group label for a single group node', () => {
      expect(formatCanvasSelectionChipLabel({
        canvasPath: 'Board.canvas',
        nodeIds: ['g1'],
        nodes: [{ id: 'g1', type: 'group', label: 'Review' }],
      })).toBe('Review');
    });

    it('uses primary + N nodes for mixed selections', () => {
      expect(formatCanvasSelectionChipLabel({
        canvasPath: 'Board.canvas',
        nodeIds: ['form-1', 'label', 'g1'],
        nodes: [
          { id: 'form-1', type: 'file', file: 'Form.md' },
          { id: 'label', type: 'text', text: 'Notes' },
          { id: 'g1', type: 'group', label: 'Review' },
        ],
      })).toBe('Form.md + 2 nodes');
    });

    it('falls back to a count label for id-only selections', () => {
      expect(formatCanvasSelectionChipLabel({
        canvasPath: 'Board.canvas',
        nodeIds: ['a', 'b'],
        nodes: [{ id: 'a' }, { id: 'b' }],
      })).toBe('2 nodes selected');
    });
  });

  describe('canvasSelectionsEqual', () => {
    it('treats matching path, ids, and summaries as equal', () => {
      const left: CanvasSelectionContext = {
        canvasPath: 'Board.canvas',
        nodeIds: ['form-1'],
        nodes: [{ id: 'form-1', type: 'file', file: 'Form.md' }],
      };
      const right: CanvasSelectionContext = {
        canvasPath: 'Board.canvas',
        nodeIds: ['form-1'],
        nodes: [{ id: 'form-1', type: 'file', file: 'Form.md' }],
      };
      expect(canvasSelectionsEqual(left, right)).toBe(true);
    });

    it('detects text changes on the same node id', () => {
      const left: CanvasSelectionContext = {
        canvasPath: 'Board.canvas',
        nodeIds: ['label'],
        nodes: [{ id: 'label', type: 'text', text: 'before' }],
      };
      const right: CanvasSelectionContext = {
        canvasPath: 'Board.canvas',
        nodeIds: ['label'],
        nodes: [{ id: 'label', type: 'text', text: 'after' }],
      };
      expect(canvasSelectionsEqual(left, right)).toBe(false);
    });
  });

  describe('appendCanvasContext', () => {
    it('appends canvas context after prompt with double newline', () => {
      const context: CanvasSelectionContext = {
        canvasPath: 'my-canvas.canvas',
        nodeIds: ['abc123'],
      };
      const result = appendCanvasContext('hello world', context);
      expect(result).toBe(
        'hello world\n\n<canvas_selection path="my-canvas.canvas">\n<![CDATA[abc123]]>\n</canvas_selection>'
      );
    });

    it('returns original prompt when no nodes selected', () => {
      const context: CanvasSelectionContext = {
        canvasPath: 'my-canvas.canvas',
        nodeIds: [],
      };
      expect(appendCanvasContext('hello world', context)).toBe('hello world');
    });

    it('appends nested summaries when present', () => {
      const context: CanvasSelectionContext = {
        canvasPath: 'Board.canvas',
        nodeIds: ['form-1'],
        nodes: [{ id: 'form-1', type: 'file', file: 'Form.md' }],
      };
      expect(appendCanvasContext('hello', context)).toBe(
        [
          'hello',
          '',
          '<canvas_selection path="Board.canvas">',
          '<canvas_node id="form-1" type="file" file="Form.md" />',
          '</canvas_selection>',
        ].join('\n'),
      );
    });
  });
});
