// Mock for Obsidian API

export class Plugin {
  app: any;
  manifest: any;

  constructor(app?: any, manifest?: any) {
    this.app = app;
    this.manifest = manifest;
  }

  addRibbonIcon = jest.fn();
  addCommand = jest.fn();
  addSettingTab = jest.fn();
  registerView = jest.fn();
  registerEvent = jest.fn();
  registerMarkdownCodeBlockProcessor = jest.fn();
  loadData = jest.fn().mockResolvedValue({});
  saveData = jest.fn().mockResolvedValue(undefined);
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any = {
    empty: jest.fn(),
    createEl: jest.fn().mockReturnValue({ createEl: jest.fn(), createDiv: jest.fn() }),
    createDiv: jest.fn().mockReturnValue({ createEl: jest.fn(), createDiv: jest.fn() }),
  };

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }

  display() {}
}

export class ItemView {
  app: any;
  leaf: any;
  containerEl: any = {
    children: [{}, { empty: jest.fn(), addClass: jest.fn(), createDiv: jest.fn().mockReturnValue({
      createEl: jest.fn().mockReturnValue({ addEventListener: jest.fn(), setAttribute: jest.fn() }),
      createDiv: jest.fn().mockReturnValue({ createEl: jest.fn().mockReturnValue({ addEventListener: jest.fn() }) }),
    }) }],
  };

  constructor(leaf: any) {
    this.leaf = leaf;
  }

  getViewType(): string {
    return '';
  }

  getDisplayText(): string {
    return '';
  }

  getIcon(): string {
    return '';
  }
}

export class WorkspaceLeaf {}

export class Scope {
  static instances: Scope[] = [];

  parent?: Scope;
  handlers: Array<{
    modifiers: string[] | null;
    key: string | null;
    func: (evt: KeyboardEvent, ctx?: unknown) => false | unknown;
  }> = [];

  constructor(parent?: Scope) {
    this.parent = parent;
    Scope.instances.push(this);
  }

  register = jest.fn((
    modifiers: string[] | null,
    key: string | null,
    func: (evt: KeyboardEvent, ctx?: unknown) => false | unknown
  ) => {
    const handler = { modifiers, key, func };
    this.handlers.push(handler);
    return handler;
  });

  unregister = jest.fn((handler: unknown) => {
    this.handlers = this.handlers.filter((entry) => entry !== handler);
  });
}

export const Platform = {
  isMacOS: true,
};

export class Keymap {
  static isModEvent(evt?: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; button?: number } | null): boolean | 'tab' | 'split' | 'window' {
    if (!evt) {
      return false;
    }
    if (evt.button === 1) {
      return 'tab';
    }
    const mod = Boolean(evt.metaKey || evt.ctrlKey);
    if (!mod) {
      return false;
    }
    if (evt.altKey && evt.shiftKey) {
      return 'window';
    }
    if (evt.altKey) {
      return 'split';
    }
    return 'tab';
  }
}

export class App {
  vault: any = {
    adapter: {
      basePath: '/mock/vault/path',
    },
  };
  workspace: any = {
    getLeavesOfType: jest.fn().mockReturnValue([]),
    getRightLeaf: jest.fn().mockReturnValue({
      setViewState: jest.fn().mockResolvedValue(undefined),
    }),
    getLeftLeaf: jest.fn().mockReturnValue({
      setViewState: jest.fn().mockResolvedValue(undefined),
    }),
    getLeaf: jest.fn().mockReturnValue({
      setViewState: jest.fn().mockResolvedValue(undefined),
    }),
    setActiveLeaf: jest.fn(),
    revealLeaf: jest.fn(),
  };
}

export class MarkdownView {
  editor: any;
  file?: any;

  constructor(editor?: any, file?: any) {
    this.editor = editor;
    this.file = file;
  }
}

export class Setting {
  constructor(containerEl: any) {}
  setName = jest.fn().mockReturnThis();
  setDesc = jest.fn().mockReturnThis();
  addToggle = jest.fn().mockReturnThis();
  addTextArea = jest.fn().mockReturnThis();
}

export class TextAreaComponent {
  inputEl: any;
  private _value = '';

