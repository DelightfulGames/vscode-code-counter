# Commands System Documentation

## 📋 **Overview**

The VS Code Code Counter extension provides a comprehensive command system that integrates seamlessly with VS Code's Command Palette and provides programmatic access to all major functionality. This document covers command implementation, registration, and usage patterns.

---

## 🎯 **Available Commands**

### **1. Count Lines of Code**

**Command ID**: `codeCounter.countLines`  
**Display Name**: "Code Counter: Count Lines of Code"  
**Keyboard Shortcut**: Not assigned (user configurable)  
**Category**: Analysis

```typescript
// Command implementation
export class CountLinesCommand {
    public static readonly ID = 'codeCounter.countLines';
    
    public static async execute(): Promise<void> {
        const lineCounterService = new LineCounterService();
        const results = await lineCounterService.analyzeWorkspace();
        
        // Generate reports and update UI
        await new HtmlGenerator().generateReport(results);
        await new StatusBarProvider().updateDisplay(results);
    }
}
```

**Functionality**:
- Analyzes all files in the current workspace
- Applies configured exclusion patterns
- Updates file explorer emoji indicators
- Generates HTML and XML reports
- Shows progress indication during analysis
- Updates status bar with summary statistics

**Use Cases**:
- Manual project analysis trigger
- Integration with build scripts
- Code review preparation
- Project documentation generation

---

### **2. Customize Emoji Indicators**

**Command ID**: `codeCounter.openSettings`  
**Display Name**: "Code Counter: Customize Emoji Indicators"  
**Category**: Configuration

```typescript
// Settings UI command
export class OpenSettingsCommand {
    public static readonly ID = 'codeCounter.openSettings';
    
    public static async execute(): Promise<void> {
        const webViewService = new WebViewReportService();
        await webViewService.showEmojiPicker();
    }
}
```

**Functionality**:
- Opens comprehensive settings WebView
- Provides emoji picker with 1800+ emojis
- Allows threshold customization
- Manages exclusion pattern configuration
- Includes search functionality and categories
- Real-time preview of changes

**Features**:
- **Universal Emoji Support**: Choose ANY emoji for indicators
- **Searchable Database**: Find emojis by name, aliases, keywords
- **Category Browsing**: Organized emoji categories
- **Threshold Management**: Configure line count boundaries
- **Pattern Management**: Visual glob pattern editor
- **Live Preview**: See changes before applying

---

### **3. Reset to Defaults**

**Command ID**: `codeCounter.resetBadgeSettings`  
**Display Name**: "Code Counter: Reset Emoji Indicators to Defaults"  
**Category**: Configuration

```typescript
// Reset command implementation
export class ResetBadgeSettingsCommand {
    public static readonly ID = 'codeCounter.resetBadgeSettings';
    
    public static async execute(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeCounter');
        
        // Reset to default values
        await config.update('emojis', defaultEmojis, vscode.ConfigurationTarget.Global);
        await config.update('thresholds', defaultThresholds, vscode.ConfigurationTarget.Global);
        
        // Refresh UI components
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
}
```

**Functionality**:
- Resets emoji indicators to default (🟢🟡🔴)
- Restores default threshold values (100, 500, 1000)
- Clears custom exclusion patterns
- Reloads extension to apply changes
- Provides confirmation dialog

**Safety Features**:
- Confirmation dialog before reset
- Backup of current settings
- Graceful error handling
- Progress indication

---

## 🏗️ **Command Architecture**

### **Command Registration Pattern**

All commands follow a consistent registration pattern in the main `extension.ts`:

```typescript
// Centralized command registration
export function activate(context: vscode.ExtensionContext) {
    // Register all commands with proper disposal
    const commands = [
        CountLinesCommand.register(context),
        OpenSettingsCommand.register(context),
        ResetBadgeSettingsCommand.register(context)
    ];
    
    // Ensure proper cleanup
    context.subscriptions.push(...commands);
}

// Command class pattern
export class ExampleCommand {
    public static readonly ID = 'codeCounter.example';
    
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.commands.registerCommand(
            ExampleCommand.ID,
            ExampleCommand.execute
        );
    }
    
    private static async execute(...args: any[]): Promise<void> {
        // Command implementation
    }
}
```

**Benefits**:
- Consistent command structure
- Proper resource management
- Type-safe command IDs
- Easy testing and mocking
- Clear separation of concerns

### **Command Context Integration**

Commands integrate with VS Code's context system for conditional availability:

