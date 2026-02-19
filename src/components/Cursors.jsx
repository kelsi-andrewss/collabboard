import React from 'react';
import { Circle, Text, Group, Rect } from 'react-konva';

function CursorsInner({ presentUsers, userId }) {
  return (
    <>
      {Object.entries(presentUsers).map(([id, data]) => {
        if (id === userId) return null;
        const typing = data.isTyping;
        return (
          <Group key={id} x={data.x} y={data.y} listening={false}>
            {typing && (
              <Circle
                radius={10}
                fill="transparent"
                stroke={data.color}
                strokeWidth={2}
                opacity={0.6}
              />
            )}
            <Circle
              radius={5}
              fill={data.color}
              stroke="white"
              strokeWidth={1}
            />
            <Rect
              x={10}
              y={-8}
              width={(typing ? data.name.length * 7 + 30 : data.name.length * 7 + 10)}
              height={16}
              fill={data.color}
              cornerRadius={3}
            />
            <Text
              text={typing ? `${data.name} ...` : data.name}
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

function cursorsEqual(prev, next) {
  if (prev.userId !== next.userId) return false;
  const pu = prev.presentUsers, nu = next.presentUsers;
  const pk = Object.keys(pu), nk = Object.keys(nu);
  if (pk.length !== nk.length) return false;
  for (const k of pk) {
    if (!nu[k]) return false;
    if (pu[k].x !== nu[k].x || pu[k].y !== nu[k].y ||
        pu[k].color !== nu[k].color || pu[k].name !== nu[k].name ||
        pu[k].isTyping !== nu[k].isTyping) return false;
  }
  return true;
}

export const Cursors = React.memo(CursorsInner, cursorsEqual);
