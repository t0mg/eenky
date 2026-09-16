import inkjs from 'inkjs';

/**
 * Extract clean knot/stitch address from inkjs path string (e.g. "prologue.class_select.0.c-0" -> "prologue.class_select")
 */
function extractKnotAddress(pathString) {
  if (!pathString || pathString === 'Unknown' || pathString === 'root') {
    return pathString || 'root';
  }
  const parts = pathString.split('.');
  const namedParts = [];
  for (const p of parts) {
    if (/^\d+$/.test(p) || /^[cgs]-\d+$/i.test(p)) {
      break;
    }
    namedParts.push(p);
  }
  return namedParts.length > 0 ? namedParts.join('.') : pathString;
}

/**
 * Safely get the story current location path, falling back to outputStream if story reached END/DONE
 */
function getStoryLocation(story) {
  if (story?.state?.currentPathString) {
    return story.state.currentPathString;
  }
  if (story?.state?.outputStream && story.state.outputStream.length > 0) {
    for (let i = story.state.outputStream.length - 1; i >= 0; i--) {
      const item = story.state.outputStream[i];
      const p = item?.path?.toString ? item.path.toString() : (typeof item?.path === 'string' ? item.path : null);
      if (p) return p;
    }
  }
  return 'Unknown';
}

/**
 * FuzzerEngine runs headless random playthroughs of an Ink story,
 * detecting runtime errors, loose ends (out of flow), infinite loops,
 * and statistical outliers.
 */
export class FuzzerEngine {
  constructor(options = {}) {
    this.maxTurnsPerRun = options.maxTurnsPerRun || 2000;
    this.maxTotalRuns = options.maxTotalRuns || 5000;
    this.stableRunsThreshold = options.stableRunsThreshold || 5000;
    this.batchSize = options.batchSize || 50;
    this.enableOutliers = options.enableOutliers || false;
    this.minRunsForOutliers = options.minRunsForOutliers || 30;
    this.outlierZThreshold = options.outlierZThreshold || 3.0;
    this.maxCheckpointsPerRun = options.maxCheckpointsPerRun || 25;
    this.captureStepStates = options.captureStepStates || false;

    this.reset();
  }

  reset() {
    this.runsCompleted = 0;
    this.runsSinceLastNewIssue = 0;
    this.successfulRunLengths = [];
    this.sumLengths = 0;
    this.sumSquaredLengths = 0;
    this.issuesMap = new Map(); // key -> issue object
    this.checkpointEncounterCounts = new Map(); // name -> count of runs that reached this named checkpoint
    this.checkpointKnotEncounterCounts = new Map(); // knotOrPath -> count of runs that reached a checkpoint at this knot
    this.knotCheckpointTitles = new Map(); // knotOrPath -> Set<string> of unique named checkpoint titles seen at this knot
    this.knotIsUnnamed = new Map(); // knotOrPath -> boolean
    this.unnamedCheckpointLocations = new Set(); // set of unique knotOrPath locations where unnamed checkpoints were hit
    this.unnamedCheckpointRunsCount = 0; // count of runs that reached at least one unnamed checkpoint
    this.maxCheckpointsInSingleRun = 0;
  }

