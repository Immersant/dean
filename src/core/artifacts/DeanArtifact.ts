import type {
  SessionSectionPresentation,
  SessionSectionStyle,
} from '../session-sections/SessionSectionPresentation';

export const ARTIFACT_SCHEMA_VERSION = 1 as const;
export const ARTIFACT_FENCE_LANGUAGE = 'dean-artifact' as const;

export const ARTIFACT_LIMITS = {
  fenceBodyBytes: 64 * 1024,
  titleChars: 120,
  titleAttrChars: 200,
  artifactsPerNote: 16,
  nodes: 400,
  depth: 16,
  colspan: 8,
  rowspan: 32,
} as const;

export const ARTIFACT_LOCAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export const ARTIFACT_FORBIDDEN_YAML_KEYS = [
  'onClick',
  'shell',
  'command',
  'href',
  'innerHTML',
  'srcdoc',
  'iframe',
  'script',
  'html',
  'src',
] as const;

export const ARTIFACT_ALLOWED_TAGS = [
  'div',
  'span',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'strong',
  'em',
  'b',
  'i',
  'code',
  'pre',
  'blockquote',
  'hr',
  'br',
  'details',
  'summary',
  'progress',
] as const;

export type ArtifactTag = (typeof ARTIFACT_ALLOWED_TAGS)[number];

export const ARTIFACT_FORBIDDEN_TAGS = [
  'script',
  'style',
  'link',
  'meta',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'svg',
  'math',
  'img',
  'video',
  'audio',
  'source',
  'canvas',
  'template',
  'slot',
  'base',
  'html',
  'head',
  'body',
] as const;

export interface ArtifactElementNode {
  readonly type: 'element';
  readonly tag: ArtifactTag;
  readonly className?: string;
  readonly style?: SessionSectionStyle;
  readonly attrs?: Readonly<Record<string, string>>;
  readonly children: readonly ArtifactNode[];
}

export interface ArtifactTextNode {
  readonly type: 'text';
  readonly text: string;
}

export type ArtifactNode = ArtifactElementNode | ArtifactTextNode;

export interface DeanArtifact extends SessionSectionPresentation {
  readonly schemaVersion: typeof ARTIFACT_SCHEMA_VERSION;
  readonly id: string;
  readonly title: string;
  readonly createdAt: number;
  readonly nodes: readonly ArtifactNode[];
}

export const ARTIFACT_ALLOWED_TAG_SET: ReadonlySet<string> = new Set(ARTIFACT_ALLOWED_TAGS);
export const ARTIFACT_FORBIDDEN_TAG_SET: ReadonlySet<string> = new Set(ARTIFACT_FORBIDDEN_TAGS);
