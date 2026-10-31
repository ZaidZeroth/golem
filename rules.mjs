// Pure word-combination and expression helpers. This module owns no DOM or world state.

  const pair = (left, right) => [left, right].sort().join("\u0000");

  function element(word) {
    return { type: "element", word };
  }

  function compound(left, right, meaning = null) {
    return { type: "compound", left, right, meaning };
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

export { element, describe, faceLabel, construction, resultExpression, plainLanguage };
