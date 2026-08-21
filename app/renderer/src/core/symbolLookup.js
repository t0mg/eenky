/**
 * Resolves a symbol identifier (knot, stitch, function, variable, constant)
 * to its declaration location { file, row, column } across project files.
 *
 * @param {string} symbolName - e.g. "my_knot", "my_knot.my_stitch", "my_func", "my_var"
 * @param {object} activeFile - Currently active InkFile object in store
 * @param {Array} allFiles - Array of all InkFile objects in store
 * @param {number} [currentCursorRow] - Optional 0-indexed row of cursor in activeFile
 * @returns {{ file: object, row: number, column: number } | null}
 */
export function findSymbolDeclaration(symbolName, activeFile, allFiles = [], currentCursorRow = null) {
  if (!symbolName || typeof symbolName !== 'string') return null;
  const cleanName = symbolName.trim().replace(/^\.+|\.+$/g, '');
  if (!cleanName) return null;

  const files = [
    ...(activeFile ? [activeFile] : []),
    ...allFiles.filter(f => f !== activeFile)
  ].filter(Boolean);

  // Case 1: Dotted path, e.g. "knot_name.stitch_name"
  if (cleanName.includes('.')) {
    const parts = cleanName.split('.');
    const knotName = parts[0];
    const stitchName = parts[1];

    for (const file of files) {
      if (file.symbols && file.symbols[knotName]) {
        const knot = file.symbols[knotName];
        if (knot.innerSymbols && knot.innerSymbols[stitchName]) {
          const stitch = knot.innerSymbols[stitchName];
          return { file, row: stitch.row, column: stitch.column || 0 };
        }
      }
    }

    // Text fallback for dotted path
    for (const file of files) {
      if (!file.content) continue;
      const lines = file.content.split('\n');
      let inTargetKnot = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const knotMatch = line.match(/^\s*==+\s*(?:function\s+)?(\w+)/);
        if (knotMatch) {
          inTargetKnot = (knotMatch[1] === knotName);
        }
        if (inTargetKnot) {
          const stitchMatch = line.match(/^\s*=\s*(\w+)/);
          if (stitchMatch && stitchMatch[1] === stitchName) {
            return { file, row: i, column: 0 };
          }
        }
      }
    }
    return null;
  }

  // Case 2: Single identifier (knot, stitch, function, variable, constant)

  // 2a. If currentCursorRow is provided, check if cleanName is a stitch in the active knot
  if (activeFile && currentCursorRow !== null && activeFile.symbols) {
    for (const knotName of Object.keys(activeFile.symbols)) {
      const knot = activeFile.symbols[knotName];
      if (knot.innerSymbols && knot.innerSymbols[cleanName]) {
        // If the knot started before or at cursor row, prioritize it
        if (knot.row <= currentCursorRow) {
          const stitch = knot.innerSymbols[cleanName];
          return { file: activeFile, row: stitch.row, column: stitch.column || 0 };
        }
      }
    }
  }

  // 2b. Check for top-level knot or function across files (active file first)
  for (const file of files) {
    if (file.symbols && file.symbols[cleanName]) {
      const symbol = file.symbols[cleanName];
      return { file, row: symbol.row, column: symbol.column || 0 };
    }
  }

  // 2c. Check for stitch in any knot across files
  for (const file of files) {
    if (file.symbols) {
      for (const knotName of Object.keys(file.symbols)) {
        const knot = file.symbols[knotName];
        if (knot.innerSymbols && knot.innerSymbols[cleanName]) {
          const stitch = knot.innerSymbols[cleanName];
          return { file, row: stitch.row, column: stitch.column || 0 };
        }
      }
    }
  }

  // 2d. Check for variables / constants / lists via regex
  const varRegex = new RegExp(`^\\s*(?:VAR|CONST|LIST)\\s+${cleanName}\\b`);
  for (const file of files) {
    if (!file.content) continue;
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (varRegex.test(lines[i])) {
        return { file, row: i, column: 0 };
      }
    }
  }

  // 2e. Text fallback for knots, functions, or stitches
  const knotFuncRegex = new RegExp(`^\\s*==+\\s*(?:function\s+)?${cleanName}\\b`);
  const stitchRegex = new RegExp(`^\\s*=\\s*${cleanName}\\b`);

  for (const file of files) {
    if (!file.content) continue;
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (knotFuncRegex.test(lines[i]) || stitchRegex.test(lines[i])) {
        return { file, row: i, column: 0 };
      }
    }
  }

  return null;
}
