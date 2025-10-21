<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

Repository: https://github.com/DelightfulGames/vscode-code-counter
Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->
# Extension Entry Point Documentation

## 🚀 **Overview**

The extension entry point (`src/extension.ts`) serves as the main activation and lifecycle management hub for the VS Code Code Counter extension. This document covers the activation process, service initialization, command registration, and proper resource disposal.

---

## 🔧 **Extension Lifecycle**

### **Activation Process**

The extension follows VS Code's standard activation pattern with enhanced initialization:

```typescript
// Main activation function
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Code Counter extension is being activated...');
    
    try {
        // 1. Initialize core services
        await initializeServices(context);
        
        // 2. Register commands
        registerCommands(context);
        
        // 3. Setup providers
        setupProviders(context);
        
        // 4. Initialize file watchers
        initializeFileWatchers(context);
        
        // 5. Setup configuration listeners
        setupConfigurationListeners(context);
        
        console.log('Code Counter extension activated successfully');
    } catch (error) {
        console.error('Failed to activate Code Counter extension:', error);
        vscode.window.showErrorMessage(`Code Counter activation failed: ${error.message}`);
    }
}
```

### **Deactivation Process**

```typescript
// Cleanup function called when extension is deactivated
export function deactivate(): Thenable<void> | undefined {
    console.log('Code Counter extension is being deactivated...');
    
    // Cleanup is handled automatically through VS Code's disposable pattern
    // All registered disposables in context.subscriptions will be disposed
    
    return undefined;
}
```

---

## ⚙️ **Service Initialization**

### **Core Service Registration**

```typescript
// Service initialization with dependency injection
async function initializeServices(context: vscode.ExtensionContext): Promise<void> {
    // Create service container
    const serviceContainer = new ServiceContainer();
    
    // Initialize cache service first (needed by other services)
    const cacheService = new LineCountCache();
    serviceContainer.register('cache', cacheService);
    
    // Initialize line counter service
    const lineCounterService = new LineCounterService(cacheService);
    serviceContainer.register('lineCounter', lineCounterService);
    
    // Initialize threshold service
    const thresholdService = new LineThresholdService();
    serviceContainer.register('threshold', thresholdService);
    
    // Initialize generators
    const htmlGenerator = new HtmlGenerator();
    const xmlGenerator = new XmlGenerator();
    serviceContainer.register('htmlGenerator', htmlGenerator);
    serviceContainer.register('xmlGenerator', xmlGenerator);
    
    // Initialize WebView service
    const webViewService = new WebViewReportService(context);
    serviceContainer.register('webView', webViewService);
    
    // Store service container globally
    context.globalState.update('serviceContainer', serviceContainer);
}
```

### **Service Container Pattern**

```typescript
// Centralized service management
export class ServiceContainer {
    private services = new Map<string, any>();
    private disposables: vscode.Disposable[] = [];
    
    public register<T>(name: string, service: T): void {
        this.services.set(name, service);
        
        // Auto-register disposables
        if (service && typeof (service as any).dispose === 'function') {
            this.disposables.push(service as any);
        }
    }
    
    public get<T>(name: string): T {
        return this.services.get(name);
    }
    
    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.services.clear();
    }
}
```

---

## 📋 **Command Registration**

### **Centralized Command Setup**

```typescript
// Register all extension commands
function registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
        // Primary analysis command
        vscode.commands.registerCommand(
            'codeCounter.countLines',
            async () => {
                try {
                    await CountLinesCommand.execute();
                } catch (error) {
                    console.error('Count lines command failed:', error);
                    vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
                }
            }
        ),
        
        // Settings management command
        vscode.commands.registerCommand(
            'codeCounter.openSettings',
            async () => {
                try {
                    await OpenSettingsCommand.execute();
                } catch (error) {
                    console.error('Open settings command failed:', error);
                    vscode.window.showErrorMessage(`Settings failed to open: ${error.message}`);
                }
            }
        ),
        
        // Reset configuration command
        vscode.commands.registerCommand(
            'codeCounter.resetBadgeSettings',
            async () => {
                try {
                    await ResetBadgeSettingsCommand.execute();
                } catch (error) {
                    console.error('Reset settings command failed:', error);
                    vscode.window.showErrorMessage(`Reset failed: ${error.message}`);
                }
            }
        )
    ];
    
    // Register all commands for proper disposal
    context.subscriptions.push(...commands);
}
```

