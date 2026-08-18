import {
  buildDeanSystemPromptAppendices,
  SESSION_SECTION_AUTHORING_APPENDIX,
} from '@/core/session-sections/sessionSectionPrompt';

describe('buildDeanSystemPromptAppendices', () => {
  it('returns empty when the flag is off or missing', () => {
    expect(buildDeanSystemPromptAppendices({ enableEditorSessionSections: false })).toEqual([]);
    expect(buildDeanSystemPromptAppendices(undefined)).toEqual([]);
  });

  it('returns the authoring appendix when the flag is on', () => {
    expect(buildDeanSystemPromptAppendices({ enableEditorSessionSections: true })).toEqual([
      SESSION_SECTION_AUTHORING_APPENDIX,
    ]);
  });

  it('suppresses the appendix for passive and read-only tool policies', () => {
    expect(buildDeanSystemPromptAppendices(
      { enableEditorSessionSections: true },
      { kind: 'passive' },
    )).toEqual([]);
    expect(buildDeanSystemPromptAppendices(
      { enableEditorSessionSections: true },
      { kind: 'read-only' },
    )).toEqual([]);
  });

  it('keeps the appendix for provider-default tool policy', () => {
    expect(buildDeanSystemPromptAppendices(
      { enableEditorSessionSections: true },
      { kind: 'provider-default' },
    )).toEqual([SESSION_SECTION_AUTHORING_APPENDIX]);
  });
});
