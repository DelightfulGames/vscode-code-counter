<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

Repository: https://github.com/DelightfulGames/vscode-code-counter
Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->

# 📊 VS Code Code Counter

> **Transform your code visibility with intelligent line counting, visual indicators, and comprehensive reporting**

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/DelightfulGames/vscode-code-counter/releases)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/DelightfulGames.vscode-code-counter)](https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/DelightfulGames.vscode-code-counter)](https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.80+-007ACC.svg)](https://code.visualstudio.com/)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/DelightfulGames.vscode-code-counter)](https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![Tests](https://img.shields.io/badge/tests-261%2F261%20passing-brightgreen.svg)](#)
[![Coverage](https://img.shields.io/badge/coverage-41%25-green.svg)](#)
[![GitHub Issues](https://img.shields.io/github/issues/DelightfulGames/vscode-code-counter.svg)](https://github.com/DelightfulGames/vscode-code-counter/issues)
[![GitHub Stars](https://img.shields.io/github/stars/DelightfulGames/vscode-code-counter.svg)](https://github.com/DelightfulGames/vscode-code-counter/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/DelightfulGames/vscode-code-counter.svg)](https://github.com/DelightfulGames/vscode-code-counter/network)

## 🚀 **What Makes Code Counter Special?**
> A Visual Studio Code extension that counts lines of code in your project and generates beautiful HTML reports with XML data sources. Features intelligent file explorer integration with customizable emoji indicators, performance-optimized caching, and support for **78+ programming languages and file types**.

> **🎉 MAJOR RELEASE v1.1.0**: Revolutionary language support expansion with systematic coverage across all major programming paradigms! Now supporting 78+ languages from web development to enterprise systems. See [CHANGELOG.md](./CHANGELOG.md) for complete details.

## 📸 **See It In Action**
### Before VS Code Code Counter
```bash
📁 src/
├── service.ts
├── utils.ts 
└── 📁 components/
    └── legacy.ts
```
### After VS Code Code Counter
```bash    
📁 src/                🟨🔴 # (avg 917 lines, max 2,847 lines)
├── service.ts            🟢 # (156 lines)
├── utils.ts              🟢 # (42 lines)
└── 📁 components/     🟥🔴 # (avg 2,847 lines, max 2,847 lines)  
    └── legacy.ts         🔴 # (2,847 lines)
```

### 🎯 **Instant Visual Feedback**

[![See Code Counter in Action](https://img.youtube.com/vi/mbV8kka7yA0/maxresdefault.jpg)](https://www.youtube.com/watch?v=mbV8kka7yA0)

*▶️ Click to watch on YouTube*

### 📊 **Professional reporting tools** 

[![See Code Counter Reports](https://img.youtube.com/vi/IyIiTtnrF7M/maxresdefault.jpg)](https://www.youtube.com/watch?v=IyIiTtnrF7M)

*▶️ Click to watch on YouTube*

### 🖥️ **Standalone reports and data export**
<div style="text-align: center; font-size: 24px"><strong><a href="https://code-counter.delightful-games.com/report-demo.html">Click here for a DEMO!</a></strong></div>

## 🎯 **Perfect For**
| Role | Primary Benefit |
|---|---|
| **Software Developer** | Real-time complexity feedback during coding |
| **Solution Architect** | Project-wide code quality metrics |
| **Team Lead** | Standardized complexity indicators across team |
| **DevOps Engineer** | Automated reporting for CI/CD pipelines |
| **Technical Writer** | Code statistics for documentation |
| **Open Source Maintainer** | Contributor-friendly project insights |

## ✨ Key Highlights
- **Live Status Bar**: Current file metrics at a glance
- **Emoji Indicators**: 🟢🟡🔴 badges for instant complexity assessment
- **File Explorer Integration**: Visual cues directly in your project tree
- **Activate**: Extension activates automatically on startup

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [UI Integration](#ui-integration)
- [Contributing](#contributing)
- [License](#license)

## ✨ **Key Features**
- **🗄️ Database-Powered**: Lightning-fast SQLite database replaces scattered JSON files (10-100x performance boost)
- **📁 Organized Structure**: All extension data in clean `.vscode/code-counter/` directory with reports in `reports/` subfolder
- **🎯 Context Menu Magic**: Right-click any file/folder for instant exclusion management
- **📊 Professional Reporting**: Advanced standalone HTML reports with interactive filtering, grouping, and multiple export formats
- **🎨 Enhanced UI Controls**: Group by language/directory, advanced filtering, and export to CSV/JSON/XML
- **🔧 Directory Management**: Smart directory filtering with expand/collapse controls and hidden directory toggle
- **For Architects**: Comprehensive project analytics with minified, self-contained reports
- **For Developers**: Real-time visual feedback on code complexity with fun emoji indicators  
- **For Teams**: Standardized code metrics with professional export capabilities
- **For VS Code Enthusiasts**: Professional-grade extension with cutting-edge reporting features

## **Quick Start**
1. **Install**: Search "Code Counter" in VS Code Extensions
2. **Activate**: Extension activates automatically on startup
3. **Customize**: Press `Ctrl+Shift+P` → "CodeCounter: Customize Emoji Indicators"
4. **View**: See emoji badges (🟢🟡🔴) next to files in explorer
5. **Reports**: Run "Count Lines of Code" command for professional interactive HTML reports
6. **Export**: Use webView "Export HTML" for standalone reports with filtering and export capabilities

## 🗄️ **Database-Powered Performance**
**v1.0.0 introduces revolutionary SQLite database architecture:**
- **Lightning Fast**: 10-100x performance boost over JSON files
- **Zero Dependencies**: Pure JavaScript sql.js - no native compilation required
- **Organized Structure**: All extension data in `.vscode/code-counter/`
  - `code-counter.db` - High-performance SQLite settings database  
  - `reports/` - All your HTML/XML/JSON reports
- **Automatic Migration**: Seamlessly imports existing `.code-counter.json` files
- **Hierarchical Inheritance**: Workspace settings cascade to subdirectories

## ✨ Key Highlights
- ⚙️ **Hierarchical Workspace Settings**: Workspace/Directory-specific configurations with inheritance
- ⚙️🎨 **Emoji Customization**: Choose ANY emoji for your line count thresholds
- 📝 **Glob Pattern Manager**: Visual interface for managing file exclusion patterns
- ⌨️ **Language Support**: 78+ programming languages and file types
- 🔍 **Smart Search**: Find emojis by typing "smile", "heart", "circle", etc.
- 🧠 **Smart Exclusions**: Configurable patterns (node_modules, build files, etc.)
- ⚡ **Performance First**: Intelligent caching and real-time updates
- 📊 **Professional Reports**: Interactive HTML reports with grouping, filtering, and multi-format exports
- 🎛️ **Advanced UI Controls**: Group by language/directory, expand/collapse trees, smart filtering
- 🔧 **WebView Enhancements**: Export HTML with same professional quality as command palette reports
- 🎯 **127-Line Rule**: Based on proven software engineering principles
- 🎨 **Theme Integration**: Respects VS Code's color schemes

## Backstory
## 🎨 A long time ago (in technology generations), someone ran a statistical test to see how many lines of code a single file could contain that a single developer could "eyeball" and ensure working code; that number was about **127** lines. In other words, a single developer could ensure "bug-free" code by segmenting code and organizing it so that files have **~127** lines on average. It's one of those good "rules of thumb" behaviors that's learned (typically through debug hell) the hard way. That's where CodeCounter comes in. Simply, it counts lines in files, and alerts users that documents are getting too large for human consumption. It's not meant as a strict limitation for files, but is useful metadata about the file that coders/writers can use to organize their data in the best possible manner.

## **Features**
- **Flexible Thresholds**: Configure your own complexity boundaries  
- **Emoji Customization**: Choose your preferred indicator system

## 🏗️ **Database-Powered Workspace Settings**
> **v1.0.0**: Revolutionary SQLite-powered configuration management

### **High-Performance Configuration**
- Lightning-fast SQLite database replaces scattered JSON files
- 10-100x performance improvement for settings lookup
- All configuration data centralized in `.vscode/code-counter/code-counter.db`
- Atomic operations prevent configuration corruption

### **Smart Settings Management**
- Unified settings interface through webview
- Real-time emoji customization with live preview
- Advanced glob pattern management with validation
- Automatic migration from legacy JSON configurations

### **Professional Organization**
- All extension data organized in `.vscode/code-counter/` directory
- Separate `reports/` subfolder for HTML/XML output
- Clean workspace with no scattered configuration files
- Easy backup and synchronization of all extension data

## 📈 **Professional Reporting & Analytics**
### **🎯 Advanced Standalone HTML Reports**
- **📊 Interactive Tables**: Sortable, filterable tables with real-time search
- **🎛️ Group Controls**: Group by language or directory with one-click buttons
- **🔍 Advanced Filtering**: Filter by language, line count ranges, and file size
- **🧹 Clear Functions**: Reset all filters and grouping with a single button
- **📱 Responsive Design**: Professional layout that works across all screen sizes

### **🚀 Enhanced Export Capabilities**
- **📊 Multiple Formats**: Export to CSV, JSON, and XML with consistent data structure
- **⚡ Professional Minification**: Optimized HTML with terser, clean-css, and html-minifier-terser
- **📦 Self-Contained Reports**: Standalone HTML files with all dependencies embedded
- **🔗 Export Integration**: WebView and standalone reports use the same professional generation pipeline
- **📋 Metadata Support**: All exports include "Generated At" timestamps for tracking

### **🎨 WebView Enhancements**
- **📁 Smart Directory Management**: Filter directories with "All", "All + Hidden", and "Active" modes
- **🗂️ Expand/Collapse Controls**: Individual directory expansion with ▶/▼ glyphs
- **🔧 Bulk Operations**: "Expand All" and "Collapse All" buttons for quick navigation
- **👁️ Hidden Directory Toggle**: Show/hide hidden directories and their subdirectories
- **⚙️ Settings Organization**: Clean, organized settings interface with hierarchical directory display

### **📊 Comprehensive Analytics**
- 📊 **Count Lines of Code**: Analyzes all files in your workspace with smart caching
- 📈 **Detailed Statistics**: Shows code lines, comment lines, and blank lines separately
- 📄 **Enhanced HTML Reports**: Beautiful, interactive HTML reports with intelligent path display system
  - 📁 **Smart Path Toggle**: Interactive button to show/hide full directory paths
  - 🎯 **Optimized Layout**: Clean filename display with expandable path information
  - 💾 **Persistent Preferences**: Remembers your path display choice across sessions
- 🗂️ **Enhanced XML Data**: Comprehensive XML exports with streamlined data structure
  - 📍 **Clean Data Format**: Optimized structure focusing on essential information
  - 🔄 **Consistent Exports**: Unified data format across CSV, JSON, and XML exports
- ⚡ **Performance Optimized**: Only recalculates on file save, not every keystroke
- 🎯 **Glob Exclusions**: Exclude files and directories using customizable glob patterns

## 🏗️ **For Software Architects & Team Leads**
### **Project Health Monitoring**
- 🎨 **Visual Indicators**: Customizable emoji indicators next to files in explorer (🟢🟡🔴 by default)
- 📋 **Status Bar Integration**: Live line counts for active files with hover tooltips
- 📁 **File Explorer Integration**: Non-intrusive indicators that don't interfere with Git colors
### **Standardized Metrics**
- **Cross-Project Consistency**: Same metrics across all codebases
### **Production-Grade Quality**
- **Team Alignment**: Visual indicators everyone understands
- **Technical Debt Tracking**: Identify refactoring candidates
- **Documentation Integration**: Embed reports in architecture docs
- ✅ **261/261 Tests Passing** - Comprehensive test coverage with all features tested 
- ✅ **41% Code Coverage** - Real metrics, not estimates```
- ✅ **TypeScript 5.2+** - Modern, type-safe codebase
- ✅ **Zero Dependencies** - Lightweight and secure
### **Advanced Technical Features**
- **Comprehensive VS Code API Mock**: 15+ API surfaces for testing
- **Intelligent File Watching**: Performance-optimized change detection
- **Memory Efficient**: Proper resource disposal and caching
- **Extensible Architecture**: Clean service-based design

## **Installation**
### **From VS Code Marketplace (Recommended)**
1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X`)
3. Search for **"Code Counter"**
4. Click **"Install"** on the **DelightfulGames.vscode-code-counter extension**

### 🛠️ **For VS Code Extension Enthusiasts**
#### From Command Line
```bash
install-extension DelightfulGames.vscode-code-counter
```
#### Manual Installation
1. Download the latest `.vsix` file from [GitHub Releases](https://github.com/DelightfulGames/vscode-code-counter/releases)
2. Run: `code --install-extension vscode-code-counter-*.vsix`

## **Usage**
### **Commands** - Command Palette (`Ctrl+Shift+P`)
- Manually trigger line counting and report generation
  - → **Code Counter: Count Lines of Code** (`codeCounter.countLines`)
- Opens comprehensive settings interface featuring:
  - → **Code Counter: Customize Emoji Indicators** (`codeCounter.openSettings`)
- Reset the plugin to the defaults
  - → **Code Counter: Reset Emoji Indicators to Defaults** (`codeCounter.resetBadgeSettings`)

### **Context Menu Commands**
Right-click on files or folders in the File Explorer or Editor Tab to access exclusion commands:
- **CodeCounter: Exclude This File/Folder**: Adds the relative path to workspace settings
- **CodeCounter: Exclude Files/Folders with Same Name**: Adds a global pattern (e.g., `**/README.md`) to exclude all files with the same name
- **CodeCounter: Exclude Files with Same Extension**: Adds a global pattern (e.g., `**/*.log`) to exclude all files with the same extension

> 💡 **Smart Configuration**: Exclusion patterns are managed through the SQLite database in `.vscode/code-counter/code-counter.db`. The settings webview and file decorators automatically refresh when exclusion patterns are added through context menus.

### **UI Integration**
#### File Explorer Integration
- **Emoji Badge Indicators**: Visual badges (🟢🟡🔴🟩🟨🟥) that don't interfere with Git status colors
- **Non-Intrusive Design**: File names keep their normal colors (green for new, red for modified, etc.)
- **Smart Updates**: Only recalculates on file save, not every keystroke  
- **Hover Tooltips**: Simple "Lines: X" format for consistency
#### Status Bar Integration  
- **Live Display**: Shows line count for active file with badge
- **Hover Tooltips**: Simple "Lines: X" format for consistency

### Smart Emoji Badge Selection
The extension provides comprehensive emoji customization options:

[![See Code Counter Emojis](https://img.youtube.com/vi/dIdzrnTg6Z8/maxresdefault.jpg)](https://www.youtube.com/watch?v=dIdzrnTg6Z8)

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

### Glob Pattern Management
Manage file exclusion patterns through the enhanced settings interface:
- **📁 Visual Pattern Manager**: Add/remove glob patterns with intuitive interface
- **✅ Pattern Validation**: Real-time validation prevents invalid glob patterns  
- **📖 Built-in Examples**: Common patterns like `**/node_modules/**`, `**/*.tmp`
- **🔄 Easy Reset**: Restore default exclusion patterns with one click
- **🎯 Smart Defaults**: Pre-configured to exclude common build artifacts and dependencies
- **💡 Interactive Help**: Expandable examples section with pattern explanations
- **⌨️ Keyboard Support**: Press Enter to add patterns quickly

### Configuration Options
The extension provides several configuration options to customize behavior:

#### **Notification Settings**
- **`codeCounter.showNotificationOnAutoGenerate`** (default: `false`)
  - Controls whether popup notifications appear when reports are auto-generated on file save
  - Set to `true` to enable popup notifications with "View Report" button
  - Set to `false` for silent operation (recommended for focused coding)
  - **💡 Tip**: Use the checkbox in the settings webview (`Code Counter: Customize Emoji Indicators`) for easy toggling

#### **Auto-Generation Control** 
- **`codeCounter.autoGenerate`** (default: `true`)
  - Enable/disable automatic report generation when files are saved
  - When disabled, reports are only generated via manual command execution

### Output Files
The extension generates two files in the configured output directory:
- **Intelligent Caching**: Modification-time based invalidation
1. **`code-counter-report.html`**: Interactive HTML report with charts and tables
- **Event-Driven Updates**: Real-time file system watching
2. **`code-counter-data.xml`**: XML data source for integration with other tools

## 📊 **Technical Excellence**
### **Testing & Quality**
- **Unit Tests**: 261 comprehensive tests across multiple test suites covering all features
- **Integration Tests**: VS Code API compatibility validation  
- **Performance Tests**: File system operation optimization
- **Coverage Analysis**: 41% real coverage with C8 tooling

#### **Smart Performance Features**
- **Save-Based Updates**: Only recalculates when files are saved, not on every keystroke
- **Selective File Watching**: Only monitors relevant code files, ignores binaries and build outputs
- **Intelligent Caching**: Modification time-based cache invalidation for accuracy
- **Efficient Event Handling**: Debounced file system events prevent performance loops
- **Memory Management**: Proper disposables prevent memory leaks
- **Battery Friendly**: Minimal background processing for laptop users

### **Architecture Highlights**
- **Service-Oriented Design**: Modular, testable components
- **Memory Management**: Proper disposal patterns

### **VS Code Integration**
- **Command Palette**: Full VS Code command system integration
- **Status Bar Integration**: Non-intrusive information display
- **File Explorer Decorators**: Native VS Code theming support
- **Configuration API**: Seamless settings management

### **Supported Languages**
The extension automatically detects and counts lines for **78+ programming languages and file types**, including:

#### **Programming Languages**
- **Web Development**: JavaScript, TypeScript, JSX, TSX, HTML, CSS, SCSS, Sass, Less, CoffeeScript, LiveScript
- **Systems Programming**: C, C++, C#, Java, Go, Rust, Swift, Kotlin, Scala, Dart, Assembly, Zig, V, Nim, Crystal
- **Scripting & Shell**: Python, Ruby, PHP, Shell, Bash, Zsh, Fish, PowerShell, Batch, AWK, Tcl
- **Functional Programming**: Haskell, Erlang, Elixir, Clojure, F#, OCaml, Scheme, Racket  
- **Mobile & Platform**: Swift, Kotlin, Scala, Dart, Objective-C, Vala
- **Data Science & Analytics**: R, MATLAB, Julia, SQL
- **Enterprise & Legacy**: COBOL, Fortran, Visual Basic, Pascal, Ada, Groovy, Delphi
- **Specialized Languages**: GraphQL, Protocol Buffers, ANTLR

#### **Configuration & Data Files**
- **Build & Project**: CMake, Makefile, Dockerfile, TOML, YAML, JSON, XML
- **Development Tools**: Environment files, Properties, GitIgnore, EditorConfig
- **Documentation**: Markdown, Text, INI, Config files

> **🚀 Total Coverage**: 78+ languages with intelligent comment detection and proper line counting algorithms for each language family.

## 🔍 **Visibility & Accessibility**

### **Making Emoji Badges Bigger & Easier to See**
If you find the emoji badges (🟢🟡🔴) in the File Explorer too small or hard to distinguish, you can increase VS Code's zoom level to make them larger and more visible:

#### **Quick Method:**
- **Zoom In**: `Ctrl` + `+` (Windows/Linux) or `Cmd` + `+` (Mac)
- **Zoom Out**: `Ctrl` + `-` (Windows/Linux) or `Cmd` + `-` (Mac)
- **Reset Zoom**: `Ctrl` + `0` (Windows/Linux) or `Cmd` + `0` (Mac)

#### **Precise Control via Settings:**
1. **Open Settings**: `Ctrl` + `,` (Windows/Linux) or `Cmd` + `,` (Mac)
2. **Search**: Type `window.zoomLevel`
3. **Adjust**: Set a value like `1` (120% zoom) or `2` (140% zoom)
   - `0` = 100% (default)
   - `1` = 120% zoom
   - `2` = 140% zoom
   - `0.5` = 110% zoom (fine adjustment)

#### **Benefits of Increased Zoom:**
- **👁️ Better Visibility**: Emoji badges become larger and easier to distinguish
- **🎯 Improved Accuracy**: Easier to spot complexity hotspots at a glance
- **♿ Accessibility**: Better for users who prefer larger interface elements
- **🖥️ High-DPI Displays**: Especially helpful on high-resolution monitors

> **💡 Pro Tip**: The zoom level affects the entire VS Code interface, making not just emoji badges but all text and UI elements larger and more comfortable to work with!

## **Report Features**

### 🎯 **Enhanced Path Display System**

#### **💾 Smart Persistence** 
- Your path display preference is automatically saved using localStorage
- Consistent experience across all reports and browser sessions
- No need to repeatedly adjust settings

#### **🎨 Optimized Design**
- **Clean Layout**: Filenames prominently displayed with subtle path information
- **Responsive Design**: Works beautifully on all screen sizes
- **Visual Hierarchy**: Clear distinction between filename and directory path

#### **📊 Multiple Export Formats**
- **HTML Reports**: Interactive reports with enhanced path toggle functionality
- **XML**, **JSON**, **CSV**
- **Backward Compatible**: Existing integrations continue to work seamlessly

### **📈 Comprehensive Analytics**
The generated reports include:
- **Summary Statistics**: Total files, lines, languages, and averages
- **Language Breakdown**: Files and lines per programming language  
- **Grouping Controls**: data can be grouped by directory or language
- **Enhanced File Details**: Searchable table with intelligent path display and individual file statistics
- **Interactive Elements**: Search, filtering, and responsive design

## **Contributing**
We welcome contributions from developers, architects, and VS Code enthusiasts!
[CONTRIBUTING.md](./contributing.md)

## 📚 **Documentation**
| Document | Audience | Content |
|---|---|---|
| [🚀 Contributing Guide](./CONTRIBUTING.md) | Contributors | Development workflow and standards |
| [📋 Testing Guide](./TESTING_GUIDE.md) | Contributors | Test execution and coverage |
| [🏗️ Architecture Docs](./docs) | Developers | Technical implementation details |

## 🔮 **Roadmap**
- 📊 **Advanced Analytics**: Complexity trends over time
- 🤖 **AI Integration**: Smart refactoring suggestions
- 🔗 **Git Integration**: Blame-aware complexity analysis# Lint code
- 📱 **Web Dashboard**: Team-wide project insights

## **⭐⭐⭐⭐⭐ Star this repo if VS Code Code Counter makes your development workflow better!**
### **Built with ❤️ by developers, for developers**
## 🤝 **Connect With Us**

- 🐛 **Issues**: [GitHub Issues](https://github.com/DelightfulGames/vscode-code-counter/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/DelightfulGames/vscode-code-counter/discussions)  
- 📧 **Contact**: [code-counter@delightfulgames.com](mailto:code-counter@delightful-games.com)

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for full details.

### What this means:
- ✅ **Free to use** - Personal and commercial use allowed
- ✅ **Free to modify** - Create your own versions and improvements
- ✅ **Free to distribute** - Share with others, including modified versions
- ✅ **Attribution required** - Just keep the original copyright notice
- ✅ **No warranty** - Provided "as-is" without guarantees

**TL;DR**: Use it freely, modify it as needed, just give credit to the original project!
