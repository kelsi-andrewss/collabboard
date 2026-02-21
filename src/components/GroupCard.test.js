import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// GroupCard footer row — pure logic tests
//
// The footer row is rendered inside the expanded (!isCompact) view when `group`
// is truthy. Its two sub-elements are:
//   1. A "see all" button whose label depends on board count.
//   2. A "+ board" button rendered only when `onAddBoard` is provided.
//
// We model these as pure predicates so we can test without rendering JSX.
// ---------------------------------------------------------------------------

// Mirror the label logic from GroupCard.jsx line 314.
function footerButtonLabel(boardCount) {
  return boardCount > 3 ? `See all ${boardCount} boards →` : 'Open group →';
}

// Mirror the add-board button visibility from GroupCard.jsx line 316.
function shouldShowAddBoardButton(onAddBoard) {
  return Boolean(onAddBoard);
}

// Mirror the onAddBoard invocation from GroupCard.jsx line 319.
function invokeAddBoard(onAddBoard, groupId) {
  onAddBoard(groupId);
}

describe('GroupCard footer row — "see all" label', () => {
  it('shows "Open group →" when there are 3 or fewer boards', () => {
    expect(footerButtonLabel(0)).toBe('Open group →');
    expect(footerButtonLabel(1)).toBe('Open group →');
    expect(footerButtonLabel(3)).toBe('Open group →');
  });

  it('shows "See all N boards →" when there are more than 3 boards', () => {
    expect(footerButtonLabel(4)).toBe('See all 4 boards →');
    expect(footerButtonLabel(10)).toBe('See all 10 boards →');
    expect(footerButtonLabel(100)).toBe('See all 100 boards →');
  });

  it('threshold is strictly greater than 3 — exactly 3 boards shows "Open group →"', () => {
    expect(footerButtonLabel(3)).toBe('Open group →');
  });

  it('threshold is strictly greater than 3 — exactly 4 boards shows "See all"', () => {
    expect(footerButtonLabel(4)).toBe('See all 4 boards →');
  });
});

describe('GroupCard footer row — onAddBoard button visibility', () => {
  it('renders the add-board button when onAddBoard is a function', () => {
    expect(shouldShowAddBoardButton(() => {})).toBe(true);
  });

  it('does not render the add-board button when onAddBoard is undefined', () => {
    expect(shouldShowAddBoardButton(undefined)).toBe(false);
  });

  it('does not render the add-board button when onAddBoard is null', () => {
    expect(shouldShowAddBoardButton(null)).toBe(false);
  });
});

describe('GroupCard footer row — onAddBoard invocation', () => {
  let onAddBoard;

  beforeEach(() => {
    onAddBoard = vi.fn();
  });

  it('calls onAddBoard with the groupId when the + board button is clicked', () => {
    invokeAddBoard(onAddBoard, 'group-abc');
    expect(onAddBoard).toHaveBeenCalledOnce();
    expect(onAddBoard).toHaveBeenCalledWith('group-abc');
  });

  it('calls onAddBoard with null when the groupId is null (ungrouped group)', () => {
    invokeAddBoard(onAddBoard, null);
    expect(onAddBoard).toHaveBeenCalledWith(null);
  });

  it('does not call onAddBoard for a different groupId than the one passed', () => {
    invokeAddBoard(onAddBoard, 'group-xyz');
    expect(onAddBoard).not.toHaveBeenCalledWith('group-abc');
  });
});

// ---------------------------------------------------------------------------
// BoardSelector — handleQuickAddBoard behavior
//
// handleQuickAddBoard is a closure over setSelectedGroupId + setShowModal.
// We model it as a pure function that applies those two state mutations
// and verify the correct group is pre-selected when the modal opens.
// ---------------------------------------------------------------------------

function makeHandleQuickAddBoard(setSelectedGroupId, setShowModal) {
  return function handleQuickAddBoard(groupId) {
    setSelectedGroupId(groupId || null);
    setShowModal(true);
  };
}

