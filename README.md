# VS Code Code Counter - 🎨 **Emoji Customization**: Choose ANY emoji for your line count thresholds
- 📝 **Glob Pattern Manager**: Visual interface for managing file exclusion patterns

A Visual Studio Code extension that counts lines of code in your project and generates beautiful HTML reports with XML data sources. Features intelligent file explorer integration with colored indicators, performance-optimized caching, and a visual color picker for customizing line count thresholds.

## Backstory
A long time ago (in technology generations), someone ran a statistical test to see how many lines of code a single file could contain that a developer could eyeball and ensure working code; that number was about 127 lines. In other words, a single developer could ensure "bug-free" code by segmenting code and organizing it so that files have ~127 lines on average. It's one of those good "rules of thumb" behaviors that's learned (typically through debug hell) the hard way. That's where CodeCounter comes in. Simply, it counts lines in files, and alerts users that documents are getting too large for human consumption. It's not meant as a strict limitation for files, but is useful metadata about the file that coders/writers can use to organize their data in the best possible manner.

## Features

- 📊 **Count Lines of Code**: Analyzes all files in your workspace with smart caching
- 🔍 **Language Detection**: Automatically detects programming languages by file extensions  
- 📈 **Detailed Statistics**: Shows code lines, comment lines, and blank lines separately
- 📄 **HTML Reports**: Generates beautiful, interactive HTML reports with search functionality
- 🗂️ **XML Data Source**: Creates XML files for integration with other tools
- ⚡ **Performance Optimized**: Only recalculates on file save, not every keystroke
- 🎯 **Glob Exclusions**: Exclude files and directories using customizable glob patterns
- 🎨 **Visual Indicators**: Customizable emoji indicators next to files in explorer (🟢🟡🔴 by default)  
- 📁 **File Explorer Integration**: Non-intrusive indicators that don't interfere with Git colors
- 📋 **Status Bar Integration**: Live line counts for active files with hover tooltips
- 🎛️ **Simple Configuration**: Choose between "always show" or "hover only" modes
- 💾 **Smart Caching**: Intelligent caching system with modification time validation
- � **Visual Color Picker**: Built-in color wheel interface for customizing thresholds
- ⚙️ **Theme Integration**: Seamless integration with VS Code themes and colors

> **🎯 Design Philosophy**: This extension follows the principle that if you install it, you want its features. No need for "off" toggles - simply disable or uninstall the extension if you don't want it!

> **✨ Latest Updates**: Universal emoji support! Choose any emoji for your line count thresholds - from classic 🟢🟡🔴 to creative options like 🎯🔥💯, 📊📈📉, or ✅⚠️❌. Plus enhanced glob pattern management with real-time validation and examples.

> **🎉 What's New**: Complete settings overhaul with emoji freedom and powerful pattern management. See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

## Installation

### Development Installation

1. Clone this repository
2. Open the folder in VS Code
3. Run `npm install` to install dependencies
4. Press `F5` to launch a new Extension Development Host window

### Building and Packaging

```bash
npm run compile    # Compile TypeScript
npm run package    # Create .vsix file for distribution
```

## Usage

### Commands

- **Code Counter: Count Lines of Code** (`codeCounter.countLines`)
  - Manually trigger line counting and report generation
  - Available via Command Palette (`Ctrl+Shift+P`)

- **Code Counter: Customize Emoji Indicators** (`codeCounter.openColorSettings`)
  - Opens comprehensive settings interface featuring:
    - 🎨 **Professional Emoji Picker**: Searchable emoji selection with 1800+ options
    - 📊 **Configurable Thresholds**: Set custom line count boundaries
    - 📁 **Glob Pattern Manager**: Add/remove file exclusion patterns with validation
    - ↩️ **Reset Options**: Separate reset buttons for badges and exclusion patterns
    - 📖 **Pattern Examples**: Built-in documentation with common glob patterns

- **Code Counter: Reset Emoji Indicators to Defaults** (`codeCounter.resetColors`)
  - Instantly resets all emoji badges to default 🟢🟡🔴 scheme

### Configuration

Configure the extension through VS Code settings:

```json
{
  "codeCounter.excludePatterns": [
    "**/node_modules/**",
    "**/out/**",
    "**/dist/**",
    "**/.git/**"
  ],
  "codeCounter.outputDirectory": "./reports",
  "codeCounter.autoGenerate": true,
  "codeCounter.showLineCountsInExplorer": "hover",
  "codeCounter.showLineCountsInTabs": "hover",
  "codeCounter.cacheLineCounts": true,
  "codeCounter.lineThresholds.midThreshold": 300,
  "codeCounter.lineThresholds.highThreshold": 1000,
  "codeCounter.emojis.normal": "🟢",
  "codeCounter.emojis.warning": "🟡",
  "codeCounter.emojis.danger": "🔴"
}
```

#### Settings

