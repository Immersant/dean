import type { ProviderToolPolicy } from '../../../core/execution/ProviderExecutionRequest';
import {
  buildSystemPrompt,
  computeSystemPromptKey,
  type SystemPromptBuildOptions,
  type SystemPromptSettings,
} from '../../../core/prompt/mainAgent';
import { buildDeanSystemPromptAppendices } from '../../../core/session-sections/sessionSectionPrompt';
import type { DeanSettings } from '../../../core/types/settings';

const GROK_PROMPT_OPTIONS = Object.freeze({
  toolGuidanceProfile: 'provider-native' as const,
});

export type GrokSystemPromptSettings = SystemPromptSettings;

function mergeGrokPromptOptions(
  settings: Pick<DeanSettings, 'enableEditorSessionSections'> | GrokSystemPromptSettings,
  toolPolicy?: ProviderToolPolicy,
  extra?: SystemPromptBuildOptions,
): SystemPromptBuildOptions {
  const appendices = [
    ...buildDeanSystemPromptAppendices(
      settings as Pick<DeanSettings, 'enableEditorSessionSections'>,
      toolPolicy,
    ),
    ...(extra?.appendices ?? []),
  ];
  return {
    ...GROK_PROMPT_OPTIONS,
    ...extra,
    ...(appendices.length > 0 ? { appendices } : {}),
  };
}

export function buildGrokSystemPrompt(
  settings: GrokSystemPromptSettings,
  options?: {
    toolPolicy?: ProviderToolPolicy;
    appendices?: string[];
  },
): string {
  return buildSystemPrompt(
    settings,
    mergeGrokPromptOptions(settings, options?.toolPolicy, {
      appendices: options?.appendices,
    }),
  );
}

export function computeGrokSystemPromptKey(
  settings: GrokSystemPromptSettings,
  options?: {
    toolPolicy?: ProviderToolPolicy;
    appendices?: string[];
  },
): string {
  return computeSystemPromptKey(
    settings,
    mergeGrokPromptOptions(settings, options?.toolPolicy, {
      appendices: options?.appendices,
    }),
  );
}
