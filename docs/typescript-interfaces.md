# TypeScript Interfaces Documentation

## 📋 Overview

This document provides comprehensive documentation for all TypeScript interfaces and types used in the VS Code Code Counter extension. These interfaces define the contracts between different components and ensure type safety throughout the application.

## 🎯 Interface Categories

### Core Data Interfaces
- **FileInfo**: Individual file analysis results
- **LineCountResult**: Aggregate analysis results
- **ReportConfig**: Configuration for report generation

### Service Interfaces  
- **LineCount**: Basic line counting structure
- **FileLineCount**: Enhanced file analysis with metadata
- **CachedLineCount**: Cached results with validation data

### Configuration Interfaces
- **ColorThresholdConfig**: Color coding configuration
- **CustomColors**: User-defined color scheme
- **ColorThreshold**: Color classification types

### Utility Interfaces
- **LanguageStats**: Language-specific statistics
- **SummaryStats**: Report summary information

---

## 📊 Core Data Interfaces

### FileInfo
Represents the complete analysis results for a single file.

```typescript
export interface FileInfo {
    path: string;           // Absolute file path
    relativePath: string;   // Path relative to workspace root
    language: string;       // Detected programming language
    lines: number;          // Total lines in file
    codeLines: number;      // Lines containing code
    commentLines: number;   // Lines containing comments
    blankLines: number;     // Empty or whitespace-only lines
    size: number;           // File size in bytes
}
```

**Usage Context**: 
- Primary data structure for file analysis results
- Used in HTML and XML report generation
- Displayed in WebView interfaces
- Cached in LineCountCacheService

**Example Usage**:
```typescript
const fileInfo: FileInfo = {
    path: '/Users/dev/project/src/extension.ts',
    relativePath: 'src/extension.ts',
    language: 'TypeScript',
    lines: 503,
    codeLines: 420,
    commentLines: 63,
    blankLines: 20,
    size: 15248
};
```

### LineCountResult
Comprehensive results for workspace-wide analysis.

```typescript
export interface LineCountResult {
    workspacePath: string;                                          // Root workspace directory
    totalFiles: number;                                             // Total files analyzed
    totalLines: number;                                             // Sum of all lines
    files: FileInfo[];                                             // Individual file results
    languageStats: { [language: string]: LanguageStats };         // Language-grouped statistics
    generatedAt: Date;                                             // Analysis timestamp
}
```

**Usage Context**:
- Main output from LineCounterService
- Input for report generation services
- Displayed in summary statistics
- Used for command execution results

**Example Usage**:
```typescript
const result: LineCountResult = {
    workspacePath: '/Users/dev/project',
    totalFiles: 150,
    totalLines: 45000,
    files: [/* FileInfo array */],
    languageStats: {
        'TypeScript': { files: 45, lines: 25000 },
        'JavaScript': { files: 30, lines: 15000 }
    },
    generatedAt: new Date()
};
```

### ReportConfig
Configuration settings for report generation.

```typescript
export interface ReportConfig {
    excludePatterns: string[];      // Glob patterns for file exclusion
    outputDirectory: string;        // Directory for generated reports
    autoGenerate: boolean;         // Whether to auto-generate on file save
}
```

**Usage Context**:
- Read from VS Code configuration
- Used by CountLinesCommand
- Applied during file discovery
- Controls report generation behavior

---

## 🔢 Service-Specific Interfaces

### LineCount
Basic line counting structure used internally by services.

```typescript
export interface LineCount {
    codeLines: number;      // Lines containing executable code
    commentLines: number;   // Lines containing comments only
    blankLines: number;     // Empty or whitespace-only lines
}
```

**Usage Context**:
- Internal to LineCounterService
- Used during file content analysis
- Building block for FileLineCount
- Temporary calculation structure

### FileLineCount
Enhanced file analysis with additional metadata.

```typescript
export interface FileLineCount extends LineCount {
    lines: number;          // Total lines (sum of all line types)
    language: string;       // Detected programming language
    size: number;           // File size in bytes
    lastModified: number;   // File modification timestamp (ms since epoch)
}
```

