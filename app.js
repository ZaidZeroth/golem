(() => {
  "use strict";

  const canvas = document.querySelector("#map-canvas");
  const context = canvas.getContext("2d");
  const mapBoard = document.querySelector(".map-board");
  const elementBank = document.querySelector("#element-bank");
  const detail = document.querySelector("#detail-content");
  const status = document.querySelector("#status");
  const worldImage = new Image();
  worldImage.src = "assets/golem-world-muddy-manx-field.png";
  worldImage.addEventListener("load", () => drawMap());
  const clayImage = new Image();
  clayImage.src = "assets/golem-clay-lump-ink-outline-256px.png";
  clayImage.addEventListener("load", () => {
    // Tint requests can happen before this image loads, especially while the
    // initial palette is being built. Discard those transparent placeholders.
    clayTintCache.clear();
    drawMap();
    renderElementBank();
  });
  const clodImage = new Image();
  clodImage.src = "assets/golem-clay-cube-block-256px.png";
  clodImage.addEventListener("load", () => {
    clodTintCache.clear();
    drawMap();
    renderElementBank();
  });
  const miniGolemImage = new Image();
  miniGolemImage.src = "assets/golem-mini-golem-front-256px.png";
  miniGolemImage.addEventListener("load", () => {
    miniGolemTintCache.clear();
    drawMap();
  });
  const elementSpritePaths = {
    eye: "assets/golem-clay-eye-256px.png",
    "not-eye": "assets/golem-clay-eye-closed-256px.png",
    hand: "assets/golem-clay-hand-left-256px.png",
    "left-hand": "assets/golem-clay-hand-left-256px.png",
    "right-hand": "assets/golem-clay-hand-left-256px.png",
    fist: "assets/golem-clay-fist-closed-256px.png",
    "left-fist": "assets/golem-clay-fist-closed-256px.png",
    "right-fist": "assets/golem-clay-fist-closed-256px.png",
    feet: "assets/golem-clay-feet-256px.png",
    left: "assets/golem-clay-arrow-right-256px.png",
    right: "assets/golem-clay-arrow-right-256px.png",
    up: "assets/golem-clay-arrow-right-256px.png",
    down: "assets/golem-clay-arrow-right-256px.png"
  };
  elementSpritePaths.clod = "assets/golem-clay-cube-block-256px.png";
  const elementTintCache = new Map();
  const elementSprites = Object.fromEntries(Object.entries(elementSpritePaths).map(([meaning, path]) => {
    const sprite = new Image();
    sprite.src = path;
    sprite.addEventListener("load", () => {
      elementTintCache.clear();
      drawMap();
      renderElementBank();
    });
    return [meaning, sprite];
  }));
  const clayTintCache = new Map();
  const clodTintCache = new Map();
  const miniGolemTintCache = new Map();
  const clearingPolygon = [
    [0.02, 0.34], [0.98, 0.34], [0.98, 0.96], [0.02, 0.96]
  ];
  const elementWords = [
    "RED", "GREEN", "BLUE", "NOT", "RIGHT", "UP", "WHILE", "DO",
    "HAND", "EYE", "FEET", "CLOD"
  ];
  const pair = (left, right) => [left, right].sort().join("\u0000");
  const activeSenseIds = [
    "while-eye", "while-hand", "not-see", "not-touch", "not-hold",
    "while-left-hand", "while-right-hand",
    "while-fist", "while-left-fist", "while-right-fist",
    "while-sight-left", "while-sight-right", "while-sight-up", "while-sight-down",
    ...[1, 2, 3, 4, 5, 6, 7].map(mask => `while-sight-${({
      1: "red", 2: "green", 3: "yellow", 4: "blue",
      5: "magenta", 6: "cyan", 7: "white"
    })[mask]}`),
    "sight-left", "sight-right", "sight-up", "sight-down",
    ...[1, 2, 3, 4, 5, 6, 7].map(mask => `while-touch-${({ 1: "red", 2: "green", 3: "yellow", 4: "blue", 5: "magenta", 6: "cyan", 7: "white" })[mask]}`),
    "while-touch-hand-clod", "while-touch-red-clod", "while-touch-green-clod",
    "while-touch-blue-clod", "while-touch-yellow-clod", "while-touch-magenta-clod",
    "while-touch-cyan-clod", "while-touch-white-clod"
  ];
  function element(word) {
    return { type: "element", word };
  }

  function compound(left, right, meaning = null) {
    return { type: "compound", left, right, meaning };
  }

  function makeBlock(id, contents) {
    return { id, contents, x: 0, y: 0, heldItems: { left: null, right: null } };
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
    CLOD: { id: "clod", category: "clod-kind", label: "CLOD", reading: "a clay clod" },
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

  function literalClodMeaning(contents) {
    const contentColor = contents.colorIntentMask ?? contents.colorMask;
    const isColored = Number.isInteger(contentColor);
    const isHand = contents.id === "hand";
    const isClodOfClod = contents.id === "clod" || contents.clodLiteral;
    const contentLabel = contents.id === "clod"
      ? "CLOD"
      : contents.label || "clay";
    const label = isClodOfClod ? `CLOD OF ${contentLabel}` : `${contentLabel} CLOD`;
    const reading = isHand
      ? "a hand clod"
      : isColored
        ? `a ${contents.label.toLowerCase()} clod`
        : `a clay clod embodying ${contents.reading || contentLabel.toLowerCase()}`;
    return provisionalMeaning(
      isHand ? "hand-clod" : isColored ? `${contents.id}-clod` : `clod-of-${contents.id}`,
      "object-filter",
      label,
      reading,
      {
        objectKind: "clod",
        clodLiteral: true,
        ...(isHand ? { touchObjectKind: "hand" } : {}),
        ...(isColored ? { colorMask: contentColor } : {})
      }
    );
  }

  function combineMeaning(left, right, leftExpression, rightExpression) {
    const ids = pair(left.id, right.id);
    if (Number.isInteger(left.colorMask) && Number.isInteger(right.colorMask)) {
      const colorMask = left.colorMask | right.colorMask;
      if (colorMask === left.colorMask && colorMask === right.colorMask) return null;
      const mixed = mixedColors[colorMask];
      if (mixed) return provisionalMeaning(mixed.id, "color-state", mixed.label, mixed.reading, { colorMask });
    }
    if (left.id === "clod") return literalClodMeaning(right);
    if (right.id === "clod") return literalClodMeaning(left);
    if (ids === pair("do", "feet")) {
      return provisionalMeaning(
        "do-move-random", "motive", "MOVE",
        "move slowly in a random cardinal direction, changing direction occasionally; tentative prototype interpretation"
      );
    }
    const movementDirection = ["left", "right", "up", "down"].find(direction =>
      ids === pair("do-move-random", direction)
    );
    if (movementDirection) {
      const directionWords = { left: "left", right: "right", up: "up", down: "down" };
      return provisionalMeaning(
        `do-move-${movementDirection}`, "motive", `MOVE ${movementDirection.toUpperCase()}`,
        `move slowly ${directionWords[movementDirection]}; directional prototype behavior`
      );
    }
    const directionalAction = [left, right].find(part =>
      part.category === "motive" && ["grab", "drop"].includes(part.actionType)
    );
    const actionDirection = [left, right].find(part => ["left", "right"].includes(part.id));
    if (directionalAction && actionDirection && !directionalAction.actionDirection) {
      const handPhrase = directionalAction.handSide
        ? `the ${directionalAction.handSide} hand`
        : "either available hand";
      const directionPhrase = directionalAction.actionType === "grab"
        ? `from the ${actionDirection.id} side`
        : `on the ${actionDirection.id} side`;
      const actionLabel = `${directionalAction.actionType.toUpperCase()} ${actionDirection.id.toUpperCase()}`;
      const label = directionalAction.handSide
        ? `${directionalAction.handSide.toUpperCase()} ${actionLabel}`
        : actionLabel;
      const reading = directionalAction.actionType === "grab"
        ? `grab an adjacent clod ${directionPhrase} with ${handPhrase}`
        : `drop a held clod ${directionPhrase} from ${handPhrase}`;
      const id = `${directionalAction.handSide ? `${directionalAction.handSide}-` : ""}${directionalAction.actionType}-${actionDirection.id}`;
      return provisionalMeaning(id, "motive", label, reading, {
        actionType: directionalAction.actionType,
        handSide: directionalAction.handSide || null,
        actionDirection: actionDirection.id
      });
    }
    const notRedIds = pair("not", "red");
    if (ids === pair("do", "red")) {
      return provisionalMeaning("be-red", "motive", "BE RED", "be red", { colorIntentMask: 1 });
    }
    if (ids === notRedIds) {
      return provisionalMeaning("not-red", "filter", "NOT RED", "clay that does not contain red pigment");
    }
    if (ids === pair("not", "right-hand")) {
      return provisionalMeaning("left-hand", "sense-source", "LEFT HAND", "left hand", { senseText: "touch" });
    }
    if (ids === pair("not", "left-hand")) {
      return provisionalMeaning("right-hand", "sense-source", "RIGHT HAND", "right hand", { senseText: "touch" });
    }
    if (ids === pair("not", "hand")) {
      return provisionalMeaning("fist", "sense-source", "FIST", "a hand formed into a fist", { senseText: "holding" });
    }
    if (ids === pair("not", "fist")) {
      return provisionalMeaning("hand", "sense-source", "HAND", "a hand opened from a fist", { senseText: "touch" });
    }
    if (ids === pair("right", "not")) {
      return provisionalMeaning("left", "filter", "LEFT", "the left direction");
    }
    if (ids === pair("not", "up")) {
      return provisionalMeaning("down", "filter", "DOWN", "the downward direction");
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
        senseText: "not touching any other clay clod"
      });
    }
    if (ids === pair("not", "while-fist")) {
      return provisionalMeaning("not-hold", "sense", "NOT HOLD", "while neither hand is holding a clay clod", {
        senseKind: "hold", negated: true,
        senseText: "not holding anything"
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
      if (["left", "right", "up", "down"].includes(filter.id)) return null;
      const sightReading = `seeing ${Number.isInteger(filter.colorMask) ? `${filter.label.toLowerCase()} pigment` : filter.reading}`;
      return provisionalMeaning(`sight-${filter.id}`, "sense", `SEE ${filter.label}`, sightReading, {
        senseKind: "see", senseText: sightReading
      });
    }
    if ((left.id === "while-eye" && (right.category === "filter" || right.category === "color-state")) ||
        (right.id === "while-eye" && (left.category === "filter" || left.category === "color-state"))) {
      const filter = left.id === "while-eye" ? right : left;
      const direction = ["left", "right", "up", "down"].includes(filter.id) ? filter.id : null;
      const sightReading = direction
        ? `seeing something ${direction === "up" ? "above" : direction === "down" ? "below" : `to the ${direction}`}`
        : `seeing ${Number.isInteger(filter.colorMask) ? `${filter.label.toLowerCase()} pigment` : filter.reading}`;
      return provisionalMeaning(`while-sight-${filter.id}`, "sense", `SEE ${filter.label}`, `while ${sightReading}`, {
        senseKind: "see", senseText: `while ${sightReading}`,
        ...(Number.isInteger(filter.colorMask) ? { sightColorMask: filter.colorMask } : {}),
        ...(direction ? { direction, sightRangeCells: 3 } : {})
      });
    }
    if ((left.id === "while-hand" && ["left", "right"].includes(right.id)) ||
        (right.id === "while-hand" && ["left", "right"].includes(left.id))) {
      const direction = left.id === "while-hand" ? right : left;
      const side = direction.id;
      return provisionalMeaning(`while-${side}-hand`, "sense", `${side.toUpperCase()} TOUCH`,
        `while touching with the ${side} hand`, {
          senseKind: "touch", handSide: side,
          senseText: `while touching with the ${side} hand`
        });
    }
    if ((left.id === "while-hand" && (right.category === "filter" || right.category === "color-state")) ||
        (right.id === "while-hand" && (left.category === "filter" || left.category === "color-state"))) {
      const color = left.id === "while-hand" ? right : left;
      if (Number.isInteger(color.colorMask)) {
        return provisionalMeaning(`while-touch-${color.id}`, "sense", `TOUCH ${color.label}`,
          `while touching ${color.label.toLowerCase()} pigment`, {
            senseKind: "touch", senseText: `while touching ${color.label.toLowerCase()} pigment`,
            touchColorMask: color.colorMask
          });
      }
    }
    if ((left.id === "while-hand" && right.category === "object-filter") ||
        (right.id === "while-hand" && left.category === "object-filter")) {
      const object = left.id === "while-hand" ? right : left;
      const phrase = `while touching ${object.reading}`;
      return provisionalMeaning(`while-touch-${object.id}`, "sense", `TOUCH ${object.label}`,
        phrase, {
          senseKind: "touch", senseText: phrase,
          touchObjectKind: object.objectKind,
          ...(Number.isInteger(object.colorMask) ? { touchColorMask: object.colorMask } : {})
        });
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
        ...(sense.id.endsWith("fist") ? {
          senseKind: "hold",
          ...(sense.id === "left-fist" ? { handSide: "left" } : {}),
          ...(sense.id === "right-fist" ? { handSide: "right" } : {})
        } : {}),
        ...(sense.id === "left-hand" || sense.id === "right-hand" ? {
          senseKind: "touch",
          handSide: sense.id === "left-hand" ? "left" : "right"
        } : {}),
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
    if ((left.id === "do" && ["hand", "fist", "red", "eye", "not-eye", "left-hand", "right-hand", "left-fist", "right-fist"].includes(right.id)) ||
        (right.id === "do" && ["hand", "fist", "red", "eye", "not-eye", "left-hand", "right-hand", "left-fist", "right-fist"].includes(left.id))) {
      const action = left.id === "do" ? right : left;
      const actions = {
        hand: { type: "drop", label: "DROP", reading: "drop a clod from a randomly chosen holding hand" },
        fist: { type: "grab", label: "GRAB", reading: "grab an adjacent clod with a randomly chosen free hand" },
        red: { label: "ADD RED", reading: "add red pigment" },
        eye: { label: "LOOK", reading: "look" },
        "not-eye": { label: "DON'T LOOK", reading: "don't look" },
        "left-hand": { type: "drop", handSide: "left", label: "LEFT DROP", reading: "drop a clod from the left hand" },
        "right-hand": { type: "drop", handSide: "right", label: "RIGHT DROP", reading: "drop a clod from the right hand" },
        "left-fist": { type: "grab", handSide: "left", label: "LEFT GRAB", reading: "grab an adjacent clod with the left hand" },
        "right-fist": { type: "grab", handSide: "right", label: "RIGHT GRAB", reading: "grab an adjacent clod with the right hand" }
      };
      const actionMeaning = actions[action.id];
      return provisionalMeaning(`do-${action.id}`, "motive", actionMeaning.label, actionMeaning.reading, {
        ...(actionMeaning.type ? {
          actionType: actionMeaning.type,
          handSide: actionMeaning.handSide || null
        } : {})
      });
    }
    if ((left.id === "in" && right.id === "me") || (right.id === "in" && left.id === "me")) {
      return provisionalMeaning("inside-me", "inspect", "IN ME", "inside me");
    }
    if ((left.id === "inside-me" && right.category === "filter") ||
        (right.id === "inside-me" && left.category === "filter")) {
      const pattern = left.id === "inside-me" ? right : left;
      return provisionalMeaning(`inside-${pattern.id}`, "inspect", `IN ME ${pattern.label}`, `whether ${pattern.reading} occurs anywhere inside me`);
    }
    if (left.category === "golem" && right.category === "golem") {
      const pathways = [...pathwaysForMeaning(left), ...pathwaysForMeaning(right)];
      if (pathways.length < 2 || pathways.some(pathway => !pathway.behaviorImplemented)) return null;
      const reading = pathways.map(pathway =>
        `${pathway.sense.reading.replace(/^while /i, "while ")}, then ${pathway.motive.reading}`
      ).join("; ");
      const label = pathways.map(pathway =>
        `${pathway.sense.label} THEN ${pathway.motive.label}`
      ).join("; ");
      return provisionalMeaning("compound-golem", "golem", label, reading, {
        pathways,
        behaviorImplemented: true
      });
    }
    if ((left.category === "sense" && right.category === "motive") ||
        (right.category === "sense" && left.category === "motive")) {
      const sense = left.category === "sense" ? left : right;
      const motive = left.category === "motive" ? left : right;
      const label = `${sense.label} THEN ${motive.label}`;
      const reading = `${sense.reading}; then ${motive.reading}`;
      const behaviorImplemented = activeSenseIds.includes(sense.id) && responseIsImplemented(motive);
      return provisionalMeaning("golem-pair", "golem", label, reading, {
        sense,
        motive,
        behaviorImplemented,
        pathways: [{ sense, motive, behaviorImplemented }],
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
    const leftMeaning = describe(leftExpression);
    const rightMeaning = describe(rightExpression);
    // HOLD is built from WHILE + FIST, and FIST itself contains NOT. Allow
    // the explicit NOT + HOLD recipe even though this adds a second NOT word.
    const isNotHold = pair(leftMeaning.id, rightMeaning.id) === pair("not", "while-fist");
    if (!isNotHold && repeatsOperatorWord(leftExpression, rightExpression)) return null;
    const meaning = combineMeaning(
      leftMeaning, rightMeaning, leftExpression, rightExpression
    );
    if (!meaning) return null;
    if (meaning.id === "right-after-double-not") return element("RIGHT");
    return compound(leftExpression, rightExpression, meaning);
  }

  function repeatsOperatorWord(leftExpression, rightExpression) {
    const operatorWord = expression => expression.type === "element" &&
      elementMeanings[expression.word]?.category === "operator"
      ? expression.word
      : null;
    const containsWord = (expression, word) => expression.type === "element"
      ? expression.word === word
      : containsWord(expression.left, word) || containsWord(expression.right, word);
    const leftOperator = operatorWord(leftExpression);
    const rightOperator = operatorWord(rightExpression);
    return Boolean(
      (leftOperator && containsWord(rightExpression, leftOperator)) ||
      (rightOperator && containsWord(leftExpression, rightOperator))
    );
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

  function tintedSprite(sourceImage, colorMask, cache) {
    if (cache.has(colorMask)) return cache.get(colorMask);
    const tint = {
      1: "rgb(190 55 48 / 25%)",
      2: "rgb(68 143 73 / 25%)",
      3: "rgb(222 192 55 / 25%)",
      4: "rgb(65 112 193 / 25%)",
      5: "rgb(196 67 157 / 25%)",
      6: "rgb(61 183 184 / 25%)",
      7: "rgb(238 239 228 / 32%)"
    }[colorMask] || "rgb(48 51 57 / 50%)";
    const sprite = document.createElement("canvas");
    sprite.width = sourceImage.naturalWidth || 64;
    sprite.height = sourceImage.naturalHeight || 64;
    const spriteContext = sprite.getContext("2d");
    if (sourceImage.complete && sourceImage.naturalWidth) {
      spriteContext.drawImage(sourceImage, 0, 0, sprite.width, sprite.height);
      spriteContext.globalCompositeOperation = "source-atop";
      spriteContext.fillStyle = tint;
      spriteContext.fillRect(0, 0, sprite.width, sprite.height);
    }
    cache.set(colorMask, sprite);
    return sprite;
  }

  function tintedClay(colorMask) {
    return tintedSprite(clayImage, colorMask, clayTintCache);
  }

  function tintedClod(colorMask) {
    return tintedSprite(clodImage, colorMask, clodTintCache);
  }

  function tintedElementSprite(id, colorMask = 0) {
    const sprite = elementSprites[id] ||
      (["left-hand", "right-hand"].includes(id) ? elementSprites.hand : null) ||
      (["left-fist", "right-fist"].includes(id) ? elementSprites.fist : null);
    if (!sprite) return tintedClay(colorMask);
    const key = `${id}:${colorMask}`;
    if (elementTintCache.has(key)) return elementTintCache.get(key);
    const tinted = tintedSprite(sprite, colorMask, new Map());
    const transform = elementSpriteTransform(id);
    if (!transform) {
      elementTintCache.set(key, tinted);
      return tinted;
    }

    const oriented = document.createElement("canvas");
    oriented.width = tinted.width;
    oriented.height = tinted.height;
    const orientedContext = oriented.getContext("2d");
    orientedContext.save();
    orientedContext.translate(oriented.width / 2, oriented.height / 2);
    if (transform.mirrorX || transform.mirrorY) {
      orientedContext.scale(transform.mirrorX ? -1 : 1, transform.mirrorY ? -1 : 1);
    }
    if (transform.rotation) orientedContext.rotate(transform.rotation);
    orientedContext.drawImage(tinted, -tinted.width / 2, -tinted.height / 2);
    orientedContext.restore();
    elementTintCache.set(key, oriented);
    return oriented;
  }

  function elementSpriteTransform(id) {
    // The supplied hand/fist art faces left. Keep the explicit left forms
    // unchanged, while the unsided/default and right forms face right.
    if (["hand", "right-hand", "fist", "right-fist"].includes(id)) {
      return { mirrorX: true, mirrorY: false, rotation: 0 };
    }
    // The supplied arrow faces right. Mirror top-to-bottom as well as turning
    // left so the light/shadow edges stay consistent with the other directions.
    if (id === "left") return { mirrorX: false, mirrorY: true, rotation: Math.PI };
    if (id === "up") return { mirrorX: false, mirrorY: false, rotation: -Math.PI / 2 };
    // DOWN is the vertical mirror of the upward arrow.
    if (id === "down") return { mirrorX: false, mirrorY: true, rotation: -Math.PI / 2 };
    return null;
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
      7: "rgb(238 239 228 / 32%)"
    }[colorMask] || "rgb(48 51 57 / 50%)";
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
      const isClodLiteral = meaning.id === "clod" || meaning.clodLiteral === true || meaning.objectKind === "clod";
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
      if (isClodLiteral && clodImage.complete && clodImage.naturalWidth) {
        context.drawImage(tintedClod(colorMask), block.x, block.y, size, size);
      } else if (elementSprite?.complete && elementSprite.naturalWidth) {
        const art = tintedElementSprite(meaning.id, colorMask);
        context.drawImage(art, block.x, block.y, size, size);
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
      drawHeldItems(block, size);
      if (["do-move-left", "do-move-right", "do-move-up", "do-move-down", "do-move-random"].includes(meaning.id)) {
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
      const labelY = block.y + size * (isCreature ? 0.42 : 0.5);
      drawFaceLabel(context, block.contents, block.x + size / 2, labelY, size);
    }
  }

  function drawHeldItems(block, size) {
    const heldItems = block.heldItems;
    if (!heldItems || (!heldItems.left && !heldItems.right)) return;
    for (const side of ["left", "right"]) {
      const heldClod = heldItems[side];
      if (!heldClod) continue;
      const contents = heldClod.contents;
      const meaning = describe(contents);
      const sprite = elementSprites[meaning.id];
      const colorMask = meaning.colorIntentMask ?? meaning.colorMask ?? 0;
      const isClodLiteral = meaning.id === "clod" || meaning.clodLiteral === true || meaning.objectKind === "clod";
      // Held clods should read clearly over the golem's hands. The previous
      // 34% overlay was too small; 51% is a 50% increase and stays within the
      // golem tile when anchored to its lower edge.
      const itemSize = size * 0.51;
      const x = block.x + (side === "left" ? size * 0.02 : size * 0.47);
      const y = block.y + size * 0.48;
      context.save();
      context.globalAlpha = 0.96;
      if (isClodLiteral && clodImage.complete && clodImage.naturalWidth) {
        context.drawImage(tintedClod(colorMask), x, y, itemSize, itemSize);
      } else if (sprite?.complete && sprite.naturalWidth) {
        const art = tintedElementSprite(meaning.id, colorMask);
        context.drawImage(art, x, y, itemSize, itemSize);
      } else {
        const art = tintedClay(colorMask);
        context.drawImage(art, x, y, itemSize, itemSize);
      }
      const label = faceLabel(contents);
      context.font = `bold ${Math.max(6, itemSize * 0.31)}px "Atkinson Hyperlegible Next", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = 2;
      context.strokeStyle = "rgb(18 19 21 / 95%)";
      context.fillStyle = "#fff7e7";
      context.strokeText(label, x + itemSize / 2, y + itemSize * 0.52, itemSize - 2);
      context.fillText(label, x + itemSize / 2, y + itemSize * 0.52, itemSize - 2);
      context.restore();
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

    const gameTitle = "MANX MUDMEN - Hop Tu Naa Hackathon";
    const titleSize = Math.max(12, Math.min(34, hud.size * 0.56, (width - 28) / (gameTitle.length * 0.52)));
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = `${titleSize}px "Creepster", Georgia, serif`;
    context.fillStyle = "#fff2df";
    context.shadowColor = "rgb(0 0 0 / 80%)";
    context.shadowBlur = 3;
    context.fillText(gameTitle, 14, hud.inset + hud.titleHeight / 2, width - 28);
    context.shadowBlur = 0;

    for (const token of hud.tokens) {
      const contents = element(token.word);
      const meaning = describe(contents);
      const sprite = elementSprites[meaning.id];
      const art = sprite?.complete && sprite.naturalWidth
        ? tintedElementSprite(meaning.id, meaning.colorIntentMask ?? meaning.colorMask ?? 0)
        : tintedClay(meaning.colorIntentMask ?? meaning.colorMask ?? 0);
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
      const art = sprite?.complete && sprite.naturalWidth
        ? tintedElementSprite(meaning.id, meaning.colorIntentMask ?? meaning.colorMask ?? 0)
        : tintedClay(meaning.colorIntentMask ?? meaning.colorMask ?? 0);
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

  function drawFaceLabel(targetContext, expression, centerX, centerY, size) {
    const meaning = describe(expression);
    const pathways = pathwaysForMeaning(meaning);
    const lines = meaning.id === "compound-golem" && pathways.length > 1
      ? pathways.flatMap(pathway => [
          pathway.sense.label.toLowerCase(),
          `then ${pathway.motive.label.toLowerCase()}`
        ])
      : [faceLabel(expression)];
    const maxWidth = size - 8;
    const maxHeight = size - 6;
    const lineHeight = maxHeight / lines.length;
    const longestLine = Math.max(...lines.map(line => line.length));
    const fontSize = lines.length > 1
      ? Math.max(3, Math.min(20, size * 0.24, lineHeight * 0.76, maxWidth / (longestLine * 0.56)))
      : faceFontSize(lines[0], size);
    const blockHeight = lineHeight * lines.length;
    const firstY = centerY - blockHeight / 2 + lineHeight / 2;

    targetContext.fillStyle = "#fff7e7";
    targetContext.strokeStyle = "rgb(18 19 21 / 92%)";
    targetContext.lineWidth = Math.min(2.4, fontSize * 0.2);
    targetContext.textAlign = "center";
    targetContext.textBaseline = "middle";
    targetContext.font = `${fontSize}px "Creepster", Georgia, serif`;
    targetContext.shadowColor = "rgb(255 247 224 / 90%)";
    targetContext.shadowBlur = 2;
    lines.forEach((line, index) => {
      const y = lines.length > 1 ? firstY + index * lineHeight : centerY;
      targetContext.strokeText(line, centerX, y, maxWidth);
      targetContext.fillText(line, centerX, y, maxWidth);
    });
    targetContext.shadowBlur = 0;
  }

  function renderDetail() {
    const selected = allBlocks().find(block => block.id === state.selectedId);
    if (!selected) {
      detail.innerHTML = '<p class="detail-placeholder">No clod selected.</p>';
      return;
    }
    const meaning = describe(selected.contents);
    const provisional = meaning.certainty === "provisional" || meaning.certainty === "unresolved";
    const sensor = sensorFor(selected);
    const pathways = pathwaysForMeaning(meaning);
    const sightRangeCells = meaning.sightRangeCells || 3;
    const senseKind = sensor?.senseKind || (sensor?.id === "while-hand" ? "touch" : "see");
    const positiveSenseDescription = sensor ? senseConditionDescription(sensor) : `clay within ${sightRangeCells} cells`;
    const senseDescription = sensor?.negated
      ? `no ${senseKind === "touch" ? "other clay clod is adjacent" : `clay is within ${sightRangeCells} cells`}`
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
      "do-move-down": "Prototype movement experiment · the language rule remains open",
      "do-move-random": "Tentative random-walk experiment · the language rule remains open"
    };
    const pairedMovementStatus = pathways.length
      ? pathways.length > 1
        ? "Each sense is checked independently; its response runs when true."
        : selected.senseActive
          ? `Prototype response active · ${senseDescription}`
          : `Prototype response waiting · acts only while ${sensor?.label?.toLowerCase() || "the sense"} is true`
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
      setStatus("The clearing is full; there is no open space for another clod.");
      return;
    }
    state.selectedId = block.id;
    state.focusedId = block.id;
    renderDetail();
    drawMap();
    setStatus(tryCombine && target
      ? `${word.toLowerCase()} does not combine with that clod yet; a copy was placed in the clearing.`
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
      setStatus("Drop in open garden to add a copy, or directly onto another clod to combine.");
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
      sprite.src = spritePath
        ? tintedElementSprite(meaning.id, meaning.colorIntentMask ?? meaning.colorMask ?? 0).toDataURL()
        : tintedClay(meaning.colorIntentMask ?? meaning.colorMask ?? 0).toDataURL();
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

  const movementIds = ["do-move-left", "do-move-right", "do-move-up", "do-move-down", "do-move-random"];

  function pathwaysForMeaning(meaning) {
    if (meaning.id === "golem-pair") {
      return meaning.pathways || [{
        sense: meaning.sense,
        motive: meaning.motive,
        behaviorImplemented: meaning.behaviorImplemented
      }];
    }
    return meaning.id === "compound-golem" ? meaning.pathways || [] : [];
  }

  function pathwayStateKey(index, pathway) {
    return `${index}:${pathway.sense.id}:${pathway.motive.id}`;
  }

  function responseActionFor(motive) {
    if (motive.actionType === "grab" || motive.actionType === "drop") {
      return {
        type: motive.actionType,
        handSide: motive.handSide || null,
        direction: motive.actionDirection || null
      };
    }
    return null;
  }

  function responseIsImplemented(motive) {
    return movementIds.includes(motive.id) || responseActionFor(motive) !== null;
  }

  function movementFor(block) {
    const meaning = describe(block.contents);
    if (movementIds.includes(meaning.id)) return { action: meaning, conditioned: false };
    const pathways = pathwaysForMeaning(meaning);
    const activePath = pathways.find((pathway, index) =>
      pathway.behaviorImplemented && movementIds.includes(pathway.motive?.id) &&
      block.pathwaySenseStates?.[pathwayStateKey(index, pathway)] === true
    );
    if (activePath) {
      return { action: activePath.motive, conditioned: true };
    }
    return null;
  }

  function sensorFor(block) {
    const meaning = describe(block.contents);
    if (activeSenseIds.includes(meaning.id)) return meaning;
    const pathway = pathwaysForMeaning(meaning).find(item =>
      item.behaviorImplemented && activeSenseIds.includes(item.sense?.id)
    );
    if (pathway) return pathway.sense;
    return null;
  }

  function senseConditionDescription(sense) {
    const senseKind = sense.senseKind || (sense.id === "while-hand" ? "touch" : "see");
    if (senseKind === "hold") return sense.handSide
      ? `the ${sense.handSide} hand is holding clay`
      : "either hand is holding clay";
    if (senseKind === "touch") {
      const colorNames = { 1: "red", 2: "green", 3: "yellow", 4: "blue", 5: "magenta", 6: "cyan", 7: "white" };
      const color = colorNames[sense.touchColorMask];
      if (sense.handSide) return `another clay clod within reach of the ${sense.handSide} hand`;
      if (sense.touchObjectKind === "hand") return "a hand clod is adjacent";
      if (sense.touchObjectKind === "clod" && color) return `a ${color} clod is adjacent`;
      if (color) return `a clay clod with ${color} pigment is adjacent`;
      return "another clay clod is adjacent";
    }
    const range = sense.sightRangeCells || 3;
    const colorNames = { 1: "red", 2: "green", 3: "yellow", 4: "blue", 5: "magenta", 6: "cyan", 7: "white" };
    const directionWords = { left: "to the left", right: "to the right", up: "above", down: "below" };
    if (sense.direction) return `another clay clod is directly ${directionWords[sense.direction]} within ${range} cells`;
    const color = colorNames[sense.sightColorMask];
    return color
      ? `a clay clod with ${color} pigment is within ${range} cells`
      : `clay within ${range} cells`;
  }

  function sensorIsTrue(block, sense) {
    const centerX = block.x + state.layout.size / 2;
    const centerY = block.y + state.layout.size / 2;
    const others = state.blocks.filter(other => !other.unplaced && other.id !== block.id);
    // A palette drag is a visible clay copy while it moves over the garden.
    // Let sensors inspect that preview without inserting it into game state,
    // so grab/drop logic cannot treat the bank copy as a real movable clod.
    if (palettePointerDrag?.moved && palettePointerDrag.dropTarget !== "bank" &&
        palettePointerDrag.dropTarget !== "outside") {
      const drag = palettePointerDrag;
      others.push({
        id: "palette-drag-preview",
        contents: element(drag.word),
        x: drag.point.x - drag.offsetX,
        y: drag.point.y - drag.offsetY,
        unplaced: false
      });
    }
    const senseKind = sense.senseKind || (sense.id === "while-hand" ? "touch" : "see");
    let positiveResult = false;
    if (senseKind === "see" && sense.direction) {
      const range = state.layout.cell * (sense.sightRangeCells || 3);
      const laneTolerance = state.layout.cell / 2;
      positiveResult = others.some(other => {
        const dx = other.x - block.x;
        const dy = other.y - block.y;
        if (sense.direction === "up") return Math.abs(dx) <= laneTolerance && dy < 0 && -dy <= range;
        if (sense.direction === "down") return Math.abs(dx) <= laneTolerance && dy > 0 && dy <= range;
        if (sense.direction === "left") return Math.abs(dy) <= laneTolerance && dx < 0 && -dx <= range;
        if (sense.direction === "right") return Math.abs(dy) <= laneTolerance && dx > 0 && dx <= range;
        return false;
      });
    } else if (senseKind === "see") {
      const range = state.layout.cell * (sense.sightRangeCells || 3);
      positiveResult = others.some(other => {
        const colorMask = describe(other.contents).colorIntentMask ?? describe(other.contents).colorMask ?? 0;
        if (Number.isInteger(sense.sightColorMask) &&
            (colorMask & sense.sightColorMask) !== sense.sightColorMask) return false;
        return Math.hypot(
          (other.x + state.layout.size / 2) - centerX,
          (other.y + state.layout.size / 2) - centerY
        ) <= range;
      });
    } else if (senseKind === "hold") {
      const hands = block.heldItems || {};
      positiveResult = sense.handSide ? Boolean(hands[sense.handSide]) : Boolean(hands.left || hands.right);
    } else if (senseKind === "touch") {
      // The clearing allows free placement, so touch should be based on the
      // gap between square clods rather than a fixed center-to-center cell
      // radius. The small tolerance accommodates the normal gap between
      // neighboring pieces in the garden.
      const touchGap = Math.max(8, state.layout.cell - state.layout.size + 2);
      positiveResult = others.some(other => {
        const otherCenterX = other.x + state.layout.size / 2;
        if (sense.handSide === "left" && otherCenterX >= centerX) return false;
        if (sense.handSide === "right" && otherCenterX <= centerX) return false;
        const meaning = describe(other.contents);
        if (sense.touchObjectKind && meaning.objectKind !== sense.touchObjectKind) return false;
        if (Number.isInteger(sense.touchColorMask)) {
          const colorMask = meaning.colorIntentMask ?? meaning.colorMask ?? 0;
          if ((colorMask & sense.touchColorMask) !== sense.touchColorMask) return false;
        }
        const gapX = Math.max(0, Math.abs(otherCenterX - centerX) - state.layout.size);
        const otherCenterY = other.y + state.layout.size / 2;
        const gapY = Math.max(0, Math.abs(otherCenterY - centerY) - state.layout.size);
        return gapX <= touchGap && gapY <= touchGap;
      });
    }
    return sense.negated ? !positiveResult : positiveResult;
  }

  function hasActivePrototypeBehavior(block) {
    const meaning = describe(block.contents);
    const pathways = pathwaysForMeaning(meaning);
    return movementFor(block) !== null || sensorFor(block) !== null || actionFor(block) !== null ||
      pathways.some(pathway => pathway.behaviorImplemented && responseIsImplemented(pathway.motive));
  }

  function actionFor(block) {
    return responseActionFor(describe(block.contents));
  }

  function tickActiveMovement() {
    const now = performance.now();
    const elapsed = lastMovementTime === null ? 0 : Math.min((now - lastMovementTime) / 1000, 0.1);
    lastMovementTime = now;
    if (!state.blocks.some(hasActivePrototypeBehavior)) {
      window.clearInterval(movementTimer);
      movementTimer = null;
      lastMovementTime = null;
      return;
    }

    let moved = false;
    let handChanged = false;
    let sightChanged = false;
    const activePathways = [];
    const sensors = [];
    for (const block of state.blocks) {
      const pathways = pathwaysForMeaning(describe(block.contents));
      if (pathways.length) {
        const states = block.pathwaySenseStates || (block.pathwaySenseStates = {});
        let anyActive = false;
        pathways.forEach((pathway, index) => {
          if (!pathway.behaviorImplemented || !activeSenseIds.includes(pathway.sense.id)) return;
          const key = pathwayStateKey(index, pathway);
          const wasInitialized = typeof states[key] === "boolean";
          const wasActive = states[key];
          const isTrue = sensorIsTrue(block, pathway.sense);
          states[key] = isTrue;
          anyActive ||= isTrue;
          sensors.push({ block, sense: pathway.sense, pathway });
          activePathways.push({ block, pathway, index, key, active: isTrue });
          if (wasInitialized && wasActive !== isTrue) sightChanged = true;
          if (wasInitialized && wasActive !== isTrue) {
            const condition = senseConditionDescription(pathway.sense);
            const truth = isTrue
              ? (pathway.sense.negated ? `no ${condition}` : condition)
              : (pathway.sense.negated ? condition : `no ${condition}`);
            setStatus(`${pathway.sense.label.toLowerCase()} then ${pathway.motive.label.toLowerCase()} is ${isTrue ? "true" : "false"}: ${truth}.`);
          }
        });
        if (block.senseActive !== anyActive) {
          block.senseActive = anyActive;
          sightChanged = true;
        }
        if (sightChanged && state.selectedId === block.id) renderDetail();
      } else {
        const sense = sensorFor(block);
        if (!sense) continue;
        const wasInitialized = typeof block.senseActive === "boolean";
        const isTrue = sensorIsTrue(block, sense);
        sensors.push({ block, sense });
        if (block.senseActive !== isTrue) {
          block.senseActive = isTrue;
          sightChanged = true;
          if (state.selectedId === block.id) renderDetail();
          if (wasInitialized) {
            const condition = senseConditionDescription(sense);
            setStatus(`while ${sense.label.toLowerCase()} is ${isTrue ? "true" : "false"}: ${condition}.`);
          }
        }
      }
    }

    const actions = [];
    for (const block of state.blocks) {
      const pathways = pathwaysForMeaning(describe(block.contents));
      if (!pathways.length) {
        const action = actionFor(block);
        if (action) actions.push({ block, action, key: null });
        continue;
      }
      for (const entry of activePathways) {
        if (entry.block.id !== block.id || !entry.active) continue;
        const action = responseActionFor(entry.pathway.motive);
        if (action) actions.push({ block, action, key: entry.key });
      }
    }
    for (const { block, action, key } of actions) {
      if (!state.blocks.some(current => current.id === block.id)) continue;
      // Keep a dragged golem's response behavior live, except grabbing: a grab
      // during the user's drag can pull another clod away from the pointer.
      if (action.type === "grab" && state.drag?.block.id === block.id) continue;
      if (key === null) {
        if (now < (block.nextActionAt || 0)) continue;
        block.nextActionAt = now + 700;
      } else {
        const nextActions = block.nextPathActionAt || (block.nextPathActionAt = {});
        if (now < (nextActions[key] || 0)) continue;
        nextActions[key] = now + 700;
      }
      const changed = action.type === "grab"
        ? grabAdjacentClay(block, action.handSide, action.direction)
        : dropHeldClay(block, action.handSide, action.direction);
      if (changed) handChanged = true;
    }
    const movers = state.blocks.map(block => ({ block, movement: movementFor(block) }))
      .filter(item => item.movement);
    const frame = imageFrame();

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
            : movementId === "do-move-down"
              ? { x: 0, y: 1 }
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
            ? "blocked in every direction by another clod or the clearing edge"
            : "blocked by another clod or the clearing edge";
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
    const shouldPulse = sensors.some(({ block }) => block.senseActive) && !reducedMotion;
    if (moved || handChanged || sightChanged || shouldPulse) drawMap();
  }

  function chooseRandomDirection(block, now) {
    const directions = shuffledCardinalDirections();
    block.randomDirection = directions[Math.floor(Math.random() * directions.length)];
    block.nextDirectionChange = now + 1000 + Math.random() * 1400;
  }

  function grabAdjacentClay(golem, requestedHandSide, requestedDirection) {
    const hands = golem.heldItems || (golem.heldItems = { left: null, right: null });
    const availableSides = ["left", "right"].filter(side => !hands[side]);
    if (requestedHandSide && hands[requestedHandSide]) {
      setStatus(`The ${requestedHandSide} hand is full; it cannot grab another clod.`);
      return false;
    }
    const cell = state.layout.cell + 1;
    const centerX = golem.x + state.layout.size / 2;
    const centerY = golem.y + state.layout.size / 2;
    const candidates = state.blocks.filter(other => {
      // Pointer-held pieces belong to the player's current gesture. Do not
      // let an autonomous grab pull a dragged clod or golem away from them.
      if (other.id === golem.id || other.unplaced || state.drag?.block.id === other.id) return false;
      const dx = other.x + state.layout.size / 2 - centerX;
      const dy = other.y + state.layout.size / 2 - centerY;
      return (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) && Math.abs(dx) <= cell && Math.abs(dy) <= cell;
    }).map(other => {
      const dx = other.x + state.layout.size / 2 - centerX;
      const dy = other.y + state.layout.size / 2 - centerY;
      return { other, dx, dy, distance: dx * dx + dy * dy };
    }).filter(candidate => {
      if (!requestedDirection) return true;
      return requestedDirection === "left" ? candidate.dx < -0.5 : candidate.dx > 0.5;
    }).sort((a, b) => a.distance - b.distance);

    const candidate = candidates.find(() => availableSides.length > 0);
    if (!candidate) {
      const directionMessage = requestedDirection ? ` on the ${requestedDirection} side` : " nearby";
      setStatus(requestedHandSide
        ? `There is no adjacent clay${directionMessage} for the ${requestedHandSide} hand.`
        : availableSides.length ? `There is no adjacent clay${directionMessage} that can be grabbed.` : "Both hands are full; no more clay can be grabbed.");
      return false;
    }
    const side = requestedHandSide || availableSides[Math.floor(Math.random() * availableSides.length)];
    hands[side] = candidate.other;
    state.blocks = state.blocks.filter(other => other.id !== candidate.other.id);
    if (state.selectedId === candidate.other.id) state.selectedId = null;
    if (state.focusedId === candidate.other.id) state.focusedId = null;
    if (state.targetId === candidate.other.id) state.targetId = null;
    if (state.selectedId === golem.id) renderDetail();
    const from = requestedDirection ? ` from the ${requestedDirection} side` : "";
    setStatus(`${faceLabel(golem.contents)} grabbed ${faceLabel(candidate.other.contents)}${from} into its ${side} hand.`);
    return true;
  }

  function dropHeldClay(golem, requestedHandSide, requestedDirection) {
    const hands = golem.heldItems || (golem.heldItems = { left: null, right: null });
    const holding = ["left", "right"].filter(side => hands[side]);
    const side = requestedHandSide || holding[Math.floor(Math.random() * holding.length)];
    if (!side || !hands[side]) {
      setStatus(requestedHandSide ? `The ${requestedHandSide} hand is empty.` : "There is no held clay to drop.");
      return false;
    }
    const heldClod = hands[side];
    const contents = heldClod.contents;
    const block = {
      ...heldClod,
      id: `held-drop-${++state.paletteCopyCount}`,
      heldItems: { left: heldClod.heldItems?.left || null, right: heldClod.heldItems?.right || null }
    };
    const placementSide = requestedDirection || side;
    block.x = golem.x + (placementSide === "left" ? -state.layout.size : state.layout.size);
    block.y = golem.y;
    state.blocks.push(block);
    if (!dropInClearing(block, block.x, block.y)) {
      state.blocks = state.blocks.filter(other => other.id !== block.id);
      setStatus("There is no open space in the clearing to drop the held clay on that side.");
      return false;
    }
    hands[side] = null;
    if (state.selectedId === golem.id) renderDetail();
    const directionText = requestedDirection ? ` on the ${requestedDirection} side` : "";
    setStatus(`${faceLabel(golem.contents)} dropped ${faceLabel(contents)} from its ${side} hand${directionText}.`);
    return true;
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
    setStatus(`${faceLabel(block.contents)} selected. Drag it onto another clod to combine.`);
  }

  function combine(target, dropped) {
    if (target.id === dropped.id) return;
    const result = resultExpression(target.contents, dropped.contents);
    if (!result) {
      state.selectedId = null;
      renderDetail();
      drawMap();
      const reason = repeatsOperatorWord(target.contents, dropped.contents)
        ? "An operator cannot be added again to an expression that already contains it. Both clods stay in place."
        : `No confirmed combination for ${faceLabel(target.contents)} + ${faceLabel(dropped.contents)}. Both clods stay in place.`;
      setStatus(reason);
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
    if (["do-move-left", "do-move-right", "do-move-up", "do-move-down", "do-move-random"].includes(movementId)) {
      const movementNote = movementId === "do-move-random"
        ? "This tentative prototype guess wanders slowly in random directions; the game rule is not settled."
        : `This provisional action keeps trying to move slowly ${movementId.slice("do-move-".length)}; the movement rule remains open.`;
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. ${movementNote}`);
      startActiveMovement();
    } else if (activeSenseIds.includes(movementId)) {
      const range = describe(target.contents).sightRangeCells || 3;
      const sense = describe(target.contents);
      const senseKind = sense.senseKind || (movementId === "while-hand" ? "touch" : "see");
      const positiveCondition = senseConditionDescription(sense);
      const condition = sense.negated ? `no ${positiveCondition}` : positiveCondition;
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. It senses when ${condition} and glows while the condition is true.`);
      startActiveMovement();
    } else if (["golem-pair", "compound-golem"].includes(movementId) && describe(target.contents).behaviorImplemented) {
      const meaning = describe(target.contents);
      const pathwayCount = pathwaysForMeaning(meaning).length;
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. Each of its ${pathwayCount} conditional pathways runs when its own sense is true.`);
      startActiveMovement();
    } else {
      setStatus(`${targetLabel} + ${droppedLabel} → ${faceLabel(target.contents)}. ${describe(target.contents).certainty === "provisional" ? "This proposed expression has no active game behavior yet." : "The two clods have merged into one."}`);
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
        ? "Release anywhere in the top panel to discard this clay clod."
        : "Drop in the garden to place this clod, or onto another clod to combine.");
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
        ? "Those clods do not combine; the dragged clay was placed in the clearing."
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
