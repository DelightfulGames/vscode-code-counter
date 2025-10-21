<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

Repository: https://github.com/DelightfulGames/vscode-code-counter
Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->
# VS Code API Usage

This document provides a comprehensive overview of how the VS Code Code Counter extension leverages the VS Code API to deliver its functionality, from basic workspace interactions to advanced WebView implementations.

## Overview

The extension makes extensive use of VS Code's rich API surface, implementing features across multiple domains including file system operations, UI customization, configuration management, and WebView integration. This document details the specific API usage patterns and best practices employed.

## Core API Modules

### Workspace API
Foundation for file system operations and workspace management:

```typescript
import * as vscode from 'vscode';

export class WorkspaceManager {
  public async getWorkspaceFolders(): Promise<vscode.WorkspaceFolder[]> {
    return vscode.workspace.workspaceFolders || [];
  }
  
  public async findFiles(pattern: string): Promise<vscode.Uri[]> {
    const exclude = this.getExcludePattern();
    return vscode.workspace.findFiles(pattern, exclude);
  }
  
  private getExcludePattern(): string {
    const config = vscode.workspace.getConfiguration('codeCounter');
    return config.get('excludePattern', '**/node_modules/**');
  }
}
```

### File System API
Modern file operations using the FileSystem API:

```typescript
export class FileSystemService {
  public async readFile(uri: vscode.Uri): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString('utf8');
  }
  
  public async getFileStats(uri: vscode.Uri): Promise<vscode.FileStat> {
    return vscode.workspace.fs.stat(uri);
  }
  
  public async watchFile(uri: vscode.Uri): Promise<vscode.FileSystemWatcher> {
    const pattern = new vscode.RelativePattern(uri, '**/*');
    return vscode.workspace.createFileSystemWatcher(pattern);
  }
}
```

## UI Integration APIs

### Status Bar Integration
Dynamic status bar updates with line count information:

```typescript
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  
  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'codeCounter.showReport';
  }
  
  public updateLineCount(count: number): void {
    this.statusBarItem.text = `$(file-code) ${count} lines`;
    this.statusBarItem.tooltip = `Total lines of code: ${count}`;
    this.statusBarItem.show();
  }
  
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
```

### File Explorer Decorations
Custom decorations for enhanced file explorer experience:

```typescript
export class FileExplorerDecorator implements vscode.FileDecorationProvider {
  private readonly onDidChangeFileDecorationsEmitter = 
    new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  
  public readonly onDidChangeFileDecorations = 
    this.onDidChangeFileDecorationsEmitter.event;
  
  public provideFileDecoration(
    uri: vscode.Uri
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const lineCount = this.getLineCount(uri.fsPath);
    
    if (lineCount > 0) {
      return {
        badge: lineCount.toString(),
        tooltip: `${lineCount} lines of code`,
        color: this.getColorForLineCount(lineCount)
      };
    }
    
    return undefined;
  }
  
  private getColorForLineCount(count: number): vscode.ThemeColor {
    if (count > 1000) {
      return new vscode.ThemeColor('charts.red');
    } else if (count > 500) {
      return new vscode.ThemeColor('charts.orange');
    } else {
      return new vscode.ThemeColor('charts.green');
    }
  }
}
```

### Editor Tab Decorations
Enhanced editor tabs with line count badges:

```typescript
export class EditorTabDecorator implements vscode.TabInputTextDiff {
  public provideTabInputTextDiff(
    tab: vscode.Tab
  ): vscode.ProviderResult<vscode.TabInputTextDiff> {
    if (tab.input instanceof vscode.TabInputText) {
      const uri = tab.input.uri;
      const lineCount = this.getLineCount(uri.fsPath);
      
      return {
        ...tab.input,
        label: `${tab.label} (${lineCount})`
      };
    }
    
    return undefined;
  }
}
```

## WebView Implementation

### WebView Panel Creation
Comprehensive WebView setup for interactive reports:

```typescript
export class WebViewReportService {
  private panel: vscode.WebviewPanel | undefined;
  
  public showReport(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    
    this.panel = vscode.window.createWebviewPanel(
      'codeCounterReport',
      'Code Counter Report',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'templates')
        ]
      }
    );
    
    this.setupWebViewContent();
    this.setupMessageHandling();
  }
  
  private setupWebViewContent(): void {
    if (!this.panel) return;
    
    this.panel.webview.html = this.getWebViewContent();
  }
  
  private setupMessageHandling(): void {
    if (!this.panel) return;
    
    this.panel.webview.onDidReceiveMessage(
      message => this.handleWebViewMessage(message)
    );
  }
}
```

### WebView Resource Loading
Secure resource loading with proper URI handling:

