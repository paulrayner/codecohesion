# CodeCohesion

3D code visualization tool for analyzing structure, cohesion, and architectural evolution.

## Architecture

Monorepo with three components:

| Component | Path | Tech | Purpose |
|-----------|------|------|---------|
| `viewer/` | React app | TypeScript, Three.js | 3D visualization frontend |
| `api/` | API server | Node.js | Serves processed data |
| `processor/` | CLI tool | Node.js | Parses repos, generates visualization data |

## Development

```bash
# Viewer (frontend)
cd viewer && npm install && npm run dev

# API
cd api && npm install && npm start

# Processor
cd processor && npm install && node index.js <repo-path>
```

## Links

- [Demo](https://codecohesion.virtualgenius.com)
- [GitHub](https://github.com/virtualgenius/codecohesion)

## Key Files

- `DDD-VISION.md` - DDD-oriented feature roadmap (ubiquitous language analysis, bounded context detection)
- `PROGRESS.md` - Development progress tracking
- `CHANGELOG.md` - Release history
