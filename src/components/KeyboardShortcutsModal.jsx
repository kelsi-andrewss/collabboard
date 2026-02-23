import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import './KeyboardShortcutsModal.css';

const SHORTCUT_GROUPS = [
  {
    label: 'Canvas',
    shortcuts: [
      { keys: ['Space', 'Drag'], description: 'Pan canvas' },
      { keys: ['Ctrl', 'Scroll'], description: 'Zoom in / out' },
      { keys: ['Ctrl', '+'], description: 'Zoom in' },
      { keys: ['Ctrl', '-'], description: 'Zoom out' },
      { keys: ['Ctrl', '0'], description: 'Reset zoom' },
      { keys: ['Home'], description: 'Recenter view' },
    ],
  },
  {
    label: 'Objects',
    shortcuts: [
      { keys: ['Delete'], description: 'Delete selected' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate selected' },
      { keys: ['Ctrl', 'A'], description: 'Select all' },
      { keys: ['Ctrl', 'C'], description: 'Copy selected' },
      { keys: ['Ctrl', 'X'], description: 'Cut selected' },
      { keys: ['Ctrl', 'V'], description: 'Paste' },
      { keys: ['Escape'], description: 'Deselect / cancel' },
    ],
  },
  {
    label: 'Edit',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
    ],
  },
  {
    label: 'Other',
    shortcuts: [
      { keys: ['?'], description: 'Show this help' },
    ],
  },
];

export function KeyboardShortcutsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay ksm-overlay" onClick={onClose}>
      <div className="modal-card ksm-card" onClick={(e) => e.stopPropagation()}>
        <div className="ksm-header">
          <div className="ksm-title">
            <Keyboard size={20} className="ksm-title-icon" />
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button className="ksm-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ksm-body">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label} className="ksm-group">
              <div className="ksm-group-label">{group.label}</div>
              <ul className="ksm-list">
                {group.shortcuts.map((shortcut) => (
                  <li key={shortcut.description} className="ksm-row">
                    <span className="ksm-description">{shortcut.description}</span>
                    <span className="ksm-keys">
                      {shortcut.keys.map((key, i) => (
                        <React.Fragment key={key}>
                          {i > 0 && <span className="ksm-plus">+</span>}
                          <kbd className="ksm-badge">{key}</kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