  /**
   * Run a single simulation playthrough of the story.
   * @param {Object|string} storyJson Compiled Ink JSON
   * @param {number|null} [forcedSeed=null] Optional seed to run with
   * @returns {Object} { issue: Object|null, turnCount: number, success: boolean, stateHistory: Array, seed: number }
   */
  runSingleSimulation(storyJson, forcedSeed = null) {
    const StoryClass = inkjs.Story || inkjs;
    const seed = forcedSeed !== null && forcedSeed !== undefined
      ? forcedSeed
      : Math.floor(Math.random() * 1000000) + 1;

    let story;
    try {
      story = new StoryClass(storyJson);
      story.allowExternalFunctionFallbacks = true;
      if (story.state) {
        story.state.storySeed = seed;
        story.state.previousRandom = 0;
      }
    } catch (err) {
      const errorMsg = err?.message || String(err);
      return {
        issue: {
          id: 'init_error',
          type: 'runtime_error',
          message: `Story initialization error: ${errorMsg}`,
          turnCount: 0,
          knotOrPath: 'root',
          stateHistory: [],
          finalStateJson: null,
          occurrenceCount: 1,
          seed
        },
        turnCount: 0,
        success: false,
        stateHistory: [],
        seed
      };
    }

    const stateHistory = [];
    const activeCheckpoints = new Map();
    let turn = 0;
    let error = null;
    let issue = null;

    while (turn < this.maxTurnsPerRun) {
      let text = '';
      const tags = [];

      try {
        while (story.canContinue) {
          const chunk = story.Continue();
          if (chunk) text += chunk;
          if (story.currentTags && story.currentTags.length > 0) {
            tags.push(...story.currentTags);
            const currentLoc = getStoryLocation(story);
            for (const t of story.currentTags) {
              const upper = t.toUpperCase();
              if (upper.includes('CHECKPOINT') || upper.includes('CHAPTER')) {
                let isCheckpoint = false;
                let title = '';
                const cpNamedMatch = t.match(/^(?:CHECKPOINT|CHAPTER)(?::\s*|\s+)(.*)$/i);
                if (cpNamedMatch) {
                  isCheckpoint = true;
                  title = cpNamedMatch[1].trim();
                } else if (/^(?:CHECKPOINT|CHAPTER)$/i.test(t.trim())) {
                  isCheckpoint = true;
                  title = '';
                }

                if (isCheckpoint) {
                  const knotOrPath = extractKnotAddress(currentLoc);
                  activeCheckpoints.set(title || `__unnamed_${knotOrPath}__`, {
                    turn,
                    knotOrPath,
                    title,
                    isNamed: Boolean(title)
                  });
                }
              }
            }
          }
        }

        if (story.hasError) {
          const errors = story.currentErrors || [];
          error = errors.join('; ') || 'Unknown runtime error';
        }
      } catch (err) {
        error = err?.message || String(err);
      }

      if (error) {
        let stateJson = null;
        try {
          stateJson = story.state.ToJson();
        } catch (_) {}

        stateHistory.push({
          text,
          tags,
          choices: [],
          chosenIndex: null,
          ...(this.captureStepStates && { stateJson }),
          error
        });

        const isLooseEnd = error.toLowerCase().includes('ran out of content') || 
                           error.toLowerCase().includes('do you need a') ||
                           error.toLowerCase().includes('-> done') ||
                           error.toLowerCase().includes('-> end');

        const issueType = isLooseEnd ? 'loose_end' : 'runtime_error';
        const loc = story.state?.currentPathString || 'root';
        issue = {
          type: issueType,
          message: error,
          turnCount: turn,
          knotOrPath: loc,
          stateHistory,
          finalStateJson: stateJson
        };
        break;
      }

      const choices = (story.currentChoices || []).map((c, i) => ({
        text: c.text,
        index: c.index !== undefined ? c.index : i
      }));

      let stepStateJson = null;
      if (this.captureStepStates) {
        try {
          stepStateJson = story.state.ToJson();
        } catch (_) {}
      }

      if (choices.length > 0) {
        // Pick a random choice
        const choiceIdx = Math.floor(Math.random() * choices.length);
        stateHistory.push({
          text,
          tags,
          choices,
          chosenIndex: choiceIdx,
          ...(this.captureStepStates && { stateJson: stepStateJson })
        });

        // Track choice tags if present
        const chosenChoice = story.currentChoices ? story.currentChoices[choiceIdx] : null;
        if (chosenChoice && chosenChoice.tags && chosenChoice.tags.length > 0) {
          for (const t of chosenChoice.tags) {
            const upper = t.toUpperCase();
            if (upper.includes('CHECKPOINT') || upper.includes('CHAPTER')) {
              let isCheckpoint = false;
              let title = '';
              const cpNamedMatch = t.match(/^(?:CHECKPOINT|CHAPTER)(?::\s*|\s+)(.*)$/i);
              if (cpNamedMatch) {
                isCheckpoint = true;
                title = cpNamedMatch[1].trim();
              } else if (/^(?:CHECKPOINT|CHAPTER)$/i.test(t.trim())) {
                isCheckpoint = true;
                title = '';
              }

              if (isCheckpoint) {
                const knotOrPath = extractKnotAddress(getStoryLocation(story));
                activeCheckpoints.set(title || `__unnamed_${knotOrPath}__`, {
                  turn,
                  knotOrPath,
                  title,
                  isNamed: Boolean(title)
                });
              }
            }
          }
        }

        try {
          story.ChooseChoiceIndex(choiceIdx);
        } catch (err) {
          const choiceError = err?.message || String(err);
          let stateJson = null;
          try {
            stateJson = story.state?.ToJson();
          } catch (_) {}

          stateHistory.push({
            text: '',
            tags: [],
            choices: [],
            chosenIndex: null,
            ...(this.captureStepStates && { stateJson }),
            error: choiceError
          });
          issue = {
            type: 'runtime_error',
            message: choiceError,
            turnCount: turn,
            knotOrPath: story.state?.currentPathString || 'Unknown',
            stateHistory,
            finalStateJson: stateJson
          };
          break;
        }

        turn++;
      } else {
        // Cannot continue and no choices
        let isSafeExit = story.state?.didSafeExit === true;

        if (!isSafeExit) {
          const prevPtr = story.state?.previousPointer;
          if (!prevPtr || prevPtr.isNull) {
            isSafeExit = true;
          } else {
            const container = prevPtr.container;
            if (container && Array.isArray(container._content)) {
              const contents = container._content;
              for (let i = Math.max(0, (prevPtr.index || 0) - 1); i < contents.length; i++) {
                const item = contents[i];
                if (!item) continue;
                if (item.commandType === 19 || item.commandType === 20) {
                  isSafeExit = true;
                  break;
                }
                const str = item.toString ? item.toString() : '';
                if (str.includes('Done') || str.includes('End') || str.includes('ControlCommand 19') || str.includes('ControlCommand 20')) {
                  isSafeExit = true;
                  break;
                }
              }
            }
          }
        }

        stateHistory.push({
          text,
          tags,
          choices: [],
          chosenIndex: null,
          ...(this.captureStepStates && { stateJson: stepStateJson })
        });

        if (!isSafeExit) {
          // Out of flow / loose end
          let stateJson = null;
          try {
            stateJson = story.state?.ToJson();
          } catch (_) {}
          const loc = story.state?.currentPathString || 'root';
          issue = {
            type: 'loose_end',
            message: `Story ran out of content without reaching -> END or -> DONE at ${loc}`,
            turnCount: turn,
            knotOrPath: loc,
            stateHistory,
            finalStateJson: stateJson
          };
        }
        break;
      }
    }

    if (!issue && turn >= this.maxTurnsPerRun) {
      let stateJson = null;
      try {
        stateJson = story.state.ToJson();
      } catch (_) {}

      stateHistory.push({
        text: '...',
        tags: [],
        choices: [],
        chosenIndex: null,
        ...(this.captureStepStates && { stateJson }),
        error: 'Turn limit exceeded'
      });

      const loc = story.state?.currentPathString || 'Unknown';
      issue = {
        type: 'infinite_loop',
        message: `Potential infinite loop: run exceeded ${this.maxTurnsPerRun} turns at ${loc}`,
        turnCount: turn,
        knotOrPath: loc,
        stateHistory,
        finalStateJson: stateJson
      };
    }

    if (!issue && activeCheckpoints.size > this.maxCheckpointsPerRun) {
      let latestCpKnot = 'Unknown';
      for (const [, cp] of activeCheckpoints.entries()) {
        latestCpKnot = cp.knotOrPath;
      }
      let stateJson = null;
      try {
        stateJson = story.state?.ToJson();
      } catch (_) {}
      issue = {
        type: 'excessive_checkpoints',
        message: `Runaway checkpoints: playthrough accumulated ${activeCheckpoints.size} active checkpoints. Checkpoints should mark major chapters; having more than ${this.maxCheckpointsPerRun} in a single run degrades menu navigation and save performance.`,
        turnCount: turn,
        knotOrPath: latestCpKnot,
        stateHistory,
        finalStateJson: stateJson
      };
    }

    const checkpointsInRun = [];
    const namedInRun = new Set();
    const unnamedInRun = new Set();
    for (const [, cp] of activeCheckpoints.entries()) {
      checkpointsInRun.push(cp);
      if (cp.isNamed && cp.title) {
        namedInRun.add(cp.title);
      } else {
        unnamedInRun.add(cp.knotOrPath);
      }
    }

    const actualSeed = (story && story.state && story.state.storySeed !== undefined && story.state.storySeed !== null)
      ? story.state.storySeed
      : seed;

    if (issue) {
      issue.seed = actualSeed;
    }

    return {
      issue,
      turnCount: turn,
      success: !issue,
      stateHistory,
      checkpointsInRun,
      namedCheckpointsDiscovered: Array.from(namedInRun),
      unnamedCheckpointsDiscovered: Array.from(unnamedInRun),
      activeCheckpointCount: activeCheckpoints.size,
      seed: actualSeed
    };
  }

