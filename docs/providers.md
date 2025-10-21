<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

Repository: https://github.com/DelightfulGames/vscode-code-counter
Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->
# Providers Layer Documentation

## 🎨 **Overview**

The Providers layer serves as the bridge between the VS Code API and the extension's business logic. It handles UI integration, file system monitoring, and user interaction patterns. This document covers the implementation of all provider components and their integration with VS Code's extension system.

---

## 🗂️ **Provider Architecture**

### **Provider Hierarchy**

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code API                          │
├─────────────────────────────────────────────────────────┤
│                 Providers Layer                         │
│  ┌──────────────────────┐  ┌─────────────────────────┐  │
│  │ FileExplorerDecorator│  │  EditorTabDecorator     │  │
│  │ (File Badges)        │  │  (Status Bar)           │  │
│  └──────────────────────┘  └─────────────────────────┘  │
│  ┌─────────────────────┐  ┌─────────────────────────┐   │
│  │    FileWatcher      │  │  ConfigurationProvider  │   │
│  │ (Change Detection)  │  │  (Settings Management)  │   │
│  └─────────────────────┘  └─────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                 Services Layer                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 **File Explorer Decorator**

### **Implementation Overview**

The `FileExplorerDecorator` provides visual line count indicators in VS Code's file explorer using emoji badges.

```typescript
// File explorer decoration provider
export class FileExplorerDecorator implements vscode.FileDecorationProvider {
    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
    
    private cacheService: LineCountCache;
    private thresholdService: LineThresholdService;
    
    constructor() {
        this.cacheService = new LineCountCache();
        this.thresholdService = new LineThresholdService();
    }
    
    public provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        return this.createDecoration(uri);
    }
    
    private createDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        try {
            const filePath = uri.fsPath;
            
            // Skip directories and excluded files
            if (this.shouldSkipFile(filePath)) {
                return undefined;
            }
            
            // Get cached line count
            const lineCount = this.cacheService.getLineCount(filePath);
            if (lineCount === null) {
                return undefined; // Not analyzed yet
            }
            
            // Get appropriate emoji based on line count
            const emoji = this.thresholdService.getEmojiForLineCount(lineCount);
            
            return {
                badge: emoji,
                tooltip: `Lines: ${lineCount}`,
                propagate: false // Don't propagate to parent directories
            };
            
        } catch (error) {
            console.error('Error creating file decoration:', error);
            return undefined;
        }
    }
}
```

### **Decoration Features**

**Visual Integration**:
- **Non-intrusive Design**: Doesn't interfere with Git status colors
- **Theme Compatibility**: Works with all VS Code themes
- **Performance Optimized**: Only decorates analyzed files
- **Real-time Updates**: Refreshes when files change

**Smart Filtering**:
```typescript
// Intelligent file filtering
private shouldSkipFile(filePath: string): boolean {
    const stat = fs.statSync(filePath);
    
    // Skip directories
    if (stat.isDirectory()) {
        return true;
    }
    
    // Skip excluded patterns
    const excludePatterns = this.getExcludePatterns();
    for (const pattern of excludePatterns) {
        if (minimatch(filePath, pattern)) {
            return true;
        }
    }
    
    // Skip binary files
    if (this.isBinaryFile(filePath)) {
        return true;
    }
    
    return false;
}
```

### **Performance Optimizations**

**Event Debouncing**:
```typescript
// Debounced refresh to prevent UI thrashing
export class DebouncedDecorator extends FileExplorerDecorator {
    private refreshTimer?: NodeJS.Timeout;
    private pendingRefreshes = new Set<string>();
    
    public refresh(uri?: vscode.Uri): void {
        if (uri) {
            this.pendingRefreshes.add(uri.fsPath);
        }
        
        // Clear existing timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        // Set new timer
        this.refreshTimer = setTimeout(() => {
            this.performRefresh();
        }, 150); // 150ms debounce
    }
    
    private performRefresh(): void {
        if (this.pendingRefreshes.size > 0) {
            const uris = Array.from(this.pendingRefreshes).map(path => vscode.Uri.file(path));
            this._onDidChangeFileDecorations.fire(uris);
            this.pendingRefreshes.clear();
        } else {
            // Refresh all decorations
            this._onDidChangeFileDecorations.fire(undefined);
        }
    }
}
```

