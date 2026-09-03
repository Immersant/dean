export type SessionSectionDiagnosticLevel = 'info' | 'warn' | 'error';

export interface SessionSectionDiagnosticEvent {
  readonly at: number;
  readonly level: SessionSectionDiagnosticLevel;
  readonly code: string;
  readonly message: string;
  readonly conversationId?: string;
  readonly sectionId?: string;
  readonly actionId?: string;
}

const MAX_EVENTS = 50;
const events: SessionSectionDiagnosticEvent[] = [];

export function recordSessionSectionDiagnostic(
  event: Omit<SessionSectionDiagnosticEvent, 'at'>,
): void {
  events.push({
    ...event,
    at: Date.now(),
  });
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

export function getSessionSectionDiagnostics(): readonly SessionSectionDiagnosticEvent[] {
  return events.slice();
}

export function clearSessionSectionDiagnostics(): void {
  events.length = 0;
}
