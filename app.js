(() => {
  "use strict";

  const canvas = document.querySelector("#map-canvas");
  const context = canvas.getContext("2d");
  const mapBoard = document.querySelector(".map-board");
  const elementBank = document.querySelector("#element-bank");
  const detail = document.querySelector("#detail-content");
  const status = document.querySelector("#status");
  const worldImage = new Image();
  worldImage.src = "assets/golem-world-blank.png";
  worldImage.addEventListener("load", () => drawMap());
  const clayImage = new Image();
  clayImage.src = "assets/golem-clay-lump-ink-outline-64px.png";
  clayImage.addEventListener("load", () => {
    // Tint requests can happen before this image loads, especially while the
    // initial palette is being built. Discard those transparent placeholders.
    clayTintCache.clear();
    drawMap();
    renderElementBank();
  });
  const miniGolemImage = new Image();
  miniGolemImage.src = "assets/golem-mini-golem-front-variant-64px.png";
  miniGolemImage.addEventListener("load", () => drawMap());
  const elementSpritePaths = {
    eye: "assets/golem-clay-eye-64px.png",
    hand: "assets/golem-clay-hand-open-64px.png",
    fist: "assets/golem-clay-fist-64px.png",
    feet: "assets/golem-clay-feet-64px.png",
    left: "assets/golem-clay-arrow-left-64px.png",
    right: "assets/golem-clay-arrow-right-64px.png",
    up: "assets/golem-clay-arrow-up-64px.png"
  };
  const elementSprites = Object.fromEntries(Object.entries(elementSpritePaths).map(([meaning, path]) => {
    const sprite = new Image();
    sprite.src = path;
    sprite.addEventListener("load", () => drawMap());
    return [meaning, sprite];
  }));
  const clayTintCache = new Map();
  const miniGolemTintCache = new Map();
  const clearingPolygon = [
    [0.24, 0.31], [0.31, 0.26], [0.39, 0.24], [0.44, 0.27],
    [0.45, 0.32], [0.42, 0.36], [0.47, 0.39], [0.54, 0.36],
    [0.62, 0.39], [0.72, 0.45], [0.76, 0.50], [0.72, 0.55],
    [0.65, 0.56], [0.58, 0.53], [0.52, 0.50], [0.46, 0.47],
    [0.42, 0.51], [0.41, 0.57], [0.46, 0.63], [0.55, 0.67],
    [0.65, 0.65], [0.73, 0.69], [0.76, 0.75], [0.69, 0.80],
    [0.57, 0.81], [0.45, 0.78], [0.35, 0.72], [0.28, 0.66],
    [0.23, 0.59], [0.21, 0.51], [0.22, 0.41]
  ];
  const elementWords = [
    "RED", "GREEN", "BLUE", "NOT", "RIGHT", "UP", "WHILE", "DO",
    "HAND", "EYE", "FEET"
  ];
  const pair = (left, right) => [left, right].sort().join("\u0000");
  const activeSenseIds = [
    "while-eye", "while-hand", "not-see", "not-touch",
    "while-sight-left", "while-sight-right", "while-sight-up",
    "sight-left", "sight-right", "sight-up"
  ];

  function element(word) {
    return { type: "element", word };
  }

  function compound(left, right, meaning = null) {
    return { type: "compound", left, right, meaning };
  }

  function makeBlock(id, contents) {
    return { id, contents, x: 0, y: 0 };
  }

  function makeInitialBlocks() {
    // The element bank is an endless source, so start with one world copy of
    // each base word instead of pre-filling the clearing with duplicates.
    return elementWords.map((word, index) => makeBlock(`block-${index}`, element(word)));
  }

  const elementMeanings = {
    RED: { id: "red", category: "filter", label: "RED", reading: "red pigment", colorMask: 1 },
    GREEN: { id: "green", category: "filter", label: "GREEN", reading: "green pigment", colorMask: 2 },
    BLUE: { id: "blue", category: "filter", label: "BLUE", reading: "blue pigment", colorMask: 4 },
    BLOCK: { id: "block", category: "filter", label: "BLOCK", reading: "a clay block" },
    RIGHT: { id: "right", category: "filter", label: "RIGHT", reading: "the right direction" },
    UP: { id: "up", category: "filter", label: "UP", reading: "the upward direction" },
    HAND: { id: "hand", category: "sense-source", label: "HAND", reading: "touch", senseText: "touch" },
    EYE: { id: "eye", category: "sense-source", label: "EYE", reading: "an eye", senseText: "seeing" },
    FEET: { id: "feet", category: "action-part", label: "FEET", reading: "feet used for movement" },
    DO: { id: "do", category: "operator", label: "DO" },
    WHILE: { id: "while", category: "operator", label: "WHILE" },
    AND: { id: "and", category: "operator", label: "AND" },
    OR: { id: "or", category: "operator", label: "OR" },
    NOT: { id: "not", category: "operator", label: "NOT" },
    IN: { id: "in", category: "operator", label: "IN" },
    ME: { id: "me", category: "operator", label: "ME" },
    FIT: { id: "fit", category: "sense-source", label: "FIT", reading: "the held pieces fit", senseText: "held pieces fitting into a structure" }
  };

  function describe(expression) {
    if (expression.type === "element") {
      return { ...(elementMeanings[expression.word] || {}), certainty: "element" };
    }
    if (expression.meaning) return expression.meaning;
    return {
      id: "unresolved",
      category: "unresolved",
      label: `${faceLabel(expression.left)} + ${faceLabel(expression.right)}`,
      reading: "No reading has been agreed for this expression.",
      certainty: "unresolved"
    };
  }

  const mixedColors = {
    3: { id: "yellow", label: "YELLOW", reading: "yellow from red and green color channels" },
    5: { id: "magenta", label: "MAGENTA", reading: "magenta from red and blue color channels" },
    6: { id: "cyan", label: "CYAN", reading: "cyan from green and blue color channels" },
    7: { id: "white", label: "WHITE", reading: "white from red, green, and blue color channels" }
  };

  function faceLabel(expression) {
    if (expression.type === "element") return (elementMeanings[expression.word]?.label || expression.word).toLowerCase();
    return describe(expression).label.toLowerCase();
  }

  function construction(expression) {
    if (expression.type === "element") return expression.word.toLowerCase();
    return `(${construction(expression.left)} + ${construction(expression.right)})`;
  }

  function provisionalMeaning(id, category, label, reading, extra = {}) {
    return { id, category, label, reading, certainty: "provisional", ...extra };
  }

  function combineMeaning(left, right, leftExpression, rightExpression) {
    const ids = pair(left.id, right.id);
    if (Number.isInteger(left.colorMask) && Number.isInteger(right.colorMask)) {
      const colorMask = left.colorMask | right.colorMask;
      if (colorMask === left.colorMask && colorMask === right.colorMask) return null;
      const mixed = mixedColors[colorMask];
      if (mixed) return provisionalMeaning(mixed.id, "color-state", mixed.label, mixed.reading, { colorMask });
    }
    if (ids === pair("feet", "left")) {
      return provisionalMeaning("left-feet", "action-source", "LEFT FEET", "feet oriented to move left");
    }
    if (ids === pair("feet", "right")) {
      return provisionalMeaning("right-feet", "action-source", "RIGHT FEET", "feet oriented to move right");
    }
    if (ids === pair("do", "left-feet")) {
      return provisionalMeaning(
        "do-move-left", "motive", "MOVE LEFT",
        "move slowly to the left continuously; without a WHILE condition, keep attempting as if WHILE TRUE"
      );
    }
    if (ids === pair("do", "right-feet")) {
      return provisionalMeaning(
        "do-move-right", "motive", "MOVE RIGHT",
        "move slowly to the right continuously; provisional owner-requested prototype behavior"
      );
    }
    if (ids === pair("do", "feet")) {
      return provisionalMeaning(
        "do-move-random", "motive", "MOVE",
        "move slowly in a random cardinal direction, changing direction occasionally; tentative prototype interpretation"
      );
    }
    const movementDirection = ["left", "right", "up"].find(direction =>
      ids === pair("do-move-random", direction)
    );
    if (movementDirection) {
      const directionWords = { left: "left", right: "right", up: "up" };
      return provisionalMeaning(
        `do-move-${movementDirection}`, "motive", `MOVE ${movementDirection.toUpperCase()}`,
        `move slowly ${directionWords[movementDirection]}; directional prototype behavior`
      );
    }
    const notRedIds = pair("not", "red");
    if (ids === pair("do", "red")) {
      return provisionalMeaning("be-red", "motive", "BE RED", "be red", { colorIntentMask: 1 });
    }
    if (ids === notRedIds) {
      return provisionalMeaning("not-red", "filter", "NOT RED", "clay that does not contain red pigment");
    }
    if (ids === pair("not", "hand")) {
      return provisionalMeaning("fist", "sense-source", "FIST", "a hand formed into a fist", { senseText: "holding" });
    }
    if (ids === pair("not", "fist")) {
      return provisionalMeaning("hand", "sense-source", "HAND", "a hand opened from a fist", { senseText: "touch" });
    }
    if (ids === pair("hand", "hand")) {
      return provisionalMeaning("combine", "motive", "COMBINE", "combine the two hands");
    }
    if (ids === pair("right", "not")) {
      return provisionalMeaning("left", "filter", "LEFT", "the left direction");
    }
    if (ids === pair("left", "not")) {
      return provisionalMeaning("right-after-double-not", "filter", "RIGHT", "the right direction after double negation");
    }
    if (ids === pair("do-eye", "not") || ids === pair("do", "not-eye")) {
      return provisionalMeaning("do-not-look", "motive", "DON'T LOOK", "don't look", { source: "proposed language reading; runtime effect is undefined" });
    }
    if (ids === pair("not", "eye")) {
      return provisionalMeaning("not-eye", "sense-source", "NOT EYE", "the negated EYE expression; its reading depends on the outer operator", { senseText: "not seeing" });
    }
    if (ids === pair("not", "while-eye")) {
      return provisionalMeaning("not-see", "sense", "NOT SEE", "while not seeing anything within three cells", {
        senseKind: "see", negated: true, sightRangeCells: 3,
        senseText: "not seeing anything within three cells"
      });
    }
    if (ids === pair("not", "while-hand")) {
      return provisionalMeaning("not-touch", "sense", "NOT TOUCH", "while not touching anything", {
        senseKind: "touch", negated: true,
        senseText: "not touching any other clay square"
      });
    }
    if ((left.id === "left" || left.id === "right") && right.id === "hand" ||
        (right.id === "left" || right.id === "right") && left.id === "hand") {
      const direction = left.id === "left" || left.id === "right" ? left : right;
      return provisionalMeaning(`${direction.id}-hand`, "sense-source", `${direction.label} HAND`, `${direction.label.toLowerCase()} hand`, { senseText: "touch" });
    }
    if ((left.id === "left" || left.id === "right") && right.id === "fist" ||
        (right.id === "left" || right.id === "right") && left.id === "fist") {
      const direction = left.id === "left" || left.id === "right" ? left : right;
      return provisionalMeaning(`${direction.id}-fist`, "sense-source", `${direction.label} FIST`, `${direction.label.toLowerCase()} fist`, { senseText: "holding" });
    }
    if (left.id === "eye" && (right.category === "filter" || right.category === "color-state") ||
        right.id === "eye" && (left.category === "filter" || left.category === "color-state")) {
      const filter = left.id === "eye" ? right : left;
      const direction = ["left", "right", "up"].includes(filter.id) ? filter.id : null;
      const sightReading = direction
        ? `seeing something ${direction === "up" ? "above" : `to the ${direction}`}`
        : `seeing ${Number.isInteger(filter.colorMask) ? `${filter.label.toLowerCase()} pigment` : filter.reading}`;
      return provisionalMeaning(`sight-${filter.id}`, "sense", `SEE ${filter.label}`, sightReading, {
        senseKind: "see", senseText: sightReading,
        ...(direction ? { direction, sightRangeCells: 3 } : {})
      });
    }
    if ((left.id === "while-eye" && (right.category === "filter" || right.category === "color-state")) ||
        (right.id === "while-eye" && (left.category === "filter" || left.category === "color-state"))) {
      const filter = left.id === "while-eye" ? right : left;
      const direction = ["left", "right", "up"].includes(filter.id) ? filter.id : null;
      const sightReading = direction
        ? `seeing something ${direction === "up" ? "above" : `to the ${direction}`}`
        : `seeing ${Number.isInteger(filter.colorMask) ? `${filter.label.toLowerCase()} pigment` : filter.reading}`;
      return provisionalMeaning(`while-sight-${filter.id}`, "sense", `SEE ${filter.label}`, `while ${sightReading}`, {
        senseKind: "see", senseText: `while ${sightReading}`,
        ...(direction ? { direction, sightRangeCells: 3 } : {})
      });
    }
    if ((left.id === "while-hand" && (right.category === "filter" || right.category === "color-state")) ||
        (right.id === "while-hand" && (left.category === "filter" || left.category === "color-state"))) {
      const color = left.id === "while-hand" ? right : left;
      if (Number.isInteger(color.colorMask)) {
        return provisionalMeaning(`while-touch-${color.id}`, "sense", `TOUCH ${color.label}`,
          `while touching ${color.label.toLowerCase()} pigment`, {
            senseKind: "touch", senseText: `while touching ${color.label.toLowerCase()} pigment`
          });
      }
    }
    if ((left.id === "while" && right.category === "sense-source") ||
        (right.id === "while" && left.category === "sense-source")) {
      const sense = left.id === "while" ? right : left;
      const whilePhrases = {
        eye: "while seeing anything",
        "not-eye": "while not seeing",
        hand: "while touching",
        fist: "while holding",
        fit: "while the held pieces fit",
        "left-hand": "while touching with the left hand",
        "right-hand": "while touching with the right hand",
        "left-fist": "while holding with the left hand",
        "right-fist": "while holding with the right hand"
      };
      const phrase = whilePhrases[sense.id] || `while sensing ${sense.senseText || sense.reading}`;
      const whileLabels = {
        eye: "SEE",
        "not-eye": "NOT SEE",
        hand: "TOUCH",
        fist: "HOLD",
        fit: "FIT",
        "left-hand": "LEFT TOUCH",
        "right-hand": "RIGHT TOUCH",
        "left-fist": "LEFT HOLD",
        "right-fist": "RIGHT HOLD"
      };
      const label = whileLabels[sense.id] || sense.label;
      return provisionalMeaning(`while-${sense.id}`, "sense", label, phrase, {
        senseText: phrase,
        ...(sense.id === "eye" ? { sightRangeCells: 3 } : {})
      });
    }
    if ((left.id === "while" && ["sense", "filter"].includes(right.category)) ||
        (right.id === "while" && ["sense", "filter"].includes(left.category))) {
      const sense = left.id === "while" ? right : left;
      const phrase = sense.id === "not-red"
        ? "while I contain no red pigment"
        : `while ${sense.senseText || sense.reading}`;
      return provisionalMeaning(`while-${sense.id}`, "sense", sense.label, phrase, { senseText: phrase });
    }
    if ((left.id === "do" && ["hand", "fist", "red", "eye", "not-eye", "combine", "left-hand", "right-hand", "left-fist", "right-fist"].includes(right.id)) ||
        (right.id === "do" && ["hand", "fist", "red", "eye", "not-eye", "combine", "left-hand", "right-hand", "left-fist", "right-fist"].includes(left.id))) {
      const action = left.id === "do" ? right : left;
      const actions = {
        hand: ["DROP", "drop the held piece"],
        fist: ["GRAB", "grab a piece"],
        red: ["ADD RED", "add red pigment"],
        eye: ["LOOK", "look"],
        "not-eye": ["DON'T LOOK", "don't look"],
        combine: ["COMBINE", "combine the blocks held in both hands"],
        "left-hand": ["DROP LEFT", "drop what is in the left hand"],
        "right-hand": ["DROP RIGHT", "drop what is in the right hand"],
        "left-fist": ["GRAB LEFT", "grab with the left hand"],
        "right-fist": ["GRAB RIGHT", "grab with the right hand"]
      };
      const [label, reading] = actions[action.id];
      return provisionalMeaning(`do-${action.id}`, "motive", label, reading);
    }
    if ((left.id === "in" && right.id === "me") || (right.id === "in" && left.id === "me")) {
      return provisionalMeaning("inside-me", "inspect", "IN ME", "inside me");
    }
    if ((left.id === "inside-me" && right.category === "filter") ||
        (right.id === "inside-me" && left.category === "filter")) {
      const pattern = left.id === "inside-me" ? right : left;
      return provisionalMeaning(`inside-${pattern.id}`, "inspect", `IN ME ${pattern.label}`, `whether ${pattern.reading} occurs anywhere inside me`);
    }
    if ((left.category === "sense" && right.category === "motive") ||
        (right.category === "sense" && left.category === "motive")) {
      const sense = left.category === "sense" ? left : right;
      const motive = left.category === "motive" ? left : right;
      const label = `${sense.label} THEN ${motive.label}`;
      const reading = `${sense.reading}; then ${motive.reading}`;
      const behaviorImplemented = activeSenseIds.includes(sense.id) &&
        ["do-move-left", "do-move-right", "do-move-up", "do-move-random"].includes(motive.id);
      return provisionalMeaning("golem-pair", "golem", label, reading, {
        sense,
        motive,
        behaviorImplemented,
        ...(behaviorImplemented ? { sightRangeCells: sense.sightRangeCells || 3 } : {})
      });
    }
    if ((left.category === "sense" && ["and", "or"].includes(right.id)) ||
        (right.category === "sense" && ["and", "or"].includes(left.id))) {
      const sense = left.category === "sense" ? left : right;
      const operator = left.id === "and" || left.id === "or" ? left : right;
      return provisionalMeaning(`${operator.id}-pending-${sense.id}`, "sense-operator-pending", `${sense.label} ${operator.label} …`, `${sense.reading}; choose another sense to complete ${operator.label}`, { operator: operator.id, firstSense: sense });
    }
    if ((left.category === "sense-operator-pending" && right.category === "sense") ||
        (right.category === "sense-operator-pending" && left.category === "sense")) {
      const pending = left.category === "sense-operator-pending" ? left : right;
      const nextSense = left.category === "sense-operator-pending" ? right : left;
      if (pending.firstSense.id === nextSense.id) return null;
      const joiner = pending.operator === "and" ? "and" : "or";
      return provisionalMeaning(`${pending.operator}-senses-${pending.firstSense.id}-${nextSense.id}`, "sense", `${pending.firstSense.label} ${pending.operator.toUpperCase()} ${nextSense.label}`, `${pending.firstSense.reading} ${joiner} ${nextSense.reading}`, { senseText: `${pending.firstSense.senseText || pending.firstSense.reading} ${joiner} ${nextSense.senseText || nextSense.reading}` });
    }
    return null;
  }

  function resultExpression(leftExpression, rightExpression) {
    const meaning = combineMeaning(
      describe(leftExpression), describe(rightExpression), leftExpression, rightExpression
    );
    if (!meaning) return null;
    if (meaning.id === "right-after-double-not") return element("RIGHT");
    return compound(leftExpression, rightExpression, meaning);
  }

  function plainLanguage(expression) {
    return describe(expression).reading || "No reading has been agreed for this expression.";
  }

  const state = {
    blocks: makeInitialBlocks(),
    selectedId: null,
    focusedId: null,
    drag: null,
    targetId: null,
    layout: { size: 56, cell: 70, columns: 1, width: 1, height: 1, dpr: 1 },
    paletteCopyCount: 0
  };
  let lastPaletteDropTime = 0;
  let palettePointerDrag = null;
  const movementSpeed = 16;
  let movementTimer = null;
  let lastMovementTime = null;

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function allBlocks() {
    return state.blocks;
  }

  function resizeMap() {
    const previousLayout = state.layout;
    const boardStyle = window.getComputedStyle(mapBoard);
    const horizontalPadding = parseFloat(boardStyle.paddingLeft) + parseFloat(boardStyle.paddingRight);
    const width = Math.max(280, mapBoard.clientWidth - horizontalPadding);
    const size = Math.max(44, Math.min(64, width / 14));
    const cell = size + 6;
    const columns = Math.max(2, Math.floor((width - 12) / cell));
    const height = Math.max(540, width * (992 / 1586));
    const rows = Math.max(1, Math.floor(height / cell));
    const dpr = window.devicePixelRatio || 1;
    state.layout = { size, cell, columns, rows, width, height, dpr };
    elementBank.style.setProperty("--world-cell-size", `${cell}px`);
    elementBank.style.setProperty("--world-clay-size", `${size}px`);
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (previousLayout.width <= 1 || previousLayout.height <= 1) {
      arrangeBlocks();
    } else {
      reflowBlocks(previousLayout);
    }
    renderElementBank();
    drawMap();
  }

  function imageFrame() {
    const { width, height } = state.layout;
    const imageWidth = worldImage.naturalWidth || 1586;
    const imageHeight = worldImage.naturalHeight || 992;
    const scale = Math.max(width / imageWidth, height / imageHeight);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    return {
      x: (width - drawWidth) / 2,
      y: (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight
    };
  }

  function gameHudLayout() {
    const { width, size, cell } = state.layout;
    const inset = 10;
    const columns = Math.max(1, Math.floor((width - inset * 2) / cell));
    const rows = Math.ceil(elementWords.length / columns);
    const titleHeight = Math.max(38, Math.min(54, size * 0.82));
    const gridTop = inset + titleHeight + 4;
    const gridWidth = columns * cell;
    const gridLeft = (width - gridWidth) / 2;
    const gridHeight = rows * cell;
    const bottom = gridTop + gridHeight + 8;
    const tokens = elementWords.map((word, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const left = gridLeft + column * cell + (cell - size) / 2;
      const top = gridTop + row * cell + (cell - size) / 2;
      return { word, left, top, right: left + size, bottom: top + size };
    });
    return {
      bounds: { left: 0, top: 0, right: width, bottom },
      tokens,
      titleHeight,
      inset,
      size
    };
  }

  function overlapsGameHud(x, y, size) {
    const hudBottom = gameHudLayout().bounds.bottom;
    return x < state.layout.width && x + size > 0 && y < hudBottom && y + size > 0;
  }

  function pointInPolygon(x, y) {
    let inside = false;
    for (let i = 0, j = clearingPolygon.length - 1; i < clearingPolygon.length; j = i, i += 1) {
      const [xi, yi] = clearingPolygon[i];
      const [xj, yj] = clearingPolygon[j];
      const crosses = (yi > y) !== (yj > y) &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function isSafeCell(x, y, size, frame) {
    const inset = Math.min(3, size / 10);
    const corners = [
      [x + inset, y + inset], [x + size - inset, y + inset],
      [x + inset, y + size - inset], [x + size - inset, y + size - inset],
      [x + size / 2, y + size / 2]
    ];
    return corners.every(([canvasX, canvasY]) => {
      const imageX = (canvasX - frame.x) / frame.width;
      const imageY = (canvasY - frame.y) / frame.height;
      return pointInPolygon(imageX, imageY);
    });
  }

  function clearingCells(cell, size) {
    const { width, height } = state.layout;
    const frame = imageFrame();
    const inset = (cell - size) / 2;
    const cells = [];
    const columns = Math.floor(width / cell);
    const rows = Math.floor(height / cell);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column * cell + inset;
        const y = row * cell + inset;
        if (isSafeCell(x, y, size, frame)) cells.push({ x, y });
      }
    }
    return cells;
  }

  function arrangeBlocks() {
    const { size } = state.layout;
    const frame = imageFrame();
    const placed = [];
    const placedBlocks = shuffle([...state.blocks]);
    state.blocks.forEach(block => { block.unplaced = false; });
    const overlapsPlaced = (x, y) => placed.some(other =>
      x < other.x + size + 2 && x + size + 2 > other.x &&
      y < other.y + size + 2 && y + size + 2 > other.y
    );
    const isOpen = (x, y, strictClearing) =>
      (strictClearing ? isSafeCell(x, y, size, frame) : insideClearing(x, y, size, frame)) &&
      !overlapsGameHud(x, y, size) &&
      !overlapsPlaced(x, y);

    // Try randomized positions in the clearing. If random packing leaves a
    // small awkward gap, use a fine scan instead of sending blocks to (0, 0).
    const findOpenPosition = (strictClearing) => {
      const maxX = state.layout.width - size;
      const maxY = state.layout.height - size;
      for (let attempt = 0; attempt < 5000; attempt += 1) {
        const x = Math.random() * maxX;
        const y = Math.random() * maxY;
        if (isOpen(x, y, strictClearing)) return { x, y };
      }
      for (let y = 0; y <= maxY; y += 2) {
        for (let x = 0; x <= maxX; x += 2) {
          if (isOpen(x, y, strictClearing)) return { x, y };
        }
      }
      return null;
    };

    for (const block of placedBlocks) {
      // The center-only fallback is used only for an unusually tight narrow
      // viewport; it still keeps the clay inside the marked clearing.
      const position = findOpenPosition(true) || findOpenPosition(false);
      if (!position) {
        block.unplaced = true;
        continue;
      }
      block.unplaced = false;
      block.x = position.x;
      block.y = position.y;
      placed.push(block);
    }

    // Keep the spacing metadata aligned with the canvas even though placement
    // is free-form rather than restricted to a grid.
    state.layout.columns = Math.floor(state.layout.width / state.layout.cell);
    state.layout.rows = Math.floor(state.layout.height / state.layout.cell);
  }

  function reflowBlocks(previousLayout) {
    const { size, width, height } = state.layout;
    const frame = imageFrame();
    const placed = [];
    const orderedBlocks = [...state.blocks].sort((a, b) => {
      const priority = block =>
        (movementFor(block) ? 0 : 1) +
        (block.id === state.selectedId ? 0 : 1) +
        (block.unplaced ? 2 : 0);
      return priority(a) - priority(b);
    });
    const overlapsPlaced = (x, y) => placed.some(other =>
      x < other.x + size + 2 && x + size + 2 > other.x &&
      y < other.y + size + 2 && y + size + 2 > other.y
    );
    const isOpen = (x, y) =>
      (isSafeCell(x, y, size, frame) || insideClearing(x, y, size, frame)) &&
      !overlapsGameHud(x, y, size) &&
      !overlapsPlaced(x, y);
    const bounded = (value, maximum) => Math.max(0, Math.min(maximum, value));
    const findNear = (originX, originY) => {
      const maxX = width - size;
      const maxY = height - size;
      const x = bounded(originX, maxX);
      const y = bounded(originY, maxY);
      if (isOpen(x, y)) return { x, y };

      // Search outward from the scaled point so a resize only nudges a square
      // when the new clearing boundary or a neighbor makes its old spot invalid.
      const step = Math.max(3, Math.floor(size / 12));
      const maxRadius = Math.max(width, height);
      for (let radius = step; radius <= maxRadius; radius += step) {
        const segments = Math.max(16, Math.ceil((Math.PI * 2 * radius) / step));
        for (let index = 0; index < segments; index += 1) {
          const angle = (index / segments) * Math.PI * 2;
          const candidateX = bounded(x + Math.cos(angle) * radius, maxX);
          const candidateY = bounded(y + Math.sin(angle) * radius, maxY);
          if (isOpen(candidateX, candidateY)) return { x: candidateX, y: candidateY };
        }
      }

      // A fine deterministic scan handles narrow remaining gaps on small views.
      for (let scanY = 0; scanY <= maxY; scanY += step) {
        for (let scanX = 0; scanX <= maxX; scanX += step) {
          if (isOpen(scanX, scanY)) return { x: scanX, y: scanY };
        }
      }
      return null;
    };

    for (const block of orderedBlocks) {
      const oldCenterX = block.x + previousLayout.size / 2;
      const oldCenterY = block.y + previousLayout.size / 2;
      const desiredX = (oldCenterX / previousLayout.width) * width - size / 2;
      const desiredY = (oldCenterY / previousLayout.height) * height - size / 2;
      const position = findNear(desiredX, desiredY);
      if (!position) {
        block.unplaced = true;
        continue;
      }
      block.x = position.x;
      block.y = position.y;
      block.unplaced = false;
      placed.push(block);
    }
    state.layout.columns = Math.floor(width / state.layout.cell);
    state.layout.rows = Math.floor(height / state.layout.cell);
  }

  function tintedClay(colorMask) {
    if (clayTintCache.has(colorMask)) return clayTintCache.get(colorMask);
    const tint = {
      1: "rgb(190 55 48 / 25%)",
      2: "rgb(68 143 73 / 25%)",
      3: "rgb(222 192 55 / 25%)",
      4: "rgb(65 112 193 / 25%)",
      5: "rgb(196 67 157 / 25%)",
      6: "rgb(61 183 184 / 25%)",
      7: "rgb(238 239 228 / 25%)"
    }[colorMask] || "rgb(48 51 57 / 82%)";
    const sprite = document.createElement("canvas");
    sprite.width = clayImage.naturalWidth || 64;
    sprite.height = clayImage.naturalHeight || 64;
    const spriteContext = sprite.getContext("2d");
    if (clayImage.complete && clayImage.naturalWidth) {
      spriteContext.drawImage(clayImage, 0, 0, sprite.width, sprite.height);
      spriteContext.globalCompositeOperation = "source-atop";
      spriteContext.fillStyle = tint;
      spriteContext.fillRect(0, 0, sprite.width, sprite.height);
    }
    clayTintCache.set(colorMask, sprite);
    return sprite;
  }

  function tintedMiniGolem(colorMask) {
    if (miniGolemTintCache.has(colorMask)) return miniGolemTintCache.get(colorMask);
    const tint = {
      1: "rgb(190 55 48 / 25%)",
      2: "rgb(68 143 73 / 25%)",
      3: "rgb(222 192 55 / 25%)",
      4: "rgb(65 112 193 / 25%)",
      5: "rgb(196 67 157 / 25%)",
      6: "rgb(61 183 184 / 25%)",
      7: "rgb(238 239 228 / 25%)"
    }[colorMask];
    if (!tint) return miniGolemImage;
    const sprite = document.createElement("canvas");
    sprite.width = miniGolemImage.naturalWidth || 64;
    sprite.height = miniGolemImage.naturalHeight || 64;
    const spriteContext = sprite.getContext("2d");
    if (miniGolemImage.complete && miniGolemImage.naturalWidth) {
      spriteContext.drawImage(miniGolemImage, 0, 0, sprite.width, sprite.height);
      spriteContext.globalCompositeOperation = "source-atop";
      spriteContext.fillStyle = tint;
      spriteContext.fillRect(0, 0, sprite.width, sprite.height);
    }
    miniGolemTintCache.set(colorMask, sprite);
    return sprite;
  }

  function drawMap() {
    const { width, height, size } = state.layout;
    context.clearRect(0, 0, width, height);
    if (worldImage.complete && worldImage.naturalWidth) {
      const frame = imageFrame();
      context.drawImage(worldImage, frame.x, frame.y, frame.width, frame.height);
    } else {
      context.fillStyle = "#263328";
      context.fillRect(0, 0, width, height);
    }
    drawGameHud();
    for (const block of state.blocks) {
      if (block.unplaced) continue;
      const selected = block.id === state.selectedId;
      const focused = block.id === state.focusedId;
      const target = block.id === state.targetId;
      const meaning = describe(block.contents);
      const isCreature = ["sense", "motive", "golem"].includes(meaning.category);
      const sightIsTrue = sensorFor(block) !== null && block.senseActive;
      const colorMask = meaning.colorIntentMask ?? meaning.colorMask ?? 0;
      const handDirection = meaning.id === "left-hand" ? "left" : meaning.id === "right-hand" ? "right" : null;
      const elementSprite = elementSprites[meaning.id] || (handDirection ? elementSprites.hand : null);
      if (sightIsTrue) {
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
        const pulse = reducedMotion ? 1 : 0.5 + (Math.sin(performance.now() / 260) + 1) * 0.18;
        const centerX = block.x + size / 2;
        const centerY = block.y + size / 2;
        const radius = size * 0.9;
        const glow = context.createRadialGradient(centerX, centerY, size * 0.12, centerX, centerY, radius);
        glow.addColorStop(0, `rgb(255 224 132 / ${Math.round(pulse * 72)}%)`);
        glow.addColorStop(0.55, `rgb(255 214 105 / ${Math.round(pulse * 38)}%)`);
        glow.addColorStop(1, "rgb(255 214 105 / 0%)");
        context.save();
        context.fillStyle = glow;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      if (elementSprite?.complete && elementSprite.naturalWidth) {
        if (handDirection === "left") {
          context.save();
          context.translate(block.x + size, block.y);
          context.scale(-1, 1);
          context.drawImage(elementSprite, 0, 0, size, size);
          context.restore();
        } else {
          context.drawImage(elementSprite, block.x, block.y, size, size);
        }
      } else if (isCreature && miniGolemImage.complete && miniGolemImage.naturalWidth) {
        context.save();
        // The brighter face and crisp dark features read against both the clay
        // square and the forest; the soft rim separates the small limbs too.
        context.filter = "brightness(1.12) contrast(1.5)";
        context.shadowColor = "rgb(255 235 185 / 92%)";
        context.shadowBlur = Math.max(1.5, size * 0.035);
        context.drawImage(tintedMiniGolem(colorMask), block.x, block.y, size, size);
        context.restore();
      } else if (clayImage.complete && clayImage.naturalWidth) {
        context.drawImage(tintedClay(meaning.colorMask), block.x, block.y, size, size);
      } else {
        context.fillStyle = "#aaa7a0";
        context.fillRect(block.x, block.y, size, size);
      }
      if (["do-move-left", "do-move-right", "do-move-random"].includes(meaning.id)) {
        context.strokeStyle = "#d4e2a4";
        context.lineWidth = 2;
        context.setLineDash([4, 3]);
        context.strokeRect(block.x + 2, block.y + 2, size - 4, size - 4);
        context.setLineDash([]);
      }
      if (target || selected || focused) {
        context.strokeStyle = selected ? "#f4c27a" : target ? "#ffe19a" : "#e8dfc9";
        context.lineWidth = selected || target ? 3 : 2;
        context.strokeRect(block.x + 1, block.y + 1, size - 2, size - 2);
      }
      context.fillStyle = "#fff7e7";
      context.strokeStyle = "rgb(18 19 21 / 92%)";
      context.lineWidth = 2.4;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `${faceFontSize(faceLabel(block.contents), size)}px "Creepster", Georgia, serif`;
      context.shadowColor = "rgb(255 247 224 / 90%)";
      context.shadowBlur = 2;
      const label = faceLabel(block.contents);
      const labelY = block.y + size * (isCreature ? 0.42 : 0.5);
      context.strokeText(label, block.x + size / 2, labelY, size - 8);
      context.fillText(label, block.x + size / 2, labelY, size - 8);
      context.shadowBlur = 0;
    }
  }

  function drawGameHud() {
    const hud = gameHudLayout();
    const { width } = state.layout;
    context.save();
    context.fillStyle = "rgb(25 30 29 / 72%)";
    context.fillRect(0, 0, width, hud.bounds.bottom);
    context.strokeStyle = state.drag?.overTopPanel
      ? "rgb(246 187 123 / 88%)"
      : "rgb(190 195 170 / 42%)";
    context.lineWidth = state.drag?.overTopPanel ? 2 : 1;
    context.beginPath();
    context.moveTo(0, hud.bounds.bottom - 0.5);
    context.lineTo(width, hud.bounds.bottom - 0.5);
    context.stroke();

    const titleSize = Math.max(22, Math.min(34, hud.size * 0.56));
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = `${titleSize}px "Creepster", Georgia, serif`;
    context.fillStyle = "#fff2df";
    context.shadowColor = "rgb(0 0 0 / 80%)";
    context.shadowBlur = 3;
    context.fillText("GOLEM", 14, hud.inset + hud.titleHeight / 2);
    context.shadowBlur = 0;

    for (const token of hud.tokens) {
      const contents = element(token.word);
      const meaning = describe(contents);
      const sprite = elementSprites[meaning.id];
      const art = sprite?.complete && sprite.naturalWidth ? sprite : tintedClay(meaning.colorMask || 0);
      if (art.width && art.height) context.drawImage(art, token.left, token.top, hud.size, hud.size);
      context.fillStyle = "#fff7e7";
      context.strokeStyle = "rgb(18 19 21 / 92%)";
      context.lineWidth = Math.max(1.5, hud.size * 0.04);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `${faceFontSize(faceLabel(contents), hud.size)}px "Creepster", Georgia, serif`;
      context.shadowColor = "rgb(255 247 224 / 78%)";
      context.shadowBlur = 2;
      const centerX = (token.left + token.right) / 2;
      const centerY = (token.top + token.bottom) / 2;
      context.strokeText(faceLabel(contents), centerX, centerY, hud.size - 8);
      context.fillText(faceLabel(contents), centerX, centerY, hud.size - 8);
      context.shadowBlur = 0;
    }

    if (palettePointerDrag?.moved) {
      const drag = palettePointerDrag;
      const left = drag.point.x - drag.offsetX;
      const top = drag.point.y - drag.offsetY;
      const meaning = describe(element(drag.word));
      const sprite = elementSprites[meaning.id];
      const art = sprite?.complete && sprite.naturalWidth ? sprite : tintedClay(meaning.colorMask || 0);
      context.globalAlpha = 0.86;
      if (art.width && art.height) context.drawImage(art, left, top, hud.size, hud.size);
      context.fillStyle = "#fff7e7";
      context.strokeStyle = "rgb(18 19 21 / 92%)";
      context.lineWidth = 2;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `${faceFontSize(faceLabel(element(drag.word)), hud.size)}px "Creepster", Georgia, serif`;
      const label = faceLabel(element(drag.word));
      context.strokeText(label, left + hud.size / 2, top + hud.size / 2, hud.size - 8);
      context.fillText(label, left + hud.size / 2, top + hud.size / 2, hud.size - 8);
    }
    context.restore();
  }

  function faceFontSize(label, size) {
    return Math.max(9, Math.min(20, size * 0.34 - Math.max(0, label.length - 7) * 0.48));
  }

  function renderDetail() {
    const selected = allBlocks().find(block => block.id === state.selectedId);
    if (!selected) {
      detail.innerHTML = '<p class="detail-placeholder">No block selected.</p>';
      return;
    }
    const meaning = describe(selected.contents);
    const provisional = meaning.certainty === "provisional" || meaning.certainty === "unresolved";
    const sensor = sensorFor(selected);
    const sightRangeCells = meaning.sightRangeCells || 3;
    const senseKind = sensor?.senseKind || (sensor?.id === "while-hand" ? "touch" : "see");
    const positiveSenseDescription = senseKind === "touch"
      ? "another clay square is adjacent"
      : sensor?.direction
        ? `another clay square is directly ${sensor.direction === "up" ? "above" : `to the ${sensor.direction}`} within ${sightRangeCells} cells`
        : `clay within ${sightRangeCells} cells`;
    const senseDescription = sensor?.negated
      ? `no ${senseKind === "touch" ? "other clay square is adjacent" : `clay is within ${sightRangeCells} cells`}`
      : positiveSenseDescription;
    const sightStatus = sensor
      ? selected.senseActive
        ? `Sensing true · ${senseDescription}`
        : `Sensing false · ${positiveSenseDescription}`
      : null;
    const movementStatuses = {
      "do-move-left": "Prototype movement experiment · the language rule remains open",
      "do-move-right": "Prototype movement experiment · the language rule remains open",
      "do-move-up": "Prototype movement experiment · the language rule remains open",
      "do-move-random": "Tentative random-walk experiment · the language rule remains open"
    };
    const pairedMovementStatus = meaning.id === "golem-pair" && meaning.behaviorImplemented
      ? selected.senseActive
        ? `Prototype response active · ${senseDescription}`
        : `Prototype response waiting · moves only while ${sensor?.label?.toLowerCase() || "the sense"} is true`
      : null;
    const readingStatus = pairedMovementStatus || sightStatus || movementStatuses[meaning.id] ||
      (provisional ? "Proposed reading · behavior not simulated" : "Element");
    detail.innerHTML = `<dl class="detail-list"><div><dt>Construction</dt><dd class="detail-construction"></dd></div><div><dt>Natural language</dt><dd class="detail-reading"></dd><small class="reading-status">${readingStatus}</small></div></dl>`;
    detail.querySelector(".detail-construction").textContent = construction(selected.contents);
    detail.querySelector(".detail-reading").textContent = plainLanguage(selected.contents);
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function hitTest(point, exceptId = null) {
    const { size } = state.layout;
    for (let i = state.blocks.length - 1; i >= 0; i -= 1) {
      const block = state.blocks[i];
      if (block.unplaced) continue;
      if (block.id === exceptId) continue;
      if (point.x >= block.x && point.x <= block.x + size &&
          point.y >= block.y && point.y <= block.y + size) return block;
    }
    return null;
  }

  function pointerIsOverTopPanel(clientX, clientY) {
    const point = canvasPoint({ clientX, clientY });
    return pointInsideRect(point.x, point.y, gameHudLayout().bounds);
  }

  function discardBlock(block) {
    state.blocks = state.blocks.filter(candidate => candidate.id !== block.id);
    if (state.selectedId === block.id) state.selectedId = null;
    if (state.focusedId === block.id) state.focusedId = null;
    if (state.targetId === block.id) state.targetId = null;
    if (!state.blocks.some(hasActivePrototypeBehavior)) stopActiveMovement();
    renderDetail();
    drawMap();
    setStatus(`${faceLabel(block.contents)} discarded.`);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (state.layout.width / rect.width),
      y: (event.clientY - rect.top) * (state.layout.height / rect.height)
    };
  }

  function insideClearing(x, y, size, frame) {
    const centerX = (x + size / 2 - frame.x) / frame.width;
    const centerY = (y + size / 2 - frame.y) / frame.height;
    return pointInPolygon(centerX, centerY);
  }

  function overlapsAnotherBlock(block, x, y) {
    const size = state.layout.size;
    return state.blocks.some(other => !other.unplaced && other.id !== block.id &&
      x < other.x + size && x + size > other.x &&
      y < other.y + size && y + size > other.y);
  }

  function dropInClearing(block, desiredX, desiredY) {
    const size = state.layout.size;
    const maxX = state.layout.width - size;
    const maxY = state.layout.height - size;
    const x = Math.max(0, Math.min(maxX, desiredX));
    const y = Math.max(0, Math.min(maxY, desiredY));
    const frame = imageFrame();
    const canPlace = (candidateX, candidateY) =>
      insideClearing(candidateX, candidateY, size, frame) &&
      !overlapsAnotherBlock(block, candidateX, candidateY);
    if (canPlace(x, y)) {
      block.unplaced = false;
      block.x = x;
      block.y = y;
      return true;
    }

    // Search continuously around the requested point, then across the rest of
    // the clearing. There is no fixed clay count or safe-cell-slot ceiling.
    const step = Math.max(2, Math.floor(size / 16));
    const maxRadius = Math.max(state.layout.width, state.layout.height);
    for (let radius = step; radius <= maxRadius; radius += step) {
      for (let offset = -radius; offset <= radius; offset += step) {
        const candidates = [
          [x + offset, y - radius], [x + offset, y + radius],
          [x - radius, y + offset], [x + radius, y + offset]
        ];
        for (const [candidateX, candidateY] of candidates) {
          const boundedX = Math.max(0, Math.min(maxX, candidateX));
          const boundedY = Math.max(0, Math.min(maxY, candidateY));
          if (!canPlace(boundedX, boundedY)) continue;
          block.unplaced = false;
          block.x = boundedX;
          block.y = boundedY;
          return true;
        }
      }
    }
    return false;
  }

  function addPaletteElement(word, point, tryCombine, pointerPoint = point) {
    // Use the actual drop pointer first. The bank sprite's grab offset can
    // otherwise shift its visual center off the target square.
    const target = tryCombine ? hitTest(pointerPoint) || hitTest(point) : null;
    const block = makeBlock(`bank-copy-${++state.paletteCopyCount}`, element(word));
    block.x = point.x - state.layout.size / 2;
    block.y = point.y - state.layout.size / 2;
    state.blocks.push(block);
    if (target && combine(target, block)) {
      startActiveMovement();
      return;
    }
    if (!dropInClearing(block, block.x, block.y)) {
      state.blocks = state.blocks.filter(candidate => candidate.id !== block.id);
      setStatus("The clearing is full; there is no open space for another clay square.");
      return;
    }
    state.selectedId = block.id;
    state.focusedId = block.id;
    renderDetail();
    drawMap();
    setStatus(tryCombine && target
      ? `${word.toLowerCase()} does not combine with that square yet; a copy was placed in the clearing.`
      : `A copy of ${word.toLowerCase()} was added to the clearing. The bank source remains.`);
    startActiveMovement();
  }

  function pointInsideRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function paletteDropTarget(clientX, clientY) {
    const point = canvasPoint({ clientX, clientY });
    const hud = gameHudLayout();
    const rect = canvas.getBoundingClientRect();
    const insideCanvas = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (!insideCanvas) return "outside";
    if (pointInsideRect(point.x, point.y, hud.bounds)) return "bank";
    return "garden";
  }

  function updatePaletteDropTarget(drag, clientX, clientY) {
    const region = paletteDropTarget(clientX, clientY);
    const point = canvasPoint({ clientX, clientY });
    const combineTarget = region === "garden" ? hitTest(point) : null;
    const target = combineTarget ? "combine" : region;
    if (drag.dropTarget === target) return;
    drag.dropTarget = target;
    if (target === "combine") {
      setStatus(`Drop ${drag.word.toLowerCase()} onto ${faceLabel(combineTarget.contents)} to combine directly from the bank.`);
    } else if (target === "garden") {
      setStatus("Drop in open garden to add a copy, or directly onto a block to combine.");
    } else if (target === "bank") {
      setStatus("Drop back in the element panel to cancel; the bank source stays available.");
    } else {
      setStatus("Drop clay in the garden to add a copy. The bank source stays in place.");
    }
  }

  function clearPaletteDrag() {
    palettePointerDrag = null;
    drawMap();
  }

  function movePalettePointerDrag(event) {
    const drag = palettePointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
    if (!drag.moved && distance < 6) return;
    event.preventDefault();
    drag.moved = true;
    drag.point = canvasPoint(event);
    updatePaletteDropTarget(drag, event.clientX, event.clientY);
    drawMap();
  }

  function finishPalettePointerDrag(event) {
    const drag = palettePointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.point = canvasPoint(event);
    palettePointerDrag = null;
    drawMap();
    if (!drag.moved) {
      addPaletteElement(drag.word, { x: state.layout.width / 2, y: state.layout.height / 2 }, false);
      return;
    }

    lastPaletteDropTime = performance.now();
    const target = paletteDropTarget(event.clientX, event.clientY);
    if (target === "bank") {
      setStatus("No copy added. The element remains available in the bank.");
      return;
    }
    if (target === "garden") {
      const dropPoint = {
        x: drag.point.x - drag.offsetX + state.layout.size / 2,
        y: drag.point.y - drag.offsetY + state.layout.size / 2
      };
      addPaletteElement(drag.word, dropPoint, true, drag.point);
      return;
    }
    setStatus("No clay was added. Drop the element over the garden; the bank source remains available.");
  }

  window.addEventListener("pointermove", movePalettePointerDrag, { passive: false });
  window.addEventListener("pointerup", finishPalettePointerDrag);
  window.addEventListener("pointercancel", event => {
    const drag = palettePointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    clearPaletteDrag();
    if (drag.moved) setStatus("Element drag cancelled. The bank source remains available.");
  });

  function renderElementBank() {
    elementBank.replaceChildren();
    for (const word of elementWords) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "element-token";
      const contents = element(word);
      const meaning = describe(contents);
      const spritePath = elementSpritePaths[meaning.id];
      const sprite = document.createElement("img");
      sprite.className = "element-token-art";
      sprite.alt = "";
      sprite.draggable = false;
      sprite.src = spritePath || tintedClay(meaning.colorMask).toDataURL();
      button.append(sprite);
      const label = document.createElement("span");
      label.className = "element-token-label";
      label.textContent = faceLabel(contents);
      label.style.fontSize = `${faceFontSize(label.textContent, state.layout.size)}px`;
      button.append(label);
      button.dataset.elementWord = word;
      button.draggable = false;
      button.setAttribute("aria-label", `Add a copy of ${faceLabel(contents)} to the game world`);
      elementBank.append(button);
    }
  }

  elementBank.addEventListener("click", event => {
    const button = event.target.closest("[data-element-word]");
    if (!button || performance.now() - lastPaletteDropTime < 400) return;
    addPaletteElement(button.dataset.elementWord, {
      x: state.layout.width / 2,
      y: state.layout.height / 2
    }, false);
  });

  const movementIds = ["do-move-left", "do-move-right", "do-move-up", "do-move-random"];

  function movementFor(block) {
    const meaning = describe(block.contents);
    if (movementIds.includes(meaning.id)) return { action: meaning, conditioned: false };
    if (meaning.id === "golem-pair" && activeSenseIds.includes(meaning.sense?.id) &&
        movementIds.includes(meaning.motive?.id)) {
      return { action: meaning.motive, conditioned: true };
    }
    return null;
  }

  function sensorFor(block) {
    const meaning = describe(block.contents);
    if (activeSenseIds.includes(meaning.id)) return meaning;
    if (meaning.id === "golem-pair" && meaning.behaviorImplemented &&
        activeSenseIds.includes(meaning.sense?.id)) {
      return meaning.sense;
    }
    return null;
  }

  function sensorIsTrue(block, sense) {
    const centerX = block.x + state.layout.size / 2;
    const centerY = block.y + state.layout.size / 2;
    const others = state.blocks.filter(other => !other.unplaced && other.id !== block.id);
    const senseKind = sense.senseKind || (sense.id === "while-hand" ? "touch" : "see");
    let positiveResult = false;
    if (senseKind === "see" && sense.direction) {
      const range = state.layout.cell * (sense.sightRangeCells || 3);
      const laneTolerance = state.layout.cell / 2;
      positiveResult = others.some(other => {
        const dx = other.x - block.x;
        const dy = other.y - block.y;
        if (sense.direction === "up") return Math.abs(dx) <= laneTolerance && dy < 0 && -dy <= range;
        if (sense.direction === "left") return Math.abs(dy) <= laneTolerance && dx < 0 && -dx <= range;
        if (sense.direction === "right") return Math.abs(dy) <= laneTolerance && dx > 0 && dx <= range;
        return false;
      });
    } else if (senseKind === "see") {
      const range = state.layout.cell * (sense.sightRangeCells || 3);
      positiveResult = others.some(other => Math.hypot(
        (other.x + state.layout.size / 2) - centerX,
        (other.y + state.layout.size / 2) - centerY
      ) <= range);
    } else if (senseKind === "touch") {
      const cell = state.layout.cell + 0.5;
      positiveResult = others.some(other =>
        Math.abs((other.x + state.layout.size / 2) - centerX) <= cell &&
        Math.abs((other.y + state.layout.size / 2) - centerY) <= cell
      );
    }
    return sense.negated ? !positiveResult : positiveResult;
  }

  function hasActivePrototypeBehavior(block) {
    return movementFor(block) !== null || sensorFor(block) !== null;
  }

  function tickActiveMovement() {
    const now = performance.now();
    const elapsed = lastMovementTime === null ? 0 : Math.min((now - lastMovementTime) / 1000, 0.1);
    lastMovementTime = now;
    const movers = state.blocks.map(block => ({ block, movement: movementFor(block) }))
      .filter(item => item.movement);
    const sightSensors = state.blocks.map(block => ({ block, sense: sensorFor(block) }))
      .filter(item => item.sense);
    if (!movers.length && !sightSensors.length) {
      window.clearInterval(movementTimer);
      movementTimer = null;
      lastMovementTime = null;
      return;
    }

    let moved = false;
    let sightChanged = false;
    const frame = imageFrame();
    // Evaluate each sense before moving its response, so a false sense stops
    // that movement on the same update rather than one timer tick later.
    for (const { block, sense } of sightSensors) {
      const wasInitialized = typeof block.senseActive === "boolean";
      const isTrue = sensorIsTrue(block, sense);
      if (block.senseActive !== isTrue) {
        block.senseActive = isTrue;
        sightChanged = true;
        if (state.selectedId === block.id) renderDetail();
        if (wasInitialized) {
          const pairLabel = describe(block.contents).id === "golem-pair";
          const senseKind = sense.senseKind || (sense.id === "while-hand" ? "touch" : "see");
          const senseLabel = sense.label.toLowerCase();
          const positiveCondition = senseKind === "touch"
            ? "another clay square is adjacent"
            : sense.direction
              ? `clay is directly ${sense.direction === "up" ? "above" : `to the ${sense.direction}`} within ${sense.sightRangeCells || 3} cells`
              : `clay is within ${sense.sightRangeCells || 3} cells`;
          const condition = isTrue
            ? (sense.negated ? `no ${positiveCondition}` : positiveCondition)
            : (sense.negated ? positiveCondition : `no ${positiveCondition}`);
          setStatus(isTrue
            ? `${pairLabel ? `${senseLabel} then move` : `while ${senseLabel}`} is true: ${condition}.`
            : `${pairLabel ? `${senseLabel} then move` : `while ${senseLabel}`} is false: ${condition}.`);
        }
      }
    }

    for (const { block, movement } of movers) {
      if (state.drag?.block.id === block.id || (movement.conditioned && !block.senseActive)) continue;
      const movementId = movement.action.id;
      if (movementId === "do-move-random" && (!block.nextDirectionChange || now >= block.nextDirectionChange)) {
        chooseRandomDirection(block, now);
      }
      let direction = movementId === "do-move-left"
        ? { x: -1, y: 0 }
        : movementId === "do-move-right"
          ? { x: 1, y: 0 }
          : movementId === "do-move-up"
            ? { x: 0, y: -1 }
            : block.randomDirection;
      let next = movementPosition(block, direction, elapsed, frame);
      if (next.blocked && movementId === "do-move-random") {
        const openDirections = shuffledCardinalDirections()
          .filter(candidate => candidate.x !== direction.x || candidate.y !== direction.y)
          .filter(candidate => !movementPosition(block, candidate, elapsed, frame).blocked);
        if (openDirections.length) {
          direction = openDirections[0];
          block.randomDirection = direction;
          block.nextDirectionChange = now + 1000 + Math.random() * 1400;
          next = movementPosition(block, direction, elapsed, frame);
        }
      }
      const { x: nextX, y: nextY, blocked } = next;
      if (blocked) {
        if (!block.movementBlocked) {
          block.movementBlocked = true;
          const obstruction = movementId === "do-move-random"
            ? "blocked in every direction by another square or the clearing edge"
            : "blocked by another square or the clearing edge";
          setStatus(`${faceLabel(block.contents)} keeps attempting, but this clay is ${obstruction}.`);
        }
        continue;
      }
      if (block.movementBlocked) {
        block.movementBlocked = false;
        setStatus(`${faceLabel(block.contents)} is moving again.`);
      }
      block.x = nextX;
      block.y = nextY;
      moved = true;
    }
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    const shouldPulse = sightSensors.some(({ block }) => block.senseActive) && !reducedMotion;
    if (moved || sightChanged || shouldPulse) drawMap();
  }

  function chooseRandomDirection(block, now) {
    const directions = shuffledCardinalDirections();
    block.randomDirection = directions[Math.floor(Math.random() * directions.length)];
    block.nextDirectionChange = now + 1000 + Math.random() * 1400;
  }

  function shuffledCardinalDirections() {
    return shuffle([{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]);
  }

  function movementPosition(block, direction, elapsed, frame) {
    const nextX = Math.max(0, Math.min(state.layout.width - state.layout.size, block.x + direction.x * movementSpeed * elapsed));
    const nextY = Math.max(0, Math.min(state.layout.height - state.layout.size, block.y + direction.y * movementSpeed * elapsed));
    const blocked = (nextX === block.x && nextY === block.y) ||
      !isSafeCell(nextX, nextY, state.layout.size, frame) ||
      overlapsAnotherBlock(block, nextX, nextY);
    return { x: nextX, y: nextY, blocked };
  }

  function startActiveMovement() {
    if (movementTimer || !state.blocks.some(hasActivePrototypeBehavior)) return;
    lastMovementTime = performance.now();
    movementTimer = window.setInterval(tickActiveMovement, 50);
  }

  function stopActiveMovement() {
    if (movementTimer) window.clearInterval(movementTimer);
    movementTimer = null;
    lastMovementTime = null;
  }

  function resumeActiveMovementAfterDrag(block) {
    if (block) block.movementBlocked = false;
    if (movementTimer) window.clearInterval(movementTimer);
    movementTimer = null;
    lastMovementTime = null;
    startActiveMovement();
  }

  function selectBlock(block) {
    if (state.selectedId === block.id) {
      state.selectedId = null;
      renderDetail();
      drawMap();
      setStatus("Selection cleared.");
      return;
    }
    state.selectedId = block.id;
    state.focusedId = block.id;
    renderDetail();
    drawMap();
    setStatus(`${faceLabel(block.contents)} selected. Drag it onto another square to combine.`);
  }

  function combine(target, dropped) {
    if (target.id === dropped.id) return;
    const result = resultExpression(target.contents, dropped.contents);
    if (!result) {
      state.selectedId = null;
      renderDetail();
      drawMap();
      setStatus(`No confirmed combination for ${faceLabel(target.contents)} + ${faceLabel(dropped.contents)}. Both squares stay in place.`);
      return false;
    }

    const targetLabel = faceLabel(target.contents);
    const droppedLabel = faceLabel(dropped.contents);
    target.contents = result;
    state.blocks = state.blocks.filter(block => block.id !== dropped.id);
    state.selectedId = target.id;
    state.focusedId = target.id;
    renderDetail();
    drawMap();
    const movementId = describe(target.contents).id;
    if (["do-move-left", "do-move-right", "do-move-up", "do-move-random"].includes(movementId)) {
      const movementNote = movementId === "do-move-random"
        ? "This tentative prototype guess wanders slowly in random directions; the game rule is not settled."
        : `This provisional action keeps trying to move slowly ${movementId.slice("do-move-".length)}; the movement rule remains open.`;
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. ${movementNote}`);
      startActiveMovement();
    } else if (activeSenseIds.includes(movementId)) {
      const range = describe(target.contents).sightRangeCells || 3;
      const sense = describe(target.contents);
      const senseKind = sense.senseKind || (movementId === "while-hand" ? "touch" : "see");
      const positiveCondition = senseKind === "touch"
        ? "another clay square is in an adjacent cell"
        : sense.direction
          ? `another clay square is directly ${sense.direction === "up" ? "above" : `to the ${sense.direction}`} within ${range} cells`
          : `any other clay square is within ${range} cells`;
      const condition = sense.negated ? `no ${positiveCondition}` : positiveCondition;
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. It senses when ${condition} and glows while the condition is true.`);
      startActiveMovement();
    } else if (movementId === "golem-pair" && describe(target.contents).behaviorImplemented) {
      const meaning = describe(target.contents);
      const range = meaning.sightRangeCells || 3;
      const touchResponse = (meaning.sense?.senseKind || (meaning.sense?.id === "while-hand" ? "touch" : "see")) === "touch";
      const positiveCondition = touchResponse
        ? "another clay square is adjacent"
        : meaning.sense?.direction
          ? `a clay square is directly ${meaning.sense.direction === "up" ? "above" : `to the ${meaning.sense.direction}`} within ${range} cells`
          : `another clay square is within ${range} cells`;
      const condition = meaning.sense?.negated ? `no ${positiveCondition}` : positiveCondition;
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. It moves only while ${condition}.`);
      startActiveMovement();
    } else {
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. ${describe(target.contents).certainty === "provisional" ? "This proposed expression has no active game behavior yet." : "The two squares have merged into one."}`);
    }
    return true;
  }

  canvas.addEventListener("pointerdown", event => {
    const point = canvasPoint(event);
    const hud = gameHudLayout();
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;

    // Hit-test the clay first because it is painted above the HUD.
    const block = hitTest(point);
    if (block) {
      event.preventDefault();
      state.focusedId = block.id;
      state.drag = {
        block,
        startX: block.x,
        startY: block.y,
        offsetX: point.x - block.x,
        offsetY: point.y - block.y,
        pointerId: event.pointerId,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        moved: false
      };
      canvas.setPointerCapture(event.pointerId);
      drawMap();
      return;
    }

    const token = hud.tokens.find(candidate => pointInsideRect(point.x, point.y, candidate));
    if (token) {
      event.preventDefault();
      palettePointerDrag = {
        word: token.word,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        offsetX: point.x - token.left,
        offsetY: point.y - token.top,
        point,
        moved: false,
        dropTarget: null
      };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
  });

  function moveWorldPointerDrag(event) {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    state.drag.lastClientX = event.clientX;
    state.drag.lastClientY = event.clientY;
    const point = canvasPoint(event);
    const drag = state.drag;
    if (!drag.moved && Math.hypot(point.x - (drag.startX + drag.offsetX), point.y - (drag.startY + drag.offsetY)) < 7) return;
    drag.moved = true;
    const overTopPanel = pointInsideRect(point.x, point.y, gameHudLayout().bounds);
    if (drag.overTopPanel !== overTopPanel) {
      drag.overTopPanel = overTopPanel;
      setStatus(overTopPanel
        ? "Release anywhere in the top panel to discard this clay block."
        : "Drop in the garden to place this block, or onto another block to combine.");
    }
    drag.block.x = Math.max(0, Math.min(state.layout.width - state.layout.size, point.x - drag.offsetX));
    drag.block.y = Math.max(0, Math.min(state.layout.height - state.layout.size, point.y - drag.offsetY));
    state.targetId = hitTest(point, drag.block.id)?.id || null;
    drawMap();
  }

  function finishWorldPointerDrag(event) {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const drag = state.drag;
    drag.lastClientX = event.clientX;
    drag.lastClientY = event.clientY;
    const point = canvasPoint(event);
    const target = hitTest(point, drag.block.id);
    const droppedInTopPanel = drag.moved && pointerIsOverTopPanel(event.clientX, event.clientY);
    state.drag = null;
    state.targetId = null;
    if (!drag.moved) {
      selectBlock(drag.block);
      resumeActiveMovementAfterDrag(drag.block);
      return;
    }
    if (droppedInTopPanel) {
      discardBlock(drag.block);
      return;
    }
    if (target && combine(target, drag.block)) {
      resumeActiveMovementAfterDrag(target);
      return;
    }
    if (dropInClearing(drag.block, drag.block.x, drag.block.y)) {
      state.selectedId = drag.block.id;
      state.focusedId = drag.block.id;
      renderDetail();
      drawMap();
      setStatus(target
        ? "Those squares do not combine; the dragged clay was placed in the clearing."
        : "Clay placed in the clearing.");
      resumeActiveMovementAfterDrag(drag.block);
      return;
    }
    drag.block.x = drag.startX;
    drag.block.y = drag.startY;
    drawMap();
    setStatus("The clearing is full; there is no open space for that clay.");
    resumeActiveMovementAfterDrag(drag.block);
  }

  function cancelWorldPointerDrag(event) {
    if (!state.drag) return;
    if (event.pointerId !== undefined && state.drag.pointerId !== event.pointerId) return;
    const drag = state.drag;
    const clientX = Number.isFinite(event.clientX) ? event.clientX : drag.lastClientX;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : drag.lastClientY;
    state.drag = null;
    state.targetId = null;
    if (drag.moved && pointerIsOverTopPanel(clientX, clientY)) {
      discardBlock(drag.block);
      return;
    }
    drag.block.x = drag.startX;
    drag.block.y = drag.startY;
    drawMap();
    resumeActiveMovementAfterDrag(state.blocks.find(block => hasActivePrototypeBehavior(block)));
  }

  window.addEventListener("pointermove", moveWorldPointerDrag, { passive: false });
  window.addEventListener("pointerup", finishWorldPointerDrag);
  window.addEventListener("pointercancel", cancelWorldPointerDrag);
  canvas.addEventListener("lostpointercapture", cancelWorldPointerDrag);

  canvas.addEventListener("keydown", event => {
    if (!state.blocks.length) return;
    const index = Math.max(0, state.blocks.findIndex(block => block.id === state.focusedId));
    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      const next = state.blocks[(index + step + state.blocks.length) % state.blocks.length];
      state.focusedId = next.id;
      drawMap();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const focused = state.blocks.find(block => block.id === state.focusedId) || state.blocks[0];
      selectBlock(focused);
    } else if (event.key === "Escape") {
      state.selectedId = null;
      renderDetail();
      drawMap();
    }
  });

  window.addEventListener("resize", resizeMap);
  if (document.fonts?.ready) document.fonts.ready.then(() => drawMap());
  shuffle(state.blocks);
  renderElementBank();
  resizeMap();
  renderDetail();
})();
