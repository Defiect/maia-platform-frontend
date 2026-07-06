<p align="center">
  <p align="center">
   <img width="150" src="public/maia-no-bg.png" alt="Logo">
  </p>
	<h1 align="center"><b>Maia Chess</b></h1>
	<p align="center">
		A human-like chess engine.
    <br />
    <a href="https://www.maiachess.com"><strong>maiachess.com »</strong></a>
    <br />
    <br />
  </p>
</p>

This repository contains the source code for the [Maia Chess Platform](https://www.maiachess.com), a modern web application designed for chess training and analysis. It leverages the Maia chess engine, developed by the University of Toronto's Computational Social Science Lab, to provide human-like move predictions and insights. The platform is built with Next.js, TypeScript, and Tailwind CSS. Join our [Discord server](https://discord.gg/hHb6gqFpxZ) for discussions, questions, and to connect with the community.

The platform runs on **Maia 3**, a single unified neural network that conditions its predictions on a target Elo rating. This lets you explore human-like play across the full skill spectrum — from **Maia 600 to Maia 2600** in 100-point increments — all from one model running directly in your browser. Both Maia 3 and Stockfish 17 run client-side (via ONNX Runtime Web and WebAssembly), powering a dual-engine analysis experience with no server round-trips for evaluation.

## Features

The platform offers a range of tools for playing, training, and analyzing chess:

- **Analysis**: Dual-engine (Maia 3 + Stockfish 17) analysis of your games, with move recommendations, win-probability tracking, deep analysis, and a "learn from your mistakes" workflow. You can browse your saved games, analyze live-streamed Lichess games, or upload/paste a custom **PGN or FEN** to analyze.
- **Play**: Play full games against Maia at any rating from 600 to 2600, or team up in **Hand & Brain** mode where a human and Maia collaborate on moves.
- **Openings**: An openings trainer and repeatable **opening drills** for practicing lines against Maia, with rating-based insights.
- **Puzzles**: Tactics and training puzzles.
- **Turing Test**: Guess whether a game was played by a human or by Maia.
- **Broadcasts**: Live tournament coverage with real-time Maia/Stockfish analysis, including curated Candidates positions.
- **Leaderboards & Profiles**: Track your standing across game modes and view player profiles and stats.
- **Blog**: Articles and updates from the Maia team.

## Getting Started

Follow these instructions to set up the development environment on your local machine.

### Prerequisites

- Node.js (v18.18+ required by Next.js 15; v20+ recommended)
- npm (comes bundled with Node.js)

### Installation

1.  Clone the repository to your local machine:

    ```bash
    git clone https://github.com/maia-chess/maia-platform-frontend.git
    cd maia-platform-frontend
    ```

2.  Install the project dependencies using npm:
    ```bash
    npm install
    ```

### Running the Development Server

To start the local development server, run the following command. This will launch the application on `http://localhost:3000` with hot-reloading enabled.

```bash
npm run dev
```

### Building for Production

To create a production-ready build of the application, use the following command. This will compile and optimize the code, outputting the final assets to the `.next` directory.

```bash
npm run build
```

You can then start the production server with `npm run start`.

## Development Guide

This section provides guidelines for contributing to the platform's development.

### Branching Strategy

The repository follows a simple branching model:

- `main`: This branch is synced with the live deployment on Vercel. All code on this branch is considered production-ready.
- **Feature Branches**: All development work, including new features and bug fixes, should be done on separate feature branches. These branches are then merged into `main` via pull requests.

### Conventional Commits

We use the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for our commit messages. This standard creates a more readable and structured commit history. Each commit message should follow the format:

`{type}: {description}`

Common types include:

- `feat`: A new feature
- `fix`: A bug fix
- `chore`: Changes to the build process or auxiliary tools
- `style`: Code style changes (formatting, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `docs`: Documentation only changes

### Architectural Overview

The platform is architected around a modular and scalable structure, leveraging modern React patterns.

#### File Structure

The `src/` directory contains all the core application code, organized as follows:

```
src/
├── api/          # Backend API client functions, organized by feature
├── components/   # Reusable React components, structured by feature or domain
├── constants/    # Shared constants (e.g. Maia model list and rating ranges)
├── contexts/     # React Context providers for global state management
├── hooks/        # Custom React Hooks containing business logic and state
├── lib/          # Utility functions, helpers, and the client-side engines (lib/engine)
├── pages/        # Next.js pages, defining the application's routes
├── styles/       # Global styles and Tailwind CSS configuration
└── types/        # TypeScript type definitions, organized by feature
```

#### Core Concepts and Interactions

The application's logic is primarily driven by a combination of custom hooks, React contexts, and components, creating a clear separation of concerns.

- **Components (`src/components/`)**: These are the building blocks of the UI. They are designed to be "dumb" or presentational, receiving data and callbacks via props. Major features like `Analysis`, `Play`, `Openings`, `Puzzles`, and `Turing` have their own dedicated component directories.

- **Hooks (`src/hooks/`)**: This is where the majority of the application's business logic resides. Each major feature has a corresponding "controller" hook (e.g., `usePlayController`, `useAnalysisController`). These hooks encapsulate state management, interactions with the chess engines, and API calls. They effectively act as state machines for their respective features.

- **Contexts (`src/contexts/`)**: To avoid prop drilling, we use React Context to provide the state and methods from our controller hooks to the component tree. For example, `PlayControllerContext` will expose the state and functions from the `usePlayController` hook to any child component that needs it, such as the `GameBoard` or `PlayControls`.

This architecture allows for a decoupled system where the UI (components) is a function of the state managed by the hooks, and the state is shared efficiently through contexts. For example, a page component under `src/pages` will initialize a controller hook. That hook's state is then provided to the component tree via a Context Provider. Child components can then consume that context to access state and dispatch actions without passing props down multiple levels.

#### Learning Resources

To better understand the patterns used in this codebase, we recommend reviewing the official documentation for these core React and Next.js features:

- [React Hooks](https://react.dev/reference/react/hooks)
- [React Context](https://react.dev/reference/react/createContext)
- [Next.js App Router](https://nextjs.org/docs)

### Client-Side Chess Engines

A key feature of the platform is its ability to run both Stockfish and Maia directly in the user's browser. This is accomplished using WebAssembly and ONNX Runtime Web, and both engines run inside Web Workers so that inference never blocks the UI thread.

- **Maia (`src/contexts/MaiaEngineContext.tsx`, `src/lib/engine/maia.ts`)**: The platform runs **Maia 3**, a single unified neural network provided as an ONNX (Open Neural Network Exchange) model (`public/maia3/maia3_simplified.onnx`). Unlike the earlier Maia models — which shipped one network per rating (e.g. `maia_kdd_1100` through `maia_kdd_1900`) — Maia 3 takes the target rating as a runtime input. It accepts both the player's Elo (`eloSelf`) and the opponent's Elo (`eloOppo`), so a single model can emulate human play from **Maia 600 to Maia 2600** (see `src/constants/common.ts` and `src/constants/analysis.ts`). The model is loaded and executed in a dedicated Web Worker (`public/maia-worker.js`) via `onnxruntime-web`, and is cached in IndexedDB after the first download, with progress reported to the UI. This engine provides the "human-like" move predictions that are central to the platform's mission.

- **Stockfish (`src/contexts/StockfishEngineContext.tsx`, `src/lib/engine/stockfish.ts`)**: We use a WebAssembly build of **Stockfish 18 dev** (via `@lichess-org/stockfish-web`, assets under `public/stockfish/`) for standard chess analysis. The engine is managed through a React Context provider that exposes a simple interface for streaming move evaluations, and its NNUE weights are downloaded on demand and cached. This provides the "objective" best moves in any given position.

These context providers are consumed by higher-level controller hooks (like `useAnalysisController`) to provide the dual-engine analysis that powers many of the platform's features.

### Private LAN Deployment (Docker)

The repo ships a self-hosted deployment for private LAN use, with optional server-side engines:

```bash
docker compose up -d --build
```

- **web** (`http://<host>:8080`): the Next.js app (standalone output).
- **engine** (`http://<host>:3001`): a sidecar (`engine-server/`) exposing a native Stockfish dev build over WebSocket (`/ws/stockfish`) and Maia ONNX inference (`POST /maia/batch`) via `onnxruntime-node` with CUDA (automatic CPU fallback). Requires the NVIDIA Container Toolkit / Docker Desktop GPU support for CUDA.

On the analysis page, two toggles in the sidebar header switch Maia and Stockfish independently between **client** (in-browser WASM/ONNX) and **server** (sidecar) execution. Note: on plain-HTTP LAN origins the browser disables `SharedArrayBuffer` (COOP/COEP requires a secure context), so client-side Stockfish is unavailable and the toggle defaults to server mode there. The sidecar is unauthenticated — do not expose it beyond a trusted LAN.

## Contributing Guidelines

Before contributing to the Maia Chess Platform, please review these guidelines to ensure consistency and quality.

### Code Style and Formatting

The project uses automated code formatting and linting to maintain consistency:

- **ESLint**: Configured with Next.js, TypeScript, and Prettier integration
- **Prettier**: Enforces consistent formatting with the following settings:
  - No semicolons (`semi: false`)
  - Single quotes (`singleQuote: true`)
  - 2-space indentation (`tabWidth: 2`)
  - Automatic Tailwind CSS class sorting

### Development Workflow

1. **Setup**: Install recommended VS Code extensions for optimal development experience:

   - `dbaeumer.vscode-eslint`
   - `esbenp.prettier-vscode`
   - `silvenon.mdx`

2. **Code Quality**: Run linting before committing:

   ```bash
   npm run lint
   ```

3. **Tests**: The project uses Jest. Run the test suite with:
   ```bash
   npm run test
   ```

### Code Conventions

- **File Naming**:

  - Components: PascalCase (e.g., `GameBoard.tsx`)
  - Hooks: camelCase with `use` prefix (e.g., `useLocalStorage.ts`)
  - Utilities: camelCase (e.g., `customAnalysis.ts`)

- **Import Patterns**:

  - Use absolute imports: `import { buildUrl } from 'src/api'`
  - Leverage barrel exports through `index.ts` files

- **Component Organization**: Components are organized by feature in `src/components/`

### Technical Clarifications

#### Stockfish Evaluation Perspective

**Important**: Stockfish evaluations are processed to be **from the perspective of whoever is playing the next move**, not from White's perspective.

- **Stockfish's raw output**: Always from White's perspective (positive = good for White, negative = good for Black)
- **Platform processing**: Converts to current player's perspective (positive = good for current player)
- **Implementation**: When it's Black's turn, the centipawn value is multiplied by -1

This ensures consistent interpretation where positive values always represent an advantage for the player whose turn it is. The conversion logic is documented in `src/lib/engine/stockfish.ts` (see the perspective-handling comments around the centipawn/mate normalization).

#### State Management Architecture

The platform uses a Context + Custom Hooks pattern:

1. **Controller Hooks**: Business logic encapsulated in hooks (e.g., `useAnalysisController`, `usePlayController`)
2. **Context Providers**: State distribution via React Context (e.g., `AuthContext`, `ModalContext`)
3. **Components**: Presentation layer consuming contexts

This architecture separates concerns and avoids prop drilling while maintaining clean component interfaces.

#### API Patterns

- **Base URL**: All API calls use `/api/v1/` prefix
- **Organization**: Feature-based modules in `src/api/`
- **Pattern**: Each module exports functions through barrel exports

## Deployment

The Maia Chess Platform is deployed on [Vercel](https://vercel.com/). The `main` branch is automatically built and deployed to the production URL. Pull requests also generate unique preview deployments, allowing for easy testing and review before merging.