```typescript
private getWebViewContent(): string {
  const scriptUri = this.panel!.webview.asWebviewUri(
    vscode.Uri.joinPath(this.extensionUri, 'templates', 'report.js')
  );
  
  const styleUri = this.panel!.webview.asWebviewUri(
    vscode.Uri.joinPath(this.extensionUri, 'templates', 'report.css')
  );
  
  const nonce = this.getNonce();
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" 
            content="default-src 'none'; 
                     style-src ${this.panel!.webview.cspSource}; 
                     script-src 'nonce-${nonce}';">
      <link href="${styleUri}" rel="stylesheet">
      <title>Code Counter Report</title>
    </head>
    <body>
      <div id="app"></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>
  `;
}
```

## Command Registration

### Command Implementation
Comprehensive command registration and handling:

```typescript
export class CommandManager {
  private context: vscode.ExtensionContext;
  private commands: Map<string, (...args: any[]) => any>;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.commands = new Map();
    this.registerCommands();
  }
  
  private registerCommands(): void {
    // Count lines command
    this.registerCommand('codeCounter.countLines', async () => {
      return this.countLinesCommand.execute();
    });
    
    // Show report command
    this.registerCommand('codeCounter.showReport', async () => {
      return this.webViewReportService.showReport();
    });
    
    // Reset settings command
    this.registerCommand('codeCounter.resetSettings', async () => {
      return this.resetSettingsCommand.execute();
    });
  }
  
  private registerCommand(
    command: string, 
    callback: (...args: any[]) => any
  ): void {
    const disposable = vscode.commands.registerCommand(command, callback);
    this.context.subscriptions.push(disposable);
    this.commands.set(command, callback);
  }
}
```

### Context Menu Integration
Custom context menu items for enhanced workflow:

```typescript
export class ContextMenuProvider {
  public registerContextMenus(context: vscode.ExtensionContext): void {
    // File explorer context menu
    const explorerCommand = vscode.commands.registerCommand(
      'codeCounter.countFileLines',
      (uri: vscode.Uri) => this.countFileLines(uri)
    );
    
    // Editor context menu
    const editorCommand = vscode.commands.registerCommand(
      'codeCounter.countSelectionLines',
      () => this.countSelectionLines()
    );
    
    context.subscriptions.push(explorerCommand, editorCommand);
  }
  
  private async countFileLines(uri: vscode.Uri): Promise<void> {
    const lineCount = await this.lineCounter.countLines(uri.fsPath);
    
    vscode.window.showInformationMessage(
      `File has ${lineCount} lines of code`
    );
  }
}
```

## Configuration Management

### Settings Integration
Comprehensive VS Code settings integration:

```typescript
export class ConfigurationService {
  public getConfiguration<T>(
    section: string, 
    defaultValue: T
  ): T {
    const config = vscode.workspace.getConfiguration('codeCounter');
    return config.get(section, defaultValue);
  }
  
  public async updateConfiguration<T>(
    section: string, 
    value: T,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('codeCounter');
    await config.update(section, value, target);
  }
  
  public watchConfiguration(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('codeCounter')) {
        callback();
      }
    });
  }
}
```

### Settings Schema
Comprehensive settings contribution in package.json:

```json
{
  "contributes": {
    "configuration": {
      "type": "object",
      "title": "Code Counter Configuration",
      "properties": {
        "codeCounter.excludePattern": {
          "type": "string",
          "default": "**/node_modules/**",
          "description": "Files to exclude from counting"
        },
        "codeCounter.thresholds": {
          "type": "object",
          "properties": {
            "warning": {
              "type": "number",
              "default": 500
            },
            "error": {
              "type": "number", 
              "default": 1000
            }
          }
        }
      }
    }
  }
}
```

## Event Handling

### File System Events
Comprehensive file system event handling:

```typescript
export class EventManager {
  private fileWatchers: vscode.FileSystemWatcher[];
  
  constructor() {
    this.fileWatchers = [];
    this.setupFileWatchers();
  }
  
  private setupFileWatchers(): void {
    const patterns = ['**/*.{ts,js,py,java,cpp,c,h}'];
    
    patterns.forEach(pattern => {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      
      watcher.onDidCreate(uri => this.handleFileCreate(uri));
      watcher.onDidChange(uri => this.handleFileChange(uri));
      watcher.onDidDelete(uri => this.handleFileDelete(uri));
      
      this.fileWatchers.push(watcher);
    });
  }
  
  private async handleFileCreate(uri: vscode.Uri): Promise<void> {
    console.log(`File created: ${uri.fsPath}`);
    await this.updateLineCount(uri);
  }
}
```

### Editor Events
Active editor and selection change handling:

```typescript
export class EditorEventManager {
  constructor() {
    this.setupEditorListeners();
  }
  
