# Diagrams

Seven scenes, each written twice: an `.excalidraw` file to edit and an `.svg` to
look at. Both are generated — `scenes.mjs` is the source of truth.

| Scene               | Level | Shows                                                                     |
| ------------------- | ----- | ------------------------------------------------------------------------- |
| `01-system`         | High  | Repo → build → Pages → Worker → Spotify, and where the secrets are        |
| `02-now-playing`    | Code  | The Worker's fetch path, the token cache, `lastGood`, and the client poll |
| `03-motion`         | Code  | The duration scale, the three gates, and the two pointer scripts          |
| `04-content`        | Code  | Collections in, routes out, and the two flags that gate rendering         |
| `05-testing`        | Code  | The four suites, the shared harness, and what each one covers             |
| `06-client-runtime` | Code  | Every module that runs in the browser and what it is allowed to touch     |
| `07-excalidraw`     | High  | Excalidraw itself: the component/application line, and where the key goes |

## Reading them

The `.svg` files render in the architecture doc, in a pull request and on
GitHub. Nothing to install.

## Editing them

Small moves — nudging a box, adding a note — are easiest at
[excalidraw.com](https://excalidraw.com):

1. **File → Open** and pick the `.excalidraw` file.
2. Edit. Boxes carry their labels and arrows stay bound to both ends, so
   dragging a box takes its arrows with it.
3. **File → Save to…** back over the same path.

Anything structural should go into `scenes.mjs` instead, because the next
`npm run diagrams` overwrites both files:

```sh
npm run diagrams
```

The generator's seeds are counted rather than randomised, so regenerating an
unchanged scene produces a byte-identical file and leaves no diff.

## Why both formats

The `.excalidraw` scene is the editable original and keeps the bindings. The
`.svg` is what anyone reading the documentation actually sees, and it means a
diagram going stale is visible in the diff rather than hidden inside JSON.

The `.excalidraw` files are written minified — one line each. They are machine
output handed to an editor, not something anyone reads as text, and
pretty-printing the six of them cost 7,667 lines of committed whitespace and
turned every regeneration into a thousand-line diff. The `.svg` is the
reviewable artifact.

## The Excalidraw scene format

`build.mjs` writes this format directly rather than driving an editor, so what
follows is what it has to get right — the subset these scenes use.
[`docs/excalidraw.md`](../excalidraw.md) covers the tool itself: the element
model behind this format, the component API, and how its collaboration is
encrypted. Excalidraw's own documentation is at
[docs.excalidraw.com](https://docs.excalidraw.com).

### The envelope

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "…",
  "elements": [],
  "appState": { "gridSize": null, "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

`elements` is a flat array — there is no tree. Nesting is expressed by ids
pointing at each other, which is the one thing about the format that shapes the
generator's design.

### Fields every element carries

`id`, `type`, `x`, `y`, `width`, `height`, `angle`, `strokeColor`,
`backgroundColor`, `fillStyle`, `strokeWidth`, `strokeStyle`, `roughness`,
`opacity`, `groupIds`, `frameId`, `roundness`, `seed`, `version`,
`versionNonce`, `isDeleted`, `boundElements`, `updated`, `link`, `locked`.

The editor rejects a scene that omits them, so `base()` in `build.mjs` supplies
the lot and each helper overrides only what differs. Two are worth knowing:

- **`seed`** drives the hand-drawn jitter. The same seed redraws the same wobble,
  which is why these are counted rather than randomised — a regenerated scene is
  then byte-identical when nothing about it changed.
- **`roughness`** is 0 (architect), 1 (artist) or 2 (cartoonist). These use 1.

### The three element types these scenes use

**`rectangle`** — `x`, `y`, `width`, `height`, plus `roundness: { type: 3 }`
for rounded corners. `roundness: null` is a hard corner.

**`text`** — carries both `text` and `originalText`, plus `fontSize`,
`fontFamily` (1 hand-drawn, 2 normal, 3 monospace), `textAlign`,
`verticalAlign` and `lineHeight`. A text element is either standalone, with
`containerId: null` and `autoResize: true`, or bound inside a shape, with
`containerId` set to that shape's id and `autoResize: false` so the editor
keeps it inside. `width` and `height` must be supplied either way — the format
stores measured geometry rather than computing it, so `build.mjs` estimates
advance width at 0.58 em per character for the hand-drawn face.

**`arrow`** — `x`, `y` are the start point and `points` is an array of
`[dx, dy]` offsets _from_ that origin, always beginning `[0, 0]`. `startBinding`
and `endBinding` each hold `{ elementId, focus, gap }`, and the bound shapes
must list the arrow back in their own `boundElements` — the binding is stored on
both sides, and an arrow bound on one side only stops following when the shape
is dragged.

### The relationship that catches people out

A labelled box is **two** elements, not one:

```
rectangle  id=A   boundElements: [{ id: B, type: 'text' }]
text       id=B   containerId: A
```

Both must be present in `elements`, and both must point at each other. This is
why `box()` returns the container with its label attached as `__label` and
`flat()` expands the pair just before serialisation: the helper can hand back a
single object for arrows to bind to, while the file still gets two.

Arrows add to the same `boundElements` array, so a box that is both labelled and
connected carries a text entry and one arrow entry per connection.
