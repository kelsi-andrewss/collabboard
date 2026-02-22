import { getGenerativeModel } from "firebase/ai";
import { ai } from "../firebase/config";
import { useState, useRef, useCallback } from "react";

const RATE_LIMIT_KEY = 'ai_request_timestamps';
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function loadTimestamps() {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveTimestamps(timestamps) {
  try {
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(timestamps));
  } catch {
    // quota exceeded — proceed without persisting
  }
}

function getRecentTimestamps(timestamps) {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  return timestamps.filter(ts => ts > cutoff);
}

function buildObjectSummary(objects) {
  if (!objects || Object.keys(objects).length === 0) return 'empty board';
  const all = Object.values(objects);
  const total = all.length;
  const typeCounts = {};
  for (const obj of all) {
    typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
  }
  const typeSummary = Object.entries(typeCounts).map(([t, c]) => `${c} ${t}${c !== 1 ? 's' : ''}`).join(', ');
  const textSnippets = all
    .filter(o => o.text && o.text.trim().length > 0)
    .slice(0, 10)
    .map(o => `"${o.text.trim().slice(0, 80)}"`)
    .join(', ');
  let summary = `${total} object${total !== 1 ? 's' : ''}: ${typeSummary}`;
  if (textSnippets) summary += `. Text samples: ${textSnippets}`;
  return summary;
}

export function useVibeCheck() {
  const [vibeResult, setVibeResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const timestampsRef = useRef(getRecentTimestamps(loadTimestamps()));
  const clearTimerRef = useRef(null);

  const checkVibe = useCallback(async (objects) => {
    const recent = getRecentTimestamps(timestampsRef.current);
    if (recent.length >= RATE_LIMIT_MAX) {
      setVibeResult('rate-limited');
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setVibeResult(null), 3000);
      return;
    }

    setIsChecking(true);
    const now = Date.now();
    const updated = [...recent, now];
    timestampsRef.current = updated;
    saveTimestamps(updated);

    try {
      const model = getGenerativeModel(ai, { model: "gemini-2.0-flash" });
      const objectSummary = buildObjectSummary(objects);
      const prompt = `Based on these board objects, give me a single word (no punctuation) that captures the vibe of this board. Only respond with the one word. Objects: ${objectSummary}`;
      const result = await model.generateContent(prompt);
      const word = result.response.text().trim().toLowerCase().replace(/[^a-z]/g, '') || 'undefined';
      setVibeResult(word);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setVibeResult(null), 3000);
    } catch {
      setVibeResult('unknown');
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setVibeResult(null), 3000);
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { checkVibe, vibeResult, isChecking };
}
