import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Module mocks — must come before component imports
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

import { BoardSettings } from './BoardSettings.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoard(overrides = {}) {
  return {
    id: 'board-1',
    ownerId: 'owner-uid',
    members: {},
    visibility: 'private',
    ...overrides,
  };
}

function defaultProps(overrides = {}) {
  return {
    board: makeBoard(),
    currentUserId: 'owner-uid',
    onUpdateSettings: vi.fn(),
    onInviteMember: vi.fn(),
    onRemoveMember: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — Firestore query construction
// ---------------------------------------------------------------------------

describe('BoardSettings — member search Firestore query', () => {
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

  it('calls getDocs after debounce when a search term is typed', async () => {
    render(<BoardSettings {...defaultProps()} />);
    const input = screen.getByPlaceholderText('Add member...');

    fireEvent.change(input, { target: { value: 'alice' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('includes orderBy("displayNameLower") in the Firestore query', async () => {
    render(<BoardSettings {...defaultProps()} />);
    const input = screen.getByPlaceholderText('Add member...');

    fireEvent.change(input, { target: { value: 'alice' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockOrderBy).toHaveBeenCalledWith('displayNameLower');
  });

  it('includes where range constraints for prefix search', async () => {
    render(<BoardSettings {...defaultProps()} />);
    const input = screen.getByPlaceholderText('Add member...');

    fireEvent.change(input, { target: { value: 'bob' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockWhere).toHaveBeenCalledWith('displayNameLower', '>=', 'bob');
    expect(mockWhere).toHaveBeenCalledWith('displayNameLower', '<=', 'bob\uf8ff');
  });

  it('lowercases the search term before querying', async () => {
    render(<BoardSettings {...defaultProps()} />);
    const input = screen.getByPlaceholderText('Add member...');

    fireEvent.change(input, { target: { value: 'Alice' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockWhere).toHaveBeenCalledWith('displayNameLower', '>=', 'alice');
    expect(mockWhere).toHaveBeenCalledWith('displayNameLower', '<=', 'alice\uf8ff');
  });

  it('applies limit(8) to the query', async () => {
    render(<BoardSettings {...defaultProps()} />);
    const input = screen.getByPlaceholderText('Add member...');

    fireEvent.change(input, { target: { value: 'carol' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockLimit).toHaveBeenCalledWith(8);
  });

  it('does not fire a query when the search term is empty or whitespace', async () => {
    render(<BoardSettings {...defaultProps()} />);
    const input = screen.getByPlaceholderText('Add member...');

    fireEvent.change(input, { target: { value: '   ' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('filters out the current user from results', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'owner-uid', data: () => ({ displayName: 'Alice', displayNameLower: 'alice' }) },
        { id: 'other-uid', data: () => ({ displayName: 'Alice B', displayNameLower: 'alice b' }) },
      ],
    });

    render(<BoardSettings {...defaultProps()} />);
    const input = screen.getByPlaceholderText('Add member...');

    fireEvent.change(input, { target: { value: 'alice' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    // owner-uid matches currentUserId — should be filtered; only Alice B visible
    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.getByText('Alice B')).toBeTruthy();
  });

  it('filters out existing board members from results', async () => {
    // currentUserId is the board owner; 'member-uid' is an existing member
    const board = makeBoard({ members: { 'member-uid': 'editor' } });
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'member-uid', data: () => ({ displayName: 'Existing Member', displayNameLower: 'existing member' }) },
        { id: 'new-uid', data: () => ({ displayName: 'New Person', displayNameLower: 'new person' }) },
      ],
    });

    render(<BoardSettings {...defaultProps({ board })} />);
    const input = screen.getByPlaceholderText('Add member...');

    fireEvent.change(input, { target: { value: 'e' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(screen.queryByText('Existing Member')).toBeNull();
    expect(screen.getByText('New Person')).toBeTruthy();
  });

  it('clears search results when input is cleared', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'some-uid', data: () => ({ displayName: 'Someone', displayNameLower: 'someone' }) },
      ],
    });

    render(<BoardSettings {...defaultProps()} />);
    const input = screen.getByPlaceholderText('Add member...');

    fireEvent.change(input, { target: { value: 'some' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(screen.getByText('Someone')).toBeTruthy();

    fireEvent.change(input, { target: { value: '' } });
    await act(async () => {});

    expect(screen.queryByText('Someone')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// BoardSettings — visibility controls
// ---------------------------------------------------------------------------

describe('BoardSettings — visibility controls', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders three visibility options when owner views the panel', () => {
    render(<BoardSettings {...defaultProps()} />);
    expect(screen.getByText(/Private/)).toBeTruthy();
    expect(screen.getByText(/Public/)).toBeTruthy();
    expect(screen.getByText(/Open/)).toBeTruthy();
  });

  it('calls onUpdateSettings with the selected visibility when Save is clicked', () => {
    const onUpdateSettings = vi.fn();
    render(<BoardSettings {...defaultProps({ onUpdateSettings })} />);

    const buttons = screen.getAllByRole('button');
    const publicBtn = buttons.find(b => b.textContent.includes('Public'));
    fireEvent.click(publicBtn);

    // onUpdateSettings should not be called yet — visibility is only buffered locally
    expect(onUpdateSettings).not.toHaveBeenCalled();

    // Find and click the Save button
    const saveBtn = buttons.find(b => b.textContent === 'Save');
    fireEvent.click(saveBtn);

    // Now onUpdateSettings should be called with the new visibility
    expect(onUpdateSettings).toHaveBeenCalledWith({ visibility: 'public' });
  });

  it('does not call onUpdateSettings when a non-manager clicks a visibility pill', () => {
    const onUpdateSettings = vi.fn();
    const board = makeBoard({ ownerId: 'someone-else' });
    render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'viewer-uid', onUpdateSettings })}
      />
    );

    // Non-manager sees a disabled view — no interactive pills rendered
    const buttons = screen.queryAllByRole('button');
    const publicBtn = buttons.find(b => b.textContent.includes('Public'));
    if (publicBtn) fireEvent.click(publicBtn);

    expect(onUpdateSettings).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// BoardSettings — member list rendering
// ---------------------------------------------------------------------------

describe('BoardSettings — member list', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows "You (owner)" when currentUserId matches ownerId', () => {
    render(<BoardSettings {...defaultProps()} />);
    expect(screen.getByText('You (owner)')).toBeTruthy();
  });

  it('shows "No additional members" when members object is empty', () => {
    render(<BoardSettings {...defaultProps()} />);
    expect(screen.getByText('No additional members')).toBeTruthy();
  });

  it('renders a remove button for each non-owner, non-self member when owner is viewing', () => {
    const board = makeBoard({
      members: { 'member-a': 'editor', 'member-b': 'viewer' },
    });
    const { container } = render(<BoardSettings {...defaultProps({ board })} />);
    const removeBtns = container.querySelectorAll('.member-remove-btn');
    expect(removeBtns.length).toBe(2);
  });

  it('calls onRemoveMember with the correct uid when remove button is clicked', () => {
    const onRemoveMember = vi.fn();
    const board = makeBoard({ members: { 'member-a': 'editor' } });
    const { container } = render(
      <BoardSettings {...defaultProps({ board, onRemoveMember })} />
    );
    const removeBtn = container.querySelector('.member-remove-btn');
    fireEvent.click(removeBtn);
    expect(onRemoveMember).toHaveBeenCalledWith('member-a');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<BoardSettings {...defaultProps({ onClose })} />);
    const closeButton = container.querySelector('.board-settings-close');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });
});
