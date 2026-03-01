# Atomis

**Interactive 3D Chemistry Learning Platform with Hand Tracking**

Atomis is a browser-based chemistry lab where you mix elements using hand gestures tracked through your webcam. Combine 10 base elements into 15 compounds, explore 3D particle visualizations, and learn chemistry with an AI-powered lab assistant — all without touching your keyboard.

![React](https://img.shields.io/badge/React-19-blue)
![Three.js](https://img.shields.io/badge/Three.js-R181-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Hand%20Tracking-green)

## Features

- **Hand Gesture Controls** — Pinch to scale, clap to fuse, point to interact with UI, fist to save compounds, circular motion to reset
- **3D Particle Visualizations** — Custom GLSL shaders render element particles with core, shell, and orbital ring systems
- **Element Fusion** — Combine elements with optional catalysts (heat, light, chemical) to create compounds
- **AI Lab Assistant** — "Atom" explains your creations using OpenAI gpt-5-mini with ElevenLabs voice synthesis
- **Interactive Simulations** — Hand-reactive water shader and NaCl crystal lattice visualization
- **Quiz Mode** — Test your knowledge of elements and compounds
- **Death Mechanics** — Dangerous combinations trigger game-over states with explanations
- **Animated Landing Page** — 3D particle background with animated intro

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite |
| 3D Rendering | Three.js via React Three Fiber |
| Hand Tracking | MediaPipe Tasks Vision |
| AI Assistant | OpenAI (gpt-5-mini) |
| Voice Synthesis | ElevenLabs API |
| Backend | Convex (schema defined, not yet wired to UI) |
| Routing | React Router v6 |
| Persistence | LocalStorage (`chemLabHistory`, `labSlots`, `labCreatedSlots`) |

## Getting Started

### Prerequisites

- Node.js 18+
- A webcam (for hand tracking)
- OpenAI API key
- ElevenLabs API key (optional, for voice)

### Installation

```bash
git clone <repo-url>
cd atomis
npm install
```

### Environment Variables

Create `atomis/.env` from the example:

```bash
cp .env.example .env
```

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_OPENAI_API_KEY` | OpenAI API key for the AI lab assistant | Yes |
| `VITE_ELEVENLABS_API_KEY` | ElevenLabs API key for voice synthesis | No |
| `VITE_ELEVENLABS_VOICE_ID` | ElevenLabs voice ID (default: Adam) | No |

### Run

```bash
cd atomis
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and allow camera access when prompted.

## Project Structure

```
atomis/
├── App.tsx                  # Central state management & combination logic
├── LandingPage.tsx          # Animated intro with 3D particle background
├── index.tsx                # Router + ConvexProvider entry point
├── types.ts                 # TypeScript interfaces
├── constants.ts             # Elements, combinations, gesture config
├── components/
│   ├── Scene.tsx            # Three.js canvas + catalyst/explosion shaders
│   ├── ParticleSphere.tsx   # Element particle system (core/shell/orbital)
│   ├── WaterSimulation.tsx  # Interactive water shader (hand-reactive)
│   ├── SaltSimulation.tsx   # NaCl crystal lattice visualization
│   ├── HandTracker.tsx      # MediaPipe hand landmark detection
│   ├── UIOverlay.tsx        # HUD, catalyst buttons, shelf, cursor
│   ├── Dashboard.tsx        # Element collection, lab slots, quiz mode
│   ├── MascotGuide.tsx      # AI assistant panel
│   ├── SymbioteBlob.tsx     # 3D animated assistant character
│   ├── MascotAvatar.tsx     # 3D robot head
│   └── AtomLabel.tsx        # Element label UI
├── services/
│   └── gestureRecognition.ts  # Gesture analysis pipeline
├── utils/
│   ├── gemini.ts            # OpenAI API integration
│   ├── mascot.ts            # Pre-written facts & system messages
│   ├── tts.ts               # ElevenLabs text-to-speech
│   └── chat.ts              # Chat functionality
├── hooks/
│   ├── useVoice.ts          # Voice synthesis with audio analysis
│   └── useConversation.ts   # Conversation state management
└── assets/                  # Sounds, images
```

## Gestures

| Gesture | How | Action |
|---------|-----|--------|
| **Point** | Index finger up, others curled | Hover over UI buttons to interact |
| **Pinch** | Thumb + index finger together | Scale the element particle sphere |
| **Clap** | Bring both hands close (< 0.12 apart, hold 800ms) | Trigger element fusion |
| **Closed Fist** | All fingers curled | Save combined element to shelf |
| **Circular Motion** | Point and trace a circle | Reset / clear current fusion |

## Elements & Combinations

### Base Elements

| Symbol | Name | Atomic # |
|--------|------|----------|
| H | Hydrogen | 1 |
| O | Oxygen | 8 |
| Na | Sodium | 11 |
| Cl | Chlorine | 17 |
| C | Carbon | 6 |
| Fe | Iron | 26 |
| N | Nitrogen | 7 |
| S | Sulfur | 16 |
| Ca | Calcium | 20 |
| Ho | Holmium | 67 |

### Reactions

| Inputs | Result | Catalyst |
|--------|--------|----------|
| H + O | H₂O (Water) | Heat |
| Na + Cl | NaCl (Salt) | — |
| Na + H₂O | NaOH (Sodium Hydroxide) | — |
| H + Cl | HCl (Hydrochloric Acid) | — |
| C + O | CO₂ (Carbon Dioxide) | Heat |
| N + H | NH₃ (Ammonia) | Chemical |
| Fe + O | Fe₂O₃ (Iron Oxide) | — |
| Ca + Cl | CaCl₂ (Calcium Chloride) | — |
| N + O | NO₂ (Nitrogen Dioxide) | Light |
| S + O | SO₂ (Sulfur Dioxide) | Heat |
| C + H | CH₄ (Methane) | Heat |
| S + H | H₂S (Hydrogen Sulfide) | — |
| H₂O + CO₂ | H₂CO₃ (Carbonic Acid) | — |
| HCl + NaOH | NaCl (Salt) | — |
| NH₃ + HCl | NH₄Cl (Ammonium Chloride) | — |

## Architecture

```
HandTracker (MediaPipe camera loop)
  → gestureRecognition.ts (pinch, point, fist, circular, clap detection)
    → App.tsx (centralized state: elements, catalysts, game state)
      ├── Scene (3D rendering: ParticleSphere, WaterSimulation, SaltSimulation, GLSL shaders)
      ├── UIOverlay (HUD, catalyst buttons, shelf, cursor)
      ├── Dashboard (element collection, lab slots, quiz mode)
      └── MascotGuide + SymbioteBlob (AI explanations via OpenAI, voice via ElevenLabs)
```

**Key patterns:**
- All game state is centralized in `App.tsx` as `useState` hooks, passed to children via props
- High-frequency tracking data (hand position, cursor) uses `useRef` + `requestAnimationFrame` to avoid re-renders
- All GLSL shaders are inline template literals in component files — no separate `.glsl` files
- Gesture pipeline: camera frame → MediaPipe landmarks → gesture buffer analysis → React state updates
- Hit testing maps index-finger screen position to DOM elements with class `.interactable-btn`
