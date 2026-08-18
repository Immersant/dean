import type { App, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { TFile as ObsidianTFile } from 'obsidian';

import {
  parseSessionSectionYaml,
  serializeSessionSectionYaml,
  SESSION_SECTION_FENCE_LANGUAGE,
  type SessionSection,
} from '../../core/session-sections';
import { recordSessionSectionDiagnostic } from './SessionSectionDiagnostics';

export type SessionSectionWriteBackResult =
  | { readonly status: 'written' }
  | { readonly status: 'skipped'; readonly reason: 'unchanged' | 'no-file' | 'no-range' }
  | { readonly status: 'failed'; readonly error: string };

export interface SessionSectionWriteBackOptions {
  readonly app: App;
  readonly notePath: string;
  readonly el: HTMLElement;
  readonly ctx: MarkdownPostProcessorContext;
  readonly section: SessionSection;
  /** Original fence body used only as a fallback locator when getSectionInfo fails. */
  readonly originalSource: string;
}

export type FenceRangeKind = 'full-fence' | 'body-only';

export interface FenceRange {
  readonly start: number;
  readonly end: number;
  readonly kind: FenceRangeKind;
}

/**
 * One write-back owner for Collect answers.
 * Always replaces the full ```dean-session … ``` fence (never body-only).
 * Body-only edits leave the closing fence in place and can glue adjacent fences
 * into ``````dean-session, which re-parses as invalid YAML.
 * Does not call FeatureHost.submitSessionSectionTurn.
 */
export async function writeSessionSectionToNote(
  options: SessionSectionWriteBackOptions,
): Promise<SessionSectionWriteBackResult> {
  const { app, notePath, el, ctx, section, originalSource } = options;
  const file = resolveMarkdownFile(app, notePath);
  if (!file) {
    return { status: 'skipped', reason: 'no-file' };
  }

  let current: string;
  try {
    current = await app.vault.read(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'read failed';
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'writeback-read-failed',
      message,
      conversationId: section.conversationId,
      sectionId: section.id,
    });
    return { status: 'failed', error: message };
  }

  let fenceBody: string;
  try {
    fenceBody = serializeSessionSectionYaml(section).replace(/\s+$/, '') + '\n';
    // Never write a body we cannot re-parse — that surfaces as "Invalid session section".
    parseSessionSectionYaml(fenceBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'serialize failed';
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'writeback-serialize-invalid',
      message,
      conversationId: section.conversationId,
      sectionId: section.id,
    });
    return { status: 'failed', error: message };
  }

  const range = resolveFenceRange(current, el, ctx, originalSource, section.id);
  if (!range || range.kind !== 'full-fence') {
    recordSessionSectionDiagnostic({
      level: 'warn',
      code: 'writeback-no-range',
      message: 'Could not locate full fence range for write-back',
      conversationId: section.conversationId,
      sectionId: section.id,
    });
    return { status: 'skipped', reason: 'no-range' };
  }

  const ending = detectLineEnding(current);
  const replacement = buildFenceBlock(fenceBody, ending);
  const next = current.slice(0, range.start)
    + replacement
    + current.slice(range.end);
  if (next === current) {
    return { status: 'skipped', reason: 'unchanged' };
  }

  // Sanity: the post-write body for this section must still parse, and must not
  // leave glued fence markers (``````) that break adjacent sections.
  if (next.includes('``````')) {
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'writeback-verify-failed',
      message: 'write would glue fence markers; aborted',
      conversationId: section.conversationId,
      sectionId: section.id,
    });
    return { status: 'failed', error: 'write would glue fence markers; aborted' };
  }

  const verifyRange = findFenceBySectionId(next, section.id, ending);
  if (!verifyRange) {
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'writeback-verify-failed',
      message: 'post-write fence missing',
      conversationId: section.conversationId,
      sectionId: section.id,
    });
    return { status: 'failed', error: 'post-write fence missing' };
  }
  try {
    parseSessionSectionYaml(extractBodyFromFullFence(next.slice(verifyRange.start, verifyRange.end)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'post-write body invalid';
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'writeback-verify-failed',
      message,
      conversationId: section.conversationId,
      sectionId: section.id,
    });
    return { status: 'failed', error: message };
  }

  try {
    await app.vault.modify(file, next);
    recordSessionSectionDiagnostic({
      level: 'info',
      code: 'writeback-written',
      message: 'Collect answers flushed (full-fence)',
      conversationId: section.conversationId,
      sectionId: section.id,
    });
    return { status: 'written' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'modify failed';
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'writeback-failed',
      message,
      conversationId: section.conversationId,
      sectionId: section.id,
    });
    return { status: 'failed', error: message };
  }
}

