import { escapePromptXmlAttribute, formatPromptXmlCdata } from '../../utils/promptXml';
import type {
  ExecutionInputConversationBindingSnapshot,
  ExecutionInputSessionSectionQuestionSnapshot,
  ExecutionInputSessionSectionSnapshot,
} from '../types/chat';

export function formatDeanConversationBinding(
  binding: ExecutionInputConversationBindingSnapshot,
): string {
  return (
    `<dean_conversation`
    + ` id="${escapePromptXmlAttribute(binding.conversationId)}"`
    + ` section_epoch="${escapePromptXmlAttribute(String(binding.sectionEpoch))}"`
    + ` />`
  );
}

export function formatSessionSectionContext(
  section: ExecutionInputSessionSectionSnapshot,
): string {
  const attrs = [
    `id="${escapePromptXmlAttribute(section.sectionId)}"`,
    `kind="${escapePromptXmlAttribute(section.kind)}"`,
  ];
  if (section.actionId) {
    attrs.push(`action="${escapePromptXmlAttribute(section.actionId)}"`);
  }
  attrs.push(`path="${escapePromptXmlAttribute(section.notePath)}"`);
  if (section.title) {
    attrs.push(`title="${escapePromptXmlAttribute(section.title)}"`);
  }

  const lines = [
    `<session_section ${attrs.join(' ')}>`,
    formatPromptXmlCdata(section.prompt ?? ''),
  ];
  const answers = section.answers ?? {};
  const consumed = new Set<string>();

  for (const question of section.questions ?? []) {
    lines.push(...formatQuestion(question, answers[question.id]));
    consumed.add(question.id);
  }
  for (const [id, value] of Object.entries(answers)) {
    if (consumed.has(id)) {
      continue;
    }
    lines.push(...formatOrphanAnswers(id, value));
  }

  lines.push('</session_section>');
  return lines.join('\n');
}

function formatQuestion(
  question: ExecutionInputSessionSectionQuestionSnapshot,
  value: string | string[] | undefined,
): string[] {
  const lines = [
    `<question id="${escapePromptXmlAttribute(question.id)}" type="${escapePromptXmlAttribute(question.type)}">`,
    `<prompt>${formatPromptXmlCdata(question.prompt)}</prompt>`,
  ];
  lines.push(...formatAnswerTags(value, question));
  lines.push('</question>');
  return lines;
}

function formatOrphanAnswers(
  id: string,
  value: string | string[] | undefined,
): string[] {
  return formatAnswerTags(value, undefined, id);
}

function formatAnswerTags(
  value: string | string[] | undefined,
  question?: ExecutionInputSessionSectionQuestionSnapshot,
  orphanId?: string,
): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];
  const tags: string[] = [];
  for (const item of values) {
    if (!item.trim()) {
      continue;
    }
    const option = question?.options?.find(candidate => candidate.id === item);
    const id = option?.id ?? (question?.options ? item : orphanId);
    const text = option?.label ?? item;
    const open = id
      ? `<answer id="${escapePromptXmlAttribute(id)}">`
      : '<answer>';
    tags.push(`${open}${formatPromptXmlCdata(text)}</answer>`);
  }
  return tags;
}

export function appendDeanConversationBinding(
  prompt: string,
  binding: ExecutionInputConversationBindingSnapshot,
): string {
  return `${prompt}\n\n${formatDeanConversationBinding(binding)}`;
}

export function appendSessionSectionContext(
  prompt: string,
  section: ExecutionInputSessionSectionSnapshot,
): string {
  return `${prompt}\n\n${formatSessionSectionContext(section)}`;
}