**Usage Context**:
- Result from individual file analysis
- Input to caching system
- Used for cache validation
- Extended by CachedLineCount

### CachedLineCount
Cached analysis results with cache metadata.

```typescript
export interface CachedLineCount extends FileLineCount {
    cachedAt: number;       // Timestamp when entry was cached
}
```

**Usage Context**:
- Stored in LineCountCacheService
- Used for cache hit/miss determination
- Includes validation timestamps
- Optimizes performance for large codebases

---

## 🎨 Badge & Theme Interfaces

### ColorThreshold
Enumeration of badge classification levels.

```typescript
export type ColorThreshold = 'normal' | 'warning' | 'danger';
```

**Usage Context**:
- Badge classification in lineThresholdservice
- File decoration provider decisions
- UI badge coding logic
- Configuration validation

**Mapping**:
- `'normal'`: Default 🟢 indicators (< mid threshold)
- `'warning'`: Default 🟡 indicators (< high threshold)  
- `'danger'`: Default 🔴 indicators (≥ high threshold)

### CustomEmojis
User-configurable emoji badge scheme.

```typescript
export interface CustomEmojis {
    normal: string;     // Emoji for normal files (default: '🟢')
    warning: string;    // Emoji for warning files (default: '🟡') 
    danger: string;     // Emoji for danger files (default: '🔴')
}
```

**Usage Context**:
- Read from VS Code configuration
- Applied in file decoration providers
- Used in WebView emoji picker
- Supports any Unicode emoji

**Validation Rules**:
- Must be valid Unicode emoji characters
- Supports compound emojis and skin tones
- Default fallbacks for invalid values

### ColorThresholdConfig
Complete badge threshold configuration.

```typescript
export interface ColorThresholdConfig {
    enabled: boolean;         // Whether badge coding is enabled
    midThreshold: number;     // First threshold boundary (lines)
    highThreshold: number;    // Second threshold boundary (lines)
}
```

**Usage Context**:
- Threshold boundary management
- Badge classification logic
- Configuration validation
- WebView threshold inputs

**Validation Rules**:
- `midThreshold` must be positive integer
- `highThreshold` must be greater than `midThreshold`
- Automatic correction for invalid values

---

## 📈 Statistics & Reporting Interfaces

### LanguageStats  
Statistics aggregated by programming language.

```typescript
export interface LanguageStats {
    files: number;      // Number of files for this language
    lines: number;      // Total lines for this language
}
```

**Usage Context**:
- Language-based grouping in reports
- Summary statistics calculation
- Language distribution analysis
- Report visualization data

### SummaryStats
High-level summary information for reports.

```typescript
export interface SummaryStats {
    totalFiles: number;         // Total files analyzed
    totalLines: number;         // Sum of all lines
    totalCodeLines: number;     // Sum of all code lines
    totalCommentLines: number;  // Sum of all comment lines
    totalBlankLines: number;    // Sum of all blank lines
    averageLinesPerFile: number;    // Mean lines per file
    largestFile: FileInfo | null;   // File with most lines
    languageCount: number;      // Number of unique languages
}
```

**Usage Context**:
- HTML report summary sections
- Dashboard statistics
- Quick overview information
- Report header data

---

## 🔧 Utility & Helper Interfaces

### TemplateData
Data structure for HTML template processing.

```typescript
export interface TemplateData {
    workspaceName: string;      // Display name for workspace
    summary: SummaryStats;      // Summary statistics
    files: FileInfo[];          // Complete file listing
    languageStats: { [key: string]: LanguageStats };   // Language breakdown
    generatedAt: string;        // Formatted timestamp
    thresholds: {               // Threshold configuration
        yellow: number;
        red: number;
    };
    colors: CustomColors;       // Color configuration
}
```

**Usage Context**:
- HTML template processing
- Report generation
- WebView data binding
- Template variable replacement

