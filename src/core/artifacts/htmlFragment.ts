import { DeanArtifactCodecError } from './DeanArtifactCodecError';

export interface HtmlFragmentElement {
  readonly kind: 'element';
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly HtmlFragmentNode[];
}

export interface HtmlFragmentText {
  readonly kind: 'text';
  readonly text: string;
}

export type HtmlFragmentNode = HtmlFragmentElement | HtmlFragmentText;

const VOID_TAGS = new Set(['br', 'hr']);

export function parseHtmlFragment(html: string): HtmlFragmentNode[] {
  const parser = new FragmentParser(html);
  return parser.parse();
}

class FragmentParser {
  private readonly source: string;
  private index = 0;

  constructor(source: string) {
    this.source = source;
  }

  parse(): HtmlFragmentNode[] {
    const root = this.readChildren(null);
    this.skipWhitespace();
    if (this.index < this.source.length) {
      throw new DeanArtifactCodecError('artifact HTML has trailing markup');
    }
    return root;
  }

  private readChildren(openTag: string | null): HtmlFragmentNode[] {
    const children: HtmlFragmentNode[] = [];
    while (this.index < this.source.length) {
      if (this.source.startsWith('<!--', this.index)) {
        this.skipComment();
        continue;
      }
      if (this.source.startsWith('</', this.index)) {
        const endTag = this.readEndTag();
        if (openTag === null) {
          throw new DeanArtifactCodecError(`artifact HTML has unexpected </${endTag}>`);
        }
        if (endTag !== openTag) {
          throw new DeanArtifactCodecError(
            `artifact HTML expected </${openTag}> but found </${endTag}>`,
          );
        }
        return children;
      }
      if (this.source[this.index] === '<') {
        children.push(this.readElement());
        continue;
      }
      const text = this.readText();
      if (text) {
        children.push({ kind: 'text', text });
      }
    }
    if (openTag !== null) {
      throw new DeanArtifactCodecError(`artifact HTML is missing </${openTag}>`);
    }
    return children;
  }

  private readElement(): HtmlFragmentElement {
    if (this.source[this.index] !== '<') {
      throw new DeanArtifactCodecError('artifact HTML is not well-formed');
    }
    this.index += 1;
    const tag = this.readTagName();
    const attrs = this.readAttributes();
    this.skipWhitespace();
    const selfClosing = this.source.startsWith('/>', this.index);
    if (selfClosing) {
      this.index += 2;
      return { kind: 'element', tag, attrs, children: [] };
    }
    if (this.source[this.index] !== '>') {
      throw new DeanArtifactCodecError(`artifact HTML tag <${tag}> is not well-formed`);
    }
    this.index += 1;
    if (VOID_TAGS.has(tag)) {
      return { kind: 'element', tag, attrs, children: [] };
    }
    const children = this.readChildren(tag);
    return { kind: 'element', tag, attrs, children };
  }

  private readEndTag(): string {
    if (!this.source.startsWith('</', this.index)) {
      throw new DeanArtifactCodecError('artifact HTML is not well-formed');
    }
    this.index += 2;
    const tag = this.readTagName();
    this.skipWhitespace();
    if (this.source[this.index] !== '>') {
      throw new DeanArtifactCodecError(`artifact HTML tag </${tag}> is not well-formed`);
    }
    this.index += 1;
    return tag;
  }

  private readTagName(): string {
    const start = this.index;
    while (this.index < this.source.length && /[A-Za-z0-9:-]/.test(this.source[this.index])) {
      this.index += 1;
    }
    if (this.index === start) {
      throw new DeanArtifactCodecError('artifact HTML contains an unnamed tag');
    }
    return this.source.slice(start, this.index).toLowerCase();
  }

  private readAttributes(): Record<string, string> {
    const attrs: Record<string, string> = {};
    while (this.index < this.source.length) {
      this.skipWhitespace();
      const ch = this.source[this.index];
      if (ch === '>' || this.source.startsWith('/>', this.index)) {
        break;
      }
      const name = this.readAttributeName();
      this.skipWhitespace();
      let value = '';
      if (this.source[this.index] === '=') {
        this.index += 1;
        this.skipWhitespace();
        value = this.readAttributeValue();
      }
      attrs[name] = decodeHtmlEntities(value);
    }
    return attrs;
  }

  private readAttributeName(): string {
    const start = this.index;
    while (this.index < this.source.length && /[A-Za-z0-9:_-]/.test(this.source[this.index])) {
      this.index += 1;
    }
    if (this.index === start) {
      throw new DeanArtifactCodecError('artifact HTML has an invalid attribute');
    }
    return this.source.slice(start, this.index).toLowerCase();
  }

  private readAttributeValue(): string {
    const quote = this.source[this.index];
    if (quote === '"' || quote === '\'') {
      this.index += 1;
      const start = this.index;
      const end = this.source.indexOf(quote, this.index);
      if (end === -1) {
        throw new DeanArtifactCodecError('artifact HTML has an unclosed attribute value');
      }
      this.index = end + 1;
      return this.source.slice(start, end);
    }
    const start = this.index;
    while (this.index < this.source.length && !/[\s>]/.test(this.source[this.index])) {
      if (this.source.startsWith('/>', this.index)) {
        break;
      }
      this.index += 1;
    }
    return this.source.slice(start, this.index);
  }

  private readText(): string {
    const start = this.index;
    const end = this.source.indexOf('<', this.index);
    this.index = end === -1 ? this.source.length : end;
    return decodeHtmlEntities(this.source.slice(start, this.index));
  }

  private skipComment(): void {
    const end = this.source.indexOf('-->', this.index + 4);
    if (end === -1) {
      throw new DeanArtifactCodecError('artifact HTML has an unclosed comment');
    }
    this.index = end + 3;
  }

  private skipWhitespace(): void {
    while (this.index < this.source.length && /\s/.test(this.source[this.index])) {
      this.index += 1;
    }
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, '\'')
    .replace(/&amp;/gi, '&');
}
