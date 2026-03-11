# Color Scheme Design

## Design Principles

1. **Distinct hues** - Each file type gets a unique, recognizable color
2. **No gray overload** - Gray reserved for directories and documentation only
3. **Semantic grouping** - Related file types use similar color families
4. **High contrast** - All colors distinguishable in 3D space
5. **Comprehensive coverage** - Common file types all have explicit colors

## Color Categories

### Source Code (Bright, Saturated Colors)

| Extension | Color | Hex | Rationale |
|-----------|-------|-----|-----------|
| `.cpp` | Bright Pink/Magenta | `#f34b7d` | Distinct from all other languages |
| `.h` | Brown/Orange | `#b07219` | Complements C++, clearly related |
| `.c` | Coral Red | `#ff6b6b` | Related to C++ but distinct |
| `.py` | Python Blue | `#3776ab` | Official Python color |
| `.js` | JavaScript Yellow | `#f7df1e` | Official JavaScript color |
| `.ts` | TypeScript Blue | `#3178c6` | Official TypeScript color |
| `.jsx` | React Cyan | `#61dafb` | Official React color |
| `.tsx` | React Cyan | `#61dafb` | Official React color |
| `.java` | Java Orange | `#f89820` | Official Java color |
| `.go` | Go Cyan | `#00add8` | Official Go color |
| `.rs` | Rust Orange | `#dea584` | Official Rust color |
| `.rb` | Ruby Red | `#cc342d` | Official Ruby color |
| `.php` | PHP Purple | `#777bb4` | Official PHP color |
| `.pl` | Perl Teal | `#0298c3` | Distinct from other blues |

### Markup & Styling

| Extension | Color | Hex | Rationale |
|-----------|-------|-----|-----------|
| `.html` | HTML Orange-Red | `#e34c26` | Official HTML color |
| `.css` | CSS Blue | `#264de4` | Official CSS color |
| `.md` | Markdown Dark Blue | `#083fa1` | Associated with documentation |

### Shaders & Graphics Code

| Extension | Color | Hex | Rationale |
|-----------|-------|-----|-----------|
| `.frag` | Steel Blue | `#5686a5` | Graphics-related, cool tone |
| `.vert` | Steel Blue | `#5686a5` | Same as fragment shaders (paired) |
| `.style` | Purple | `#9b59b6` | Style definition, distinct from CSS |

### Build System & Configuration (Warm Colors)

| Extension | Color | Hex | Rationale |
|-----------|-------|-----|-----------|
| `.am` | Orange | `#e67e22` | Automake - build system |
| `.ac` | Orange | `#e67e22` | Autoconf - build system |
| `.m4` | Orange | `#e67e22` | M4 macros - build system |
| `.pro` | Qt Green | `#41cd52` | Qt project files |
| `.sh` | Lime Green | `#89e051` | Shell scripts - executable |
| `.cmd` | Lime Green | `#89e051` | Windows batch - executable |
| `.yml` | YAML Red | `#cb171e` | Config files, distinctive |
| `no-extension` | Amber | `#f39c12` | Makefile, Dockerfile, etc. |

### Data & Documentation

| Extension | Color | Hex | Rationale |
|-----------|-------|-----|-----------|
| `.json` | Dark Gray | `#292929` | Data format, subdued |
| `.txt` | Light Gray | `#95a5a6` | Plain text, neutral |
| `.log` | Light Gray | `#95a5a6` | Log files, neutral |
| `.conf` | Amber | `#f39c12` | Config files |

### Assets

| Extension | Color | Hex | Rationale |
|-----------|-------|-----|-----------|
| `.png` | Magenta | `#ff00ff` | Image files, bright and noticeable |
| `.jpg` | Magenta | `#ff00ff` | Image files |
| `.bmp` | Magenta | `#ff00ff` | Image files |
| `.tga` | Magenta | `#ff00ff` | Image files |
| `.xcf` | Magenta | `#ff00ff` | GIMP files, image-related |
| `.ttf` | Dark Slate | `#34495e` | Font files, distinct from images |

### Directories

| Type | Color | Hex | Rationale |
|------|-------|-----|-----------|
| Directory | Medium Gray | `#7f8c8d` | Subdued, structural element |

## Coverage Analysis

For Gource repository (120 files):
- **Source code**: 64 files (C++, C, headers, Python)
- **Build system**: 13 files (automake, autoconf, m4, shell)
- **Shaders**: 6 files (GLSL)
- **Images**: 9 files (PNG, BMP, TGA, XCF)
- **Config/other**: 28 files (no-extension, yml, txt, etc.)

All file types now have explicit colors - **zero "unknown" files**.

## Color Distribution

- **Warm colors** (red, orange, yellow): Build systems, Java, JavaScript
- **Cool colors** (blue, cyan, teal): Python, TypeScript, shaders, markdown
- **Accent colors** (pink, magenta, purple): C++, images, styles
- **Neutral colors** (gray): Directories, text files, JSON

This distribution ensures visual balance and semantic grouping.
