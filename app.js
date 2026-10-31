(() => {
  "use strict";

  const sourceTray = document.querySelector("#source-tray");
  const resultTray = document.querySelector("#result-tray");
  const emptyState = document.querySelector("#empty-state");
  const detail = document.querySelector("#detail-content");
  const status = document.querySelector("#status");
  const resetButton = document.querySelector("#reset-button");

  function element(word) {
    return { type: "element", word };
  }

  function compound(left, right) {
    return { type: "compound", left, right };
  }

  function makeBlock(id, contents) {
    // The block is the square entity; contents is its word expression.
    return { id, contents };
  }

  const initialBlocks = [
    makeBlock("block-not", element("NOT")),
    makeBlock("block-red", element("RED"))
  ];

  function expressionKey(expression) {
    if (expression.type === "element") return `element:${expression.word}`;
    return `compound:${expressionKey(expression.left)}+${expressionKey(expression.right)}`;
  }

  function pairKey(left, right) {
    return [expressionKey(left), expressionKey(right)].sort().join("\u0000");
  }

  function displayExpression(expression) {
    if (expression.type === "element") return expression.word;
    return `${displayExpression(expression.left)} ${displayExpression(expression.right)}`;
  }

  function construction(expression) {
    if (expression.type === "element") return expression.word;
    return `${construction(expression.left)} + ${construction(expression.right)}`;
  }

  // Only this confirmed word combination is implemented. Matching patterns
  // against block entities is a separate design question and stays unsupported.
  const combinations = new Map([
    [pairKey(element("NOT"), element("RED")), compound(element("NOT"), element("RED"))]
  ]);

  const state = { results: [], selectedId: null, drag: null, suppressClick: false };

  function allBlocks() {
    return [...initialBlocks, ...state.results];
  }

  function blockKind(block) {
    return block.contents.type === "element" ? "element" : "compound";
  }

  function makeButton(block, isResult = false) {
    const button = document.createElement("button");
    const label = displayExpression(block.contents);
    const kind = blockKind(block);
    button.type = "button";
    button.className = `word-block${isResult ? " result-block" : ""}`;
    button.dataset.blockId = block.id;
    button.setAttribute("aria-pressed", String(state.selectedId === block.id));
    button.setAttribute("aria-label", `${kind} block containing ${label}. Select this block, then another to try a combination.`);
    button.innerHTML = '<span class="block-word"></span><span class="block-kind"></span>';
    button.querySelector(".block-word").textContent = label;
    button.querySelector(".block-kind").textContent = kind;
    button.addEventListener("click", () => {
      if (state.suppressClick) {
        state.suppressClick = false;
        return;
      }
      selectOrCombine(block);
    });
    button.addEventListener("pointerdown", event => beginDrag(event, block, button));
    return button;
  }

  function renderDetail() {
    const selected = allBlocks().find(block => block.id === state.selectedId);
    if (!selected) {
      detail.innerHTML = '<p class="detail-placeholder">Choose a square to inspect its contents and construction.</p>';
      return;
    }

    detail.innerHTML = '<dl class="detail-list"><div><dt>Entity</dt><dd class="detail-entity"></dd></div><div><dt>Contents</dt><dd class="detail-contents"></dd></div><div><dt>Construction</dt><dd class="detail-construction"></dd></div></dl>';
    detail.querySelector(".detail-entity").textContent = `Square block · ${blockKind(selected)}`;
    detail.querySelector(".detail-contents").textContent = displayExpression(selected.contents);
    detail.querySelector(".detail-construction").textContent = construction(selected.contents);
  }

  function render() {
    sourceTray.replaceChildren(...initialBlocks.map(block => makeButton(block)));
    if (state.results.length === 0) {
      resultTray.replaceChildren(emptyState);
    } else {
      resultTray.replaceChildren(...state.results.map(block => makeButton(block, true)));
    }
    for (const button of document.querySelectorAll(".word-block")) {
      if (button.dataset.blockId === state.selectedId) button.classList.add("is-selected");
    }
    renderDetail();
  }

  function selectOrCombine(block) {
    if (!state.selectedId) {
      state.selectedId = block.id;
      setStatus(`${displayExpression(block.contents)} selected. Choose a second square to try a pair.`);
      render();
      return;
    }

    const first = allBlocks().find(candidate => candidate.id === state.selectedId);
    state.selectedId = null;
    if (!first) {
      render();
      setStatus("Selection cleared. Choose two squares to combine.");
      return;
    }
    combine(first, block);
  }

  function combine(first, second) {
    state.selectedId = null;
    if (first.id === second.id) {
      render();
      setStatus("Choose two different squares; a block cannot combine with itself.");
      return;
    }

    const resultContents = combinations.get(pairKey(first.contents, second.contents));
    if (!resultContents) {
      render();
      setStatus(`No confirmed combination for ${displayExpression(first.contents)} + ${displayExpression(second.contents)}. Both squares stay unchanged.`);
      return;
    }

    const existing = state.results.find(block => expressionKey(block.contents) === expressionKey(resultContents));
    if (existing) {
      render();
      setStatus(`${displayExpression(first.contents)} + ${displayExpression(second.contents)} creates ${displayExpression(existing.contents)}; that result is already in the tray and can be reused.`);
      return;
    }

    const result = makeBlock(`block-result-${state.results.length + 1}`, resultContents);
    state.results.push(result);
    render();
    setStatus(`${displayExpression(first.contents)} + ${displayExpression(second.contents)} → ${displayExpression(result.contents)}. The compound is ready to inspect.`);
  }

  function beginDrag(event, block, button) {
    if (event.button !== 0 || state.drag) return;
    const rect = button.getBoundingClientRect();
    state.drag = {
      block,
      button,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false
    };
    button.setPointerCapture(event.pointerId);
    button.addEventListener("pointermove", moveDrag);
    button.addEventListener("pointerup", endDrag, { once: true });
    button.addEventListener("pointercancel", cancelDrag, { once: true });
  }

  function moveDrag(event) {
    if (!state.drag) return;
    const drag = state.drag;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) return;
    drag.moved = true;
    state.suppressClick = true;
    drag.button.classList.add("is-dragging");
    drag.button.style.position = "fixed";
    drag.button.style.left = `${event.clientX - drag.offsetX}px`;
    drag.button.style.top = `${event.clientY - drag.offsetY}px`;
    drag.button.style.width = `${drag.button.offsetWidth}px`;
    drag.button.style.pointerEvents = "none";
    const underneath = document.elementFromPoint(event.clientX, event.clientY)?.closest(".word-block");
    document.querySelectorAll(".word-block.is-target").forEach(target => target.classList.remove("is-target"));
    if (underneath && underneath !== drag.button) underneath.classList.add("is-target");
  }

  function endDrag(event) {
    if (!state.drag) return;
    const drag = state.drag;
    const targetButton = document.elementFromPoint(event.clientX, event.clientY)?.closest(".word-block");
    const target = targetButton && targetButton !== drag.button
      ? allBlocks().find(block => block.id === targetButton.dataset.blockId)
      : null;
    cleanDrag(drag);
    state.drag = null;
    if (drag.moved) {
      state.suppressClick = true;
      if (target) combine(drag.block, target);
      else setStatus("Drop one square onto another to try a combination.");
      window.setTimeout(() => { state.suppressClick = false; }, 0);
    }
  }

  function cancelDrag() {
    if (!state.drag) return;
    cleanDrag(state.drag);
    state.drag = null;
    state.suppressClick = false;
    render();
  }

  function cleanDrag(drag) {
    drag.button.classList.remove("is-dragging");
    drag.button.style.position = "";
    drag.button.style.left = "";
    drag.button.style.top = "";
    drag.button.style.width = "";
    drag.button.style.pointerEvents = "";
    drag.button.removeEventListener("pointermove", moveDrag);
    document.querySelectorAll(".word-block.is-target").forEach(target => target.classList.remove("is-target"));
  }

  function setStatus(message) {
    status.textContent = message;
  }

  resetButton.addEventListener("click", () => {
    state.results = [];
    state.selectedId = null;
    state.drag = null;
    setStatus("Workbench reset. Try combining NOT + RED.");
    render();
  });

  render();
})();
