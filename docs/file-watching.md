# File Watching System

This document describes the comprehensive file watching system that enables real-time updates and automatic cache invalidation in the VS Code Code Counter extension.

## Overview

The file watching system monitors workspace changes and ensures that line count data remains accurate and up-to-date. It leverages VS Code's native file system APIs to provide efficient, cross-platform file monitoring with minimal performance impact.

## Architecture

### Core Components

#### FileWatcher Service
The central component responsible for monitoring file system changes and coordinating cache updates.

```typescript
class FileWatcher {
  private watchers: Map<string, vscode.FileSystemWatcher>;
  private cache: LineCountCache;
  private debounceMap: Map<string, NodeJS.Timeout>;
  
  constructor(cache: LineCountCache) {
    this.watchers = new Map();
    this.cache = cache;
    this.debounceMap = new Map();
  }
}
```

#### Watcher Registration
Manages the creation and disposal of file system watchers for different file patterns.

```typescript
interface WatcherConfig {
  pattern: string;
  ignoreCreateEvents?: boolean;
  ignoreChangeEvents?: boolean;
  ignoreDeleteEvents?: boolean;
}
```

### Integration Points

The file watcher integrates with multiple system components:

- **LineCountCache**: Invalidates cached line counts
- **FileExplorerDecorator**: Updates visual indicators
- **EditorTabDecorator**: Refreshes tab decorations
- **WebViewReportService**: Triggers report regeneration

## File System Events

### Supported Events

#### File Creation (`onCreate`)
```typescript
private async handleFileCreate(uri: vscode.Uri): Promise<void> {
  const filePath = uri.fsPath;
  
  // Check if file matches counting criteria
  if (this.shouldCountFile(filePath)) {
    // Add to cache with initial count
    const lineCount = await this.countLinesInFile(filePath);
    this.cache.set(filePath, lineCount);
    
    // Update decorations
    this.updateDecorations(filePath);
    
    // Notify listeners
    this.emitCacheUpdate(filePath, lineCount);
  }
}
```

#### File Modification (`onChange`)
```typescript
private async handleFileChange(uri: vscode.Uri): Promise<void> {
  const filePath = uri.fsPath;
  
  // Debounce rapid changes
  this.debounceUpdate(filePath, async () => {
    // Invalidate cache entry
    this.cache.invalidate(filePath);
    
    // Recount lines
    const newCount = await this.countLinesInFile(filePath);
    this.cache.set(filePath, newCount);
    
    // Update UI
    this.refreshDecorations(filePath);
  });
}
```

#### File Deletion (`onDelete`)
```typescript
private handleFileDelete(uri: vscode.Uri): void {
  const filePath = uri.fsPath;
  
  // Remove from cache
  this.cache.remove(filePath);
  
  // Clean up decorations
  this.clearDecorations(filePath);
  
  // Update statistics
  this.updateTotalCounts();
}
```

## Performance Optimizations

### Debouncing Strategy
Prevents excessive processing during rapid file changes:

```typescript
private debounceUpdate(filePath: string, callback: () => Promise<void>): void {
  // Clear existing timeout
  const existingTimeout = this.debounceMap.get(filePath);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  
  // Set new timeout
  const timeout = setTimeout(async () => {
    try {
      await callback();
    } finally {
      this.debounceMap.delete(filePath);
    }
  }, 150); // 150ms debounce
  
  this.debounceMap.set(filePath, timeout);
}
```

### Batch Processing
Groups multiple changes for efficient processing:

```typescript
private batchProcessor = new Map<string, FileChange[]>();
private processingTimer?: NodeJS.Timeout;

private enqueueBatchUpdate(change: FileChange): void {
  const key = change.type;
  const existing = this.batchProcessor.get(key) || [];
  existing.push(change);
  this.batchProcessor.set(key, existing);
  
  // Schedule batch processing
  if (!this.processingTimer) {
    this.processingTimer = setTimeout(() => {
      this.processBatch();
    }, 100);
  }
}
```

### Selective Watching
Only monitors relevant file types and directories:

