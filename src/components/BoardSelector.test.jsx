import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../firebase/config', () => ({ db: {} }));

const mockCollection = vi.fn(() => 'usersCollectionRef');
const mockWhere = vi.fn((field, op, val) => ({ type: 'where', field, op, val }));
const mockOrderBy = vi.fn((field) => ({ type: 'orderBy', field }));
const mockLimit = vi.fn((n) => ({ type: 'limit', n }));
const mockQuery = vi.fn((...args) => ({ type: 'query', args }));
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (...args) => mockLimit(...args),
  getDocs: (...args) => mockGetDocs(...args),
}));

// Stub heavy child components and hooks that have their own Firebase deps
vi.mock('./GroupCard.jsx', () => ({
  GroupCard: () => null,
}));

vi.mock('./Avatar.jsx', () => ({
  Avatar: () => null,
}));

vi.mock('../hooks/useBoardsList', () => ({
  useBoardsList: () => ({
    boards: [],
    loading: false,
    createBoard: vi.fn(),
    deleteBoard: vi.fn(),
    deleteGroup: vi.fn(),
    inviteMember: vi.fn(),
    moveBoard: vi.fn(),
    setBoardProtected: vi.fn(),
  }),
}));

vi.mock('../hooks/useGlobalPresence', () => ({
  useGlobalPresence: () => ({}),
}));

// jsdom does not implement ResizeObserver — provide a no-op stub
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { BoardSelector } from './BoardSelector.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides = {}) {
  return {
    onSelectBoard: vi.fn(),
    onNavigateToGroup: vi.fn(),
    onNavigateToBoard: vi.fn(),
    darkMode: false,
    setDarkMode: vi.fn(),
    user: { uid: 'current-user' },
    logout: vi.fn(),
    groups: [],
    createGroup: vi.fn(),
    deleteGroupDoc: vi.fn(),
    isAdmin: false,
    adminViewActive: false,
    migrateGroupStrings: null,
    createSubgroup: vi.fn(),
    deleteGroupCascade: vi.fn(),
    setGroupProtected: vi.fn(),
    moveGroup: vi.fn(),
    ...overrides,
  };
}

// The invite members search input lives inside the Create New Board modal,
// and only renders when visibility is 'private' (the default).
function openNewBoardModal() {
  const buttons = screen.getAllByRole('button');
  const newBoardBtn = buttons.find(b => b.textContent.includes('New Board'));
  fireEvent.click(newBoardBtn);
}

// ---------------------------------------------------------------------------
// Tests — member search Firestore query inside New Board modal
// ---------------------------------------------------------------------------