  constructor(_container?: any) {
    this.inputEl = {
      addClass: jest.fn(),
      rows: 0,
      placeholder: '',
      focus: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
  }

  setValue(value: string): this {
    this._value = value;
    return this;
  }

  getValue(): string {
    return this._value;
  }
}

export class Modal {
  app: any;
  containerEl: any = {
    createDiv: jest.fn().mockReturnValue({
      createEl: jest.fn().mockReturnValue({ addEventListener: jest.fn() }),
      createDiv: jest.fn().mockReturnValue({
        createEl: jest.fn().mockReturnValue({ addEventListener: jest.fn() }),
        createDiv: jest.fn().mockReturnValue({
          createEl: jest.fn(),
        }),
        setText: jest.fn(),
      }),
      addClass: jest.fn(),
      setText: jest.fn(),
    }),
    empty: jest.fn(),
    addClass: jest.fn(),
  };
  contentEl: any = {
    createDiv: jest.fn().mockReturnValue({
      createEl: jest.fn().mockReturnValue({ addEventListener: jest.fn() }),
      createDiv: jest.fn().mockReturnValue({
        createEl: jest.fn().mockReturnValue({ addEventListener: jest.fn() }),
        createDiv: jest.fn().mockReturnValue({
          createEl: jest.fn(),
        }),
        setText: jest.fn(),
      }),
      addClass: jest.fn(),
      setText: jest.fn(),
    }),
    empty: jest.fn(),
    addClass: jest.fn(),
  };

  constructor(app: any) {
    this.app = app;
  }

  open = jest.fn();
  close = jest.fn();
  onOpen = jest.fn();
  onClose = jest.fn();
}

export class Component {
  private children: Component[] = [];

  addChild<T extends Component>(component: T): T {
    this.children.push(component);
    component.load();
    return component;
  }

  removeChild<T extends Component>(component: T): T {
    const index = this.children.indexOf(component);
    if (index >= 0) {
      this.children.splice(index, 1);
      component.unload();
    }
    return component;
  }

  load(): void {}
  unload(): void {
    for (const child of this.children.splice(0)) {
      child.unload();
    }
  }

  onload(): void {}
  onunload(): void {}
}

/** Minimal MarkdownRenderChild for processor lifecycle (Collect flush on destroy). */
export class MarkdownRenderChild extends Component {
  containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    super();
    this.containerEl = containerEl;
  }

  load(): void {
    this.onload();
  }

  unload(): void {
    this.onunload();
    super.unload();
  }
}

class MockMenuItem {
  title = '';
  icon = '';
  disabled = false;
  checked: boolean | null = null;
  isLabel = false;
  clickHandler: (() => void) | null = null;

  setTitle = jest.fn((title: string) => {
    this.title = title;
    return this;
  });

  setIcon = jest.fn((icon: string) => {
    this.icon = icon;
    return this;
  });

  setDisabled = jest.fn((disabled: boolean) => {
    this.disabled = disabled;
    return this;
  });

  setChecked = jest.fn((checked: boolean | null) => {
    this.checked = checked;
    return this;
  });

  setIsLabel = jest.fn((isLabel: boolean) => {
    this.isLabel = isLabel;
    return this;
  });

  setWarning = jest.fn((_isWarning: boolean) => this);

  onClick = jest.fn((handler: () => void) => {
    this.clickHandler = handler;
    return this;
  });
}

export class Menu {
  static instances: Menu[] = [];

  items: MockMenuItem[] = [];
  useNativeMenu: boolean | null = null;
  showAtMouseEvent = jest.fn();
  showAtPosition = jest.fn();

  constructor() {
    Menu.instances.push(this);
  }

  addItem(callback: (item: MockMenuItem) => MockMenuItem | void): this {
    const item = new MockMenuItem();
    callback(item);
    this.items.push(item);
    return this;
  }

  addSeparator(): this {
    return this;
  }

  setUseNativeMenu = jest.fn((useNativeMenu: boolean) => {
    this.useNativeMenu = useNativeMenu;
    return this;
  });
}

const renderMarkdownMock = jest.fn<Promise<void>, [string, unknown, string, unknown]>().mockResolvedValue(undefined);

export const MarkdownRenderer = {
  render: jest.fn<Promise<void>, [unknown, string, unknown, string, unknown]>(
    (_app, markdown, el, sourcePath, component) => renderMarkdownMock(markdown, el, sourcePath, component),
  ),
  renderMarkdown: renderMarkdownMock,
};

export const loadPrism = jest.fn().mockResolvedValue({
  highlightElement: jest.fn(),
});

