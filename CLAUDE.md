# Atomis — Interactive 3D Chemistry Learning Platform

## Commands

All commands run from `atomis/` directory:

```bash
cd atomis
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm run preview  # Preview production build
```

No lint or test scripts are configured.

## Environment Variables

Create `atomis/.env` (see `atomis/.env.example`):

```
VITE_OPENAI_API_KEY=<your-openai-api-key>
VITE_ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
VITE_ELEVENLABS_VOICE_ID=<your-elevenlabs-voice-id>
```

`vite.config.ts` also reads `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` as non-VITE fallbacks.

## Architecture

**Stack**: React 19 + TypeScript + Vite | Three.js via React Three Fiber | MediaPipe hand tracking | OpenAI GPT-4o Mini | ElevenLabs voice synthesis

**Path alias**: `@` → `atomis/`

### Routing (`atomis/index.tsx`)

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `LandingPage` | Animated intro with 3D particle background |
| `/play` | `App` | Main chemistry lab experience |

Entry point wraps routes in `<BrowserRouter>`.

### Key Architectural Patterns

- **Centralized state in `App.tsx`**: All game state (elements, catalysts, quiz mode, game state) lives here as `useState` hooks. Child components receive data via props.
- **Refs for high-frequency tracking**: Hand position, cursor, hover state use `useRef` + `requestAnimationFrame` loops to avoid React re-renders on every frame.
- **Custom GLSL shaders**: All shaders are inline template literals in `.tsx` files (no `.glsl` files). Found in `Scene.tsx`, `ParticleSphere.tsx`, `WaterSimulation.tsx`, `LandingPage.tsx`.
- **Gesture recognition pipeline**: `HandTracker` → `gestureRecognition` service → `TrackingData` → `App.tsx` state → child components.
- **Hit testing**: Hand index-finger screen position mapped to DOM elements with class `.interactable-btn` for gesture-based UI interaction.
- **LocalStorage persistence**: Uses keys `chemLabHistory`, `labSlots`, `labCreatedSlots`.

### Data Flow

```
HandTracker (MediaPipe camera loop)
  → services/gestureRecognition.ts (analyzeHand, GestureBuffer, detectClosedFist)
    → App.tsx (centralized state: elements, catalysts, combinations, game state)
      ├── Scene (3D rendering: ParticleSphere, WaterSimulation, SaltSimulation, shaders)
      ├── UIOverlay (HUD, catalyst buttons, shelf, cursor, death screen)
      ├── Dashboard (element collection, slot selection, quiz mode)
      └── MascotGuide + MascotAvatar (AI explanations via OpenAI, 3D robot head)
```

### Key Files

| File | Purpose |
|------|---------|
| `atomis/App.tsx` | Central state, gesture handling, combination logic |
| `atomis/index.tsx` | Router entry point |
| `atomis/types.ts` | All TypeScript interfaces (`ElementData`, `TrackingData`, `HandGestureState`, etc.) |
| `atomis/constants.ts` | `ELEMENTS` array (10), `COMBINATIONS` array (15), `GESTURE_COOLDOWN` |
| `atomis/components/HandTracker.tsx` | MediaPipe HandLandmarker setup + camera frame loop |
| `atomis/services/gestureRecognition.ts` | Gesture analysis: pinch, point, fist, circular reset, clap |
| `atomis/components/Scene.tsx` | Three.js Canvas + all catalyst/explosion shaders |
| `atomis/components/ParticleSphere.tsx` | Element particle system (core + shell + orbital rings) |
| `atomis/components/WaterSimulation.tsx` | Interactive water shader (hand-reactive) |
| `atomis/components/SaltSimulation.tsx` | NaCl pile + lattice visualization |
| `atomis/components/UIOverlay.tsx` | HUD, catalyst buttons, shelf, cursor overlay |
| `atomis/components/Dashboard.tsx` | Element collection, lab slots, quiz mode |
| `atomis/utils/elementExplanation.ts` | OpenAI API calls for element explanations |
| `atomis/utils/chat.ts` | Chat functionality |
| `atomis/utils/labPrompt.ts` | Lab assistant prompt configuration |
| `atomis/utils/tts.ts` | ElevenLabs text-to-speech |
| `atomis/hooks/useVoice.ts` | Voice synthesis with audio analysis |
| `atomis/hooks/useConversation.ts` | Conversation state management |
| `atomis/hooks/useLabConversation.ts` | Lab-specific conversation logic |
| `atomis/components/AtomLabel.tsx` | Element label UI |
| `atomis/components/SymbioteBlob.tsx` | 3D animated assistant character |

### Gestures

| Gesture | Action |
|---------|--------|
| Clap (hands < 0.12 apart, held > 800ms) | Trigger element fusion |
| Closed fist | Save combined element to shelf |
| Circular pointing motion | Reset/clear current fusion |
| Pinch | Scale element particle sphere |
| Point + hover | Interact with UI buttons (`.interactable-btn`) |
