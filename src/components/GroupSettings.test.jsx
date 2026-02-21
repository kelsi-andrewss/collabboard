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

import { GroupSettings } from './GroupSettings.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGroup(overrides = {}) {
  return {
    id: 'group-1',
    name: 'Test Group',
    ownerId: 'owner-uid',
    members: {},
    visibility: 'private',
    protected: false,
    ...overrides,
  };
}

function defaultProps(overrides = {}) {
  return {
    group: makeGroup(),
    currentUserId: 'owner-uid',
    onUpdateGroup: vi.fn(),
    onInviteMember: vi.fn(),
    onRemoveMember: vi.fn(),
    onSetProtected: vi.fn(),
    onDeleteGroup: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GroupSettings — visibility controls
// ---------------------------------------------------------------------------

describe('GroupSettings — visibility controls', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders visibility pills for owner', () => {
    render(<GroupSettings {...defaultProps()} />);
    expect(screen.getByText(/Private/)).toBeTruthy();
    expect(screen.getByText(/Public/)).toBeTruthy();
    expect(screen.getByText(/Open/)).toBeTruthy();
  });

  it('calls onUpdateGroup with the selected visibility when Save is clicked', () => {
    const onUpdateGroup = vi.fn();
    render(<GroupSettings {...defaultProps({ onUpdateGroup })} />);

    const buttons = screen.getAllByRole('button');
    const publicBtn = buttons.find(b => b.textContent.includes('Public'));
    fireEvent.click(publicBtn);

    // onUpdateGroup should not be called yet — visibility is only buffered locally
    expect(onUpdateGroup).not.toHaveBeenCalled();

    // Find and click the Save button
    const saveBtn = buttons.find(b => b.textContent === 'Save');
    fireEvent.click(saveBtn);

    // Now onUpdateGroup should be called with the new visibility
    expect(onUpdateGroup).toHaveBeenCalledWith({ visibility: 'public' });
  });

  it('does not call onUpdateGroup when a non-manager clicks a pill', () => {
    const onUpdateGroup = vi.fn();
    const group = makeGroup({ ownerId: 'someone-else' });
    render(
      <GroupSettings
        {...defaultProps({ group, currentUserId: 'viewer-uid', onUpdateGroup })}
      />
    );

    const buttons = screen.queryAllByRole('button');
    const publicBtn = buttons.find(b => b.textContent.includes('Public'));
    if (publicBtn) fireEvent.click(publicBtn);

    expect(onUpdateGroup).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GroupSettings — delete group
// ---------------------------------------------------------------------------

describe('GroupSettings — delete group', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows a Delete Group button for the owner', () => {
    render(<GroupSettings {...defaultProps()} />);
    expect(screen.getByText('Delete Group')).toBeTruthy();
  });

  it('disables Delete Group button when group is protected', () => {
    const group = makeGroup({ protected: true });
    render(<GroupSettings {...defaultProps({ group })} />);
    const btn = screen.getByText('Delete Group').closest('button');
    expect(btn.disabled).toBe(true);
  });

  it('shows a confirm prompt after clicking Delete Group', () => {
    render(<GroupSettings {...defaultProps()} />);
    fireEvent.click(screen.getByText('Delete Group'));
    expect(screen.getByText(/This cannot be undone/)).toBeTruthy();
  });

  it('calls onDeleteGroup and onClose when the final delete button is clicked', () => {
    const onDeleteGroup = vi.fn();
    const onClose = vi.fn();
    render(<GroupSettings {...defaultProps({ onDeleteGroup, onClose })} />);

    fireEvent.click(screen.getByText('Delete Group'));
    const allDeleteBtns = screen.getAllByText('Delete');
    fireEvent.click(allDeleteBtns[allDeleteBtns.length - 1]);

    expect(onDeleteGroup).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels the delete prompt when Cancel is clicked', () => {
    render(<GroupSettings {...defaultProps()} />);
    fireEvent.click(screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText(/This cannot be undone/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GroupSettings — member list rendering
// ---------------------------------------------------------------------------

describe('GroupSettings — member list', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows "You (owner)" when currentUserId matches ownerId', () => {
    render(<GroupSettings {...defaultProps()} />);
    expect(screen.getByText('You (owner)')).toBeTruthy();
  });

  it('shows "No additional members" when members object is empty', () => {
    render(<GroupSettings {...defaultProps()} />);
    expect(screen.getByText('No additional members')).toBeTruthy();
  });

  it('calls onRemoveMember with the correct uid', () => {
    const onRemoveMember = vi.fn();
    const group = makeGroup({ members: { 'member-a': 'member' } });
    const { container } = render(
      <GroupSettings {...defaultProps({ group, onRemoveMember })} />
    );
    const removeBtn = container.querySelector('.member-remove-btn');
    fireEvent.click(removeBtn);
    expect(onRemoveMember).toHaveBeenCalledWith('member-a');
  });
});
