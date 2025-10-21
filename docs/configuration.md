<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

Repository: https://github.com/DelightfulGames/vscode-code-counter
Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->
# Configuration System Documentation

## ⚙️ **Overview**

The VS Code Code Counter extension provides a comprehensive configuration system that allows users to customize emoji indicators, line count thresholds, file exclusion patterns, and report generation options. This document covers all configuration options, their implementation, and best practices.

---

## 🎯 **Configuration Categories**

### **1. Emoji Indicators Configuration**

**Setting Key**: `codeCounter.emojis`  
**Type**: Object  
**Scope**: User, Workspace  
**Default Values**:

```json
{
    "codeCounter.emojis": {
        "simple": "🟢",     // Files with low line count
        "moderate": "🟡",   // Files with moderate line count  
        "complex": "🔴"     // Files with high line count
    }
}
```

**Available Options**:
- **Universal Emoji Support**: Choose ANY emoji from 1800+ available
- **Custom Combinations**: Mix and match emoji styles
- **Unicode Compatibility**: Full Unicode emoji support
- **Fallback Handling**: Graceful degradation for unsupported emojis

**Example Configurations**:

```json
// Professional Status Style
{
    "codeCounter.emojis": {
        "simple": "✅",
        "moderate": "⚠️", 
        "complex": "❌"
    }
}

// Creative Theme Style
{
    "codeCounter.emojis": {
        "simple": "🎯",
        "moderate": "🔥",
        "complex": "💯"
    }
}

// Numbered System
{
    "codeCounter.emojis": {
        "simple": "1️⃣",
        "moderate": "2️⃣",
        "complex": "3️⃣"
    }
}
```

---

### **2. Line Count Thresholds**

**Setting Key**: `codeCounter.thresholds`  
**Type**: Object  
**Scope**: User, Workspace  
**Default Values**:

```json
{
    "codeCounter.thresholds": {
        "simple": 100,      // Green indicator threshold
        "moderate": 500,    // Yellow indicator threshold
        "complex": 1000     // Red indicator threshold (and above)
    }
}
```

**Threshold Logic**:
- **Lines ≤ simple**: Uses `simple` emoji (default: 🟢)
- **simple < Lines ≤ moderate**: Uses `moderate` emoji (default: 🟡)  
- **Lines > moderate**: Uses `complex` emoji (default: 🔴)

**Team Configuration Examples**:

```json
// Conservative Team (smaller files preferred)
{
    "codeCounter.thresholds": {
        "simple": 50,
        "moderate": 200,
        "complex": 400
    }
}

// Large Codebase Team (higher tolerance)
{
    "codeCounter.thresholds": {
        "simple": 200,
        "moderate": 800,
        "complex": 1500
    }
}

// Strict 127-Line Rule Following
{
    "codeCounter.thresholds": {
        "simple": 127,
        "moderate": 254,
        "complex": 500
    }
}
```

---

### **3. File Exclusion Patterns**

**Setting Key**: `codeCounter.exclude`  
**Type**: Array of strings (glob patterns)  
**Scope**: User, Workspace  
**Default Values**:

```json
{
    "codeCounter.exclude": [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/.git/**",
        "**/*.min.js",
        "**/*.min.css",
        "**/coverage/**",
        "**/.vscode/**",
        "**/.idea/**"
    ]
}
```

**Pattern Syntax**:
- `**` - Matches any number of directories
- `*` - Matches any characters within a directory/file name
- `?` - Matches any single character
- `[abc]` - Matches any character in brackets
- `{js,ts}` - Matches any of the specified extensions

**Common Pattern Examples**:

```json
{
    "codeCounter.exclude": [
        // Dependencies
        "**/node_modules/**",
        "**/vendor/**",
        
        // Build outputs
        "**/dist/**",
        "**/build/**",
        "**/out/**",
        
        // Minified files
        "**/*.min.js",
        "**/*.min.css",
        "**/*.bundle.js",
        
        // Test files (optional)
        "**/*.test.js",
        "**/*.spec.ts",
        "**/tests/**",
        
        // IDE/Editor files
        "**/.vscode/**",
        "**/.idea/**",
        "**/.vs/**",
        
        // Version control
        "**/.git/**",
        "**/.svn/**",
        
        // Temporary files
        "**/*.tmp",
        "**/*.temp",
        "**/tmp/**",
        
        // Documentation builds
        "**/docs/build/**",
        "**/_site/**"
    ]
}
```

---

### **4. Report Generation Options**

**Setting Key**: `codeCounter.reports`  
**Type**: Object  
**Scope**: User, Workspace  
**Default Values**:

