(() => {
  "use strict";

  const canvas = document.querySelector("#map-canvas");
  const context = canvas.getContext("2d");
  const mapBoard = document.querySelector(".map-board");
  const elementBank = document.querySelector("#element-bank");
  const detail = document.querySelector("#detail-content");
  const status = document.querySelector("#status");
  const resetButton = document.querySelector("#reset-button");
  const trashButton = document.querySelector("#trash-button");
  const worldImage = new Image();
  worldImage.src = "assets/golem-world-blank.png";
  worldImage.addEventListener("load", () => drawMap());
  const clayImage = new Image();
  clayImage.src = "assets/golem-clay-lump-64px.png";
  clayImage.addEventListener("load", () => drawMap());
  const miniGolemImage = new Image();
  miniGolemImage.src = "assets/golem-mini-golem-front-64px.png";
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
    "RED", "GREEN", "BLUE", "BLOCK", "NOT", "AND", "OR", "RIGHT", "UP",
    "WHILE", "DO", "HAND", "EYE", "FEET", "IN", "ME", "FIT"
  ];
  const pair = (left, right) => [left, right].sort().join("\u0000");

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
    if (ids === pair("right", "do-move-random")) {
      return provisionalMeaning(
        "do-move-right", "motive", "MOVE RIGHT",
        "move slowly to the right continuously; tentative directional prototype interpretation"
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
    if (left.id === "eye" && right.category === "filter" || right.id === "eye" && left.category === "filter") {
      const filter = left.id === "eye" ? right : left;
      const sightReading = ["left", "right", "up"].includes(filter.id)
        ? `seeing something to the ${filter.label.toLowerCase()}`
        : `seeing ${filter.reading}`;
      return provisionalMeaning(`sight-${filter.id}`, "sense", `SEE ${filter.label}`, sightReading, { senseText: sightReading });
    }
    if ((left.id === "while-eye" && right.category === "filter") ||
        (right.id === "while-eye" && left.category === "filter")) {
      const filter = left.id === "while-eye" ? right : left;
      const sightReading = ["left", "right", "up"].includes(filter.id)
        ? `seeing something to the ${filter.label.toLowerCase()}`
        : `seeing ${filter.reading}`;
      return provisionalMeaning(`while-sight-${filter.id}`, "sense", `SEE ${filter.label}`, `while ${sightReading}`, { senseText: `while ${sightReading}` });
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
      return provisionalMeaning("golem-pair", "golem", "GOLEM", `a golem with ${sense.reading}, set to ${motive.reading}; activation is not defined`, { sense, motive });
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
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    arrangeBlocks();
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

  function tintedClay(colorMask) {
    if (clayTintCache.has(colorMask)) return clayTintCache.get(colorMask);
    const tint = {
      1: "rgb(190 55 48 / 55%)",
      2: "rgb(68 143 73 / 55%)",
      3: "rgb(222 192 55 / 58%)",
      4: "rgb(65 112 193 / 55%)",
      5: "rgb(196 67 157 / 58%)",
      6: "rgb(61 183 184 / 58%)",
      7: "rgb(238 239 228 / 72%)"
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
      1: "rgb(190 55 48 / 55%)",
      2: "rgb(68 143 73 / 55%)",
      3: "rgb(222 192 55 / 58%)",
      4: "rgb(65 112 193 / 55%)",
      5: "rgb(196 67 157 / 58%)",
      6: "rgb(61 183 184 / 58%)",
      7: "rgb(238 239 228 / 72%)"
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
    for (const block of state.blocks) {
      if (block.unplaced) continue;
      const selected = block.id === state.selectedId;
      const focused = block.id === state.focusedId;
      const target = block.id === state.targetId;
      const meaning = describe(block.contents);
      const isCreature = ["sense", "motive", "golem"].includes(meaning.category);
      const sightIsTrue = meaning.id === "while-eye" && block.senseActive;
      const colorMask = meaning.colorIntentMask ?? meaning.colorMask ?? 0;
      const elementSprite = elementSprites[meaning.id];
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
        context.drawImage(elementSprite, block.x, block.y, size, size);
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
    const sightRangeCells = meaning.sightRangeCells || 3;
    const sightStatus = meaning.id === "while-eye"
      ? selected.senseActive
        ? `Sensing true · clay within ${sightRangeCells} cells`
        : `Sensing false · no clay within ${sightRangeCells} cells`
      : null;
    const movementStatuses = {
      "do-move-left": "Prototype movement experiment · the language rule remains open",
      "do-move-right": "Prototype movement experiment · the language rule remains open",
      "do-move-random": "Tentative random-walk experiment · the language rule remains open"
    };
    const readingStatus = sightStatus || movementStatuses[meaning.id] ||
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

  function pointerIsOverTrash(clientX, clientY) {
    const rect = trashButton.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top && clientY <= rect.bottom;
  }

  function discardBlock(block) {
    state.blocks = state.blocks.filter(candidate => candidate.id !== block.id);
    if (state.selectedId === block.id) state.selectedId = null;
    if (state.focusedId === block.id) state.focusedId = null;
    if (state.targetId === block.id) state.targetId = null;
    if (!state.blocks.some(candidate =>
      ["do-move-left", "do-move-right", "do-move-random", "while-eye"].includes(describe(candidate.contents).id)
    )) stopActiveMovement();
    renderDetail();
    drawMap();
    setStatus(`${faceLabel(block.contents)} discarded.`);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
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

  function addPaletteElement(word, point, tryCombine) {
    const target = tryCombine ? hitTest(point) : null;
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

  function renderElementBank() {
    for (const word of elementWords) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "element-token";
      const meaning = describe(element(word));
      const spritePath = elementSpritePaths[meaning.id];
      if (spritePath) {
        const sprite = document.createElement("img");
        sprite.src = spritePath;
        sprite.alt = "";
        sprite.className = "element-token-sprite";
        sprite.draggable = false;
        button.append(sprite);
      }
      const label = document.createElement("span");
      label.textContent = faceLabel(element(word));
      button.append(label);
      button.dataset.elementWord = word;
      button.draggable = true;
      button.setAttribute("aria-label", `Add a copy of ${faceLabel(element(word))} to the game world`);
      button.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", word);
        event.dataTransfer.effectAllowed = "copy";
      });
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

  canvas.addEventListener("dragover", event => {
    if (event.dataTransfer?.types.includes("text/plain")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  });

  canvas.addEventListener("drop", event => {
    event.preventDefault();
    const word = event.dataTransfer?.getData("text/plain");
    if (!elementMeanings[word]) return;
    lastPaletteDropTime = performance.now();
    addPaletteElement(word, canvasPoint(event), true);
  });

  function tickActiveMovement() {
    const now = performance.now();
    const elapsed = lastMovementTime === null ? 0 : Math.min((now - lastMovementTime) / 1000, 0.1);
    lastMovementTime = now;
    const movers = state.blocks.filter(block =>
      ["do-move-left", "do-move-right", "do-move-random"].includes(describe(block.contents).id)
    );
    const sightSensors = state.blocks.filter(block => describe(block.contents).id === "while-eye");
    if (!movers.length && !sightSensors.length) {
      window.clearInterval(movementTimer);
      movementTimer = null;
      lastMovementTime = null;
      return;
    }

    let moved = false;
    let sightChanged = false;
    const frame = imageFrame();
    for (const block of movers) {
      if (state.drag?.block.id === block.id) continue;
      const movementId = describe(block.contents).id;
      if (movementId === "do-move-random" && (!block.nextDirectionChange || now >= block.nextDirectionChange)) {
        chooseRandomDirection(block, now);
      }
      const direction = movementId === "do-move-left"
        ? { x: -1, y: 0 }
        : movementId === "do-move-right"
          ? { x: 1, y: 0 }
          : block.randomDirection;
      const nextX = Math.max(0, Math.min(state.layout.width - state.layout.size, block.x + direction.x * movementSpeed * elapsed));
      const nextY = Math.max(0, Math.min(state.layout.height - state.layout.size, block.y + direction.y * movementSpeed * elapsed));
      const blocked = (nextX === block.x && nextY === block.y) ||
        !isSafeCell(nextX, nextY, state.layout.size, frame) ||
        overlapsAnotherBlock(block, nextX, nextY);
      if (blocked) {
        if (!block.movementBlocked) {
          block.movementBlocked = true;
          setStatus(`${faceLabel(block.contents)} keeps attempting, but this clay is blocked by another square or the clearing edge.`);
        }
        if (movementId === "do-move-random") chooseRandomDirection(block, now);
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
    for (const sensor of sightSensors) {
      const sightRangeCells = describe(sensor.contents).sightRangeCells || 3;
      const sightRange = state.layout.cell * sightRangeCells;
      const wasInitialized = typeof sensor.senseActive === "boolean";
      const isTrue = state.blocks.some(other => other.id !== sensor.id &&
        Math.hypot(
          (other.x + state.layout.size / 2) - (sensor.x + state.layout.size / 2),
          (other.y + state.layout.size / 2) - (sensor.y + state.layout.size / 2)
        ) <= sightRange);
      if (sensor.senseActive !== isTrue) {
        sensor.senseActive = isTrue;
        sightChanged = true;
        if (state.selectedId === sensor.id) renderDetail();
        if (wasInitialized) {
          setStatus(isTrue
            ? `while see is true: clay is within ${sightRangeCells} cells.`
            : `while see is false: no clay is within ${sightRangeCells} cells.`);
        }
      }
    }
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    const shouldPulse = sightSensors.some(sensor => sensor.senseActive) && !reducedMotion;
    if (moved || sightChanged || shouldPulse) drawMap();
  }

  function chooseRandomDirection(block, now) {
    const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    block.randomDirection = directions[Math.floor(Math.random() * directions.length)];
    block.nextDirectionChange = now + 1000 + Math.random() * 1400;
  }

  function startActiveMovement() {
    if (movementTimer || !state.blocks.some(block =>
      ["do-move-left", "do-move-right", "do-move-random", "while-eye"].includes(describe(block.contents).id)
    )) return;
    lastMovementTime = performance.now();
    movementTimer = window.setInterval(tickActiveMovement, 50);
  }

  function stopActiveMovement() {
    if (movementTimer) window.clearInterval(movementTimer);
    movementTimer = null;
    lastMovementTime = null;
  }

  function selectOrCombine(block) {
    if (!state.selectedId) {
      state.selectedId = block.id;
      state.focusedId = block.id;
      renderDetail();
      drawMap();
      setStatus(`${faceLabel(block.contents)} selected. Choose a second square in order, or select it again to clear.`);
      return;
    }
    const first = allBlocks().find(candidate => candidate.id === state.selectedId);
    if (first && first.id === block.id) {
      state.selectedId = null;
      renderDetail();
      drawMap();
      setStatus("Selection cleared.");
      return;
    }
    if (first) combine(first, block);
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
    if (["do-move-left", "do-move-right", "do-move-random"].includes(movementId)) {
      const movementNote = movementId === "do-move-random"
        ? "This tentative prototype guess wanders slowly in random directions; the game rule is not settled."
        : `This provisional action keeps trying to move slowly ${movementId === "do-move-left" ? "left" : "right"}; the movement rule remains open.`;
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. ${movementNote}`);
      startActiveMovement();
    } else if (movementId === "while-eye") {
      const range = describe(target.contents).sightRangeCells || 3;
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. It senses any other clay square within ${range} cells and glows while the condition is true.`);
      startActiveMovement();
    } else {
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. ${describe(target.contents).certainty === "provisional" ? "This proposed expression has no active game behavior yet." : "The two squares have merged into one."}`);
    }
    return true;
  }

  canvas.addEventListener("pointerdown", event => {
    const point = canvasPoint(event);
    const block = hitTest(point);
    if (!block) return;
    event.preventDefault();
    state.focusedId = block.id;
    state.drag = {
      block,
      startX: block.x,
      startY: block.y,
      offsetX: point.x - block.x,
      offsetY: point.y - block.y,
      pointerId: event.pointerId,
      moved: false
    };
    canvas.setPointerCapture(event.pointerId);
    drawMap();
  });

  canvas.addEventListener("pointermove", event => {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const point = canvasPoint(event);
    const drag = state.drag;
    if (!drag.moved && Math.hypot(point.x - (drag.startX + drag.offsetX), point.y - (drag.startY + drag.offsetY)) < 7) return;
    drag.moved = true;
    trashButton.classList.toggle("drop-ready", pointerIsOverTrash(event.clientX, event.clientY));
    drag.block.x = Math.max(0, Math.min(state.layout.width - state.layout.size, point.x - drag.offsetX));
    drag.block.y = Math.max(0, Math.min(state.layout.height - state.layout.size, point.y - drag.offsetY));
    state.targetId = hitTest(point, drag.block.id)?.id || null;
    drawMap();
  });

  canvas.addEventListener("pointerup", event => {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const drag = state.drag;
    const point = canvasPoint(event);
    const target = hitTest(point, drag.block.id);
    const droppedInTrash = drag.moved && pointerIsOverTrash(event.clientX, event.clientY);
    state.drag = null;
    state.targetId = null;
    trashButton.classList.remove("drop-ready");
    if (!drag.moved) {
      selectOrCombine(drag.block);
      return;
    }
    if (droppedInTrash) {
      discardBlock(drag.block);
      return;
    }
    if (target && combine(target, drag.block)) {
      startActiveMovement();
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
      startActiveMovement();
      return;
    }
    drag.block.x = drag.startX;
    drag.block.y = drag.startY;
    drawMap();
    setStatus("The clearing is full; there is no open space for that clay.");
  });

  canvas.addEventListener("pointercancel", () => {
    if (!state.drag) return;
    state.drag.block.x = state.drag.startX;
    state.drag.block.y = state.drag.startY;
    state.drag = null;
    state.targetId = null;
    trashButton.classList.remove("drop-ready");
    drawMap();
  });

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
      selectOrCombine(focused);
    } else if (event.key === "Escape") {
      state.selectedId = null;
      renderDetail();
      drawMap();
    }
  });

  resetButton.addEventListener("click", () => {
    stopActiveMovement();
    state.blocks = makeInitialBlocks();
    state.selectedId = null;
    state.focusedId = null;
    state.drag = null;
    state.targetId = null;
    shuffle(state.blocks);
    arrangeBlocks();
    renderDetail();
    drawMap();
    setStatus("Board reset.");
  });

  trashButton.addEventListener("click", () => {
    const selected = state.blocks.find(block => block.id === state.selectedId);
    if (!selected) {
      setStatus("Select a clay square or drag one to the bin to discard it.");
      return;
    }
    discardBlock(selected);
  });

  window.addEventListener("resize", resizeMap);
  if (document.fonts?.ready) document.fonts.ready.then(() => drawMap());
  shuffle(state.blocks);
  renderElementBank();
  resizeMap();
  renderDetail();
})();
