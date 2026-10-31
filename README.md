# Golem: The Word Workshop

A framework-free browser prototype for exploring Golem's square-block world and pairwise word combinations.

## Run locally

Open `index.html` in a current browser. There is no build step, package install, or external dependency. For a local browser session, serve this directory on loopback:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/`.

## Current interaction draft

- The map starts with one square block for each base word listed in Issue #5. The blocks are randomized in the forest clearing with open space between them; reset reshuffles their positions. The endless bank remains the source for adding more copies.
- An endless bank above the map lists every base element. Drag an element into the clearing to copy it into the world without consuming its bank source; the base element is displayed as `eye`.
- The shared clay sprite is tinted on an offscreen copy, so color filters affect its opaque pixels while preserving transparent edges and shading. In-world words and page headings use Creepster; the detail panel keeps Atkinson Hyperlegible Next for longer reading.
- The 64px clay eye, open-hand, fist, feet, and supported direction-arrow sprites appear both in the matching world blocks and beside their base words in the element bank. Each square keeps its lowercase word over the sprite. The down-arrow asset stays unused because DOWN is not a current element.
- Drag a square onto another to compose a recognized expression. The target remains in place; the dropped square is consumed. Exact target-then-dropped construction order is retained even when the square face uses a normalized reading; the proposed double-negation simplification reduces back to the elemental `RIGHT`.
- Clay can be dropped at any continuous position whose center is inside the forest clearing, without snapping to grid cells. If a square would collide with another, the pointer-up handler searches for the nearest open position around it. There is no fixed clay-count limit; another square is rejected only when the continuous 2–4px clearing search finds no open position.
- The draft recognizes NOT + RED; provisional RGB channel unions (red + green → yellow, red + blue → magenta, green + blue → cyan, then any full RGB union → white); DO + RED → be red; NOT + HAND → FIST; HAND + HAND → COMBINE; provisional NOT + FIST → HAND; RIGHT + NOT → LEFT; and a second NOT over LEFT → RIGHT. LEFT/RIGHT hands and fists can be formed. The direction and hand rules are proposals; UP + NOT remains unimplemented.
- EYE can combine with color, block, or direction filters. WHILE can combine with HAND, FIST, FIT, or a filtered sight expression; for example, `(WHILE + (EYE + (NOT + RED)))` reads “while seeing clay that does not contain red pigment.” Sensory and motive verbs imply WHILE or DO on the square face; the construction and natural-language inspector retain those operators.
- DO can form the suggested HAND, FIST, RED, EYE, COMBINE, and directed hand/fist action phrases. The movement exploration recognizes FEET + LEFT → LEFT FEET → DO + LEFT FEET → MOVE LEFT and FEET + RIGHT → RIGHT FEET → DO + RIGHT FEET → MOVE RIGHT. It also recognizes DO + FEET → MOVE as tentative random cardinal wandering, then RIGHT + MOVE → MOVE RIGHT as a tentative way to direct that move. These movement behaviors are provisional prototype experiments and do not settle the game's movement rules. Adding NOT to the eye action or using DO + (NOT + EYE) forms a close-eyes phrase. AND/OR can join two distinct WHILE sense expressions. IN + ME forms an internal-content query expression. A sense expression paired with a DO action is labeled GOLEM.
- `WHILE + EYE → SEE` reads “while seeing anything.” `DO + EYE → LOOK` reads “look.” In this owner-directed prototype rule, `WHILE + EYE` senses any other clay square within three cells (center-to-center) and shows a filled, pulsing circular glow while the condition is true. The glow is drawn behind the square, separate from the square selection outline; a still glow is used when reduced motion is requested. The sensor updates as squares move, are dragged, or are added. This does not define activation behavior for other WHILE/DO expressions, direction filtering, or line-of-sight occlusion.
- Drag any world square to the Trash button to discard it. Clicking Trash discards the currently selected square; the endless element bank remains unchanged.
- A 64px mini-golem sprite is used as a visual state for recognized WHILE sense expressions, DO motive expressions, and complete GOLEM expressions. The lowercase expression stays over the forehead, the face remains inside the same square, and an expression's color intent tints the sprite. A brightness/contrast pass and soft warm rim increase value separation against the forest and clay. The responsive square size ranges from 44px to 64px. This is a visual exploration; it does not add WHILE sensing, DO execution, or activation behavior.
- The buildable-recipe panel is removed; expressions are discovered by combining blocks in the world.
- Select a square to inspect its exact construction and natural-language layer. Filler labels such as “entity” and “compound” are omitted.

## Prototype boundary and open rules

The added combinations are provisional readings of Designer suggestions. The requested `DO + LEFT FEET` example executes as slow leftward movement; rightward movement and random-walk interpretations execute only as local prototype experiments, not settled language rules. They keep trying when blocked. Only `WHILE + EYE` sensing is simulated; other WHILE conditions, pattern matching, close-eyes behavior, structural inspection, and FIT are not. It also does not implement SPLIT/undo, because history behavior remains unresolved. AND/OR and other direction readings are composition-only; no sensor evaluates them. The directed RGB color recipes are represented as expressions and tinted with the shared clay sprite; they do not execute a golem action or settle activation. New unpigmented blocks use a dark gray tint. All world word faces and construction-tree words render in lowercase. The square-block construction order remains visible in the inspector.

The map, fixed-size squares, compact lowercase face text, dark gray unpigmented clay, RGB-derived color states, shared clay silhouette, and detail panel follow the current Artist direction. The mini-golem sprite and its forehead word placement are a visual implementation exploration, not final art approval. Movement rules remain open for further design discussion.
