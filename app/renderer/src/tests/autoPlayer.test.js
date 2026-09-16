import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import inkjs from 'inkjs';
import { FuzzerEngine } from '../core/fuzzerEngine.js';
import { AutoPlayer } from '../core/autoPlayer.js';
import { useProjectStore } from '../stores/projectStore.js';

describe('Auto-Player Fuzzer Engine', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const compileInk = (inkSource) => {
    const CompilerClass = inkjs.Compiler || inkjs;
    const compiler = new CompilerClass(inkSource);
    const story = compiler.Compile();
    return JSON.parse(story.ToJson());
  };

    const userInk = `
LIST Inventory = (Key), (Torch), (Amulet)
VAR lastUsed = ()
-> dark 

= dark
It's dark. You can't see. 

- (top)
    -> useSomething ->
    {
    - used(Torch): 
        The torch light illuminates the rocky tunnel ahead.
        -> tunnel
    - used(Amulet): 
        The amulet is glowing faintly. 
        -> top
    - used(()):
        It's too dark to do anything useful with that.
        -> top
    }
    
*   [ Feel for the walls ] 
    They're hard stone.

*   [ Call out ] 
    "Hello!"
    Your voice echoes away into darkness. Nothing comes back. 

-   -> top 

= tunnel
The tunnel ends in a gate. 
~ temp gate_unlocked = false
- (top)
    -> useSomething ->
    {
    - used(Key): 
        {gate_unlocked:
            You lock the gate once more. 
            ~ gate_unlocked = false
        - else: 
            The key fits the gate. It turns. 
            ~ gate_unlocked = true 
        }
        -> top 
    - used(Torch):
        You turn the torch off again.
        -> dark 
    - used(()):
        That doesn't seem helpful here?
        -> top
    }
    
*   {not gate_unlocked} [ Open the gate ] 
    The gate seems to be locked. 

*   {not gate_unlocked} [ Rattle the gate ] 
    You throw your weight against the gate but it doesn't open. 
    
*   {gate_unlocked} [ Open the gate ] 
    You pull the gate and it swings open.
    -> through_gate
    

-   -> top 

= through_gate
    You've escaped!
    -> DONE
    
    
=== useSomething
    ~ lastUsed = ()
    ~ temp items = Inventory
    + +   {items} [ ITEM MENU ] 
            -> offerItem(items)
    -   ->->
    
= offerItem(items)    
    ~ temp item = pop(items) 
    {item:
        +   (did) [ USE {item} ] 
            ~ lastUsed = item
            ->-> 
    }
    { items: -> offerItem(items) } 
    +   [ BACK ] -> useSomething
        
       
    
 === function used(q)
    { came_from(-> useSomething.did):
        ~ return (q && lastUsed == q) || (not q && lastUsed)
    }
    ~ return false

=== function came_from(-> x) 
    ~ return TURNS_SINCE(x) == 0

=== function pop(ref _list) 
    ~ temp el = LIST_MIN(_list) 
    ~ _list -= el
    ~ return el 
`;

  it('runs user story through gate without false positive loose end', () => {
    const json = compileInk(userInk);
    const engine = new FuzzerEngine({ maxTurnsPerRun: 100 });

    let looseEnds = 0;
    for (let i = 0; i < 50; i++) {
      const result = engine.runSingleSimulation(json);
      if (result.issue && result.issue.type === 'loose_end') {
        looseEnds++;
        console.log('UNEXPECTED LOOSE END:', result.issue.message, result.issue.stateHistory[result.issue.stateHistory.length - 1]?.text);
      }
    }

    expect(looseEnds).toBe(0);
  });

  it('runs cleanly on a valid branching story with explicit endings', () => {
    const json = compileInk(`
Hello traveler.
* [Go north] -> north
* [Go south] -> south

=== north ===
You go north.
-> END

=== south ===
You go south.
-> END
`);

    const engine = new FuzzerEngine({ maxTurnsPerRun: 100 });
    const result = engine.runSingleSimulation(json);

    expect(result.success).toBe(true);
    expect(result.issue).toBeNull();
    expect(result.stateHistory.length).toBeGreaterThanOrEqual(2);
    expect(result.turnCount).toBeGreaterThanOrEqual(1);
  });

  it('detects loose ends (out of flow) when a story runs out of content without -> END or -> DONE', () => {
    const json = compileInk(`
Beginning.
* [Branch A] -> branch_a
* [Branch B] -> branch_b

=== branch_a ===
This ends properly.
-> END

=== branch_b ===
This runs off the edge of the world into a loose end.
`);

    const engine = new FuzzerEngine({ maxTurnsPerRun: 100 });
    let foundLooseEnd = false;
    for (let i = 0; i < 50; i++) {
      const result = engine.runSingleSimulation(json);
      if (result.issue && result.issue.type === 'loose_end') {
        foundLooseEnd = true;
        expect(result.issue.stateHistory.length).toBeGreaterThan(0);
        expect(result.issue.finalStateJson).toBeDefined();
        break;
      }
    }

    expect(foundLooseEnd).toBe(true);
  });

  it('detects infinite loops when a run exceeds the turn limit', () => {
    const json = compileInk(`
Starting.
+ [Enter loop] -> endless_loop

=== endless_loop ===
Spinning...
+ [Loop again] -> endless_loop
`);

    const engine = new FuzzerEngine({ maxTurnsPerRun: 15 });
    const result = engine.runSingleSimulation(json);

    expect(result.success).toBe(false);
    expect(result.issue).toBeDefined();
    expect(result.issue.type).toBe('infinite_loop');
    expect(result.issue.turnCount).toBe(15);
    expect(result.issue.message).toContain('Potential infinite loop: run exceeded 15 turns');
  });

  it('detects runtime errors and captures error state history', () => {
    const json = compileInk(`
EXTERNAL missing_function_no_fallback()
* [Safe] -> safe
* [Crash] -> crash

=== safe ===
Safe path.
-> END

=== crash ===
Crash {missing_function_no_fallback()}
-> END
`);

    const engine = new FuzzerEngine({ maxTurnsPerRun: 100 });
    let foundCrash = false;

    for (let i = 0; i < 50; i++) {
      const result = engine.runSingleSimulation(json);
      if (result.issue && result.issue.type === 'runtime_error') {
        foundCrash = true;
        expect(result.issue.stateHistory.length).toBeGreaterThan(0);
        expect(result.issue.stateHistory[result.issue.stateHistory.length - 1].error).toBeDefined();
        break;
      }
    }

    expect(foundCrash).toBe(true);
  });

  it('runs safely when an unbound external function has a fallback knot', () => {
    const json = compileInk(`
EXTERNAL missing_function_with_fallback()
* [Go] -> go

=== go ===
Result is {missing_function_with_fallback()}
-> END

=== function missing_function_with_fallback() ===
~ return "fallback_result"
`);

    const engine = new FuzzerEngine({ maxTurnsPerRun: 50 });

    let foundCrash = false;
    for (let i = 0; i < 50; i++) {
      const result = engine.runSingleSimulation(json);
      engine.recordSimulationResult(result);
      if (result.issue) {
        foundCrash = true;
      }
    }

    expect(foundCrash).toBe(false);
  });

  it('deduplicates identical issues and increments occurrence counts', () => {
    const json = compileInk(`
Loose end right away.
`);

    const engine = new FuzzerEngine({ maxTurnsPerRun: 50 });

    for (let i = 0; i < 10; i++) {
      const result = engine.runSingleSimulation(json);
      engine.recordSimulationResult(result);
    }

    const issues = engine.getIssuesList();
    expect(issues.length).toBe(1);
    expect(issues[0].type).toBe('loose_end');
    expect(issues[0].occurrenceCount).toBe(10);
  });

  it('disables statistical outlier detection by default to save compute', () => {
    const defaultEngine = new FuzzerEngine({
      minRunsForOutliers: 30,
      outlierZThreshold: 2.5
    });

    for (let i = 0; i < 40; i++) {
      defaultEngine.recordSimulationResult({
        success: true,
        turnCount: 50 + (i % 3),
        stateHistory: []
      });
    }

    const isOutlier = defaultEngine.recordSimulationResult({
      success: true,
      turnCount: 1,
      stateHistory: [{ text: 'Quick exit', tags: [], choices: [], chosenIndex: null, stateJson: '{}' }]
    });

    expect(isOutlier).toBe(false);
    expect(defaultEngine.getIssuesList().length).toBe(0);
  });

  it('detects statistical outliers when explicitly enabled', () => {
    const engine = new FuzzerEngine({
      enableOutliers: true,
      minRunsForOutliers: 30,
      outlierZThreshold: 2.5
    });

    // Populate baseline runs of length ~50
    for (let i = 0; i < 40; i++) {
      engine.recordSimulationResult({
        success: true,
        turnCount: 50 + (i % 3),
        stateHistory: []
      });
    }

    // Now record an extreme shortcut outlier (length 1)
    const isOutlier = engine.recordSimulationResult({
      success: true,
      turnCount: 1,
      stateHistory: [{ text: 'Quick exit', tags: [], choices: [], chosenIndex: null, stateJson: '{}' }]
    });

    expect(isOutlier).toBe(true);
    const issues = engine.getIssuesList();
    const outlier = issues.find(iss => iss.type === 'outlier');
    expect(outlier).toBeDefined();
    expect(outlier.message).toContain('Suspiciously short run');
  });

  it('supports full state serialization and exact replay injection', () => {
    const json = compileInk(`
VAR score = 10
Turn 1. Score is {score}.
* [Add 5] -> add5
* [Subtract 3] -> sub3

=== add5 ===
~ score = score + 5
Turn 2. Score is {score}.
-> END

=== sub3 ===
~ score = score - 3
Turn 2. Score is {score}.
-> END
`);

    const engine = new FuzzerEngine({ maxTurnsPerRun: 100, captureStepStates: true });
    const result = engine.runSingleSimulation(json);

    expect(result.stateHistory.length).toBeGreaterThanOrEqual(2);

    // Test restoring state at turn 1
    const step1State = result.stateHistory[0].stateJson;
    expect(step1State).toBeDefined();

    const replayStory = new inkjs.Story(json);
    replayStory.state.LoadJson(step1State);

    expect(replayStory.variablesState['score']).toBe(10);
  });

  it('tracks discovered checkpoints/chapters with encounter counts and percentages', () => {
    let ink = '-> start\n=== start ===\n';
    for (let i = 1; i <= 5; i++) {
      ink += `Line ${i}\n# CHAPTER: Awakening ${i}\n`;
    }
    ink += '-> END\n';

    const json = compileInk(ink);
    const engine = new FuzzerEngine({ maxCheckpointsPerRun: 25 });
    const result = engine.runSingleSimulation(json);

    expect(result.issue).toBeNull();
    expect(result.success).toBe(true);

    engine.recordSimulationResult(result);
    const stats = engine.getStats();
    expect(stats.checkpointsDiscoveredCount).toBe(5);
    expect(stats.namedCheckpointsCount).toBe(5);
    expect(stats.unnamedCheckpointsCount).toBe(0);
    expect(stats.checkpointsDetails.length).toBe(5);
    expect(stats.checkpointsDetails.find(c => c.name === 'Awakening 1')?.count).toBe(1);
    expect(stats.checkpointsDetails.find(c => c.name === 'Awakening 1')?.percentage).toBe(100);
    expect(stats.uniqueIssuesCount).toBe(0);
  });

  it('tracks unnamed checkpoints and mixed checkpoints correctly', () => {
    // Story with 1 named chapter and 2 unnamed checkpoints at different knots
    const ink = `
-> knot_a
=== knot_a ===
First knot
# CHECKPOINT
-> knot_b
=== knot_b ===
Second knot
# CHECKPOINT: Chapter One
-> knot_c
=== knot_c ===
Third knot
# CHECKPOINT
-> END
`;
    const json = compileInk(ink);
    const engine = new FuzzerEngine({ maxCheckpointsPerRun: 25 });
    const result = engine.runSingleSimulation(json);

    expect(result.issue).toBeNull();
    engine.recordSimulationResult(result);

    const stats = engine.getStats();
    expect(stats.namedCheckpointsCount).toBe(1);
    expect(stats.unnamedCheckpointsCount).toBe(2);
    expect(stats.checkpointsDiscoveredCount).toBe(3);
    expect(stats.checkpointsDetails.find(c => c.name === 'Chapter One')).toBeDefined();
    expect(stats.checkpointsDetails.find(c => c.isUnnamed)).toBeDefined();
  });

  it('detects runaway checkpoints and issues an excessive checkpoints warning', () => {
    // Generate a story with 30 checkpoints exceeding threshold
    let ink = 'VAR x = 0\n-> start\n=== start ===\n';
    for (let i = 1; i <= 30; i++) {
      ink += `~ x = ${i * 100}\nLine ${i}\n# CHECKPOINT: Chapter ${i}\n`;
    }
    ink += '-> END\n';

    const json = compileInk(ink);
    const engine = new FuzzerEngine({ maxCheckpointsPerRun: 25 });
    const result = engine.runSingleSimulation(json);

    expect(result.issue).toBeDefined();
    expect(result.issue.type).toBe('excessive_checkpoints');
    expect(result.issue.message).toContain('Runaway checkpoints');
    expect(result.issue.message).toContain('30 active checkpoints');

    engine.recordSimulationResult(result);
    const stats = engine.getStats();
    expect(stats.checkpointsDiscoveredCount).toBe(30);
    expect(stats.namedCheckpointsCount).toBe(30);
    expect(stats.checkpointsDetails.find(c => c.name === 'Chapter 1')).toBeDefined();
    expect(stats.checkpointsDetails.find(c => c.name === 'Chapter 30')).toBeDefined();
  });

  it('autoPlayer controller toggles enabled state and updates store', () => {
    const projectStore = useProjectStore();
    expect(projectStore.autoPlayerEnabled).toBe(true);

    AutoPlayer.setEnabled(false);
    expect(projectStore.autoPlayerEnabled).toBe(false);
    expect(projectStore.autoPlayerStatus).toBe('paused');

    AutoPlayer.toggle();
    expect(projectStore.autoPlayerEnabled).toBe(true);
  });

  it('assigns random seeds and tracks seed in results and issues', () => {
    const looseEndInk = '-> knot\n=== knot ===\nLoose end content\n';
    const json = compileInk(looseEndInk);
    const engine = new FuzzerEngine();
    const result = engine.runSingleSimulation(json);

    expect(typeof result.seed).toBe('number');
    expect(result.seed).toBeGreaterThan(0);
    expect(result.issue).toBeDefined();
    expect(result.issue.seed).toBe(result.seed);

    engine.recordSimulationResult(result);
    const issues = engine.getIssuesList();
    expect(issues.length).toBe(1);
    expect(issues[0].seed).toBe(result.seed);
  });

  it('respects in-script SEED_RANDOM over engine seed and records the script seed', () => {
    const seededInk = `
~ SEED_RANDOM(777)
{RANDOM(1, 100)}
-> dead_end
=== dead_end ===
Dead end without done or end
`;
    const json = compileInk(seededInk);
    const engine = new FuzzerEngine();
    const result = engine.runSingleSimulation(json, 9999);

    expect(result.seed).toBe(777);
    expect(result.issue).toBeDefined();
    expect(result.issue.seed).toBe(777);
  });

  it('produces identical deterministic runs when forcedSeed is provided', () => {
    const randomStory = `
{RANDOM(1, 1000)}
* [A]
    {RANDOM(1, 1000)}
    -> END
* [B]
    {RANDOM(1, 1000)}
    -> END
`;
    const json = compileInk(randomStory);
    const engine = new FuzzerEngine();
    const run1 = engine.runSingleSimulation(json, 4242);
    const run2 = engine.runSingleSimulation(json, 4242);

    expect(run1.seed).toBe(4242);
    expect(run2.seed).toBe(4242);
    expect(run1.stateHistory[0].text).toBe(run2.stateHistory[0].text);
  });

  it('omits per-turn stateJson by default for speed, while retaining finalStateJson on issues', () => {
    const errorStory = `
VAR count = 0
-> step1
=== step1 ===
~ count = count + 1
First step.
* [Go] -> step2
=== step2 ===
~ count = count + 1
Second step with loose end.
`;
    const json = compileInk(errorStory);
    const engine = new FuzzerEngine({ maxTurnsPerRun: 100 });
    const result = engine.runSingleSimulation(json);

    expect(result.issue).toBeDefined();
    expect(result.issue.type).toBe('loose_end');
    expect(result.issue.finalStateJson).toBeDefined();

    // Verify intermediate step omitted stateJson to save CPU/memory
    expect(result.stateHistory[0].stateJson).toBeUndefined();
  });

  it('captures per-turn stateJson when captureStepStates is explicitly enabled', () => {
    const story = `
VAR count = 0
-> step1
=== step1 ===
~ count = count + 1
First step.
* [Go] -> step2
=== step2 ===
Second step.
-> END
`;
    const json = compileInk(story);
    const engine = new FuzzerEngine({ maxTurnsPerRun: 100, captureStepStates: true });
    const result = engine.runSingleSimulation(json);

    expect(result.success).toBe(true);
    expect(result.stateHistory[0].stateJson).toBeDefined();
    expect(typeof result.stateHistory[0].stateJson).toBe('string');
  });

  it('defaults maxTurnsPerRun to 2000 and detects infinite loop at 2000', () => {
    const loopStory = `
-> loop
=== loop ===
Spinning...
+ [Again] -> loop
`;
    const json = compileInk(loopStory);
    const engine = new FuzzerEngine();
    expect(engine.maxTurnsPerRun).toBe(2000);

    const result = engine.runSingleSimulation(json);
    expect(result.issue).toBeDefined();
    expect(result.issue.type).toBe('infinite_loop');
    expect(result.issue.turnCount).toBe(2000);
  });

  it('tracks checkpoints by chapter name and by knot address, folding dynamic names', () => {
    const dynamicCheckpointStory = `
VAR charClass = "Warrior"
-> prologue.class_select

=== prologue ===
= class_select
{RANDOM(1, 2) == 1:
  ~ charClass = "Warrior"
  # CHECKPOINT: Chapter 1 - Warrior Class
- else:
  ~ charClass = "Mage"
  # CHECKPOINT: Chapter 1 - Mage Class
}
Selected {charClass}.
-> castle

=== castle ===
# CHECKPOINT: The Castle Gates
Arrived at castle.
-> END
`;
    const json = compileInk(dynamicCheckpointStory);
    const engine = new FuzzerEngine({ maxTurnsPerRun: 50 });

    for (let i = 0; i < 20; i++) {
      const result = engine.runSingleSimulation(json);
      engine.recordSimulationResult(result);
    }

    const stats = engine.getStats();
    expect(stats.runsCompleted).toBe(20);

    // By Name: "The Castle Gates" (100%), and Warrior / Mage split
    expect(stats.checkpointsDetails.length).toBe(3);
    const castleByName = stats.checkpointsDetails.find(c => c.name === 'The Castle Gates');
    expect(castleByName).toBeDefined();
    expect(castleByName.percentage).toBe(100);

    // By Knot: "prologue.class_select" should fold BOTH dynamic chapter names into one entry!
    expect(stats.checkpointsByKnotDetails.length).toBe(2);
    const classSelectKnot = stats.checkpointsByKnotDetails.find(c => c.knot === 'prologue.class_select');
    expect(classSelectKnot).toBeDefined();
    expect(classSelectKnot.percentage).toBe(100); // reached on every run!
    expect(classSelectKnot.count).toBe(20);
    expect(classSelectKnot.titles).toContain('Chapter 1 - Warrior Class');
    expect(classSelectKnot.titles).toContain('Chapter 1 - Mage Class');

    const castleKnot = stats.checkpointsByKnotDetails.find(c => c.knot === 'castle');
    expect(castleKnot).toBeDefined();
    expect(castleKnot.percentage).toBe(100);
    expect(castleKnot.titles).toEqual(['The Castle Gates']);
  });
});
