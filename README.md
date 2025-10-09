# VS Code Code Counter

A Visual Studio Code extension that counts lines of code in your project and generates beautiful HTML reports with XML data sources. The extension automatically updates reports when files are saved and supports glob pattern exclusions.

## Features

- 📊 **Count Lines of Code**: Analyzes all files in your workspace
- 🔍 **Language Detection**: Automatically detects programming languages by file extensions
- 📈 **Detailed Statistics**: Shows code lines, comment lines, and blank lines separately
- 📄 **HTML Reports**: Generates beautiful, interactive HTML reports
- 🗂️ **XML Data Source**: Creates XML files for integration with other tools
- ⚡ **Auto-Generate**: Automatically updates reports when files are saved
- 🎯 **Glob Exclusions**: Exclude files and directories using glob patterns
- 🔍 **Search**: Built-in search functionality in the HTML report
- 📁 **File Explorer Integration**: Shows line counts next to filenames in explorer
- 📋 **Editor Tab Integration**: Displays line counts in status bar for active files
- 🎛️ **Configurable Display**: Toggle between always show, hover, or off modes
- 💾 **Smart Caching**: Efficient caching system for fast line count retrieval
- 🎨 **Color Coding**: Configurable color thresholds (green/yellow/red) based on line counts
- ⚙️ **Theme Integration**: Uses VS Code theme colors for consistent visual experience

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

- **Code Counter: Toggle Line Counts in Explorer** (`codeCounter.toggleExplorerLineCounts`)
  - Cycles through: always → hover → off → always
  - Shows line counts next to filenames in file explorer

- **Code Counter: Toggle Line Counts in Tabs** (`codeCounter.toggleTabLineCounts`)
  - Cycles through: always → hover → off → always  
  - Shows line counts in status bar for the active editor

- **Code Counter: Customize Line Count Colors** (`codeCounter.openColorSettings`)
  - Opens VS Code settings with color picker interface
  - Customize green, yellow, and red colors using color wheel

- **Code Counter: Reset Colors to Defaults** (`codeCounter.resetColors`)
  - Instantly resets all colors to default green/yellow/red scheme

