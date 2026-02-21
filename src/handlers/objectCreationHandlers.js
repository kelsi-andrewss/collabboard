import { findNonOverlappingPosition } from '../utils/frameUtils.js';

const HEADER_HEIGHT = 60;

export function makeObjectCreationHandlers({
  board, stagePos, stageScale, shapeColors, user,
  ai, aiPrompt, setAiPrompt,
}) {
  const findOpenSpot = (w, h, isFrame = false) => {
    const cx = (window.innerWidth / 2 - stagePos.x) / stageScale;
    const cy = ((window.innerHeight - HEADER_HEIGHT) / 2 - stagePos.y) / stageScale;
    return findNonOverlappingPosition(cx, cy, w, h, isFrame, board.objects);
  };

  const handleAddSticky = () => {
    const pos = findOpenSpot(200, 200);
    board.addObject({
      type: 'sticky',
      text: 'New Sticky Note',
      x: pos.x,
      y: pos.y,
      color: shapeColors.sticky.active,
      userId: user.uid,
    });
  };

  const handleAddShape = (type) => {
    const pos = findOpenSpot(150, 150);
    board.addObject({
      type,
      x: pos.x,
      y: pos.y,
      width: 150,
      height: 150,
      color: shapeColors.shapes.active,
      userId: user.uid,
    });
  };

  const handleAddFrame = () => {
    const fw = Math.round(window.innerWidth * 0.55 / stageScale);
    const fh = Math.round((window.innerHeight - HEADER_HEIGHT) * 0.55 / stageScale);
    const pos = findOpenSpot(fw, fh, true);
    board.addObject({
      type: 'frame',
      x: pos.x,
      y: pos.y,
      width: fw,
      height: fh,
      title: 'Frame',
      color: '#6366f1',
      userId: user.uid,
    });
  };

  const handleAddLine = () => {
    const pos = findOpenSpot(200, 3);
    board.addObject({
      type: 'line',
      x: pos.x,
      y: pos.y,
      points: [0, 0, 200, 0],
      color: shapeColors.shapes.active,
      strokeWidth: 3,
      userId: user.uid,
    });
  };

  const handleAddArrow = () => {
    const pos = findOpenSpot(200, 3);
    board.addObject({
      type: 'arrow',
      x: pos.x,
      y: pos.y,
      points: [0, 0, 200, 0],
      color: shapeColors.shapes.active,
      strokeWidth: 3,
      userId: user.uid,
    });
  };

  const handleAddText = () => {
    const pos = findOpenSpot(200, 20);
    board.addObject({
      type: 'text',
      text: '',
      x: pos.x,
      y: pos.y,
      width: 200,
      fontSize: 16,
      color: '#1a1a1a',
      rotation: 0,
      frameId: null,
      childIds: [],
      userId: user.uid,
    });
  };

  const handleAISubmit = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    const prompt = aiPrompt;
    setAiPrompt('');
    await ai.sendCommand(prompt);
  };

  return { findOpenSpot, handleAddSticky, handleAddShape, handleAddFrame, handleAddLine, handleAddArrow, handleAddText, handleAISubmit };
}