export function buildFenceBlock(body: string, lineEnding: '\n' | '\r\n'): string {
  const normalizedBody = normalizeBodyForFile(body, lineEnding);
  return (
    '```'
    + SESSION_SECTION_FENCE_LANGUAGE
    + lineEnding
    + normalizedBody
    + '```'
  );
}

export function normalizeBodyForFile(body: string, lineEnding: '\n' | '\r\n'): string {
  const normalized = body.replace(/\r\n/g, '\n').replace(/\n/g, lineEnding);
  return normalized.endsWith(lineEnding) ? normalized : `${normalized}${lineEnding}`;
}

export function detectLineEnding(content: string): '\n' | '\r\n' {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

export function classifyFenceSlice(slice: string): FenceRangeKind {
  const trimmed = slice.replace(/^\uFEFF/, '').trimStart();
  return trimmed.startsWith('```') ? 'full-fence' : 'body-only';
}

/**
 * Locate the full ```dean-session fence for `sectionId`.
 * Prefer id match; use getSectionInfo only as a hint to expand to full fence.
 */
export function resolveFenceRange(
  fileContent: string,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  originalSource: string,
  sectionId: string,
): FenceRange | null {
  const ending = detectLineEnding(fileContent);

  // 1. Exact id match — most reliable with multiple fences on one note.
  const byId = findFenceBySectionId(fileContent, sectionId, ending);
  if (byId) {
    return byId;
  }

  // 2. Expand getSectionInfo (often body-only or open..body without close) to full fence.
  const fromSectionInfo = rangeFromSectionInfo(fileContent, el, ctx);
  if (fromSectionInfo) {
    const expanded = expandToFullFence(fileContent, fromSectionInfo.start, fromSectionInfo.end, ending);
    if (expanded && fenceBodyHasSectionId(
      extractBodyFromFullFence(fileContent.slice(expanded.start, expanded.end)),
      sectionId,
    )) {
      return expanded;
    }
    // If the section moved or id is not yet written, still accept expanded range
    // when the original body matches the hint slice.
    if (expanded) {
      return expanded;
    }
  }

  // 3. Exact original body match inside a fence.
  return rangeFromSourceMatch(fileContent, originalSource, sectionId, ending);
}

export function findFenceBySectionId(
  fileContent: string,
  sectionId: string,
  ending: '\n' | '\r\n' = detectLineEnding(fileContent),
): FenceRange | null {
  const normalized = fileContent.replace(/\r\n/g, '\n');
  const open = '```' + SESSION_SECTION_FENCE_LANGUAGE;
  let searchFrom = 0;
  while (searchFrom < normalized.length) {
    const openAt = normalized.indexOf(open + '\n', searchFrom);
    if (openAt < 0) {
      break;
    }
    const endAt = findFenceEnd(normalized, openAt);
    if (endAt < 0) {
      break;
    }
    const body = extractBodyFromFullFence(normalized.slice(openAt, endAt));
    if (fenceBodyHasSectionId(body, sectionId)) {
      return {
        ...mapNormalizedRangeToOriginal(fileContent, openAt, endAt, ending),
        kind: 'full-fence',
      };
    }
    searchFrom = endAt;
  }
  return null;
}

/**
 * Expand any offset hint (body-only, open+body, full fence) to the enclosing
 * ```dean-session … ``` fence. Prevents glued `````` when the close line is left behind.
 */
export function expandToFullFence(
  fileContent: string,
  hintStart: number,
  hintEnd: number,
  ending: '\n' | '\r\n' = detectLineEnding(fileContent),
): FenceRange | null {
  const normalized = fileContent.replace(/\r\n/g, '\n');
  const open = '```' + SESSION_SECTION_FENCE_LANGUAGE;
  const mapHintStart = mapOriginalOffsetToNormalized(fileContent, hintStart, ending);
  const mapHintEnd = mapOriginalOffsetToNormalized(fileContent, hintEnd, ending);

  // Prefer the fence whose body contains the hint midpoint (stable with body-only hints).
  const mid = Math.floor((mapHintStart + mapHintEnd) / 2);
  let searchFrom = 0;
  let fallback: FenceRange | null = null;
  while (searchFrom < normalized.length) {
    const openAt = normalized.indexOf(open + '\n', searchFrom);
    if (openAt < 0) {
      break;
    }
    const endAt = findFenceEnd(normalized, openAt);
    if (endAt < 0) {
      break;
    }
    const range = {
      ...mapNormalizedRangeToOriginal(fileContent, openAt, endAt, ending),
      kind: 'full-fence' as const,
    };
    if (openAt <= mid && mid < endAt) {
      return range;
    }
    // Also accept overlap with the original hint window.
    if (endAt > mapHintStart && openAt < mapHintEnd) {
      fallback = range;
    }
    searchFrom = endAt;
  }
  return fallback;
}

function extractBodyFromFullFence(fenceSlice: string): string {
  const normalized = fenceSlice.replace(/\r\n/g, '\n');
  const open = '```' + SESSION_SECTION_FENCE_LANGUAGE + '\n';
  if (!normalized.startsWith(open)) {
    // Body-only slice: strip a trailing close fence line if present.
    return normalized.replace(/\n```\s*$/, '\n');
  }
  const withoutOpen = normalized.slice(open.length);
  const closeAt = withoutOpen.lastIndexOf('\n```');
  if (closeAt >= 0) {
    return withoutOpen.slice(0, closeAt + 1);
  }
  if (withoutOpen.endsWith('```')) {
    return withoutOpen.slice(0, -3);
  }
  return withoutOpen;
}

function rangeFromSectionInfo(
  fileContent: string,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
): { start: number; end: number } | null {
  if (typeof ctx.getSectionInfo !== 'function') {
    return null;
  }
  let info: { lineStart?: number; lineEnd?: number; text?: string } | null;
  try {
    info = ctx.getSectionInfo(el);
  } catch {
    return null;
  }
  if (
    !info
    || typeof info.lineStart !== 'number'
    || typeof info.lineEnd !== 'number'
    || info.lineStart < 0
    || info.lineEnd < info.lineStart
  ) {
    return null;
  }

  const ending = detectLineEnding(fileContent);
  const lines = fileContent.split(/\r?\n/);
  if (info.lineEnd >= lines.length) {
    return null;
  }

  // Obsidian section lines are 0-based inclusive.
  let startOffset = 0;
  for (let i = 0; i < info.lineStart; i++) {
    startOffset += lines[i].length + ending.length;
  }
  let endOffset = startOffset;
  for (let i = info.lineStart; i <= info.lineEnd; i++) {
    endOffset += lines[i].length;
    if (i < info.lineEnd) {
      endOffset += ending.length;
    } else if (info.lineEnd < lines.length - 1) {
      // Include the trailing newline after the last section line when present.
      endOffset += ending.length;
    }
  }

  return { start: startOffset, end: endOffset };
}

function rangeFromSourceMatch(
  fileContent: string,
  originalSource: string,
  sectionId: string,
  ending: '\n' | '\r\n',
): FenceRange | null {
  const open = '```' + SESSION_SECTION_FENCE_LANGUAGE;
  const normalized = fileContent.replace(/\r\n/g, '\n');
  const normalizedOriginal = originalSource.replace(/\r\n/g, '\n').trimEnd();

  // Prefer an exact open+body match (full fence).
  const exactNeedle = open + '\n' + normalizedOriginal;
  const exactIndex = normalized.indexOf(exactNeedle);
  if (exactIndex >= 0) {
    const endAt = findFenceEnd(normalized, exactIndex);
    if (endAt >= 0) {
      return {
        ...mapNormalizedRangeToOriginal(fileContent, exactIndex, endAt, ending),
        kind: 'full-fence',
      };
    }
  }

  // Body-only needle: find open fence that contains this body, expand to close.
  const bodyIndex = normalized.indexOf(normalizedOriginal);
  if (bodyIndex >= 0) {
    const expanded = expandToFullFence(
      fileContent,
      mapNormalizedRangeToOriginal(fileContent, bodyIndex, bodyIndex + normalizedOriginal.length, ending).start,
      mapNormalizedRangeToOriginal(fileContent, bodyIndex, bodyIndex + normalizedOriginal.length, ending).end,
      ending,
    );
    if (expanded) {
      return expanded;
    }
  }

  return findFenceBySectionId(fileContent, sectionId, ending);
}

export function fenceBodyHasSectionId(body: string, sectionId: string): boolean {
  const pattern = new RegExp(
    `^id:\\s*(?:["']${escapeRegExp(sectionId)}["']|${escapeRegExp(sectionId)})\\s*$`,
    'm',
  );
  return pattern.test(body);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findFenceEnd(normalizedContent: string, openAt: number): number {
  const afterOpen = normalizedContent.indexOf('\n', openAt);
  if (afterOpen < 0) {
    return -1;
  }
  // Close fence is a line that is exactly ``` (optionally trailing spaces).
  // A second ```dean-session open without a close is not a valid terminator.
  let searchFrom = afterOpen + 1;
  while (searchFrom <= normalizedContent.length) {
    const lineEnd = normalizedContent.indexOf('\n', searchFrom);
    const end = lineEnd < 0 ? normalizedContent.length : lineEnd;
    const line = normalizedContent.slice(searchFrom, end);
    if (/^```\s*$/.test(line)) {
      return end; // exclusive end at the newline after ```, or EOF
    }
    if (line.startsWith('```')) {
      return -1;
    }
    if (lineEnd < 0) {
      break;
    }
    searchFrom = lineEnd + 1;
  }
  return -1;
}

function mapNormalizedRangeToOriginal(
  original: string,
  normalizedStart: number,
  normalizedEnd: number,
  ending: '\n' | '\r\n',
): { start: number; end: number } {
  if (ending === '\n') {
    return { start: normalizedStart, end: normalizedEnd };
  }
  let originalIndex = 0;
  let normalizedIndex = 0;
  let start = -1;
  let end = -1;
  while (originalIndex <= original.length && normalizedIndex <= normalizedEnd) {
    if (normalizedIndex === normalizedStart) {
      start = originalIndex;
    }
    if (normalizedIndex === normalizedEnd) {
      end = originalIndex;
      break;
    }
    if (original.startsWith('\r\n', originalIndex)) {
      originalIndex += 2;
      normalizedIndex += 1;
    } else {
      originalIndex += 1;
      normalizedIndex += 1;
    }
  }
  if (start < 0 || end < 0) {
    return { start: normalizedStart, end: normalizedEnd };
  }
  return { start, end };
}

function mapOriginalOffsetToNormalized(
  original: string,
  originalOffset: number,
  ending: '\n' | '\r\n',
): number {
  if (ending === '\n') {
    return originalOffset;
  }
  let originalIndex = 0;
  let normalizedIndex = 0;
  while (originalIndex < originalOffset && originalIndex < original.length) {
    if (original.startsWith('\r\n', originalIndex)) {
      originalIndex += 2;
      normalizedIndex += 1;
    } else {
      originalIndex += 1;
      normalizedIndex += 1;
    }
  }
  return normalizedIndex;
}

function isMarkdownFile(value: unknown): value is TFile {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (value instanceof ObsidianTFile) {
    return value.extension === 'md';
  }
  const candidate = value as { path?: unknown; extension?: unknown };
  return typeof candidate.path === 'string'
    && (candidate.extension === 'md' || candidate.path.endsWith('.md'));
}

function resolveMarkdownFile(app: App, notePath: string): TFile | null {
  const abstract = app.vault.getAbstractFileByPath(notePath);
  return isMarkdownFile(abstract) ? abstract : null;
}

/**
 * Digest of flushed answers for optional multi-leaf coordination.
 * Last writer wins; this only helps skip identical rewrites.
 */
export function computeAnswersDigest(
  notePath: string,
  sectionId: string,
  answers: SessionSection['answers'],
): string {
  return `${notePath}::${sectionId}::${JSON.stringify(answers)}`;
}
