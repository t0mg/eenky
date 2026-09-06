import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Simulator from '../components/Simulator.vue';
import { LiveCompiler } from '../core/liveCompiler.js';
import { AutoPlayer } from '../core/autoPlayer.js';

describe('Simulator Component', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders rich text formatting and HTML in choices', async () => {
    let choiceAddedCallback;
    vi.spyOn(LiveCompiler, 'setEvents').mockImplementation((events) => {
      choiceAddedCallback = events.choiceAdded;
    });

    const wrapper = mount(Simulator);

    expect(choiceAddedCallback).toBeDefined();

    // Trigger a choice with markdown and HTML tags
    const mockChoice = {
      number: 0,
      choice: {
        text: 'Go to the _dark_ **cave** <i>quietly</i>'
      }
    };

    choiceAddedCallback(mockChoice, true);
    await wrapper.vm.$nextTick();

    const choiceBtn = wrapper.find('.choice-btn');
    expect(choiceBtn.exists()).toBe(true);
    expect(choiceBtn.html()).toContain('Go to the <em>dark</em> <strong>cave</strong> <i>quietly</i>');
  });

  it('renders rich text formatting and HTML in story text', async () => {
    let textAddedCallback;
    vi.spyOn(LiveCompiler, 'setEvents').mockImplementation((events) => {
      textAddedCallback = events.textAdded;
    });

    const wrapper = mount(Simulator);

    expect(textAddedCallback).toBeDefined();

    textAddedCallback('Hello _world_ and **bold** with <b>tags</b>\nSecond line');
    await wrapper.vm.$nextTick();

    const storyText = wrapper.find('.story-text');
    expect(storyText.exists()).toBe(true);
    expect(storyText.html()).toContain('Hello <em>world</em> and <strong>bold</strong> with <b>tags</b><br>Second line');
  });

  it('handles choosing a choice correctly and injects hr divider', async () => {
    let textAddedCallback;
    let choiceAddedCallback;
    vi.spyOn(LiveCompiler, 'setEvents').mockImplementation((events) => {
      textAddedCallback = events.textAdded;
      choiceAddedCallback = events.choiceAdded;
    });
    const chooseSpy = vi.spyOn(LiveCompiler, 'choose').mockImplementation(() => {});

    const wrapper = mount(Simulator);

    textAddedCallback('First chapter story text.');
    await wrapper.vm.$nextTick();

    const mockChoice = {
      number: 1,
      choice: {
        text: 'Select _option_'
      }
    };

    choiceAddedCallback(mockChoice, true);
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.story-divider').length).toBe(0);

    const choiceBtn = wrapper.find('.choice-btn');
    await choiceBtn.trigger('click');

    expect(chooseSpy).toHaveBeenCalledWith(mockChoice);
    // Choices should be cleared from view
    expect(wrapper.find('.choice-btn').exists()).toBe(false);
    // Divider hr should be injected
    expect(wrapper.findAll('.story-divider').length).toBe(1);
    expect(wrapper.find('hr.story-divider').exists()).toBe(true);
  });

  it('injects hr divider between turns during story replay', async () => {
    let textAddedCallback;
    let playerPromptCallback;
    vi.spyOn(LiveCompiler, 'setEvents').mockImplementation((events) => {
      textAddedCallback = events.textAdded;
      playerPromptCallback = events.playerPrompt;
    });

    const wrapper = mount(Simulator);

    // Turn 1 text arrives
    textAddedCallback('Turn 1 text.');
    await wrapper.vm.$nextTick();

    // Player prompt during replay
    const doneCallback = vi.fn();
    playerPromptCallback(true, doneCallback);
    await wrapper.vm.$nextTick();

    expect(doneCallback).toHaveBeenCalled();
    expect(wrapper.findAll('.story-divider').length).toBe(1);

    // Turn 2 text arrives
    textAddedCallback('Turn 2 text.');
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.story-divider').length).toBe(1);

    // Turn 2 replaying next prompt
    const doneCallback2 = vi.fn();
    playerPromptCallback(true, doneCallback2);
    await wrapper.vm.$nextTick();

    expect(doneCallback2).toHaveBeenCalled();
    expect(wrapper.findAll('.story-divider').length).toBe(2);
  });

  it('renders fuzzer issue banner and allows stepping back through injected states', async () => {
    let replayCallback;
    const { AutoPlayer } = await import('../core/autoPlayer.js');
    vi.spyOn(AutoPlayer, 'setEvents').mockImplementation((events) => {
      replayCallback = events.replayIssue;
    });

    const wrapper = mount(Simulator);
    expect(replayCallback).toBeDefined();

    const mockIssue = {
      id: 'test_issue_1',
      type: 'loose_end',
      message: 'Story ran out of content without reaching -> END or -> DONE',
      turnCount: 1,
      knotOrPath: 'knot_cliff',
      stateHistory: [
        {
          text: 'You reach the edge of the cliff.\n',
          tags: ['location: cliff'],
          choices: [{ text: 'Jump', index: 0 }],
          chosenIndex: 0,
          stateJson: '{"variablesState":{}}'
        },
        {
          text: 'You fall into the void with no ending.\n',
          tags: [],
          choices: [],
          chosenIndex: null,
          stateJson: '{"variablesState":{}}'
        }
      ]
    };

    replayCallback(mockIssue, null);
    await wrapper.vm.$nextTick();

    // Verify transcript is rendered
    expect(wrapper.text()).toContain('You reach the edge of the cliff.');
    expect(wrapper.text()).toContain('Jump');
    expect(wrapper.text()).toContain('You fall into the void with no ending.');

    // Verify fuzzer issue banner is rendered
    const issueBanner = wrapper.find('.story-fuzzer-issue');
    expect(issueBanner.exists()).toBe(true);
    expect(issueBanner.text()).toContain('Loose End');
    expect(issueBanner.text()).toContain('knot_cliff');

    // Verify choice sequence was promoted to LiveCompiler for story editing replay
    const { LiveCompiler } = await import('../core/liveCompiler.js');
    expect(LiveCompiler.getChoiceSequence()).toEqual([1]);

    // Step back
    const stepBackBtn = wrapper.findAll('.toolbar button')[1];
    await stepBackBtn.trigger('click');
    await wrapper.vm.$nextTick();

    // After step back, banner should no longer be rendered on step 0
    expect(wrapper.find('.story-fuzzer-issue').exists()).toBe(false);
    expect(wrapper.text()).toContain('You reach the edge of the cliff.');
    expect(LiveCompiler.getChoiceSequence()).toEqual([]);
  });

  it('re-rolls random seed when rewind (restart) is clicked', async () => {
    const { useProjectStore } = await import('../stores/projectStore');
    const projectStore = useProjectStore();
    const { LiveCompiler } = await import('../core/liveCompiler.js');

    projectStore.mainInkFile = { relPath: 'main.ink', content: 'Hello' };
    LiveCompiler.setProject(projectStore);

    const wrapper = mount(Simulator);
    const initialSeed = 11111;
    projectStore.setCurrentRngSeed(initialSeed);
    LiveCompiler.setRngSeed(initialSeed);

    const rewindBtn = wrapper.findAll('.toolbar button')[0];
    await rewindBtn.trigger('click');

    expect(projectStore.currentRngSeed).not.toBeNull();
    expect(projectStore.currentRngSeed).not.toBe(initialSeed);
    expect(LiveCompiler.getRngSeed()).toBe(projectStore.currentRngSeed);
  });

  it('applies issue seed to preview player and LiveCompiler on replay', async () => {
    let replayCallback;
    vi.spyOn(AutoPlayer, 'setEvents').mockImplementation((events) => {
      replayCallback = events.replayIssue;
    });

    const { useProjectStore } = await import('../stores/projectStore');
    const projectStore = useProjectStore();
    const { LiveCompiler } = await import('../core/liveCompiler.js');

    const wrapper = mount(Simulator);
    expect(replayCallback).toBeDefined();

    const mockIssueWithSeed = {
      id: 'seeded_issue',
      type: 'runtime_error',
      message: 'Some runtime error',
      turnCount: 0,
      knotOrPath: 'root',
      seed: 888888,
      stateHistory: [
        {
          text: 'Start\n',
          tags: [],
          choices: [],
          chosenIndex: null,
          stateJson: null
        }
      ]
    };

    replayCallback(mockIssueWithSeed, { inkVersion: 21, root: [['^Start', '\n', ['done', {}], null], {}] });
    await wrapper.vm.$nextTick();

    expect(projectStore.currentRngSeed).toBe(888888);
    expect(LiveCompiler.getRngSeed()).toBe(888888);
  });

  it('implements staged double-buffering during replay so existing story is preserved until replay completes', async () => {
    let liveEvents;
    vi.spyOn(LiveCompiler, 'setEvents').mockImplementation((events) => {
      liveEvents = events;
    });

    const wrapper = mount(Simulator);

    // Initial playthrough before edit
    liveEvents.textAdded('Initial story before edit.');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.story-text').text()).toContain('Initial story before edit.');
    expect(wrapper.find('.player-content').classes()).not.toContain('is-staging');

    // User edits ink: reload begins with resetting
    liveEvents.resetting('session_1');
    await wrapper.vm.$nextTick();

    // Staging mode should be active; previous story is STILL visible, not wiped!
    expect(wrapper.find('.player-content').classes()).toContain('is-staging');
    expect(wrapper.find('.story-text').text()).toContain('Initial story before edit.');

    // During replay, incoming chunks go to staging and do NOT alter the visible DOM
    liveEvents.textAdded('Updated story chunk 1.');
    liveEvents.tagsAdded(['tag1']);
    const doneFn = vi.fn();
    liveEvents.playerPrompt(true, doneFn);
    await wrapper.vm.$nextTick();

    expect(doneFn).toHaveBeenCalled();
    // Visible DOM still shows initial story!
    expect(wrapper.find('.story-text').text()).toContain('Initial story before edit.');
    expect(wrapper.findAll('.story-divider').length).toBe(0);

    // Final turn arrives
    liveEvents.textAdded('Updated story chunk 2.');
    liveEvents.choiceAdded({ number: 1, choice: { text: 'New Choice' } }, true);
    await wrapper.vm.$nextTick();

    // Replay completes - triggers brief opacity fade-out during swap
    liveEvents.replayComplete();
    await wrapper.vm.$nextTick();

    // Verify is-swapping class is active during fade
    expect(wrapper.find('.player-content').classes()).toContain('is-swapping');

    // Wait for swap and fade-in to complete
    await new Promise((r) => setTimeout(r, 120));
    await wrapper.vm.$nextTick();

    // Now staging and swapping are deactivated and DOM has swapped atomically!
    expect(wrapper.find('.player-content').classes()).not.toContain('is-staging');
    expect(wrapper.find('.player-content').classes()).not.toContain('is-swapping');
    expect(wrapper.text()).toContain('Updated story chunk 1.');
    expect(wrapper.text()).toContain('Updated story chunk 2.');
    expect(wrapper.findAll('.story-divider').length).toBe(1);
    expect(wrapper.find('.choice-btn').text()).toContain('New Choice');
  });

  it('preserves existing story preview and cancels staging on compilation error', async () => {
    let liveEvents;
    vi.spyOn(LiveCompiler, 'setEvents').mockImplementation((events) => {
      liveEvents = events;
    });

    const wrapper = mount(Simulator);

    // Initial playthrough
    liveEvents.textAdded('Good working story.');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.story-text').text()).toContain('Good working story.');

    // Edit triggers recompile
    liveEvents.resetting('session_2');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.player-content').classes()).toContain('is-staging');

    // Compile fails due to error in ink syntax
    liveEvents.exitDueToError();
    await wrapper.vm.$nextTick();

    // Staging cancelled, old story preserved intact
    expect(wrapper.find('.player-content').classes()).not.toContain('is-staging');
    expect(wrapper.find('.story-text').text()).toContain('Good working story.');
  });

  it('clears preview immediately when restart story (rewind) is clicked', async () => {
    const wrapper = mount(Simulator);
    wrapper.vm.blocks = [{ type: 'text', text: 'Old content' }];
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.story-text').exists()).toBe(true);

    const rewindBtn = wrapper.findAll('.toolbar button')[0];
    await rewindBtn.trigger('click');

    expect(wrapper.find('.story-text').exists()).toBe(false);
    expect(wrapper.vm.blocks.length).toBe(0);
  });
});