### CacheStats
Performance statistics for the caching system.

```typescript
export interface CacheStats {
    hits: number;       // Number of cache hits
    misses: number;     // Number of cache misses
    hitRate: number;    // Calculated hit rate percentage
    totalEntries: number;   // Current cache size
}
```

**Usage Context**:
- Performance monitoring
- Cache effectiveness measurement
- Debug information
- Optimization metrics

---

## 🏷️ Type Aliases & Enums

### Display Modes
```typescript
export type DisplayMode = 'always' | 'hover';
```

**Usage Context**:
- Configuration for provider display behavior
- WebView settings options
- User preference management

### File Extensions Mapping
```typescript
export type FileExtension = '.js' | '.ts' | '.jsx' | '.tsx' | '.py' | '.java' | /* ... more */;
export type Language = 'JavaScript' | 'TypeScript' | 'Python' | 'Java' | /* ... more */;
```

**Usage Context**:
- Language detection logic
- File type classification
- Extension-to-language mapping

---

## 🔄 Interface Relationships

### Data Flow Diagram
```
FileInfo
    ↓ (aggregated)
LineCountResult
    ↓ (processed)
TemplateData
    ↓ (rendered)
HTML/XML Reports

FileLineCount
    ↓ (cached)
CachedLineCount
    ↓ (retrieved)
FileInfo
```

### Inheritance Hierarchy
```
LineCount (base)
    ↓ (extends)
FileLineCount
    ↓ (extends)  
CachedLineCount
```

### Composition Relationships
- `LineCountResult` contains array of `FileInfo`
- `TemplateData` contains `SummaryStats` and `CustomColors`
- `ColorThresholdConfig` defines thresholds used by `ColorThreshold`

---

## ✅ Type Safety Guidelines

### Strict TypeScript Configuration
The project uses strict TypeScript settings to ensure maximum type safety:

```json
{
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
}
```

### Interface Design Principles
1. **Immutability**: Prefer readonly properties where appropriate
2. **Specificity**: Use specific types instead of `any`
3. **Null Safety**: Handle undefined/null cases explicitly
4. **Extension Safety**: Design interfaces for future extension
5. **Documentation**: Include JSDoc comments for complex interfaces

### Common Type Guards
```typescript
// Type guard for FileInfo validation
function isFileInfo(obj: any): obj is FileInfo {
    return obj &&
        typeof obj.path === 'string' &&
        typeof obj.lines === 'number' &&
        typeof obj.language === 'string';
}

// Type guard for color validation
function isValidHexColor(color: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(color);
}
```

---

## 🚀 Usage Examples

### Service Implementation
```typescript
class MyService {
    async processFile(filePath: string): Promise<FileInfo> {
        const analysis: FileLineCount = await this.analyzeFile(filePath);
        
        return {
            path: filePath,
            relativePath: path.relative(this.workspacePath, filePath),
            language: analysis.language,
            lines: analysis.lines,
            codeLines: analysis.codeLines,
            commentLines: analysis.commentLines,
            blankLines: analysis.blankLines,
            size: analysis.size
        };
    }
}
```

### Configuration Reading
```typescript
function getColorConfig(): CustomColors {
    const config = vscode.workspace.getConfiguration('codeCounter.colors');
    
    return {
        normal: config.get<string>('normal', '#4CAF50'),
        warning: config.get<string>('warning', '#FFC107'),
        danger: config.get<string>('danger', '#F44336')
    };
}
```

### Cache Management
```typescript
class CacheService {
    private cache = new Map<string, CachedLineCount>();
    
    async get(filePath: string): Promise<CachedLineCount | null> {
        const cached = this.cache.get(filePath);
        
        if (cached) {
            const stat = await fs.stat(filePath);
            if (stat.mtime.getTime() === cached.lastModified) {
                return cached;
            }
        }
        
        return null;
    }
}
```

---

*This TypeScript interfaces documentation provides complete reference material for all data structures and type definitions used throughout the VS Code Code Counter extension.*