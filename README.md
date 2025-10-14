# 📊 VS Code Code Counter

> **Transform your code visibility with intelligent line counting, visual indicators, and comprehensive reporting**

[![Version](https://img.shields.io/badge/version-0.9.5-blue.svg)](https://github.com/DelightfulGames/vscode-code-counter/releases)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/DelightfulGames.vscode-code-counter)](https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/DelightfulGames.vscode-code-counter)](https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.80+-007ACC.svg)](https://code.visualstudio.com/)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/DelightfulGames.vscode-code-counter)](https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![Tests](https://img.shields.io/badge/tests-51%2F51%20passing-brightgreen.svg)](#)
[![Coverage](https://img.shields.io/badge/coverage-41%25-green.svg)](#)
[![GitHub Issues](https://img.shields.io/github/issues/DelightfulGames/vscode-code-counter.svg)](https://github.com/DelightfulGames/vscode-code-counter/issues)
[![GitHub Stars](https://img.shields.io/github/stars/DelightfulGames/vscode-code-counter.svg)](https://github.com/DelightfulGames/vscode-code-counter/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/DelightfulGames/vscode-code-counter.svg)](https://github.com/DelightfulGames/vscode-code-counter/network)

## 🚀 **What Makes Code Counter Special?**
> A Visual Studio Code extension that counts lines of code in your project and generates beautiful HTML reports with XML data sources. Features intelligent file explorer integration with customizable emoji indicators, performance-optimized caching, and a professional emoji picker for complete customization.

> **🎉 What's New**: Complete settings overhaul with emoji freedom and powerful pattern management. See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

## 📸 **See It In Action**
### 🎯 **Instant Visual Feedback**
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
📁 src/                🟡🟥 # (avg 917 lines, max 2,847 lines)
├── service.ts            🟢 # (156 lines)
├── utils.ts              🟢 # (42 lines)
└── 📁 components/     🔴🟥 # (avg 2,847 lines, max 2,847 lines)  
    └── legacy.ts         🔴 # (2,847 lines)
```

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
- **For Architects**: Comprehensive project analytics and reporting capabilities  
- **For Developers**: Real-time visual feedback on code complexity with fun emoji indicators  
- **For Teams**: Standardized code metrics across projects and languages
- **For VS Code Enthusiasts**: Production-grade extension with 51/51 tests passing

## **Quick Start**
1. **Install**: Search "Code Counter" in VS Code Extensions
2. **Activate**: Extension activates automatically on startup
3. **Customize**: Press `Ctrl+Shift+P` → "CodeCounter: Customize Emoji Indicators"
4. **View**: See emoji badges (🟢🟡🔴) next to files in explorer
5. **Reports**: Run "Count Lines of Code" command for detailed HTML reports

## ✨ Key Highlights
- 🎨 **Emoji Customization**: Choose ANY emoji for your line count thresholds
- 📝 **Glob Pattern Manager**: Visual interface for managing file exclusion patterns
- ⌨️ **Language Support**: supports most programming languages
- 🔍 **Smart Search**: Find emojis by typing "smile", "heart", "circle", etc.
- 🧠 **Smart Exclusions**: Configurable patterns (node_modules, build files, etc.)
- ⚡ **Performance First**: Intelligent caching and real-time updates
- 📊 **Detailed Reports**: HTML and XML export with filtering
- 🎯 **127-Line Rule**: Based on proven software engineering principles
- 🎨 **Theme Integration**: Respects VS Code's color schemes

# Backstory
## 🎨 A long time ago (in technology generations), someone ran a statistical test to see how many lines of code a single file could contain that a single developer could "eyeball" and ensure working code; that number was about **127** lines. In other words, a single developer could ensure "bug-free" code by segmenting code and organizing it so that files have **~127** lines on average. It's one of those good "rules of thumb" behaviors that's learned (typically through debug hell) the hard way. That's where CodeCounter comes in. Simply, it counts lines in files, and alerts users that documents are getting too large for human consumption. It's not meant as a strict limitation for files, but is useful metadata about the file that coders/writers can use to organize their data in the best possible manner.

## **Features**
- **Flexible Thresholds**: Configure your own complexity boundaries  
- **Emoji Customization**: Choose your preferred indicator system

## 📈 **Comprehensive Analytics**
- 📊 **Count Lines of Code**: Analyzes all files in your workspace with smart caching
- 📈 **Detailed Statistics**: Shows code lines, comment lines, and blank lines separately
- 📄 **HTML Reports**: Generates beautiful, interactive HTML reports with search functionality
- 🗂️ **XML Data Source**: Creates XML files for integration with other tools
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
- ✅ **51/51 Tests Passing** - Comprehensive test coveragecode 
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
  - → **Code Counter: Customize Emoji Indicators** (`codeCounter.
openSettings`)
- Reset the plugin to the defaults
  - → **Code Counter: Reset Emoji Indicators to Defaults** (`codeCounter.openSettings`)"codeCounter.resetBadgeSettings"

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

### Output Files
The extension generates two files in the configured output directory:
- **Intelligent Caching**: Modification-time based invalidation
1. **`code-counter-report.html`**: Interactive HTML report with charts and tables
- **Event-Driven Updates**: Real-time file system watching
2. **`code-counter-data.xml`**: XML data source for integration with other tools

## 📊 **Technical Excellence**
### **Testing & Quality**
- **Unit Tests**: 51 comprehensive tests across 9 test suites
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
The extension automatically detects and counts lines for:
- **Web**: JavaScript, TypeScript, HTML, CSS, SCSS, Sass, Less
- **System**: C, C++, C#, Java, Go, Rust
- **Scripting**: Python, Ruby, PHP, Shell, Batch, PowerShell
- **Mobile**: Swift, Kotlin, Scala
- **Data**: JSON, XML, YAML, Markdown
- **And more**: Any text file with configurable comment patterns

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
The generated HTML report includes:
- **Summary Statistics**: Total files, lines, languages, and averages
- **Language Breakdown**: Files and lines per programming language
- **File Details**: Searchable table with individual file statistics
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
