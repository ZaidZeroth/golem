(() => {
  "use strict";

  const canvas = document.querySelector("#map-canvas");
  const context = canvas.getContext("2d");
  const mapBoard = document.querySelector(".map-board");
  const detail = document.querySelector("#detail-content");
  const status = document.querySelector("#status");
  const resetButton = document.querySelector("#reset-button");
  const worldImage = new Image();
  worldImage.src = "assets/golem-world-blank.png";
  worldImage.addEventListener("load", () => drawMap());
  const clayImage = new Image();
  clayImage.src = "assets/golem-clay-lump-64px.png";
  clayImage.addEventListener("load", () => drawMap());
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
    return elementWords.flatMap((word, index) => [
      makeBlock(`block-${index}-a`, element(word)),
      makeBlock(`block-${index}-b`, element(word))
    ]);
  }

  const elementMeanings = {
    RED: { id: "red", category: "filter", label: "RED", reading: "red pigment", colorMask: 1 },
    GREEN: { id: "green", category: "filter", label: "GREEN", reading: "green pigment", colorMask: 2 },
    BLUE: { id: "blue", category: "filter", label: "BLUE", reading: "blue pigment", colorMask: 4 },
    BLOCK: { id: "block", category: "filter", label: "BLOCK", reading: "a clay block" },
    RIGHT: { id: "right", category: "filter", label: "RIGHT", reading: "the right direction" },
    UP: { id: "up", category: "filter", label: "UP", reading: "the upward direction" },
    HAND: { id: "hand", category: "sense-source", label: "HAND", reading: "touch", senseText: "touch" },
    EYE: { id: "eye", category: "sense-source", label: "SEE", reading: "sight", senseText: "seeing" },
    FEET: { id: "feet", category: "parked", label: "FEET", reading: "movement (not wired in this draft)" },
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
      return provisionalMeaning(`while-sight-${filter.id}`, "sense", `WHILE SEE ${filter.label}`, `while ${sightReading}`, { senseText: `while ${sightReading}` });
    }
    if ((left.id === "while" && right.category === "sense-source") ||
        (right.id === "while" && left.category === "sense-source")) {
      const sense = left.id === "while" ? right : left;
      const whilePhrases = {
        eye: "while seeing",
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
      return provisionalMeaning(`while-${sense.id}`, "sense", `WHILE ${sense.label}`, phrase, { senseText: phrase });
    }
    if ((left.id === "while" && ["sense", "filter"].includes(right.category)) ||
        (right.id === "while" && ["sense", "filter"].includes(left.category))) {
      const sense = left.id === "while" ? right : left;
      const phrase = sense.id === "not-red"
        ? "while I contain no red pigment"
        : `while ${sense.senseText || sense.reading}`;
      return provisionalMeaning(`while-${sense.id}`, "sense", `WHILE ${sense.label}`, phrase, { senseText: phrase });
    }
    if ((left.id === "do" && ["hand", "fist", "red", "eye", "not-eye", "combine", "left-hand", "right-hand", "left-fist", "right-fist"].includes(right.id)) ||
        (right.id === "do" && ["hand", "fist", "red", "eye", "not-eye", "combine", "left-hand", "right-hand", "left-fist", "right-fist"].includes(left.id))) {
      const action = left.id === "do" ? right : left;
      const actions = {
        hand: ["DROP", "drop the held piece"],
        fist: ["GRAB", "grab a piece"],
        red: ["ADD RED", "add red pigment"],
        eye: ["OPEN EYES", "open the eyes"],
        "not-eye": ["DON'T LOOK", "don't look"],
        combine: ["COMBINE", "combine the blocks held in both hands"],
        "left-hand": ["DROP LEFT", "drop what is in the left hand"],
        "right-hand": ["DROP RIGHT", "drop what is in the right hand"],
        "left-fist": ["GRAB LEFT", "grab with the left hand"],
        "right-fist": ["GRAB RIGHT", "grab with the right hand"]
      };
      const [label, reading] = actions[action.id];
      return provisionalMeaning(`do-${action.id}`, "motive", `DO ${label}`, reading);
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

  function buildRecipeExamples() {
    const words = Object.fromEntries(elementWords.map(word => [word, element(word)]));
    const join = (left, right) => left && right ? resultExpression(left, right) : null;
    const recipes = new Set();
    const bothOrders = (left, right) => {
      for (const [first, second] of [[left, right], [right, left]]) {
        const result = join(first, second);
        if (result) recipes.add(`${faceLabel(first)} + ${faceLabel(second)} → ${faceLabel(result)}`);
      }
    };

    const notRed = join(words.NOT, words.RED);
    const yellow = join(words.RED, words.GREEN);
    const magenta = join(words.RED, words.BLUE);
    const cyan = join(words.GREEN, words.BLUE);
    const fist = join(words.NOT, words.HAND);
    const combine = join(words.HAND, words.HAND);
    const left = join(words.RIGHT, words.NOT);
    const notEye = join(words.NOT, words.EYE);
    const seeRed = join(words.EYE, words.RED);
    const seeNotRed = join(words.EYE, notRed);
    const whileEye = join(words.WHILE, words.EYE);
    const whileHand = join(words.WHILE, words.HAND);
    const whileFit = join(words.WHILE, words.FIT);
    const whileHandAnd = join(whileHand, words.AND);
    const doFist = join(words.DO, fist);
    const inMe = join(words.IN, words.ME);

    [
      [words.RED, words.GREEN],
      [words.RED, words.BLUE],
      [words.GREEN, words.BLUE],
      [magenta, words.GREEN],
      [yellow, words.BLUE],
      [cyan, words.RED],
      [words.DO, words.RED],
      [words.NOT, words.RED],
      [words.NOT, words.HAND],
      [words.NOT, fist],
      [words.HAND, words.HAND],
      [words.RIGHT, words.NOT],
      [left, words.NOT],
      [words.NOT, words.EYE],
      [words.DO, words.EYE],
      [words.DO, notEye],
      [words.RIGHT, words.HAND],
      [left, fist],
      [words.EYE, words.RED],
      [words.EYE, notRed],
      [words.EYE, words.RIGHT],
      [words.WHILE, words.EYE],
      [words.WHILE, seeRed],
      [words.WHILE, seeNotRed],
      [words.WHILE, words.HAND],
      [words.WHILE, fist],
      [words.WHILE, words.FIT],
      [words.WHILE, notRed],
      [words.WHILE, seeNotRed],
      [words.WHILE, join(words.RIGHT, words.HAND)],
      [whileHand, words.AND],
      [whileHandAnd, whileFit],
      [whileEye, words.OR],
      [join(whileEye, words.OR), whileHand],
      [words.DO, words.HAND],
      [words.DO, fist],
      [words.DO, words.RED],
      [words.DO, words.EYE],
      [words.DO, notEye],
      [words.DO, combine],
      [words.DO, join(left, words.HAND)],
      [words.DO, join(words.RIGHT, fist)],
      [words.IN, words.ME],
      [inMe, notRed],
      [whileHand, doFist]
    ].forEach(([first, second]) => bothOrders(first, second));

    return [...recipes].sort((a, b) => a.localeCompare(b));
  }

  function renderRecipes() {
    const list = document.querySelector("#recipe-list");
    for (const recipe of buildRecipeExamples()) {
      const item = document.createElement("li");
      item.textContent = recipe;
      list.append(item);
    }
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
    layout: { size: 56, cell: 70, columns: 1, width: 1, height: 1, dpr: 1 }
  };

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
    const size = Math.max(44, Math.min(76, width / 10));
    const cell = size + 14;
    const columns = Math.max(2, Math.floor((width - 12) / cell));
    const rows = Math.ceil(state.blocks.length / columns);
    const height = rows * cell + 24;
    const dpr = window.devicePixelRatio || 1;
    state.layout = { size, cell, columns, width, height, dpr };
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    arrangeBlocks();
    drawMap();
  }

  function arrangeBlocks() {
    const { columns, cell, size } = state.layout;
    const slots = shuffle(state.blocks.map((_, index) => index));
    state.blocks.forEach((block, index) => {
      const slot = slots[index];
      const column = slot % columns;
      const row = Math.floor(slot / columns);
      const inset = Math.max(6, (cell - size) / 2);
      const jitter = Math.min(3, inset / 3);
      block.x = 12 + column * cell + inset + (Math.random() - 0.5) * jitter;
      block.y = 12 + row * cell + inset + (Math.random() - 0.5) * jitter;
    });
  }

  function drawMap() {
    const { width, height, size } = state.layout;
    context.clearRect(0, 0, width, height);
    if (worldImage.complete && worldImage.naturalWidth) {
      const scale = Math.max(width / worldImage.naturalWidth, height / worldImage.naturalHeight);
      const drawWidth = worldImage.naturalWidth * scale;
      const drawHeight = worldImage.naturalHeight * scale;
      context.drawImage(worldImage, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    } else {
      context.fillStyle = "#263328";
      context.fillRect(0, 0, width, height);
    }
    for (const block of state.blocks) {
      const selected = block.id === state.selectedId;
      const focused = block.id === state.focusedId;
      const target = block.id === state.targetId;
      if (clayImage.complete && clayImage.naturalWidth) {
        context.drawImage(clayImage, block.x, block.y, size, size);
        const colorMask = describe(block.contents).colorMask;
        const tint = {
          1: "rgb(190 55 48 / 55%)",
          2: "rgb(68 143 73 / 55%)",
          3: "rgb(222 192 55 / 58%)",
          4: "rgb(65 112 193 / 55%)",
          5: "rgb(196 67 157 / 58%)",
          6: "rgb(61 183 184 / 58%)",
          7: "rgb(238 239 228 / 72%)"
        }[colorMask] || "rgb(48 51 57 / 82%)";
        context.save();
        context.globalCompositeOperation = "source-atop";
        context.fillStyle = tint;
        context.fillRect(block.x, block.y, size, size);
        context.restore();
      } else {
        context.fillStyle = "#aaa7a0";
        context.fillRect(block.x, block.y, size, size);
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
      context.font = `800 ${faceFontSize(faceLabel(block.contents), size)}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
      context.shadowColor = "rgb(255 247 224 / 90%)";
      context.shadowBlur = 2;
      const label = faceLabel(block.contents);
      context.strokeText(label, block.x + size / 2, block.y + size / 2, size - 8);
      context.fillText(label, block.x + size / 2, block.y + size / 2, size - 8);
      context.shadowBlur = 0;
    }
  }

  function faceFontSize(label, size) {
    return Math.max(9, Math.min(16, size * 0.29 - Math.max(0, label.length - 7) * 0.55));
  }

  function renderDetail() {
    const selected = allBlocks().find(block => block.id === state.selectedId);
    if (!selected) {
      detail.innerHTML = '<p class="detail-placeholder">Select a square to see its exact construction and natural-language reading.</p>';
      return;
    }
    const meaning = describe(selected.contents);
    const provisional = meaning.certainty === "provisional" || meaning.certainty === "unresolved";
    detail.innerHTML = `<dl class="detail-list"><div><dt>Construction</dt><dd class="detail-construction"></dd></div><div><dt>Natural language</dt><dd class="detail-reading"></dd><small class="reading-status">${provisional ? "Proposed reading · behavior not simulated" : "Element"}</small></div></dl>`;
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
      if (block.id === exceptId) continue;
      if (point.x >= block.x && point.x <= block.x + size &&
          point.y >= block.y && point.y <= block.y + size) return block;
    }
    return null;
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
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
    setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. ${describe(target.contents).certainty === "provisional" ? "This proposed expression has no active game behavior yet." : "The two squares have merged into one."}`);
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
    state.drag = null;
    state.targetId = null;
    if (!drag.moved) {
      selectOrCombine(drag.block);
      return;
    }
    if (!target || !combine(target, drag.block)) {
      drag.block.x = drag.startX;
      drag.block.y = drag.startY;
      drawMap();
      if (!target) setStatus("Drop a square onto another square to try a combination.");
    }
  });

  canvas.addEventListener("pointercancel", () => {
    if (!state.drag) return;
    state.drag.block.x = state.drag.startX;
    state.drag.block.y = state.drag.startY;
    state.drag = null;
    state.targetId = null;
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

  window.addEventListener("resize", resizeMap);
  shuffle(state.blocks);
  resizeMap();
  renderDetail();
  renderRecipes();
})();