### **Command Error Handling**

```typescript
// Robust command wrapper with error handling
function createSafeCommand(
    commandId: string,
    handler: (...args: any[]) => Promise<void>
): vscode.Disposable {
    return vscode.commands.registerCommand(commandId, async (...args) => {
        try {
            await handler(...args);
        } catch (error) {
            console.error(`Command ${commandId} failed:`, error);
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await vscode.window.showErrorMessage(
                `Code Counter: ${errorMessage}`,
                'Show Details'
            ).then(selection => {
                if (selection === 'Show Details') {
                    console.log('Full error details:', error);
                }
            });
        }
    });
}
```

---

## 🎨 **Provider Setup**

### **UI Provider Registration**

```typescript
// Setup all VS Code integration providers
function setupProviders(context: vscode.ExtensionContext): void {
    // File explorer decoration provider
    const fileExplorerDecorator = new FileExplorerDecorator();
    const decorationDisposable = vscode.window.registerFileDecorationProvider(
        fileExplorerDecorator
    );
    context.subscriptions.push(decorationDisposable);
    
    // Status bar provider
    const statusBarProvider = new EditorTabDecorator();
    context.subscriptions.push(statusBarProvider);
    
    // Store providers for later access
    context.globalState.update('fileExplorerDecorator', fileExplorerDecorator);
    context.globalState.update('statusBarProvider', statusBarProvider);
}
```

### **Provider Lifecycle Management**

```typescript
// Provider management with proper cleanup
export class ProviderManager {
    private providers: vscode.Disposable[] = [];
    
    public registerProvider<T extends vscode.Disposable>(provider: T): T {
        this.providers.push(provider);
        return provider;
    }
    
    public dispose(): void {
        this.providers.forEach(provider => provider.dispose());
        this.providers.length = 0;
    }
}
```

---

## 👁️ **File Watcher Initialization**

### **Smart File Monitoring**

```typescript
// Initialize intelligent file system watching
function initializeFileWatchers(context: vscode.ExtensionContext): void {
    const fileWatcher = new FileWatcher();
    
    // Watch for relevant file changes
    const watcher = fileWatcher.watchWorkspace(async (uri) => {
        const cacheService = getService<LineCountCache>('cache');
        const decorationProvider = getService<FileExplorerDecorator>('fileExplorerDecorator');
        
        // Invalidate cache for changed file
        await cacheService.invalidate(uri.fsPath);
        
        // Update file decoration
        await decorationProvider.refresh(uri);
    });
    
    context.subscriptions.push(watcher);
}
```

### **Performance-Optimized Watching**

```typescript
// Debounced file watcher for performance
export class DebouncedFileWatcher implements vscode.Disposable {
    private watchers: vscode.FileSystemWatcher[] = [];
    private updateQueue = new Map<string, NodeJS.Timeout>();
    private readonly debounceDelay: number;
    
    constructor(debounceDelay: number = 300) {
        this.debounceDelay = debounceDelay;
    }
    
    public watchWorkspace(callback: (uri: vscode.Uri) => void): vscode.Disposable {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        const debouncedCallback = (uri: vscode.Uri) => {
            const key = uri.fsPath;
            
            // Clear existing timeout
            if (this.updateQueue.has(key)) {
                clearTimeout(this.updateQueue.get(key)!);
            }
            
            // Set new timeout
            const timeout = setTimeout(() => {
                callback(uri);
                this.updateQueue.delete(key);
            }, this.debounceDelay);
            
            this.updateQueue.set(key, timeout);
        };
        
        watcher.onDidChange(debouncedCallback);
        watcher.onDidCreate(debouncedCallback);
        watcher.onDidDelete(debouncedCallback);
        
        this.watchers.push(watcher);
        return watcher;
    }
    
    public dispose(): void {
        this.watchers.forEach(watcher => watcher.dispose());
        this.updateQueue.forEach(timeout => clearTimeout(timeout));
        this.updateQueue.clear();
    }
}
```

---

## 🔧 **Configuration Listeners**

### **Real-time Configuration Updates**

