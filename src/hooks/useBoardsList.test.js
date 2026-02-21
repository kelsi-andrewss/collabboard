import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// useBoardsList — saveThumbnail dual-theme behavior
//
// saveThumbnail now accepts (boardId, lightUrl, darkUrl) and writes three
// fields: thumbnailLight, thumbnailDark, and the legacy thumbnail field.
// We model the Firestore write payload as a pure function to verify the
// correct fields are written.
// ---------------------------------------------------------------------------

function buildThumbnailPayload(lightUrl, darkUrl, serverTimestamp) {
  return {
    thumbnailLight: lightUrl,
    thumbnailDark: darkUrl,
    thumbnail: lightUrl,
    updatedAt: serverTimestamp,
  };
}

describe('useBoardsList — saveThumbnail payload', () => {
  const SENTINEL_TIMESTAMP = Symbol('serverTimestamp');

  it('includes thumbnailLight set to the light url', () => {
    const payload = buildThumbnailPayload('data:light', 'data:dark', SENTINEL_TIMESTAMP);
    expect(payload.thumbnailLight).toBe('data:light');
  });

  it('includes thumbnailDark set to the dark url', () => {
    const payload = buildThumbnailPayload('data:light', 'data:dark', SENTINEL_TIMESTAMP);
    expect(payload.thumbnailDark).toBe('data:dark');
  });

  it('sets the legacy thumbnail field to the light url for backward compatibility', () => {
    const payload = buildThumbnailPayload('data:light', 'data:dark', SENTINEL_TIMESTAMP);
    expect(payload.thumbnail).toBe('data:light');
  });

  it('includes updatedAt in the payload', () => {
    const payload = buildThumbnailPayload('data:light', 'data:dark', SENTINEL_TIMESTAMP);
    expect(payload.updatedAt).toBe(SENTINEL_TIMESTAMP);
  });

  it('writes exactly four fields', () => {
    const payload = buildThumbnailPayload('data:light', 'data:dark', SENTINEL_TIMESTAMP);
    expect(Object.keys(payload)).toHaveLength(4);
  });

  it('light and dark urls can differ', () => {
    const payload = buildThumbnailPayload('url-light', 'url-dark', SENTINEL_TIMESTAMP);
    expect(payload.thumbnailLight).not.toBe(payload.thumbnailDark);
  });
});

// ---------------------------------------------------------------------------
// Thumbnail selection logic — theme-matched variant with fallback
//
// The display components select a thumbnail using:
//   darkMode ? (thumbnailDark || thumbnailLight || thumbnail)
//            : (thumbnailLight || thumbnailDark || thumbnail)
//
// This models the exact selection logic extracted from GroupCard, GroupPage,
// and BoardSelector so it can be exercised without rendering.
// ---------------------------------------------------------------------------

function selectThumbnail(board, darkMode) {
  return darkMode
    ? (board.thumbnailDark || board.thumbnailLight || board.thumbnail)
    : (board.thumbnailLight || board.thumbnailDark || board.thumbnail);
}

describe('thumbnail selection — light mode', () => {
  it('returns thumbnailLight when both themed variants are set', () => {
    const board = { thumbnailLight: 'light-url', thumbnailDark: 'dark-url', thumbnail: 'legacy' };
    expect(selectThumbnail(board, false)).toBe('light-url');
  });

  it('falls back to thumbnailDark when thumbnailLight is missing', () => {
    const board = { thumbnailLight: null, thumbnailDark: 'dark-url', thumbnail: 'legacy' };
    expect(selectThumbnail(board, false)).toBe('dark-url');
  });

  it('falls back to legacy thumbnail when both themed variants are missing', () => {
    const board = { thumbnailLight: null, thumbnailDark: null, thumbnail: 'legacy' };
    expect(selectThumbnail(board, false)).toBe('legacy');
  });

  it('returns undefined when all thumbnail fields are null', () => {
    const board = { thumbnailLight: null, thumbnailDark: null, thumbnail: null };
    expect(selectThumbnail(board, false)).toBeFalsy();
  });

  it('returns thumbnailLight when legacy thumbnail field is absent', () => {
    const board = { thumbnailLight: 'light-url', thumbnailDark: 'dark-url' };
    expect(selectThumbnail(board, false)).toBe('light-url');
  });
});