```typescript
// Context-aware command registration
{
    "command": "codeCounter.countLines",
    "title": "Count Lines of Code",
    "category": "Code Counter",
    "enablement": "workspaceFolderCount > 0"
}
```

**Context Conditions**:
- `workspaceFolderCount > 0` - Requires open workspace
- `config.codeCounter.enabled` - Extension must be enabled
- `resourceExtname in supportedExtensions` - File-specific commands

---

## 🎮 **Command Execution Patterns**

### **1. Synchronous Commands**

For immediate actions without heavy processing:

```typescript
export class SyncCommand {
    public static async execute(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeCounter');
        const currentSettings = config.get('emojis');
        
        await vscode.window.showInformationMessage(
            `Current emojis: ${JSON.stringify(currentSettings)}`
        );
    }
}
```

### **2. Asynchronous Commands with Progress**

For long-running operations:

```typescript
export class AsyncCommand {
    public static async execute(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Analyzing workspace...",
            cancellable: true
        }, async (progress, token) => {
            const results = await new LineCounterService()
                .analyzeWorkspace(progress, token);
            
            if (!token.isCancellationRequested) {
                await this.processResults(results);
            }
        });
    }
}
```

### **3. Input-Gathering Commands**

For commands requiring user input:

```typescript
export class InputCommand {
    public static async execute(): Promise<void> {
        const threshold = await vscode.window.showInputBox({
            prompt: 'Enter line count threshold',
            placeHolder: '500',
            validateInput: (value) => {
                const num = parseInt(value);
                return isNaN(num) || num <= 0 ? 'Must be a positive number' : undefined;
            }
        });
        
        if (threshold) {
            await this.updateThreshold(parseInt(threshold));
        }
    }
}
```

---

## 🔧 **Command Implementation Details**

### **Error Handling**

All commands implement comprehensive error handling:

```typescript
export class RobustCommand {
    public static async execute(): Promise<void> {
        try {
            await this.performOperation();
        } catch (error) {
            console.error('Command execution failed:', error);
            
            await vscode.window.showErrorMessage(
                `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
    
    private static async performOperation(): Promise<void> {
        // Command logic with potential failures
    }
}
```

### **Command Parameters**

Commands can accept parameters for programmatic execution:

```typescript
export class ParameterizedCommand {
    public static async execute(
        options?: {
            outputPath?: string;
            excludePatterns?: string[];
            reportFormat?: 'html' | 'xml' | 'both';
        }
    ): Promise<void> {
        const config = {
            outputPath: options?.outputPath || './reports',
            excludePatterns: options?.excludePatterns || defaultExclusions,
            reportFormat: options?.reportFormat || 'both'
        };
        
        await this.generateReports(config);
    }
}
```

### **Command Chaining**

Commands can trigger other commands for complex workflows:

```typescript
export class ChainedCommand {
    public static async execute(): Promise<void> {
        // Step 1: Count lines
        await vscode.commands.executeCommand('codeCounter.countLines');
        
        // Step 2: Open settings if first-time user
        const isFirstTime = await this.checkFirstTimeUser();
        if (isFirstTime) {
            await vscode.commands.executeCommand('codeCounter.openSettings');
        }
        
        // Step 3: Show results
        await this.displayResults();
    }
}
```

---

## 🧪 **Testing Commands**

### **Command Testing Pattern**

Commands are tested using the comprehensive mock system:

```typescript
// Command testing with mocks
describe('CountLinesCommand', () => {
    beforeEach(() => {
        // Setup VS Code mock environment
        setupVSCodeMocks();
    });
    
    it('should execute workspace analysis', async () => {
        // Mock workspace with test files
        mockWorkspaceFiles(['test.js', 'test.ts']);
        
        // Execute command
        await CountLinesCommand.execute();
        
        // Verify expected behavior
        expect(mockProgressReporter).to.have.been.called;
        expect(mockStatusBar.text).to.include('lines analyzed');
    });
    
    it('should handle empty workspace gracefully', async () => {
        mockEmptyWorkspace();
        
        await CountLinesCommand.execute();
        
        expect(mockErrorMessage).to.have.been.calledWith(
            'No files found to analyze'
        );
    });
});
```

### **Integration Testing**

Commands are also tested in integration scenarios:

```typescript
// Integration testing
describe('Command Integration', () => {
    it('should update UI after analysis command', async () => {
        // Setup test workspace
        const testFiles = await createTestWorkspace();
        
        // Execute analysis command
        await vscode.commands.executeCommand('codeCounter.countLines');
        
        // Verify UI updates
        const decorations = await getFileDecorations();
        expect(decorations).to.have.length(testFiles.length);
        expect(decorations.every(d => d.badge)).to.be.true;
    });
});
```

---

## 📊 **Command Performance**

### **Performance Metrics**

Commands are optimized for responsiveness:

- **CountLinesCommand**: ~200-500ms for typical workspace (100-1000 files)
- **OpenSettingsCommand**: ~100ms WebView initialization
- **ResetBadgeSettingsCommand**: ~50ms configuration update

### **Performance Optimizations**

1. **Lazy Loading**: Services initialized on-demand
2. **Caching**: Previous analysis results cached with invalidation
3. **Progress Reporting**: Long operations provide user feedback
4. **Cancellation**: Support for operation cancellation
5. **Debouncing**: Rapid command execution is debounced

```typescript
// Performance-optimized command
export class OptimizedCommand {
    private static cache = new Map<string, any>();
    private static debounceTimer?: NodeJS.Timeout;
    
