import { getGenerativeModel } from 'firebase/ai';
import { ai } from '../firebase/config';
import { useState, useMemo, useRef, useEffect } from 'react';
import { homeToolDeclarations, homeSystemPrompt } from '../ai/homeToolDeclarations';
import { executeHomeToolCall } from '../ai/homeToolExecutors';

export function useHomeAI({ allBoards, createNewBoard, setBoardId, setBoardName }) {
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);

  const allBoardsRef = useRef(allBoards);
  useEffect(() => { allBoardsRef.current = allBoards; }, [allBoards]);

  const tools = useMemo(() => ({
    functionDeclarations: homeToolDeclarations,
  }), []);

  const model = useMemo(() => getGenerativeModel(ai, {
    model: 'gemini-2.0-flash',
    tools: [tools],
    systemInstruction: homeSystemPrompt,
  }), [tools]);

  const chat = useMemo(() => model.startChat(), [model]);

  const buildContext = () => {
    const boards = allBoardsRef.current;
    if (!boards?.length) return '';
    const lines = boards.map(b => {
      const groupLabel = b.groupId || b.group || null;
      return `  - "${b.name}"${groupLabel ? ` (group: ${groupLabel})` : ''} [id: ${b.id}]`;
    });
    return `[Available boards:\n${lines.join('\n')}\n]\n\n`;
  };

  const sendCommand = async (prompt) => {
    if (!chat) return;
    const contextPrompt = buildContext() + prompt;
    setIsTyping(true);
    setError(null);
    try {
      const result = await chat.sendMessage(contextPrompt);
      let calls = null;
      try {
        calls = result.response.functionCalls();
      } catch {
        if (result.response.candidates?.[0]?.content?.parts) {
          calls = result.response.candidates[0].content.parts
            .filter(p => p.functionCall)
            .map(p => p.functionCall);
        }
      }
      if (calls?.length) {
        for (const call of calls) {
          await executeHomeToolCall(call.name, call.args, {
            createNewBoard,
            allBoards: allBoardsRef.current,
            setBoardId,
            setBoardName,
          });
        }
      }
    } catch (err) {
      const msg = err?.message || 'Unknown error';
      setError(msg);
    } finally {
      setIsTyping(false);
    }
  };

  return { sendCommand, isTyping, error, clearError: () => setError(null) };
}
