# Utilities Reference Documentation

## 🛠️ **Overview**

The utilities layer provides reusable helper functions and shared functionality used throughout the VS Code Code Counter extension. This document covers all utility modules, their functions, and usage patterns.

---

## 📁 **Utility Modules**

### **File Utilities (`src/utils/fileUtils.ts`)**

#### **File System Operations**

```typescript
// Safe file system operations with error handling
export class FileUtils {
    /**
     * Safely reads file content with encoding detection
     */
    public static async readFileContent(filePath: string): Promise<string> {
        try {
            const buffer = await fs.readFile(filePath);
            const encoding = this.detectEncoding(buffer);
            return buffer.toString(encoding);
        } catch (error) {
            throw new Error(`Failed to read file ${filePath}: ${error.message}`);
        }
    }
    
    /**
     * Checks if file exists and is readable
     */
    public static async isAccessible(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath, fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Gets file statistics with caching
     */
    public static async getFileStat(filePath: string): Promise<fs.Stats> {
        try {
            return await fs.stat(filePath);
        } catch (error) {
            throw new Error(`Failed to get file stats for ${filePath}: ${error.message}`);
        }
    }
    
    /**
     * Determines if file is binary (non-text)
     */
    public static isBinaryFile(filePath: string, buffer?: Buffer): boolean {
        if (!buffer) {
            try {
                buffer = fs.readFileSync(filePath, { encoding: null });
            } catch {
                return true; // Assume binary if can't read
            }
        }
        
        // Check for null bytes (common in binary files)
        const sample = buffer.slice(0, Math.min(1024, buffer.length));
        return sample.includes(0);
    }
}
```

#### **Path Manipulation**

```typescript
// Cross-platform path utilities
export class PathUtils {
    /**
     * Normalizes file path for consistent comparison
     */
    public static normalizePath(filePath: string): string {
        return path.resolve(filePath).replace(/\\/g, '/');
    }
    
    /**
     * Gets relative path from workspace root
     */
    public static getWorkspaceRelativePath(
        filePath: string, 
        workspacePath?: string
    ): string {
        const workspace = workspacePath || vscode.workspace.rootPath || '';
        return path.relative(workspace, filePath).replace(/\\/g, '/');
    }
    
    /**
     * Extracts file extension safely
     */
    public static getFileExtension(filePath: string): string {
        return path.extname(filePath).toLowerCase().substring(1);
    }
    
    /**
     * Gets file basename without extension
     */
    public static getFileBasename(filePath: string): string {
        const basename = path.basename(filePath);
        const extension = path.extname(basename);
        return basename.slice(0, -extension.length);
    }
}
```

#### **Directory Operations**

```typescript
// Directory traversal and analysis
export class DirectoryUtils {
    /**
     * Recursively gets all files in directory with filtering
     */
    public static async getFilesRecursive(
        dirPath: string,
        excludePatterns: string[] = [],
        maxDepth: number = 50
    ): Promise<string[]> {
        const files: string[] = [];
        
        await this.walkDirectory(dirPath, (filePath, stat) => {
            if (stat.isFile() && !this.isExcluded(filePath, excludePatterns)) {
                files.push(filePath);
            }
            return true; // Continue traversal
        }, maxDepth);
        
        return files;
    }
    
    /**
     * Directory walker with callback pattern
     */
    private static async walkDirectory(
        dirPath: string,
        callback: (filePath: string, stat: fs.Stats) => boolean,
        maxDepth: number,
        currentDepth: number = 0
    ): Promise<void> {
        if (currentDepth >= maxDepth) {
            return;
        }
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const stat = await fs.stat(fullPath);
                
                const shouldContinue = callback(fullPath, stat);
                if (!shouldContinue) {
                    continue;
                }
                
                if (entry.isDirectory()) {
                    await this.walkDirectory(fullPath, callback, maxDepth, currentDepth + 1);
                }
            }
        } catch (error) {
            console.warn(`Failed to read directory ${dirPath}:`, error.message);
        }
    }
}
```

---

### **Glob Utilities (`src/utils/globUtils.ts`)**

#### **Pattern Matching**

