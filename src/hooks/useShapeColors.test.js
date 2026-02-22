import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShapeColors } from './useShapeColors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubComputedStyle(overrides = {}) {
  const defaults = {
    '--md-sys-color-primary-container': '#bfdbfe',
    '--md-sys-color-secondary-container': '#fef08a',
    '--md-sys-color-tertiary-container': '#fbcfe8',
    '--md-sys-color-primary': '#6366f1',
    '--md-sys-color-on-surface': '#1a1a1a',
  };
  const values = { ...defaults, ...overrides };
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: (token) => values[token] ?? '',
  });
}

beforeEach(() => {
  localStorage.clear();
  stubComputedStyle();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useShapeColors', () => {
  describe('initial state — no saved colors', () => {
    it('initialises text color from --md-sys-color-on-surface CSS token', () => {
      stubComputedStyle({ '--md-sys-color-on-surface': '#111111' });
      const { result } = renderHook(() => useShapeColors('board-1', 'indigo', false));
      expect(result.current.shapeColors.text.active).toBe('#111111');
    });

    it('falls back to #1a1a1a when on-surface token is missing', () => {
      stubComputedStyle({ '--md-sys-color-on-surface': '' });
      const { result } = renderHook(() => useShapeColors('board-1', 'indigo', false));
      expect(result.current.shapeColors.text.active).toBe('#1a1a1a');
    });

    it('initialises sticky color from --md-sys-color-secondary-container', () => {
      stubComputedStyle({ '--md-sys-color-secondary-container': '#e0e0ff' });
      const { result } = renderHook(() => useShapeColors('board-1', 'indigo', false));
      expect(result.current.shapeColors.sticky.active).toBe('#e0e0ff');
    });

    it('initialises shapes/rectangle color from --md-sys-color-primary-container', () => {
      stubComputedStyle({ '--md-sys-color-primary-container': '#d0e8ff' });
      const { result } = renderHook(() => useShapeColors('board-1', 'indigo', false));
      expect(result.current.shapeColors.shapes.active).toBe('#d0e8ff');
      expect(result.current.shapeColors.rectangle.active).toBe('#d0e8ff');
    });

    it('initialises line color to static #3b82f6 regardless of theme tokens', () => {
      stubComputedStyle({ '--md-sys-color-primary': '#ff0000' });
      const { result } = renderHook(() => useShapeColors('board-1', 'indigo', false));
      expect(result.current.shapeColors.line.active).toBe('#3b82f6');
    });
  });

  describe('persisted colors in localStorage', () => {
    it('loads saved colors from localStorage on mount', () => {
      localStorage.setItem(
        'shapeColors_board-2',
        JSON.stringify({ text: { active: '#aabbcc' } })
      );
      const { result } = renderHook(() => useShapeColors('board-2', 'indigo', false));
      expect(result.current.shapeColors.text.active).toBe('#aabbcc');
    });

    it('falls back to theme defaults when localStorage value is invalid JSON', () => {
      localStorage.setItem('shapeColors_board-3', 'not-json{{{');
      stubComputedStyle({ '--md-sys-color-on-surface': '#222222' });
      const { result } = renderHook(() => useShapeColors('board-3', 'indigo', false));
      expect(result.current.shapeColors.text.active).toBe('#222222');
    });

    it('persists shapeColors to localStorage when they change', () => {
      const { result } = renderHook(() => useShapeColors('board-4', 'indigo', false));
      act(() => {
        result.current.setShapeColors(prev => ({
          ...prev,
          text: { active: '#deadbe' },
        }));
      });
      const stored = JSON.parse(localStorage.getItem('shapeColors_board-4'));
      expect(stored.text.active).toBe('#deadbe');
    });

    it('does not write to localStorage when boardId is falsy', () => {
      renderHook(() => useShapeColors(null, 'indigo', false));
      expect(localStorage.getItem('shapeColors_null')).toBeNull();
    });
  });

  describe('color history', () => {
    it('starts with empty color history when nothing saved', () => {
      const { result } = renderHook(() => useShapeColors('board-5', 'indigo', false));
      expect(result.current.colorHistory).toEqual([]);
    });

    it('loads saved color history from localStorage', () => {
      localStorage.setItem(
        'collaboard_colorHistory',
        JSON.stringify(['#ff0000', '#00ff00'])
      );
      const { result } = renderHook(() => useShapeColors('board-5', 'indigo', false));
      expect(result.current.colorHistory).toEqual(['#ff0000', '#00ff00']);
    });

    it('updateColorHistory prepends the new color and deduplicates', () => {
      const { result } = renderHook(() => useShapeColors('board-6', 'indigo', false));
      act(() => result.current.updateColorHistory('#aaa'));
      act(() => result.current.updateColorHistory('#bbb'));
      act(() => result.current.updateColorHistory('#aaa'));
      expect(result.current.colorHistory[0]).toBe('#aaa');
      expect(result.current.colorHistory.filter(c => c === '#aaa')).toHaveLength(1);
    });

    it('updateColorHistory caps the history at 10 entries', () => {
      const { result } = renderHook(() => useShapeColors('board-7', 'indigo', false));
      for (let i = 0; i < 15; i++) {
        act(() => result.current.updateColorHistory(`#${String(i).padStart(6, '0')}`));
      }
      expect(result.current.colorHistory).toHaveLength(10);
    });

    it('updateColorHistory persists history to localStorage', () => {
      const { result } = renderHook(() => useShapeColors('board-8', 'indigo', false));
      act(() => result.current.updateColorHistory('#123456'));
      const stored = JSON.parse(localStorage.getItem('collaboard_colorHistory'));
      expect(stored).toContain('#123456');
    });
  });

  describe('theme change propagation', () => {
    it('updates default-valued colors when theme token changes', () => {
      stubComputedStyle({ '--md-sys-color-on-surface': '#111111' });
      const { result, rerender } = renderHook(
        ({ themeColor, darkMode }) => useShapeColors('board-9', themeColor, darkMode),
        { initialProps: { themeColor: 'indigo', darkMode: false } }
      );

      // Simulate a theme switch — update the CSS token stub then rerender with new props
      stubComputedStyle({ '--md-sys-color-on-surface': '#eeeeee' });
      act(() => {
        rerender({ themeColor: 'teal', darkMode: false });
      });

      expect(result.current.shapeColors.text.active).toBe('#eeeeee');
    });

    it('does not overwrite a user-customised color when theme changes', () => {
      stubComputedStyle({ '--md-sys-color-on-surface': '#111111' });
      const { result, rerender } = renderHook(
        ({ themeColor, darkMode }) => useShapeColors('board-10', themeColor, darkMode),
        { initialProps: { themeColor: 'indigo', darkMode: false } }
      );

      // User customises the text color
      act(() => {
        result.current.setShapeColors(prev => ({
          ...prev,
          text: { active: '#custom1' },
        }));
      });

      // Theme switches — on-surface token changes
      stubComputedStyle({ '--md-sys-color-on-surface': '#eeeeee' });
      act(() => {
        rerender({ themeColor: 'teal', darkMode: false });
      });

      // Custom color must be preserved — it does not match the old default
      expect(result.current.shapeColors.text.active).toBe('#custom1');
    });
  });
});
