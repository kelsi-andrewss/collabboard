import { Square, Circle, Triangle, Minus } from 'lucide-react';

const SHAPE_ICONS = {
  rectangle: Square,
  circle: Circle,
  triangle: Triangle,
  line: Minus,
};

export function ShapeIcon({ type, color, size = 18 }) {
  const Icon = SHAPE_ICONS[type];
  const strokeColor = type === 'line' ? color : '#555';
  const fillColor = color;

  if (type === 'line') {
    return <Icon size={size} stroke={strokeColor} strokeWidth={2} />;
  }
  return <Icon size={size} fill={fillColor} stroke={strokeColor} strokeWidth={1} />;
}
