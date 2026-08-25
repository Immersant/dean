import { parseYaml } from 'obsidian';

import { parseSessionSectionPresentation } from '../session-sections/SessionSectionPresentation';
import { SessionSectionValidationError } from '../session-sections/SessionSectionValidationError';
import {
  ARTIFACT_FORBIDDEN_YAML_KEYS,
  ARTIFACT_LIMITS,
  ARTIFACT_LOCAL_ID_PATTERN,
  ARTIFACT_SCHEMA_VERSION,
  type DeanArtifact,
} from './DeanArtifact';
import { DeanArtifactCodecError } from './DeanArtifactCodecError';
import { htmlToArtifactNodes } from './htmlToArtifactNodes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseDeanArtifactFence(source: string): DeanArtifact {
  if (typeof source !== 'string') {
    throw new DeanArtifactCodecError('artifact body must be a string');
  }
  const byteLength = new TextEncoder().encode(source).byteLength;
  if (byteLength > ARTIFACT_LIMITS.fenceBodyBytes) {
    throw new DeanArtifactCodecError(
      `artifact body exceeds ${ARTIFACT_LIMITS.fenceBodyBytes} bytes`,
    );
  }

  const { yamlText, htmlText } = splitYamlAndHtml(source);
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (error) {
    throw new DeanArtifactCodecError('artifact header is not valid YAML', { cause: error });
  }
  if (!isRecord(parsed)) {
    throw new DeanArtifactCodecError('artifact header must be a YAML mapping');
  }
  assertNoForbiddenKeys(parsed, 'header');

  const schemaVersion = parsed.schemaVersion;
  if (schemaVersion !== ARTIFACT_SCHEMA_VERSION) {
    throw new DeanArtifactCodecError(`schemaVersion must be ${ARTIFACT_SCHEMA_VERSION}`);
  }

  const id = requireLocalId(parsed.id, 'id');
  const title = requireNonEmptyString(parsed.title, 'title', ARTIFACT_LIMITS.titleChars);
  const createdAt = parseCreatedAt(parsed.createdAt);

  let presentation;
  try {
    presentation = parseSessionSectionPresentation(parsed, 'header');
  } catch (error) {
    if (error instanceof SessionSectionValidationError) {
      throw new DeanArtifactCodecError(error.message, { cause: error });
    }
    throw error;
  }

  const nodes = htmlToArtifactNodes(htmlText);
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    id,
    title,
    createdAt,
    nodes,
    ...presentation,
  };
}

export function splitYamlAndHtml(source: string): { yamlText: string; htmlText: string } {
  const normalized = source.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let index = 0;
  if (lines[0]?.trim() === '---') {
    index = 1;
  }
  const yamlLines: string[] = [];
  let foundSeparator = false;
  for (; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === '' || line.trim() === '---') {
      foundSeparator = true;
      index += 1;
      break;
    }
    yamlLines.push(line);
  }
  if (!foundSeparator) {
    throw new DeanArtifactCodecError('artifact fence must separate YAML header from HTML with a blank line');
  }
  const yamlText = yamlLines.join('\n').trim();
  const htmlText = lines.slice(index).join('\n').trim();
  if (!yamlText) {
    throw new DeanArtifactCodecError('artifact header must be a YAML mapping');
  }
  if (!htmlText) {
    throw new DeanArtifactCodecError('artifact HTML must contain at least one element');
  }
  return { yamlText, htmlText };
}

function assertNoForbiddenKeys(record: Record<string, unknown>, path: string): void {
  for (const key of ARTIFACT_FORBIDDEN_YAML_KEYS) {
    if (key in record) {
      throw new DeanArtifactCodecError(
        `${path} must not include execution-like field "${key}"`,
      );
    }
  }
}

function requireLocalId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ARTIFACT_LOCAL_ID_PATTERN.test(value)) {
    throw new DeanArtifactCodecError(`${field} must be a local id (1-64 safe characters)`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, field: string, maxChars: number): string {
  if (typeof value !== 'string') {
    throw new DeanArtifactCodecError(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new DeanArtifactCodecError(`${field} must be non-empty`);
  }
  if (trimmed.length > maxChars) {
    throw new DeanArtifactCodecError(`${field} exceeds ${maxChars} characters`);
  }
  return trimmed;
}

function parseCreatedAt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new DeanArtifactCodecError('createdAt must be a non-negative integer timestamp');
  }
  return value;
}
