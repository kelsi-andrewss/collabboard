import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../firebase/config', () => ({ db: {}, rtdb: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  Timestamp: { now: vi.fn() },
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: vi.fn(() => () => {}),
  off: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../hooks/useBoardsList', () => ({
  useBoardsList: () => ({
    boards: [],
    loading: false,
    deleteBoard: vi.fn(),
  }),
}));

vi.mock('../hooks/useGlobalPresence', () => ({
  useGlobalPresence: () => ({}),
}));

vi.mock('./GroupCard.jsx', () => ({
  GroupCard: () => null,
}));

vi.mock('./Avatar.jsx', () => ({
  Avatar: () => null,
}));

vi.mock('./GroupSettings.jsx', () => ({
  GroupSettings: () => null,
}));

vi.mock('../utils/slugUtils.js', () => ({
  buildSlugChain: vi.fn((g) => [g?.id].filter(Boolean)),
  resolveSlugChain: vi.fn((slugs, groups) => groups.find(g => g.id === slugs?.[0]) ?? null),
}));

vi.mock('../utils/groupUtils.js', () => ({
  formatDate: vi.fn(() => ''),
  estimateItemHeight: vi.fn(() => 116),
  distributeToColumns: vi.fn((items) => [items]),
  isAncestor: vi.fn(() => false),
}));

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { GroupPage } from './GroupPage.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides = {}) {
  return {
    groupSlugs: ['my-group'],
    groups: [{ id: 'my-group', name: 'My Group', parentGroupId: null }],
    onBack: vi.fn(),
    onOpenBoard: vi.fn(),
    onNavigateToGroup: vi.fn(),
    user: { uid: 'user-1' },
    isAdmin: false,
    adminViewActive: false,
    onUpdateGroup: vi.fn(),
    onInviteGroupMember: vi.fn(),
    onRemoveGroupMember: vi.fn(),
    onSetGroupProtected: vi.fn(),
    onDeleteGroupCascade: vi.fn(),
    allBoards: [],
    moveBoard: vi.fn(),
    moveGroup: vi.fn(),
    createSubgroup: vi.fn(),
    darkMode: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — GroupPage All tab visibility by role
// ---------------------------------------------------------------------------

describe('GroupPage — All tab visibility by role', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render an "All" tab for non-admin users', () => {
    render(<GroupPage {...defaultProps({ isAdmin: false })} />);
    const buttons = screen.getAllByRole('button');
    const allTab = buttons.find(b => b.textContent === 'All');
    expect(allTab).toBeUndefined();
  });

  it('renders an "All" tab for admin users', () => {
    render(<GroupPage {...defaultProps({ isAdmin: true })} />);
    const buttons = screen.getAllByRole('button');
    const allTab = buttons.find(b => b.textContent === 'All');
    expect(allTab).toBeTruthy();
  });

  it('renders "My Boards" tab for non-admin users', () => {
    render(<GroupPage {...defaultProps({ isAdmin: false })} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.find(b => b.textContent === 'My Boards')).toBeTruthy();
  });

  it('renders "My Boards" tab for admin users', () => {
    render(<GroupPage {...defaultProps({ isAdmin: true })} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.find(b => b.textContent === 'My Boards')).toBeTruthy();
  });

  it('non-admin only sees My Boards and Browse tabs, not All', () => {
    render(<GroupPage {...defaultProps({ isAdmin: false })} />);
    const buttons = screen.getAllByRole('button');
    const filterTabLabels = ['My Boards', 'Browse', 'All'];
    const rendered = buttons.filter(b => filterTabLabels.includes(b.textContent));
    const labels = rendered.map(b => b.textContent);
    expect(labels).toContain('My Boards');
    expect(labels).toContain('Browse');
    expect(labels).not.toContain('All');
  });

  it('admin sees My Boards, Browse, and All tabs', () => {
    render(<GroupPage {...defaultProps({ isAdmin: true })} />);
    const buttons = screen.getAllByRole('button');
    const filterTabLabels = ['My Boards', 'Browse', 'All'];
    const rendered = buttons.filter(b => filterTabLabels.includes(b.textContent));
    const labels = rendered.map(b => b.textContent);
    expect(labels).toContain('My Boards');
    expect(labels).toContain('Browse');
    expect(labels).toContain('All');
  });

  it('defaults to "My Boards" active tab for non-admin when localStorage is empty', () => {
    render(<GroupPage {...defaultProps({ isAdmin: false })} />);
    const buttons = screen.getAllByRole('button');
    const myTab = buttons.find(b => b.textContent === 'My Boards');
    expect(myTab.className).toContain('sort-btn--active');
  });

  it('ignores stale "all" in localStorage for non-admin and falls back to "my"', () => {
    localStorage.setItem('collaboard_group_sort', JSON.stringify({ view: 'all' }));
    render(<GroupPage {...defaultProps({ isAdmin: false })} />);
    const buttons = screen.getAllByRole('button');
    const myTab = buttons.find(b => b.textContent === 'My Boards');
    expect(myTab.className).toContain('sort-btn--active');
  });

  it('honours stored "all" view from localStorage for admin users', () => {
    localStorage.setItem('collaboard_group_sort', JSON.stringify({ view: 'all' }));
    render(<GroupPage {...defaultProps({ isAdmin: true })} />);
    const buttons = screen.getAllByRole('button');
    const allTab = buttons.find(b => b.textContent === 'All');
    expect(allTab.className).toContain('sort-btn--active');
  });

  it('clicking Browse tab sets it as active for non-admin', () => {
    render(<GroupPage {...defaultProps({ isAdmin: false })} />);
    const buttons = screen.getAllByRole('button');
    const browseTab = buttons.find(b => b.textContent === 'Browse');
    fireEvent.click(browseTab);

    const updatedButtons = screen.getAllByRole('button');
    const updatedBrowse = updatedButtons.find(b => b.textContent === 'Browse');
    expect(updatedBrowse.className).toContain('sort-btn--active');
  });

  it('clicking All tab sets it as active for admin', () => {
    render(<GroupPage {...defaultProps({ isAdmin: true })} />);
    const buttons = screen.getAllByRole('button');
    const allTab = buttons.find(b => b.textContent === 'All');
    fireEvent.click(allTab);

    const updatedButtons = screen.getAllByRole('button');
    const updatedAll = updatedButtons.find(b => b.textContent === 'All');
    expect(updatedAll.className).toContain('sort-btn--active');
  });
});
