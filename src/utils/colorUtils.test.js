import { describe, it, expect } from 'vitest';
import { darkenHex, hexToRgba, parseColorForInput, parseOpacity, getContrastColor, getUserColor } from './colorUtils';

describe('darkenHex', () => {
  it('darkens white by default 30%', () => {
    expect(darkenHex('#ffffff')).toBe('#b3b3b3');
  });

  it('darkens by a custom amount', () => {
    expect(darkenHex('#ffffff', 0.5)).toBe('#808080');
  });

  it('passes through non-hex strings unchanged', () => {
    expect(darkenHex('rgb(255,0,0)')).toBe('rgb(255,0,0)');
  });

  it('passes through null unchanged', () => {
    expect(darkenHex(null)).toBeNull();
  });

  it('keeps black as black', () => {
    expect(darkenHex('#000000')).toBe('#000000');
  });
});

describe('hexToRgba', () => {
  it('converts hex to rgba string', () => {
    expect(hexToRgba('#ff8800', 0.5)).toBe('rgba(255,136,0,0.5)');
  });

  it('handles alpha = 1', () => {
    expect(hexToRgba('#000000', 1)).toBe('rgba(0,0,0,1)');
  });
});

describe('parseColorForInput', () => {
  it('truncates 8-digit hex to 7 chars', () => {
    expect(parseColorForInput('#ff0000ff')).toBe('#ff0000');
  });

  it('returns 6-digit hex unchanged', () => {
    expect(parseColorForInput('#abcdef')).toBe('#abcdef');
  });

  it('converts rgb() to hex', () => {
    expect(parseColorForInput('rgb(255, 0, 128)')).toBe('#ff0080');
  });

  it('converts rgba() dropping alpha', () => {
    expect(parseColorForInput('rgba(0, 255, 0, 0.5)')).toBe('#00ff00');
  });

  it('returns #000000 for null', () => {
    expect(parseColorForInput(null)).toBe('#000000');
  });

  it('returns #000000 for unrecognized strings', () => {
    expect(parseColorForInput('not-a-color')).toBe('#000000');
  });
});

describe('parseOpacity', () => {
  it('extracts alpha from rgba string', () => {
    expect(parseOpacity('rgba(10, 20, 30, 0.7)')).toBe(0.7);
  });

  it('returns 1 for rgb string without alpha', () => {
    expect(parseOpacity('rgb(10, 20, 30)')).toBe(1);
  });

  it('returns 1 for hex string', () => {
    expect(parseOpacity('#ff0000')).toBe(1);
  });

  it('returns 1 for null', () => {
    expect(parseOpacity(null)).toBe(1);
  });
});

describe('getContrastColor', () => {
  it('returns black on white background', () => {
    expect(getContrastColor('#ffffff')).toBe('#000000');
  });

  it('returns white on black background', () => {
    expect(getContrastColor('#000000')).toBe('#ffffff');
  });

  it('returns black on yellow background', () => {
    expect(getContrastColor('#ffff00')).toBe('#000000');
  });

  it('returns #000000 for null', () => {
    expect(getContrastColor(null)).toBe('#000000');
  });
});

describe('getUserColor', () => {
  it('is deterministic for the same uid', () => {
    expect(getUserColor('user123')).toBe(getUserColor('user123'));
  });

  it('returns a valid hex color', () => {
    expect(getUserColor('abc')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
