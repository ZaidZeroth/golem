(() => {
  "use strict";

  const canvas = document.querySelector("#map-canvas");
  const context = canvas.getContext("2d");
  const mapBoard = document.querySelector(".map-board");
  const detail = document.querySelector("#detail-content");
  const status = document.querySelector("#status");
  const resetButton = document.querySelector("#reset-button");
  const elementWords = [
    "RED", "GREEN", "BLUE", "BLOCK", "NOT", "AND", "OR", "RIGHT", "UP",
    "WHILE", "DO", "HAND", "EYE", "FEET", "IN", "ME", "FIT"
  ];
  const combinations = new Set([
    pairKey(element("NOT"), element("RED"))
  ]);

  function element(word) {
    return { type: "element", word };
  }

  function compound(left, right) {
    return { type: "compound", left, right };
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

  function expressionKey(expression) {
    if (expression.type === "element") return `element:${expression.word}`;
    return `compound:${expressionKey(expression.left)}+${expressionKey(expression.right)}`;
  }

  function pairKey(left, right) {
    return [expressionKey(left), expressionKey(right)].sort().join("\u0000");
  }

  function displayWords(expression) {
    if (expression.type === "element") return [expression.word === "EYE" ? "SEE" : expression.word];
    return [...displayWords(expression.left), ...displayWords(expression.right)];
  }

  function isNotRed(expression) {
    return expression.type === "compound" &&
      pairKey(expression.left, expression.right) === pairKey(element("NOT"), element("RED"));
  }

  function faceLabel(expression) {
    if (isNotRed(expression)) return "NOT RED";
    if (expression.type === "compound" && expression.left.type === "element" &&
        expression.left.word === "EYE" && isNotRed(expression.right)) return "SEE NOT RED";
    if (expression.type === "compound" && expression.left.type === "element" &&
        expression.left.word === "WHILE") return `WHILE ${faceLabel(expression.right)}`;
    return displayWords(expression).join(" ");
  }

  function construction(expression) {
    if (expression.type === "element") return expression.word;
    return `(${construction(expression.left)} + ${construction(expression.right)})`;
  }

  function plainLanguage(expression) {
    if (expression.type === "element" && expression.word === "RED") return "red pigment";
    if (isNotRed(expression)) return "clay that does not contain red pigment";
    if (expression.type === "compound" && expression.left.type === "element" &&
        expression.left.word === "EYE" && isNotRed(expression.right)) {
      return "seeing clay that does not contain red pigment";
    }
    if (expression.type === "compound" && expression.left.type === "element" &&
        expression.left.word === "WHILE" && expression.right.type === "compound" &&
        expression.right.left.type === "element" && expression.right.left.word === "EYE" &&
        isNotRed(expression.right.right)) {
      return "while seeing clay that does not contain red pigment";
    }
    return "No reading has been agreed for this expression.";
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
    for (const block of state.blocks) {
      const selected = block.id === state.selectedId;
      const focused = block.id === state.focusedId;
      const target = block.id === state.targetId;
      context.fillStyle = target ? "#66543b" : "#38453b";
      context.strokeStyle = selected ? "#e5a66a" : focused ? "#d7b675" : "#98ae83";
      context.lineWidth = selected || focused || target ? 3 : 2;
      context.fillRect(block.x, block.y, size, size);
      context.strokeRect(block.x + 1, block.y + 1, size - 2, size - 2);
      context.fillStyle = "#f5ecd9";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `800 ${faceFontSize(faceLabel(block.contents), size)}px system-ui, sans-serif`;
      context.fillText(faceLabel(block.contents), block.x + size / 2, block.y + size / 2, size - 8);
    }
  }

  function faceFontSize(label, size) {
    return Math.max(9, Math.min(16, size * 0.29 - Math.max(0, label.length - 7) * 0.55));
  }

  function renderDetail() {
    const selected = allBlocks().find(block => block.id === state.selectedId);
    if (!selected) {
      detail.innerHTML = '<p class="detail-placeholder">Select a square to see its exact construction and provisional reading.</p>';
      return;
    }
    detail.innerHTML = '<dl class="detail-list"><div><dt>Construction</dt><dd class="detail-construction"></dd></div><div><dt>Provisional reading</dt><dd class="detail-reading"></dd></div></dl>';
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
    const combinationKey = pairKey(target.contents, dropped.contents);
    if (!combinations.has(combinationKey)) {
      state.selectedId = null;
      renderDetail();
      drawMap();
      setStatus(`No confirmed combination for ${faceLabel(target.contents)} + ${faceLabel(dropped.contents)}. Both squares stay in place.`);
      return false;
    }

    const targetLabel = faceLabel(target.contents);
    const droppedLabel = faceLabel(dropped.contents);
    target.contents = compound(target.contents, dropped.contents);
    state.blocks = state.blocks.filter(block => block.id !== dropped.id);
    state.selectedId = target.id;
    state.focusedId = target.id;
    renderDetail();
    drawMap();
    setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. The two squares have merged into one.`);
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
    setStatus("Map reshuffled. Try combining NOT with RED.");
  });

  window.addEventListener("resize", resizeMap);
  shuffle(state.blocks);
  resizeMap();
  renderDetail();
})();
