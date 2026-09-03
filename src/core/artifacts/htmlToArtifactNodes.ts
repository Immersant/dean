import {
  parseSessionSectionCssClass,
  parseSessionSectionStyle,
} from '../session-sections/SessionSectionPresentation';
import { SessionSectionValidationError } from '../session-sections/SessionSectionValidationError';
import {
  ARTIFACT_ALLOWED_TAG_SET,
  ARTIFACT_FORBIDDEN_TAG_SET,
  ARTIFACT_LIMITS,
  type ArtifactElementNode,
  type ArtifactNode,
  type ArtifactTag,
} from './DeanArtifact';
import { DeanArtifactCodecError } from './DeanArtifactCodecError';
import {
  type HtmlFragmentElement,
  type HtmlFragmentNode,
  parseHtmlFragment,
} from './htmlFragment';

const FORBIDDEN_ATTR = /^on/i;
const FORBIDDEN_ATTR_NAMES = new Set([
  'href',
  'src',
  'srcset',
  'srcdoc',
  'action',
  'formaction',
  'xlink:href',
  'poster',
  'id',
  'contenteditable',
  'tabindex',
  'role',
  'name',
  'for',
  'form',
  'xmlns',
]);

const PRESERVE_WHITESPACE_TAGS = new Set(['pre', 'code']);

export function htmlToArtifactNodes(html: string): ArtifactNode[] {
  const fragment = parseHtmlFragment(html);
  const counter = { nodes: 0 };
  const nodes = convertList(fragment, 0, false, counter);
  if (!nodes.some((node) => node.type === 'element')) {
    throw new DeanArtifactCodecError('artifact HTML must contain at least one element');
  }
  return nodes;
}

function convertList(
  nodes: readonly HtmlFragmentNode[],
  depth: number,
  preserveWhitespace: boolean,
  counter: { nodes: number },
): ArtifactNode[] {
  const converted: ArtifactNode[] = [];
  for (const node of nodes) {
    const next = convertNode(node, depth, preserveWhitespace, counter);
    if (next) {
      converted.push(next);
    }
  }
  return converted;
}

function convertNode(
  node: HtmlFragmentNode,
  depth: number,
  preserveWhitespace: boolean,
  counter: { nodes: number },
): ArtifactNode | null {
  if (node.kind === 'text') {
    if (!preserveWhitespace && !node.text.trim()) {
      return null;
    }
    if (!node.text) {
      return null;
    }
    bump(counter);
    return { type: 'text', text: node.text };
  }
  return convertElement(node, depth, preserveWhitespace, counter);
}

function convertElement(
  element: HtmlFragmentElement,
  depth: number,
  preserveWhitespace: boolean,
  counter: { nodes: number },
): ArtifactElementNode {
  if (depth >= ARTIFACT_LIMITS.depth) {
    throw new DeanArtifactCodecError(`artifact HTML exceeds depth ${ARTIFACT_LIMITS.depth}`);
  }
  const tag = element.tag;
  if (ARTIFACT_FORBIDDEN_TAG_SET.has(tag)) {
    throw new DeanArtifactCodecError(`artifact HTML must not include <${tag}>`);
  }
  if (!ARTIFACT_ALLOWED_TAG_SET.has(tag)) {
    throw new DeanArtifactCodecError(`artifact HTML contains unsupported tag <${tag}>`);
  }
  bump(counter);
  const nextPreserve = preserveWhitespace || PRESERVE_WHITESPACE_TAGS.has(tag);
  const children = convertList(element.children, depth + 1, nextPreserve, counter);
  const parsed = parseAttributes(element.attrs, tag as ArtifactTag);
  return {
    type: 'element',
    tag: tag as ArtifactTag,
    children,
    ...parsed,
  };
}

function parseAttributes(
  raw: Readonly<Record<string, string>>,
  tag: ArtifactTag,
): Pick<ArtifactElementNode, 'className' | 'style' | 'attrs'> {
  const attrs: Record<string, string> = {};
  let className: string | undefined;
  let style: ArtifactElementNode['style'];

  for (const [rawName, value] of Object.entries(raw)) {
    const name = rawName.toLowerCase();
    if (FORBIDDEN_ATTR.test(name) || FORBIDDEN_ATTR_NAMES.has(name) || name.startsWith('data-')) {
      throw new DeanArtifactCodecError(`artifact HTML must not include attribute "${name}"`);
    }
    if (name === 'class') {
      try {
        className = parseSessionSectionCssClass(value, 'class');
      } catch (error) {
        throw wrapPresentation(error);
      }
      continue;
    }
    if (name === 'style') {
      style = parseInlineStyle(value);
      continue;
    }
    if (name === 'title') {
      if (value.length > ARTIFACT_LIMITS.titleAttrChars) {
        throw new DeanArtifactCodecError(
          `title exceeds ${ARTIFACT_LIMITS.titleAttrChars} characters`,
        );
      }
      attrs.title = value;
      continue;
    }
    if ((name === 'colspan' || name === 'rowspan') && (tag === 'td' || tag === 'th')) {
      attrs[name] = parseSpan(name, value, name === 'colspan'
        ? ARTIFACT_LIMITS.colspan
        : ARTIFACT_LIMITS.rowspan);
      continue;
    }
    if (tag === 'progress' && (name === 'value' || name === 'max')) {
      attrs[name] = parseNumberAttr(name, value);
      continue;
    }
    if (tag === 'details' && name === 'open') {
      attrs.open = 'open';
      continue;
    }
    throw new DeanArtifactCodecError(`artifact HTML must not include attribute "${name}"`);
  }

  return {
    ...(className ? { className } : {}),
    ...(style ? { style } : {}),
    ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
  };
}

function parseInlineStyle(value: string): ArtifactElementNode['style'] {
  const record: Record<string, unknown> = {};
  for (const declaration of value.split(';')) {
    const trimmed = declaration.trim();
    if (!trimmed) {
      continue;
    }
    const colon = trimmed.indexOf(':');
    if (colon <= 0) {
      throw new DeanArtifactCodecError('artifact style declarations must be property: value');
    }
    const property = trimmed.slice(0, colon).trim();
    const propertyValue = trimmed.slice(colon + 1).trim();
    record[property] = propertyValue;
  }
  try {
    return parseSessionSectionStyle(record, 'style');
  } catch (error) {
    throw wrapPresentation(error);
  }
}

function parseSpan(name: string, value: string, max: number): string {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new DeanArtifactCodecError(`${name} must be an integer from 1 to ${max}`);
  }
  return String(parsed);
}

function parseNumberAttr(name: string, value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new DeanArtifactCodecError(`${name} must be a non-negative number`);
  }
  return String(parsed);
}

function bump(counter: { nodes: number }): void {
  counter.nodes += 1;
  if (counter.nodes > ARTIFACT_LIMITS.nodes) {
    throw new DeanArtifactCodecError(`artifact HTML exceeds ${ARTIFACT_LIMITS.nodes} nodes`);
  }
}

function wrapPresentation(error: unknown): DeanArtifactCodecError {
  if (error instanceof SessionSectionValidationError) {
    return new DeanArtifactCodecError(error.message, { cause: error });
  }
  if (error instanceof DeanArtifactCodecError) {
    return error;
  }
  return new DeanArtifactCodecError('artifact presentation is invalid', { cause: error });
}
