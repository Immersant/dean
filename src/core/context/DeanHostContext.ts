export const DEAN_HOST_CONTEXT =
  '<dean_host context_mode="dean-plugin" version="1" />';

export function formatDeanHostContext(): string {
  return DEAN_HOST_CONTEXT;
}

export function appendDeanHostContext(prompt: string): string {
  return `${prompt}\n\n${formatDeanHostContext()}`;
}
