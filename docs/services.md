# Services Layer Documentation

## 📋 Overview

The services layer contains the core business logic of the VS Code Code Counter extension. Each service is designed as a focused, reusable component that handles a specific aspect of the extension's functionality.

## 🏗️ Service Architecture

### Design Principles
- **Single Responsibility**: Each service handles one specific domain
- **Stateless Design**: Services are stateless and thread-safe
- **Dependency Injection**: Services depend on interfaces, not implementations
- **Error Handling**: Comprehensive error handling with graceful degradation
- **Performance**: Optimized for large codebases with caching strategies

### Service Catalog
```
services/
├── lineCounter.ts          # Core line counting and language detection
├── lineThresholdService.ts # Color coding and threshold management
├── lineCountCache.ts       # Performance caching system
├── htmlGenerator.ts        # Interactive HTML report generation
└── xmlGenerator.ts         # XML data export for external tools
```

---

## 🔢 LineCounterService

### Purpose
Core service responsible for analyzing files and counting lines of code across multiple programming languages.

### Key Responsibilities
- **Multi-language Support**: Handles 25+ programming languages
- **Line Classification**: Separates code, comments, and blank lines
- **File Discovery**: Scans workspace with glob exclusion support
- **Language Detection**: Automatic language identification by file extension
- **Statistics Aggregation**: Calculates per-language and total statistics

### API Interface
```typescript
class LineCounterService {
    async countLines(workspacePath: string, excludePatterns: string[] = []): Promise<LineCountResult>
    private async analyzeFile(filePath: string): Promise<FileLineCount>
    private detectLanguage(filePath: string): string
    private countLinesInContent(content: string, language: string): LineCount
}
```

### Language Support Matrix
| Language | Extensions | Comment Styles |
|----------|------------|----------------|
| JavaScript | `.js`, `.jsx` | `//`, `/* */` |
| TypeScript | `.ts`, `.tsx` | `//`, `/* */` |
| Python | `.py` | `#`, `"""` |
| Java | `.java` | `//`, `/* */` |
| C/C++ | `.c`, `.cpp`, `.h` | `//`, `/* */` |
| C# | `.cs` | `//`, `/* */` |
| PHP | `.php` | `//`, `/* */`, `#` |
| Ruby | `.rb` | `#`, `=begin =end` |
| Go | `.go` | `//`, `/* */` |
| Rust | `.rs` | `//`, `/* */` |
| Swift | `.swift` | `//`, `/* */` |
| Kotlin | `.kt` | `//`, `/* */` |
| Scala | `.scala` | `//`, `/* */` |
| HTML | `.html` | `<!-- -->` |
| CSS | `.css`, `.scss`, `.sass`, `.less` | `/* */` |
| Shell | `.sh`, `.bat`, `.ps1` | `#`, `REM` |
| JSON | `.json` | No comments |
| XML | `.xml` | `<!-- -->` |
| YAML | `.yaml`, `.yml` | `#` |
| Markdown | `.md` | N/A |
| Text | `.txt` | N/A |

### Comment Detection Algorithm
```typescript
private countLinesInContent(content: string, language: string): LineCount {
    const lines = content.split('\n');
    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed === '') {
            blankLines++;
        } else if (this.isCommentLine(trimmed, language)) {
            commentLines++;
        } else {
            codeLines++;
        }
    }
    
    return { codeLines, commentLines, blankLines };
}
```

### Performance Optimizations
- **File Filtering**: Early exclusion using glob patterns
- **Lazy Reading**: Files read only when needed
- **Encoding Detection**: Automatic handling of different text encodings
- **Memory Management**: Streaming for large files

---

## 🎨 lineThresholdService

### Purpose
Manages the emoji badge system that provides visual indicators based on configurable line count thresholds.

### Key Responsibilities
- **Threshold Management**: Configurable mid and high thresholds
- **Badge Classification**: Categorizes files as normal/warning/danger
- **Custom Emojis**: Support for user-defined emoji badges
- **Tooltip Generation**: Creates informative hover tooltips
- **Configuration Validation**: Ensures valid threshold values

### API Interface
```typescript
class lineThresholdService {
    static getColorThreshold(lineCount: number): ColorThreshold
    static getCustomEmojis(): CustomEmojis
    static getThresholdConfig(): ColorThresholdConfig
    static createColoredTooltip(fileName: string, ...stats): string
    static formatLineCount(lineCount: number): string
}
```

