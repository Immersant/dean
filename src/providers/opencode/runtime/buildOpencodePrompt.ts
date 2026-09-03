import type {
  ChatMessage,
  ExecutionInputConversationBindingSnapshot,
  ExecutionInputSessionSectionSnapshot,
  ImageAttachment,
} from '../../../core/types';
import type { BrowserSelectionContext } from '../../../utils/browser';
import type { CanvasSelectionContext } from '../../../utils/canvas';
import { appendProviderExecutionContext } from '../../../utils/context';
import type { EditorSelectionContext } from '../../../utils/editor';
import { buildContextFromHistory, buildPromptWithHistoryContext } from '../../../utils/session';
import type { AcpContentBlock } from '../../acp';

export interface OpencodePromptRequest {
  text: string;
  images?: ImageAttachment[];
  currentNotePath?: string;
  currentNoteContent?: string;
  editorSelection?: EditorSelectionContext | null;
  browserSelection?: BrowserSelectionContext | null;
  canvasSelection?: CanvasSelectionContext | null;
  externalContextPaths?: string[];
  conversationBinding?: ExecutionInputConversationBindingSnapshot;
  sessionSection?: ExecutionInputSessionSectionSnapshot;
}

export function buildOpencodePromptText(
  request: OpencodePromptRequest,
  conversationHistory: ChatMessage[] = [],
): string {
  let prompt = appendProviderExecutionContext(request.text, {
    ...(request.currentNotePath
      ? {
        currentNote: {
          path: request.currentNotePath,
          ...(request.currentNoteContent !== undefined
            ? { content: request.currentNoteContent }
            : {}),
        },
      }
      : {}),
    editorSelection: request.editorSelection,
    browserSelection: request.browserSelection,
    canvasSelection: request.canvasSelection,
    conversationBinding: request.conversationBinding,
    sessionSection: request.sessionSection,
  }, {
    skipNoneEditorSelection: true,
  });

  if (conversationHistory.length > 0) {
    const historyContext = buildContextFromHistory(conversationHistory);
    prompt = buildPromptWithHistoryContext(
      historyContext,
      prompt,
      prompt,
      conversationHistory,
    );
  }

  return prompt;
}

export function buildOpencodePromptBlocks(
  request: OpencodePromptRequest,
  conversationHistory: ChatMessage[] = [],
): AcpContentBlock[] {
  const blocks: AcpContentBlock[] = [
    { type: 'text', text: buildOpencodePromptText(request, conversationHistory) },
  ];

  for (const image of request.images ?? []) {
    if (!image.data) {
      continue;
    }

    blocks.push({
      data: image.data,
      mimeType: image.mediaType,
      type: 'image',
    });
  }

  return blocks;
}