**Selective Updates**:
```typescript
// Update only changed files for better performance
public async updateDecoration(uri: vscode.Uri): Promise<void> {
    const filePath = uri.fsPath;
    
    // Check if file needs decoration update
    const currentDecoration = this.getExistingDecoration(filePath);
    const newDecoration = this.createDecoration(uri);
    
    // Only fire event if decoration actually changed
    if (!this.decorationsEqual(currentDecoration, newDecoration)) {
        this._onDidChangeFileDecorations.fire(uri);
    }
}
```

---

## 📊 **Status Bar Provider (Editor Tab Decorator)**

### **Implementation Overview**

The `EditorTabDecorator` displays live line count information in VS Code's status bar.

```typescript
// Status bar integration provider
export class EditorTabDecorator implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];
    private cacheService: LineCountCache;
    private thresholdService: LineThresholdService;
    
    constructor() {
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100 // Priority
        );
        
        this.cacheService = new LineCountCache();
        this.thresholdService = new LineThresholdService();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initial update
        this.updateStatusBar();
    }
    
    private setupEventListeners(): void {
        // Update when active editor changes
        const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(() => {
            this.updateStatusBar();
        });
        
        // Update when document content changes
        const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document === vscode.window.activeTextEditor?.document) {
                this.scheduleStatusBarUpdate();
            }
        });
        
        this.disposables.push(activeEditorListener, documentChangeListener);
    }
}
```

### **Status Bar Features**

**Live Information Display**:
```typescript
// Real-time status bar updates
private updateStatusBar(): void {
    const activeEditor = vscode.window.activeTextEditor;
    
    if (!activeEditor) {
        this.statusBarItem.hide();
        return;
    }
    
    const document = activeEditor.document;
    const filePath = document.fileName;
    
    // Get line count (from cache or calculate)
    const lineCount = this.getOrCalculateLineCount(document);
    
    // Get complexity indicator
    const emoji = this.thresholdService.getEmojiForLineCount(lineCount);
    const complexityText = this.getComplexityText(lineCount);
    
    // Update status bar
    this.statusBarItem.text = `$(file-code) ${lineCount} lines ${emoji}`;
    this.statusBarItem.tooltip = `File: ${path.basename(filePath)}\nLines: ${lineCount}\nComplexity: ${complexityText}`;
    this.statusBarItem.command = 'codeCounter.countLines';
    
    this.statusBarItem.show();
}
```

**Intelligent Updates**:
```typescript
// Debounced status bar updates for performance
private updateTimer?: NodeJS.Timeout;

private scheduleStatusBarUpdate(): void {
    // Clear existing timer
    if (this.updateTimer) {
        clearTimeout(this.updateTimer);
    }
    
    // Schedule update
    this.updateTimer = setTimeout(() => {
        this.updateStatusBar();
    }, 200); // 200ms debounce
}
```

### **Interactive Features**

**Click Actions**:
```typescript
// Status bar click handling
private setupStatusBarCommands(): void {
    // Register click command
    const clickCommand = vscode.commands.registerCommand(
        'codeCounter.statusBarClick',
        async () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) return;
            
            // Show quick pick with options
            const options = [
                'Analyze Current File',
                'Analyze Workspace',
                'Open Settings',
                'Generate Report'
            ];
            
            const selection = await vscode.window.showQuickPick(options, {
                placeHolder: 'Choose an action'
            });
            
            switch (selection) {
                case 'Analyze Current File':
                    await this.analyzeCurrentFile();
                    break;
                case 'Analyze Workspace':
                    await vscode.commands.executeCommand('codeCounter.countLines');
                    break;
                case 'Open Settings':
                    await vscode.commands.executeCommand('codeCounter.openSettings');
                    break;
                case 'Generate Report':
                    await this.generateQuickReport();
                    break;
            }
        }
    );
    
    this.disposables.push(clickCommand);
}
```