### Badge Classification Logic
```typescript
static getColorThreshold(lineCount: number): ColorThreshold {
    const config = this.getThresholdConfig();
    
    if (lineCount < config.midThreshold) {
        return 'normal';    // Default: 🟢 - small files
    } else if (lineCount < config.highThreshold) {
        return 'warning';   // Default: 🟡 - medium files
    } else {
        return 'danger';    // Default: 🔴 - large files
    }
}
```

### Configuration Schema
```typescript
interface ColorThresholdConfig {
    enabled: boolean;
    midThreshold: number;     // Default: 300 lines
    highThreshold: number;    // Default: 1000 lines
}

interface CustomColors {
    normal: string;   // Default: '#4CAF50' (Material Green)
    warning: string;  // Default: '#FFC107' (Material Amber)  
    danger: string;   // Default: '#F44336' (Material Red)
}
```

### Tooltip Generation
Creates rich tooltips with comprehensive file information:
- File name and relative path
- Total line count with color coding
- Breakdown by line type (code/comment/blank)
- File size information
- Threshold information

---

## 💾 LineCountCacheService

### Purpose
Provides intelligent caching to optimize performance for large codebases by avoiding redundant file analysis.

### Key Responsibilities
- **File-Level Caching**: Individual file results cached with metadata
- **Modification Time Validation**: Automatic cache invalidation when files change
- **Memory Management**: Efficient storage and cleanup
- **Cache Statistics**: Hit/miss tracking for performance monitoring
- **Batch Operations**: Efficient bulk cache operations

### API Interface
```typescript
class LineCountCacheService {
    async getLineCount(filePath: string): Promise<CachedLineCount>
    invalidateFile(filePath: string): void
    invalidateAll(): void
    getCacheStats(): { hits: number; misses: number }
    dispose(): void
}
```

### Cache Entry Structure
```typescript
interface CachedLineCount {
    lines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
    size: number;
    language: string;
    lastModified: number;  // File modification timestamp
    cachedAt: number;      // When this entry was cached
}
```

### Cache Validation Algorithm
```typescript
async getLineCount(filePath: string): Promise<CachedLineCount> {
    const cached = this.cache.get(filePath);
    
    if (cached) {
        const stat = await fs.stat(filePath);
        if (stat.mtime.getTime() === cached.lastModified) {
            this.stats.hits++;
            return cached; // Cache hit - file unchanged
        }
    }
    
    // Cache miss or file changed - recompute
    this.stats.misses++;
    const result = await this.lineCounter.analyzeFile(filePath);
    this.cache.set(filePath, result);
    return result;
}
```

### Performance Benefits
- **Speed**: Avoids re-analyzing unchanged files (90%+ hit rate typical)
- **Memory Efficient**: Only stores essential data, not full file content
- **Automatic Cleanup**: Removes stale entries automatically
- **Batch Processing**: Optimized for workspace-wide operations

---

## 📄 HtmlGeneratorService

### Purpose
Generates interactive, searchable HTML reports that provide comprehensive analysis results in a user-friendly format.

### Key Responsibilities
- **Template Processing**: Uses customizable HTML templates
- **Interactive Features**: Search, sort, and filter functionality
- **Data Visualization**: Statistics charts and graphs
- **Responsive Design**: Works on desktop and mobile devices
- **Custom Styling**: Theme-aware styling with VS Code color integration

### API Interface
```typescript
class HtmlGeneratorService {
    async generateReport(results: LineCountResult, outputDir: string): Promise<void>
    private processTemplate(templateContent: string, data: TemplateData): string
    private createSummaryStats(results: LineCountResult): SummaryStats
}
```

### Report Features
#### Interactive Elements
- **Search Bar**: Filter files by name or path
- **Sortable Columns**: Click column headers to sort
- **Language Filter**: Show/hide specific languages
- **Statistics Dashboard**: Overview charts and metrics

#### Data Sections
1. **Summary Statistics**
   - Total files analyzed
   - Total lines of code
   - Language distribution
   - Top largest files

2. **File Details Table**
   - File path and name
   - Line counts (total, code, comments, blanks)
   - File size
   - Language detection
   - Color-coded indicators

3. **Language Statistics**
   - Lines per language
   - File count per language
   - Average file size per language