```typescript
// Setup configuration change handling
function setupConfigurationListeners(context: vscode.ExtensionContext): void {
    const configListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (!event.affectsConfiguration('codeCounter')) {
            return;
        }
        
        console.log('Code Counter configuration changed');
        
        try {
            // Handle emoji changes
            if (event.affectsConfiguration('codeCounter.emojis')) {
                await refreshFileDecorations();
            }
            
            // Handle threshold changes  
            if (event.affectsConfiguration('codeCounter.thresholds')) {
                await recalculateIndicators();
            }
            
            // Handle exclusion pattern changes
            if (event.affectsConfiguration('codeCounter.exclude')) {
                await refreshWorkspaceAnalysis();
            }
            
        } catch (error) {
            console.error('Configuration update failed:', error);
        }
    });
    
    context.subscriptions.push(configListener);
}
```

### **Configuration Migration**

```typescript
// Handle configuration format changes between versions
async function handleConfigurationMigration(): Promise<void> {
    const config = vscode.workspace.getConfiguration('codeCounter');
    const configVersion = config.get('version', '0.0.0');
    const currentVersion = '0.7.0'; // Current extension version
    
    if (isOlderVersion(configVersion, currentVersion)) {
        await migrateConfiguration(configVersion, currentVersion);
    }
}

async function migrateConfiguration(from: string, to: string): Promise<void> {
    console.log(`Migrating configuration from ${from} to ${to}`);
    
    // Perform version-specific migrations
    if (isOlderVersion(from, '0.7.0')) {
        await migrateToV070();
    }
    
    // Update version number
    const config = vscode.workspace.getConfiguration('codeCounter');
    await config.update('version', to, vscode.ConfigurationTarget.Global);
}
```

---

## 🧪 **Testing Support**

### **Test-Friendly Activation**

```typescript
// Modified activation for testing scenarios
export async function activate(
    context: vscode.ExtensionContext,
    testMode: boolean = false
): Promise<ExtensionAPI> {
    if (testMode) {
        // Simplified activation for testing
        return await activateForTesting(context);
    }
    
    // Normal activation
    await normalActivation(context);
    
    // Return API for external access
    return {
        serviceContainer: getServiceContainer(context),
        commands: getRegisteredCommands(context)
    };
}

// Test-specific activation
async function activateForTesting(context: vscode.ExtensionContext): Promise<ExtensionAPI> {
    // Initialize only essential services for testing
    const mockServices = createMockServices();
    context.globalState.update('serviceContainer', mockServices);
    
    return {
        serviceContainer: mockServices,
        commands: []
    };
}
```

### **Extension API Interface**

```typescript
// Public API for external access and testing
export interface ExtensionAPI {
    serviceContainer: ServiceContainer;
    commands: string[];
    
    // Public methods for programmatic access
    analyzeWorkspace(): Promise<AnalysisResult>;
    generateReport(format: 'html' | 'xml'): Promise<string>;
    updateConfiguration(config: Partial<CodeCounterConfiguration>): Promise<void>;
}
```

---

## 🔍 **Debugging and Diagnostics**

### **Extension Health Monitoring**

```typescript
// Health check and diagnostic information
export class ExtensionDiagnostics {
    public static async checkHealth(): Promise<HealthReport> {
        const report: HealthReport = {
            status: 'healthy',
            services: {},
            configuration: {},
            performance: {}
        };
        
        try {
            // Check service availability
            const serviceContainer = getServiceContainer();
            report.services = {
                lineCounter: !!serviceContainer.get('lineCounter'),
                cache: !!serviceContainer.get('cache'),
                htmlGenerator: !!serviceContainer.get('htmlGenerator')
            };
            
            // Check configuration validity
            const config = vscode.workspace.getConfiguration('codeCounter');
            report.configuration = {
                emojis: ConfigurationValidator.validateEmojis(config.get('emojis')),
                thresholds: ConfigurationValidator.validateThresholds(config.get('thresholds'))
            };
            
            // Check performance metrics
            const cacheService = serviceContainer.get<LineCountCache>('cache');
            report.performance = {
                cacheHitRate: cacheService.getHitRate(),
                cachedFiles: cacheService.getCacheSize()
            };
            
        } catch (error) {
            report.status = 'error';
            report.error = error.message;
        }
        
        return report;
    }
}
```

### **Error Recovery**

