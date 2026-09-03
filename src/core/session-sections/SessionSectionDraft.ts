export interface SessionSectionDraftRequest {
  readonly content: string;
  readonly sourceNotePath: string;
}

export type SessionSectionDraftBlockReason =
  | 'flag-off'
  | 'invalid-request'
  | 'view-unavailable'
  | 'tab-not-ready'
  | 'composer-unavailable';

export type SessionSectionDraftResult =
  | { readonly status: 'opened' }
  | { readonly status: 'blocked'; readonly reason: SessionSectionDraftBlockReason };
