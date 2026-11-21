# To-Do App: Design Spec

## 1. Purpose and scope

This is a single-page to-do app for keeping a short personal list. A user can **add** a task, mark it **complete** or active again, **edit** its text inline, and **delete** it. The list can be **filtered** to All, Active or Done, and every completed task can be removed at once with **Clear completed**. Tasks are saved to `localStorage` and are restored on reload. The app has no accounts, no sync, no due dates, no priorities and no drag-to-reorder.

**Data model** (one task):

| Field       | Type    | Notes                                             |
|-------------|---------|---------------------------------------------------|
| `id`        | string  | Unique, e.g. `crypto.randomUUID()` or timestamp   |
| `text`      | string  | Trimmed, 1–200 characters                         |
| `done`      | boolean | `false` on creation                               |
| `createdAt` | number  | `Date.now()` on creation                          |

- Storage key: `todo-app.tasks`, which holds a JSON array of tasks, newest last. The list shows tasks in that order, oldest first.
- Storage key: `todo-app.filter`, which holds `"all" | "active" | "done"`. The default is `"all"`.
- Save after every change. If the stored data is missing or cannot be parsed, start with an empty list and do not show an error.
- Wrap every `localStorage` read and write in try/catch. If storage is unavailable, the app still works for the current session.

---

## 2. Screens and states

The app is one screen. A centered column is at most **560px** wide on a page background. Everything except the page title sits on a single **card**.

### 2.1 Main screen (tasks exist)

Layout from top to bottom:

```
+------------------------------------------------------+
|                                                      |
|   Tasks                                   (header)   |
|   3 active · 2 done                       (subtitle) |
|                                                      |
| +--------------------------------------------------+ |
| | [ What needs to be done?               ] [ Add ] | |  input row
| +--------------------------------------------------+ |
| | (o)  Buy milk                                [x] | |  task (active)
| |--------------------------------------------------| |
| | (✓)  ~~Call the plumber~~                    [x] | |  task (done)
| |--------------------------------------------------| |
| | (o)  Write design spec                       [x] | |  task (hover: x visible)
| |--------------------------------------------------| |
| |  [ All ]  Active   Done          Clear completed | |  filter bar + clear
| +--------------------------------------------------+ |
|                                                      |
|   3 items left                            (footer)   |
|   Double-click a task to edit                        |
+------------------------------------------------------+
```

- The header sits above the card on the page background.
- The card holds three parts in order: the input row, the task list, then the filter bar.
- The footer sits below the card and shows the counter and a short hint.

### 2.2 Empty state: no tasks at all

The task list and filter bar are hidden. The card shows the input row and an empty-state panel. The input has autofocus.

```
+--------------------------------------------------+
| [ What needs to be done?               ] [ Add ] |
|--------------------------------------------------|
|                                                  |
|                    ( ✓ )                         |  48px muted check-circle icon
|               Nothing to do yet                  |  16px / 600
|      Add your first task above to get started.   |  14px muted
|                                                  |
+--------------------------------------------------+
   0 items left
```

### 2.3 Empty state: the filter matches nothing

Tasks exist, but the current filter shows none of them. Keep the filter bar visible so the user can switch filters. In place of the list, show a single line of muted text, centered, with 32px of vertical padding:

- Active filter, every task done: **"All done. Nice work."**
- Done filter, no task done: **"No completed tasks yet."**

```
+--------------------------------------------------+
| [ What needs to be done?               ] [ Add ] |
|--------------------------------------------------|
|              All done. Nice work.                |
|--------------------------------------------------|
|   All  [ Active ]  Done          Clear completed |
+--------------------------------------------------+
```

### 2.4 Inline edit state

A task enters edit mode when the user double-clicks its text, presses **Enter** or **F2** while the task row has focus, or clicks the pencil button on touch devices (see 3.3). The text becomes a text input filled with the current text. All of the text is selected. The checkbox and delete button are hidden while editing. Only one task can be in edit mode at a time.

```
| (o)  Buy milk                                [x] |
|--------------------------------------------------|
|      [ Call the plumber|                     ]   |  <- editing: input fills row,
|--------------------------------------------------|     accent border + focus ring
| (o)  Write design spec                       [x] |
```

- **Enter** or **blur** saves the new text, trimmed. If the trimmed text is empty, the task is **deleted**.
- **Escape** cancels the edit, restores the original text, and returns focus to the task row.

### 2.5 Input validation state

Pressing Add or Enter with empty or whitespace-only input does nothing. Do not show an error or shake the field. Keep focus in the input. The **Add** button is disabled (`aria-disabled="true"`, 50% opacity) while the trimmed input is empty. Input is capped at 200 characters with `maxlength="200"`.

