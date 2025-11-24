/**
 * VS Code Code Counter Extension
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

import * as fs from 'fs';
import * as path from 'path';
import { DebugService } from './debugService';

/**
 * File metadata information
 */
export interface FileMetadata {
    size: number;
    mtime: number;
    isDirectory: boolean;
    exists: boolean;
}

/**
 * File Metadata Cache to reduce repeated file system operations
 * Implements TTL-based caching with save invalidation
 */
export class FileMetadataCache {
    private cache: Map<string, FileMetadata> = new Map();
    private cacheTimestamp: Map<string, number> = new Map();
    private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    private debug: DebugService;

    constructor() {
        this.debug = DebugService.getInstance();
        this.debug.verbose('FileMetadataCache initialized with TTL:', this.CACHE_TTL, 'ms');
    }

    /**
     * Get cached metadata for a file
     * Returns null if not cached or expired
     */
    async getMetadata(filePath: string): Promise<FileMetadata | null> {
        const cached = this.cache.get(filePath);
        const timestamp = this.cacheTimestamp.get(filePath);

        if (cached && timestamp && (Date.now() - timestamp < this.CACHE_TTL)) {
            this.debug.verbose('File metadata cache HIT for:', filePath);
            return cached;
        }

        // Cache expired or doesn't exist
        if (cached) {
            this.debug.verbose('File metadata cache EXPIRED for:', filePath);
            this.invalidateFile(filePath);
        } else {
            this.debug.verbose('File metadata cache MISS for:', filePath);
        }

        return null;
    }

    /**
     * Get metadata from file system and cache it
     */
    async getOrFetchMetadata(filePath: string): Promise<FileMetadata> {
        // Try cache first
        const cached = await this.getMetadata(filePath);
        if (cached) {
            return cached;
        }

        // Fetch from file system
        const metadata = await this.fetchMetadata(filePath);
        this.setMetadata(filePath, metadata);
        return metadata;
    }

    /**
     * Fetch metadata directly from file system
     */
    private async fetchMetadata(filePath: string): Promise<FileMetadata> {
        try {
            const stats = await fs.promises.stat(filePath);
            return {
                size: stats.size,
                mtime: stats.mtime.getTime(),
                isDirectory: stats.isDirectory(),
                exists: true
            };
        } catch (error) {
            // File doesn't exist or access denied
            return {
                size: 0,
                mtime: 0,
                isDirectory: false,
                exists: false
            };
        }
    }

    /**
     * Set cached metadata for a file
     */
    setMetadata(filePath: string, metadata: FileMetadata): void {
        this.cache.set(filePath, metadata);
        this.cacheTimestamp.set(filePath, Date.now());
        this.debug.verbose('File metadata cached for:', filePath, 'cache size:', this.cache.size);
    }

    /**
     * Invalidate cached metadata for a specific file
     */
    invalidateFile(filePath: string): void {
        this.cache.delete(filePath);
        this.cacheTimestamp.delete(filePath);
        this.debug.verbose('File metadata cache invalidated for:', filePath);
    }

    /**
     * Called when a file is saved
     * Invalidates the file and its parent directory
     */
    onFileSaved(filePath: string): void {
        this.debug.verbose('File saved - invalidating metadata cache for:', filePath);
        this.invalidateFile(filePath);

        // Also invalidate parent directory cache
        const parentDir = path.dirname(filePath);
        if (parentDir && parentDir !== filePath) {
            this.debug.verbose('Also invalidating parent directory cache for:', parentDir);
            this.invalidateFile(parentDir);
        }
    }

    /**
     * Called when a file is created or deleted
     */
    onFileChanged(filePath: string): void {
        this.debug.verbose('File changed - invalidating metadata cache for:', filePath);
        this.invalidateFile(filePath);

        // Invalidate parent directory
        const parentDir = path.dirname(filePath);
        if (parentDir && parentDir !== filePath) {
            this.invalidateFile(parentDir);
        }
    }

    /**
     * Invalidate all cached metadata for files in a directory
     */
    invalidateDirectory(dirPath: string): void {
        const pathsToInvalidate: string[] = [];
        
        for (const cachedPath of this.cache.keys()) {
            if (cachedPath.startsWith(dirPath)) {
                pathsToInvalidate.push(cachedPath);
            }
        }

        if (pathsToInvalidate.length > 0) {
            this.debug.verbose('Invalidating', pathsToInvalidate.length, 'file metadata entries in directory:', dirPath);
            for (const pathToInvalidate of pathsToInvalidate) {
                this.invalidateFile(pathToInvalidate);
            }
        }
    }

    /**
     * Get cache statistics for debugging
     */
    getCacheStats(): {
        size: number;
        entries: { path: string; age: number; metadata: FileMetadata }[];
    } {
        const now = Date.now();
        const entries: { path: string; age: number; metadata: FileMetadata }[] = [];
        
        for (const [filePath, timestamp] of this.cacheTimestamp.entries()) {
            const metadata = this.cache.get(filePath);
            if (metadata) {
                entries.push({
                    path: filePath,
                    age: now - timestamp,
                    metadata
                });
            }
        }

        return {
            size: this.cache.size,
            entries: entries.sort((a, b) => b.age - a.age) // Most recent first
        };
    }

    /**
     * Clean up expired entries from cache
     */
    cleanupExpired(): void {
        const now = Date.now();
        const expiredPaths: string[] = [];

        for (const [filePath, timestamp] of this.cacheTimestamp.entries()) {
            if (now - timestamp >= this.CACHE_TTL) {
                expiredPaths.push(filePath);
            }
        }

        if (expiredPaths.length > 0) {
            this.debug.verbose('Cleaning up', expiredPaths.length, 'expired file metadata cache entries');
            for (const filePath of expiredPaths) {
                this.invalidateFile(filePath);
            }
        }
    }

    /**
     * Check if a file has valid cached metadata
     */
    has(filePath: string): boolean {
        const timestamp = this.cacheTimestamp.get(filePath);
        if (!timestamp) {
            return false;
        }

        return (Date.now() - timestamp < this.CACHE_TTL);
    }

    /**
     * Get all cached file paths (for debugging)
     */
    getCachedPaths(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Dispose of the cache
     */
    dispose(): void {
        this.debug.verbose('Disposing FileMetadataCache with', this.cache.size, 'entries');
        this.cache.clear();
        this.cacheTimestamp.clear();
    }
}