  /**
   * Process a simulation result, update distribution statistics, detect outliers, and deduplicate issues.
   * @param {Object} result Result from runSingleSimulation
   * @returns {boolean} true if a new unique issue was discovered
   */
  recordSimulationResult(result) {
    this.runsCompleted++;

    if (result.namedCheckpointsDiscovered) {
      for (const title of result.namedCheckpointsDiscovered) {
        if (title) {
          this.checkpointEncounterCounts.set(title, (this.checkpointEncounterCounts.get(title) || 0) + 1);
        }
      }
    }
    if (result.unnamedCheckpointsDiscovered && result.unnamedCheckpointsDiscovered.length > 0) {
      for (const loc of result.unnamedCheckpointsDiscovered) {
        this.unnamedCheckpointLocations.add(loc);
      }
      this.unnamedCheckpointRunsCount++;
    }
    if (result.checkpointsInRun && result.checkpointsInRun.length > 0) {
      const knotsInThisRun = new Set();
      for (const cp of result.checkpointsInRun) {
        knotsInThisRun.add(cp.knotOrPath);
        if (cp.isNamed && cp.title) {
          if (!this.knotCheckpointTitles.has(cp.knotOrPath)) {
            this.knotCheckpointTitles.set(cp.knotOrPath, new Set());
          }
          this.knotCheckpointTitles.get(cp.knotOrPath).add(cp.title);
        } else {
          this.knotIsUnnamed.set(cp.knotOrPath, true);
        }
      }
      for (const knot of knotsInThisRun) {
        this.checkpointKnotEncounterCounts.set(
          knot,
          (this.checkpointKnotEncounterCounts.get(knot) || 0) + 1
        );
      }
    }
    if (result.activeCheckpointCount !== undefined) {
      this.maxCheckpointsInSingleRun = Math.max(
        this.maxCheckpointsInSingleRun,
        result.activeCheckpointCount
      );
    }

    let isNewIssue = false;

    if (result.success) {
      if (this.enableOutliers) {
        // Record length stats for normal runs
        const length = result.turnCount;
        this.successfulRunLengths.push(length);
        this.sumLengths += length;
        this.sumSquaredLengths += length * length;

        // Check for statistical outlier once we have enough baseline data
        const n = this.successfulRunLengths.length;
        if (n >= this.minRunsForOutliers) {
          const mean = this.sumLengths / n;
          const variance = Math.max(0, (this.sumSquaredLengths / n) - (mean * mean));
          const stdDev = Math.sqrt(variance);

          if (stdDev > 0.5) {
            const zScore = (length - mean) / stdDev;
            if (Math.abs(zScore) >= this.outlierZThreshold) {
              const isShort = zScore < 0;
              const category = isShort ? 'Suspiciously short run' : 'Exceptionally long run';
              const outlierIssue = {
                type: 'outlier',
                message: `${category}: finished in ${length} turns (mean: ${mean.toFixed(1)}, σ: ${stdDev.toFixed(1)})`,
                turnCount: length,
                knotOrPath: result.issue?.knotOrPath || 'Completed Flow',
                stateHistory: result.stateHistory,
                finalStateJson: result.stateHistory[result.stateHistory.length - 1]?.stateJson || null,
                zScore,
                seed: result.seed !== undefined ? result.seed : null
              };
              isNewIssue = this._addOrUpdateIssue(outlierIssue);
            }
          }
        }
      }
    } else if (result.issue) {
      isNewIssue = this._addOrUpdateIssue(result.issue);
    }

    if (isNewIssue) {
      this.runsSinceLastNewIssue = 0;
    } else {
      this.runsSinceLastNewIssue++;
    }

    return isNewIssue;
  }