### Template System
```html
<!DOCTYPE html>
<html>
<head>
    <title>Code Counter Report - {{workspaceName}}</title>
    <style>/* Custom CSS */</style>
</head>
<body>
    <h1>{{title}}</h1>
    
    <div class="summary">
        <div class="stat-card">
            <h3>Total Files</h3>
            <span class="stat-value">{{totalFiles}}</span>
        </div>
        <!-- More stat cards -->
    </div>
    
    <table class="results-table">
        <thead><!-- Table headers --></thead>
        <tbody>
            {{#each files}}
            <tr class="{{colorClass}}">
                <td>{{relativePath}}</td>
                <td>{{lines}}</td>
                <!-- More columns -->
            </tr>
            {{/each}}
        </tbody>
    </table>
    
    <script>/* Interactive JavaScript */</script>
</body>
</html>
```

---

## 📊 XmlGeneratorService

### Purpose
Creates structured XML reports suitable for integration with external analysis tools, CI/CD pipelines, and automated reporting systems.

### Key Responsibilities
- **XML Structure Generation**: Well-formed XML with comprehensive metadata
- **Schema Compliance**: Consistent structure for tool integration
- **Metadata Inclusion**: File paths, timestamps, and analysis details
- **Validation**: Ensures XML validity and proper encoding

### API Interface
```typescript
class XmlGeneratorService {
    async generateReport(results: LineCountResult, outputDir: string): Promise<void>
    private createXmlStructure(results: LineCountResult): XmlStructure
    private formatXmlOutput(structure: XmlStructure): string
}
```

### XML Schema Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<codeCounter generatedAt="2024-01-01T12:00:00Z" workspacePath="/path/to/workspace">
    <summary>
        <totalFiles>150</totalFiles>
        <totalLines>45000</totalLines>
        <totalCodeLines>35000</totalCodeLines>
        <totalCommentLines>7500</totalCommentLines>
        <totalBlankLines>2500</totalBlankLines>
    </summary>
    
    <languages>
        <language name="TypeScript" files="45" lines="25000" />
        <language name="JavaScript" files="30" lines="15000" />
        <!-- More languages -->
    </languages>
    
    <files>
        <file path="/src/extension.ts" 
              relativePath="src/extension.ts"
              language="TypeScript" 
              lines="503"
              codeLines="420"
              commentLines="63"
              blankLines="20"
              size="15248" />
        <!-- More files -->
    </files>
</codeCounter>
```

### Use Cases
- **CI/CD Integration**: Automated quality gates based on line count metrics
- **Code Review Tools**: Integration with review systems
- **Reporting Dashboards**: Data import for management dashboards
- **Historical Analysis**: Track code growth over time
- **Team Metrics**: Compare statistics across teams or projects

---

## 🔄 Service Interactions

### Service Dependency Graph
```
LineCounterService (Core)
    ↓
LineCountCacheService (Performance)
    ↓  
lineThresholdService (Classification)
    ↓
HtmlGeneratorService + XmlGeneratorService (Output)
```

### Data Flow Between Services
1. **LineCounterService** analyzes files and produces raw counts
2. **LineCountCacheService** caches results for performance
3. **lineThresholdService** classifies results based on thresholds
4. **Generator Services** create formatted output reports

### Event-Driven Updates
Services communicate through VS Code's configuration system:
- Configuration changes trigger service updates
- File system events invalidate caches
- UI events refresh providers

---

## 🚀 Performance Considerations

### Optimization Strategies
- **Lazy Loading**: Services instantiated only when needed
- **Caching**: Multiple levels of caching (file, result, configuration)
- **Debouncing**: Event batching to prevent excessive updates
- **Streaming**: Large file processing with streaming readers
- **Parallel Processing**: Concurrent file analysis where safe

### Memory Management
- **Cache Size Limits**: Automatic cleanup of old entries
- **Weak References**: Prevent memory leaks in event handlers
- **Resource Disposal**: Proper cleanup of file handles and timers

### Scalability
The services layer is designed to handle:
- **Large Codebases**: 10,000+ files efficiently processed
- **Real-time Updates**: Sub-second response to file changes
- **Concurrent Access**: Thread-safe operations throughout

---

*This services documentation provides comprehensive details about the business logic layer that powers the VS Code Code Counter extension.*