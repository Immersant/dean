# Dean Full Rename Design

## Goal

Rename the Obsidian plugin product from Claudian to Dean throughout the currently present repository. This is a clean-slate identity change: Dean will not preserve or migrate Claudian plugin IDs, persisted data, storage paths, selectors, or code-level compatibility aliases.

## Scope

Rename every product-owned occurrence according to casing:

- `Claudian` to `Dean`
- `claudian` to `dean`
- `CLAUDIAN` to `DEAN`

The rename covers:

- npm and lockfile package identity and descriptions
- Obsidian manifest name and plugin ID
- product-facing UI text, documentation, issue templates, and contributor guidance
- product-owned TypeScript symbols, filenames, imports, constants, and tests
- CSS class names and generated stylesheet headers
- build, development, test, and release tooling
- product-owned settings, conversation, and other persistence paths
- repository-specific agent guidance

## Semantic Boundary

Dean remains a multi-provider plugin whose default provider is Claude. Claude provider names, Anthropic package names, Claude CLI references, provider-owned paths, and other legitimate `Claude` terminology are not part of the product rename.

External links that identify the old Claudian repository, Obsidian community listing, badges, sponsorship tracking, or release locations must not be blindly rewritten to nonexistent Dean destinations. If no verified Dean destination exists in repository context, remove the stale product-specific link or replace it with neutral text rather than inventing a URL.

## Identity and Persistence

Use `dean` as the lowercase package, plugin, path, and selector identity, and `Dean` as the display name. The old `realclaudian` plugin ID and Claudian storage locations are not retained.

No migration logic, fallback reads, legacy constants, compatibility exports, or aliases will be added. Existing Claudian settings and conversations will therefore not appear in Dean.

## Implementation Strategy

Perform a semantic inventory before editing, then rename one coherent dependency chain at a time. Rename tests alongside their owned source symbols and paths. Update imports and architecture checks after file renames. Review each remaining case-insensitive `claudian` match manually; the final repository should contain none unless an unavoidable external historical reference is explicitly documented.

The current checkout reports the original tracked tree as deleted and the present partial tree as untracked. Preserve that pre-existing state. Modify only currently present files plus rename-specific files created during this work, and do not restore, delete, or stage unrelated paths.

## Verification

Verification consists of:

1. A case-insensitive repository search, excluding Git metadata and dependencies, finds no unintended `claudian` references.
2. Manifest, package, and lockfile identities agree on `dean`.
3. Imports and architecture checks reference renamed files and symbols.
4. The full repository check passes where supported by the partial checkout:

   ```bash
   npm run typecheck && npm run lint && npm run test && npm run build
   ```

If the partial checkout prevents a command from running, report the exact missing prerequisite and still run every independent check that remains available.

## Acceptance Criteria

- User-visible product branding is Dean.
- Product-owned internal identifiers and paths use Dean naming.
- Obsidian and npm identities use `dean`.
- No Claudian compatibility or data migration remains.
- Claude provider behavior and naming remain intact.
- No unrelated user-owned worktree changes are overwritten or staged.