- **Code Counter: Toggle Color Coding for Line Counts** (`codeCounter.toggleColorThresholds`)
  - Enables/disables color coding based on configurable thresholds
  - Green: below warning threshold, Yellow: warning level, Red: danger level

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
  "codeCounter.colorThresholds.enabled": true,
  "codeCounter.colorThresholds.yellowThreshold": 300,
  "codeCounter.colorThresholds.redThreshold": 1000,
  "codeCounter.colors.normal": "#4CAF50",
  "codeCounter.colors.warning": "#FFC107", 
  "codeCounter.colors.danger": "#F44336"
}
```

#### Settings

- **`codeCounter.excludePatterns`**: Array of glob patterns for files to exclude
- **`codeCounter.outputDirectory`**: Directory where reports will be generated
- **`codeCounter.autoGenerate`**: Whether to automatically generate reports on file save
- **`codeCounter.showLineCountsInExplorer`**: Display mode for file explorer (`always` | `hover` | `off`)
- **`codeCounter.showLineCountsInTabs`**: Display mode for editor tabs (`always` | `hover` | `off`)  
- **`codeCounter.cacheLineCounts`**: Enable intelligent caching for performance
- **`codeCounter.colorThresholds.enabled`**: Enable/disable color coding for line counts
- **`codeCounter.colorThresholds.yellowThreshold`**: Warning threshold (default: 300 lines)
- **`codeCounter.colorThresholds.redThreshold`**: Danger threshold (default: 1000 lines)
- **`codeCounter.colors.normal`**: Custom color for files below warning threshold (hex color)
- **`codeCounter.colors.warning`**: Custom color for files above warning threshold (hex color)
- **`codeCounter.colors.danger`**: Custom color for files above danger threshold (hex color)

### UI Integration

#### File Explorer Integration
- **Always Mode**: Line counts permanently displayed next to filenames (e.g., `file.js (42L)`)
- **Hover Mode**: Detailed tooltips on hover showing total, code, comment, and blank lines
- **Off Mode**: No line count display in explorer

#### Editor Tab Integration  
- **Always Mode**: Status bar shows line count for active file (e.g., `42 lines`)
- **Hover Mode**: Status bar shows "Lines" with detailed tooltip on hover
- **Off Mode**: No line count display in status bar

#### Color Coding System
- **🟢 Green**: Files below the warning threshold (default: < 300 lines)
- **🟡 Yellow**: Files above warning but below danger threshold (default: 300-999 lines)  
- **🔴 Red**: Files above the danger threshold (default: ≥ 1000 lines)
- **Configurable Thresholds**: Customize warning and danger levels per your needs
- **Custom Colors**: Use VS Code's built-in color picker to choose any colors
- **Theme Integration**: Automatic fallback to VS Code theme colors when using defaults

#### Smart Features
- **Intelligent Caching**: Line counts are cached and only recalculated when files change
- **Performance Optimized**: Skips binary files and excluded directories automatically
- **File Type Awareness**: Shows appropriate counts for text-based files only
- **Threshold Validation**: Ensures danger threshold is always higher than warning threshold

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
│   ├── extension.ts              # Main extension entry point
│   ├── commands/
│   │   └── countLines.ts         # Count lines command implementation
│   ├── providers/
│   │   └── fileWatcher.ts        # File system watcher for auto-generation
│   ├── services/
│   │   ├── lineCounter.ts        # Core line counting logic
│   │   ├── xmlGenerator.ts       # XML data generation
│   │   └── htmlGenerator.ts      # HTML report generation
│   ├── utils/
│   │   ├── fileUtils.ts          # File system utilities
│   │   └── globUtils.ts          # Glob pattern matching
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   └── test/
│       └── suite/                # Test files
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
- Line counting accuracy
- Language detection
- File exclusion patterns
- VS Code API integration

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
  "codeCounter.colorThresholds.enabled": true,
  "codeCounter.colorThresholds.yellowThreshold": 500,
  "codeCounter.colorThresholds.redThreshold": 2000
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

### Disable Color Coding

```json
{
  "codeCounter.colorThresholds.enabled": false
}
```

### Access Color Picker
1. **Via Command Palette**: `Ctrl+Shift+P` → "Customize Line Count Colors"
2. **Via Settings UI**: Go to Settings → Search "codeCounter.colors"  
3. **Click Color Squares**: Opens VS Code's built-in color wheel picker
4. **Reset to Defaults**: Use "Reset Colors to Defaults" command

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

## Changelog

### 0.3.0 (Latest)

- **NEW**: Custom color picker interface using VS Code's built-in color wheel
- **NEW**: Individual color configuration for normal/warning/danger states
- **NEW**: "Customize Line Count Colors" command opens settings with color pickers
- **NEW**: "Reset Colors to Defaults" command for easy color reset
- **NEW**: Intelligent color mapping for file explorer (hex to theme colors)
- **NEW**: Real-time color updates when configuration changes
- **IMPROVED**: Better color handling between status bar and file explorer
- **IMPROVED**: Enhanced color configuration with validation

### 0.2.0

- **NEW**: Color coding system for line counts (green/yellow/red)
- **NEW**: Configurable color thresholds (warning: 300, danger: 1000)
- **NEW**: VS Code theme integration for consistent colors
- **NEW**: Toggle command for color coding on/off
- **NEW**: Enhanced tooltips with threshold indicators
- **IMPROVED**: Automatic threshold validation (danger > warning)
- **IMPROVED**: Better visual feedback in both explorer and status bar

### 0.1.0

- **NEW**: File Explorer integration - line counts next to filenames
- **NEW**: Editor tab integration - line counts in status bar
- **NEW**: Toggle commands for display modes (always/hover/off)
- **NEW**: Intelligent caching system for improved performance
- **NEW**: Hover tooltips with detailed file statistics
- **IMPROVED**: Better file type detection and exclusion logic
- **IMPROVED**: Performance optimizations for large projects

### 0.0.1

- Initial release
- Basic line counting functionality  
- HTML and XML report generation
- File watcher for auto-generation
- Configurable exclusion patterns
- Multi-language support