```typescript
// Advanced glob pattern utilities
export class GlobUtils {
    /**
     * Tests if file path matches any exclude pattern
     */
    public static isExcluded(filePath: string, patterns: string[]): boolean {
        const normalizedPath = PathUtils.normalizePath(filePath);
        
        return patterns.some(pattern => {
            try {
                return minimatch(normalizedPath, pattern, {
                    dot: true,          // Match dotfiles
                    matchBase: true,    // Match basename
                    nocase: process.platform === 'win32' // Case insensitive on Windows
                });
            } catch (error) {
                console.warn(`Invalid glob pattern '${pattern}':`, error.message);
                return false;
            }
        });
    }
    
    /**
     * Validates glob pattern syntax
     */
    public static validatePattern(pattern: string): PatternValidationResult {
        try {
            // Test pattern compilation
            minimatch.makeRe(pattern);
            
            return {
                valid: true,
                error: null,
                suggestions: this.getPatternSuggestions(pattern)
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                suggestions: this.getErrorSuggestions(pattern, error)
            };
        }
    }
    
    /**
     * Expands glob patterns to file list
     */
    public static async expandPatterns(
        patterns: string[],
        workspaceRoot: string
    ): Promise<string[]> {
        const allFiles = new Set<string>();
        
        for (const pattern of patterns) {
            try {
                const matches = await glob(pattern, {
                    cwd: workspaceRoot,
                    absolute: true,
                    dot: true
                });
                
                matches.forEach(file => allFiles.add(file));
            } catch (error) {
                console.warn(`Failed to expand pattern '${pattern}':`, error.message);
            }
        }
        
        return Array.from(allFiles);
    }
}
```

#### **Pattern Analysis**

```typescript
// Pattern intelligence and suggestions
export class PatternAnalyzer {
    /**
     * Suggests common exclusion patterns based on project type
     */
    public static suggestExclusionPatterns(workspacePath: string): string[] {
        const detectedPatterns: string[] = [];
        
        // JavaScript/TypeScript patterns
        if (this.hasFile(workspacePath, 'package.json')) {
            detectedPatterns.push(
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/*.min.js',
                '**/*.min.css'
            );
        }
        
        // Python patterns
        if (this.hasFile(workspacePath, 'requirements.txt') || 
            this.hasFile(workspacePath, 'setup.py')) {
            detectedPatterns.push(
                '**/__pycache__/**',
                '**/*.pyc',
                '**/venv/**',
                '**/env/**',
                '**/.pytest_cache/**'
            );
        }
        
        // Java patterns
        if (this.hasFile(workspacePath, 'pom.xml') || 
            this.hasFile(workspacePath, 'build.gradle')) {
            detectedPatterns.push(
                '**/target/**',
                '**/build/**',
                '**/*.class',
                '**/.gradle/**'
            );
        }
        
        // Common patterns for all projects
        detectedPatterns.push(
            '**/.git/**',
            '**/.vscode/**',
            '**/.idea/**',
            '**/coverage/**',
            '**/*.log',
            '**/.DS_Store'
        );
        
        return detectedPatterns;
    }
    
    /**
     * Analyzes pattern effectiveness
     */
    public static analyzePatternCoverage(
        patterns: string[],
        allFiles: string[]
    ): PatternCoverageReport {
        const excludedFiles = allFiles.filter(file => 
            GlobUtils.isExcluded(file, patterns)
        );
        
        const coverage = excludedFiles.length / allFiles.length;
        
        return {
            totalFiles: allFiles.length,
            excludedFiles: excludedFiles.length,
            includedFiles: allFiles.length - excludedFiles.length,
            coveragePercentage: Math.round(coverage * 100),
            suggestions: this.generateOptimizationSuggestions(patterns, allFiles)
        };
    }
}
```

---

### **Language Detection Utilities**

#### **File Type Detection**

