import React from 'react';
import { Circle, Text, Group, Rect } from 'react-konva';

export const Cursors = ({ presentUsers, userId }) => {
  return (
    <>
      {Object.entries(presentUsers).map(([id, data]) => {
        if (id === userId) return null;
        return (
          <Group key={id} x={data.x} y={data.y}>
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
};
