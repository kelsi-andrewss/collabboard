import { describe, it, expect } from 'vitest';
import { getPortCoords, findSnapTarget, getConnectedEndpointUpdates, SNAP_DISTANCE } from './connectorUtils.js';

// Helper that mirrors the effectivePts logic inside LineShape.
function computeEffectivePts({ points, x, y, dragPos, objects, startConnectedId, startConnectedPort, endConnectedId, endConnectedPort }) {
  let effectivePts = points;
  if (dragPos && objects) {
    const pts = [...points];
    let modified = false;
    if (startConnectedId && startConnectedPort && dragPos.id === startConnectedId) {
      const target = objects[startConnectedId];
      if (target) {
        const p = getPortCoords({ ...target, x: dragPos.x, y: dragPos.y }, startConnectedPort);
        pts[0] = p.x - x;
        pts[1] = p.y - y;
        modified = true;
      }
    }
    if (endConnectedId && endConnectedPort && dragPos.id === endConnectedId) {
      const target = objects[endConnectedId];
      if (target) {
        const p = getPortCoords({ ...target, x: dragPos.x, y: dragPos.y }, endConnectedPort);
        pts[pts.length - 2] = p.x - x;
        pts[pts.length - 1] = p.y - y;
        modified = true;
      }
    }
    if (modified) effectivePts = pts;
  }
  return effectivePts;
}

describe('getPortCoords', () => {
  const obj = { x: 100, y: 200, width: 80, height: 60 };

  it('returns top port', () => {
    expect(getPortCoords(obj, 'top')).toEqual({ x: 140, y: 200 });
  });

  it('returns right port', () => {
    expect(getPortCoords(obj, 'right')).toEqual({ x: 180, y: 230 });
  });

  it('returns bottom port', () => {
    expect(getPortCoords(obj, 'bottom')).toEqual({ x: 140, y: 260 });
  });

  it('returns left port', () => {
    expect(getPortCoords(obj, 'left')).toEqual({ x: 100, y: 230 });
  });

  it('returns top-left port', () => {
    expect(getPortCoords(obj, 'top-left')).toEqual({ x: 100, y: 200 });
  });

  it('returns top-right port', () => {
    expect(getPortCoords(obj, 'top-right')).toEqual({ x: 180, y: 200 });
  });

  it('returns bottom-left port', () => {
    expect(getPortCoords(obj, 'bottom-left')).toEqual({ x: 100, y: 260 });
  });

  it('returns bottom-right port', () => {
    expect(getPortCoords(obj, 'bottom-right')).toEqual({ x: 180, y: 260 });
  });

  it('returns center for unknown port', () => {
    expect(getPortCoords(obj, 'center')).toEqual({ x: 140, y: 230 });
  });

  it('uses defaults when x/y/width/height are missing', () => {
    const p = getPortCoords({}, 'top');
    expect(p.y).toBe(0);   // y defaults to 0
    expect(p.x).toBe(75);  // cx = 0 + 150/2
  });

  it('uses fontSize-based height for text objects with no height field', () => {
    const textObj = { type: 'text', x: 50, y: 100, width: 200, fontSize: 16 };
    const expectedH = 16 * 1.3;
    const p = getPortCoords(textObj, 'bottom');
    expect(p.x).toBe(50 + 200 / 2);
    expect(p.y).toBe(100 + expectedH);
  });
});

describe('findSnapTarget', () => {
  const objects = {
    a: { id: 'a', x: 0, y: 0, width: 100, height: 100 },
  };

  it('snaps to nearest port within SNAP_DISTANCE', () => {
    // left port of obj a is at (0, 50). Querying from (5, 50) should snap.
    const result = findSnapTarget(5, 50, objects, new Set());
    expect(result).not.toBeNull();
    expect(result.objectId).toBe('a');
    expect(result.port).toBe('left');
  });

  it('returns null when outside SNAP_DISTANCE', () => {
    const result = findSnapTarget(500, 500, objects, new Set());
    expect(result).toBeNull();
  });

  it('excludes objects in excludeIds', () => {
    const result = findSnapTarget(5, 50, objects, new Set(['a']));
    expect(result).toBeNull();
  });

  it('skips line/arrow type objects', () => {
    const objs = {
      l: { id: 'l', type: 'line', x: 0, y: 0, width: 100, height: 100 },
    };
    const result = findSnapTarget(5, 50, objs, new Set());
    expect(result).toBeNull();
  });

  it('includes frame type objects as snap targets', () => {
    const objs = {
      f: { id: 'f', type: 'frame', x: 0, y: 0, width: 100, height: 100 },
    };
    const result = findSnapTarget(5, 50, objs, new Set());
    expect(result).not.toBeNull();
    expect(result.objectId).toBe('f');
  });

  it('snaps to corner port (top-left)', () => {
    // top-left of obj a is at (0, 0). Querying from (5, 5) — dist ~7, within SNAP_DISTANCE
    const result = findSnapTarget(5, 5, objects, new Set());
    expect(result).not.toBeNull();
    expect(result.port).toBe('top-left');
    expect(result.objectId).toBe('a');
  });
});