---

## 👁️ **File Watcher Provider**

### **Implementation Overview**

The `FileWatcher` monitors file system changes and triggers appropriate cache updates and UI refreshes.

```typescript
// Intelligent file system monitoring
export class FileWatcher implements vscode.Disposable {
    private watchers: vscode.FileSystemWatcher[] = [];
    private disposables: vscode.Disposable[] = [];
    private cacheService: LineCountCache;
    private decorationProvider: FileExplorerDecorator;
    
    constructor(cacheService: LineCountCache, decorationProvider: FileExplorerDecorator) {
        this.cacheService = cacheService;
        this.decorationProvider = decorationProvider;
        this.initializeWatchers();
    }
    
    private initializeWatchers(): void {
        // Watch for file changes in relevant directories
        const patterns = [
            '**/*.{js,ts,jsx,tsx}',
            '**/*.{py,java,c,cpp,cs}',
            '**/*.{html,css,scss,less}',
            '**/*.{md,txt,json,xml}'
        ];
        
        patterns.forEach(pattern => {
            this.createWatcher(pattern);
        });
    }
    
    private createWatcher(pattern: string): void {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        // Handle file changes
        watcher.onDidChange(this.handleFileChange.bind(this));
        watcher.onDidCreate(this.handleFileCreate.bind(this));
        watcher.onDidDelete(this.handleFileDelete.bind(this));
        
        this.watchers.push(watcher);
        this.disposables.push(watcher);
    }
}
```

### **Event Handling**

**File Change Processing**:
```typescript
// Handle file system events with debouncing
private changeQueue = new Map<string, NodeJS.Timeout>();

private async handleFileChange(uri: vscode.Uri): Promise<void> {
    const filePath = uri.fsPath;
    
    // Debounce rapid changes to the same file
    if (this.changeQueue.has(filePath)) {
        clearTimeout(this.changeQueue.get(filePath)!);
    }
    
    const timeout = setTimeout(async () => {
        await this.processFileChange(uri);
        this.changeQueue.delete(filePath);
    }, 300);
    
    this.changeQueue.set(filePath, timeout);
}

private async processFileChange(uri: vscode.Uri): Promise<void> {
    try {
        // Invalidate cache entry
        await this.cacheService.invalidate(uri.fsPath);
        
        // Update file decoration
        this.decorationProvider.refresh(uri);
        
        // Update status bar if it's the active file
        if (this.isActiveFile(uri)) {
            this.statusBarProvider.updateStatusBar();
        }
        
    } catch (error) {
        console.error('Error processing file change:', error);
    }
}
```

**Batch Processing**:
```typescript
// Batch process multiple file changes for performance
private pendingChanges = new Set<string>();
private batchTimer?: NodeJS.Timeout;

private scheduleBatchUpdate(uri: vscode.Uri): void {
    this.pendingChanges.add(uri.fsPath);
    
    if (this.batchTimer) {
        clearTimeout(this.batchTimer);
    }
    
    this.batchTimer = setTimeout(() => {
        this.processBatchUpdates();
    }, 500); // 500ms batch window
}

private async processBatchUpdates(): Promise<void> {
    const filePaths = Array.from(this.pendingChanges);
    this.pendingChanges.clear();
    
    // Process in chunks for better performance
    const chunkSize = 20;
    for (let i = 0; i < filePaths.length; i += chunkSize) {
        const chunk = filePaths.slice(i, i + chunkSize);
        await Promise.all(chunk.map(path => this.processFileUpdate(path)));
    }
    
    // Refresh decorations for all changed files
    const uris = filePaths.map(path => vscode.Uri.file(path));
    this.decorationProvider.refresh();
}
```

---

## ⚙️ **Configuration Provider**

### **Settings Integration**