describe('thumbnail selection — dark mode', () => {
  it('returns thumbnailDark when both themed variants are set', () => {
    const board = { thumbnailLight: 'light-url', thumbnailDark: 'dark-url', thumbnail: 'legacy' };
    expect(selectThumbnail(board, true)).toBe('dark-url');
  });

  it('falls back to thumbnailLight when thumbnailDark is missing', () => {
    const board = { thumbnailLight: 'light-url', thumbnailDark: null, thumbnail: 'legacy' };
    expect(selectThumbnail(board, true)).toBe('light-url');
  });

  it('falls back to legacy thumbnail when both themed variants are missing', () => {
    const board = { thumbnailLight: null, thumbnailDark: null, thumbnail: 'legacy' };
    expect(selectThumbnail(board, true)).toBe('legacy');
  });

  it('returns undefined when all thumbnail fields are null', () => {
    const board = { thumbnailLight: null, thumbnailDark: null, thumbnail: null };
    expect(selectThumbnail(board, true)).toBeFalsy();
  });

  it('returns thumbnailDark when legacy thumbnail field is absent', () => {
    const board = { thumbnailLight: 'light-url', thumbnailDark: 'dark-url' };
    expect(selectThumbnail(board, true)).toBe('dark-url');
  });
});

describe('thumbnail selection — legacy boards without themed variants', () => {
  it('returns the legacy thumbnail in light mode', () => {
    const board = { thumbnail: 'old-thumb' };
    expect(selectThumbnail(board, false)).toBe('old-thumb');
  });

  it('returns the legacy thumbnail in dark mode', () => {
    const board = { thumbnail: 'old-thumb' };
    expect(selectThumbnail(board, true)).toBe('old-thumb');
  });

  it('returns undefined for a brand-new board with no thumbnails in either mode', () => {
    const board = { thumbnail: null };
    expect(selectThumbnail(board, false)).toBeFalsy();
    expect(selectThumbnail(board, true)).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// captureThumbnail — dual capture sequence
//
// The capture function sets the bg-rect fill to #ffffff for the light capture,
// then to #111827 for the dark capture, and always restores the original fill.
// We model this state-machine logic as pure functions.
// ---------------------------------------------------------------------------

function simulateCapture(bgRect, stage, saveThumbnail, boardId) {
  const originalFill = bgRect ? bgRect.fill() : null;
  try {
    const captureOpts = { pixelRatio: 1, mimeType: 'image/jpeg', quality: 0.7 };
    if (bgRect) bgRect.fill('#ffffff');
    const lightUrl = stage.toDataURL(captureOpts);
    if (bgRect) bgRect.fill('#111827');
    const darkUrl = stage.toDataURL(captureOpts);
    saveThumbnail(boardId, lightUrl, darkUrl);
  } finally {
    if (bgRect) bgRect.fill(originalFill);
  }
}

describe('captureThumbnail — dual capture sequence', () => {
  let fillHistory;
  let bgRect;
  let stage;
  let saveThumbnail;

  beforeEach(() => {
    fillHistory = [];
    let currentFill = '#111827';
    bgRect = {
      fill: vi.fn((v) => {
        if (v !== undefined) {
          fillHistory.push(v);
          currentFill = v;
        }
        return currentFill;
      }),
    };
    let captureCount = 0;
    stage = {
      toDataURL: vi.fn(() => {
        captureCount++;
        return captureCount === 1 ? 'data:light' : 'data:dark';
      }),
    };
    saveThumbnail = vi.fn();
  });

  it('sets fill to #ffffff before the light capture', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(fillHistory[0]).toBe('#ffffff');
  });

  it('sets fill to #111827 before the dark capture', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(fillHistory[1]).toBe('#111827');
  });

  it('restores the original fill after both captures', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(fillHistory[2]).toBe('#111827');
  });

  it('calls toDataURL exactly twice', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(stage.toDataURL).toHaveBeenCalledTimes(2);
  });

  it('calls saveThumbnail with the light url as the second arg', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(saveThumbnail).toHaveBeenCalledWith('board-1', 'data:light', 'data:dark');
  });

  it('calls saveThumbnail with the dark url as the third arg', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    const [, , darkArg] = saveThumbnail.mock.calls[0];
    expect(darkArg).toBe('data:dark');
  });

  it('calls saveThumbnail exactly once', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(saveThumbnail).toHaveBeenCalledOnce();
  });

  it('restores the fill even when toDataURL throws', () => {
    stage.toDataURL = vi.fn(() => { throw new Error('canvas error'); });
    try { simulateCapture(bgRect, stage, saveThumbnail, 'board-1'); } catch { /* ignore */ }
    expect(fillHistory[fillHistory.length - 1]).toBe('#111827');
  });
});
