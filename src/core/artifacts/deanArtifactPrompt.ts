import { ARTIFACT_FENCE_LANGUAGE, ARTIFACT_SCHEMA_VERSION } from './DeanArtifact';

export const ARTIFACT_AUTHORING_APPENDIX = `## Editor Artifacts

Use a fenced \`${ARTIFACT_FENCE_LANGUAGE}\` block when the user should see a durable **display** in a vault note: a status strip, comparison table, step list, or similar layout. Prefer the linked note when set.

Rules:
- YAML header first (\`schemaVersion: ${ARTIFACT_SCHEMA_VERSION}\`, safe local \`id\`, non-empty \`title\`, \`createdAt\` as a non-negative Unix timestamp in milliseconds), then a blank line or \`---\`, then an HTML **element** fragment.
- Allowed tags: \`div\`, \`span\`, \`p\`, \`h1\`-\`h6\`, \`ul\`, \`ol\`, \`li\`, \`dl\`, \`dt\`, \`dd\`, \`table\`, \`thead\`, \`tbody\`, \`tfoot\`, \`tr\`, \`th\`, \`td\`, \`caption\`, \`strong\`, \`em\`, \`b\`, \`i\`, \`code\`, \`pre\`, \`blockquote\`, \`hr\`, \`br\`, \`details\`, \`summary\`, \`progress\`.
- Allowed attributes: \`class\`, \`style\`, \`title\`, table \`colspan\`/\`rowspan\`, \`progress\` \`value\`/\`max\`, \`details\` \`open\`. Class tokens must not start with \`dean-\`. Style values must not use \`url()\`, \`expression()\`, or \`javascript:\`.
- Artifacts are display-only. Use \`dean-session\` for questions, answers, Act buttons, and Start new chat.
- Do not include \`script\`, \`style\`, \`iframe\`, \`form\`, \`input\`, \`button\`, \`img\`, \`svg\`, \`a\`, or \`href\`/\`src\` attributes.
- Artifacts are not conversation-bound. Do not copy \`<dean_conversation>\` into this fence.

Canonical example (replace the timestamp):

\`\`\`${ARTIFACT_FENCE_LANGUAGE}
schemaVersion: ${ARTIFACT_SCHEMA_VERSION}
id: sprint-health
title: Sprint health
createdAt: 1735689600000

<div>
  <div><strong>Open</strong> 12</div>
  <div><strong>Blocked</strong> 3</div>
</div>
\`\`\`
`;
