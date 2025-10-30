<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

Repository: https://github.com/DelightfulGames/vscode-code-counter
Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->
# Design Patterns & Architectural Decisions

## 🎨 **Overview**

The VS Code Code Counter extension implements several well-established design patterns to ensure maintainability, testability, and extensibility. This document outlines the key architectural patterns used throughout the codebase.

---

## 🏗️ **Core Design Patterns**

### **1. Service Locator Pattern**

**Location**: `src/services/` directory  
**Purpose**: Central registry for all business logic services  
**Implementation**: Dependency injection through constructor parameters

```typescript
// Service registration and dependency management
export class ServiceContainer {
    private static instance: ServiceContainer;
    
    constructor() {
        this.lineCounter = new LineCounterService();
        this.htmlGenerator = new HtmlGenerator();
        this.cacheService = new LineCountCache();
        this.thresholdService = new LineThresholdService();
    }
}
```

**Benefits**:
- Centralized service management
- Easy dependency injection for testing
- Clear separation of concerns
- Simplified service lifecycle management

### **2. Observer Pattern**

**Location**: `src/providers/fileWatcher.ts`  
**Purpose**: Real-time file system change notifications  
**Implementation**: VS Code FileSystemWatcher with event callbacks

```typescript
// File system event observation
export class FileWatcher {
    private watchers: vscode.FileSystemWatcher[] = [];
    
    public watchWorkspace(callback: (uri: vscode.Uri) => void): void {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        watcher.onDidChange(callback);
        watcher.onDidCreate(callback);
        watcher.onDidDelete(callback);
        
        this.watchers.push(watcher);
    }
}
```

**Benefits**:
- Decoupled file change handling
- Real-time UI updates
- Efficient resource management
- Event-driven architecture

### **3. Decorator Pattern**

**Location**: `src/providers/fileExplorerDecorator.ts`  
**Purpose**: Enhance VS Code UI without modifying core functionality  
**Implementation**: VS Code FileDecorationProvider interface

```typescript
// UI enhancement through decoration
export class FileExplorerDecorator implements vscode.FileDecorationProvider {
    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        const lineCount = this.cacheService.getLineCount(uri.fsPath);
        const emoji = this.thresholdService.getEmojiForLineCount(lineCount);
        
        return {
            badge: emoji,
            tooltip: `Lines: ${lineCount}`
        };
    }
}
```

**Benefits**:
- Non-intrusive UI enhancements
- Maintains VS Code theming consistency
- Separates display logic from business logic
- Easy to enable/disable features

### **4. Command Pattern**

**Location**: `src/commands/countLines.ts`  
**Purpose**: Encapsulate user actions as executable objects  
**Implementation**: VS Code command registration with handlers

```typescript
// Action encapsulation
export class CountLinesCommand {
    public static readonly ID = 'codeCounter.countLines';
    
    public static register(context: vscode.ExtensionContext): void {
        const command = vscode.commands.registerCommand(
            CountLinesCommand.ID,
            CountLinesCommand.execute
        );
        context.subscriptions.push(command);
    }
    
    private static async execute(): Promise<void> {
        // Command execution logic
        await new LineCounterService().analyzeWorkspace();
    }
}
```

**Benefits**:
- Encapsulated user actions
- Undo/redo capability foundation
- Clear command-to-handler mapping
- Easy testing of user interactions

### **5. Template Method Pattern**

**Location**: `src/services/htmlGenerator.ts`, `src/services/xmlGenerator.ts`  
**Purpose**: Define report generation algorithm with customizable steps  
**Implementation**: Abstract base class with concrete implementations

```typescript
// Report generation template
abstract class ReportGenerator {
    public async generateReport(data: LineCountData): Promise<string> {
        const processedData = await this.preprocessData(data);
        const content = await this.formatContent(processedData);
        return await this.postprocessContent(content);
    }
    
    protected abstract formatContent(data: ProcessedData): Promise<string>;
    protected abstract postprocessContent(content: string): Promise<string>;
}

export class HtmlGenerator extends ReportGenerator {
    protected async formatContent(data: ProcessedData): Promise<string> {
        return this.templateService.render('report.html', data);
    }
}
```

**Benefits**:
- Consistent report generation process
- Easy addition of new report formats
- Shared preprocessing logic
- Template customization flexibility

### **6. Factory Pattern**

**Location**: `src/services/lineCounter.ts`  
**Purpose**: Create language-specific line counting strategies  
**Implementation**: Strategy selection based on file extension

