# Golem: The Word Workshop

A framework-free browser prototype for exploring Golem's square-block world and pairwise word combinations.

## Run locally

Open `index.html` in a current browser. There is no build step, package install, or external dependency. For a local browser session, serve this directory on loopback:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/`.

## Current interaction draft

- The map starts with two square blocks for each word listed in Issue #5. It lays out more candidate grid cells than blocks, randomly fills safe cells in the forest clearing, and leaves the remaining cells empty; reset reshuffles the map.
- The shared clay sprite is tinted on an offscreen copy, so color filters affect its opaque pixels while preserving transparent edges and shading. In-world words use Atkinson Hyperlegible Next; page headings use Creepster.
- Drag a square onto another to compose a recognized expression. The target remains in place; the dropped square is consumed. Exact target-then-dropped construction order is retained even when the square face uses a normalized reading; the proposed double-negation simplification reduces back to the elemental `RIGHT`.
- Clay can also be dropped into any open part of the forest clearing without combining; drops outside the safe clearing or on another square snap to the nearest available safe position.
- The draft recognizes NOT + RED; provisional RGB channel unions (red + green → yellow, red + blue → magenta, green + blue → cyan, then any full RGB union → white); DO + RED → be red; NOT + HAND → FIST; HAND + HAND → COMBINE; provisional NOT + FIST → HAND; RIGHT + NOT → LEFT; and a second NOT over LEFT → RIGHT. LEFT/RIGHT hands and fists can be formed. The direction and hand rules are proposals; UP + NOT remains unimplemented.
- EYE can combine with color, block, or direction filters. WHILE can combine with HAND, FIST, FIT, or a filtered sight expression; for example, `(WHILE + (EYE + (NOT + RED)))` reads “while seeing clay that does not contain red pigment.”
- DO can form the suggested HAND, FIST, RED, EYE, COMBINE, and directed hand/fist action phrases. The owner-requested prototype example also allows FEET + LEFT → LEFT FEET, then DO + LEFT FEET → MOVE LEFT. That specific unconditioned action moves its square slowly left, keeps attempting when blocked, and is visibly marked as active. This behavior is provisional and does not settle movement rules generally. Adding NOT to the eye action or using DO + (NOT + EYE) forms a close-eyes phrase. AND/OR can join two distinct WHILE sense expressions. IN + ME forms an internal-content query expression. A sense expression paired with a DO action is labeled GOLEM.
- A 64px mini-golem sprite is used as a visual state for recognized WHILE sense expressions, DO motive expressions, and complete GOLEM expressions. The lowercase expression stays over the forehead, the face remains inside the same square, and an expression's color intent tints the sprite. This is a visual exploration; it does not add WHILE sensing, DO execution, or activation behavior.
- Select a square to inspect its exact construction and natural-language layer. Filler labels such as “entity” and “compound” are omitted.

## Prototype boundary and open rules

The added combinations are provisional readings of Designer suggestions. Only the explicitly owner-requested `DO + LEFT FEET` example executes: its square moves left as an always-attempting default action. Other DO actions, WHILE sensing, pattern matching, close-eyes behavior, structural inspection, and FIT are not simulated. It also does not implement SPLIT/undo, because history behavior remains unresolved. AND/OR and other direction readings are composition-only; no sensor evaluates them. The directed RGB color recipes are represented as expressions and tinted with the shared clay sprite; they do not execute a golem action or settle activation. New unpigmented blocks use a dark gray tint. All world word faces and construction-tree words render in lowercase. The square-block construction order remains visible in the inspector.

The map, fixed-size squares, compact lowercase face text, dark gray unpigmented clay, RGB-derived color states, shared clay silhouette, and detail panel follow the current Artist direction. The mini-golem sprite and its forehead word placement are a visual implementation exploration, not final art approval. The left-movement example remains an owner-directed exploration; movement rules remain open for further design discussion.
