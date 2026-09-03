# Editor artifact board

Open this note in **Live Preview** or **Reading** view. Source mode shows the fence text only.

```dean-artifact
schemaVersion: 1
id: editor-artifact-board
title: Dean editor artifact
createdAt: 1787505000000
style:
  max-width: 960px

<div style="display: grid; gap: 18px">
  <p style="margin: 0; color: var(--text-muted); font-size: 14px">
    Allowlisted HTML mounted with <code>createEl</code>. Display only: no scripts, iframes, forms, or vault write-back.
  </p>

  <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px">
    <div style="padding: 12px; border: 1px solid var(--background-modifier-border); border-radius: 8px; background: var(--background-primary)">
      <div style="font-size: 12px; color: var(--text-muted)">Fence language</div>
      <div style="font-size: 22px; font-weight: 700"><code>dean-artifact</code></div>
      <div style="font-size: 12px; color: var(--text-muted)">YAML header, then HTML</div>
    </div>
    <div style="padding: 12px; border: 1px solid var(--background-modifier-border); border-radius: 8px; background: var(--background-primary)">
      <div style="font-size: 12px; color: var(--text-muted)">Node cap</div>
      <div style="font-size: 22px; font-weight: 700">400</div>
      <div style="font-size: 12px; color: var(--text-muted)">depth 16</div>
    </div>
    <div style="padding: 12px; border: 1px solid var(--background-modifier-border); border-radius: 8px; background: var(--background-primary)">
      <div style="font-size: 12px; color: var(--text-muted)">Host APIs</div>
      <div style="font-size: 22px; font-weight: 700">none</div>
      <div style="font-size: 12px; color: var(--text-muted)">not Act / Collect</div>
    </div>
    <div style="padding: 12px; border: 1px solid var(--background-modifier-border); border-radius: 8px; background: var(--background-primary)">
      <div style="font-size: 12px; color: var(--text-muted)">Trust</div>
      <div style="font-size: 22px; font-weight: 700">fail closed</div>
      <div style="font-size: 12px; color: var(--text-muted)">tag and attr allowlist</div>
    </div>
  </div>

  <div>
    <h3 style="margin: 0 0 10px">Implementation slices</h3>
    <div style="display: grid; gap: 10px">
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px">
          <span>Core codec and HTML walk</span>
          <strong>100%</strong>
        </div>
        <progress value="100" max="100"></progress>
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px">
          <span>Native widget and processor</span>
          <strong>100%</strong>
        </div>
        <progress value="100" max="100"></progress>
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px">
          <span>Authoring appendix and docs</span>
          <strong>90%</strong>
        </div>
        <progress value="90" max="100"></progress>
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px">
          <span>Live Preview in-app check</span>
          <strong>40%</strong>
        </div>
        <progress value="40" max="100"></progress>
      </div>
    </div>
  </div>

  <table>
    <caption style="caption-side: top; text-align: left; padding: 0 0 8px; color: var(--text-muted); font-size: 13px">What this fence may contain versus what stays elsewhere</caption>
    <thead>
      <tr>
        <th>Kind</th>
        <th>v1</th>
        <th>Owner</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Metric strip, table, steps</td>
        <td><span style="color: var(--interactive-accent); font-weight: 600">yes</span></td>
        <td><code>dean-artifact</code></td>
        <td>This widget</td>
      </tr>
      <tr>
        <td>Questions and Act buttons</td>
        <td><span style="color: var(--text-muted)">no</span></td>
        <td><code>dean-session</code></td>
        <td>Collect / Act only</td>
      </tr>
      <tr>
        <td>Charts, canvas, D3</td>
        <td><span style="color: var(--text-error); font-weight: 600">no</span></td>
        <td>later iframe</td>
        <td>Needs a JS sandbox</td>
      </tr>
      <tr>
        <td>Images and SVG</td>
        <td><span style="color: var(--text-error); font-weight: 600">no</span></td>
        <td>later</td>
        <td><code>src</code> is rejected</td>
      </tr>
      <tr>
        <td>Remote links</td>
        <td><span style="color: var(--text-error); font-weight: 600">no</span></td>
        <td>surrounding prose</td>
        <td>Put wikilinks outside the fence</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4">Unknown tags, <code>onclick</code>, <code>href</code>, <code>src</code>, and reserved <code>dean-</code> classes invalidate the whole fence.</td>
      </tr>
    </tfoot>
  </table>

  <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px">
    <div>
      <h3 style="margin: 0 0 8px">Mount path</h3>
      <ol style="margin: 0; padding-left: 1.2em">
        <li>Split YAML header from the HTML fragment</li>
        <li>Walk tags and attributes, fail closed</li>
        <li>Build an <code>ArtifactNode</code> tree</li>
        <li>Mount with <code>createEl</code> and <code>appendText</code></li>
        <li>Live Preview reuses <code>enableInteractiveEmbed</code></li>
      </ol>
    </div>
    <div>
      <h3 style="margin: 0 0 8px">Allowed chrome</h3>
      <dl style="margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px">
        <dt><strong>Tags</strong></dt>
        <dd style="margin: 0">div, table, lists, headings, code, details, progress</dd>
        <dt><strong>Attrs</strong></dt>
        <dd style="margin: 0">class, style, title, colspan, rowspan, value, max, open</dd>
        <dt><strong>CSS</strong></dt>
        <dd style="margin: 0">inline styles and author classes, never a style tag</dd>
        <dt><strong>Text</strong></dt>
        <dd style="margin: 0">plain text nodes only</dd>
      </dl>
    </div>
  </div>

  <blockquote style="margin: 0; padding: 10px 14px; border-left: 3px solid var(--interactive-accent); background: var(--background-primary); color: var(--text-muted)">
    Keep questionnaires and Act prompts in <code>dean-session</code>. This fence is a status board, not a form.
  </blockquote>

  <details open>
    <summary>Rejected on purpose in this fragment</summary>
    <ul style="margin: 8px 0 0">
      <li><code>script</code>, <code>iframe</code>, <code>object</code>, <code>embed</code></li>
      <li><code>form</code>, <code>input</code>, <code>button</code>, <code>textarea</code>, <code>select</code></li>
      <li><code>img</code>, <code>svg</code>, <code>canvas</code>, <code>video</code>, <code>audio</code></li>
      <li><code>a href</code>, <code>src</code>, event handlers, <code>url()</code> in CSS</li>
    </ul>
  </details>

  <details>
    <summary>Authoring pitfalls</summary>
    <ul style="margin: 8px 0 0">
      <li>Do not wrap the HTML in a YAML block scalar. Header, blank line, then elements.</li>
      <li>Do not put triple backticks inside the fragment. That closes the markdown fence.</li>
      <li>Class tokens must be real CSS identifiers and must not start with <code>dean-</code>.</li>
      <li>Surrounding wikilinks belong in the note prose, not inside the widget.</li>
    </ul>
  </details>
</div>
```

Surrounding prose can still use wikilinks, such as [[docs/features.md]] for the feature write-up.
