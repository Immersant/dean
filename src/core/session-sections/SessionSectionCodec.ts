import { parseYaml, stringifyYaml } from 'obsidian';

import type { SessionSection } from './SessionSection';
import { SESSION_SECTION_LIMITS } from './SessionSection';
import {
  SessionSectionValidationError,
  validateSessionSection,
} from './validateSessionSection';

export class SessionSectionCodecError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SessionSectionCodecError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Parse a `dean-session` fence body into a validated SessionSection.
 */
export function parseSessionSectionYaml(source: string): SessionSection {
  if (typeof source !== 'string') {
    throw new SessionSectionCodecError('section body must be a string');
  }
  const byteLength = new TextEncoder().encode(source).byteLength;
  if (byteLength > SESSION_SECTION_LIMITS.fenceBodyBytes) {
    throw new SessionSectionCodecError(
      `section body exceeds ${SESSION_SECTION_LIMITS.fenceBodyBytes} bytes`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(source);
  } catch (error) {
    throw new SessionSectionCodecError('section body is not valid YAML', { cause: error });
  }
  if (!isRecord(parsed)) {
    throw new SessionSectionCodecError('section body must be a YAML mapping');
  }

  try {
    return validateSessionSection(parsed);
  } catch (error) {
    if (error instanceof SessionSectionValidationError) {
      throw new SessionSectionCodecError(error.message, { cause: error });
    }
    throw error;
  }
}

function serializeYamlFallback(payload: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
        continue;
      }
      lines.push(`${key}:`);
      for (const item of value) {
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          const entries = Object.entries(item as Record<string, unknown>);
          if (entries.length === 0) {
            lines.push('  - {}');
            continue;
          }
          const [firstKey, firstValue] = entries[0];
          lines.push(`  - ${firstKey}: ${formatScalar(firstValue)}`);
          for (const [nestedKey, nestedValue] of entries.slice(1)) {
            if (typeof nestedValue === 'string' && nestedValue.includes('\n')) {
              lines.push(`    ${nestedKey}: |`);
              lines.push(...nestedValue.split('\n').map(line => `      ${line}`));
            } else if (Array.isArray(nestedValue)) {
              lines.push(`    ${nestedKey}:`);
              for (const option of nestedValue) {
                if (option !== null && typeof option === 'object') {
                  const optionEntries = Object.entries(option as Record<string, unknown>);
                  if (optionEntries.length === 0) {
                    lines.push('      - {}');
                    continue;
                  }
                  const [optKey, optValue] = optionEntries[0];
                  lines.push(`      - ${optKey}: ${formatScalar(optValue)}`);
                  for (const [restKey, restValue] of optionEntries.slice(1)) {
                    lines.push(`        ${restKey}: ${formatScalar(restValue)}`);
                  }
                } else {
                  lines.push(`      - ${formatScalar(option)}`);
                }
              }
            } else {
              lines.push(`    ${nestedKey}: ${formatScalar(nestedValue)}`);
            }
          }
        } else {
          lines.push(`  - ${formatScalar(item)}`);
        }
      }
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        if (Array.isArray(nestedValue)) {
          if (nestedValue.length === 0) {
            lines.push(`  ${nestedKey}: []`);
            continue;
          }
          lines.push(`  ${nestedKey}:`);
          for (const item of nestedValue) {
            lines.push(`    - ${formatScalar(item)}`);
          }
          continue;
        }
        if (typeof nestedValue === 'string' && nestedValue.includes('\n')) {
          lines.push(`  ${nestedKey}: |`);
          lines.push(...nestedValue.split('\n').map(line => `    ${line}`));
          continue;
        }
        lines.push(`  ${nestedKey}: ${formatScalar(nestedValue)}`);
      }
      continue;
    }
    if (typeof value === 'string' && value.includes('\n')) {
      lines.push(`${key}: |`);
      lines.push(...value.split('\n').map(line => `  ${line}`));
      continue;
    }
    lines.push(`${key}: ${formatScalar(value)}`);
  }
  return lines.join('\n');
}

function formatScalar(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null || value === undefined) {
    return 'null';
  }
  // Never coerce arrays/objects via String() — that yields invalid YAML values.
  return JSON.stringify(value);
}

/**
 * Serialize a SessionSection to a fence body. Re-validates before stringify.
 */
export function serializeSessionSectionYaml(section: SessionSection): string {
  const validated = validateSessionSection(section);
  const payload: Record<string, unknown> = {
    schemaVersion: validated.schemaVersion,
    id: validated.id,
    conversationId: validated.conversationId,
    epoch: validated.epoch,
    kind: validated.kind,
    title: validated.title,
    status: validated.status,
    createdAt: validated.createdAt,
  };
  if (validated.actions.length > 0) {
    payload.actions = validated.actions.map(action => ({
      id: action.id,
      label: action.label,
      prompt: action.prompt,
    }));
  }
  if (validated.questions.length > 0) {
    payload.questions = validated.questions.map(question => {
      const entry: Record<string, unknown> = {
        id: question.id,
        prompt: question.prompt,
        type: question.type,
      };
      if (question.options && question.options.length > 0) {
        entry.options = question.options.map(option => ({
          id: option.id,
          label: option.label,
        }));
      }
      return entry;
    });
  }
  if (Object.keys(validated.answers).length > 0) {
    payload.answers = { ...validated.answers };
  }
  const body = typeof stringifyYaml === 'function'
    ? stringifyYaml(payload).trimEnd()
    : serializeYamlFallback(payload);
  return `${body}\n`;
}
