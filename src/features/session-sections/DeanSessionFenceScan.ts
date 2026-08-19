import { SESSION_SECTION_FENCE_LANGUAGE } from '../../core/session-sections';

export type DeanSessionFenceKind = 'full-fence';

export interface DeanSessionFenceSlice {
  readonly start: number;
  readonly end: number;
  readonly body: string;
  readonly kind: DeanSessionFenceKind;
}

export function detectLineEnding(content: string): '\n' | '\r\n' {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * Document-ordered ```dean-session fences in a markdown note.
 * Offsets refer to the original file text (including CRLF).
 */
export function listDeanSessionFences(fileContent: string): DeanSessionFenceSlice[] {
  const ending = detectLineEnding(fileContent);
  const normalized = fileContent.replace(/\r\n/g, '\n');
  const open = '```' + SESSION_SECTION_FENCE_LANGUAGE;
  const fences: DeanSessionFenceSlice[] = [];
  let searchFrom = 0;
  while (searchFrom < normalized.length) {
    const openAt = normalized.indexOf(open + '\n', searchFrom);
    if (openAt < 0) {
      break;
    }
    const endAt = findDeanSessionFenceEnd(normalized, openAt);
    if (endAt < 0) {
      break;
    }
    const range = mapNormalizedRangeToOriginal(fileContent, openAt, endAt, ending);
    fences.push({
      start: range.start,
      end: range.end,
      body: extractDeanSessionFenceBody(normalized.slice(openAt, endAt)),
      kind: 'full-fence',
    });
    searchFrom = endAt;
  }
  return fences;
}

export function extractDeanSessionFenceBody(fenceSlice: string): string {
  const normalized = fenceSlice.replace(/\r\n/g, '\n');
  const open = '```' + SESSION_SECTION_FENCE_LANGUAGE + '\n';
  if (!normalized.startsWith(open)) {
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

export function findDeanSessionFenceEnd(normalizedContent: string, openAt: number): number {
  const afterOpen = normalizedContent.indexOf('\n', openAt);
  if (afterOpen < 0) {
    return -1;
  }
  let searchFrom = afterOpen + 1;
  while (searchFrom <= normalizedContent.length) {
    const lineEnd = normalizedContent.indexOf('\n', searchFrom);
    const end = lineEnd < 0 ? normalizedContent.length : lineEnd;
    const line = normalizedContent.slice(searchFrom, end);
    if (/^```\s*$/.test(line)) {
      return end;
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

export function mapNormalizedRangeToOriginal(
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

export function mapOriginalOffsetToNormalized(
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
