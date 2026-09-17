# Inside Excalidraw

Background for [`docs/diagrams/`](./diagrams), which generates Excalidraw scenes
rather than drawing them. This is the tool those scenes are written for: what it
is, the element model its files and its multiplayer protocol are both built on,
the component API it publishes, and the encryption its collaboration rests on.

Written against the current `master` of
[github.com/excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) —
the element type definitions in `packages/element/src/types.ts`, the tool,
font and export constants in `packages/common/src/constants.ts`, the encryption
module in `packages/excalidraw/data/encryption.ts`, the shortcut list in
`packages/excalidraw/components/HelpDialog.tsx`, the room and share-link
handling in `excalidraw-app/data/index.ts`, the local persistence in
`excalidraw-app/data/LocalData.ts`, the component props and `UIOptions`
documentation, and the project README. The scene-file notes at the end come from
generating and round-tripping scenes here rather than from their source.

---

## An open-source canvas, published as a component

Excalidraw is an MIT-licensed virtual whiteboard with a deliberately hand-drawn
look. There are two things behind one name: a React component published as
`@excalidraw/excalidraw` that anyone can embed, and the hosted application at
excalidraw.com built on it, which adds real-time collaboration, end-to-end
encryption, a shape library, and offline use as a PWA that autosaves to the
browser.

The split matters when reading the source. Everything about _what a drawing is_
lives in the packages; everything about rooms, sharing links and persistence is
the application around them. The collaboration server is a separate project
again.

---

## What it actually gives you

The editor is one infinite canvas and a palette of eighteen tools, which
`TOOL_TYPE` enumerates: selection and lasso, the shapes (rectangle, diamond,
ellipse), arrow and line, freedraw, text, image, eraser, hand, frame and magic
frame, sticky note, embeddable, laser pointer, autoshape and bucket fill. Most
of them map to an element type; a few — hand, laser, eraser — are modes rather
than things that end up in the scene.

**Text is where the hand-drawn look is decided.** The bundled families are
Excalifont (the default), Virgil, Nunito, Lilita One, Comic Shanns, Helvetica,
Cascadia, Liberation Sans and Assistant, each with a generic fallback. Choosing
one is choosing how finished the drawing looks, which is why the sketch
families lead.

**Dark mode is a filter, not a second palette.** The dark theme applies
`invert(93%) hue-rotate(180deg)` across the canvas. That is worth knowing
before you fight it: every stroke colour a scene stores is a light-theme colour,
and the dark rendering is derived. It also explains why the aesthetic survives
theming at all — there is no second set of hand-drawn tokens to keep in step.

**Export** covers `application/vnd.excalidraw+json` for the scene itself,
`image/svg+xml` and `image/png` for pictures, with JPEG, GIF and WebP available
through the same path. The JSON is the only lossless one; the rest are
renderings.

**The library** is the shape-reuse system, and it is the sidebar's default tab.
It docks beside the canvas above a `dockedSidebarBreakpoint` width and overlays
below it, which is the whole of its responsive behaviour.

**What the component gives you versus what the hosted app adds** is visible in
`UIOptions`. The component's canvas actions are local: background colour, clear
canvas, load scene, save to the current file, theme toggle, save as image. The
shareable-link button appears _only_ when a host passes an `onExportToBackend`
callback — so sharing, rooms and the persistence behind them are the
application's, not the component's. Real-time collaboration, end-to-end
encrypted sessions, read-only links, local-first autosave to the browser and
offline use as a PWA all sit on that side of the line.

---

## The keyboard is the interface

Every tool has both a letter and a digit — `V`/`1` selection, `R`/`2`
rectangle, `D`/`3` diamond, `O`/`4` ellipse, `A`/`5` arrow, `L`/`6` line,
`P`/`7` freedraw, `T`/`8` text, `9` image, `E`/`0` eraser — plus `H` hand, `N`
sticky note, `F` frame, `K` laser, `B` bucket fill, `I` eye dropper, `Q` lock.
Two mental models for the same palette: reach with the drawing hand, or run
along the number row.

A few carry more than convenience:

| Keys                     | What it does                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `Tab` / `Shift+Tab`      | Converts the selected element to another type in place. Rectangle to diamond to ellipse without redrawing.   |
| `Ctrl/Cmd` while drawing | Prevents binding — the escape hatch from the arrow-binding model below, when you want a line that stays put. |
| `Ctrl/Cmd` + arrow       | Creates a flowchart node from the selection; `Alt` + arrow walks between them.                               |
| `Ctrl/Cmd` + click       | Deep-selects into a group; `Ctrl/Cmd` + drag deep box-selects.                                               |
| `Alt` + drag             | Duplicates rather than moves. `Ctrl/Cmd+D` does the same without the mouse.                                  |
| `A` then three clicks    | Draws a curved arrow; `L` and three clicks a curved line.                                                    |

The rest is what you would expect and worth knowing exists: zoom (`Ctrl/Cmd`
`+`/`-`/`0`, `Shift+1` to fit, `Shift+2` to selection), z-order (`Ctrl/Cmd+[`
and `]`, with `Shift` or `Alt` for all the way), alignment (`Ctrl/Cmd+Shift`
plus an arrow), grouping (`Ctrl/Cmd+G`), flipping (`Shift+H`, `Shift+V`), style
copy and paste (`Ctrl/Cmd+Alt+C` and `V`), zen mode (`Alt+Z`), view mode
(`Alt+R`), theme (`Alt+Shift+D`) and grid (`Ctrl/Cmd+'`). The application's own
`?` dialog is the authoritative list.

---

## How sharing actually works

This is where "end-to-end encrypted" stops being a claim and becomes a
mechanism, and it is simpler than it sounds.

**A collaboration link is `#room=<roomId>,<roomKey>`.** Both are generated in
the browser — the id from random bytes, the key separately, validated on parse
as exactly 22 characters. Both live in the URL **fragment**, and a fragment is
never sent to the server. So the room server routes traffic for an id it can
see and relays payloads it cannot read; the key travels only in the link you
hand someone, through whatever channel you chose.

Scene updates go over a WebSocket as element batches, with a filter first:
invisibly small elements and recently-deleted ones are excluded rather than
synced, so the wire carries changes that mean something.

**A share link is `#json=<id>,<key>`** — the same shape for a different
purpose. The scene is compressed and encrypted client-side, uploaded, and the
backend returns an id; embedded files go to storage under
`/files/shareLinks/<id>` with a size cap. The result is a read-only snapshot,
and again the server holds ciphertext and an identifier while the key stays in
the fragment.

The two together explain the earlier note about `onExportToBackend`: the
component knows how to encrypt and serialise, and knows nothing about where
anything goes. A host that never passes that callback gets an editor with no
sharing at all — not a disabled button, an absent one.

---

## Where a drawing lives, and what does not exist

Excalidraw's persistence story is easiest to describe by what it leaves out.

**There are no accounts.** Nothing asks who you are, nothing is stored against
an identity, and there is no cross-device sync. Open the same drawing on a
laptop and a phone and you have two unrelated drawings unless you carried a
link between them. Excalidraw+ is a separate, paid product that adds the
server-side half; everything described here is the free application.

**A drawing lives in your browser.** The app writes non-deleted elements and a
filtered copy of the app state to `localStorage`, and binary files — pasted and
uploaded images — to IndexedDB, in a `files-db` / `files-store` pair, with the
shape library in its own store beside it. Saving is debounced rather than
per-keystroke, and skipped entirely while the tab is hidden or while a lock is
held during collaboration, so a background tab is not fighting an active one.

**The filtering matters more than it looks.** The app state written to disk has
had things removed — the collaboration username among them — so reopening a
tab does not silently restore identity or session state that belonged to a
moment rather than to the drawing. Unused files are swept after 24 hours by a
`lastRetrieved` stamp, so a scene that dropped an image stops carrying its
bytes around.

This is what "local-first" means concretely, and it is why the share links in
the previous section are the whole of the persistence-beyond-this-machine
story: there is no other copy on a server to fall back on.

---

## Everything is an element in a flat array

A scene is not a tree. It is an ordered array of elements, and every
relationship between them — a label inside a box, an arrow pinned to two shapes,
a shape inside a frame — is expressed by elements holding each other's `id`.
That single decision explains most of the format's surface area.

The element types fall into a few families:

- **Generic** — selection, rectangle, diamond, ellipse.
- **Linear** — line and arrow, which carry a point list rather than a size.
- **Text and containers** — text, sticky note, frame, magic frame.
- **Media** — image, iframe, embeddable.
- **Free draw** — the pen stroke.

All of them extend one base with the geometry (`x`, `y`, `width`, `height`,
`angle`), the styling (stroke and fill, opacity, roughness) and a set of
structural fields that are the interesting part:

| Field                       | What it carries                                                                                                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boundElements`             | What is attached to this element — the ids of its bound text and of every arrow that terminates on it. Held on the shape, pointing outward.                                                                                       |
| `containerId`               | Set on a _text_ element to name the shape it sits inside. The other half of the same relationship, pointing back. Both sides are stored.                                                                                          |
| `startBinding` `endBinding` | On an arrow: the element it is pinned to, the attachment point as normalised ratios rather than absolute coordinates, and a bind mode — `inside`, `orbit` or `skip`.                                                              |
| `version` `versionNonce`    | A sequential counter and a random value regenerated on every change. Together they let two clients that edited the same element independently agree on which edit wins, with no server umpire.                                    |
| `updated`                   | Epoch milliseconds of the last change.                                                                                                                                                                                            |
| `index`                     | A _fractional_ index kept in step with the array position. Inserting between two elements picks a value between theirs rather than renumbering, which is what makes concurrent reordering and undo survive a multiplayer session. |

**The consequence worth internalising.** A labelled box is two elements, not
one: a rectangle whose `boundElements` names a text, and a text whose
`containerId` names the rectangle. Write only one of them and the editor loads a
scene that looks right and stops behaving right — the label will not move with
the box. `box()` in `build.mjs` returns the container with its label attached as
`__label`, and `flat()` expands the pair just before serialisation, for exactly
this reason.

---

## The embedding API keeps elements and UI state apart

The component takes a scene in through `initialData` and hands control back
through an `excalidrawAPI` callback exposing methods such as `updateScene` and
`updateLibrary`. Changes come out through one callback:

```jsx
<Excalidraw
  initialData={{ elements, appState }}
  excalidrawAPI={(api) => { ref.current = api }}
  onChange={(elements, appState, files) => …}
  theme="dark"
  viewModeEnabled
/>
```

Three things come back, and the separation is the design: **elements** is the
drawing, **appState** is everything about the viewer rather than the drawing —
scroll position, zoom, current tool, selection — and **files** holds binary
assets keyed separately so they are not copied into every element that shows
them.

Host applications that need their own metadata put it in `customData` on an
element, which the editor carries around without interpreting.

---

## Collaboration is encrypted in the browser

The encryption is ordinary Web Crypto, which is the point — there is nothing
bespoke to get wrong. A key is generated as AES-GCM, extractable, and exported
as a JWK, from which the application takes the `k` value as its string form.
Each encryption generates a fresh 12-byte initialisation vector from
`crypto.getRandomValues()`, and the result is returned as the ciphertext buffer
alongside that IV.

GCM is chosen over a plain cipher mode deliberately: it authenticates as well as
encrypts, so a modified ciphertext fails to decrypt rather than decrypting to
something plausible. The input side is permissive — a string, a `Uint8Array`, a
`Blob` or a `File`, all normalised to an `ArrayBuffer` first — because the same
routine protects scene deltas and uploaded images alike.

Where the key goes is the other half, and it is in
[How sharing actually works](#how-sharing-actually-works): the URL fragment,
which the browser never sends to a server.

---

## Generating scenes without the editor

A `.excalidraw` file is the element array plus a thin envelope: a `type` of
`"excalidraw"`, a format `version`, a `source` string, the `appState` the scene
should open with, and a `files` map. Writing that JSON directly is a reasonable
way to keep diagrams in version control, and the editor opens the result with
**File → Open**.

Three things to know before doing it, learned by doing it here:

- **Every field is required.** The format stores state rather than computing it,
  so an element missing `groupIds` or `roundness` is rejected even though the
  value is empty. Supply a complete base and override what differs — which is
  what `base()` in `build.mjs` does.
- **Geometry is measured, not derived.** Text elements carry their own `width`
  and `height`; nothing lays them out. Generating text means estimating the
  advance width of the chosen face — 0.58 em per character for the hand-drawn
  one, here.
- **`seed` is not decoration.** It drives the hand-drawn jitter, so a stable
  seed redraws the same wobble. Deriving seeds deterministically rather than
  randomly is what lets a regenerated scene be byte-identical to the one already
  committed; otherwise every regeneration is a diff of nothing.

See [`docs/diagrams/README.md`](./diagrams/README.md) for the subset of the
format these scenes use, and how to round-trip one through excalidraw.com.
