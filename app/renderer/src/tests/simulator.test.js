import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Simulator from '../components/Simulator.vue';
import { LiveCompiler } from '../core/liveCompiler.js';

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
});
