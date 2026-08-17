# Standalone Collect New-Chat Draft Design

## Summary

Dean will support an opt-in standalone `dean-session` Collect form that can open a fresh chat draft without referring to an existing conversation. A standalone form declares `startNewChat: true`, stores answers in its source note as Collect forms already do, and renders a distinct **Start new chat** button.

Clicking the button opens a new unbound Dean tab using Dean's current default provider and model. Dean fills the composer with reviewable Markdown derived from the form title, source note, questions, and current answers. It does not submit the draft or initialize provider execution.

## Goals

- Allow a Collect form to exist without `conversationId` or `epoch`.
- Make new-chat behavior explicit and opt-in in the YAML schema.
- Create a fresh unbound chat using Dean's current defaults.
- Preserve the user's opportunity to review and edit the composed prompt.
- Keep Collect answer persistence vault-only.
- Preserve all existing bound Act and Collect behavior.

## Non-Goals

- Automatically submit the generated draft.
- Inherit a provider or model from another conversation.
- Resume, fork, or otherwise bind to a previous conversation.
- Add custom prompt templates in the first version.
- Attach the source note as execution context automatically.
- Change provider adapters, provider session state, conversation persistence, or persisted tab schemas.

## Schema and Types

`SessionSection` will become a discriminated union rather than making binding fields generally optional.

Bound variants retain the existing contract:

- `kind` is `act` or `collect`.
- `conversationId` and `epoch` are required.
- `startNewChat` must be omitted.
- Act requires at least one action.
- Collect requires at least one question and may retain its existing co-located Act actions.

The standalone variant has this contract:

```yaml
schemaVersion: 1
id: discovery
kind: collect
title: Discovery questions
status: open
createdAt: 1786992000000
startNewChat: true
questions:
  - id: goal
    prompt: What should we build?
    type: markdown
answers: {}
```

For a standalone Collect section:

- `kind` must be `collect`.
- `startNewChat` must be exactly `true`.
- At least one question is required.
- `conversationId`, `epoch`, and `actions` must be omitted.
- Existing size, identifier, question, option, and answer limits continue to apply.

Schema version 1 remains valid because the new field and variant are additive. Validation must fail closed for ambiguous combinations, including `startNewChat: true` with binding fields or actions, and `startNewChat` on an Act section.

The codec must omit absent binding fields and preserve `startNewChat: true` through parse, serialization, and Collect write-back. Agent authoring guidance will document standalone Collect forms separately from bound forms and will continue to prohibit invented conversation identifiers.

## Ownership and Architecture

Core session-section modules own the union types, conditional validation, and YAML serialization. They do not create UI or chat tabs.

The session-sections feature owns:

- deciding whether the standalone button is rendered;
- snapshotting current Collect answers;
- flushing answers through the existing write-back controller;
- formatting the fixed Markdown draft;
- requesting a new draft through `FeatureHost`.

`FeatureHost` gains a provider-neutral request/result contract for opening a new chat draft. The request contains the prepared composer text and source note path for diagnostics and presentation only. It contains no provider selection or previous conversation identity. The result distinguishes success from fail-closed view, tab, and composer availability failures so the feature can localize the correct notice without inspecting chat internals.

The application composition and chat view own opening Dean, creating and activating a fresh retained unbound tab, populating its empty composer, dispatching the normal input event, and focusing it. Tab creation must use the existing blank-tab path so the tab snapshots the current global provider/model seed.

This path remains separate from `submitSessionSectionTurn`. It must not resolve a conversation, compare section epochs, create a durable conversation, submit through `InputController`, or acquire provider execution resources.

## Interaction Flow

1. The Markdown processor parses a valid standalone Collect section.
2. The widget renders its questions and a distinct **Start new chat** button.
3. The user edits answers normally; existing blur/change persistence behavior remains unchanged.
4. On button click, the widget disables the button and snapshots the controller's current in-memory answers before any write can remount the widget.
5. The widget flushes those answers to the source note.
6. A pure formatter builds the Markdown draft from the snapshot.
7. The feature calls the `FeatureHost` new-draft contract.
8. The host ensures a Dean view is available, creates a new unbound tab, fills the composer, and focuses it.
9. The user reviews, edits, sends, or abandons the draft through existing chat behavior.

