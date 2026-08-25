# Mobile layout drafts

Open in **Live Preview** or **Reading**. Wireframes only: dashed regions stand in for real controls. Same widget as [[artifact-board]]. Theme choices live in the Collect form under the phones.

```dean-artifact
schemaVersion: 1
id: mobile-layout-drafts
title: Mobile layout drafts
createdAt: 1787505600000

<div style="display: grid; gap: 16px">
  <p style="margin: 0; font-size: 13px; color: var(--text-muted)">
    Five phone frames for a notes app, including theme and branding. Draft chrome: no images, no buttons, no inputs. Labels mark where live controls would go. The Collect form under the wireframes is a live <code>dean-session</code>.
  </p>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; align-items: start">

    <div>
      <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin: 0 0 8px; letter-spacing: 0.04em">A · HOME / FEED</div>
      <div style="width: 260px; border: 2px solid var(--background-modifier-border); border-radius: 28px; overflow: hidden; background: var(--background-primary); display: flex; flex-direction: column; min-height: 520px">
        <div style="display: flex; justify-content: space-between; padding: 10px 18px 4px; font-size: 11px; color: var(--text-muted)">
          <span>9:41</span>
          <span>5G · 81%</span>
        </div>
        <div style="padding: 8px 16px 12px; display: flex; justify-content: space-between; align-items: baseline">
          <span style="font-size: 20px; font-weight: 700">Tonight</span>
          <span style="font-size: 11px; color: var(--text-muted)">Draft</span>
        </div>
        <div style="margin: 0 16px 12px; padding: 8px 12px; border: 1px dashed var(--background-modifier-border); border-radius: 10px; font-size: 12px; color: var(--text-faint)">Search notes</div>
        <div style="flex: 1; padding: 0 16px; display: grid; gap: 10px">
          <div style="padding: 10px 12px; border: 1px solid var(--background-modifier-border); border-radius: 12px">
            <div style="font-size: 11px; color: var(--text-muted)">Pinned</div>
            <div style="font-weight: 600">Kitchen remodel</div>
            <div style="font-size: 12px; color: var(--text-muted)">3 open questions</div>
          </div>
          <div style="padding: 10px 12px; border: 1px solid var(--background-modifier-border); border-radius: 12px">
            <div style="font-size: 11px; color: var(--text-muted)">Today</div>
            <div style="font-weight: 600">Supplier call notes</div>
            <div style="height: 6px; margin-top: 8px; border-radius: 99px; background: var(--background-modifier-border)"></div>
          </div>
          <div style="padding: 10px 12px; border: 1px dashed var(--background-modifier-border); border-radius: 12px; color: var(--text-faint); font-size: 12px">Empty card · image later</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--background-modifier-border); padding: 10px 0 14px; font-size: 10px; text-align: center; color: var(--text-muted)">
          <span style="color: var(--text-normal); font-weight: 700">Home</span>
          <span>Search</span>
          <span>Inbox</span>
          <span>Me</span>
        </div>
      </div>
    </div>

    <div>
      <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin: 0 0 8px; letter-spacing: 0.04em">B · DETAIL</div>
      <div style="width: 260px; border: 2px solid var(--background-modifier-border); border-radius: 28px; overflow: hidden; background: var(--background-primary); display: flex; flex-direction: column; min-height: 520px">
        <div style="display: flex; justify-content: space-between; padding: 10px 18px 4px; font-size: 11px; color: var(--text-muted)">
          <span>9:41</span>
          <span>5G · 81%</span>
        </div>
        <div style="padding: 8px 16px; display: flex; justify-content: space-between; font-size: 13px">
          <span style="color: var(--text-muted)">‹ Feed</span>
          <span style="color: var(--text-muted)">Share</span>
        </div>
        <div style="padding: 4px 16px 12px">
          <h3 style="margin: 0 0 4px; font-size: 18px">Kitchen remodel</h3>
          <p style="margin: 0; font-size: 12px; color: var(--text-muted)">Updated 2h ago · you</p>
        </div>
        <div style="flex: 1; padding: 0 16px; display: grid; gap: 8px; font-size: 13px; color: var(--text-normal)">
          <p style="margin: 0">Keep the island at 2.4m. Cabinet sample B is warmer than the floor.</p>
          <p style="margin: 0; padding: 10px; border-left: 3px solid var(--interactive-accent); background: var(--background-secondary); color: var(--text-muted)">Decision: hold tile until the sink lead time is confirmed.</p>
          <div style="height: 72px; border: 1px dashed var(--background-modifier-border); border-radius: 10px; color: var(--text-faint); font-size: 12px; padding: 12px">Photo block</div>
          <p style="margin: 0; color: var(--text-muted); font-size: 12px">Next: call Harbor on Friday.</p>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px 16px 16px; border-top: 1px solid var(--background-modifier-border)">
          <div style="padding: 8px; text-align: center; border: 1px solid var(--background-modifier-border); border-radius: 10px; font-size: 12px">Edit</div>
          <div style="padding: 8px; text-align: center; border-radius: 10px; font-size: 12px; background: var(--interactive-accent); color: var(--text-on-accent)">Continue</div>
        </div>
      </div>
    </div>

    <div>
      <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin: 0 0 8px; letter-spacing: 0.04em">C · COMPOSER</div>
      <div style="width: 260px; border: 2px solid var(--background-modifier-border); border-radius: 28px; overflow: hidden; background: var(--background-primary); display: flex; flex-direction: column; min-height: 520px">
        <div style="display: flex; justify-content: space-between; padding: 10px 18px 4px; font-size: 11px; color: var(--text-muted)">
          <span>9:41</span>
          <span>5G · 81%</span>
        </div>
        <div style="padding: 8px 16px; display: flex; justify-content: space-between; font-size: 13px">
          <span style="color: var(--text-muted)">Close</span>
          <span style="font-weight: 600">New note</span>
          <span style="color: var(--interactive-accent); font-weight: 600">Save</span>
        </div>
        <div style="padding: 8px 16px; display: grid; gap: 10px; flex: 1">
          <div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px">Title</div>
            <div style="padding: 10px 12px; border: 1px dashed var(--background-modifier-border); border-radius: 10px; font-size: 14px; color: var(--text-faint)">Note title</div>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column">
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px">Body</div>
            <div style="flex: 1; min-height: 160px; padding: 10px 12px; border: 1px dashed var(--background-modifier-border); border-radius: 10px; font-size: 13px; color: var(--text-faint)">Write in the vault…</div>
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap">
            <span style="padding: 4px 10px; border-radius: 99px; border: 1px solid var(--background-modifier-border); font-size: 11px">#project</span>
            <span style="padding: 4px 10px; border-radius: 99px; border: 1px dashed var(--background-modifier-border); font-size: 11px; color: var(--text-faint)">Add tag</span>
          </div>
        </div>
        <div style="padding: 10px 16px 16px; font-size: 11px; color: var(--text-muted)">Attach and voice stay out of v1.</div>
      </div>
    </div>

    <div>
      <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin: 0 0 8px; letter-spacing: 0.04em">D · SETTINGS</div>
      <div style="width: 260px; border: 2px solid var(--background-modifier-border); border-radius: 28px; overflow: hidden; background: var(--background-primary); display: flex; flex-direction: column; min-height: 520px">
        <div style="display: flex; justify-content: space-between; padding: 10px 18px 4px; font-size: 11px; color: var(--text-muted)">
          <span>9:41</span>
          <span>5G · 81%</span>
        </div>
        <div style="padding: 8px 16px 12px; font-size: 20px; font-weight: 700">Settings</div>
        <div style="padding: 0 16px; display: grid; gap: 14px; flex: 1">
          <div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px">Account</div>
            <div style="border: 1px solid var(--background-modifier-border); border-radius: 12px; overflow: hidden">
              <div style="display: flex; justify-content: space-between; padding: 10px 12px; font-size: 13px; border-bottom: 1px solid var(--background-modifier-border)">
                <span>Profile</span><span style="color: var(--text-faint)">›</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 10px 12px; font-size: 13px">
                <span>Linked vault</span><span style="color: var(--text-muted); font-size: 12px">Dean</span>
              </div>
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px">Preferences</div>
            <div style="border: 1px solid var(--background-modifier-border); border-radius: 12px; overflow: hidden">
              <div style="display: flex; justify-content: space-between; padding: 10px 12px; font-size: 13px; border-bottom: 1px solid var(--background-modifier-border)">
                <span>Appearance</span><span style="color: var(--text-muted); font-size: 12px">System</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 10px 12px; font-size: 13px; border-bottom: 1px solid var(--background-modifier-border)">
                <span>Notifications</span><span style="color: var(--text-faint)">›</span>
              </div>
              <div style="padding: 10px 12px">
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px">
                  <span>Warm processes</span><span>3 / 5</span>
                </div>
                <progress value="3" max="5"></progress>
              </div>
            </div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--background-modifier-border); padding: 10px 0 14px; font-size: 10px; text-align: center; color: var(--text-muted)">
          <span>Home</span>
          <span>Search</span>
          <span>Inbox</span>
          <span style="color: var(--text-normal); font-weight: 700">Me</span>
        </div>
      </div>
    </div>

    <div>
      <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin: 0 0 8px; letter-spacing: 0.04em">E · THEME / BRANDING</div>
      <div style="width: 260px; border: 2px solid var(--background-modifier-border); border-radius: 28px; overflow: hidden; background: var(--background-primary); display: flex; flex-direction: column; min-height: 520px">
        <div style="display: flex; justify-content: space-between; padding: 10px 18px 4px; font-size: 11px; color: var(--text-muted)">
          <span>9:41</span>
          <span>5G · 81%</span>
        </div>
        <div style="padding: 8px 16px; display: flex; justify-content: space-between; font-size: 13px">
          <span style="color: var(--text-muted)">‹ Settings</span>
          <span style="font-weight: 600">Theme</span>
          <span style="color: var(--text-muted)"> </span>
        </div>
        <div style="margin: 4px 16px 12px; padding: 14px 12px; border: 1px dashed var(--background-modifier-border); border-radius: 14px; text-align: center">
          <div style="width: 40px; height: 40px; margin: 0 auto 8px; border-radius: 12px; background: var(--interactive-accent)"></div>
          <div style="font-size: 22px; font-weight: 800; letter-spacing: 0.08em">DEAN</div>
          <div style="font-size: 11px; color: var(--text-muted)">Vault collaborator</div>
        </div>
        <div style="padding: 0 16px; display: grid; gap: 12px; flex: 1">
          <div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px">Appearance</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px; text-align: center">
              <div style="padding: 8px 4px; border-radius: 10px; border: 1px solid var(--interactive-accent)">System</div>
              <div style="padding: 8px 4px; border-radius: 10px; border: 1px dashed var(--background-modifier-border); color: var(--text-muted)">Light</div>
              <div style="padding: 8px 4px; border-radius: 10px; border: 1px dashed var(--background-modifier-border); background: var(--background-secondary); color: var(--text-muted)">Dark</div>
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px">Accent</div>
            <div style="display: flex; gap: 8px; align-items: center">
              <span style="width: 22px; height: 22px; border-radius: 99px; background: var(--interactive-accent); border: 2px solid var(--text-normal)"></span>
              <span style="width: 22px; height: 22px; border-radius: 99px; background: var(--text-muted)"></span>
              <span style="width: 22px; height: 22px; border-radius: 99px; background: var(--text-error)"></span>
              <span style="font-size: 11px; color: var(--text-faint)">Match vault</span>
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px">Lockup</div>
            <div style="display: grid; gap: 6px">
              <div style="padding: 8px 10px; border: 1px solid var(--background-modifier-border); border-radius: 10px; font-size: 12px">Mark + wordmark</div>
              <div style="padding: 8px 10px; border: 1px dashed var(--background-modifier-border); border-radius: 10px; font-size: 12px; color: var(--text-muted)">Wordmark only</div>
            </div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--background-modifier-border); padding: 10px 0 14px; font-size: 10px; text-align: center; color: var(--text-muted)">
          <span>Home</span>
          <span>Search</span>
          <span>Inbox</span>
          <span style="color: var(--text-normal); font-weight: 700">Me</span>
        </div>
      </div>
    </div>

  </div>

  <table>
    <caption style="caption-side: top; text-align: left; padding: 0 0 6px; color: var(--text-muted); font-size: 12px">Draft notes</caption>
    <thead>
      <tr>
        <th>Screen</th>
        <th>Job</th>
        <th>Open question</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Home</td>
        <td>Resume last note</td>
        <td>Pin vs recents first?</td>
      </tr>
      <tr>
        <td>Detail</td>
        <td>Read, then continue in Dean</td>
        <td>Continue sends Act or opens chat?</td>
      </tr>
      <tr>
        <td>Composer</td>
        <td>Capture into the vault</td>
        <td>Tags on first save or later?</td>
      </tr>
      <tr>
        <td>Settings</td>
        <td>Rare, keep shallow</td>
        <td>Hide provider keys on mobile?</td>
      </tr>
      <tr>
        <td>Theme</td>
        <td>First-run look and lockup</td>
        <td>Follow vault theme or ship a Dean brand?</td>
      </tr>
    </tbody>
  </table>
</div>
```
## Theme and branding

