import type { ExecutionInputSessionSectionSnapshot } from '../types/chat';

export interface SessionSectionTurnRequest {
  readonly displayContent: string;
  readonly canonicalText: string;
  readonly sessionSection: ExecutionInputSessionSectionSnapshot;
  readonly hostNotePath: string;
  /** Fence epoch from the current parse. Required so the host can fail-closed. */
  readonly epoch: number;
}

export type SessionSectionTurnBlockReason =
  | 'flag-off'
  | 'conversation-missing'
  | 'epoch-mismatch'
  | 'view-unavailable'
  | 'tab-not-ready'
  | 'rewind-in-progress'
  | 'invalid-request';

export type SessionSectionTurnResult =
  | { readonly status: 'sent' }
  | { readonly status: 'queued' }
  | { readonly status: 'blocked'; readonly reason: SessionSectionTurnBlockReason };

export type SessionSectionFocusBlockReason =
  | 'flag-off'
  | 'conversation-missing'
  | 'view-unavailable'
  | 'tab-not-ready'
  | 'invalid-request';

export type SessionSectionFocusResult =
  | { readonly status: 'focused' }
  | { readonly status: 'blocked'; readonly reason: SessionSectionFocusBlockReason };
