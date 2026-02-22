import { describe, it, expect, vi } from 'vitest';
import { makeObjectCreationHandlers } from './objectCreationHandlers.js';

vi.mock('../utils/frameUtils.js', () => ({
  findNonOverlappingPosition: vi.fn((cx, cy) => ({ x: cx, y: cy })),
}));

function makeBoard() {
  return {
    objects: {},
    addObject: vi.fn(),
  };
}

function makeConfig(overrides = {}) {
  return {
    board: makeBoard(),
    stagePos: { x: 0, y: 0 },
    stageScale: 1,
    shapeColors: {
      sticky: { active: '#fef08a' },
      shapes: { active: '#bfdbfe' },
      frame: { active: '#6366f1' },
      text: { active: '#1a1a1a' },
    },
    user: { uid: 'user-1' },
    ai: { sendCommand: vi.fn() },
    aiPrompt: '',
    setAiPrompt: vi.fn(),
    ...overrides,
  };
}

describe('makeObjectCreationHandlers', () => {
  describe('handleAddText', () => {
    it('calls board.addObject with type text', () => {
      const config = makeConfig();
      const { handleAddText } = makeObjectCreationHandlers(config);
      handleAddText();
      expect(config.board.addObject).toHaveBeenCalledOnce();
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.type).toBe('text');
    });

    it('uses shapeColors.text.active as the color', () => {
      const config = makeConfig({
        shapeColors: {
          sticky: { active: '#fef08a' },
          shapes: { active: '#bfdbfe' },
          frame: { active: '#6366f1' },
          text: { active: '#1a1a1a' },
        },
      });
      const { handleAddText } = makeObjectCreationHandlers(config);
      handleAddText();
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.color).toBe('#1a1a1a');
    });

    it('does NOT use shapeColors.shapes.active for text color', () => {
      const config = makeConfig({
        shapeColors: {
          sticky: { active: '#fef08a' },
          shapes: { active: '#bfdbfe' },
          frame: { active: '#6366f1' },
          text: { active: '#333333' },
        },
      });
      const { handleAddText } = makeObjectCreationHandlers(config);
      handleAddText();
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.color).not.toBe('#bfdbfe');
      expect(arg.color).toBe('#333333');
    });

    it('respects a custom text color from shapeColors', () => {
      const config = makeConfig({
        shapeColors: {
          sticky: { active: '#fef08a' },
          shapes: { active: '#bfdbfe' },
          frame: { active: '#6366f1' },
          text: { active: '#ff0000' },
        },
      });
      const { handleAddText } = makeObjectCreationHandlers(config);
      handleAddText();
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.color).toBe('#ff0000');
    });

    it('includes required fields: text, width, fontSize, rotation, frameId, childIds, userId', () => {
      const config = makeConfig();
      const { handleAddText } = makeObjectCreationHandlers(config);
      handleAddText();
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.text).toBe('Type something...');
      expect(arg.width).toBe(200);
      expect(arg.fontSize).toBe(16);
      expect(arg.rotation).toBe(0);
      expect(arg.frameId).toBeNull();
      expect(arg.childIds).toEqual([]);
      expect(arg.userId).toBe('user-1');
    });
  });

  describe('handleAddSticky', () => {
    it('calls board.addObject with type sticky using shapeColors.sticky.active', () => {
      const config = makeConfig();
      const { handleAddSticky } = makeObjectCreationHandlers(config);
      handleAddSticky();
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.type).toBe('sticky');
      expect(arg.color).toBe('#fef08a');
    });
  });

  describe('handleAddShape', () => {
    it('calls board.addObject with the provided shape type', () => {
      const config = makeConfig();
      const { handleAddShape } = makeObjectCreationHandlers(config);
      handleAddShape('rectangle');
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.type).toBe('rectangle');
    });

    it('uses shapeColors.shapes.active as color for shapes', () => {
      const config = makeConfig();
      const { handleAddShape } = makeObjectCreationHandlers(config);
      handleAddShape('circle');
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.color).toBe('#bfdbfe');
    });
  });

  describe('handleAddLine', () => {
    it('calls board.addObject with type line', () => {
      const config = makeConfig();
      const { handleAddLine } = makeObjectCreationHandlers(config);
      handleAddLine();
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.type).toBe('line');
    });

    it('includes points array and strokeWidth', () => {
      const config = makeConfig();
      const { handleAddLine } = makeObjectCreationHandlers(config);
      handleAddLine();
      const arg = config.board.addObject.mock.calls[0][0];
      expect(Array.isArray(arg.points)).toBe(true);
      expect(arg.points).toHaveLength(4);
      expect(arg.strokeWidth).toBe(3);
    });
  });

  describe('handleAddArrow', () => {
    it('calls board.addObject with type arrow', () => {
      const config = makeConfig();
      const { handleAddArrow } = makeObjectCreationHandlers(config);
      handleAddArrow();
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.type).toBe('arrow');
    });
  });

  describe('handleAddFrame', () => {
    it('calls board.addObject with type frame', () => {
      const config = makeConfig();
      const { handleAddFrame } = makeObjectCreationHandlers(config);
      handleAddFrame();
      const arg = config.board.addObject.mock.calls[0][0];
      expect(arg.type).toBe('frame');
    });
  });

  describe('handleAISubmit', () => {
    it('calls ai.sendCommand with the current prompt and clears it', async () => {
      const config = makeConfig({ aiPrompt: 'create a sticky note' });
      const { handleAISubmit } = makeObjectCreationHandlers(config);
      await handleAISubmit({ preventDefault: vi.fn() });
      expect(config.ai.sendCommand).toHaveBeenCalledWith('create a sticky note');
      expect(config.setAiPrompt).toHaveBeenCalledWith('');
    });

    it('does nothing when aiPrompt is blank', async () => {
      const config = makeConfig({ aiPrompt: '   ' });
      const { handleAISubmit } = makeObjectCreationHandlers(config);
      await handleAISubmit({ preventDefault: vi.fn() });
      expect(config.ai.sendCommand).not.toHaveBeenCalled();
    });
  });
});