A new tab is always created. Dean must not reuse an existing unbound tab because it may contain unrelated unsent text. If the operation fails after a new empty tab is created, the chat owner should discard that tab when it is still unbound and untouched; it must not discard a tab after user ownership has changed.

No confirmation modal is shown. The unsent composer is the review boundary.

## Draft Format

The initial implementation uses a fixed localized Markdown structure with no template language:

```markdown
# Discovery questions

Source note: Notes/Feature discovery.md

## What should we build?

An editor workflow for collecting requirements.

## Which areas matter?

- Accessibility
- Persistence

## Anything else?

_Not answered_
```

Formatting rules:

- The section title becomes the top-level heading.
- The vault-relative source path is included as readable text.
- Each question prompt becomes a second-level heading.
- Heading text is escaped so title or prompt punctuation cannot change the generated structure.
- Scalar answers render as text.
- Multi-select answers render as a bullet list in stored order.
- Missing and empty answers render a localized `_Not answered_` marker.
- User content is placed into the composer as editable text, never assigned as HTML.

The source note is not silently added to the file-context tray. The user may attach it explicitly before sending.

## UI and Accessibility

The standalone action uses a dedicated Dean-prefixed class and localized label. It follows the repository's complete button-state pattern for rest, hover, focus-visible, active, busy, and disabled states, using Obsidian theme variables.

While flushing and opening the chat, the button is disabled and exposes a busy state. Repeated clicks during the same operation are ignored. The button remains keyboard operable and has a clear accessible name.

## Error Handling

- Invalid standalone/bound field combinations render the existing invalid-section callout.
- A write-back failure stops the operation; Dean does not open a draft based on answers that were not persisted. Existing note contents remain authoritative.
- If Dean cannot open a view or create a tab, the feature shows a localized notice and records a bounded session-section diagnostic.
- If composer population fails, the host returns failure and cleans up a newly created untouched tab when safe.
- Errors never fall back to `submitSessionSectionTurn` and never select a provider-specific recovery path.
- The current answers remain in the note after any chat-opening failure, so retrying is safe.

## Verification

Implementation proceeds in observable TDD slices.

### Core schema and codec

- Accept a valid standalone Collect section.
- Reject standalone Act, missing questions, binding fields, actions, and non-boolean or false `startNewChat` encodings where the standalone variant is intended.
- Preserve `startNewChat: true` and omission of binding fields through parse/serialize round trips.
- Preserve existing bound Act and Collect parsing unchanged.

### Collect persistence and formatting

- Write standalone answers back without inventing `conversationId` or `epoch`.
- Format scalar, multiline, multi-select, empty, and unanswered values deterministically.
- Include the title and source note path.

### Widget behavior

- Render **Start new chat** only for the standalone opt-in variant.
- Do not render it for existing bound forms.
- Snapshot current answers before flushing.
- Call the new host contract only after a successful flush.
- Prevent duplicate clicks while busy.
- Never call `submitSessionSectionTurn` for the standalone button.

### Chat/application behavior

- Ensure the Dean view is available.
- Always create a fresh unbound retained tab.
- Use the current global provider/model defaults.
- Populate and focus the composer without submitting.
- Dispatch the normal input event so resizing and composer state update.
- Do not initialize execution or create a durable conversation.
- Do not overwrite an existing unbound draft.
- Clean up a newly created untouched tab on population failure.

### Regression coverage

- Existing bound Act actions continue to confirm and submit.
- Existing bound Collect write-back and co-located actions continue to work.
- Processor gating inside Dean UI and non-vault Markdown contexts remains unchanged.

## Expected Scope

This is a medium-sized feature comprising approximately three to four TDD slices. It is expected to touch core session-section types, validation, codec and prompt guidance; Collect write-back and widget code; a small draft formatter; `FeatureHost`; application/chat draft opening; CSS and accessibility rules; localization; documentation; and mirrored unit tests. No provider-specific implementation should be necessary.