export const setIcon = jest.fn();

// Notice mock that tracks constructor calls
export const Notice = jest.fn().mockImplementation((_message: string, _timeout?: number) => {});

function unquoteYaml(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseYamlValue(rawValue: string): unknown {
  if (!rawValue) return null;

  if (rawValue.startsWith('{') && rawValue.endsWith('}')) {
    try { return JSON.parse(rawValue); } catch { /* fall through */ }
  }

  if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    return rawValue.slice(1, -1).split(',').map(item => unquoteYaml(item.trim())).filter(Boolean);
  }

  if (rawValue === 'true' || rawValue === 'false') {
    return rawValue === 'true';
  }

  const numberValue = Number(rawValue);
  if (!Number.isNaN(numberValue) && rawValue !== '') {
    return numberValue;
  }

  return unquoteYaml(rawValue);
}

export function parseYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split(/\r?\n/);
  let currentArrayKey: string | null = null;
  let currentArray: unknown[] = [];
  let blockScalarKey: string | null = null;
  let blockScalarStyle: 'literal' | 'folded' | null = null;
  let blockScalarLines: string[] = [];
  let blockScalarIndent: number | null = null;

  const flushArray = () => {
    if (currentArrayKey) {
      result[currentArrayKey] = currentArray;
      currentArrayKey = null;
      currentArray = [];
    }
  };

  const flushBlockScalar = () => {
    if (!blockScalarKey) return;
    let value: string;
    if (blockScalarStyle === 'literal') {
      value = blockScalarLines.join('\n');
    } else {
      value = blockScalarLines.join('\n').replace(/(?<!\n)\n(?!\n)/g, ' ').trim();
    }
    result[blockScalarKey] = value;
    blockScalarKey = null;
    blockScalarStyle = null;
    blockScalarLines = [];
    blockScalarIndent = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle block scalar content
    if (blockScalarKey) {
      if (trimmed === '') {
        blockScalarLines.push('');
        continue;
      }
      const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (blockScalarIndent === null) {
        if (leadingSpaces === 0) {
          flushBlockScalar();
          // fall through to process this line
        } else {
          blockScalarIndent = leadingSpaces;
          blockScalarLines.push(line.slice(blockScalarIndent));
          continue;
        }
      } else if (leadingSpaces >= blockScalarIndent) {
        blockScalarLines.push(line.slice(blockScalarIndent));
        continue;
      } else {
        flushBlockScalar();
        // fall through
      }
    }

    // Handle YAML list items (- value) including flow-style objects and nested maps
    if (currentArrayKey && trimmed.startsWith('- ')) {
      const itemBody = trimmed.slice(2).trim();
      const firstFieldMatch = itemBody.match(/^([^:{}[\]]+):\s*(.*)$/);
      // Block-style nested mapping: `- id: review` or bare `-` followed by indented keys
      if (!itemBody || firstFieldMatch) {
        const nested: Record<string, unknown> = {};
        let j = i + 1;
        if (firstFieldMatch) {
          const firstKey = firstFieldMatch[1].trim();
          const firstRaw = firstFieldMatch[2].trim();
          if (firstRaw.match(/^([|>])([+-])?$/)) {
            const style = firstRaw.startsWith('|') ? 'literal' : 'folded';
            const scalarLines: string[] = [];
            let scalarIndent: number | null = null;
            while (j < lines.length) {
              const scalarLine = lines[j];
              const scalarTrimmed = scalarLine.trim();
              if (!scalarTrimmed) {
                scalarLines.push('');
                j += 1;
                continue;
              }
              const scalarLeading = scalarLine.match(/^(\s*)/)?.[1].length ?? 0;
              if (scalarIndent === null) {
                if (scalarLeading === 0) break;
                scalarIndent = scalarLeading;
              }
              if (scalarLeading < scalarIndent) break;
              scalarLines.push(scalarLine.slice(scalarIndent));
              j += 1;
            }
            nested[firstKey] = style === 'literal'
              ? scalarLines.join('\n')
              : scalarLines.join('\n').replace(/(?<!\n)\n(?!\n)/g, ' ').trim();
          } else {
            nested[firstKey] = firstRaw ? parseYamlValue(firstRaw) : '';
          }
        }
        while (j < lines.length) {
          const nestedLine = lines[j];
          const nestedTrimmed = nestedLine.trim();
          if (!nestedTrimmed) {
            j += 1;
            continue;
          }
          const nestedIndent = nestedLine.match(/^(\s*)/)?.[1].length ?? 0;
          if (nestedIndent === 0 || nestedTrimmed.startsWith('- ')) {
            break;
          }
          const nestedMatch = nestedTrimmed.match(/^([^:]+):\s*(.*)$/);
          if (!nestedMatch) {
            break;
          }
          const nestedKey = nestedMatch[1].trim();
          const nestedRaw = nestedMatch[2].trim();
          if (nestedRaw.match(/^([|>])([+-])?$/)) {
            const style = nestedRaw.startsWith('|') ? 'literal' : 'folded';
            const scalarLines: string[] = [];
            let scalarIndent: number | null = null;
            j += 1;
            while (j < lines.length) {
              const scalarLine = lines[j];
              const scalarTrimmed = scalarLine.trim();
              if (!scalarTrimmed) {
                scalarLines.push('');
                j += 1;
                continue;
              }
              const scalarLeading = scalarLine.match(/^(\s*)/)?.[1].length ?? 0;
              if (scalarIndent === null) {
                if (scalarLeading === 0) break;
                scalarIndent = scalarLeading;
              }
              if (scalarLeading < scalarIndent) break;
              scalarLines.push(scalarLine.slice(scalarIndent));
              j += 1;
            }
            nested[nestedKey] = style === 'literal'
              ? scalarLines.join('\n')
              : scalarLines.join('\n').replace(/(?<!\n)\n(?!\n)/g, ' ').trim();
            continue;
          }
          if (!nestedRaw) {
            let look = j + 1;
            while (look < lines.length && !lines[look].trim()) {
              look += 1;
            }
            const lookTrimmed = look < lines.length ? lines[look].trim() : '';
            if (lookTrimmed && !lookTrimmed.startsWith('- ')) {
              const nestedObject: Record<string, unknown> = {};
              j += 1;
              while (j < lines.length) {
                const mapLine = lines[j];
                const mapTrimmed = mapLine.trim();
                if (!mapTrimmed) {
                  j += 1;
                  continue;
                }
                const mapIndent = mapLine.match(/^(\s*)/)?.[1].length ?? 0;
                if (mapIndent <= nestedIndent || mapTrimmed.startsWith('- ')) {
                  break;
                }
                const mapMatch = mapTrimmed.match(/^([^:]+):\s*(.*)$/);
                if (!mapMatch) {
                  break;
                }
                nestedObject[mapMatch[1].trim()] = mapMatch[2].trim()
                  ? parseYamlValue(mapMatch[2].trim())
                  : '';
                j += 1;
              }
              nested[nestedKey] = nestedObject;
              continue;
            }
            // Nested array (e.g. options:) under a list item
            const nestedArray: unknown[] = [];
            j += 1;
            while (j < lines.length) {
              const optionLine = lines[j];
              const optionTrimmed = optionLine.trim();
              if (!optionTrimmed) {
                j += 1;
                continue;
              }
              const optionIndent = optionLine.match(/^(\s*)/)?.[1].length ?? 0;
              if (optionIndent <= nestedIndent || !optionTrimmed.startsWith('- ')) {
                break;
              }
              const optionBody = optionTrimmed.slice(2).trim();
              const optionField = optionBody.match(/^([^:{}[\]]+):\s*(.*)$/);
              if (optionField) {
                const optionObj: Record<string, unknown> = {
                  [optionField[1].trim()]: optionField[2].trim()
                    ? parseYamlValue(optionField[2].trim())
                    : '',
                };
                j += 1;
                while (j < lines.length) {
                  const restLine = lines[j];
                  const restTrimmed = restLine.trim();
                  if (!restTrimmed) {
                    j += 1;
                    continue;
                  }
                  const restIndent = restLine.match(/^(\s*)/)?.[1].length ?? 0;
                  if (restIndent === 0 || restTrimmed.startsWith('- ')) {
                    break;
                  }
                  const restMatch = restTrimmed.match(/^([^:]+):\s*(.*)$/);
                  if (!restMatch) break;
                  optionObj[restMatch[1].trim()] = restMatch[2].trim()
                    ? parseYamlValue(restMatch[2].trim())
                    : '';
                  j += 1;
                }
                nestedArray.push(optionObj);
                continue;
              }
              nestedArray.push(parseYamlValue(optionBody));
              j += 1;
            }
            nested[nestedKey] = nestedArray;
            continue;
          }
          nested[nestedKey] = parseYamlValue(nestedRaw);
          j += 1;
        }
        currentArray.push(nested);
        i = j - 1;
        continue;
      }
      currentArray.push(parseYamlValue(itemBody));
      continue;
    }

    // Nested key under a block-style list item already consumed above.
    // Not a list item — flush any pending array
    if (currentArrayKey && trimmed !== '') {
      flushArray();
    }

    if (!trimmed) continue;

    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1].trim();
    const rawValue = match[2].trim();
    if (!key) continue;

    // Check for block scalar indicator (| or >) with optional chomping
    const blockMatch = rawValue.match(/^([|>])([+-])?$/);
    if (blockMatch) {
      blockScalarKey = key;
      blockScalarStyle = blockMatch[1] === '|' ? 'literal' : 'folded';
      blockScalarLines = [];
      blockScalarIndent = null;
      continue;
    }

    if (!rawValue) {
      // Peek ahead: list vs nested mapping vs null
      let peek = i + 1;
      while (peek < lines.length && !lines[peek].trim()) {
        peek += 1;
      }
      if (peek < lines.length) {
        const peekTrimmed = lines[peek].trim();
        const peekIndent = lines[peek].match(/^(\s*)/)?.[1].length ?? 0;
        if (peekTrimmed.startsWith('- ')) {
          currentArrayKey = key;
          currentArray = [];
          continue;
        }
        if (peekIndent > 0) {
          const nested: Record<string, unknown> = {};
          let j = peek;
          const baseIndent = peekIndent;
          while (j < lines.length) {
            const nestedLine = lines[j];
            const nestedTrimmed = nestedLine.trim();
            if (!nestedTrimmed) {
              j += 1;
              continue;
            }
            const nestedIndent = nestedLine.match(/^(\s*)/)?.[1].length ?? 0;
            if (nestedIndent < baseIndent) {
              break;
            }
            // Nested sequence under a mapping key (e.g. answers.features: then - a).
            if (nestedTrimmed.startsWith('- ') && nestedIndent > baseIndent) {
              j += 1;
              continue;
            }
            const nestedMatch = nestedTrimmed.match(/^([^:]+):\s*(.*)$/);
            if (!nestedMatch) {
              break;
            }
            const nestedKey = nestedMatch[1].trim();
            const nestedRaw = nestedMatch[2].trim();
            if (!nestedRaw) {
              // Peek for a nested list under this key.
              let listPeek = j + 1;
              while (listPeek < lines.length && !lines[listPeek].trim()) {
                listPeek += 1;
              }
              if (
                listPeek < lines.length
                && lines[listPeek].trim().startsWith('- ')
                && (lines[listPeek].match(/^(\s*)/)?.[1].length ?? 0) > nestedIndent
              ) {
                const nestedArray: unknown[] = [];
                j = listPeek;
                while (j < lines.length) {
                  const optionLine = lines[j];
                  const optionTrimmed = optionLine.trim();
                  if (!optionTrimmed) {
                    j += 1;
                    continue;
                  }
                  const optionIndent = optionLine.match(/^(\s*)/)?.[1].length ?? 0;
                  if (optionIndent <= nestedIndent || !optionTrimmed.startsWith('- ')) {
                    break;
                  }
                  nestedArray.push(parseYamlValue(optionTrimmed.slice(2).trim()));
                  j += 1;
                }
                nested[nestedKey] = nestedArray;
                continue;
              }
              nested[nestedKey] = '';
              j += 1;
              continue;
            }
            nested[nestedKey] = parseYamlValue(nestedRaw);
            j += 1;
          }
          result[key] = nested;
          i = j - 1;
          continue;
        }
      }
      result[key] = null;
      continue;
    }

    result[key] = parseYamlValue(rawValue);
  }

  if (blockScalarKey) flushBlockScalar();
  flushArray();

  return result;
}

// TFile class for instanceof checks
export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;

  constructor(path: string = '') {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.basename = this.name.replace(/\.[^.]+$/, '');
    this.extension = this.name.split('.').pop() || '';
  }
}

export class TFolder {
  path: string;
  name: string;
  children: any[] = [];

  constructor(path: string = '') {
    this.path = path;
    this.name = path.split('/').pop() || '';
  }
}