---

## 3. Components

### 3.1 Header

- **Title:** "Tasks", an `<h1>` in the 28px/700 type style.
- **Subtitle:** "`{active}` active · `{done}` done" in 14px muted text. When the list is empty, the subtitle reads "No tasks".
- Padding: 32px top and 16px bottom on desktop; 24px top on screens under 480px wide.

### 3.2 Input row

- A `<form>` holding a text input and an **Add** button in a row with an 8px gap. The input takes the remaining width (`flex: 1`).
- Input: placeholder "What needs to be done?", 44px tall, 12px horizontal padding, 1px `--border`, radius `--radius-md`. The input has a visually hidden `<label>` "New task".
- Add button: 44px tall, 16px horizontal padding, `--accent` background, `--on-accent` text, 15px/600, radius `--radius-md`.
- Row padding: 16px. A 1px `--border` line below separates it from the list.
- **Behavior:**
  - **Enter** or clicking **Add** adds the trimmed text as a new task at the end of the list, clears the input, and keeps focus in the input.
  - If the filter is **Done** when a task is added, switch it to **All** so the new task is visible.
  - **Escape** in the input clears it.
- **States:**
  - Input hover: border becomes `--border-strong`.
  - Input focus: border becomes `--accent` and the focus ring appears (see 4.6).
  - Button hover: background becomes `--accent-hover`.
  - Button active: `transform: scale(0.98)`.
  - Button disabled: opacity 0.5, `cursor: not-allowed`, no hover change.

### 3.3 Task item

Each task is an `<li>` with a minimum height of 52px. It holds a row of three parts: a checkbox, the task text, and a delete button. Padding is 12px vertical and 16px horizontal, with a 12px gap. Items are separated by a 1px `--border` line; the last item has none.

- **Checkbox:** a native `<input type="checkbox">` that is visually replaced by a 22px circle.
  - Unchecked: a 2px `--text-muted` ring with a transparent fill. On hover the ring becomes `--success`.
  - Checked: `--success` fill with a white check mark (a 12px SVG stroke).
  - The hit area is 44×44px, made with padding or negative margin around the 22px circle.
  - Accessible name: "Mark '`{text}`' as done" when unchecked, or "Mark '`{text}`' as not done" when checked.
  - Clicking it or pressing Space toggles `done`.
- **Text:** a `<span>` in 16px/400 `--text` that fills the remaining space (`flex: 1`).
  - Long words break with `overflow-wrap: anywhere`, and the text can wrap to several lines.
  - Done tasks: color changes to `--text-muted` with `text-decoration: line-through`. The color fades over 150ms.
  - Double-click enters edit mode (see 2.4).
  - Use `user-select: none` only while a double-click is in progress, so the double-click does not select a word. Otherwise text stays selectable.
- **Delete button:** a 32×32px icon button showing an "×" or trash SVG at 18px, with `--text-muted` color and `aria-label="Delete '{text}'"`. The hit area is expanded to 44px.
  - On pointer devices (`@media (hover: hover)`), the button has opacity 0 and becomes 1 when the row is hovered or when the row or anything in it has focus (`:hover`, `:focus-within`).
  - On touch devices it is always visible.
  - Button hover: color becomes `--danger` and the background becomes `--danger-soft`, with radius `--radius-sm`.
  - Clicking it deletes the task right away, with no confirmation dialog. Focus moves to the next task's checkbox, or the previous task's checkbox if there is no next one, or the new-task input if the list is now empty.
- **Edit button (touch only):** on `@media (hover: none)`, a pencil icon button appears before the delete button, styled the same as delete but with `--accent` on hover. It has `aria-label="Edit '{text}'"`. On pointer devices it is hidden, and double-click is used instead.
- **Row states:**
  - Hover: background `--surface-hover`.
  - Edit mode: the row background stays `--surface`. The edit input fills the row with 44px height, a 1px `--accent` border and the focus ring, and is indented by 34px so it lines up with the text column. The edit input has `aria-label="Edit task"`.
  - New item: fades in from opacity 0 and translateY(-4px) over 150ms.
  - Removed item: fades out to opacity 0 over 120ms, then is removed from the DOM. If reduced motion is on, the item is removed immediately.
- **Keyboard on a focused row:** the row's `<li>` itself is not focusable; focus lands on the checkbox and the buttons. Pressing **Enter** or **F2** while the checkbox has focus enters edit mode. **Delete** or **Backspace** while the checkbox has focus deletes the task.

### 3.4 Filter bar

The filter bar sits at the bottom of the card, separated by a 1px `--border` line above it. It has 8px vertical and 12px horizontal padding. It contains a group of filter buttons on the left and **Clear completed** pushed to the right.

