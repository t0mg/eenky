# Auto-Player (Fuzzer) Design Document

## Overview
The goal of this feature is to provide an automated testing mechanism (a "Fuzzer") for Ink projects. It will automatically play through the user's story thousands of times making random choices to discover runtime errors, loose ends (out of flow), and suspicious story paths, helping authors find bugs in complex branching narratives.

## Approach: The "Hybrid Continuous Fuzzer"
This approach combines a silent background runner with an on-demand UI, providing constant validation without interrupting the creative flow, while remaining mindful of system resources.

### 1. UX & UI Integration
* **Auto-Player Issues Panel:** A new dedicated panel will be added under the existing "Issues" panel in the sidebar. This panel will list the unique crashes and anomalies found by the fuzzer.
* **Manual Toggle:** Because headless running thousands of times can consume CPU and battery, there will be a clear manual toggle in the menu (and potentially the UI) to turn the Auto-Player ON/OFF. Users can decide when the time is right to have it running.
* **Seamless Replay:** When a user clicks on an issue in the Auto-Player panel, the current run in the JS Preview is immediately replaced by the failed run. The user does not need to explicitly "exit" this replay mode; it simply overwrites the ongoing manual run. The user can then use the existing undo functionality to step back and inspect variables leading up to the error.

### 2. Error & Anomaly Detection
The fuzzer will monitor for several categories of issues:
* **Runtime Errors:** Hard crashes or exceptions thrown by the Ink engine during evaluation.
* **Out of Flow (Loose Ends):** The story runs out of choices or text, but has not reached an explicit finishing knot (like `-> DONE` or `-> END`).
* **Infinite Loops:** Detected via a turn-limit heuristic (e.g., if a run exceeds 10,000 turns without ending, it's flagged as a potential infinite loop).
* **Statistical Outliers:** The fuzzer will monitor the average run length (in turns/choices) and flag runs that are statistical outliers (suspiciously short or exceptionally long runs) which might indicate logical flaws in the narrative structure.

### 3. Replay Mechanism (State Injection)
Because Ink features built-in randomness (e.g., `{~a|b|c}` or shuffles), simply recording and replaying the sequence of choice indices is not sufficient; a replay might diverge from the original fuzzer run.
* **Solution:** Instead of replaying choices, the fuzzer will rely on extracting the Ink engine's runtime state. When an error is encountered, the exact state (or the history of states) is captured.
* **Application:** When the user clicks an issue, this serialized state history is applied to the JS Preview renderer in bulk. This guarantees that the JS Preview perfectly reconstructs the exact context of the crash, regardless of built-in randomness.

### 4. Resource Management & Performance
To prevent battery drain and excessive CPU fan usage:
* **Headless Execution:** The fuzzer runs in a background thread or Web Worker to ensure the main UI thread (editor) remains responsive.
* **Idle Triggers:** The fuzzer resets and restarts its test suite any time the Ink files are edited. To prevent thrashing, it should wait for a brief idle period (e.g., user hasn't typed for a few seconds) before spinning up.
* **Auto-Termination:** The runner will stop after a set period of inactivity, a maximum number of total iterations, or if it completes a large number of runs without discovering any *new* issues. It resumes when the files are modified again.
