import React, { useState, useEffect } from 'react';
import { parseColorForInput, parseOpacity, hexToRgba, SUGGESTED_COLORS } from '../utils/colorUtils.js';
import './ColorPicker.css';

const SHAPE_SVGS = {
  rectangle: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  circle: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  triangle: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <polygon points="12,3 21,21 3,21" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  line: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <line x1="3" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <polyline points="13,7 19,12 13,17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function ColorPickerMenu({ type, data, history = [], onSelect, shapeSelector }) {
  const [opacity, setOpacity] = useState(() => parseOpacity(data.active));
  const hexValue = parseColorForInput(data.active);

  useEffect(() => {
    setOpacity(parseOpacity(data.active));
  }, [data.active]);

  const handleColorChange = (e) => {
    const hex = e.target.value;
    const color = opacity < 1 ? hexToRgba(hex, opacity) : hex;
    onSelect(type, color);
  };

  const handleOpacityChange = (e) => {
    const newOpacity = parseFloat(e.target.value);
    setOpacity(newOpacity);
    const color = newOpacity < 1 ? hexToRgba(hexValue, newOpacity) : hexValue;
    onSelect(type, color);
  };

  return (
    <div className="color-dropdown" onClick={e => e.stopPropagation()}>
      {shapeSelector && (
        <div className="shape-section">
          <span className="section-label">Shape</span>
          <div className="shape-btn-row">
            {shapeSelector.types.map(t => (
              <button
                key={t}
                className={`shape-btn${shapeSelector.activeType === t ? ' active' : ''}`}
                onClick={() => shapeSelector.onSelect(t)}
                title={t.charAt(0).toUpperCase() + t.slice(1)}
              >
                {SHAPE_SVGS[t]}
              </button>
            ))}
          </div>
          <div className="section-divider" />
        </div>
      )}
      <div className="picker-row">
        <label>Pick Color</label>
        <input
          type="color"
          value={hexValue}
          onChange={handleColorChange}
          className="native-picker"
        />
      </div>
      <div className="slider-row" style={{marginTop: 4}}>
        <label>Opacity</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={opacity}
          onChange={handleOpacityChange}
        />
        <span style={{fontSize: 'var(--md-sys-typescale-label-small-size)', color: 'var(--md-sys-color-on-surface-variant)', minWidth: 30}}>{Math.round(opacity * 100)}%</span>
      </div>
      <div className="color-suggestions">
        <label>Suggestions</label>
        <div className="suggestions-grid">
          {SUGGESTED_COLORS.map((c) => (
            <div
              key={c}
              className="color-swatch"
              style={{ background: c }}
              onClick={() => {
                setOpacity(1);
                onSelect(type, c);
              }}
            />
          ))}
        </div>
      </div>
      <div className="color-history">
        <label>History</label>
        <div className="history-grid">
          {Array.from({ length: 10 }).map((_, i) => {
            const c = history[i];
            return c ? (
              <div
                key={`${c}-${i}`}
                className="color-swatch"
                style={{backgroundImage: `linear-gradient(${c}, ${c}), linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)`}}
                onClick={() => {
                  setOpacity(parseOpacity(c));
                  onSelect(type, c);
                }}
              />
            ) : (
              <div key={`empty-${i}`} className="color-swatch empty-swatch" />
            );
          })}
        </div>
      </div>
    </div>
  );
}
