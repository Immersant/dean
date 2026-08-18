import type {
  SessionSectionQuestion,
  StandaloneCollectSessionSection,
} from '../../core/session-sections';
import { t } from '../../i18n/i18n';

export function formatStandaloneCollectDraft(
  section: StandaloneCollectSessionSection,
  notePath: string,
): string {
  const lines = [
    `# ${escapeHeading(section.title)}`,
    '',
    t('settings.sessionSections.newChatDraft.sourceNote', { path: notePath }),
  ];
  for (const question of section.questions) {
    lines.push(
      '',
      `## ${escapeHeading(question.prompt)}`,
      '',
      ...formatAnswer(question, section.answers[question.id]),
    );
  }
  return lines.join('\n');
}

function escapeHeading(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/\\/g, '\\\\').replace(/#/g, '\\#');
}

function formatAnswer(
  question: SessionSectionQuestion,
  answer: string | string[] | undefined,
): string[] {
  const values = Array.isArray(answer) ? answer : answer?.trim() ? [answer] : [];
  if (values.length === 0) {
    return [`_${t('settings.sessionSections.newChatDraft.notAnswered')}_`];
  }
  if (Array.isArray(answer)) {
    return values.map(value => `- ${resolveOptionLabel(question, value)}`);
  }
  return [resolveOptionLabel(question, values[0])];
}

function resolveOptionLabel(question: SessionSectionQuestion, value: string): string {
  return question.options?.find(option => option.id === value)?.label ?? value;
}
