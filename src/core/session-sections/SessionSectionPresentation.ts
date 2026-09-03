import { SESSION_SECTION_LIMITS } from './SessionSection';
import { SessionSectionValidationError } from './SessionSectionValidationError';

export type SessionSectionStyle = Readonly<Record<string, string>>;

export interface SessionSectionPresentation {
  readonly cssClass?: string;
  readonly style?: SessionSectionStyle;
}

const CSS_CLASS_TOKEN = /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/;
const CSS_PROPERTY = /^-{0,2}[a-z][a-z0-9-]*$/;
const UNSAFE_STYLE_VALUE = /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding|<\/|data\s*:/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseSessionSectionCssClass(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new SessionSectionValidationError(`${field} must be a string`);
  }
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return undefined;
  }
  if (tokens.length > SESSION_SECTION_LIMITS.cssClassTokens) {
    throw new SessionSectionValidationError(
      `${field} exceeds ${SESSION_SECTION_LIMITS.cssClassTokens} class tokens`,
    );
  }
  for (const token of tokens) {
    if (token.length > SESSION_SECTION_LIMITS.cssClassTokenChars) {
      throw new SessionSectionValidationError(
        `${field} token exceeds ${SESSION_SECTION_LIMITS.cssClassTokenChars} characters`,
      );
    }
    if (!CSS_CLASS_TOKEN.test(token)) {
      throw new SessionSectionValidationError(`${field} contains an invalid CSS class token`);
    }
    if (token.toLowerCase().startsWith('dean-')) {
      throw new SessionSectionValidationError(`${field} must not use reserved dean- class tokens`);
    }
  }
  return tokens.join(' ');
}

export function parseSessionSectionStyle(
  value: unknown,
  field: string,
): SessionSectionStyle | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new SessionSectionValidationError(`${field} must be a mapping of CSS properties`);
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return undefined;
  }
  if (keys.length > SESSION_SECTION_LIMITS.styleDecls) {
    throw new SessionSectionValidationError(
      `${field} exceeds ${SESSION_SECTION_LIMITS.styleDecls} declarations`,
    );
  }
  const style: Record<string, string> = {};
  for (const key of keys) {
    if (!CSS_PROPERTY.test(key)) {
      throw new SessionSectionValidationError(`${field} has an invalid CSS property "${key}"`);
    }
    const raw = value[key];
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new SessionSectionValidationError(`${field}.${key} must be a non-empty string`);
    }
    if (raw.length > SESSION_SECTION_LIMITS.styleValueChars) {
      throw new SessionSectionValidationError(
        `${field}.${key} exceeds ${SESSION_SECTION_LIMITS.styleValueChars} characters`,
      );
    }
    if (UNSAFE_STYLE_VALUE.test(raw)) {
      throw new SessionSectionValidationError(`${field}.${key} contains an unsafe CSS value`);
    }
    style[key] = raw.trim();
  }
  return style;
}

export function parseSessionSectionPresentation(
  raw: Record<string, unknown>,
  path: string,
): SessionSectionPresentation {
  const cssClass = parseSessionSectionCssClass(raw.cssClass, `${path}.cssClass`);
  const style = parseSessionSectionStyle(raw.style, `${path}.style`);
  return {
    ...(cssClass ? { cssClass } : {}),
    ...(style ? { style } : {}),
  };
}

export function serializeSessionSectionPresentation(
  target: Record<string, unknown>,
  source: SessionSectionPresentation,
): void {
  if (source.cssClass) {
    target.cssClass = source.cssClass;
  }
  if (source.style) {
    target.style = { ...source.style };
  }
}