```typescript
// Language identification and classification
export class LanguageDetector {
    private static readonly LANGUAGE_MAP = new Map<string, string>([
        // Web technologies
        ['js', 'JavaScript'], ['jsx', 'JavaScript'],
        ['ts', 'TypeScript'], ['tsx', 'TypeScript'],
        ['html', 'HTML'], ['htm', 'HTML'],
        ['css', 'CSS'], ['scss', 'SCSS'], ['sass', 'Sass'], ['less', 'Less'],
        
        // Backend languages  
        ['py', 'Python'], ['pyw', 'Python'],
        ['java', 'Java'], ['kt', 'Kotlin'], ['scala', 'Scala'],
        ['c', 'C'], ['cpp', 'C++'], ['cxx', 'C++'], ['cc', 'C++'],
        ['cs', 'C#'], ['fs', 'F#'],
        ['go', 'Go'], ['rs', 'Rust'],
        ['php', 'PHP'], ['rb', 'Ruby'],
        
        // Mobile
        ['swift', 'Swift'], ['m', 'Objective-C'],
        
        // Data formats
        ['json', 'JSON'], ['xml', 'XML'], ['yaml', 'YAML'], ['yml', 'YAML'],
        ['toml', 'TOML'], ['ini', 'INI'],
        
        // Documentation
        ['md', 'Markdown'], ['rst', 'reStructuredText'], ['txt', 'Text'],
        
        // Shell scripts
        ['sh', 'Shell'], ['bash', 'Bash'], ['zsh', 'Zsh'],
        ['bat', 'Batch'], ['cmd', 'Batch'], ['ps1', 'PowerShell']
    ]);
    
    /**
     * Detects programming language from file extension
     */
    public static detectLanguage(filePath: string): string {
        const extension = PathUtils.getFileExtension(filePath);
        return this.LANGUAGE_MAP.get(extension) || 'Unknown';
    }
    
    /**
     * Determines if file is a source code file
     */
    public static isSourceFile(filePath: string): boolean {
        const language = this.detectLanguage(filePath);
        return language !== 'Unknown' && !this.isDataFile(language);
    }
    
    /**
     * Gets comment patterns for language
     */
    public static getCommentPatterns(language: string): CommentPatterns {
        const patterns: Record<string, CommentPatterns> = {
            'JavaScript': { single: '//', block: { start: '/*', end: '*/' } },
            'TypeScript': { single: '//', block: { start: '/*', end: '*/' } },
            'Python': { single: '#', block: { start: '"""', end: '"""' } },
            'Java': { single: '//', block: { start: '/*', end: '*/' } },
            'C': { single: '//', block: { start: '/*', end: '*/' } },
            'C++': { single: '//', block: { start: '/*', end: '*/' } },
            'C#': { single: '//', block: { start: '/*', end: '*/' } },
            'Go': { single: '//', block: { start: '/*', end: '*/' } },
            'Rust': { single: '//', block: { start: '/*', end: '*/' } },
            'HTML': { block: { start: '<!--', end: '-->' } },
            'CSS': { block: { start: '/*', end: '*/' } },
            'Shell': { single: '#' },
            'Batch': { single: 'REM' }
        };
        
        return patterns[language] || { single: '//' };
    }
}
```

---

### **String Utilities**

#### **Text Processing**

```typescript
// String manipulation and analysis utilities
export class StringUtils {
    /**
     * Safely truncates text with ellipsis
     */
    public static truncate(text: string, maxLength: number, ellipsis = '...'): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.slice(0, maxLength - ellipsis.length) + ellipsis;
    }
    
    /**
     * Pluralizes words based on count
     */
    public static pluralize(count: number, singular: string, plural?: string): string {
        if (count === 1) {
            return `${count} ${singular}`;
        }
        return `${count} ${plural || singular + 's'}`;
    }
    
    /**
     * Formats numbers with thousand separators
     */
    public static formatNumber(num: number, locale = 'en-US'): string {
        return new Intl.NumberFormat(locale).format(num);
    }
    
    /**
     * Escapes HTML special characters
     */
    public static escapeHtml(text: string): string {
        const escapeMap: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        
        return text.replace(/[&<>"']/g, char => escapeMap[char]);
    }
    
    /**
     * Converts text to kebab-case for CSS classes
     */
    public static toKebabCase(text: string): string {
        return text
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }
}
```

#### **Line Analysis**

```typescript
// Line-specific text analysis
export class LineAnalyzer {
    /**
     * Determines if line is a comment
     */
    public static isComment(line: string, patterns: CommentPatterns): boolean {
        const trimmed = line.trim();
        
        // Check single-line comments
        if (patterns.single && trimmed.startsWith(patterns.single)) {
            return true;
        }
        
        // Check block comment start
        if (patterns.block && trimmed.startsWith(patterns.block.start)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Determines if line is blank or whitespace only
     */
    public static isBlank(line: string): boolean {
        return /^\s*$/.test(line);
    }
    
    /**
     * Counts significant characters (non-whitespace)
     */
    public static getSignificantCharCount(line: string): number {
        return line.replace(/\s/g, '').length;
    }
    
    /**
     * Classifies line type
     */
    public static classifyLine(line: string, patterns: CommentPatterns): LineType {
        if (this.isBlank(line)) {
            return 'blank';
        }
        if (this.isComment(line, patterns)) {
            return 'comment';
        }
        return 'code';
    }
}
```

---

### **Performance Utilities**

#### **Timing and Profiling**

