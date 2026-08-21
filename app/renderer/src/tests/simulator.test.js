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

  it('handles choosing a choice correctly', async () => {
    let choiceAddedCallback;
    vi.spyOn(LiveCompiler, 'setEvents').mockImplementation((events) => {
      choiceAddedCallback = events.choiceAdded;
    });
    const chooseSpy = vi.spyOn(LiveCompiler, 'choose').mockImplementation(() => {});

    const wrapper = mount(Simulator);

    const mockChoice = {
      number: 0,
      choice: {
        text: 'Select _option_'
      }
    };

    choiceAddedCallback(mockChoice, true);
    await wrapper.vm.$nextTick();

    const choiceBtn = wrapper.find('.choice-btn');
    await choiceBtn.trigger('click');

    expect(chooseSpy).toHaveBeenCalledWith(mockChoice);
    // Choices should be cleared from view
    expect(wrapper.find('.choice-btn').exists()).toBe(false);
  });

  it('reloads and halts LiveCompiler when preview panel visibility toggles', async () => {
    const reloadSpy = vi.spyOn(LiveCompiler, 'reload').mockImplementation(() => {});
    const stopSpy = vi.spyOn(LiveCompiler, 'stop').mockImplementation(() => {});

    const wrapper = mount(Simulator);
    const { useUiStore } = await import('../stores/uiStore');
    const uiStore = useUiStore();

    uiStore.showSimulator = true;
    await wrapper.vm.$nextTick();
    expect(reloadSpy).toHaveBeenCalled();

    uiStore.showSimulator = false;
    await wrapper.vm.$nextTick();
    expect(stopSpy).toHaveBeenCalled();
  });
});
