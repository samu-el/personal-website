# Diagrams

Six scenes, each written twice: an `.excalidraw` file to edit and an `.svg` to
look at. Both are generated — `scenes.mjs` is the source of truth.

| Scene               | Level | Shows                                                                     |
| ------------------- | ----- | ------------------------------------------------------------------------- |
| `01-system`         | High  | Repo → build → Pages → Worker → Spotify, and where the secrets are        |
| `02-now-playing`    | Code  | The Worker's fetch path, the token cache, `lastGood`, and the client poll |
| `03-motion`         | Code  | The duration scale, the three gates, and the two pointer scripts          |
| `04-content`        | Code  | Collections in, routes out, and the two flags that gate rendering         |
| `05-testing`        | Code  | The four suites, the shared harness, and what each one covers             |
| `06-client-runtime` | Code  | Every module that runs in the browser and what it is allowed to touch     |

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