- **`codeCounter.excludePatterns`**: Array of glob patterns for files to exclude
- **`codeCounter.outputDirectory`**: Directory where reports will be generated
- **`codeCounter.autoGenerate`**: Whether to automatically generate reports on file save
- **`codeCounter.showLineCountsInExplorer`**: Display mode for file explorer (`always` | `hover`)
- **`codeCounter.showLineCountsInTabs`**: Display mode for status bar (`always` | `hover`)  
- **`codeCounter.cacheLineCounts`**: Enable intelligent caching for performance

- **`codeCounter.lineThresholds.midThreshold`**: First threshold - Normal below, Warning above (default: 300 lines)
- **`codeCounter.lineThresholds.highThreshold`**: Second threshold - Warning below, Danger at/above (default: 1000 lines)
- **`codeCounter.emojis.normal`**: Emoji for files below warning threshold (default: 🟢, accepts any emoji)
- **`codeCounter.emojis.warning`**: Emoji for files above warning threshold (default: 🟡, accepts any emoji)
- **`codeCounter.emojis.danger`**: Emoji for files above danger threshold (default: 🔴, accepts any emoji)

### UI Integration

#### File Explorer Integration
- **Emoji Badge Indicators**: Visual badges (🟢🟡🔴) that don't interfere with Git status colors
- **Simple Tooltips**: Hover shows "Lines: X" for quick reference
- **Non-Intrusive Design**: File names keep their normal colors (green for new, red for modified, etc.)
- **Always/Hover Modes**: Choose between always visible or hover-only display

#### Status Bar Integration  
- **Live Display**: Shows line count for active file with badge text
- **Smart Updates**: Only recalculates on file save, not every keystroke  
- **Hover Tooltips**: Simple "Lines: X" format for consistency
- **Always/Hover Modes**: Choose between persistent or hover-only display

#### Visual Badge Coding System
- **🟢 Green Circle**: Files below the mid threshold (default: < 300 lines)
- **🟡 Yellow Circle**: Files between mid and high threshold (default: 300-999 lines)  
- **🔴 Red Circle**: Files at or above the high threshold (default: ≥ 1000 lines)

#### Smart Emoji Badge Selection
The extension provides comprehensive emoji customization options:
- **Universal Emoji Support**: Choose ANY emoji for your line count thresholds
- **Professional Emoji Picker**: Search through 1800+ emojis by name and aliases
- **Searchable Database**: Find emojis by typing "smile", "heart", "circle", "warning", etc.
- **Category Organization**: Browse emojis by category (Smileys, Symbols, Objects, etc.)
- **Examples**:
  - Traditional: 🟢 🟡 🔴 (traffic light system)
  - Creative: 🎯 🔥 💯 (target/performance theme)
  - Professional: ✅ ⚠️ ❌ (status indicators)
  - Fun: 😊 😐 😱 (emotion-based)
- **Unified Configuration**: Set both emoji badges AND thresholds in one interface
- **Flexible Thresholds**: Configure exact line count boundaries for each badge level
- **WebView Interface**: Professional emoji picker with search and live preview

#### Glob Pattern Management
Manage file exclusion patterns through the enhanced settings interface:
- **📁 Visual Pattern Manager**: Add/remove glob patterns with intuitive interface
- **✅ Pattern Validation**: Real-time validation prevents invalid glob patterns  
- **📖 Built-in Examples**: Common patterns like `**/node_modules/**`, `**/*.tmp`
- **🔄 Easy Reset**: Restore default exclusion patterns with one click
- **🎯 Smart Defaults**: Pre-configured to exclude common build artifacts and dependencies
- **💡 Interactive Help**: Expandable examples section with pattern explanations
- **⌨️ Keyboard Support**: Press Enter to add patterns quickly

#### Smart Performance Features
- **Save-Based Updates**: Only recalculates when files are saved, not on every keystroke
- **Selective File Watching**: Only monitors relevant code files, ignores binaries and build outputs
- **Intelligent Caching**: Modification time-based cache invalidation for accuracy
- **Efficient Event Handling**: Debounced file system events prevent performance loops
- **Memory Management**: Proper disposables prevent memory leaks
- **Battery Friendly**: Minimal background processing for laptop users

### Output Files

The extension generates two files in the configured output directory:

1. **`code-counter-report.html`**: Interactive HTML report with charts and tables
2. **`code-counter-data.xml`**: XML data source for integration with other tools

### Supported Languages

The extension automatically detects and counts lines for:

- **Web**: JavaScript, TypeScript, HTML, CSS, SCSS, Sass, Less
- **System**: C, C++, C#, Java, Go, Rust
- **Scripting**: Python, Ruby, PHP, Shell, Batch, PowerShell
- **Mobile**: Swift, Kotlin, Scala
- **Data**: JSON, XML, YAML, Markdown
- **And more**: Any text file with configurable comment patterns

## Report Features

The generated HTML report includes:

- **Summary Statistics**: Total files, lines, languages, and averages
- **Language Breakdown**: Files and lines per programming language
- **File Details**: Searchable table with individual file statistics
- **Interactive Elements**: Search, filtering, and responsive design

