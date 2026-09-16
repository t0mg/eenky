import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Modals from '../components/Modals.vue';
import Sidebar from '../components/Sidebar.vue';
import { useUiStore } from '../stores/uiStore';
import { useProjectStore } from '../stores/projectStore';

describe('Checkpoints Modal and Sidebar Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    if (!window.matchMedia) {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    }
  });

  it('renders "XX checkpoints reached" as plain text in Sidebar when only unnamed checkpoints are found', () => {
    const projectStore = useProjectStore();
    projectStore.setAutoPlayerEnabled(true);
    projectStore.setAutoPlayerStats({
      runsCompleted: 50,
      checkpointsDiscoveredCount: 3,
      namedCheckpointsCount: 0,
      unnamedCheckpointsCount: 3,
      checkpointsDetails: []
    });

    const wrapper = mount(Sidebar);
    expect(wrapper.text()).toContain('No issues found across 50 runs');
    expect(wrapper.text()).toContain('3 checkpoints reached');
    expect(wrapper.find('.auto-player-checkpoint-item').exists()).toBe(false);
  });

  it('renders "XX checkpoints found, click for details" in Sidebar when named chapters exist', async () => {
    const uiStore = useUiStore();
    const projectStore = useProjectStore();
    projectStore.setAutoPlayerEnabled(true);
    projectStore.setAutoPlayerStats({
      runsCompleted: 100,
      checkpointsDiscoveredCount: 4,
      namedCheckpointsCount: 4,
      unnamedCheckpointsCount: 0,
      checkpointsDetails: [
        { name: 'Chapter 1', count: 90, percentage: 90 },
        { name: 'Chapter 2', count: 70, percentage: 70 },
        { name: 'Chapter 3', count: 40, percentage: 40 },
        { name: 'Chapter 4', count: 10, percentage: 10 },
      ]
    });

    const openModalSpy = vi.spyOn(uiStore, 'openModal');

    const wrapper = mount(Sidebar);
    expect(wrapper.text()).toContain('4 checkpoints found');
    expect(wrapper.text()).toContain('Click for details');
    const item = wrapper.find('.auto-player-checkpoint-item');
    expect(item.exists()).toBe(true);
    expect(item.find('.issue-file').text()).toBe('4 checkpoints found');
    expect(item.find('.issue-type-tag.checkpoints').text()).toBe('Checkpoints');
    expect(item.find('.issue-message').text()).toBe('Click for details');
    expect(item.find('.material-symbols-outlined').text()).toBe('insert_chart');

    await item.trigger('click');
    expect(openModalSpy).toHaveBeenCalledWith('checkpoints');
  });

  it('renders checkpoints modal with horizontal bar chart and reactive updates', async () => {
    const uiStore = useUiStore();
    const projectStore = useProjectStore();

    projectStore.setAutoPlayerStats({
      runsCompleted: 200,
      checkpointsDiscoveredCount: 2,
      namedCheckpointsCount: 2,
      unnamedCheckpointsCount: 0,
      checkpointsDetails: [
        { name: 'The Forest', count: 180, percentage: 90, isUnnamed: false },
        { name: 'The Cave', count: 50, percentage: 25, isUnnamed: false }
      ]
    });

    uiStore.openModal('checkpoints');

    const wrapper = mount(Modals);

    expect(wrapper.find('.checkpoints-modal').exists()).toBe(true);
    expect(wrapper.text()).toContain('Checkpoints & Chapters');
    expect(wrapper.text()).toContain('200 runs');
    expect(wrapper.text()).toContain('The Forest');
    expect(wrapper.text()).toContain('90%');
    expect(wrapper.text()).toContain('180 runs');
    expect(wrapper.text()).toContain('The Cave');
    expect(wrapper.text()).toContain('25%');
    expect(wrapper.text()).toContain('50 runs');

    const bars = wrapper.findAll('.checkpoint-bar-fill');
    expect(bars.length).toBe(2);
    expect(bars[0].attributes('style')).toContain('width: 90%');
    expect(bars[1].attributes('style')).toContain('width: 25%');

    // Simulate reactive update while fuzzer is running
    projectStore.setAutoPlayerStatus('running');
    projectStore.setAutoPlayerStats({
      runsCompleted: 300,
      checkpointsDiscoveredCount: 3,
      namedCheckpointsCount: 3,
      unnamedCheckpointsCount: 0,
      checkpointsDetails: [
        { name: 'The Forest', count: 270, percentage: 90, isUnnamed: false },
        { name: 'The Cave', count: 120, percentage: 40, isUnnamed: false },
        { name: 'The Castle', count: 30, percentage: 10, isUnnamed: false }
      ]
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('300 runs');
    expect(wrapper.find('.status-badge.running').exists()).toBe(true);
    expect(wrapper.find('.status-badge.running').text()).toBe('Running');
    expect(wrapper.text()).toContain('The Castle');
    expect(wrapper.text()).toContain('10%');
    expect(wrapper.text()).toContain('30 runs');

    const updatedBars = wrapper.findAll('.checkpoint-bar-fill');
    expect(updatedBars.length).toBe(3);
    expect(updatedBars[2].attributes('style')).toContain('width: 10%');

    const closeBtn = wrapper.find('.primary-btn');
    await closeBtn.trigger('click');
    expect(uiStore.modalState.isOpen).toBe(false);
  });
});