describe('getConnectedEndpointUpdates', () => {
  const rect = { id: 'rect1', type: 'rectangle', x: 200, y: 100, width: 100, height: 80 };
  const line = {
    id: 'line1', type: 'line', x: 0, y: 0,
    points: [250, 140, 100, 100],
    startConnectedId: 'rect1', startConnectedPort: 'bottom',
    endConnectedId: null, endConnectedPort: null,
  };

  it('updates startConnectedId endpoint when target moves', () => {
    const objects = { rect1: rect, line1: line };
    const updates = getConnectedEndpointUpdates('rect1', objects);
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('line1');
    // bottom port absolute x=250, normalized: 250-minX(100)=150
    expect(updates[0].data.points[0]).toBe(150); // 250 - minX(100)
    expect(updates[0].data.points[1]).toBe(80);  // 180 - minY(100)
    expect(updates[0].data.x).toBe(100);
    expect(updates[0].data.y).toBe(100);
    expect(updates[0].data.width).toBe(150);
    expect(updates[0].data.height).toBe(80);
  });

  it('returns empty array when no connectors reference the moved object', () => {
    const objects = { rect1: rect, line1: line };
    const updates = getConnectedEndpointUpdates('other-id', objects);
    expect(updates).toHaveLength(0);
  });
});

describe('computeEffectivePts (LineShape live drag logic)', () => {
  const objects = {
    box: { id: 'box', x: 100, y: 100, width: 80, height: 60 },
  };

  it('returns original points when dragPos is null', () => {
    const pts = [10, 10, 90, 90];
    const result = computeEffectivePts({
      points: pts, x: 0, y: 0,
      dragPos: null, objects,
      startConnectedId: 'box', startConnectedPort: 'top',
      endConnectedId: null, endConnectedPort: null,
    });
    expect(result).toBe(pts); // same reference — not copied
  });

  it('returns original points when objects is null', () => {
    const pts = [10, 10, 90, 90];
    const result = computeEffectivePts({
      points: pts, x: 0, y: 0,
      dragPos: { id: 'box', x: 200, y: 200 }, objects: null,
      startConnectedId: 'box', startConnectedPort: 'top',
      endConnectedId: null, endConnectedPort: null,
    });
    expect(result).toBe(pts);
  });

  it('returns original points when dragPos.id does not match either connected id', () => {
    const pts = [10, 10, 90, 90];
    const result = computeEffectivePts({
      points: pts, x: 0, y: 0,
      dragPos: { id: 'other', x: 200, y: 200 }, objects,
      startConnectedId: 'box', startConnectedPort: 'top',
      endConnectedId: null, endConnectedPort: null,
    });
    expect(result).toBe(pts);
  });

  it('overrides start endpoint when dragPos.id matches startConnectedId', () => {
    // box top port at original position: x=100+40=140, y=100
    // dragged to x=200, y=300 → top port: cx=200+40=240, y=300
    // connector at x=0, y=0 → pts[0]=240, pts[1]=300
    const result = computeEffectivePts({
      points: [140, 100, 90, 90], x: 0, y: 0,
      dragPos: { id: 'box', x: 200, y: 300 }, objects,
      startConnectedId: 'box', startConnectedPort: 'top',
      endConnectedId: null, endConnectedPort: null,
    });
    expect(result[0]).toBe(240); // 200 + 80/2 - 0
    expect(result[1]).toBe(300); // 300 - 0
    // end points unchanged
    expect(result[2]).toBe(90);
    expect(result[3]).toBe(90);
  });

  it('overrides end endpoint when dragPos.id matches endConnectedId', () => {
    // box right port at dragged position (200,300): x+w=280, cy=300+30=330
    const result = computeEffectivePts({
      points: [10, 10, 180, 130], x: 0, y: 0,
      dragPos: { id: 'box', x: 200, y: 300 }, objects,
      startConnectedId: null, startConnectedPort: null,
      endConnectedId: 'box', endConnectedPort: 'right',
    });
    expect(result[0]).toBe(10); // start unchanged
    expect(result[1]).toBe(10);
    expect(result[2]).toBe(280); // 200 + 80 - 0
    expect(result[3]).toBe(330); // 300 + 60/2 - 0
  });

  it('overrides both endpoints when the same object is connected to both', () => {
    // Unusual but valid: a connector with both ends on the same object.
    // box top = (140, 100) after drag to (200,300) → (240, 300)
    // box bottom = (140, 160) after drag → (240, 360)
    const result = computeEffectivePts({
      points: [140, 100, 140, 160], x: 0, y: 0,
      dragPos: { id: 'box', x: 200, y: 300 }, objects,
      startConnectedId: 'box', startConnectedPort: 'top',
      endConnectedId: 'box', endConnectedPort: 'bottom',
    });
    expect(result[0]).toBe(240);
    expect(result[1]).toBe(300);
    expect(result[2]).toBe(240);
    expect(result[3]).toBe(360);
  });

  it('accounts for connector x/y offset when computing relative points', () => {
    // Connector is positioned at x=50, y=60.
    // box top port at drag pos (200,300): (240, 300)
    // relative to connector: (240-50, 300-60) = (190, 240)
    const result = computeEffectivePts({
      points: [90, 40, 90, 90], x: 50, y: 60,
      dragPos: { id: 'box', x: 200, y: 300 }, objects,
      startConnectedId: 'box', startConnectedPort: 'top',
      endConnectedId: null, endConnectedPort: null,
    });
    expect(result[0]).toBe(190);
    expect(result[1]).toBe(240);
  });

  it('does not mutate the original points array', () => {
    const pts = [140, 100, 90, 90];
    const original = [...pts];
    computeEffectivePts({
      points: pts, x: 0, y: 0,
      dragPos: { id: 'box', x: 200, y: 300 }, objects,
      startConnectedId: 'box', startConnectedPort: 'top',
      endConnectedId: null, endConnectedPort: null,
    });
    expect(pts).toEqual(original);
  });
});