```json
{
    "codeCounter.reports": {
        "outputDirectory": "./code-counter-reports",
        "generateHtml": true,
        "generateXml": true,
        "openAfterGeneration": true,
        "includeFileDetails": true,
        "groupByLanguage": true
    }
}
```

**Report Options**:

- **`outputDirectory`**: Where to save generated reports
- **`generateHtml`**: Create interactive HTML reports
- **`generateXml`**: Create XML data files
- **`openAfterGeneration`**: Auto-open HTML report in browser
- **`includeFileDetails`**: Include individual file listings
- **`groupByLanguage`**: Organize results by programming language

---

### **5. Performance Configuration**

**Setting Key**: `codeCounter.performance`  
**Type**: Object  
**Scope**: User, Workspace  
**Default Values**:

```json
{
    "codeCounter.performance": {
        "enableCaching": true,
        "cacheTimeout": 3600000,     // 1 hour in milliseconds
        "maxCacheSize": 1000,        // Maximum cached files
        "debounceDelay": 300,        // File watcher debounce (ms)
        "batchSize": 50,             // Files processed per batch
        "enableFileWatcher": true    // Real-time file monitoring
    }
}
```

**Performance Tuning**:

```json
// High-performance setup (for large codebases)
{
    "codeCounter.performance": {
        "enableCaching": true,
        "cacheTimeout": 7200000,    // 2 hours
        "maxCacheSize": 5000,       // Cache more files
        "debounceDelay": 500,       // Longer debounce
        "batchSize": 100,           // Larger batches
        "enableFileWatcher": true
    }
}

// Low-resource setup (for smaller devices)
{
    "codeCounter.performance": {
        "enableCaching": true,
        "cacheTimeout": 1800000,    // 30 minutes
        "maxCacheSize": 200,        // Smaller cache
        "debounceDelay": 200,       // Faster response
        "batchSize": 25,            // Smaller batches
        "enableFileWatcher": false  // Disable real-time updates
    }
}
```

---

## 🔧 **Configuration Management**

### **Configuration Hierarchy**

VS Code follows a configuration hierarchy (highest to lowest priority):

1. **Workspace Settings** (`/.vscode/settings.json`)
2. **Workspace Folder Settings** (Multi-root workspaces)
3. **User Settings** (`settings.json`)
4. **Default Settings** (Extension defaults)

### **Configuration Access Patterns**

```typescript
// Reading configuration in extension code
export class ConfigurationManager {
    private static getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('codeCounter');
    }
    
    public static getEmojis(): EmojiConfiguration {
        const config = this.getConfiguration();
        return config.get('emojis', defaultEmojis);
    }
    
    public static getThresholds(): ThresholdConfiguration {
        const config = this.getConfiguration();
        return config.get('thresholds', defaultThresholds);
    }
    
    public static getExcludePatterns(): string[] {
        const config = this.getConfiguration();
        return config.get('exclude', defaultExcludePatterns);
    }
}
```

### **Configuration Updates**

```typescript
// Programmatic configuration updates
export class ConfigurationUpdater {
    public static async updateEmojis(
        emojis: EmojiConfiguration,
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeCounter');
        await config.update('emojis', emojis, target);
    }
    
    public static async updateThresholds(
        thresholds: ThresholdConfiguration,
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeCounter');
        await config.update('thresholds', thresholds, target);
    }
}
```

### **Configuration Validation**

```typescript
// Input validation for configuration values
export class ConfigurationValidator {
    public static validateThresholds(thresholds: any): ThresholdConfiguration | null {
        if (typeof thresholds !== 'object') return null;
        
        const { simple, moderate, complex } = thresholds;
        
        if (typeof simple !== 'number' || simple < 1) return null;
        if (typeof moderate !== 'number' || moderate <= simple) return null;
        if (typeof complex !== 'number' || complex <= moderate) return null;
        
        return { simple, moderate, complex };
    }
    
    public static validateEmojis(emojis: any): EmojiConfiguration | null {
        if (typeof emojis !== 'object') return null;
        
        const { simple, moderate, complex } = emojis;
        
        if (typeof simple !== 'string' || simple.length === 0) return null;
        if (typeof moderate !== 'string' || moderate.length === 0) return null;
        if (typeof complex !== 'string' || complex.length === 0) return null;
        
        return { simple, moderate, complex };
    }
}
```

---

## 🎨 **WebView Configuration Interface**

### **Emoji Picker Implementation**

The extension provides a comprehensive WebView-based configuration interface:

```typescript
// WebView configuration interface
export class ConfigurationWebView {
    private panel: vscode.WebviewPanel;
    
    public async show(): Promise<void> {
        this.panel = vscode.window.createWebviewPanel(
            'codeCounterConfig',
            'Code Counter Configuration',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                enableFindWidget: true,
                retainContextWhenHidden: true
            }
        );
        
        this.panel.webview.html = await this.generateConfigurationHTML();
        this.setupMessageHandlers();
    }
    
    private setupMessageHandlers(): void {
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'updateEmojis':
                    await this.updateEmojis(message.emojis);
                    break;
                case 'updateThresholds':
                    await this.updateThresholds(message.thresholds);
                    break;
                case 'resetToDefaults':
                    await this.resetToDefaults();
                    break;
            }
        });
    }
}
```

**WebView Features**:
- **1800+ Emoji Database**: Comprehensive emoji collection
- **Search Functionality**: Find emojis by name, aliases, keywords
- **Category Navigation**: Browse by emoji categories
- **Live Preview**: See changes before applying
- **Threshold Sliders**: Visual threshold configuration
- **Pattern Manager**: Visual glob pattern editor
- **Reset Options**: Separate reset buttons for different settings

---

## 🔄 **Configuration Change Handling**

### **Real-time Configuration Updates**

```typescript
// Configuration change listener
export class ConfigurationChangeHandler {
    constructor() {
        vscode.workspace.onDidChangeConfiguration(this.handleConfigurationChange.bind(this));
    }
    
    private async handleConfigurationChange(event: vscode.ConfigurationChangeEvent): Promise<void> {
        if (!event.affectsConfiguration('codeCounter')) {
            return;
        }
        
        // Reload configuration
        const newConfig = vscode.workspace.getConfiguration('codeCounter');
        
        // Update components based on changes
        if (event.affectsConfiguration('codeCounter.emojis')) {
            await this.updateFileDecorations();
        }
        
        if (event.affectsConfiguration('codeCounter.thresholds')) {
            await this.recalculateAllIndicators();
        }
        
        if (event.affectsConfiguration('codeCounter.exclude')) {
            await this.refreshWorkspaceAnalysis();
        }
    }
    
    private async updateFileDecorations(): Promise<void> {
        // Refresh all file explorer decorations
        const decorationProvider = new FileExplorerDecorator();
        await decorationProvider.refresh();
    }
}
```

### **Configuration Migration**

```typescript
// Handle configuration format changes between versions
export class ConfigurationMigrator {
    public static async migrateIfNeeded(): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeCounter');
        const version = config.get('configVersion', '0.0.0');
        
        if (this.isOlderThan(version, '0.7.0')) {
            await this.migrateToV07(config);
        }
    }
    
    private static async migrateToV07(config: vscode.WorkspaceConfiguration): Promise<void> {
        // Migrate old emoji format to new format
        const oldEmojis = config.get('badgeEmojis');
        if (oldEmojis) {
            const newEmojis = {
                simple: oldEmojis.green || '🟢',
                moderate: oldEmojis.yellow || '🟡', 
                complex: oldEmojis.red || '🔴'
            };
            
            await config.update('emojis', newEmojis);
            await config.update('badgeEmojis', undefined); // Remove old setting
        }
        
        // Update version
        await config.update('configVersion', '0.7.0');
    }
}
```

---

## 📊 **Configuration Presets**

### **Team Configuration Presets**

```json
// Preset 1: Conservative Team (Small Files Preferred)
{
    "codeCounter.thresholds": {
        "simple": 50,
        "moderate": 150,
        "complex": 300
    },
    "codeCounter.emojis": {
        "simple": "✅",
        "moderate": "⚠️",
        "complex": "🚨"
    }
}

// Preset 2: Enterprise Team (Professional Icons)
{
    "codeCounter.thresholds": {
        "simple": 100,
        "moderate": 400,
        "complex": 800
    },
    "codeCounter.emojis": {
        "simple": "🟢",
        "moderate": "🟡", 
        "complex": "🔴"
    }
}

// Preset 3: Creative Team (Fun Icons)
{
    "codeCounter.thresholds": {
        "simple": 127,
        "moderate": 500,
        "complex": 1000
    },
    "codeCounter.emojis": {
        "simple": "😊",
        "moderate": "😐",
        "complex": "😱"
    }
}

// Preset 4: Performance Focus (High Thresholds)
{
    "codeCounter.thresholds": {
        "simple": 200,
        "moderate": 1000,
        "complex": 2000
    },
    "codeCounter.emojis": {
        "simple": "🚀",
        "moderate": "⚡",
        "complex": "🔥"
    }
}
```

---

## 🧪 **Testing Configuration**

### **Configuration Testing Patterns**

