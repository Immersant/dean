# Artifacts (feature)

Obsidian editor widget for display-only `dean-artifact` fences.

## Ownership

| Module | Authority |
| --- | --- |
| `renderDeanArtifactBlock` | Markdown code-block processor entry; gating (flag, path, Dean containers). |
| `mountDeanArtifact` | `createEl` / `appendText` mount of the allowlisted `ArtifactNode` tree. |

## Boundaries

- Display only. Must not call FeatureHost turn, draft, or focus APIs.
- Must not assign `innerHTML` from fence HTML.
- Reuse session-section processor gating and `enableInteractiveEmbed`.
- Schema/codec ownership stays in `src/core/artifacts/`.

## Verification

- Unit tests under `tests/unit/features/artifacts/`.
- Processor must not activate in chat (`sourcePath === ''`) or inside Dean UI containers.