```typescript
// Language-specific counting strategy creation
export class LineCounterFactory {
    public static createCounter(filePath: string): ILineCountStrategy {
        const extension = path.extname(filePath).toLowerCase();
        
        switch (extension) {
            case '.js':
            case '.ts':
                return new JavaScriptLineCounter();
            case '.py':
                return new PythonLineCounter();
            case '.html':
                return new HtmlLineCounter();
            default:
                return new GenericLineCounter();
        }
    }
}
```

**Benefits**:
- Language-specific counting logic
- Easy addition of new language support
- Centralized strategy selection
- Extensible architecture

---

## 🧪 **Testing Patterns**

### **1. Mock Object Pattern**

**Location**: `src/test/mocks/vscode-mock.ts`  
**Purpose**: Comprehensive VS Code API simulation for testing  
**Implementation**: Complete API surface replication

```typescript
// Comprehensive API mocking
export const vscode = {
    window: {
        showInformationMessage: sinon.stub(),
        showErrorMessage: sinon.stub(),
        createStatusBarItem: sinon.stub(),
        withProgress: sinon.stub()
    },
    workspace: {
        findFiles: async (pattern: any) => {
            // Real file system integration with mock APIs
            return await findRealFiles(pattern);
        },
        onDidSaveDocument: sinon.stub(),
        getConfiguration: sinon.stub()
    }
    // ... 15+ additional API surfaces
};
```

**Benefits**:
- Tests run without VS Code dependency
- Predictable test environment
- Fast test execution (378ms for 249 tests)
- Real file system integration where needed

### **2. Builder Pattern**

**Location**: `src/test/suite/*.test.ts`  
**Purpose**: Construct complex test data objects  
**Implementation**: Fluent interface for test data creation

```typescript
// Test data construction
class TestDataBuilder {
    private data: LineCountData = {};
    
    public withLanguage(language: string): TestDataBuilder {
        this.data.language = language;
        return this;
    }
    
    public withLineCount(count: number): TestDataBuilder {
        this.data.lineCount = count;
        return this;
    }
    
    public build(): LineCountData {
        return { ...this.data };
    }
}

// Usage in tests
const testData = new TestDataBuilder()
    .withLanguage('TypeScript')
    .withLineCount(156)
    .build();
```

**Benefits**:
- Readable test data construction
- Reusable test object creation
- Clear test intention
- Reduced test duplication

---

## 🔄 **Lifecycle Patterns**

### **1. Disposable Pattern**

**Location**: Throughout codebase  
**Purpose**: Proper resource cleanup and memory management  
**Implementation**: VS Code Disposable interface

```typescript
// Resource management
export class ResourceManager implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    
    public register<T extends vscode.Disposable>(resource: T): T {
        this.disposables.push(resource);
        return resource;
    }
    
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables.length = 0;
    }
}
```

**Benefits**:
- Prevents memory leaks
- Automatic resource cleanup
- Clear ownership of resources
- VS Code lifecycle integration

### **2. Lazy Initialization Pattern**

**Location**: `src/services/lineCountCache.ts`  
**Purpose**: Defer expensive operations until needed  
**Implementation**: On-demand service and cache initialization

```typescript
// Lazy service initialization
export class LazyServiceManager {
    private _lineCounter?: LineCounterService;
    
    public get lineCounter(): LineCounterService {
        if (!this._lineCounter) {
            this._lineCounter = new LineCounterService();
        }
        return this._lineCounter;
    }
}
```

**Benefits**:
- Improved startup performance
- Memory usage optimization
- On-demand resource allocation
- Better user experience

---

## 📊 **Performance Patterns**

### **1. Cache-Aside Pattern**

**Location**: `src/services/lineCountCache.ts`  
**Purpose**: Optimize repeated file analysis operations  
**Implementation**: Modification-time based cache invalidation

```typescript
// Intelligent caching with invalidation
export class LineCountCache {
    private cache = new Map<string, CacheEntry>();
    
    public async getLineCount(filePath: string): Promise<number> {
        const stats = await fs.stat(filePath);
        const cached = this.cache.get(filePath);
        
        if (cached && cached.mtime >= stats.mtime) {
            return cached.lineCount; // Cache hit
        }
        
        // Cache miss - recalculate and store
        const lineCount = await this.calculateLineCount(filePath);
        this.cache.set(filePath, {
            lineCount,
            mtime: stats.mtime
        });
        
        return lineCount;
    }
}
```

