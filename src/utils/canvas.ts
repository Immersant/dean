import { escapePromptXmlAttribute, formatPromptXmlCdata } from './promptXml';

export const CANVAS_SELECTION_TEXT_MAX_CHARS = 200;
const CANVAS_SELECTION_CHIP_LABEL_MAX_CHARS = 48;

export interface CanvasSelectionNodeSummary {
  id: string;
  type?: string;
  file?: string;
  subpath?: string;
  text?: string;
  label?: string;
  url?: string;
  color?: string;
}

export interface CanvasSelectionContext {
  canvasPath: string;
  nodeIds: string[];
  nodes?: CanvasSelectionNodeSummary[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readFilePath(value: unknown): string | undefined {
  const asString = readNonEmptyString(value);
  if (asString) return asString;
  if (!isRecord(value)) return undefined;
  return readNonEmptyString(value.path);
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…`;
}

function readOptionalSummaryFields(
  source: Record<string, unknown>,
): Omit<CanvasSelectionNodeSummary, 'id'> {
  const summary: Omit<CanvasSelectionNodeSummary, 'id'> = {};
  const type = readNonEmptyString(source.type);
  if (type) summary.type = type;
  const file = readFilePath(source.file);
  if (file) summary.file = file;
  const subpath = readNonEmptyString(source.subpath);
  if (subpath) summary.subpath = subpath;
  const text = readNonEmptyString(source.text);
  if (text) summary.text = truncateText(text, CANVAS_SELECTION_TEXT_MAX_CHARS);
  const label = readNonEmptyString(source.label);
  if (label) summary.label = label;
  const url = readNonEmptyString(source.url);
  if (url) summary.url = url;
  const color = readNonEmptyString(source.color);
  if (color) summary.color = color;
  return summary;
}

export function summarizeCanvasSelectionNode(node: unknown): CanvasSelectionNodeSummary | null {
  if (!isRecord(node)) return null;

  let data: Record<string, unknown> | null = null;
  if (typeof node.getData === 'function') {
    try {
      const rawData = (node.getData as () => unknown)();
      if (isRecord(rawData)) {
        data = rawData;
      }
    } catch {
      data = null;
    }
  }

  const id = readNonEmptyString(data?.id) ?? readNonEmptyString(node.id);
  if (!id) return null;

  const fromData = data ? readOptionalSummaryFields(data) : {};
  const fromNode = readOptionalSummaryFields(node);

  // Prefer getData() fields; fill gaps from the live node object.
  return {
    id,
    ...fromNode,
    ...fromData,
  };
}

function formatCanvasNodeAttributes(node: CanvasSelectionNodeSummary): string {
  const attrs = [`id="${escapePromptXmlAttribute(node.id)}"`];
  if (node.type) attrs.push(`type="${escapePromptXmlAttribute(node.type)}"`);
  if (node.file) attrs.push(`file="${escapePromptXmlAttribute(node.file)}"`);
  if (node.subpath) attrs.push(`subpath="${escapePromptXmlAttribute(node.subpath)}"`);
  if (node.label) attrs.push(`label="${escapePromptXmlAttribute(node.label)}"`);
  if (node.url) attrs.push(`url="${escapePromptXmlAttribute(node.url)}"`);
  if (node.color) attrs.push(`color="${escapePromptXmlAttribute(node.color)}"`);
  return attrs.join(' ');
}

function formatCanvasNode(node: CanvasSelectionNodeSummary): string {
  const attrs = formatCanvasNodeAttributes(node);
  if (node.type === 'text' && node.text) {
    return `<canvas_node ${attrs}>\n${formatPromptXmlCdata(node.text)}\n</canvas_node>`;
  }
  return `<canvas_node ${attrs} />`;
}

export function formatCanvasContext(context: CanvasSelectionContext): string {
  if (context.nodeIds.length === 0) return '';

  const body = context.nodes && context.nodes.length > 0
    ? context.nodes.map(formatCanvasNode).join('\n')
    : formatPromptXmlCdata(context.nodeIds.join(', '));

  return `<canvas_selection path="${escapePromptXmlAttribute(context.canvasPath)}">\n${body}\n</canvas_selection>`;
}

export function appendCanvasContext(prompt: string, context: CanvasSelectionContext): string {
  const formatted = formatCanvasContext(context);
  return formatted ? `${prompt}\n\n${formatted}` : prompt;
}

function nodePrimaryLabel(node: CanvasSelectionNodeSummary): string | undefined {
  if (node.file) return node.file;
  if (node.label) return node.label;
  if (node.text) {
    const firstLine = node.text.split(/\r?\n/, 1)[0] ?? node.text;
    return truncateText(firstLine, CANVAS_SELECTION_CHIP_LABEL_MAX_CHARS);
  }
  if (node.url) return truncateText(node.url, CANVAS_SELECTION_CHIP_LABEL_MAX_CHARS);
  return undefined;
}

export function formatCanvasSelectionChipLabel(context: CanvasSelectionContext): string {
  const nodes = context.nodes ?? [];
  if (nodes.length === 1) {
    return nodePrimaryLabel(nodes[0]) ?? '1 node selected';
  }

  if (nodes.length > 1) {
    const primary = nodePrimaryLabel(nodes[0]);
    if (primary) {
      return `${primary} + ${nodes.length - 1} nodes`;
    }
  }

  const count = context.nodeIds.length;
  return count === 1 ? '1 node selected' : `${count} nodes selected`;
}

export function canvasSelectionsEqual(
  left: CanvasSelectionContext | null | undefined,
  right: CanvasSelectionContext | null | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.canvasPath !== right.canvasPath) return false;
  if (left.nodeIds.length !== right.nodeIds.length) return false;
  if (left.nodeIds.some((id, index) => id !== right.nodeIds[index])) return false;

  const leftNodes = left.nodes ?? [];
  const rightNodes = right.nodes ?? [];
  if (leftNodes.length !== rightNodes.length) return false;

  return leftNodes.every((node, index) => {
    const other = rightNodes[index];
    return node.id === other.id
      && node.type === other.type
      && node.file === other.file
      && node.subpath === other.subpath
      && node.text === other.text
      && node.label === other.label
      && node.url === other.url
      && node.color === other.color;
  });
}