```typescript
// Performance measurement utilities
export class PerformanceUtils {
    private static timers = new Map<string, number>();
    
    /**
     * Starts a performance timer
     */
    public static startTimer(name: string): void {
        this.timers.set(name, performance.now());
    }
    
    /**
     * Stops timer and returns elapsed time
     */
    public static stopTimer(name: string): number {
        const startTime = this.timers.get(name);
        if (!startTime) {
            throw new Error(`Timer '${name}' not found`);
        }
        
        const elapsed = performance.now() - startTime;
        this.timers.delete(name);
        return elapsed;
    }
    
    /**
     * Measures function execution time
     */
    public static async measureAsync<T>(
        operation: () => Promise<T>,
        label?: string
    ): Promise<{ result: T; duration: number }> {
        const start = performance.now();
        const result = await operation();
        const duration = performance.now() - start;
        
        if (label) {
            console.log(`${label} completed in ${duration.toFixed(2)}ms`);
        }
        
        return { result, duration };
    }
    
    /**
     * Debounces function calls
     */
    public static debounce<T extends (...args: any[]) => void>(
        func: T,
        delay: number
    ): T {
        let timeoutId: NodeJS.Timeout;
        
        return ((...args: Parameters<T>) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func(...args), delay);
        }) as T;
    }
    
    /**
     * Throttles function calls
     */
    public static throttle<T extends (...args: any[]) => void>(
        func: T,
        delay: number
    ): T {
        let lastCall = 0;
        
        return ((...args: Parameters<T>) => {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                func(...args);
            }
        }) as T;
    }
}
```

#### **Memory Management**

```typescript
// Memory usage monitoring and optimization
export class MemoryUtils {
    /**
     * Gets current memory usage information
     */
    public static getMemoryUsage(): MemoryUsage {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            external: Math.round(usage.external / 1024 / 1024) // MB
        };
    }
    
    /**
     * Monitors memory usage for a specific operation
     */
    public static async monitorMemory<T>(
        operation: () => Promise<T>,
        label?: string
    ): Promise<{ result: T; memoryDelta: number }> {
        const before = process.memoryUsage().heapUsed;
        const result = await operation();
        const after = process.memoryUsage().heapUsed;
        
        const delta = Math.round((after - before) / 1024 / 1024); // MB
        
        if (label) {
            console.log(`${label} memory delta: ${delta}MB`);
        }
        
        return { result, memoryDelta: delta };
    }
    
    /**
     * Creates a memory-bounded cache
     */
    public static createBoundedCache<K, V>(maxSize: number): BoundedCache<K, V> {
        return new BoundedCache(maxSize);
    }
}
```

---

### **Error Handling Utilities**

#### **Error Classification and Recovery**

```typescript
// Comprehensive error handling utilities
export class ErrorUtils {
    /**
     * Wraps async operations with error handling
     */
    public static async safeAsync<T>(
        operation: () => Promise<T>,
        fallback?: T,
        onError?: (error: Error) => void
    ): Promise<T | undefined> {
        try {
            return await operation();
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            
            if (onError) {
                onError(errorObj);
            } else {
                console.error('Safe async operation failed:', errorObj);
            }
            
            return fallback;
        }
    }
    
    /**
     * Retries operation with exponential backoff
     */
    public static async retryWithBackoff<T>(
        operation: () => Promise<T>,
        maxRetries = 3,
        baseDelay = 1000
    ): Promise<T> {
        let lastError: Error;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                if (attempt === maxRetries) {
                    throw lastError;
                }
                
                // Exponential backoff with jitter
                const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError!;
    }
    
    /**
     * Creates user-friendly error messages
     */
    public static formatUserError(error: Error, context?: string): string {
        const baseMessage = context ? `${context}: ` : '';
        
        // Handle common error types
        if (error.code === 'ENOENT') {
            return `${baseMessage}File or directory not found`;
        }
        if (error.code === 'EACCES') {
            return `${baseMessage}Permission denied`;
        }
        if (error.code === 'EMFILE' || error.code === 'ENFILE') {
            return `${baseMessage}Too many files open`;
        }
        
        // Generic message for unknown errors
        return `${baseMessage}${error.message || 'An unexpected error occurred'}`;
    }
}
```

---

### **Validation Utilities**

#### **Input Validation**