describe('BoardSelector — member search Firestore query', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCollection.mockClear();
    mockWhere.mockClear();
    mockOrderBy.mockClear();
    mockLimit.mockClear();
    mockQuery.mockClear();
    mockGetDocs.mockClear();
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('shows a member search input inside the Create New Board modal when visibility is private', () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();
    const input = screen.getByPlaceholderText('Invite members...');
    expect(input).toBeTruthy();
  });

  it('calls getDocs after the debounce when a term is typed', async () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();
    const input = screen.getByPlaceholderText('Invite members...');

    fireEvent.change(input, { target: { value: 'kate' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('includes orderBy("displayNameLower") in the Firestore query', async () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();
    const input = screen.getByPlaceholderText('Invite members...');

    fireEvent.change(input, { target: { value: 'liam' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockOrderBy).toHaveBeenCalledWith('displayNameLower');
  });

  it('includes where range constraints for prefix search', async () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();
    const input = screen.getByPlaceholderText('Invite members...');

    fireEvent.change(input, { target: { value: 'mia' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockWhere).toHaveBeenCalledWith('displayNameLower', '>=', 'mia');
    expect(mockWhere).toHaveBeenCalledWith('displayNameLower', '<=', 'mia\uf8ff');
  });

  it('lowercases the search term before querying', async () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();
    const input = screen.getByPlaceholderText('Invite members...');

    fireEvent.change(input, { target: { value: 'Noah' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockWhere).toHaveBeenCalledWith('displayNameLower', '>=', 'noah');
    expect(mockWhere).toHaveBeenCalledWith('displayNameLower', '<=', 'noah\uf8ff');
  });

  it('applies limit(8) to the query', async () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();
    const input = screen.getByPlaceholderText('Invite members...');

    fireEvent.change(input, { target: { value: 'olivia' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockLimit).toHaveBeenCalledWith(8);
  });

  it('does not fire a query for whitespace-only input', async () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();
    const input = screen.getByPlaceholderText('Invite members...');

    fireEvent.change(input, { target: { value: '   ' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('filters out the current user from search results', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'current-user', data: () => ({ displayName: 'Me', displayNameLower: 'me' }) },
        { id: 'other-uid', data: () => ({ displayName: 'Other', displayNameLower: 'other' }) },
      ],
    });

    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();
    const input = screen.getByPlaceholderText('Invite members...');

    fireEvent.change(input, { target: { value: 'o' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(screen.queryByText('Me')).toBeNull();
    expect(screen.getByText('Other')).toBeTruthy();
  });

  it('hides the member search when visibility is switched away from private', () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();

    // Default is private — search input visible
    expect(screen.getByPlaceholderText('Invite members...')).toBeTruthy();

    // Switch to Public visibility inside the modal — invite section disappears
    const allButtons = screen.getAllByRole('button');
    const publicBtn = allButtons.find(b =>
      b.textContent.includes('Public') &&
      b.closest('.modal-card')
    );
    if (publicBtn) {
      fireEvent.click(publicBtn);
      expect(screen.queryByPlaceholderText('Invite members...')).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — open visibility confirmation checkbox in Create New Board modal
// ---------------------------------------------------------------------------

describe('BoardSelector — open visibility confirmation (board)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  function getCreateBoardModal() {
    const modals = document.querySelectorAll('.modal-card--create');
    return modals[modals.length - 1]; // Return the last one (most recently opened)
  }

  it('shows confirmation checkbox when "Open" visibility is selected for board', () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();

    // Type board name to enable the button normally
    const nameInput = screen.getByPlaceholderText('My Creative Board');
    fireEvent.change(nameInput, { target: { value: 'Test Board' } });

    // Switch to Open visibility
    let allButtons = screen.getAllByRole('button');
    const openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--create')
    );
    fireEvent.click(openBtn);

    // Re-query buttons — Create button should now be disabled until checkbox is checked
    allButtons = screen.getAllByRole('button');
    const createBtn = allButtons.find(b =>
      b.textContent.includes('Create Board') &&
      b.closest('.modal-card--create')
    );

    // The button being disabled proves the checkbox requirement is active
    expect(createBtn.disabled).toBe(true);
  });

  it('hides confirmation checkbox when switching away from "Open" visibility for board', () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();

    // Type board name
    const nameInput = screen.getByPlaceholderText('My Creative Board');
    fireEvent.change(nameInput, { target: { value: 'Test Board' } });

    // Switch to Open — button becomes disabled
    let allButtons = screen.getAllByRole('button');
    let openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--create')
    );
    fireEvent.click(openBtn);

    allButtons = screen.getAllByRole('button');
    let createBtn = allButtons.find(b =>
      b.textContent.includes('Create Board') &&
      b.closest('.modal-card--create')
    );
    expect(createBtn.disabled).toBe(true);

    // Switch to Private — button should be enabled again
    allButtons = screen.getAllByRole('button');
    const privateBtn = allButtons.find(b =>
      b.textContent.includes('Private') &&
      b.closest('.modal-card--create')
    );
    fireEvent.click(privateBtn);

    allButtons = screen.getAllByRole('button');
    createBtn = allButtons.find(b =>
      b.textContent.includes('Create Board') &&
      b.closest('.modal-card--create')
    );
    expect(createBtn.disabled).toBe(false);
  });

  it('disables Create Board button when "Open" is selected but checkbox is unchecked', () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();

    // Type board name
    const nameInput = screen.getByPlaceholderText('My Creative Board');
    fireEvent.change(nameInput, { target: { value: 'Test Board' } });

    // Switch to Open
    let allButtons = screen.getAllByRole('button');
    const openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--create')
    );
    fireEvent.click(openBtn);

    // Re-query buttons after visibility change
    allButtons = screen.getAllByRole('button');
    const createBtn = allButtons.find(b =>
      b.textContent.includes('Create Board') &&
      b.closest('.modal-card--create')
    );

    // Create button should be disabled (checkbox unchecked)
    expect(createBtn.disabled).toBe(true);
  });

  it('enables Create Board button when "Open" is selected and checkbox is checked', () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();

    // Type board name
    const nameInput = screen.getByPlaceholderText('My Creative Board');
    fireEvent.change(nameInput, { target: { value: 'Test Board' } });

    // Switch to Open
    let allButtons = screen.getAllByRole('button');
    const openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--create')
    );
    fireEvent.click(openBtn);

    // Check the confirmation checkbox
    let checkboxes = screen.getAllByRole('checkbox');
    const checkbox = checkboxes.find(cb => {
      const label = cb.closest('label');
      return label && label.textContent.includes('I understand that anyone can edit this board');
    });

    if (checkbox) {
      fireEvent.change(checkbox, { target: { checked: true } });

      // Create button should now be enabled
      allButtons = screen.getAllByRole('button');
      const createBtn = allButtons.find(b =>
        b.textContent.includes('Create Board') &&
        b.closest('.modal-card--create')
      );
      expect(createBtn.disabled).toBe(false);
    }
  });

  it('resets checkbox when switching from "Open" to another visibility', () => {
    render(<BoardSelector {...defaultProps()} />);
    openNewBoardModal();

    // Type board name
    const nameInput = screen.getByPlaceholderText('My Creative Board');
    fireEvent.change(nameInput, { target: { value: 'Test Board' } });

    // Switch to Open
    let allButtons = screen.getAllByRole('button');
    let openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--create')
    );
    fireEvent.click(openBtn);

    // Check the confirmation checkbox
    let checkboxes = screen.getAllByRole('checkbox');
    let checkbox = checkboxes.find(cb => {
      const label = cb.closest('label');
      return label && label.textContent.includes('I understand that anyone can edit this board');
    });

    if (checkbox) {
      fireEvent.change(checkbox, { target: { checked: true } });
      expect(checkbox.checked).toBe(true);

      // Switch to Public visibility
      allButtons = screen.getAllByRole('button');
      const publicBtn = allButtons.find(b =>
        b.textContent.includes('Public') &&
        b.closest('.modal-card--create')
      );
      fireEvent.click(publicBtn);

      // Switch back to Open — checkbox should be unchecked (reset)
      allButtons = screen.getAllByRole('button');
      openBtn = allButtons.find(b =>
        b.textContent.includes('Open') &&
        b.closest('.modal-card--create')
      );
      fireEvent.click(openBtn);

      checkboxes = screen.getAllByRole('checkbox');
      checkbox = checkboxes.find(cb => {
        const label = cb.closest('label');
        return label && label.textContent.includes('I understand that anyone can edit this board');
      });
      expect(checkbox.checked).toBe(false);
    }
  });

  it('prevents form submission when "Open" is selected but checkbox is unchecked', () => {
    const mockCreateBoard = vi.fn(() => ({ id: 'new-board-id' }));

    render(<BoardSelector {...defaultProps({
      createBoard: mockCreateBoard,
    })} />);

    openNewBoardModal();

    // Type board name and switch to Open without checking
    const nameInput = screen.getByPlaceholderText('My Creative Board');
    fireEvent.change(nameInput, { target: { value: 'Open Board' } });

    let allButtons = screen.getAllByRole('button');
    const openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--create')
    );
    fireEvent.click(openBtn);

    // Re-query buttons after visibility change
    allButtons = screen.getAllByRole('button');
    const createBtn = allButtons.find(b =>
      b.textContent.includes('Create Board') &&
      b.closest('.modal-card--create')
    );

    // Create button should be disabled when checkbox is unchecked
    expect(createBtn.disabled).toBe(true);
  });

  it('allows form submission when "Open" is selected and checkbox is checked', async () => {
    const mockCreateBoard = vi.fn(() => ({ id: 'new-board-id' }));
    const mockOnSelectBoard = vi.fn();

    render(<BoardSelector {...defaultProps({
      createBoard: mockCreateBoard,
      onSelectBoard: mockOnSelectBoard,
    })} />);

    openNewBoardModal();

    // Type board name
    const nameInput = screen.getByPlaceholderText('My Creative Board');
    fireEvent.change(nameInput, { target: { value: 'Open Board' } });

    // Switch to Open
    let allButtons = screen.getAllByRole('button');
    const openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--create')
    );
    fireEvent.click(openBtn);

    // Check the confirmation checkbox — wait for DOM update
    await act(async () => {});
    let modal = getCreateBoardModal();
    let checkbox = modal.querySelector('input[type="checkbox"]');

    if (checkbox) {
      fireEvent.click(checkbox);
      // Wait for the state update to propagate
      await act(async () => {});

      // Get updated button state
      modal = getCreateBoardModal();
      const createBtn = modal.querySelector('button[type="submit"]');
      expect(createBtn.disabled).toBe(false);
    }
  });

  it('prevents Enter key submission when "Open" is selected but checkbox is unchecked', () => {
    const mockCreateBoard = vi.fn(() => ({ id: 'new-board-id' }));

    render(<BoardSelector {...defaultProps({
      createBoard: mockCreateBoard,
    })} />);

    openNewBoardModal();

    // Type board name
    const nameInput = screen.getByPlaceholderText('My Creative Board');
    fireEvent.change(nameInput, { target: { value: 'Open Board' } });

    // Switch to Open
    const allButtons = screen.getAllByRole('button');
    const openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--create')
    );
    fireEvent.click(openBtn);

    // Try Enter key without checking checkbox
    fireEvent.keyDown(nameInput, { key: 'Enter' });

    // createBoard should not have been called
    expect(mockCreateBoard).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — open visibility confirmation checkbox in Create New Group modal
// ---------------------------------------------------------------------------

describe('BoardSelector — open visibility confirmation (group)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  function getGroupModal() {
    const modals = document.querySelectorAll('.modal-card--group');
    return modals[modals.length - 1]; // Return the last one (most recently opened)
  }

  it('shows confirmation checkbox when "Open" visibility is selected for group', () => {
    render(<BoardSelector {...defaultProps()} />);

    // Open new group modal
    const buttons = screen.getAllByRole('button');
    const newGroupBtn = buttons.find(b => b.textContent.includes('New Group'));
    fireEvent.click(newGroupBtn);

    // Type group name
    const nameInput = screen.getByPlaceholderText('My Team');
    fireEvent.change(nameInput, { target: { value: 'Test Group' } });

    // Switch to Open visibility
    let allButtons = screen.getAllByRole('button');
    const openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--group')
    );
    fireEvent.click(openBtn);

    // Re-query buttons — Create button should now be disabled until checkbox is checked
    allButtons = screen.getAllByRole('button');
    const createBtn = allButtons.find(b =>
      b.textContent.includes('Create Group') &&
      b.closest('.modal-card--group')
    );

    // The button being disabled proves the checkbox requirement is active
    expect(createBtn.disabled).toBe(true);
  });

  it('disables Create Group button when "Open" is selected but checkbox is unchecked', () => {
    render(<BoardSelector {...defaultProps()} />);

    // Open new group modal
    let buttons = screen.getAllByRole('button');
    const newGroupBtn = buttons.find(b => b.textContent.includes('New Group'));
    fireEvent.click(newGroupBtn);

    // Type group name
    const nameInput = screen.getByPlaceholderText('My Team');
    fireEvent.change(nameInput, { target: { value: 'Test Group' } });

    // Switch to Open
    buttons = screen.getAllByRole('button');
    const openBtn = buttons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--group')
    );
    fireEvent.click(openBtn);

    // Re-query buttons after visibility change
    buttons = screen.getAllByRole('button');
    const createBtn = buttons.find(b =>
      b.textContent.includes('Create Group') &&
      b.closest('.modal-card--group')
    );

    // Create button should be disabled (checkbox unchecked)
    expect(createBtn.disabled).toBe(true);
  });

  it('enables Create Group button when "Open" is selected and checkbox is checked', async () => {
    render(<BoardSelector {...defaultProps()} />);

    // Open new group modal
    let buttons = screen.getAllByRole('button');
    const newGroupBtn = buttons.find(b => b.textContent.includes('New Group'));
    fireEvent.click(newGroupBtn);

    // Type group name
    const nameInput = screen.getByPlaceholderText('My Team');
    fireEvent.change(nameInput, { target: { value: 'Test Group' } });

    // Switch to Open
    buttons = screen.getAllByRole('button');
    const openBtn = buttons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--group')
    );
    fireEvent.click(openBtn);

    // Wait for modal to update
    await act(async () => {});
    let modal = getGroupModal();
    let checkbox = modal.querySelector('input[type="checkbox"]');

    if (checkbox) {
      fireEvent.click(checkbox);
      // Wait for the state update to propagate
      await act(async () => {});

      modal = getGroupModal();
      const createBtn = modal.querySelector('button[type="submit"]');
      expect(createBtn.disabled).toBe(false);
    }
  });

  it('resets checkbox when switching from "Open" to another visibility for group', () => {
    render(<BoardSelector {...defaultProps()} />);

    // Open new group modal
    let buttons = screen.getAllByRole('button');
    const newGroupBtn = buttons.find(b => b.textContent.includes('New Group'));
    fireEvent.click(newGroupBtn);

    // Switch to Open and check the checkbox
    buttons = screen.getAllByRole('button');
    let openBtn = buttons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--group')
    );
    fireEvent.click(openBtn);

    let modal = getGroupModal();
    let checkbox = modal.querySelector('input[type="checkbox"]');

    if (checkbox) {
      fireEvent.change(checkbox, { target: { checked: true } });
      expect(checkbox.checked).toBe(true);

      // Switch to Private
      buttons = screen.getAllByRole('button');
      const privateBtn = buttons.find(b =>
        b.textContent.includes('Private') &&
        b.closest('.modal-card--group')
      );
      fireEvent.click(privateBtn);

      // Switch back to Open — checkbox should be unchecked
      buttons = screen.getAllByRole('button');
      openBtn = buttons.find(b =>
        b.textContent.includes('Open') &&
        b.closest('.modal-card--group')
      );
      fireEvent.click(openBtn);

      modal = getGroupModal();
      checkbox = modal.querySelector('input[type="checkbox"]');
      expect(checkbox.checked).toBe(false);
    }
  });
});
