import React from 'react';
import { Circle, Text, Group, Rect } from 'react-konva';

function CursorsInner({ presentUsers, userId }) {
  return (
    <>
      {Object.entries(presentUsers).map(([id, data]) => {
        if (id === userId) return null;
        return (
          <Group key={id} x={data.x} y={data.y} listening={false}>
            <Circle
              radius={5}
              fill={data.color}
              stroke="white"
              strokeWidth={1}
            />
            <Rect
              x={10}
              y={-8}
              width={data.name.length * 7 + 10}
              height={16}
              fill={data.color}
              cornerRadius={3}
            />
            <Text
              text={data.name}
              fontSize={10}
              fill="white"
              x={15}
              y={-5}
            />
          </Group>
        );
      })}
    </>
  );
}

// Update this comparator if new state props are added
function cursorsEqual(prev, next) {
  if (prev.userId !== next.userId) return false;
  const pu = prev.presentUsers, nu = next.presentUsers;
  const pk = Object.keys(pu), nk = Object.keys(nu);
  if (pk.length !== nk.length) return false;
  for (const k of pk) {
    if (!nu[k]) return false;
    if (pu[k].x !== nu[k].x || pu[k].y !== nu[k].y ||
        pu[k].color !== nu[k].color || pu[k].name !== nu[k].name) return false;
  }
  return true;
}

export const Cursors = React.memo(CursorsInner, cursorsEqual);