```typescript
// Input validation and sanitization
export class ValidationUtils {
    /**
     * Validates file path safety
     */
    public static isValidFilePath(filePath: string): boolean {
        // Check for path traversal attacks
        if (filePath.includes('..') || filePath.includes('~')) {
            return false;
        }
        
        // Check for invalid characters (Windows)
        const invalidChars = /[<>:"|?*]/;
        if (process.platform === 'win32' && invalidChars.test(filePath)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Validates glob pattern syntax
     */
    public static isValidGlobPattern(pattern: string): boolean {
        try {
            minimatch.makeRe(pattern);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Validates emoji string
     */
    public static isValidEmoji(emoji: string): boolean {
        // Check for valid Unicode emoji ranges
        const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u;
        return emojiRegex.test(emoji) && emoji.length <= 4;
    }
    
    /**
     * Sanitizes user input
     */
    public static sanitizeInput(input: string, maxLength = 1000): string {
        return input
            .trim()
            .slice(0, maxLength)
            .replace(/[<>]/g, ''); // Remove potentially dangerous chars
    }
}
```

---

## 🧪 **Utility Testing**

### **Test Utilities**

```typescript
// Testing helper functions
export class TestUtils {
    /**
     * Creates temporary test files
     */
    public static async createTempFiles(files: Record<string, string>): Promise<string[]> {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-counter-test-'));
        const createdFiles: string[] = [];
        
        for (const [relativePath, content] of Object.entries(files)) {
            const fullPath = path.join(tempDir, relativePath);
            const dir = path.dirname(fullPath);
            
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(fullPath, content, 'utf8');
            createdFiles.push(fullPath);
        }
        
        return createdFiles;
    }
    
    /**
     * Cleans up temporary files
     */
    public static async cleanupTempFiles(filePaths: string[]): Promise<void> {
        for (const filePath of filePaths) {
            try {
                await fs.unlink(filePath);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    }
    
    /**
     * Generates test data
     */
    public static generateTestFileContent(lineCount: number, language: string): string {
        const patterns = LanguageDetector.getCommentPatterns(language);
        const lines: string[] = [];
        
        // Add some comments
        const commentCount = Math.floor(lineCount * 0.2);
        for (let i = 0; i < commentCount; i++) {
            lines.push(`${patterns.single || '//'} Comment line ${i + 1}`);
        }
        
        // Add blank lines
        const blankCount = Math.floor(lineCount * 0.1);
        for (let i = 0; i < blankCount; i++) {
            lines.push('');
        }
        
        // Add code lines
        const codeCount = lineCount - commentCount - blankCount;
        for (let i = 0; i < codeCount; i++) {
            lines.push(`const variable${i} = 'value${i}';`);
        }
        
        return lines.join('\n');
    }
}
```

---

## 📋 **Utility Best Practices**

### **Design Principles**

1. **Pure Functions**: Utilities should be stateless when possible
2. **Error Handling**: All utilities should handle edge cases gracefully
3. **Performance**: Optimize for common use cases
4. **Type Safety**: Provide comprehensive TypeScript types
5. **Testing**: Include comprehensive test coverage

### **Usage Guidelines**

1. **Consistent Interfaces**: Use similar parameter patterns across utilities
2. **Documentation**: Include JSDoc comments for all public functions
3. **Validation**: Validate inputs at utility boundaries
4. **Logging**: Use appropriate logging levels for errors and warnings
5. **Backwards Compatibility**: Maintain stable APIs across versions

---

## 🔗 **Type Definitions**

```typescript
// Common utility interfaces
export interface PatternValidationResult {
    valid: boolean;
    error: string | null;
    suggestions: string[];
}

export interface CommentPatterns {
    single?: string;
    block?: {
        start: string;
        end: string;
    };
}

export interface MemoryUsage {
    rss: number;        // Resident Set Size (MB)
    heapTotal: number;  // Total heap size (MB)  
    heapUsed: number;   // Used heap size (MB)
    external: number;   // External memory (MB)
}

export interface PatternCoverageReport {
    totalFiles: number;
    excludedFiles: number;
    includedFiles: number;
    coveragePercentage: number;
    suggestions: string[];
}

export type LineType = 'blank' | 'comment' | 'code';

export class BoundedCache<K, V> {
    constructor(private maxSize: number) {}
    
    public set(key: K, value: V): void {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }
    
    private cache = new Map<K, V>();
}
```

---

## 🔗 **Related Documentation**

- [Services Layer](./services.md) - Service implementations using utilities
- [Testing Framework](./testing.md) - Test utilities and patterns  
- [TypeScript Interfaces](./typescript-interfaces.md) - Type definitions
- [File Watching](./file-watching.md) - File system utility usage
- [Performance Optimization](./caching-system.md) - Performance utility applications