- **Filters:** three buttons, **All**, **Active** and **Done**, in a `role="group"` with `aria-label="Filter tasks"`. Each button has `aria-pressed` set to `true` or `false`.
  - Size: 32px tall, 12px horizontal padding, 14px/500, radius `--radius-sm`.
  - Inactive: transparent background with `--text-muted` text. On hover, the text becomes `--text` and the background `--surface-hover`.
  - Active: `--accent-soft` background with `--accent-text` text at weight 600.
  - Selecting a filter updates the list immediately and saves the choice to `todo-app.filter`.
- **Clear completed:** a text button, 32px tall, 14px/500 in `--text-muted`. On hover the text becomes `--danger` and is underlined. It appears only when at least one task is done; when none are, keep its space with `visibility: hidden` so the layout does not shift. Clicking it removes all done tasks. If focus was on the button, move focus to the new-task input.
- Shown only when at least one task exists.

### 3.5 Footer counter

Below the card, with 12px top margin and centered on mobile (left-aligned with the card on wider screens):

- **Counter:** "`{n}` item left" when n = 1, otherwise "`{n}` items left", where n is the number of active tasks. 14px `--text-muted`. Mark it `aria-live="polite"` so changes are announced.
- **Hint:** "Double-click a task to edit" in 12px `--text-muted`. On touch devices it reads "Tap the pencil to edit". The hint is shown only when tasks exist.

---

## 4. Visual style

### 4.1 Color tokens

Define these as CSS custom properties on `:root`. Dark mode applies via `@media (prefers-color-scheme: dark)`. There is no manual theme toggle.

| Token            | Light       | Dark        | Use                                      |
|------------------|-------------|-------------|------------------------------------------|
| `--bg`           | `#F6F7F9`   | `#0F1115`   | Page background                          |
| `--surface`      | `#FFFFFF`   | `#181B21`   | Card, inputs                             |
| `--surface-hover`| `#F1F3F5`   | `#20242B`   | Row / button hover                       |
| `--border`       | `#E3E6EA`   | `#2A2F37`   | Dividers, input border                   |
| `--border-strong`| `#C4CAD1`   | `#3E4550`   | Input hover border                       |
| `--text`         | `#1F2328`   | `#E6E8EB`   | Primary text                             |
| `--text-muted`   | `#5F6B76`   | `#9BA3AE`   | Secondary text, done tasks, icons        |
| `--accent`       | `#2563EB`   | `#60A5FA`   | Add button, focus, active edit border    |
| `--accent-hover` | `#1D4ED8`   | `#93C5FD`   | Add button hover                         |
| `--on-accent`    | `#FFFFFF`   | `#0B1220`   | Text on accent                           |
| `--accent-soft`  | `#E8EFFD`   | `#1B2A44`   | Active filter background                 |
| `--accent-text`  | `#1D4ED8`   | `#93C5FD`   | Active filter text                       |
| `--success`      | `#16A34A`   | `#22C55E`   | Checked checkbox fill                    |
| `--danger`       | `#C62828`   | `#F87171`   | Delete / clear hover                     |
| `--danger-soft`  | `#FDECEC`   | `#3A1D1F`   | Delete button hover background           |
| `--focus-ring`   | `#2563EB66` | `#60A5FA80` | Focus ring (with alpha)                  |

- Set `color-scheme: light dark` on `:root` so native controls follow the theme.
- `body` uses `background: var(--bg)` and `color: var(--text)`.
- The check mark on `--success` is white in light mode and `#0B1220` in dark mode.

### 4.2 Typography

