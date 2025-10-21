<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

Repository: https://github.com/DelightfulGames/vscode-code-counter
Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->
# Caching System

This document describes the comprehensive caching system that optimizes performance by storing and managing line count data across VS Code sessions.

## Overview

The caching system is a critical performance optimization that prevents unnecessary recalculation of line counts for unchanged files. It provides persistent storage, intelligent cache invalidation, and memory-efficient data structures to maintain responsiveness even in large codebases.

## Architecture

### Core Components

#### LineCountCache Service
The central caching mechanism that manages all line count data:

```typescript
export class LineCountCache {
  private cache: Map<string, CacheEntry>;
  private memoryLimit: number;
  private persistentStorage: CachePersistence;
  private metrics: CacheMetrics;
  
  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.memoryLimit = config.memoryLimit || 50 * 1024 * 1024; // 50MB default
    this.persistentStorage = new CachePersistence(config.storagePath);
    this.metrics = new CacheMetrics();
  }
}
```

#### Cache Entry Structure
Detailed metadata for each cached file:

```typescript
interface CacheEntry {
  filePath: string;
  lineCount: number;
  lastModified: number;
  fileSize: number;
  contentHash: string;
  accessTime: number;
  hitCount: number;
  language?: string;
}
```

#### Cache Configuration
Flexible configuration options:

```typescript
interface CacheConfig {
  enabled: boolean;
  memoryLimit: number;
  maxEntries: number;
  ttl: number; // Time to live in milliseconds
  persistToDisk: boolean;
  storagePath: string;
  compressionEnabled: boolean;
}
```

## Cache Operations

### Cache Retrieval
Efficient lookup with validation:

```typescript
public get(filePath: string): CacheEntry | null {
  const normalizedPath = this.normalizePath(filePath);
  const entry = this.cache.get(normalizedPath);
  
  if (!entry) {
    this.metrics.recordMiss();
    return null;
  }
  
  // Validate entry freshness
  if (this.isStale(entry)) {
    this.cache.delete(normalizedPath);
    this.metrics.recordExpiration();
    return null;
  }
  
  // Update access metadata
  entry.accessTime = Date.now();
  entry.hitCount++;
  this.metrics.recordHit();
  
  return entry;
}
```

### Cache Storage
Intelligent storage with memory management:

```typescript
public set(filePath: string, lineCount: number, metadata?: Partial<CacheEntry>): void {
  const normalizedPath = this.normalizePath(filePath);
  
  // Check memory limits
  if (this.shouldEvict()) {
    this.performEviction();
  }
  
  const entry: CacheEntry = {
    filePath: normalizedPath,
    lineCount,
    lastModified: metadata?.lastModified || Date.now(),
    fileSize: metadata?.fileSize || 0,
    contentHash: metadata?.contentHash || '',
    accessTime: Date.now(),
    hitCount: 1,
    language: metadata?.language
  };
  
  this.cache.set(normalizedPath, entry);
  this.metrics.recordStore();
  
  // Persist to disk if enabled
  if (this.config.persistToDisk) {
    this.persistentStorage.save(entry);
  }
}
```

### Cache Invalidation
Multiple invalidation strategies:

```typescript
public invalidate(filePath: string): boolean {
  const normalizedPath = this.normalizePath(filePath);
  const existed = this.cache.has(normalizedPath);
  
  if (existed) {
    this.cache.delete(normalizedPath);
    this.persistentStorage.remove(normalizedPath);
    this.metrics.recordInvalidation();
  }
  
  return existed;
}

public invalidatePattern(pattern: string): number {
  let count = 0;
  const regex = new RegExp(pattern);
  
  for (const [key] of this.cache) {
    if (regex.test(key)) {
      this.cache.delete(key);
      count++;
    }
  }
  
  this.metrics.recordBulkInvalidation(count);
  return count;
}
```

## Memory Management

### Eviction Strategies

#### Least Recently Used (LRU)
Primary eviction strategy for memory management:

```typescript
private performLRUEviction(): void {
  const entries = Array.from(this.cache.entries());
  
  // Sort by access time (oldest first)
  entries.sort(([, a], [, b]) => a.accessTime - b.accessTime);
  
  // Remove oldest 25% of entries
  const removeCount = Math.floor(entries.length * 0.25);
  
  for (let i = 0; i < removeCount; i++) {
    const [key] = entries[i];
    this.cache.delete(key);
    this.metrics.recordEviction();
  }
}
```

#### Size-Based Eviction
Remove largest entries when memory pressure is high:

```typescript
private performSizeBasedEviction(): void {
  const entries = Array.from(this.cache.entries());
  
  // Sort by file size (largest first)
  entries.sort(([, a], [, b]) => b.fileSize - a.fileSize);
  
  let removedSize = 0;
  const targetSize = this.memoryLimit * 0.1; // Remove 10% of limit
  
  for (const [key, entry] of entries) {
    if (removedSize >= targetSize) break;
    
    this.cache.delete(key);
    removedSize += entry.fileSize;
    this.metrics.recordEviction();
  }
}
```

### Memory Monitoring
Continuous memory usage tracking:

```typescript
private calculateMemoryUsage(): number {
  let totalSize = 0;
  
  for (const entry of this.cache.values()) {
    totalSize += this.getEntrySize(entry);
  }
  
  return totalSize;
}

private getEntrySize(entry: CacheEntry): number {
  // Estimate memory usage of cache entry
  return JSON.stringify(entry).length * 2; // UTF-16 encoding
}
```

## Persistence Layer

### Disk Storage
Persistent cache storage across sessions:

```typescript
class CachePersistence {
  private storagePath: string;
  private compressionEnabled: boolean;
  
  constructor(storagePath: string, compressionEnabled = true) {
    this.storagePath = storagePath;
    this.compressionEnabled = compressionEnabled;
    this.ensureStorageDirectory();
  }
  
  public async save(entry: CacheEntry): Promise<void> {
    const filePath = this.getEntryPath(entry.filePath);
    const data = this.compressionEnabled 
      ? await this.compress(entry)
      : JSON.stringify(entry);
    
    await fs.promises.writeFile(filePath, data);
  }
  
  public async load(filePath: string): Promise<CacheEntry | null> {
    try {
      const entryPath = this.getEntryPath(filePath);
      const data = await fs.promises.readFile(entryPath, 'utf8');
      
      return this.compressionEnabled 
        ? await this.decompress(data)
        : JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
}
```

### Cache Serialization
Efficient serialization for storage:

```typescript
private serialize(entries: Map<string, CacheEntry>): string {
  const serializable = {
    version: this.CACHE_VERSION,
    timestamp: Date.now(),
    entries: Array.from(entries.entries())
  };
  
  return JSON.stringify(serializable);
}

private deserialize(data: string): Map<string, CacheEntry> {
  try {
    const parsed = JSON.parse(data);
    
    // Version compatibility check
    if (parsed.version !== this.CACHE_VERSION) {
      throw new Error('Cache version mismatch');
    }
    
    return new Map(parsed.entries);
  } catch (error) {
    // Return empty cache on parse error
    return new Map();
  }
}
```

## Cache Validation

### Freshness Checks
Determining if cached data is still valid:

```typescript
private isStale(entry: CacheEntry): boolean {
  const now = Date.now();
  
  // TTL-based staleness
  if (this.config.ttl > 0 && (now - entry.lastModified) > this.config.ttl) {
    return true;
  }
  
  // File modification check
  try {
    const stats = fs.statSync(entry.filePath);
    if (stats.mtime.getTime() !== entry.lastModified) {
      return true;
    }
  } catch (error) {
    // File doesn't exist anymore
    return true;
  }
  
  return false;
}
```

### Content Hash Validation
Verify file content hasn't changed:

```typescript
private async validateContentHash(entry: CacheEntry): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(entry.filePath, 'utf8');
    const currentHash = this.calculateHash(content);
    return currentHash === entry.contentHash;
  } catch (error) {
    return false;
  }
}

private calculateHash(content: string): string {
  return require('crypto')
    .createHash('sha256')
    .update(content)
    .digest('hex');
}
```

## Performance Optimizations

### Batch Operations
Efficient bulk cache operations:

```typescript
public setBatch(entries: Array<{filePath: string, lineCount: number}>): void {
  // Temporarily disable persistence for batch operation
  const originalPersist = this.config.persistToDisk;
  this.config.persistToDisk = false;
  
  try {
    entries.forEach(({filePath, lineCount}) => {
      this.set(filePath, lineCount);
    });
  } finally {
    // Re-enable persistence and save batch
    this.config.persistToDisk = originalPersist;
    
    if (originalPersist) {
      this.persistentStorage.saveBatch(entries);
    }
  }
}
```

### Asynchronous Operations
Non-blocking cache operations:

```typescript
public async warmUp(filePaths: string[]): Promise<void> {
  const loadPromises = filePaths.map(async (filePath) => {
    const cached = await this.persistentStorage.load(filePath);
    if (cached && !this.isStale(cached)) {
      this.cache.set(filePath, cached);
    }
  });
  
  await Promise.all(loadPromises);
  this.metrics.recordWarmUp(filePaths.length);
}
```

## Metrics and Analytics

### Performance Metrics
Comprehensive cache performance tracking:

```typescript
class CacheMetrics {
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;
  private invalidations: number = 0;
  
  public getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
  
  public getStats(): CacheStats {
    return {
      hitRate: this.getHitRate(),
      totalHits: this.hits,
      totalMisses: this.misses,
      evictionCount: this.evictions,
      invalidationCount: this.invalidations
    };
  }
}
```

### Usage Analytics
Track cache usage patterns:

```typescript
public analyzeUsage(): CacheAnalysis {
  const entries = Array.from(this.cache.values());
  
  return {
    totalEntries: entries.length,
    averageHitCount: this.calculateAverageHits(entries),
    memoryUsage: this.calculateMemoryUsage(),
    oldestEntry: Math.min(...entries.map(e => e.accessTime)),
    newestEntry: Math.max(...entries.map(e => e.accessTime)),
    languageDistribution: this.getLanguageDistribution(entries)
  };
}
```

## Configuration Integration

### Dynamic Configuration
Runtime configuration updates:

```typescript
public updateConfig(newConfig: Partial<CacheConfig>): void {
  this.config = { ...this.config, ...newConfig };
  
  // Apply configuration changes
  if (newConfig.memoryLimit && newConfig.memoryLimit < this.memoryLimit) {
    this.performEviction();
  }
  
  if (newConfig.enabled === false) {
    this.clear();
  }
  
  this.metrics.recordConfigChange();
}
```

### VS Code Settings Integration
Seamless integration with VS Code configuration:

```typescript
private loadConfigFromVSCode(): CacheConfig {
  const config = vscode.workspace.getConfiguration('codeCounter.cache');
  
  return {
    enabled: config.get('enabled', true),
    memoryLimit: config.get('memoryLimit', 50 * 1024 * 1024),
    maxEntries: config.get('maxEntries', 10000),
    ttl: config.get('ttl', 24 * 60 * 60 * 1000), // 24 hours
    persistToDisk: config.get('persistToDisk', true),
    storagePath: config.get('storagePath', ''),
    compressionEnabled: config.get('compressionEnabled', true)
  };
}
```

## Error Handling

### Graceful Degradation
System continues functioning even with cache failures:

```typescript
private handleCacheError(error: Error, operation: string): void {
  console.warn(`Cache operation '${operation}' failed:`, error);
  
  // Disable cache temporarily on persistent errors
  if (this.errorCount++ > this.MAX_ERRORS) {
    this.config.enabled = false;
    vscode.window.showWarningMessage(
      'Cache system disabled due to repeated errors'
    );
  }
}
```

### Recovery Mechanisms
Automatic recovery from cache corruption:

```typescript
public async recover(): Promise<void> {
  try {
    // Clear corrupted cache
    this.cache.clear();
    
    // Rebuild from persistent storage
    await this.loadFromDisk();
    
    // Validate all entries
    await this.validateAllEntries();
    
    this.errorCount = 0;
    this.config.enabled = true;
  } catch (error) {
    // Fall back to empty cache
    this.cache.clear();
    this.initializeEmptyCache();
  }
}
```

## Testing

### Cache Testing
Comprehensive test suite for cache functionality:

```typescript
describe('LineCountCache', () => {
  let cache: LineCountCache;
  
  beforeEach(() => {
    cache = new LineCountCache({
      enabled: true,
      memoryLimit: 1024 * 1024,
      maxEntries: 100,
      ttl: 60000,
      persistToDisk: false,
      storagePath: '',
      compressionEnabled: false
    });
  });
  
  it('should store and retrieve cache entries', () => {
    cache.set('/test/file.ts', 100);
    const entry = cache.get('/test/file.ts');
    
    expect(entry).toBeDefined();
    expect(entry?.lineCount).toBe(100);
  });
  
  it('should handle cache eviction under memory pressure', () => {
    // Fill cache beyond limit
    for (let i = 0; i < 200; i++) {
      cache.set(`/test/file${i}.ts`, 100);
    }
    
    expect(cache.size()).toBeLessThanOrEqual(100);
  });
});
```

The caching system provides efficient, reliable performance optimization while maintaining data integrity and providing comprehensive monitoring and configuration options.