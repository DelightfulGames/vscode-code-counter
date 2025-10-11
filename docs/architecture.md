# Extension Architecture

## 🏗️ High-Level Architecture

The VS Code Code Counter extension follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code API                          │
├─────────────────────────────────────────────────────────┤
│                  Extension Host                         │
├─────────────────────────────────────────────────────────┤
│    Commands Layer          │        Providers Layer     │
│  ┌─────────────────────┐   │   ┌─────────────────────┐  │
│  │  CountLinesCommand  │   │   │ FileExplorerDecorator│ │
│  └─────────────────────┘   │   │ EditorTabDecorator  │  │
│                            │   │ FileWatcherProvider │  │
│                            │   └─────────────────────┘  │
├────────────────────────────┼─────────────────────────────┤
│                   Services Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────┐ │
│  │  LineCounter    │  │ ColorThreshold  │  │HTMLGen   │ │
│  │  Service        │  │ Service         │  │XMLGen    │ │
│  └─────────────────┘  └─────────────────┘  └──────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────┐ │
│  │ LineCountCache  │  │ FileUtils       │  │GlobUtils │ │
│  │ Service         │  │                 │  │          │ │
│  └─────────────────┘  └─────────────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────┤
│                   Data Layer                            │
│     File System    │    VS Code Config   │   Cache     │
└─────────────────────────────────────────────────────────┘
```

## 📋 Component Responsibilities

### Extension Entry Point (`extension.ts`)
- **Activation/Deactivation**: Manages extension lifecycle
- **Dependency Injection**: Initializes and wires up all services and providers
- **WebView Management**: Handles the settings interface using template-based system
- **Template Loading**: Loads HTML templates from `/templates` directory with dynamic placeholder replacement
- **Configuration Management**: Manages both file and folder badge configurations
- **Command Registration**: Registers all extension commands with VS Code

### Commands Layer
#### CountLinesCommand
- **Purpose**: Executes line counting operations and generates reports
- **Responsibilities**:
  - Orchestrates the line counting process
  - Handles workspace folder management
  - Triggers report generation (HTML/XML)
  - Provides user feedback and error handling

### Providers Layer
#### FileExplorerDecorationProvider
- **Purpose**: Provides emoji badge indicators in the file explorer
- **Responsibilities**:
  - Implements `FileDecorationProvider` interface
  - Calculates appropriate badge based on line count thresholds
  - Handles emoji configuration changes
  - Manages display modes (always/hover)

#### EditorTabDecorationProvider  
- **Purpose**: Shows line counts in the status bar for active files
- **Responsibilities**:
  - Monitors active editor changes
  - Updates status bar with line count information
  - Handles configuration changes for display modes
  - Provides hover tooltips with detailed information

#### FileWatcherProvider
- **Purpose**: Monitors file system changes for cache invalidation
- **Responsibilities**:
  - Watches for file creation, modification, and deletion
  - Debounces file system events to prevent excessive updates
  - Triggers cache invalidation when files change
  - Respects exclude patterns to avoid watching irrelevant files

### Services Layer
#### LineCounterService
- **Purpose**: Core line counting logic with language detection
- **Responsibilities**:
  - Counts code, comment, and blank lines
  - Detects programming languages by file extension
  - Handles multiple file formats (25+ languages)
  - Calculates aggregate statistics per language
  - Applies glob exclusion patterns

#### lineThresholdService
- **Purpose**: Manages emoji badge coding based on configurable thresholds
- **Responsibilities**:
  - Classifies files as normal/warning/danger based on line counts
  - Reads and validates threshold configuration
  - Creates badge tooltips with threshold information
  - Formats line count displays for UI components

#### LineCountCacheService
- **Purpose**: Performance optimization through intelligent caching
- **Responsibilities**:
  - Caches line count results with file modification time validation
  - Provides cache hit/miss statistics for debugging
  - Automatically invalidates stale cache entries
  - Handles cache cleanup and memory management

#### HtmlGeneratorService
- **Purpose**: Generates interactive HTML reports
- **Responsibilities**:
  - Creates searchable, sortable HTML reports
  - Applies custom styling and themes
  - Handles template processing
  - Includes JavaScript for interactive features

#### XmlGeneratorService
- **Purpose**: Generates structured XML data for external tools
- **Responsibilities**:
  - Creates well-formed XML with line count statistics
  - Includes file metadata and language information
  - Supports integration with external analysis tools
  - Maintains backward compatibility

### Utilities Layer
#### FileUtils
- **Purpose**: File system operations and path manipulation
- **Responsibilities**:
  - Safe file reading with error handling
  - Path normalization and validation
  - File size calculations
  - Directory creation and management

#### GlobUtils
- **Purpose**: Pattern matching and file filtering
- **Responsibilities**:
  - Glob pattern compilation and matching
  - Exclusion pattern application
  - Performance-optimized pattern matching
  - Pattern validation

## 🔄 Data Flow

### Line Counting Flow
1. **User Trigger**: Command execution or file save event
2. **File Discovery**: FileUtils scans workspace with glob exclusions
3. **Cache Check**: LineCountCacheService checks for cached results
4. **Line Analysis**: LineCounterService processes uncached files
5. **Result Aggregation**: Statistics calculated per language
6. **Cache Update**: Results stored in cache with timestamps
7. **UI Update**: Providers refresh decorations and status bar

### Configuration Flow
1. **Settings Change**: User modifies configuration via WebView or settings.json
2. **Event Propagation**: VS Code fires configuration change events
3. **Provider Refresh**: All providers receive configuration updates
4. **Service Reconfiguration**: Services update internal state
5. **UI Refresh**: File decorations and status bar update with new settings

### WebView Communication Flow
1. **Template Loading**: Extension loads HTML template from `/templates/emoji-picker.html`
2. **Placeholder Replacement**: Dynamic content injection using `{{placeholder}}` syntax
3. **WebView Creation**: Extension creates WebView with processed template content
4. **User Interaction**: User modifies colors, thresholds, or glob patterns
5. **Message Passing**: WebView sends structured messages to extension
6. **Configuration Update**: Extension updates VS Code configuration
7. **Template Refresh**: Template is reprocessed with updated configuration
8. **Provider Notification**: All providers receive configuration change events

### Template System Architecture
- **Template Files**: HTML templates stored in `/templates` directory
- **Placeholder Syntax**: `{{variableName}}` for dynamic content injection
- **Supported Placeholders**:
  - `{{badges.low}}`, `{{badges.medium}}`, `{{badges.high}}` - File emoji badges
  - `{{folderBadges.low}}`, `{{folderBadges.medium}}`, `{{folderBadges.high}}` - Folder emoji badges
  - `{{thresholds.mid}}`, `{{thresholds.high}}` - Threshold values
  - `{{excludePatterns}}` - Dynamic HTML for glob patterns
  - `{{scriptContent}}` - JavaScript functionality
- **Error Handling**: Fallback HTML content when template loading fails
- **Benefits**: Separation of concerns, easier maintenance, cleaner code organization

## 🎯 Design Patterns

### Service Pattern
- **Services**: Encapsulate business logic in stateless, reusable services
- **Benefits**: Testability, maintainability, single responsibility

### Provider Pattern
- **Providers**: Implement VS Code interfaces for UI integration
- **Benefits**: Clean separation between VS Code API and business logic

### Observer Pattern
- **Configuration Watching**: Components react to configuration changes
- **File Watching**: Cache invalidation based on file system events
- **Benefits**: Loose coupling, reactive updates

### Cache-Aside Pattern
- **LineCountCacheService**: Cache results with fallback to computation
- **Benefits**: Performance optimization with data consistency

### Command Pattern
- **VS Code Commands**: Encapsulate operations as executable commands
- **Benefits**: Undo/redo capability, operation logging

## 📊 Performance Considerations

### Caching Strategy
- **File-level Caching**: Individual file results cached with modification time
- **Lazy Evaluation**: Line counts calculated only when needed
- **Memory Management**: Automatic cache cleanup prevents memory leaks

### Debouncing
- **File System Events**: Multiple rapid changes batched into single update
- **Configuration Changes**: UI updates debounced to prevent flicker
- **WebView Updates**: Message batching for better performance

### Selective Processing  
- **Glob Exclusions**: Skip unnecessary files during scanning
- **Language Detection**: Fast file extension mapping
- **Incremental Updates**: Process only changed files when possible

## 🔧 Extension Points

The architecture supports easy extension through:

### New Language Support
- Add language mappings in `LineCounterService`
- Update comment pattern recognition
- Extend file extension mappings

### New Report Formats
- Implement new generator services (JSON, CSV, etc.)
- Follow existing HTML/XML generator patterns
- Add configuration options for new formats

### Additional Providers
- Implement new VS Code provider interfaces
- Follow existing provider patterns for lifecycle management
- Add configuration options for new UI features

### Custom Decorations
- Extend `FileExplorerDecorationProvider` for new visual indicators
- Add new color schemes and threshold configurations
- Implement custom badge or icon systems

---

*This architecture documentation reflects the current implementation and design decisions made for optimal performance, maintainability, and extensibility.*