```typescript
// Testing configuration handling
describe('Configuration Management', () => {
    let mockConfig: sinon.SinonStub;
    
    beforeEach(() => {
        mockConfig = sinon.stub(vscode.workspace, 'getConfiguration');
    });
    
    afterEach(() => {
        mockConfig.restore();
    });
    
    it('should load default configuration when no user settings exist', () => {
        mockConfig.returns({
            get: sinon.stub().callsFake((key, defaultValue) => defaultValue)
        });
        
        const emojis = ConfigurationManager.getEmojis();
        
        expect(emojis).to.deep.equal({
            simple: '🟢',
            moderate: '🟡',
            complex: '🔴'
        });
    });
    
    it('should validate threshold consistency', () => {
        const invalidThresholds = {
            simple: 500,     // Invalid: should be smallest
            moderate: 200,   // Invalid: should be middle
            complex: 100     // Invalid: should be largest
        };
        
        const result = ConfigurationValidator.validateThresholds(invalidThresholds);
        
        expect(result).to.be.null;
    });
});
```

---

## 🔗 **Configuration Integration**

### **Workspace Configuration Sharing**

For team environments, configuration can be shared via workspace settings:

```json
// .vscode/settings.json (shared with team)
{
    "codeCounter.emojis": {
        "simple": "🟢",
        "moderate": "🟡",
        "complex": "🔴"
    },
    "codeCounter.thresholds": {
        "simple": 100,
        "moderate": 500,
        "complex": 1000
    },
    "codeCounter.exclude": [
        "**/node_modules/**",
        "**/dist/**",
        "**/test/**",
        "**/*.spec.ts"
    ]
}
```

### **Multi-Root Workspace Configuration**

```json
// For multi-root workspaces, each folder can have different settings
{
    "folders": [
        {
            "name": "Frontend",
            "path": "./frontend"
        },
        {
            "name": "Backend", 
            "path": "./backend"
        }
    ],
    "settings": {
        "codeCounter.thresholds": {
            "simple": 100,
            "moderate": 300,
            "complex": 600
        }
    },
    "extensions": {
        "recommendations": [
            "delightfulgames.vscode-code-counter"
        ]
    }
}
```

---

## 📋 **Configuration Best Practices**

### **Team Guidelines**

1. **Standardize Across Team**: Use workspace settings for consistent team experience
2. **Document Rationale**: Comment on why specific thresholds were chosen
3. **Regular Review**: Periodically review and adjust thresholds based on codebase evolution
4. **Progressive Migration**: Gradually tighten thresholds to improve code quality
5. **Context Sensitivity**: Different thresholds for different project types

### **Performance Optimization**

1. **Appropriate Cache Settings**: Balance memory usage with performance
2. **Smart Exclusions**: Exclude unnecessary files to improve analysis speed
3. **Reasonable Thresholds**: Avoid extremely low thresholds that create noise
4. **Selective Monitoring**: Disable file watching for very large projects if needed

### **User Experience**

1. **Intuitive Emojis**: Choose emojis that clearly convey meaning
2. **Consistent Scheme**: Use consistent emoji themes across projects
3. **Accessibility**: Consider emoji visibility across different VS Code themes
4. **Cultural Sensitivity**: Be mindful of emoji meanings in different cultures

---

## 📖 **Configuration Schema Reference**

```typescript
// Complete configuration interface
interface CodeCounterConfiguration {
    emojis: {
        simple: string;      // Emoji for low line count files
        moderate: string;    // Emoji for moderate line count files  
        complex: string;     // Emoji for high line count files
    };
    
    thresholds: {
        simple: number;      // Upper bound for simple classification
        moderate: number;    // Upper bound for moderate classification
        complex: number;     // Lower bound for complex classification
    };
    
    exclude: string[];       // Glob patterns for file exclusion
    
    reports: {
        outputDirectory: string;      // Report output location
        generateHtml: boolean;        // Generate HTML reports
        generateXml: boolean;         // Generate XML data files
        openAfterGeneration: boolean; // Auto-open reports
        includeFileDetails: boolean;  // Include individual file data
        groupByLanguage: boolean;     // Organize by programming language
    };
    
    performance: {
        enableCaching: boolean;    // Enable intelligent caching
        cacheTimeout: number;      // Cache expiration time (ms)
        maxCacheSize: number;      // Maximum cached files
        debounceDelay: number;     // File watcher debounce (ms)
        batchSize: number;         // Files processed per batch
        enableFileWatcher: boolean; // Real-time file monitoring
    };
}
```

---

## 🔗 **Related Documentation**

- [Commands System](./commands.md) - Configuration through command execution
- [WebView Interface](./webview-interface.md) - Configuration UI implementation
- [Testing Framework](./testing.md) - Configuration testing approaches
- [VS Code API Usage](./vscode-api-usage.md) - Configuration API integration