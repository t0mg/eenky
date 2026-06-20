import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with default values', () => {
    const store = useUiStore();
    expect(store.activeView).toBe('home');
    expect(store.theme).toBe('light');
    expect(store.animationEnabled).toBe(true);
    expect(store.modalState.isOpen).toBe(false);
  });

  it('changes active view', () => {
    const store = useUiStore();
    store.setActiveView('editor');
    expect(store.activeView).toBe('editor');
  });

  it('changes theme', () => {
    const store = useUiStore();
    store.setTheme('dark');
    expect(store.theme).toBe('dark');
    expect(document.body.className).toBe('dark');
  });

  it('toggles animations', () => {
    const store = useUiStore();
    store.setAnimationEnabled(false);
    expect(store.animationEnabled).toBe(false);
    expect(document.body.classList.contains('no-animations')).toBe(true);
  });

  it('opens and closes modal', () => {
    const store = useUiStore();
    store.openModal('about', { some: 'data' });
    expect(store.modalState.isOpen).toBe(true);
    expect(store.modalState.type).toBe('about');
    expect(store.modalState.data).toEqual({ some: 'data' });

    store.closeModal();
    expect(store.modalState.isOpen).toBe(false);
    expect(store.modalState.type).toBe('');
    expect(store.modalState.data).toBe(null);
  });
});
