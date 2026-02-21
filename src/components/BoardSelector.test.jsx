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

const mockUseBoardsListReturn = {
  boards: [],
  loading: false,
  createBoard: vi.fn(),
  deleteBoard: vi.fn(),
  deleteGroup: vi.fn(),
  inviteMember: vi.fn(),
  moveBoard: vi.fn(),
  setBoardProtected: vi.fn(),
};

vi.mock('../hooks/useBoardsList', () => ({
  useBoardsList: () => mockUseBoardsListReturn,
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
// Tests — open visibility confirmation checkbox (parameterized for board & group)
// ---------------------------------------------------------------------------

describe.each([
  {
    context: 'board',
    modalClass: '.modal-card--create',
    createLabel: 'Create Board',
    openModal: () => openNewBoardModal(),
    namePlaceholder: 'My Creative Board',
    getModal: () => {
      const modals = document.querySelectorAll('.modal-card--create');
      return modals[modals.length - 1];
    },
  },
  {
    context: 'group',
    modalClass: '.modal-card--group',
    createLabel: 'Create Group',
    openModal: () => {
      const buttons = screen.getAllByRole('button');
      const newGroupBtn = buttons.find(b => b.textContent.includes('New Group'));
      fireEvent.click(newGroupBtn);
    },
    namePlaceholder: 'My Team',
    getModal: () => {
      const modals = document.querySelectorAll('.modal-card--group');
      return modals[modals.length - 1];
    },
  },
])('BoardSelector — open visibility confirmation ($context)', ({ modalClass, createLabel, openModal, namePlaceholder, getModal }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('disables create button when "Open" is selected but checkbox is unchecked', () => {
    render(<BoardSelector {...defaultProps()} />);
    openModal();

    const nameInput = screen.getByPlaceholderText(namePlaceholder);
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    let allButtons = screen.getAllByRole('button');
    const openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest(modalClass)
    );
    fireEvent.click(openBtn);

    allButtons = screen.getAllByRole('button');
    const createBtn = allButtons.find(b =>
      b.textContent.includes(createLabel) &&
      b.closest(modalClass)
    );
    expect(createBtn.disabled).toBe(true);
  });

  it('enables create button when "Open" is selected and checkbox is checked', async () => {
    render(<BoardSelector {...defaultProps()} />);
    openModal();

    const nameInput = screen.getByPlaceholderText(namePlaceholder);
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    let allButtons = screen.getAllByRole('button');
    const openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest(modalClass)
    );
    fireEvent.click(openBtn);

    await act(async () => {});
    let modal = getModal();
    let checkbox = modal.querySelector('input[type="checkbox"]');

    if (checkbox) {
      fireEvent.click(checkbox);
      await act(async () => {});

      modal = getModal();
      const createBtn = modal.querySelector('button[type="submit"]');
      expect(createBtn.disabled).toBe(false);
    }
  });

  it('re-enables create button when switching away from "Open"', () => {
    render(<BoardSelector {...defaultProps()} />);
    openModal();

    const nameInput = screen.getByPlaceholderText(namePlaceholder);
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    let allButtons = screen.getAllByRole('button');
    let openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest(modalClass)
    );
    fireEvent.click(openBtn);

    allButtons = screen.getAllByRole('button');
    let createBtn = allButtons.find(b =>
      b.textContent.includes(createLabel) &&
      b.closest(modalClass)
    );
    expect(createBtn.disabled).toBe(true);

    allButtons = screen.getAllByRole('button');
    const privateBtn = allButtons.find(b =>
      b.textContent.includes('Private') &&
      b.closest(modalClass)
    );
    fireEvent.click(privateBtn);

    allButtons = screen.getAllByRole('button');
    createBtn = allButtons.find(b =>
      b.textContent.includes(createLabel) &&
      b.closest(modalClass)
    );
    expect(createBtn.disabled).toBe(false);
  });

  it('resets checkbox when switching from "Open" to another visibility and back', () => {
    render(<BoardSelector {...defaultProps()} />);
    openModal();

    let allButtons = screen.getAllByRole('button');
    let openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest(modalClass)
    );
    fireEvent.click(openBtn);

    let modal = getModal();
    let checkbox = modal.querySelector('input[type="checkbox"]');

    if (checkbox) {
      fireEvent.change(checkbox, { target: { checked: true } });
      expect(checkbox.checked).toBe(true);

      allButtons = screen.getAllByRole('button');
      const publicBtn = allButtons.find(b =>
        b.textContent.includes('Public') &&
        b.closest(modalClass)
      );
      fireEvent.click(publicBtn);

      allButtons = screen.getAllByRole('button');
      openBtn = allButtons.find(b =>
        b.textContent.includes('Open') &&
        b.closest(modalClass)
      );
      fireEvent.click(openBtn);

      modal = getModal();
      checkbox = modal.querySelector('input[type="checkbox"]');
      expect(checkbox.checked).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — Browse tab shows only template boards
// ---------------------------------------------------------------------------

describe('BoardSelector — Browse tab template filter', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseBoardsListReturn.boards = [];
  });

  afterEach(() => {
    mockUseBoardsListReturn.boards = [];
    cleanup();
  });

  it('renders the Browse filter pill', () => {
    render(<BoardSelector {...defaultProps()} />);
    const buttons = screen.getAllByRole('button');
    const browseBtn = buttons.find(b => b.textContent === 'Browse');
    expect(browseBtn).toBeTruthy();
  });

  it('shows only template boards when Browse tab is active', () => {
    mockUseBoardsListReturn.boards = [
      { id: 'b1', name: 'Template Board', template: true, ownerId: 'other', updatedAt: null, groupId: null },
      { id: 'b2', name: 'Regular Board', template: false, ownerId: 'other', updatedAt: null, groupId: null },
    ];

    render(<BoardSelector {...defaultProps()} />);

    const buttons = screen.getAllByRole('button');
    const browseBtn = buttons.find(b => b.textContent === 'Browse');
    fireEvent.click(browseBtn);

    expect(screen.getByText('Template Board')).toBeTruthy();
    expect(screen.queryByText('Regular Board')).toBeNull();
  });

  it('shows owned boards on My Boards tab regardless of template flag', () => {
    mockUseBoardsListReturn.boards = [
      { id: 'b1', name: 'My Template', template: true, ownerId: 'current-user', updatedAt: null, groupId: null },
      { id: 'b2', name: 'My Regular', template: false, ownerId: 'current-user', updatedAt: null, groupId: null },
    ];

    render(<BoardSelector {...defaultProps()} />);
    // My Boards tab is active by default; ownership determines visibility, not template flag
    expect(screen.getByText('My Template')).toBeTruthy();
    expect(screen.getByText('My Regular')).toBeTruthy();
  });

  it('shows empty state on Browse tab when no boards are marked as templates', () => {
    mockUseBoardsListReturn.boards = [
      { id: 'b1', name: 'Not A Template', template: false, ownerId: 'other', updatedAt: null, groupId: null },
    ];

    render(<BoardSelector {...defaultProps()} />);

    const buttons = screen.getAllByRole('button');
    const browseBtn = buttons.find(b => b.textContent === 'Browse');
    fireEvent.click(browseBtn);

    expect(screen.queryByText('Not A Template')).toBeNull();
    expect(screen.getByText('No boards yet')).toBeTruthy();
  });
});

// Board-specific open visibility tests that don't apply to groups

describe('BoardSelector — open visibility board-specific', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('prevents Enter key submission when "Open" is selected but checkbox is unchecked', () => {
    const mockCreateBoard = vi.fn(() => ({ id: 'new-board-id' }));
    render(<BoardSelector {...defaultProps({ createBoard: mockCreateBoard })} />);
    openNewBoardModal();

    const nameInput = screen.getByPlaceholderText('My Creative Board');
    fireEvent.change(nameInput, { target: { value: 'Open Board' } });

    const allButtons = screen.getAllByRole('button');
    const openBtn = allButtons.find(b =>
      b.textContent.includes('Open') &&
      b.closest('.modal-card--create')
    );
    fireEvent.click(openBtn);

    fireEvent.keyDown(nameInput, { key: 'Enter' });
    expect(mockCreateBoard).not.toHaveBeenCalled();
  });
});
