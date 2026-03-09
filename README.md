# CodeCohesion

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-5865F2?logo=discord&logoColor=white)](https://discord.gg/ABRnay8PM5)

**[🚀 Live Demo](https://codecohesion.virtualgenius.com/)** | Explore React, Gource, cBioPortal, and more!

![Timeline V2 Visualization](docs/images/timeline-v2-gource.png)
*Interactive 3D timeline showing repository evolution with cohesion analysis*

**Open-source 3D visualization tool for analyzing code cohesion and architectural evolution.** Explore your codebase as an interactive solar system and watch it evolve over time to understand structure, detect bounded contexts, and identify coupling patterns.

**What makes CodeCohesion unique:**
- 🌍 **3D Spatial Visualization** - Solar system metaphor for intuitive architecture understanding
- ⏱️ **Live Timeline Playback** - Watch your codebase evolve commit-by-commit
- 🔗 **Cohesion Analysis** - Detect bounded contexts through temporal coupling
- 🎯 **DDD-Focused** - Built for Domain-Driven Design and monolith decomposition
- 🚀 **Open Source** - Free, transparent, extensible
- 🌐 **Browser-Based** - No installation, runs anywhere

**Inspired by:** [Gource](https://gource.io) for evolution visualization, [CodeScene](https://codescene.io) for behavioral code analysis.

---

> **📘 DDD & Bounded Context Detection**
> Want to see how CodeCohesion can detect bounded contexts and analyze domain language? Check out our comprehensive vision document: **[DDD-VISION.md](DDD-VISION.md)**
>
> Covers: Temporal coupling analysis • Ubiquitous language detection • Vocabulary clustering • Connascence of name • AST-based semantic analysis

---

## 📋 Table of Contents

- [Why Use This?](#-why-use-this)
- [Features](#-current-features)
- [Quick Start](#-quick-start)
- [Requirements](#-requirements)
- [Project Structure](#-project-structure)
- [Design Decisions](#-design-decisions)
- [Roadmap](#️-roadmap)
- [DDD Vision & Analysis Plans](DDD-VISION.md) 📘
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## 🤔 Why CodeCohesion?

**Problem:** Understanding code architecture and cohesion is hard. Where are your bounded contexts? Which files are tightly coupled? How did your architecture evolve to its current state?

**Solution:** CodeCohesion turns git history into an interactive 3D visualization that reveals:
- 🔗 **Cohesion Patterns** - Which files belong together (bounded contexts)
- 🔥 **Coupling Hotspots** - Files that change together frequently
- 🏗️ **Architecture** - Hierarchical structure at a glance
- ⏳ **Evolution** - How your codebase grew and changed over time
- 👥 **Ownership** - Who works on what parts of the code

**Use Cases:**
- 📚 **DDD & Bounded Contexts** - Discover natural domain boundaries through cohesion
- 🔍 **Monolith Decomposition** - Identify where to split based on temporal coupling
- 🎓 **Onboarding** - Give new team members a visual architectural tour
- 📽️ **Retrospectives** - Watch timeline playback of how features evolved
- 💰 **Technical Debt** - Find legacy hotspots and coupling issues

## 🎯 Project Goals

Visualize code repositories to understand:
- **Repository structure** - Hierarchical organization at a glance
- **File relationships** - Parent-child connections and directory ownership
- **Code distribution** - File sizes mapped to lines of code
- **Recent activity** - See which files were recently modified
- **Team ownership** - Who last touched each file
- **File coupling** - Which files change together in commits

## ✨ Current Features

### Core Visualization
- **Solar System Layout** - Directories as planets, files as moons orbiting in 360° rings
- **Hierarchical Focus Mode** - Drill down into directories while maintaining context
- **Adaptive Sizing** - File sphere size represents lines of code, directories sized by total LOC
- **Smart Spacing** - Automatic layout prevents overlap using square-root scaling

### Interactive Exploration
- **Orbit Controls** - Left-click drag to rotate, right-click to pan, scroll to zoom
- **Click Navigation** - Click directories to focus, click again to navigate back up
- **Hover Highlighting** - Highlights files/directories and their ancestors on hover
- **Smooth Camera** - Stable camera framing without disorienting resets

### Git Metadata Visualization

#### Multiple Color Modes

Visualize the same codebase through different analytical lenses:

1. **File Type** (default) - 50+ file extensions with semantic color grouping
2. **Last Modified** - Adaptive time buckets showing recent changes
   - Active repos: 7 time intervals (last week → 1-2 years)
   - Stale repos: Percentile-based intervals with year ranges
3. **Author** - Consistent hash-based colors per contributor
4. **Churn (Lifetime Commits)** - Heatmap showing frequently modified files
5. **Contributors (Lifetime)** - Number of unique contributors per file
6. **File Age** - When files were first created (new → legacy)
7. **Recent Activity (90 days)** - Lines changed in recent window
8. **Code Stability** - Average lines changed per commit (stable → volatile)
9. **Recency** - Days since last modification (hot → cold)
10. **Lines of Code** - File size distribution with percentile-based buckets (small → large)
11. **Coupling Clusters** - Files grouped by temporal coupling (change together)

![Churn Mode on React Repository](docs/images/churn-mode-react.png)
*React repository (6,784 files) colored by commit frequency - red spheres indicate high-churn hotspots that may need refactoring*

<details>
<summary>📸 More Color Mode Examples</summary>

![Recent Activity Mode](docs/images/activity-mode-cbioportal.png)
*cBioPortal repository with Recent Activity (90 days) coloring - shows which files have been actively developed*

![Last Modified Mode](docs/images/lastmod-mode-cbioportal.png)
*Same cBioPortal repository with Last Modified (Relative) coloring - reveals code age distribution from newest (green) to legacy (red)*

</details>

#### Intelligent Directory Coloring
- Directories show the **dominant color** of their files based on file count
- Works for all color modes (not just file type)
- Recursive aggregation - includes all nested files
- Updates when switching color modes

#### Commit Siblings Highlighting
- Click any file with "Highlight Commit" enabled
- See all files changed in the same commit (at HEAD)
- Dramatic visual highlighting with bright yellow glow
- Connection lines from highlighted files to parent directories
- Toggle to clear highlighting

#### Coupling Cluster Analysis
- **Temporal coupling detection** - Files that frequently change together
- **3D floating cards** - Hover over clustered files to see cluster details
- **Scrollable file lists** - View all files in each coupling cluster
- **Color-coded visualization** - Each cluster gets a unique color

### Timeline V2 - Repository Evolution Playback

Watch your repository evolve commit-by-commit:

- **Full commit history** - Process all commits, not just HEAD
- **VCR controls** - Play, pause, step forward/backward through history
- **Live metrics** - Repository stats update as you navigate commits
- **Commit details** - See file changes (`Files: +N ~N -N`), LOC changes, merge commits
- **Color-coded highlights** - Green connection lines for additions, orange for modifications
- **Adaptive speed** - Playback from 1x to 1000x speed
- **Delta reconstruction** - Gource-style visualization rebuilding the tree at each commit

### UI Features
- **Live Repository Stats Panel** - File count, LOC, directory count, max depth, top 5 languages (updates in Timeline V2)
- **Dynamic Legend** - Updates based on color mode (file types, time ranges, or authors)
- **Info Panel** - Click files/directories to see detailed metadata
- **Repository Switcher** - Load different analyzed repos without page reload
- **Label Toggle** - "Always On" or "Hover Only" for directory labels
- **Tooltips** - Quick stats on hover
- **Collapsible Panels** - Click headers to expand/collapse

## 📋 Requirements

- **Node.js** ≥ 18.0
- **npm** ≥ 9.0
- **Git** (for repository analysis)
- **Modern browser** with WebGL support (Chrome, Firefox, Safari, Edge)

**Tested On:**
- macOS 13+ (Apple Silicon & Intel)
- Linux (Ubuntu 22.04+)
- Windows 10/11 (WSL2 recommended)

## 🚀 Quick Start

### 1. Install

```bash
npm install        # Installs all packages via npm workspaces
```

### 2. Start the App

```bash
npm run dev        # Starts viewer + API in parallel via Turborepo
```

Open http://localhost:3000

### 3. Analyze a Repository

Use the **Analyze** panel in the viewer UI:
1. Enter a local path (`/path/to/your/repo`) or a GitHub URL
2. Select a processing mode (HEAD snapshot, Timeline V1/V2, or Coupling)
3. Click **Analyze** — progress streams in real-time via SSE
4. When complete, the visualization loads automatically

The API runs the processor as a library and writes output directly to the viewer's data directory — no manual file copying needed.

**Alternatively**, you can use the CLI:

```bash
cd processor && npm run dev -- /path/to/your/repo           # HEAD snapshot
cd processor && npm run dev -- /path/to/your/repo --timeline    # Timeline V1
cd processor && npm run dev -- /path/to/your/repo --full-delta  # Timeline V2
cd processor && npm run coupling -- /path/to/your/repo          # Coupling analysis
cp processor/output/*.json viewer/public/data/                  # Copy to viewer
```

**Example repositories tested:**
- Gource (120 files, 28K LOC)
- React (6,784 files, 918K LOC)

### 4. Explore Your Codebase

**Mouse Controls:**
- **Left-click + drag** - Rotate camera around the visualization
- **Right-click + drag** - Pan the camera
- **Scroll wheel** - Zoom in/out
- **Click file/directory** - View details and drill down into directories

**UI Controls:**
- **Color Mode dropdown** - 11 visualization modes including Lines of Code and Coupling Clusters
- **Hide generated files** - Filter out build artifacts, minified files, and dependencies (dist/, build/, node_modules/, *.min.js, etc.)
- **Labels toggle** - Toggle directory labels between Always On and Hover Only
- **Repository selector** - Switch between different analyzed repositories
- **Highlight Commit** - Toggle commit siblings highlighting mode
- **Panel headers** - Click to collapse/expand Stats and Legend panels
- **Legend filtering** - Multi-select filtering by clicking legend items (works with all color modes)

## 📁 Project Structure

```
codecohesion/
├── processor/              # Repository analyzer
│   ├── src/
│   │   ├── analyze.ts      # Git repository scanner with metadata collection
│   │   └── types.ts        # Shared data structures
│   └── output/             # Generated JSON files
│
├── viewer/                 # 3D visualization
│   ├── src/
│   │   ├── main.ts                # Entry point and UI logic
│   │   ├── TreeVisualizer.ts      # Core 3D rendering with Three.js
│   │   ├── colorModeManager.ts    # Color mode logic (fileType, lastModified, author)
│   │   ├── colorScheme.ts         # File extension color mappings
│   │   └── types.ts               # Type definitions
│   ├── public/data/               # Analyzed repository data files
│   └── index.html                 # Main UI layout
│
├── docs/
│   ├── images/                    # README screenshots
│   └── gource-reference/          # Learnings from studying Gource
│
├── PROGRESS.md                    # Detailed development history
├── CONTRIBUTING.md                # Guidelines for adding new features
└── README.md                      # This file
```

## 🎨 Design Decisions

### Solar System Metaphor
Directories are planets, files are moons. This provides:
- Clear visual ownership (files orbit their parent directory)
- Natural scaling (any number of children can orbit in a full 360° ring)
- Intuitive navigation (zoom into planets to see their moons)

### Hierarchical Focus Mode
Instead of showing the entire tree at once (which creates visual chaos), the system shows:
- **Initial view:** Root + first-level directories (overview)
- **Focused view:** Selected directory + its children + full ancestor chain
- **Context preservation:** Always see where you are in the hierarchy

### Adaptive Color Modes
Rather than hard-coded time intervals, the Last Modified mode adapts:
- **Active repos** (80% files changed in last 90 days): Fine-grained intervals
- **Stale repos** (80% files older than 90 days): Percentile-based buckets showing actual year ranges

### Radial Layout Algorithm
- Full 360° circles (no angular subdivision constraints)
- Orbit radius = 6 + sqrt(childCount) × 2.5 (prevents overlap while keeping files close)
- Vertical spacing = 12 units (clear parent-child relationship)
- Bounding box calculation for automatic camera framing

## 🛣️ Roadmap

### ✅ Completed Features

**Slices 1-2: Core Visualization**
- Repository structure visualization with solar system layout
- File type, author, last modified color modes
- Interactive navigation and focus mode
- Commit siblings highlighting

**Slices 3-5: Advanced Metrics**
- 11 color modes: File Type, Last Modified, Author, Churn, Contributors, File Age, Recent Activity, Stability, Recency, **Lines of Code**, **Coupling Clusters**
- Adaptive percentile-based coloring for repository-specific distributions
- **Intelligent directory coloring** - Shows dominant file color by count, works for all modes
- Legend-based multi-select filtering

**Slices 6-8: Timeline & Evolution**
- **Timeline V2** - Full commit history playback with delta reconstruction
- Live repository stats updating per commit
- Color-coded file change highlights (green for adds, orange for modifications)
- VCR-style playback controls with variable speed

**Slice 9: Coupling Analysis**
- **Temporal coupling detection** - Identifies files that change together
- **3D floating cluster cards** - Interactive details with scrollable file lists
- **Louvain clustering algorithm** - Groups files by change patterns

### 🚧 In Progress

**Polish & Documentation**
- Performance optimization for 10K+ file repositories
- Video demonstrations
- Accessibility improvements

### 📋 Planned Features

**Slice 9-10: Advanced Analysis**
- Temporal coupling detection (files that change together)
- Complexity heatmap integration (cyclomatic complexity)
- Hotspot analysis (complexity × churn)
- Team ownership and knowledge distribution visualization
- Architecture drift detection
- Shareable reports and exports

> **📘 For detailed DDD analysis plans** including bounded context detection, ubiquitous language analysis, and vocabulary clustering, see **[DDD-VISION.md](DDD-VISION.md)**

## 🔧 Technology Stack

**Processor:**
- TypeScript
- Node.js
- simple-git (Git integration)

**Viewer:**
- TypeScript
- Three.js (3D rendering)
- CSS2DRenderer (floating labels)
- OrbitControls (camera controls)
- Vite (build tool with hot-reload)

**Future Additions:**
- lizard (cyclomatic complexity analysis)
- D3.js (charts and timeline UI)

## 📊 Performance

**Tested Repositories:**
- **Gource** (120 files, 28K LOC): Loads in <500ms, 60fps interaction
- **React** (6,784 files, 918K LOC): Loads in ~2s, smooth 60fps rendering
- **Timeline V2** (988 commits): Keyframe generation in ~100ms, smooth playback
- **Hot-reload:** Works reliably during development
- **Repository switching:** No page reload required

## 🧑‍💻 Development

### Running the Full System Locally

This is a monorepo managed by npm workspaces and Turborepo. A single install at the root handles all packages.

#### Step 1: Install

```bash
npm install        # Installs all packages (processor, viewer, api, shared-types, cli)
```

#### Step 2: Start All Services

```bash
npm run dev        # Starts viewer + API in parallel via Turborepo
```

Open http://localhost:3000. Use the **Analyze** panel in the viewer to process repositories — the API runs the processor as a library and writes output directly to the viewer's data directory.

Or start individual services:

```bash
cd viewer && npm run dev   # Frontend at http://localhost:3000
cd api && npm run dev      # API at http://localhost:3001
```

See the [API README](api/README.md) for endpoints and usage.

#### Processor CLI (Alternative)

You can also run the processor directly from the command line:

```bash
cd processor && npm run dev -- /path/to/your/repo              # Static HEAD snapshot
cd processor && npm run dev -- /path/to/your/repo --timeline   # Timeline with evolution data
cd processor && npm run dev -- /path/to/your/repo --full-delta # Full commit-by-commit history (Timeline V2)
cd processor && npm run coupling -- /path/to/your/repo         # Temporal coupling analysis
```

Output goes to `processor/output/`. Copy to the viewer with `cp processor/output/*.json viewer/public/data/`.

### Running Tests

```bash
npm test                           # All packages via Turborepo (recommended)

# Or run per-package:
cd viewer && npm test              # Vitest, jsdom environment
cd api && npm test -- --run        # Vitest (default is watch mode)
cd processor && npm test           # Vitest
```

### Quality Checks

```bash
npm run lint                       # All packages via Turborepo

# Or run per-package:
cd viewer && npm run lint          # ESLint
cd api && npm run lint
cd processor && npm run lint

cd viewer && npm run test:coverage # Coverage thresholds on src/lib/
```

### Adding New Color Modes

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:
- Adding new git metadata collection
- Implementing new color modes
- Testing checklist
- Common pitfalls

### Documentation

- **PROGRESS.md** - Comprehensive development history and lessons learned
- **CONTRIBUTING.md** - Guidelines for extending the application
- **docs/gource-reference/** - Architectural insights from Gource study

## 🔧 Troubleshooting

### Common Issues

**"Port 3000 already in use"**
```bash
# Vite will automatically try 3001, 3002, etc.
# Or manually kill the process:
lsof -ti:3000 | xargs kill
```

**"Module not found" errors**
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install
```

**Viewer shows empty/broken visualization**
- Check browser console for errors
- Verify JSON file is in `viewer/public/data/`
- Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)
- Delete any `.js` files in `viewer/src/` (should only be `.ts`)

**Repository analysis crashes on large repos**
```bash
# Large repos may need more memory
NODE_OPTIONS=--max-old-space-size=4096 npm run dev -- /path/to/repo
```

**Stale compiled `.js` files causing issues**
```bash
# Remove compiled artifacts
cd viewer && rm src/*.js
```

**Timeline V2 changes not appearing**
- Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
- Delete `viewer/dist/` directory
- Restart Vite dev server

## 📈 Testing Notes

**Current Test Coverage:**
- Solar system layout with various tree depths
- Hierarchical focus mode navigation
- All 11 color modes with adaptive percentile-based coloring
- Directory color aggregation (dominant file color by count)
- Commit siblings highlighting
- Timeline V2 playback (forward, backward, speed control)
- Label visibility in Always On and Hover modes
- Repository switching
- Collapsible UI panels
- Hover highlighting and tooltips
- Coupling cluster visualization with floating detail cards
- Legend-based multi-select filtering

**Automated Tests:**
- 354 passing unit tests across all three packages (viewer, api, processor)
- Architecture fitness tests enforcing file size and dependency invariants
- Directory color aggregation tests with real React repository data
- Tree utilities, data loading, and type shape validation

**Known Limitations:**
- Very large repositories (10K+ files) not yet tested
- Performance with deep hierarchies (10+ levels) unknown

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development workflow
- Code style guidelines
- Testing requirements
- How to add new color modes
- Submitting pull requests

**Quick Wins for Contributors:**
- Add support for more programming languages in color scheme
- Improve color scheme accessibility (WCAG compliance)
- Optimize performance for large repos (10K+ files)
- Add export/screenshot capabilities
- Create video walkthroughs
- Add automated tests

## 📄 License

MIT

## 🙏 Acknowledgments

- **Gource** - Inspiration for real-time repository visualization
- **CodeScene** - Inspiration for code quality metrics focus
- **Three.js** - Excellent 3D rendering library
- **React team** - For providing a large, real-world test repository

---

**Repository:** https://github.com/virtualgenius/codecohesion

*Last Updated: 2026-03-07*
*Status: Coupling Analysis Complete | Slices 1-9 ✅ | 11 Color Modes | 354 Tests Passing*
*Next: main.ts Extraction & Advanced DDD Analysis*
