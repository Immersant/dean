import { createMockEl } from '@test/helpers/MockElement';

import {
  appendThinkingText,
  createThinkingBlock,
  finalizeThinkingBlock,
  renderStoredThinkingBlock,
} from '@/features/chat/rendering/ThinkingBlockRenderer';

// Mock renderContent function
const mockRenderContent = jest.fn().mockImplementation(async (el, markdown) => {
  el.setText(markdown);
});

describe('ThinkingBlockRenderer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createThinkingBlock', () => {
    it('should show timer label', () => {
      const parentEl = createMockEl();

      const state = createThinkingBlock(parentEl);

      expect(state.labelEl.textContent).toContain('Thinking');
    });

    it('replaces the timer with the complete streamed description', () => {
      const parentEl = createMockEl();
      const state = createThinkingBlock(parentEl);

      appendThinkingText(state, 'Inspecting the current ');
      appendThinkingText(state, 'thinking renderer.');

      expect(state.labelEl.textContent).toBe('Inspecting the current thinking renderer.');
      expect(state.timerInterval).toBeNull();
    });

    it('removes outer whitespace from the streamed preview without changing its content', () => {
      const parentEl = createMockEl();
      const state = createThinkingBlock(parentEl);

      appendThinkingText(state, '\n\nInspecting the renderer.\n');

      expect(state.labelEl.textContent).toBe('Inspecting the renderer.');
      expect(state.content).toBe('\n\nInspecting the renderer.\n');
    });

    it('should clean up timer on finalize', () => {
      const parentEl = createMockEl();

      const state = createThinkingBlock(parentEl);

      expect(state.timerInterval).not.toBeNull();

      finalizeThinkingBlock(state);

      expect(state.timerInterval).toBeNull();
    });

    it('reports expansion state without rendering content itself', () => {
      const parentEl = createMockEl();
      const onToggle = jest.fn();
      const state = createThinkingBlock(parentEl, { onToggle });
      const header = (state.wrapperEl as any)._children[0];
      const clickHandlers = header._eventListeners.get('click') || [];

      clickHandlers[0]();
      clickHandlers[0]();

      expect(onToggle).toHaveBeenNthCalledWith(1, true);
      expect(onToggle).toHaveBeenNthCalledWith(2, false);
      expect(mockRenderContent).not.toHaveBeenCalled();
    });
  });

  describe('finalizeThinkingBlock', () => {
    it('should collapse the block when finalized', () => {
      const parentEl = createMockEl();

      const state = createThinkingBlock(parentEl);

      // Manually expand first
      state.wrapperEl.addClass('expanded');
      state.contentEl.style.display = 'block';

      finalizeThinkingBlock(state);

      expect(state.wrapperEl.hasClass('expanded')).toBe(false);
      expect(state.contentEl.style.display).toBe('none');
    });

    it('keeps the complete description when finalized', () => {
      const parentEl = createMockEl();

      const state = createThinkingBlock(parentEl);

      appendThinkingText(state, 'Reviewing the complete implementation plan.');

      // Advance time by 5 seconds
      jest.advanceTimersByTime(5000);

      const duration = finalizeThinkingBlock(state);

      expect(duration).toBeGreaterThanOrEqual(5);
      expect(state.labelEl.textContent).toBe('Reviewing the complete implementation plan.');
    });

    it('should sync isExpanded state so toggle works correctly after finalize', () => {
      const parentEl = createMockEl();

      const state = createThinkingBlock(parentEl);
      const header = (state.wrapperEl as any)._children[0];

      // Expand the block
      const clickHandlers = header._eventListeners.get('click') || [];
      clickHandlers[0]();
      expect(state.isExpanded).toBe(true);
      expect((state.wrapperEl as any).hasClass('expanded')).toBe(true);

      // Finalize (which collapses)
      finalizeThinkingBlock(state);
      expect(state.isExpanded).toBe(false);
      expect((state.wrapperEl as any).hasClass('expanded')).toBe(false);

      // Now click once - should expand (not require two clicks)
      clickHandlers[0]();
      expect(state.isExpanded).toBe(true);
      expect((state.wrapperEl as any).hasClass('expanded')).toBe(true);
      expect((state.contentEl as any).hasClass('dean-hidden')).toBe(false);
    });

    it('should update aria-expanded on finalize', () => {
      const parentEl = createMockEl();

      const state = createThinkingBlock(parentEl);
      const header = (state.wrapperEl as any)._children[0];

      // Expand first
      const clickHandlers = header._eventListeners.get('click') || [];
      clickHandlers[0]();
      expect(header.getAttribute('aria-expanded')).toBe('true');

      // Finalize
      finalizeThinkingBlock(state);
      expect(header.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('renderStoredThinkingBlock', () => {
    it('renders the complete stored description instead of the duration', () => {
      const parentEl = createMockEl();

      const wrapperEl = renderStoredThinkingBlock(parentEl, 'thinking content', 10, mockRenderContent);
      const header = (wrapperEl as any)._children[0];
      const label = header._children[0];

      expect(label.textContent).toBe('thinking content');
    });

    it('falls back to Thought when stored content is empty', () => {
      const parentEl = createMockEl();

      const wrapperEl = renderStoredThinkingBlock(parentEl, '', 10, mockRenderContent);
      const header = (wrapperEl as any)._children[0];
      const label = header._children[0];

      expect(label.textContent).toBe('Thought');
    });

    it('removes outer whitespace from a stored preview', () => {
      const parentEl = createMockEl();

      const wrapperEl = renderStoredThinkingBlock(
        parentEl,
        '\n\nStored description.\n',
        10,
        mockRenderContent
      );
      const header = (wrapperEl as any)._children[0];
      const label = header._children[0];

      expect(label.textContent).toBe('Stored description.');
      expect(mockRenderContent).toHaveBeenCalledWith(
        expect.anything(),
        '\n\nStored description.\n'
      );
    });

    it('renders Markdown in the stored description label', () => {
      const parentEl = createMockEl();

      const wrapperEl = renderStoredThinkingBlock(
        parentEl,
        '**Checking** the renderer.',
        10,
        mockRenderContent
      );
      const header = (wrapperEl as any)._children[0];
      const label = header._children[0];

      expect(label.tagName).toBe('DIV');
      expect(mockRenderContent).toHaveBeenCalledWith(label, '**Checking** the renderer.');
    });

  });
});
