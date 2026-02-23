# CollabBoard

A production-scale real-time collaborative whiteboard with a built-in AI agent.

## Deployed Application

Live at: https://g4-week-1.web.app

## Features
- **Infinite Canvas**: Smooth pan and zoom powered by Konva.js.
- **Real-Time Collaboration**: Multiplayer cursors (<50ms latency) and presence awareness using Firebase Realtime DB.
- **Board Objects**: Create, move, resize, and edit sticky notes and shapes with instant Firestore sync.
- **AI Board Agent**: Natural language board manipulation using Google Gemini (Vertex AI for Firebase).
- **Google Authentication**: Secure sign-in for multiplayer sessions.

## Tech Stack
- **Frontend**: React, Vite, Konva.js, Lucide-React.
- **Backend**: Firebase (Firestore, Realtime Database, Authentication).
- **AI**: Google Gemini 1.5 Flash via Vertex AI for Firebase.
- **Deployment**: Vercel (Frontend) & Firebase (Rules/Config).

## Architecture Overview

- **React 19 + Vite 7**: Component-based UI with fast HMR. No global state library — all state lives in custom hooks backed by Firebase.
- **Konva.js 10 / react-konva 19**: All board objects (sticky notes, shapes, frames, lines) render to an HTML5 canvas via Konva. The canvas layer is wrapped in `React.memo` with a custom equality check to prevent unnecessary redraws.
- **Firebase Firestore**: Stores all board objects in a `boards/{boardId}/objects` subcollection. Components subscribe via `onSnapshot` for real-time sync across all connected clients. Related mutations use `writeBatch` to maintain consistency.
- **Firebase Realtime Database**: Handles low-latency multiplayer presence — live cursors and online indicators are written on a 50 ms throttle and read by all peers via RTDB listeners.
- **Firebase Auth**: Google sign-in. All board read/write access requires authentication.
- **Vertex AI / Gemini 2.0 Flash**: An in-app AI agent accepts natural language commands and manipulates board objects via Gemini function calling. The agent uses a 2-pass execution strategy: frames are created first so that subsequent objects can reference them by index.

## Setup
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Create a `.env` file based on `.env.example` with your Firebase credentials.
4. Enable **Vertex AI for Firebase** in your Firebase Console.
5. Run the dev server: `npm run dev`.

## Project Research
Documentation for architecture decisions and the AI pivot can be found in the `project_research/` folder.
- `project_research/PRE-SEARCH.pdf`: Initial architectural discovery.
- `project_research/PRE-SEARCH_ADDENDUM.pdf`: Rationale for switching to Gemini.
