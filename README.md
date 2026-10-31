# Golem: The Word Workshop

A private, framework-free browser prototype draft for exploring the Artist's square-block world and the Designer's suggested expressions. This folder is not the GitHub checkout; its code is local and has not been committed, deployed, or tested.

## Run locally

Open `index.html` in a current browser. There is no build step, package install, or external dependency. For a local browser session, serve this directory on loopback:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/`.

## Current interaction draft

- The map starts with two square blocks for each word listed in Issue #5. Starting positions are shuffled; reset reshuffles the map.
- Drag a square onto another to compose a recognized expression. The target remains in place; the dropped square is consumed. Exact target-then-dropped construction order is retained even when the square face uses a normalized reading; the proposed double-negation simplification reduces back to the elemental `RIGHT`.
- The draft recognizes NOT + RED; provisional RGB channel unions (red + green → yellow, red + blue → magenta, green + blue → cyan, then any full RGB union → white); DO + RED → be red; NOT + HAND → FIST; HAND + HAND → COMBINE; provisional NOT + FIST → HAND; RIGHT + NOT → LEFT; and a second NOT over LEFT → RIGHT. LEFT/RIGHT hands and fists can be formed. The direction and hand rules are proposals; UP + NOT remains unimplemented.
- EYE can combine with color, block, or direction filters. WHILE can combine with HAND, FIST, FIT, or a filtered sight expression; for example, `(WHILE + (EYE + (NOT + RED)))` reads “while seeing clay that does not contain red pigment.”
- DO can form the suggested HAND, FIST, RED, EYE, COMBINE, and directed hand/fist action phrases. Adding NOT to the eye action or using DO + (NOT + EYE) forms a close-eyes phrase. AND/OR can join two distinct WHILE sense expressions. IN + ME forms an internal-content query expression. A sense expression paired with a DO action is labeled GOLEM.
- Select a square to inspect its exact construction and natural-language layer. Filler labels such as “entity” and “compound” are omitted.

## Prototype boundary and open rules

The added combinations are provisional readings of Designer suggestions. The draft does not execute DO actions, activate WHILE, match a pattern against blocks, close eyes at runtime, move the golem, inspect internal contents, or evaluate FIT. It also does not implement SPLIT/undo, because history behavior remains unresolved. AND/OR and direction readings are composition-only; no sensor evaluates them. The directed RGB color recipes are represented as expressions and tinted with the shared clay sprite; they do not execute a golem action or settle activation. New unpigmented blocks use a dark gray tint. All world word faces and construction-tree words render in lowercase. The square-block construction order remains visible in the inspector.

The map, fixed-size squares, compact lowercase face text, dark gray unpigmented clay, RGB-derived color states, shared clay silhouette, and detail panel follow the current Artist direction. Visual response for an active golem remains open. No tests or browser checks have been run on this private draft. Any public code update still needs Broadcaster screening.
