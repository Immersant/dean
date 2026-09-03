# Artifacts (core)

Provider-neutral schema, codec, and HTML allowlist for editor `dean-artifact` fences.

## Ownership

| Module | Authority |
| --- | --- |
| `parseDeanArtifactFence` | YAML header + HTML body split; only mutator of parsed `DeanArtifact`. |
| `htmlToArtifactNodes` | Fail-closed tag/attribute walk into an `ArtifactNode` tree. |

## Boundaries

- Must not import features, `src/app/`, `src/main.ts`, or provider implementations.
- Vault processors and `createEl` mounting live in `src/features/artifacts/`.
- Reuse session-section CSS class/style parsers. Do not accept `<script>`, `<iframe>`, forms, media, or `href`/`src`.

## Verification

- Unit tests under `tests/unit/core/artifacts/`.
- Forbidden tags and event-handler attributes must throw `DeanArtifactCodecError`.
