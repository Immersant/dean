import {
  DEAN_HOST_CONTEXT,
  appendDeanHostContext,
  formatDeanHostContext,
} from '@/core/context/DeanHostContext';

describe('DeanHostContext', () => {
  it('formats the versioned Dean plugin marker', () => {
    expect(formatDeanHostContext()).toBe(
      '<dean_host context_mode="dean-plugin" version="1" />',
    );
    expect(DEAN_HOST_CONTEXT).toBe(formatDeanHostContext());
  });

  it('appends the marker after user text', () => {
    expect(appendDeanHostContext('Hello')).toBe(
      'Hello\n\n<dean_host context_mode="dean-plugin" version="1" />',
    );
  });
});
