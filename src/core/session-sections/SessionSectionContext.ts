import { escapePromptXmlAttribute, formatPromptXmlCdata } from '../../utils/promptXml';
import type {
  ExecutionInputConversationBindingSnapshot,
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

  const body = section.prompt ?? '';
  return (
    `<session_section ${attrs.join(' ')}>\n`
    + `${formatPromptXmlCdata(body)}\n`
    + `</session_section>`
  );
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