- **Font stack:** `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Base:** 16px. Line height is 1.5 for body text and 1.2 for headings.

| Style        | Size | Weight | Use                         |
|--------------|------|--------|-----------------------------|
| Title        | 28px | 700    | "Tasks" (letter-spacing -0.01em) |
| Body         | 16px | 400    | Task text, inputs           |
| Button       | 15px | 600    | Add button                  |
| Small        | 14px | 500    | Filters, clear, subtitle (400), counter (400) |
| Caption      | 12px | 400    | Footer hint                 |
| Empty title  | 16px | 600    | Empty-state heading         |

- Inputs inherit the font (`font: inherit`) and are at least 16px, so iOS does not zoom in on focus.
- Use `font-variant-numeric: tabular-nums` on the counter and subtitle.

### 4.3 Spacing scale

The base unit is 4px. Use only these values: **4, 8, 12, 16, 24, 32, 48**.

- Page side gutter: 16px under 480px wide, 24px above.
- Card inner padding: 16px for the input row; 12px × 16px for task rows.
- Gap between controls: 8px. Gap inside a row (checkbox–text–button): 12px.

### 4.4 Corner radius

| Token          | Value | Use                                 |
|----------------|-------|-------------------------------------|
| `--radius-sm`  | 6px   | Filter buttons, icon button hover   |
| `--radius-md`  | 10px  | Inputs, Add button                  |
| `--radius-lg`  | 14px  | Card                                |
| (full)         | 50%   | Checkbox circle                     |

### 4.5 Shadows

| Token         | Light                                                     | Dark                              |
|---------------|-----------------------------------------------------------|-----------------------------------|
| `--shadow-card` | `0 1px 2px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.06)` | `0 1px 2px rgba(0,0,0,.4), 0 4px 12px rgba(0,0,0,.3)` |

- The card also has a 1px `--border` outline. Nothing else casts a shadow.

### 4.6 Focus ring

All interactive elements show a ring on `:focus-visible`: `outline: 2px solid var(--accent); outline-offset: 2px`. The inputs instead use `box-shadow: 0 0 0 3px var(--focus-ring)` together with an `--accent` border. Do not remove outlines unless a replacement is in place.

### 4.7 Motion

- Default transition: **150ms `ease-out`** on `background-color`, `color`, `border-color`, `opacity` and `transform`.
- Check mark: scales from 0.6 to 1 with an opacity fade over 150ms.
- Item enter: 150ms. Item exit: 120ms (see 3.3).
- Nothing animates longer than 200ms. There are no bounces and no layout animations of list height.
- `@media (prefers-reduced-motion: reduce)`: set every transition and animation to `0ms`.

---

## 5. Responsive and accessibility

### 5.1 Responsive

- **Minimum width: 360px.** At 360px the card is 328px wide (16px gutters). The input row stays on one line, and the Add button keeps its 16px padding.
- The page never scrolls horizontally. Long task text wraps (`overflow-wrap: anywhere`) and never truncates.
- **Under 400px wide:** the filter bar wraps if needed. The filter group stays on the first line, and Clear completed moves to its own line, right-aligned. Use `flex-wrap: wrap` with an 8px gap.
- **480px and wider:** 24px gutters, 48px top padding on the page, and the footer left-aligned.
- **Max width:** the column is capped at 560px and centered with `margin: 0 auto`.
- Every touch target is at least 44×44px, including the checkbox, delete, edit and Add controls. Filter buttons are 32px tall visually and have padding that extends their hit area to 44px.
- Set `<meta name="viewport" content="width=device-width, initial-scale=1">`.

### 5.2 Accessibility

- **Landmarks and structure:**
  - Use `<main>` for the app, with `<h1>` "Tasks".
  - The list is a `<ul aria-label="Tasks">`.
  - The filter bar is a `role="group"` (see 3.4).
- **Labels:**
  - The new-task input has a visually hidden `<label>`.
  - Each checkbox, delete button and edit button has an accessible name that includes the task text (see 3.3).
  - The edit input is labeled "Edit task".
- **Live updates:** a visually hidden `aria-live="polite"` region announces "Added '`{text}`'", "Deleted '`{text}`'", "Marked '`{text}`' done", "Marked '`{text}`' not done" and "Cleared `{n}` completed tasks". The footer counter is also polite (see 3.5).
- **Keyboard:**
  - Tab order runs: new-task input → Add → each task's checkbox → its edit button (touch only) → its delete button → filter buttons → Clear completed.
  - Shortcuts:
    - Enter in the new-task input adds a task.
    - Enter or F2 on a task's checkbox starts editing it.
    - Enter in the edit input saves.
    - Escape in the edit input cancels; Escape in the new-task input clears it.
    - Delete or Backspace on a task's checkbox deletes the task.
  - After edit or delete, focus moves as described in 2.4 and 3.3. Focus never lands on `<body>`.
- **Focus visibility:** use the ring from 4.6 on every interactive element, in both themes.
- **Contrast (WCAG AA):**
  - Body text against `--surface` is above 14:1 in both themes.
  - `--text-muted` against `--surface` is about 5.5:1 in light mode and 6.9:1 in dark mode, so done tasks and captions still pass 4.5:1.
  - White on `--accent` (light) is about 5.2:1; `#0B1220` on `--accent` (dark) is about 7.5:1.
  - `--danger` against `--surface` is above 4.5:1 in both themes.
  - Unchecked checkbox rings use `--text-muted`, so they clear the 3:1 minimum for non-text controls in both themes.
- **Not color alone:**
  - Done state uses both a check mark and line-through.
  - The active filter uses weight 600 and a background, as well as color.
- **Reduced motion:** honored (see 4.7).
- **Document:** `<html lang="en">`, and `<title>` "Tasks".