## Development

### Project Structure

```
├── src/
│   ├── extension.ts                    # Main extension entry point with color picker
│   ├── commands/
│   │   └── countLines.ts               # Count lines command implementation
│   ├── providers/
│   │   ├── fileWatcher.ts              # Performance-optimized file system watcher
│   │   ├── fileExplorerDecorator.ts    # Colored bullet points in file explorer
│   │   └── editorTabDecorator.ts       # Status bar integration for active files
│   ├── services/
│   │   ├── lineCounter.ts              # Core line counting logic
│   │   ├── xmlGenerator.ts             # XML data generation
│   │   ├── htmlGenerator.ts            # HTML report generation  
│   │   ├── lineCountCache.ts           # Intelligent caching system
│   │   └── lineThresholdservice.ts    # Color classification and theming
│   ├── utils/
│   │   ├── fileUtils.ts                # File system utilities
│   │   └── globUtils.ts                # Glob pattern matching
│   ├── types/
│   │   └── index.ts                    # TypeScript type definitions
│   └── test/
│       └── suite/                      # Comprehensive test suite (16 tests)
├── templates/
│   └── report.html               # HTML report template
├── package.json                  # Extension manifest and dependencies
└── tsconfig.json                 # TypeScript configuration
```

### Building

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Watch mode for development
npm run watch

# Lint code
npm run lint
```

### Testing

The extension uses Mocha with Chai assertions and `@vscode/test-electron` for VS Code API testing:

```bash
npm test
```

Test files are located in `src/test/suite/` and cover:
- Line counting accuracy across multiple languages
- Language detection and file classification  
- File exclusion patterns and glob matching
- Caching system with modification time validation
- Color threshold classification logic
- VS Code API integration and provider functionality
- **All 16 tests passing** with comprehensive coverage

### Extension API

The extension exposes its functionality through the VS Code Extension API:

```typescript
// Activate the extension
import * as vscode from 'vscode';

// Register command
vscode.commands.registerCommand('codeCounter.countLines', () => {
    // Trigger line counting
});
```

## Configuration Examples

### Exclude Node.js Project Files

```json
{
  "codeCounter.excludePatterns": [
    "**/node_modules/**",
    "**/build/**",
    "**/dist/**",
    "**/*.log",
    "**/.git/**"
  ]
}
```

### Exclude Python Virtual Environments

```json
{
  "codeCounter.excludePatterns": [
    "**/venv/**",
    "**/__pycache__/**",
    "**/*.pyc",
    "**/dist/**",
    "**/.git/**"
  ]
}
```

### Custom Output Location

```json
{
  "codeCounter.outputDirectory": "./docs/stats"
}
```

### Customize Color Thresholds

```json
{
  "codeCounter.lineThresholds.enabled": true,
  "codeCounter.lineThresholds.midThreshold": 500,
  "codeCounter.lineThresholds.highThreshold": 2000
}
```

### Custom Colors with Color Picker

```json
{
  "codeCounter.colors.normal": "#00FF00",
  "codeCounter.colors.warning": "#FF8C00",
  "codeCounter.colors.danger": "#8B0000"
}
```



### Enhanced Visual Color & Threshold Picker
1. **Via Command Palette**: `Ctrl+Shift+P` → "Code Counter: Customize Line Count Colors"
2. **Unified Interface**: Configure both colors AND thresholds in one professional panel
3. **Live Preview**: See changes in real-time with dynamic sample line counts
4. **HTML5 Color Wheel**: Full spectrum color selection with hex values
5. **Threshold Inputs**: Set exact line count thresholds with numeric inputs
6. **Smart Logic**: Green for "less than X", Yellow for "less than Y", Red for "≥Y"
7. **One-Click Reset**: Reset all colors and thresholds to defaults
8. **Auto-Save**: All changes apply immediately to your workspace

## Performance Highlights

### ⚡ Optimized for Real-World Usage

- **Save-Triggered Updates**: Line counts only recalculate when you save files, not on every keystroke
- **Smart File Watching**: Monitors only relevant code files (`.js`, `.ts`, `.py`, etc.), ignores binaries and build outputs
- **Intelligent Caching**: Uses file modification times to determine when recalculation is needed
- **Debounced Events**: File system events are properly debounced to prevent performance loops
- **Minimal CPU Impact**: Extension runs efficiently in the background without slowing down VS Code
- **Memory Efficient**: Proper disposal of resources prevents memory leaks during development

### 🎯 User Experience Focused

- **Non-Intrusive Indicators**: Colored bullets don't interfere with Git status colors in file explorer
- **Consistent Tooltips**: Simple "Lines: X" format across all UI elements for clarity
- **Visual Color Picker**: Professional color customization interface with live preview
- **Instant Updates**: Configuration changes apply immediately without requiring restart
- **Theme Integration**: Automatically adapts to your VS Code theme and color preferences

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features
- Update documentation
- Use ESLint configuration provided
- Follow the existing code structure

## License

MIT License - see LICENSE file for details.