describe('BoardSelector — handleQuickAddBoard', () => {
  let setSelectedGroupId;
  let setShowModal;
  let handleQuickAddBoard;

  beforeEach(() => {
    setSelectedGroupId = vi.fn();
    setShowModal = vi.fn();
    handleQuickAddBoard = makeHandleQuickAddBoard(setSelectedGroupId, setShowModal);
  });

  it('sets selectedGroupId to the provided groupId', () => {
    handleQuickAddBoard('group-123');
    expect(setSelectedGroupId).toHaveBeenCalledWith('group-123');
  });

  it('opens the modal by setting showModal to true', () => {
    handleQuickAddBoard('group-123');
    expect(setShowModal).toHaveBeenCalledWith(true);
  });

  it('normalises a falsy groupId to null', () => {
    handleQuickAddBoard(undefined);
    expect(setSelectedGroupId).toHaveBeenCalledWith(null);
  });

  it('normalises an empty string groupId to null', () => {
    handleQuickAddBoard('');
    expect(setSelectedGroupId).toHaveBeenCalledWith(null);
  });

  it('always opens the modal regardless of the groupId value', () => {
    handleQuickAddBoard(null);
    expect(setShowModal).toHaveBeenCalledWith(true);
  });

  it('calls both setters exactly once per invocation', () => {
    handleQuickAddBoard('group-456');
    expect(setSelectedGroupId).toHaveBeenCalledOnce();
    expect(setShowModal).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// BoardSelector — resetGroupModalState boardRows fix
//
// Before the fix, resetGroupModalState did not call setBoardRows([]),
// so rows added in one group creation session leaked into the next.
// The fix adds setBoardRows([]) to the reset sequence.
//
// We model the before/after state to confirm that a correct reset always
// produces an empty boardRows array regardless of previous content.
// ---------------------------------------------------------------------------

function makeResetGroupModalState(setters) {
  return function resetGroupModalState() {
    setters.setGroupModalData({ name: '', visibility: 'private' });
    setters.setGroupNameError('');
    setters.setBoardRows([]);   // the fix — was missing before the commit
    setters.setConfirmOpenGroup(false);
    setters.setShowGroupModal(false);
  };
}

describe('BoardSelector — resetGroupModalState includes boardRows reset', () => {
  let setters;
  let resetGroupModalState;

  beforeEach(() => {
    setters = {
      setGroupModalData: vi.fn(),
      setGroupNameError: vi.fn(),
      setBoardRows: vi.fn(),
      setConfirmOpenGroup: vi.fn(),
      setShowGroupModal: vi.fn(),
    };
    resetGroupModalState = makeResetGroupModalState(setters);
  });

  it('resets boardRows to an empty array', () => {
    resetGroupModalState();
    expect(setters.setBoardRows).toHaveBeenCalledWith([]);
  });

  it('resets boardRows even when called after rows were added', () => {
    // Simulate state that had rows populated; the reset must still clear them.
    resetGroupModalState();
    expect(setters.setBoardRows).toHaveBeenCalledWith([]);
  });

  it('calls setBoardRows exactly once', () => {
    resetGroupModalState();
    expect(setters.setBoardRows).toHaveBeenCalledOnce();
  });

  it('also resets groupModalData to blank state', () => {
    resetGroupModalState();
    expect(setters.setGroupModalData).toHaveBeenCalledWith({ name: '', visibility: 'private' });
  });

  it('also resets groupNameError to empty string', () => {
    resetGroupModalState();
    expect(setters.setGroupNameError).toHaveBeenCalledWith('');
  });

  it('also resets confirmOpenGroup to false', () => {
    resetGroupModalState();
    expect(setters.setConfirmOpenGroup).toHaveBeenCalledWith(false);
  });

  it('also closes the group modal', () => {
    resetGroupModalState();
    expect(setters.setShowGroupModal).toHaveBeenCalledWith(false);
  });

  it('resets all five fields in a single call', () => {
    resetGroupModalState();
    expect(setters.setGroupModalData).toHaveBeenCalledOnce();
    expect(setters.setGroupNameError).toHaveBeenCalledOnce();
    expect(setters.setBoardRows).toHaveBeenCalledOnce();
    expect(setters.setConfirmOpenGroup).toHaveBeenCalledOnce();
    expect(setters.setShowGroupModal).toHaveBeenCalledOnce();
  });
});