```typescript
// Configuration management provider
export class ConfigurationProvider implements vscode.Disposable {
    private readonly _onDidChangeConfiguration = new vscode.EventEmitter<ConfigurationChangeEvent>();
    readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    
    private disposables: vscode.Disposable[] = [];
    private currentConfiguration: CodeCounterConfiguration;
    
    constructor() {
        this.currentConfiguration = this.loadConfiguration();
        this.setupConfigurationWatcher();
    }
    
    private setupConfigurationWatcher(): void {
        const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('codeCounter')) {
                this.handleConfigurationChange(event);
            }
        });
        
        this.disposables.push(configWatcher);
    }
    
    private async handleConfigurationChange(event: vscode.ConfigurationChangeEvent): Promise<void> {
        const previousConfig = { ...this.currentConfiguration };
        this.currentConfiguration = this.loadConfiguration();
        
        // Determine what changed
        const changes: ConfigurationChangeEvent = {
            emojis: event.affectsConfiguration('codeCounter.emojis'),
            thresholds: event.affectsConfiguration('codeCounter.thresholds'),
            exclude: event.affectsConfiguration('codeCounter.exclude'),
            performance: event.affectsConfiguration('codeCounter.performance')
        };
        
        // Fire change event
        this._onDidChangeConfiguration.fire(changes);
        
        // Handle specific changes
        await this.processConfigurationChanges(changes, previousConfig);
    }
}
```

### **Dynamic Configuration Updates**

```typescript
// Handle real-time configuration changes
private async processConfigurationChanges(
    changes: ConfigurationChangeEvent,
    previousConfig: CodeCounterConfiguration
): Promise<void> {
    
    // Handle emoji changes
    if (changes.emojis) {
        await this.updateFileDecorations();
        await this.updateStatusBar();
    }
    
    // Handle threshold changes
    if (changes.thresholds) {
        await this.recalculateAllIndicators();
    }
    
    // Handle exclusion pattern changes
    if (changes.exclude) {
        await this.refreshWorkspaceAnalysis();
    }
    
    // Handle performance setting changes
    if (changes.performance) {
        await this.updatePerformanceSettings();
    }
}

private async updateFileDecorations(): Promise<void> {
    // Get all currently decorated files
    const decoratedFiles = await this.getDecoratedFiles();
    
    // Refresh decorations for all files
    decoratedFiles.forEach(uri => {
        this.decorationProvider.refresh(uri);
    });
}
```

---

## 🎛️ **WebView Provider** 

### **Settings UI Provider**

```typescript
// WebView-based configuration interface
export class WebViewProvider implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];
    
    constructor(private context: vscode.ExtensionContext) {}
    
    public async showSettings(): Promise<void> {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }
        
        this.panel = vscode.window.createWebviewPanel(
            'codeCounterSettings',
            'Code Counter Settings',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                enableFindWidget: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );
        
        await this.setupWebView();
    }
    
    private async setupWebView(): Promise<void> {
        if (!this.panel) return;
        
        // Load HTML content
        this.panel.webview.html = await this.getWebViewContent();
        
        // Setup message handling
        this.panel.webview.onDidReceiveMessage(
            this.handleWebViewMessage.bind(this),
            undefined,
            this.disposables
        );
        
        // Handle panel disposal
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        }, null, this.disposables);
    }
}
```

---

## 🧪 **Provider Testing**

### **Mock Provider Setup**

```typescript
// Provider testing with comprehensive mocks
describe('FileExplorerDecorator', () => {
    let decorator: FileExplorerDecorator;
    let mockCacheService: sinon.SinonStubbedInstance<LineCountCache>;
    let mockThresholdService: sinon.SinonStubbedInstance<LineThresholdService>;
    
    beforeEach(() => {
        mockCacheService = sinon.createStubInstance(LineCountCache);
        mockThresholdService = sinon.createStubInstance(LineThresholdService);
        
        decorator = new FileExplorerDecorator(mockCacheService, mockThresholdService);
    });
    
    it('should provide decoration for analyzed files', () => {
        // Setup mocks
        mockCacheService.getLineCount.returns(156);
        mockThresholdService.getEmojiForLineCount.returns('🟡');
        
        const uri = vscode.Uri.file('/test/file.ts');
        const decoration = decorator.provideFileDecoration(uri);
        
        expect(decoration).to.not.be.undefined;
        expect(decoration!.badge).to.equal('🟡');
        expect(decoration!.tooltip).to.equal('Lines: 156');
    });
    
    it('should return undefined for non-analyzed files', () => {
        mockCacheService.getLineCount.returns(null);
        
        const uri = vscode.Uri.file('/test/file.ts');
        const decoration = decorator.provideFileDecoration(uri);
        
        expect(decoration).to.be.undefined;
    });
});
```