**Benefits**:
- Dramatic performance improvement
- Intelligent cache invalidation
- Memory-efficient storage
- Transparent to consumers

### **2. Debounce Pattern**

**Location**: `src/providers/fileWatcher.ts`  
**Purpose**: Prevent excessive file system event processing  
**Implementation**: Timer-based event aggregation

```typescript
// Event aggregation for performance
export class DebouncedFileWatcher {
    private updateTimer?: NodeJS.Timeout;
    private pendingUpdates = new Set<string>();
    
    private scheduleUpdate(filePath: string): void {
        this.pendingUpdates.add(filePath);
        
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        this.updateTimer = setTimeout(() => {
            this.processPendingUpdates();
            this.pendingUpdates.clear();
        }, 300); // 300ms debounce
    }
}
```

**Benefits**:
- Reduces CPU usage during bulk file operations
- Prevents UI thrashing
- Batched update processing
- Better user experience during file operations

---

## 🎯 **Extension-Specific Patterns**

### **1. Configuration Observer Pattern**

**Location**: `src/services/lineThresholdService.ts`  
**Purpose**: React to VS Code settings changes  
**Implementation**: Configuration change event handling

```typescript
// Settings change reaction
export class ConfigurationManager {
    constructor() {
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('codeCounter')) {
                this.reloadConfiguration();
            }
        });
    }
    
    private reloadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('codeCounter');
        this.thresholds = config.get('thresholds', defaultThresholds);
        this.emojis = config.get('emojis', defaultEmojis);
        
        // Notify subscribers of configuration changes
        this.emit('configurationChanged', { thresholds: this.thresholds });
    }
}
```

**Benefits**:
- Real-time settings updates
- No extension restart required
- Consistent configuration across components
- User-friendly experience

### **2. WebView Communication Pattern**

**Location**: `src/services/webViewReportService.ts`  
**Purpose**: Secure communication between extension and WebView  
**Implementation**: Message passing with type safety

```typescript
// Secure WebView communication
export class WebViewCommunicator {
    private webview: vscode.Webview;
    
    public sendMessage<T extends MessageType>(
        type: T,
        payload: MessagePayload[T]
    ): void {
        this.webview.postMessage({ type, payload });
    }
    
    public onMessage<T extends MessageType>(
        handler: (type: T, payload: MessagePayload[T]) => void
    ): void {
        this.webview.onDidReceiveMessage(({ type, payload }) => {
            handler(type, payload);
        });
    }
}
```

**Benefits**:
- Type-safe communication
- Clear message contracts
- Security through message validation
- Extensible communication protocol

---

## 🏆 **Pattern Benefits Summary**

### **Maintainability**
- **Clear separation of concerns** through layered architecture
- **Consistent coding patterns** across all components
- **Dependency injection** enables easy testing and modification
- **Interface-based design** allows component swapping

### **Testability**
- **Mock object pattern** enables comprehensive testing without VS Code
- **Dependency injection** allows easy test double injection
- **Command pattern** encapsulates testable user actions
- **Builder pattern** creates readable test data

### **Performance**
- **Cache-aside pattern** dramatically improves file analysis speed
- **Debounce pattern** prevents excessive processing
- **Lazy initialization** optimizes startup time
- **Observer pattern** enables efficient event-driven updates

### **Extensibility**
- **Factory pattern** enables easy language support addition
- **Template method** allows new report formats
- **Decorator pattern** provides non-intrusive UI enhancements
- **Configuration observer** supports runtime customization

---

## 📋 **Pattern Implementation Checklist**

When implementing new features, consider these patterns:

- [ ] **Service Locator**: For new business logic services
- [ ] **Observer**: For event-driven functionality  
- [ ] **Decorator**: For UI enhancements
- [ ] **Command**: For user-triggered actions
- [ ] **Factory**: For strategy selection based on context
- [ ] **Disposable**: For resource management
- [ ] **Cache-Aside**: For performance optimization
- [ ] **Configuration Observer**: For settings-dependent features

---

## 🔗 **Related Documentation**

- [Architecture Overview](./architecture.md) - High-level system design
- [Testing Framework](./testing.md) - Test implementation patterns
- [Services Layer](./services.md) - Service pattern implementations
- [VS Code API Usage](./vscode-api-usage.md) - Extension-specific patterns