```typescript
private getWatchPatterns(): string[] {
  const config = vscode.workspace.getConfiguration('codeCounter');
  const includedExtensions = config.get<string[]>('includedExtensions');
  const excludedPaths = config.get<string[]>('excludedPaths');
  
  return includedExtensions.map(ext => `**/*.${ext}`)
    .filter(pattern => !this.isExcluded(pattern, excludedPaths));
}
```

## Configuration

### Watch Settings
Configurable options for file watching behavior:

```json
{
  "codeCounter.fileWatching": {
    "enabled": true,
    "debounceDelay": 150,
    "batchSize": 50,
    "maxWatchers": 100,
    "ignorePattern": [
      "**/node_modules/**",
      "**/dist/**",
      "**/.git/**"
    ]
  }
}
```

### Dynamic Configuration
Updates watching behavior based on configuration changes:

```typescript
private onConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
  if (event.affectsConfiguration('codeCounter.fileWatching')) {
    // Recreate watchers with new configuration
    this.disposeWatchers();
    this.initializeWatchers();
  }
}
```

## Error Handling

### Watcher Failures
Graceful handling of file system watcher failures:

```typescript
private handleWatcherError(error: Error, pattern: string): void {
  console.error(`File watcher error for pattern ${pattern}:`, error);
  
  // Attempt recovery
  setTimeout(() => {
    try {
      this.recreateWatcher(pattern);
    } catch (retryError) {
      // Disable watching for this pattern
      this.disablePattern(pattern);
    }
  }, 5000);
}
```

### Permission Issues
Handling access denied scenarios:

```typescript
private async handlePermissionError(filePath: string): Promise<void> {
  // Log warning
  console.warn(`Permission denied for file: ${filePath}`);
  
  // Remove from watch list
  this.excludeFromWatching(filePath);
  
  // Notify user if necessary
  if (this.isImportantFile(filePath)) {
    vscode.window.showWarningMessage(
      `Cannot watch file: ${filePath}. Permission denied.`
    );
  }
}
```

## Memory Management

### Watcher Lifecycle
Proper disposal of file system watchers:

```typescript
public dispose(): void {
  // Clear all debounce timers
  this.debounceMap.forEach(timer => clearTimeout(timer));
  this.debounceMap.clear();
  
  // Dispose all watchers
  this.watchers.forEach(watcher => watcher.dispose());
  this.watchers.clear();
  
  // Clear batch processor
  if (this.processingTimer) {
    clearTimeout(this.processingTimer);
  }
  this.batchProcessor.clear();
}
```

### Memory Leak Prevention
Strategies to prevent memory leaks:

```typescript
private cleanupStaleReferences(): void {
  // Remove watchers for non-existent files
  this.watchers.forEach((watcher, pattern) => {
    if (!this.patternHasFiles(pattern)) {
      watcher.dispose();
      this.watchers.delete(pattern);
    }
  });
  
  // Clean up debounce map
  this.debounceMap.forEach((timer, filePath) => {
    if (!this.fileExists(filePath)) {
      clearTimeout(timer);
      this.debounceMap.delete(filePath);
    }
  });
}
```

## Integration Examples

### Cache Integration
Seamless integration with the line count cache:

```typescript
private async updateCacheFromWatcher(uri: vscode.Uri): Promise<void> {
  const filePath = uri.fsPath;
  
  try {
    const stats = await vscode.workspace.fs.stat(uri);
    const lastModified = stats.mtime;
    
    // Check if cache is stale
    if (this.cache.isStale(filePath, lastModified)) {
      // Invalidate and recount
      this.cache.invalidate(filePath);
      const newCount = await this.lineCounter.countLines(filePath);
      this.cache.set(filePath, newCount, lastModified);
    }
  } catch (error) {
    // Handle file access errors
    this.handleFileAccessError(filePath, error);
  }
}
```

### UI Updates
Coordinating UI updates across multiple providers:

```typescript
private async refreshAllDecorations(): Promise<void> {
  // Update file explorer decorations
  if (this.fileExplorerDecorator) {
    await this.fileExplorerDecorator.refresh();
  }
  
  // Update editor tab decorations
  if (this.editorTabDecorator) {
    await this.editorTabDecorator.refresh();
  }
  
  // Update status bar
  if (this.statusBarManager) {
    this.statusBarManager.updateCounts();
  }
  
  // Refresh WebView if open
  if (this.webViewReportService.isVisible()) {
    await this.webViewReportService.refresh();
  }
}
```

## Testing

### Mock File System
Testing file watching with mock file system events:

```typescript
describe('FileWatcher', () => {
  let fileWatcher: FileWatcher;
  let mockCache: jest.Mocked<LineCountCache>;
  let mockFileSystemWatcher: jest.Mocked<vscode.FileSystemWatcher>;
  
  beforeEach(() => {
    mockCache = createMockCache();
    fileWatcher = new FileWatcher(mockCache);
  });
  
  it('should handle file creation events', async () => {
    const testUri = vscode.Uri.file('/test/file.ts');
    
    await fileWatcher.handleFileCreate(testUri);
    
    expect(mockCache.set).toHaveBeenCalledWith(
      testUri.fsPath,
      expect.any(Number)
    );
  });
});
```

### Performance Testing
Validating performance under load:

```typescript
describe('FileWatcher Performance', () => {
  it('should handle rapid file changes efficiently', async () => {
    const startTime = Date.now();
    const promises = [];
    
    // Simulate 100 rapid changes
    for (let i = 0; i < 100; i++) {
      const uri = vscode.Uri.file(`/test/file${i}.ts`);
      promises.push(fileWatcher.handleFileChange(uri));
    }
    
    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});
```

## Monitoring and Diagnostics

### Performance Metrics
Tracking file watching performance:

```typescript
interface WatcherMetrics {
  totalWatchers: number;
  activeWatchers: number;
  eventsProcessed: number;
  averageProcessingTime: number;
  cacheHitRate: number;
}

private collectMetrics(): WatcherMetrics {
  return {
    totalWatchers: this.watchers.size,
    activeWatchers: this.getActiveWatcherCount(),
    eventsProcessed: this.eventCounter,
    averageProcessingTime: this.calculateAverageTime(),
    cacheHitRate: this.cache.getHitRate()
  };
}
```

### Debug Logging
Comprehensive logging for troubleshooting:

```typescript
private logWatchEvent(event: string, uri: vscode.Uri): void {
  if (this.isDebugMode()) {
    console.log(`FileWatcher: ${event} - ${uri.fsPath}`, {
      timestamp: new Date().toISOString(),
      watcherCount: this.watchers.size,
      cacheSize: this.cache.size(),
      memoryUsage: process.memoryUsage()
    });
  }
}
```

The file watching system provides robust, efficient monitoring of workspace changes while maintaining excellent performance characteristics and seamless integration with the extension's caching and UI systems.