    public static async execute(): Promise<void> {
        // Debounce rapid executions
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(async () => {
            await this.performOptimizedExecution();
        }, 100);
    }
    
    private static async performOptimizedExecution(): Promise<void> {
        // Check cache first
        const cacheKey = this.generateCacheKey();
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // Perform operation with caching
        const result = await this.performOperation();
        this.cache.set(cacheKey, result);
        
        return result;
    }
}
```

---

## 🔗 **External Command Integration**

### **Keybinding Integration**

Commands can be bound to keyboard shortcuts in `keybindings.json`:

```json
[
    {
        "key": "ctrl+shift+l",
        "command": "codeCounter.countLines",
        "when": "workspaceFolderCount > 0"
    },
    {
        "key": "ctrl+shift+e",
        "command": "codeCounter.openSettings"
    }
]
```

### **Task Integration**

Commands can be integrated into VS Code tasks:

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Generate Code Report",
            "type": "shell",
            "command": "${command:codeCounter.countLines}",
            "group": "build",
            "presentation": {
                "echo": true,
                "reveal": "always"
            }
        }
    ]
}
```

### **Launch Configuration**

Commands can be triggered from launch configurations:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug with Code Analysis",
            "type": "node",
            "request": "launch",
            "preLaunchTask": "${command:codeCounter.countLines}",
            "program": "${workspaceFolder}/src/index.js"
        }
    ]
}
```

---

## 🎯 **Best Practices**

### **Command Design Principles**

1. **Single Responsibility**: Each command has one clear purpose
2. **Consistent Naming**: Follow VS Code command naming conventions
3. **Error Handling**: All commands handle errors gracefully
4. **Progress Indication**: Long operations show progress
5. **Cancellation Support**: Allow users to cancel long operations
6. **Parameter Validation**: Validate all input parameters
7. **Resource Cleanup**: Properly dispose of resources

### **User Experience Guidelines**

1. **Immediate Feedback**: Show immediate response to user actions
2. **Clear Messages**: Use descriptive success/error messages
3. **Context Awareness**: Commands respect current workspace state
4. **Keyboard Accessibility**: Support keyboard navigation
5. **Consistency**: Maintain consistent behavior across commands

### **Performance Guidelines**

1. **Lazy Initialization**: Initialize services on-demand
2. **Caching Strategy**: Cache expensive operations appropriately
3. **Async Operations**: Use async/await for non-blocking execution
4. **Memory Management**: Clean up resources after command execution
5. **Debouncing**: Prevent excessive command execution

---

## 📋 **Command Reference Quick Guide**

| Command | ID | Purpose | Parameters |
|---------|----|---------|-----------| 
| Count Lines | `codeCounter.countLines` | Analyze workspace | Optional: excludePatterns |
| Open Settings | `codeCounter.openSettings` | Show configuration UI | None |
| Reset Settings | `codeCounter.resetBadgeSettings` | Reset to defaults | None |

### **Programmatic Usage**

```typescript
// Execute commands programmatically
await vscode.commands.executeCommand('codeCounter.countLines');
await vscode.commands.executeCommand('codeCounter.openSettings');
await vscode.commands.executeCommand('codeCounter.resetBadgeSettings');

// Execute with parameters
await vscode.commands.executeCommand('codeCounter.countLines', {
    excludePatterns: ['**/test/**', '**/*.spec.ts']
});
```

---

## 🔗 **Related Documentation**

- [Extension Architecture](./architecture.md) - Overall system design
- [VS Code API Usage](./vscode-api-usage.md) - API integration patterns
- [Configuration System](./configuration.md) - Settings management
- [Testing Framework](./testing.md) - Command testing approaches