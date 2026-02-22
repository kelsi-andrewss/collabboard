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
const mockGetDoc = vi.fn(() => Promise.resolve({ exists: () => false, data: () => null }));
const mockDoc = vi.fn((db, ...path) => ({ __type: 'doc', path: path.join('/') }));

vi.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (...args) => mockLimit(...args),
  getDocs: (...args) => mockGetDocs(...args),
  getDoc: (...args) => mockGetDoc(...args),
  doc: (...args) => mockDoc(...args),
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
    publishTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    unpublishTemplate: vi.fn(),
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
    mockGetDoc.mockClear();
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });
    mockDoc.mockClear();
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

// ---------------------------------------------------------------------------
// BoardSettings — editor role canManage access (story-034)
// ---------------------------------------------------------------------------

describe('BoardSettings — editor role gets canManage access', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders interactive visibility pills for a member with editor role', () => {
    const board = makeBoard({
      ownerId: 'owner-uid',
      members: { 'editor-uid': 'editor' },
    });
    render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'editor-uid' })}
      />
    );
    const buttons = screen.getAllByRole('button');
    const publicBtn = buttons.find(b => b.textContent.includes('Public'));
    expect(publicBtn).toBeTruthy();
  });

  it('calls onUpdateSettings when an editor saves a visibility change', () => {
    const onUpdateSettings = vi.fn();
    const board = makeBoard({
      ownerId: 'owner-uid',
      members: { 'editor-uid': 'editor' },
      visibility: 'private',
    });
    render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'editor-uid', onUpdateSettings })}
      />
    );

    const buttons = screen.getAllByRole('button');
    const publicBtn = buttons.find(b => b.textContent.includes('Public'));
    fireEvent.click(publicBtn);

    const saveBtn = buttons.find(b => b.textContent === 'Save');
    fireEvent.click(saveBtn);

    expect(onUpdateSettings).toHaveBeenCalledWith({ visibility: 'public' });
  });

  it('does not render a member search input for a member with editor role', () => {
    const board = makeBoard({
      ownerId: 'owner-uid',
      members: { 'editor-uid': 'editor' },
    });
    render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'editor-uid' })}
      />
    );
    expect(screen.queryByPlaceholderText('Add member...')).toBeNull();
  });

  it('does not render interactive visibility pills for a member with viewer role', () => {
    const board = makeBoard({
      ownerId: 'owner-uid',
      members: { 'viewer-uid': 'viewer' },
    });
    render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'viewer-uid' })}
      />
    );
    const buttons = screen.queryAllByRole('button');
    const publicBtn = buttons.find(b => b.textContent.includes('Public'));
    expect(publicBtn).toBeUndefined();
  });

  it('does not render a member search input for a member with viewer role', () => {
    const board = makeBoard({
      ownerId: 'owner-uid',
      members: { 'viewer-uid': 'viewer' },
    });
    render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'viewer-uid' })}
      />
    );
    expect(screen.queryByPlaceholderText('Add member...')).toBeNull();
  });

  it('does not render remove buttons for other members when the current user is an editor', () => {
    const board = makeBoard({
      ownerId: 'owner-uid',
      members: { 'editor-uid': 'editor', 'other-uid': 'viewer' },
    });
    const { container } = render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'editor-uid' })}
      />
    );
    const removeBtns = container.querySelectorAll('.member-remove-btn');
    expect(removeBtns.length).toBe(0);
  });

  it('does not call onRemoveMember when the current user is an editor (no remove button rendered)', () => {
    const onRemoveMember = vi.fn();
    const board = makeBoard({
      ownerId: 'owner-uid',
      members: { 'editor-uid': 'editor', 'other-uid': 'viewer' },
    });
    const { container } = render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'editor-uid', onRemoveMember })}
      />
    );
    const removeBtn = container.querySelector('.member-remove-btn');
    expect(removeBtn).toBeNull();
    expect(onRemoveMember).not.toHaveBeenCalled();
  });

  it('renders "Convert to Template" button for a member with editor role when template is false', () => {
    const board = makeBoard({
      ownerId: 'owner-uid',
      members: { 'editor-uid': 'editor' },
      template: false,
    });
    render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'editor-uid' })}
      />
    );
    expect(screen.getByText('Convert to Template')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// BoardSettings — template toggle
// ---------------------------------------------------------------------------

describe('BoardSettings — template toggle', () => {
  beforeEach(() => {
    localStorage.removeItem('templateUpdateWarningDismissed');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the Template section heading', () => {
    render(<BoardSettings {...defaultProps()} />);
    expect(screen.getByText('Template')).toBeTruthy();
  });

  it('renders "Convert to Template" button when board.template is false', () => {
    const board = makeBoard({ template: false });
    render(<BoardSettings {...defaultProps({ board })} />);
    expect(screen.getByText('Convert to Template')).toBeTruthy();
  });

  it('renders "Convert to Template" button when template field is missing', () => {
    const board = makeBoard();
    render(<BoardSettings {...defaultProps({ board })} />);
    expect(screen.getByText('Convert to Template')).toBeTruthy();
  });

  it('renders "Update Template" and "Remove from Browse" when board.template is true', () => {
    const board = makeBoard({ template: true });
    render(<BoardSettings {...defaultProps({ board })} />);
    expect(screen.getByText('Update Template')).toBeTruthy();
    expect(screen.getByText('Remove from Browse')).toBeTruthy();
  });

  it('calls publishTemplate with boardId when "Convert to Template" is clicked', () => {
    const publishTemplate = vi.fn();
    const board = makeBoard({ template: false });
    render(<BoardSettings {...defaultProps({ board, publishTemplate })} />);
    fireEvent.click(screen.getByText('Convert to Template'));
    expect(publishTemplate).toHaveBeenCalledWith('board-1');
  });

  it('calls unpublishTemplate with boardId when "Remove from Browse" is clicked', () => {
    const unpublishTemplate = vi.fn();
    const board = makeBoard({ template: true });
    render(<BoardSettings {...defaultProps({ board, unpublishTemplate })} />);
    fireEvent.click(screen.getByText('Remove from Browse'));
    expect(unpublishTemplate).toHaveBeenCalledWith('board-1');
  });

  it('shows confirmation dialog when "Update Template" is clicked (default behavior)', () => {
    const board = makeBoard({ template: true });
    render(<BoardSettings {...defaultProps({ board })} />);
    fireEvent.click(screen.getByText('Update Template'));
    expect(screen.getByText('Update template?')).toBeTruthy();
  });

  it('does not render interactive template controls for non-managers; shows read-only text', () => {
    const board = makeBoard({ ownerId: 'someone-else', template: false });
    render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'viewer-uid' })}
      />
    );
    expect(screen.queryByText('Convert to Template')).toBeNull();
    expect(screen.getByText('This board is not a template.')).toBeTruthy();
  });

  it('shows "This board is a template." for non-managers when board.template is true', () => {
    const board = makeBoard({ ownerId: 'someone-else', template: true });
    render(
      <BoardSettings
        {...defaultProps({ board, currentUserId: 'viewer-uid' })}
      />
    );
    expect(screen.queryByText('Update Template')).toBeNull();
    expect(screen.getByText('This board is a template.')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// BoardSettings — Developer section (Performance overlay toggle)
// ---------------------------------------------------------------------------

describe('BoardSettings — Developer section', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not render the Developer section when preferences prop is absent', () => {
    render(<BoardSettings {...defaultProps()} />);
    expect(screen.queryByText('Developer')).toBeNull();
    expect(screen.queryByText('Performance overlay')).toBeNull();
  });

  it('renders the Developer section when preferences and onUpdatePreference are provided', () => {
    const preferences = { showPerfOverlay: false };
    const onUpdatePreference = vi.fn();
    render(
      <BoardSettings
        {...defaultProps({ preferences, onUpdatePreference })}
      />
    );
    expect(screen.getByText('Developer')).toBeTruthy();
    expect(screen.getByText('Performance overlay')).toBeTruthy();
  });

  it('renders the toggle switch with aria-checked=false when showPerfOverlay is false', () => {
    const preferences = { showPerfOverlay: false };
    const onUpdatePreference = vi.fn();
    render(
      <BoardSettings
        {...defaultProps({ preferences, onUpdatePreference })}
      />
    );
    const toggle = screen.getByRole('switch', { name: 'Performance overlay' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('renders the toggle switch with aria-checked=true when showPerfOverlay is true', () => {
    const preferences = { showPerfOverlay: true };
    const onUpdatePreference = vi.fn();
    render(
      <BoardSettings
        {...defaultProps({ preferences, onUpdatePreference })}
      />
    );
    const toggle = screen.getByRole('switch', { name: 'Performance overlay' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('calls onUpdatePreference with ("showPerfOverlay", true) when toggle is clicked while off', () => {
    const preferences = { showPerfOverlay: false };
    const onUpdatePreference = vi.fn();
    render(
      <BoardSettings
        {...defaultProps({ preferences, onUpdatePreference })}
      />
    );
    const toggle = screen.getByRole('switch', { name: 'Performance overlay' });
    fireEvent.click(toggle);
    expect(onUpdatePreference).toHaveBeenCalledWith('showPerfOverlay', true);
  });

  it('calls onUpdatePreference with ("showPerfOverlay", false) when toggle is clicked while on', () => {
    const preferences = { showPerfOverlay: true };
    const onUpdatePreference = vi.fn();
    render(
      <BoardSettings
        {...defaultProps({ preferences, onUpdatePreference })}
      />
    );
    const toggle = screen.getByRole('switch', { name: 'Performance overlay' });
    fireEvent.click(toggle);
    expect(onUpdatePreference).toHaveBeenCalledWith('showPerfOverlay', false);
  });

  it('does not render the Developer section when only preferences is provided without onUpdatePreference', () => {
    const preferences = { showPerfOverlay: false };
    render(<BoardSettings {...defaultProps({ preferences })} />);
    expect(screen.queryByText('Developer')).toBeNull();
  });
});