### **Integration Testing**

```typescript
// Integration tests for provider interactions
describe('Provider Integration', () => {
    it('should update decorations when file changes', async () => {
        const fileWatcher = new FileWatcher(cacheService, decorationProvider);
        const testUri = vscode.Uri.file('/test/changed-file.ts');
        
        // Simulate file change
        await fileWatcher.handleFileChange(testUri);
        
        // Verify cache invalidation
        expect(mockCacheService.invalidate).to.have.been.calledWith(testUri.fsPath);
        
        // Verify decoration refresh
        expect(mockDecorationProvider.refresh).to.have.been.calledWith(testUri);
    });
});
```

---

## 📊 **Performance Optimization**

### **Provider Performance Best Practices**

1. **Debounced Updates**: Prevent UI thrashing during rapid changes
2. **Selective Refreshes**: Update only changed decorations
3. **Batch Processing**: Handle multiple changes efficiently
4. **Lazy Loading**: Initialize providers on-demand
5. **Memory Management**: Proper disposal of event listeners

### **Memory Usage Optimization**

```typescript
// Memory-efficient provider management
export class OptimizedProviderManager {
    private static readonly MAX_CACHED_DECORATIONS = 1000;
    private decorationCache = new Map<string, vscode.FileDecoration>();
    
    public getDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        const key = uri.fsPath;
        
        // Check cache first
        if (this.decorationCache.has(key)) {
            return this.decorationCache.get(key);
        }
        
        // Create new decoration
        const decoration = this.createDecoration(uri);
        
        // Cache with size limit
        if (this.decorationCache.size >= OptimizedProviderManager.MAX_CACHED_DECORATIONS) {
            // Remove oldest entries (simple FIFO)
            const firstKey = this.decorationCache.keys().next().value;
            this.decorationCache.delete(firstKey);
        }
        
        this.decorationCache.set(key, decoration);
        return decoration;
    }
}
```

---

## 🔗 **Provider Communication**

### **Inter-Provider Messaging**

```typescript
// Event-based communication between providers
export class ProviderEventBus {
    private readonly _onFileAnalyzed = new vscode.EventEmitter<FileAnalyzedEvent>();
    private readonly _onConfigurationChanged = new vscode.EventEmitter<ConfigurationChangeEvent>();
    
    readonly onFileAnalyzed = this._onFileAnalyzed.event;
    readonly onConfigurationChanged = this._onConfigurationChanged.event;
    
    public notifyFileAnalyzed(uri: vscode.Uri, lineCount: number): void {
        this._onFileAnalyzed.fire({ uri, lineCount });
    }
    
    public notifyConfigurationChanged(changes: ConfigurationChangeEvent): void {
        this._onConfigurationChanged.fire(changes);
    }
}

// Provider subscription to events
export class EventAwareProvider implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    
    constructor(private eventBus: ProviderEventBus) {
        this.setupEventListeners();
    }
    
    private setupEventListeners(): void {
        const fileAnalyzedListener = this.eventBus.onFileAnalyzed(this.handleFileAnalyzed.bind(this));
        const configChangedListener = this.eventBus.onConfigurationChanged(this.handleConfigurationChanged.bind(this));
        
        this.disposables.push(fileAnalyzedListener, configChangedListener);
    }
}
```

---

## 🔗 **Related Documentation**

- [Extension Entry Point](./extension-entry.md) - Provider registration and lifecycle
- [Services Layer](./services.md) - Business logic integration
- [VS Code API Usage](./vscode-api-usage.md) - API integration patterns
- [Configuration System](./configuration.md) - Settings provider integration
- [Testing Framework](./testing.md) - Provider testing strategies