  _getIssueFingerprint(issue) {
    return `${issue.type}:::${issue.knotOrPath}:::${issue.message.split('(mean:')[0].trim()}`;
  }

  _addOrUpdateIssue(issue) {
    const key = this._getIssueFingerprint(issue);
    const existing = this.issuesMap.get(key);

    if (existing) {
      existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
      // Prefer shorter or cleaner trace for replay
      if (issue.stateHistory && issue.stateHistory.length < existing.stateHistory.length) {
        existing.stateHistory = issue.stateHistory;
        existing.finalStateJson = issue.finalStateJson;
        existing.turnCount = issue.turnCount;
        if (issue.seed !== undefined) {
          existing.seed = issue.seed;
        }
      }
      return false;
    } else {
      const newIssue = {
        ...issue,
        id: `fuzz_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        occurrenceCount: 1,
        seed: issue.seed !== undefined ? issue.seed : null
      };
      this.issuesMap.set(key, newIssue);
      return true;
    }
  }

  getIssuesList() {
    return Array.from(this.issuesMap.values());
  }

  getStats() {
    const n = this.successfulRunLengths.length;
    const mean = n > 0 ? (this.sumLengths / n) : 0;
    const variance = n > 0 ? Math.max(0, (this.sumSquaredLengths / n) - (mean * mean)) : 0;
    const stdDev = Math.sqrt(variance);

    const namedList = [];
    for (const [name, count] of this.checkpointEncounterCounts.entries()) {
      const percentage = this.runsCompleted > 0 ? Number(((count / this.runsCompleted) * 100).toFixed(1)) : 0;
      namedList.push({
        name,
        count,
        percentage,
        isUnnamed: false
      });
    }
    namedList.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const unnamedCount = this.unnamedCheckpointLocations.size;
    const namedCount = this.checkpointEncounterCounts.size;
    const totalCount = namedCount + unnamedCount;

    const allCheckpoints = [...namedList];
    if (unnamedCount > 0) {
      const count = this.unnamedCheckpointRunsCount;
      const percentage = this.runsCompleted > 0 ? Number(((count / this.runsCompleted) * 100).toFixed(1)) : 0;
      allCheckpoints.push({
        name: unnamedCount === 1 ? '(unnamed checkpoint)' : `(${unnamedCount} unnamed checkpoints)`,
        count,
        percentage,
        isUnnamed: true
      });
      allCheckpoints.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }

    const knotList = [];
    for (const [knot, count] of this.checkpointKnotEncounterCounts.entries()) {
      const percentage = this.runsCompleted > 0
        ? Number(((count / this.runsCompleted) * 100).toFixed(1))
        : 0;
      const titlesSet = this.knotCheckpointTitles.get(knot);
      const titles = titlesSet ? Array.from(titlesSet) : [];
      const isUnnamed = Boolean(this.knotIsUnnamed.get(knot) && titles.length === 0);
      knotList.push({
        knot,
        count,
        percentage,
        isUnnamed,
        titles
      });
    }
    knotList.sort((a, b) => b.count - a.count || a.knot.localeCompare(b.knot));

    return {
      runsCompleted: this.runsCompleted,
      runsSinceLastNewIssue: this.runsSinceLastNewIssue,
      successfulRuns: n,
      uniqueIssuesCount: this.issuesMap.size,
      meanLength: Number(mean.toFixed(1)),
      stdDevLength: Number(stdDev.toFixed(1)),
      checkpointsDiscoveredCount: totalCount,
      namedCheckpointsCount: namedCount,
      unnamedCheckpointsCount: unnamedCount,
      checkpointsDetails: allCheckpoints,
      checkpointsByKnotDetails: knotList,
      maxCheckpointsInSingleRun: this.maxCheckpointsInSingleRun
    };
  }

  shouldTerminate() {
    if (this.runsCompleted >= this.maxTotalRuns) {
      return { shouldStop: true, reason: 'max_runs_reached' };
    }
    if (this.runsCompleted > 500 && this.runsSinceLastNewIssue >= this.stableRunsThreshold) {
      return { shouldStop: true, reason: 'stable_no_new_issues' };
    }
    return { shouldStop: false };
  }
}