  private setupEditorListeners(): void {
    // Active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
      this.handleActiveEditorChange(editor);
    });
    
    // Selection changes
    vscode.window.onDidChangeTextEditorSelection(event => {
      this.handleSelectionChange(event);
    });
    
    // Document changes
    vscode.workspace.onDidChangeTextDocument(event => {
      this.handleDocumentChange(event);
    });
  }
  
  private handleSelectionChange(
    event: vscode.TextEditorSelectionChangeEvent
  ): void {
    const selection = event.selections[0];
    if (!selection.isEmpty) {
      const lineCount = selection.end.line - selection.start.line + 1;
      this.statusBarManager.updateSelectionCount(lineCount);
    }
  }
}
```

## Theme Integration

### Theme-Aware Styling
Respecting VS Code theme colors:

```typescript
export class ThemeManager {
  public getThemeColor(colorId: string): vscode.ThemeColor {
    return new vscode.ThemeColor(colorId);
  }
  
  public getColorForThreshold(count: number): vscode.ThemeColor {
    const thresholds = this.configService.getConfiguration('thresholds', {
      warning: 500,
      error: 1000
    });
    
    if (count >= thresholds.error) {
      return this.getThemeColor('errorForeground');
    } else if (count >= thresholds.warning) {
      return this.getThemeColor('warningForeground');
    } else {
      return this.getThemeColor('foreground');
    }
  }
}
```

### Dynamic Theme Updates
Responding to theme changes:

```typescript
export class ThemeUpdateManager {
  constructor() {
    vscode.window.onDidChangeActiveColorTheme(theme => {
      this.handleThemeChange(theme);
    });
  }
  
  private handleThemeChange(theme: vscode.ColorTheme): void {
    // Update WebView styling
    this.webViewService.updateTheme(theme);
    
    // Refresh decorations
    this.decorationManager.refreshAll();
    
    // Update status bar colors
    this.statusBarManager.updateColors();
  }
}
```

## Error Handling

### API Error Management
Comprehensive error handling for VS Code API calls:

```typescript
export class ApiErrorHandler {
  public async safeApiCall<T>(
    operation: () => Promise<T>,
    fallback: T,
    errorMessage?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(errorMessage || 'API call failed:', error);
      
      if (error instanceof vscode.FileSystemError) {
        this.handleFileSystemError(error);
      }
      
      return fallback;
    }
  }
  
  private handleFileSystemError(error: vscode.FileSystemError): void {
    switch (error.code) {
      case 'FileNotFound':
        // Handle file not found
        break;
      case 'NoPermissions':
        vscode.window.showErrorMessage('Permission denied');
        break;
      default:
        vscode.window.showErrorMessage(`File system error: ${error.message}`);
    }
  }
}
```

## Testing Integration

### VS Code API Mocking
Comprehensive mocking for testing:

```typescript
export class VSCodeMock {
  public static createMockWorkspace(): typeof vscode.workspace {
    return {
      workspaceFolders: [
        {
          uri: vscode.Uri.file('/test/workspace'),
          name: 'test-workspace',
          index: 0
        }
      ],
      getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn(),
        update: jest.fn()
      }),
      findFiles: jest.fn().mockResolvedValue([]),
      onDidChangeConfiguration: jest.fn(),
      fs: {
        readFile: jest.fn(),
        stat: jest.fn(),
        writeFile: jest.fn()
      }
    };
  }
}
```

### API Testing Patterns
Structured testing of VS Code API integration:

```typescript
describe('VS Code API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should register commands properly', () => {
    const mockRegisterCommand = jest.fn();
    (vscode.commands as any).registerCommand = mockRegisterCommand;
    
    const commandManager = new CommandManager(mockContext);
    
    expect(mockRegisterCommand).toHaveBeenCalledWith(
      'codeCounter.countLines',
      expect.any(Function)
    );
  });
  
  it('should handle configuration changes', async () => {
    const configService = new ConfigurationService();
    
    await configService.updateConfiguration('excludePattern', '**/*.test.js');
    
    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('codeCounter');
  });
});
```

## Performance Considerations

### Async API Usage
Optimal async patterns for VS Code API calls:

```typescript
export class AsyncPatterns {
  public async parallelFileOperations(files: vscode.Uri[]): Promise<string[]> {
    // Use Promise.all for parallel operations
    const readPromises = files.map(uri => 
      vscode.workspace.fs.readFile(uri).then(bytes => 
        Buffer.from(bytes).toString('utf8')
      )
    );
    
    return Promise.all(readPromises);
  }
  
  public async batchConfigurationUpdates(
    updates: Array<{key: string, value: any}>
  ): Promise<void> {
    // Batch configuration updates to minimize events
    const config = vscode.workspace.getConfiguration('codeCounter');
    
    await Promise.all(
      updates.map(({key, value}) => config.update(key, value))
    );
  }
}
```

### Memory Management
Proper disposal of VS Code API resources:

```typescript
export class ResourceManager implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  
  public registerDisposable(disposable: vscode.Disposable): void {
    this.disposables.push(disposable);
  }
  
  public dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
  }
}
```

This comprehensive VS Code API usage enables the extension to provide rich, integrated functionality while following best practices for performance, error handling, and user experience.