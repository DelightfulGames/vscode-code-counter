<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

Repository: https://github.com/DelightfulGames/vscode-code-counter
Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->

# VS Code Code Counter - Extension Documentation

This directory contains comprehensive technical documentation for the VS Code Code Counter extension.

## 🆕 Recent Updates

### Template System Implementation
- **Modular HTML Templates**: Moved WebView HTML content to separate template files in `/templates`
- **Dynamic Placeholder System**: Implemented `{{variable}}` syntax for runtime content injection
- **Improved Maintainability**: Separated concerns between logic and presentation

### Enhanced Badge System
- **Folder Badges**: Added dedicated emoji configuration for folder indicators
- **Real-time Updates**: File system watchers now trigger immediate badge refresh
- **Cache Optimization**: Folder-level cache invalidation for better performance

### Code Organization
- **Cleaner Extension Entry**: Reduced `extension.ts` from ~500 to ~300 lines
- **Template Loading**: Robust error handling with fallback content
- **Configuration Enhancement**: Support for both file and folder badge management

## 📚 Documentation Index

### Architecture & Design
- **[Extension Architecture](./architecture.md)** - High-level system design and component relationships
- **[Code Structure](./code-structure.md)** - Detailed breakdown of source code organization
- **[Design Patterns](./design-patterns.md)** - Software patterns and architectural decisions

### Core Components
- **[Extension Entry Point](./extension-entry.md)** - Main activation and lifecycle management
- **[Services Layer](./services.md)** - Business logic and data processing components
- **[Providers Layer](./providers.md)** - VS Code API integration and UI providers
- **[Commands System](./commands.md)** - Command registration and execution
- **[Configuration System](./configuration.md)** - Settings management and user preferences

### Advanced Features
- **[WebView Interface](./webview-interface.md)** - Emoji picker and settings UI implementation
- **[Caching System](./caching-system.md)** - Performance optimization through intelligent caching
- **[File Watching](./file-watching.md)** - Real-time file system monitoring
- **[Testing Framework](./testing.md)** - Test structure and coverage

### Development
- **[Development Setup](./development-setup.md)** - Environment setup and build process
- **[Contributing Guide](../contributing.md)** - Guidelines for extension development
- **[Release Process](./release-process.md)** - Version management and deployment

### API Reference
- **[TypeScript Interfaces](./typescript-interfaces.md)** - Type definitions and contracts
- **[VS Code API Usage](./vscode-api-usage.md)** - How the extension uses VS Code APIs
- **[Utilities Reference](./utilities.md)** - Helper functions and shared utilities

## 🎯 Extension Overview

The VS Code Code Counter extension is a comprehensive line counting tool that provides:

### Core Functionality
- **Line Counting**: Analyzes code, comment, and blank lines across multiple programming languages
- **Visual Indicators**: Colored bullet points in file explorer and status bar integration
- **Report Generation**: HTML and XML reports with detailed statistics
- **Performance Optimization**: Intelligent caching and save-based updates

### Key Features
- **Smart Color Coding**: Configurable thresholds with visual color picker
- **Glob Pattern Management**: Visual interface for file exclusion patterns  
- **Multi-language Support**: 25+ programming languages and file types
- **Theme Integration**: Seamless VS Code theme compatibility
- **Real-time Updates**: File system watching with debounced updates

### Technical Highlights
- **TypeScript Implementation**: Fully typed codebase with strict compilation
- **Modular Architecture**: Clean separation of concerns with service/provider pattern
- **Comprehensive Testing**: Unit tests with 100% core functionality coverage
- **Modern VS Code APIs**: FileDecorationProvider, WebView, Configuration APIs
- **Performance First**: Optimized for large codebases with intelligent caching

## 🏗️ Architecture Philosophy

The extension follows several key architectural principles:

1. **Separation of Concerns**: Clear boundaries between UI, business logic, and data layers
2. **Dependency Injection**: Loosely coupled components with clear interfaces
3. **Event-Driven Design**: Reactive updates based on file system and configuration changes
4. **Performance Optimization**: Lazy loading, caching, and debounced operations
5. **Extensibility**: Modular design allows easy addition of new features
6. **Type Safety**: Comprehensive TypeScript usage with strict type checking

## 📦 Package Structure

```
vscode-code-counter/
├── src/                     # Source code
│   ├── extension.ts         # Entry point and WebView management
│   ├── commands/            # Command implementations
│   ├── providers/           # VS Code API providers
│   ├── services/            # Business logic and data processing
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Shared utilities
│   └── test/                # Test suites
├── templates/               # HTML report templates
├── docs/                    # Technical documentation (this directory)
├── package.json             # Extension manifest and dependencies
└── tsconfig.json            # TypeScript configuration
```

## 🚀 Quick Start for Developers

1. **Setup**: See [Development Setup](./development-setup.md)
2. **Architecture**: Read [Extension Architecture](./architecture.md)
3. **Code Tour**: Follow [Code Structure](./code-structure.md)
4. **Testing**: Check [Testing Framework](./testing.md)

---

*This documentation is maintained alongside the extension source code and reflects the current implementation in version 0.7.0.*