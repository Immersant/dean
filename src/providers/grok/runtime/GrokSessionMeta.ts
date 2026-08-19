import type { ProviderToolPolicy } from '../../../core/execution/ProviderExecutionRequest';
import type { DeanSettings } from '../../../core/types/settings';
import { decodeGrokModelId } from '../models';
import {
  buildGrokSystemPrompt,
  type GrokSystemPromptSettings,
} from '../prompt/GrokSystemPrompt';

export interface GrokSessionMeta {
  modelId?: string;
  systemPromptOverride: string;
  yoloMode: boolean;
}

export interface GrokSessionMetaBuildOptions {
  model: string;
  permissionMode: unknown;
  promptSettings: GrokSystemPromptSettings & Partial<Pick<DeanSettings, 'enableEditorSessionSections'>>;
  toolPolicy?: ProviderToolPolicy;
}

export function buildGrokSessionMeta(
  options: GrokSessionMetaBuildOptions,
): GrokSessionMeta {
  const modelId = decodeGrokModelId(options.model);
  return {
    ...(modelId ? { modelId } : {}),
    systemPromptOverride: buildGrokSystemPrompt(options.promptSettings, {
      toolPolicy: options.toolPolicy,
    }),
    yoloMode: options.permissionMode === 'yolo',
  };
}
