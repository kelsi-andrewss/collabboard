import React from 'react';
import { Arrow } from 'react-konva';

export const Connector = ({ from, to, color = '#6b7280' }) => {
  // from and to are {x, y} coordinates for now. 
  // In a more advanced version, they would be object IDs.
  return (
    <Arrow
      points={[from.x, from.y, to.x, to.y]}
      stroke={color}
      fill={color}
      strokeWidth={2}
      pointerLength={10}
      pointerWidth={10}
    />
  );
};
