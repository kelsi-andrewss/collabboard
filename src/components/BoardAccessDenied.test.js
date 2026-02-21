import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the board access-denied screen logic in App.jsx.
 *
 * The access-denied screen renders when:
 *   user && boardId && !board.loading && !currentBoard
 *
 * The board UI renders when:
 *   user && boardId && (board.loading || currentBoard)
 */

function shouldShowAccessDenied({ user, boardId, boardLoading, currentBoard }) {
  return Boolean(user && boardId && !boardLoading && !currentBoard);
}

function shouldShowBoardUI({ user, boardId, boardLoading, currentBoard }) {
  return Boolean(user && boardId && (boardLoading || currentBoard));
}

describe('board access-denied screen visibility logic', () => {
  const user = { uid: 'user-1' };

  it('shows access-denied when board not found after load', () => {
    expect(shouldShowAccessDenied({ user, boardId: 'board-1', boardLoading: false, currentBoard: null })).toBe(true);
  });

  it('hides access-denied while board is still loading', () => {
    expect(shouldShowAccessDenied({ user, boardId: 'board-1', boardLoading: true, currentBoard: null })).toBe(false);
  });

  it('hides access-denied when board is found', () => {
    expect(shouldShowAccessDenied({ user, boardId: 'board-1', boardLoading: false, currentBoard: { id: 'board-1' } })).toBe(false);
  });

  it('hides access-denied when no boardId', () => {
    expect(shouldShowAccessDenied({ user, boardId: null, boardLoading: false, currentBoard: null })).toBe(false);
  });

  it('hides access-denied when no user', () => {
    expect(shouldShowAccessDenied({ user: null, boardId: 'board-1', boardLoading: false, currentBoard: null })).toBe(false);
  });

  it('shows board UI when still loading even with no currentBoard', () => {
    expect(shouldShowBoardUI({ user, boardId: 'board-1', boardLoading: true, currentBoard: null })).toBe(true);
  });

  it('shows board UI when board is found and not loading', () => {
    expect(shouldShowBoardUI({ user, boardId: 'board-1', boardLoading: false, currentBoard: { id: 'board-1' } })).toBe(true);
  });

  it('hides board UI when load complete and board not found', () => {
    expect(shouldShowBoardUI({ user, boardId: 'board-1', boardLoading: false, currentBoard: null })).toBe(false);
  });

  it('hides board UI when no user', () => {
    expect(shouldShowBoardUI({ user: null, boardId: 'board-1', boardLoading: false, currentBoard: { id: 'board-1' } })).toBe(false);
  });

  it('hides board UI when no boardId', () => {
    expect(shouldShowBoardUI({ user, boardId: null, boardLoading: false, currentBoard: null })).toBe(false);
  });

  it('access-denied and board UI are mutually exclusive when board found', () => {
    const params = { user, boardId: 'board-1', boardLoading: false, currentBoard: { id: 'board-1' } };
    expect(shouldShowAccessDenied(params)).toBe(false);
    expect(shouldShowBoardUI(params)).toBe(true);
  });

  it('access-denied and board UI are mutually exclusive when board not found after load', () => {
    const params = { user, boardId: 'board-1', boardLoading: false, currentBoard: null };
    expect(shouldShowAccessDenied(params)).toBe(true);
    expect(shouldShowBoardUI(params)).toBe(false);
  });
});