```typescript
// Graceful error recovery mechanisms
export class ErrorRecoveryManager {
    public static async recoverFromError(error: Error): Promise<boolean> {
        console.log('Attempting error recovery for:', error.message);
        
        try {
            // Attempt to reinitialize failed services
            await this.reinitializeServices();
            
            // Clear potentially corrupted cache
            await this.clearCache();
            
            // Reload configuration
            await this.reloadConfiguration();
            
            console.log('Error recovery successful');
            return true;
            
        } catch (recoveryError) {
            console.error('Error recovery failed:', recoveryError);
            return false;
        }
    }
    
    private static async reinitializeServices(): Promise<void> {
        const context = getCurrentExtensionContext();
        await initializeServices(context);
    }
}
```

---

## 📊 **Performance Monitoring**

### **Startup Performance Tracking**

```typescript
// Track extension startup performance
class PerformanceTracker {
    private static startTime: number;
    private static metrics: Map<string, number> = new Map();
    
    public static start(): void {
        this.startTime = Date.now();
    }
    
    public static mark(label: string): void {
        const elapsed = Date.now() - this.startTime;
        this.metrics.set(label, elapsed);
        console.log(`Performance: ${label} at ${elapsed}ms`);
    }
    
    public static getMetrics(): Record<string, number> {
        return Object.fromEntries(this.metrics);
    }
}

// Usage in activation
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    PerformanceTracker.start();
    
    await initializeServices(context);
    PerformanceTracker.mark('Services initialized');
    
    registerCommands(context);
    PerformanceTracker.mark('Commands registered');
    
    setupProviders(context);
    PerformanceTracker.mark('Providers setup');
    
    console.log('Startup metrics:', PerformanceTracker.getMetrics());
}
```

---

## 🔗 **Integration Points**

### **External Extension API**

```typescript
// Expose API for other extensions
export function getAPI(): ExtensionAPI {
    return {
        analyzeFile: async (filePath: string) => {
            const lineCounter = getService<LineCounterService>('lineCounter');
            return await lineCounter.analyzeFile(filePath);
        },
        
        getLineCount: (filePath: string) => {
            const cache = getService<LineCountCache>('cache');
            return cache.getLineCount(filePath);
        },
        
        registerLanguageSupport: (extension: string, config: LanguageConfig) => {
            const lineCounter = getService<LineCounterService>('lineCounter');
            lineCounter.registerLanguage(extension, config);
        }
    };
}
```

### **Workspace Integration**

```typescript
// Integration with VS Code workspace features
async function setupWorkspaceIntegration(context: vscode.ExtensionContext): Promise<void> {
    // Handle workspace folder changes
    vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
        // Reinitialize for new workspace structure
        await handleWorkspaceChange(event);
    });
    
    // Handle file system changes
    vscode.workspace.onDidCreateFiles(async (event) => {
        await handleNewFiles(event.files);
    });
    
    vscode.workspace.onDidDeleteFiles(async (event) => {
        await handleDeletedFiles(event.files);
    });
}
```

---

## 📋 **Best Practices**

### **Activation Guidelines**

1. **Fast Activation**: Keep activation time under 200ms
2. **Error Handling**: Wrap all initialization in try-catch blocks
3. **Resource Management**: Register all disposables with context.subscriptions
4. **Service Isolation**: Initialize services independently when possible
5. **Progressive Enhancement**: Core functionality should work even if some services fail

### **Memory Management**

1. **Disposable Pattern**: Implement disposable for all services
2. **Event Cleanup**: Remove all event listeners in dispose methods
3. **Cache Limits**: Implement cache size limits to prevent memory leaks
4. **Timeout Cleanup**: Clear all timeouts and intervals

### **Error Recovery**

1. **Graceful Degradation**: Continue operation with reduced functionality
2. **User Notification**: Inform users of service failures appropriately
3. **Recovery Attempts**: Try to recover from common error scenarios
4. **Diagnostic Information**: Provide helpful error details for debugging

---

## 🔗 **Related Documentation**

- [Architecture Overview](./architecture.md) - High-level system design
- [Services Layer](./services.md) - Service implementation details
- [Commands System](./commands.md) - Command registration and handling
- [Configuration System](./configuration.md) - Configuration management
- [Testing Framework](./testing.md) - Test setup and mocking strategies