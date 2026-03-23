# University Web - Project Overview

## Purpose
"lovein_university" - A campus/university web application with games, visual programming, lock mechanics, tasks, and social features. Built as a Telegram mini-app with Capacitor for Android.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Kotlin + Ktor + Exposed ORM
- **Visual Programming**: Rete.js v2 (node editor)
- **State Management**: TanStack React Query
- **Platform**: Telegram mini-app (@telegram-apps/sdk-react) + Capacitor (Android)
- **Package Manager**: bun (bun.lock present)

## Key Directories
- `university-web/components/node-editor/` - Visual programming node editor
- `university-web/components/` - All React components
- `university-web/lib/api.ts` - API client
- `university-web/types.ts` - Shared TypeScript types
- `src/main/kotlin/com/lovein/` - Backend Kotlin code
- `src/main/kotlin/com/lovein/service/nodescript/` - Script execution engine
- `src/main/kotlin/com/lovein/service/nodescript/handlers/` - Node type handlers

## Commands
- `bun run dev` - Dev server
- `bun run build` - Production build
- `npx tsc --noEmit` - Type check (has pre-existing errors in other files)

## Node Editor Architecture
- Frontend definitions: `nodeDefinitions.ts` - Array of NodeTypeDefinition objects
- Backend engine: `NodeScriptEngine.kt` - Step-based execution loop
- Backend handlers: `handlers/*.kt` - One handler per node type
- Types: `types.ts` - SocketType, NodeCategory, serialization formats
- Editor: `createEditor.ts` - Rete.js setup, serialize/deserialize
- UI: `CustomComponents.tsx` - Custom node/socket rendering
- Player: `NodeScriptPlayerView.tsx` - Chat-style script player

## Notes
- Pre-existing TS errors in CustomComponents.tsx (Rete.js typing), creator pages, etc.
- Backend supports ArrayValue in ScriptValue type system
- Chinese language UI throughout
