# CollabBoard

A production-scale real-time collaborative whiteboard with a built-in AI agent.

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