The Theme phone is a wireframe. Use this Collect form to pick the real direction. **Apply branding direction** sends the answers on this conversation.

```dean-session
schemaVersion: 1
id: theme-branding
kind: collect
title: Theme and branding
status: open
createdAt: 1787505600000
conversationId: conv-1787504478385-jpj8wt3jd
epoch: 0
actions:
  - id: continue
    label: Apply branding direction
    prompt: Continue the mobile layout drafts using the submitted theme and branding answers already present in this turn. Update the Theme screen wireframe and the draft-notes table to match those choices.
questions:
  - id: appearance
    prompt: Default appearance on mobile?
    type: single
    options:
      - id: system
        label: Follow system
      - id: light
        label: Light
      - id: dark
        label: Dark
  - id: accent
    prompt: Accent treatment?
    type: single
    options:
      - id: vault
        label: Match the Obsidian vault theme
      - id: dean
        label: Dean accent, independent of vault
      - id: custom
        label: Fixed brand color
  - id: wordmark
    prompt: How should the wordmark appear?
    type: single
    options:
      - id: mark-word
        label: Mark plus wordmark
      - id: word
        label: Wordmark only
      - id: mark
        label: Mark only on small chrome
  - id: surfaces
    prompt: Where must branding stay consistent?
    type: multi
    options:
      - id: launch
        label: Launch and empty states
      - id: nav
        label: Bottom navigation
      - id: chat
        label: Dean chat chrome
      - id: artifacts
        label: In-note artifacts
  - id: notes
    prompt: Brand constraints or colors to respect
    type: markdown
answers:
  appearance: light
  wordmark: mark-word
```
