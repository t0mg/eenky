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
EXTERNAL missing_function()
* [Safe] -> safe
* [Crash] -> crash

=== safe ===
Safe path.
-> END

=== crash ===
~ missing_function()
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

    const engine = new FuzzerEngine({ maxTurnsPerRun: 100 });
    const result = engine.runSingleSimulation(json);

    expect(result.stateHistory.length).toBeGreaterThanOrEqual(2);

    // Test restoring state at turn 1
    const step1State = result.stateHistory[0].stateJson;
    expect(step1State).toBeDefined();

    const replayStory = new inkjs.Story(json);
    replayStory.state.LoadJson(step1State);

    expect(replayStory.variablesState['score']).toBe(10);
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
});
