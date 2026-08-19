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

  it('documents standalone new-chat Collect forms without invented conversation ids', () => {
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('startNewChat');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('required submit-button label');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('omit `conversationId` and `epoch`');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('Never invent a conversation id');
  });

  it('documents split-fence forms that share formId without mixing modes', () => {
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('formId');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('interleave normal editor prose');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain(
      'Never mix bound and standalone under one `formId`',
    );
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain(
      'only on the last member in the note',
    );
  });
});
