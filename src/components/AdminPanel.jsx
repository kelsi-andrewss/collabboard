import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { collection, doc, getDocs, setDoc, updateDoc, serverTimestamp, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import './AdminPanel.css';

export function AdminPanel({ isOpen, onClose, allBoards, groups, migrateGroupStrings, createBoard, deleteBoard }) {
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [grantSuccess, setGrantSuccess] = useState('');
  const [migrateStatus, setMigrateStatus] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const searchTimerRef = useRef(null);

  // Create read-only board state
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardGroupId, setNewBoardGroupId] = useState('');
  const [createBoardStatus, setCreateBoardStatus] = useState(null);
  const [creatingBoard, setCreatingBoard] = useState(false);

  // Delete board state
  const [deleteBoardQuery, setDeleteBoardQuery] = useState('');
  const [deleteBoardTarget, setDeleteBoardTarget] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteBoardStatus, setDeleteBoardStatus] = useState(null);
  const [deletingBoard, setDeletingBoard] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    getDocs(collection(db, 'users')).then((snap) => {
      setAllUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      setUsersLoaded(true);
    }).catch(() => {
      setUsersLoaded(true);
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSearch = (term) => {
    setSearchQuery(term);
    setGrantSuccess('');
    clearTimeout(searchTimerRef.current);
    if (!term.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const usersRef = collection(db, 'users');
        const lower = term.trim().toLowerCase();
        const q = query(
          usersRef,
          where('displayNameLower', '>=', lower),
          where('displayNameLower', '<=', lower + '\uf8ff'),
          orderBy('displayNameLower'),
          limit(8)
        );
        const snap = await getDocs(q);
        const results = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.role !== 'admin');
        setSearchResults(results);
        setSearchOpen(results.length > 0);
      } catch {
        setSearchResults([]);
        setSearchOpen(false);
      }
    }, 200);
  };

  const handleGrant = async (u) => {
    await setDoc(doc(db, 'users', u.uid), { role: 'admin' }, { merge: true });
    setAllUsers(prev => prev.map(p => p.uid === u.uid ? { ...p, role: 'admin' } : p));
    setGrantSuccess(`Admin granted to ${u.displayName || u.uid}`);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrateStatus(null);
    try {
      await migrateGroupStrings();
      setMigrateStatus({ type: 'success', text: 'Migration complete' });
    } catch (err) {
      setMigrateStatus({ type: 'error', text: 'Migration failed' });
    } finally {
      setMigrating(false);
    }
  };

  const handleCreateReadOnlyBoard = async (e) => {
    e.preventDefault();
    const name = newBoardName.trim();
    if (!name) return;
    setCreatingBoard(true);
    setCreateBoardStatus(null);
    try {
      const ref = await createBoard(name, newBoardGroupId || null, 'public');
      await updateDoc(doc(db, 'boards', ref.id), { readonly: true, updatedAt: serverTimestamp() });
      setCreateBoardStatus({ type: 'success', text: `Board "${name}" created as read-only.` });
      setNewBoardName('');
      setNewBoardGroupId('');
    } catch {
      setCreateBoardStatus({ type: 'error', text: 'Failed to create board.' });
    } finally {
      setCreatingBoard(false);
    }
  };

  const filteredBoardsForDelete = deleteBoardQuery.trim()
    ? (allBoards || []).filter(b =>
        b.name?.toLowerCase().includes(deleteBoardQuery.trim().toLowerCase())
      )
    : [];

  const handleSelectBoardToDelete = (board) => {
    setDeleteBoardTarget(board);
    setDeleteConfirmName('');
    setDeleteBoardStatus(null);
  };

  const handleCancelDelete = () => {
    setDeleteBoardTarget(null);
    setDeleteConfirmName('');
    setDeleteBoardStatus(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteBoardTarget) return;
    if (deleteConfirmName !== deleteBoardTarget.name) return;
    setDeletingBoard(true);
    setDeleteBoardStatus(null);
    try {
      await deleteBoard(deleteBoardTarget.id);
      setDeleteBoardStatus({ type: 'success', text: `Board "${deleteBoardTarget.name}" deleted.` });
      setDeleteBoardTarget(null);
      setDeleteConfirmName('');
      setDeleteBoardQuery('');
    } catch {
      setDeleteBoardStatus({ type: 'error', text: 'Failed to delete board.' });
    } finally {
      setDeletingBoard(false);
    }
  };

  if (!isOpen) return null;

  const currentAdmins = allUsers.filter(u => u.role === 'admin');
  const boardCount = allBoards?.length ?? 0;
  const groupCount = groups?.length ?? 0;
  const userCount = usersLoaded ? allUsers.length : '...';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card admin-panel-card" onClick={e => e.stopPropagation()}>
        <div className="admin-panel-header">
          <h2>Admin Panel</h2>
          <button className="admin-panel-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="admin-panel-body">
          <div className="admin-panel-section">
            <h3>Overview</h3>
            <div className="admin-stats-row">
              <div className="admin-stat-pill">
                <span className="admin-stat-pill-value">{boardCount}</span>
                <span className="admin-stat-pill-label">boards</span>
              </div>
              <div className="admin-stat-pill">
                <span className="admin-stat-pill-value">{groupCount}</span>
                <span className="admin-stat-pill-label">groups</span>
              </div>
              <div className="admin-stat-pill">
                <span className="admin-stat-pill-value">{userCount}</span>
                <span className="admin-stat-pill-label">users</span>
              </div>
            </div>
          </div>

          <div className="admin-panel-section">
            <h3>Grant Admin</h3>
            <div className="admin-search-wrapper">
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search users by name..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              />
              {searchOpen && (
                <div className="admin-search-dropdown">
                  {searchResults.map(u => (
                    <div key={u.uid} className="admin-search-dropdown-item">
                      <div className="admin-search-item-info">
                        {u.photoURL && (
                          <img src={u.photoURL} alt="" className="admin-search-avatar" referrerPolicy="no-referrer" />
                        )}
                        <div>
                          <div className="admin-search-item-name">{u.displayName || u.uid}</div>
                          <div className="admin-search-item-uid">{u.uid}</div>
                        </div>
                      </div>
                      <button
                        className="admin-grant-btn"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleGrant(u)}
                      >
                        Grant admin
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {grantSuccess && <p className="admin-grant-success">{grantSuccess}</p>}
          </div>

          <div className="admin-panel-section">
            <h3>Current Admins</h3>
            {currentAdmins.length === 0 ? (
              <p className="admin-empty">{usersLoaded ? 'No admins found.' : 'Loading...'}</p>
            ) : (
              <div className="admin-list">
                {currentAdmins.map(u => (
                  <div key={u.uid} className="admin-list-item">
                    <span className="admin-list-item-name">{u.displayName || u.uid}</span>
                    <span className="admin-list-item-uid">{u.uid}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-panel-section">
            <h3>Remove Admin</h3>
            <div className="admin-instructions-block">
              To remove an admin, go to Firebase Console &rarr; Firestore &rarr; users collection &rarr; find the user document &rarr; edit the &ldquo;role&rdquo; field &rarr; delete the value or set it to any non-&ldquo;admin&rdquo; string &rarr; save.
            </div>
          </div>

          <div className="admin-panel-section">
            <h3>Create Read-Only Board</h3>
            <form className="admin-create-board-form" onSubmit={handleCreateReadOnlyBoard}>
              <input
                type="text"
                className="admin-search-input"
                placeholder="Board name"
                value={newBoardName}
                onChange={e => { setNewBoardName(e.target.value); setCreateBoardStatus(null); }}
                disabled={creatingBoard}
                required
              />
              <select
                className="admin-group-select"
                value={newBoardGroupId}
                onChange={e => setNewBoardGroupId(e.target.value)}
                disabled={creatingBoard}
              >
                <option value="">No group (optional)</option>
                {(groups || []).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <button
                type="submit"
                className="admin-create-board-btn"
                disabled={creatingBoard || !newBoardName.trim()}
              >
                {creatingBoard ? 'Creating...' : 'Create read-only board'}
              </button>
            </form>
            {createBoardStatus && (
              <p className={`admin-maintenance-status ${createBoardStatus.type}`}>{createBoardStatus.text}</p>
            )}
          </div>

          <div className="admin-panel-section">
            <h3>Delete Board</h3>
            {!deleteBoardTarget ? (
              <>
                <div className="admin-search-wrapper">
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Search boards by name..."
                    value={deleteBoardQuery}
                    onChange={e => { setDeleteBoardQuery(e.target.value); setDeleteBoardStatus(null); }}
                  />
                  {filteredBoardsForDelete.length > 0 && (
                    <div className="admin-search-dropdown">
                      {filteredBoardsForDelete.map(b => (
                        <div key={b.id} className="admin-search-dropdown-item admin-delete-board-item">
                          <div className="admin-search-item-info">
                            <div>
                              <div className="admin-search-item-name">{b.name}</div>
                              <div className="admin-search-item-uid">{b.id}</div>
                            </div>
                          </div>
                          <button
                            className="admin-delete-select-btn"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => handleSelectBoardToDelete(b)}
                          >
                            Select
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {deleteBoardQuery.trim() && filteredBoardsForDelete.length === 0 && (
                    <p className="admin-empty" style={{ marginTop: 'var(--md-sys-spacing-2)' }}>No boards match.</p>
                  )}
                </div>
                {deleteBoardStatus && (
                  <p className={`admin-maintenance-status ${deleteBoardStatus.type}`}>{deleteBoardStatus.text}</p>
                )}
              </>
            ) : (
              <div className="admin-delete-confirm-block">
                <p className="admin-delete-confirm-prompt">
                  Type <strong>{deleteBoardTarget.name}</strong> to confirm deletion of this board and all its objects. This cannot be undone.
                </p>
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder={`Type "${deleteBoardTarget.name}" to confirm`}
                  value={deleteConfirmName}
                  onChange={e => setDeleteConfirmName(e.target.value)}
                  disabled={deletingBoard}
                />
                <div className="admin-delete-confirm-actions">
                  <button
                    className="admin-maintenance-btn"
                    onClick={handleCancelDelete}
                    disabled={deletingBoard}
                  >
                    Cancel
                  </button>
                  <button
                    className="admin-delete-confirm-btn"
                    onClick={handleConfirmDelete}
                    disabled={deletingBoard || deleteConfirmName !== deleteBoardTarget.name}
                  >
                    {deletingBoard ? 'Deleting...' : 'Delete board'}
                  </button>
                </div>
                {deleteBoardStatus && (
                  <p className={`admin-maintenance-status ${deleteBoardStatus.type}`}>{deleteBoardStatus.text}</p>
                )}
              </div>
            )}
          </div>

          <div className="admin-panel-section">
            <h3>Maintenance</h3>
            <div className="admin-maintenance-row">
              <button
                className="admin-maintenance-btn"
                onClick={handleMigrate}
                disabled={migrating || !migrateGroupStrings}
              >
                {migrating ? 'Migrating...' : 'Migrate Groups'}
              </button>
              {migrateStatus && (
                <span className={`admin-maintenance-status ${migrateStatus.type}`}>
                  {migrateStatus.text}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
