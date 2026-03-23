<div align="center">

# LoveIn University

**A gamified virtual campus platform built as a Telegram Mini App**

React + TypeScript + Tailwind CSS + Capacitor

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Telegram Mini App](https://img.shields.io/badge/Telegram-Mini_App-26A5E4?logo=telegram&logoColor=white)](https://core.telegram.org/bots/webapps)

</div>

---

## Overview

LoveIn University is a feature-rich virtual campus experience that runs as a Telegram Mini App, with native Android/iOS support via Capacitor. Users enroll in courses, complete tasks, earn credits, and interact with a wide range of campus facilities.

## Features

**Campus Core**
- Course enrollment, task system, and credit tracking
- Customizable homepage with drag-and-drop shortcuts
- Real-time schedule management
- Leaderboard and achievement system

**Social**
- Community posts with comments, likes, and polls
- Campus Walk — drop and discover items on a map (Leaflet)
- Voice chat rooms with anonymous matching
- Follow system, guestbook, and user profiles with status cards

**Self-Lock System**
- Time-locked challenges with multiple unlock methods (time, guess, vote, community)
- Keyholder management and supervision agreements
- BLE lock box integration (DG-Lab Coyote V2/V3)
- Hygiene opening, verification photos, and extension system

**Entertainment**
- Roulette game builder with visual node editor (Rete.js)
- Art gallery and cinema with upload, review, and tagging
- Music room with playlist management
- Live streaming
- Liar's Tavern — multiplayer card game
- Therapy room with remote device control via WebSocket/BLE

**AI & Chat**
- Alumni chat with AI character cards (custom system prompts)
- Rope art studio with artist profiles and booking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19, TypeScript 5.8 |
| Styling | Tailwind CSS 4, Radix UI, Lucide Icons |
| State | React Query (TanStack Query) |
| Animation | Motion (Framer Motion) |
| Routing | Client-side SPA (single layout with sub-page navigation) |
| Maps | Leaflet + React Leaflet |
| 3D | Three.js + Cannon-ES (physics) |
| Node Editor | Rete.js |
| Video | HLS.js, Mux (upload/playback) |
| BLE | Web Bluetooth API, Capacitor BLE plugin |
| Native | Capacitor (Android + iOS) |
| Telegram | @telegram-apps/sdk-react |
| Build | Vite 6, Bun |
| Deployment | Docker (Bun static server) |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- A backend API server (see Environment Variables)

### Install

```bash
bun install
```

### Environment Variables

Create a `.env.local` file:

```env
VITE_API_URL=https://your-api-server.com/api/v1
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
VITE_APP_URL=https://your-app-url.com
```

### Development

```bash
bun run dev
```

### Build

```bash
# Web
bun run build

# Android
bun run build:android

# iOS
bun run build:ios
```

### Docker

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://your-api.com/api/v1 \
  --build-arg VITE_TELEGRAM_BOT_USERNAME=your_bot \
  --build-arg VITE_APP_URL=https://your-app.com \
  --build-arg GIT_COMMIT_SHA=$(git rev-parse --short HEAD) \
  -t lovein-university-web .

docker run -p 3000:3000 lovein-university-web
```

## Project Structure

```
university-web/
├── App.tsx                  # Root component with auth gating
├── components/
│   ├── layout/              # MainLayout, LockDetailView, DesktopSidebar
│   ├── features/            # Dashboard, homepage
│   ├── academic/            # Courses, enrollment, teaching building
│   ├── social/              # Posts, campus walk, community
│   ├── lock/                # Lock creation wizard
│   ├── media/               # Gallery, cinema, upload pages
│   ├── music/               # Music player, playlists
│   ├── therapy/             # Therapy room controls
│   ├── roulette/            # Roulette game player
│   ├── node-editor/         # Visual script editor (Rete.js)
│   ├── alumni-chat/         # AI character chat
│   ├── profile/             # User profile, settings
│   ├── settings/            # General, notification settings
│   └── ui/                  # Shared UI components
├── contexts/                # React contexts (theme, therapy, lightbox)
├── hooks/                   # Custom hooks (BLE, voice chat, game room)
├── lib/                     # API client, auth, utilities
│   ├── api.ts               # Typed API client with auth
│   ├── auth-context.tsx     # Authentication provider
│   └── telegram-provider.tsx
├── types.ts                 # Shared TypeScript types
└── vite.config.ts
```

## License

This project is open source. See the [LICENSE](LICENSE) file for details.
