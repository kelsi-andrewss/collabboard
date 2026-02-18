import React from 'react';
import { Folder, Layout } from 'lucide-react';
import { groupToSlug } from '../utils/slugUtils.js';
import './GroupCard.css';

export function GroupCard({ group, boards, onNavigateToGroup, onNavigateToBoard }) {
  const slug = groupToSlug(group);
  const preview = boards.slice(0, 3);
  const extra = boards.length - preview.length;

  return (
    <div className="group-card">
      <div className="group-card-header" onClick={() => onNavigateToGroup(slug)}>
        <Folder size={18} className="group-card-icon" />
        <span className="group-card-name">{group || 'Ungrouped'}</span>
        <span className="group-card-count">{boards.length} board{boards.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="group-card-boards">
        {preview.map(b => (
          <button
            key={b.id}
            className="group-card-board-item"
            onClick={() => onNavigateToBoard(slug, b.id, b.name)}
          >
            <Layout size={13} />
            <span>{b.name}</span>
          </button>
        ))}
        {extra > 0 && (
          <button
            className="group-card-see-all"
            onClick={() => onNavigateToGroup(slug)}
          >
            See all {boards.length} boards →
          </button>
        )}
      </div>
    </div>
  );
}
