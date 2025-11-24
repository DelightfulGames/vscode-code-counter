/**
 * VS Code Code Counter Extension
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

import { DebugService } from './debugService';
import { ResolvedSettings } from './workspaceDatabaseService';

/**
 * Settings Cache for resolved settings to reduce database queries
 * Implements TTL-based caching with smart invalidation
 */
export class SettingsCache {
    private cache: Map<string, ResolvedSettings> = new Map();
    private cacheTimestamp: Map<string, number> = new Map();
    private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    private debug: DebugService;

    constructor() {
        this.debug = DebugService.getInstance();
        this.debug.verbose('SettingsCache initialized with TTL:', this.CACHE_TTL, 'ms');
    }

    /**
     * Get cached settings for a path
     * Returns null if not cached or expired
     */
    get(path: string): ResolvedSettings | null {
        const cached = this.cache.get(path);
        const timestamp = this.cacheTimestamp.get(path);

        if (cached && timestamp && (Date.now() - timestamp < this.CACHE_TTL)) {
            this.debug.verbose('Settings cache HIT for path:', path);
            return cached;
        }

        // Cache expired or doesn't exist
        if (cached) {
            this.debug.verbose('Settings cache EXPIRED for path:', path);
            this.invalidate(path);
        } else {
            this.debug.verbose('Settings cache MISS for path:', path);
        }
        
        return null;
    }

    /**
     * Set cached settings for a path
     */
    set(path: string, settings: ResolvedSettings): void {
        this.cache.set(path, settings);
        this.cacheTimestamp.set(path, Date.now());
        this.debug.verbose('Settings cached for path:', path, 'cache size:', this.cache.size);
    }

    /**
     * Invalidate cached settings for a specific path or all paths
     */
    invalidate(path?: string): void {
        if (path) {
            this.cache.delete(path);
            this.cacheTimestamp.delete(path);
            this.debug.verbose('Settings cache invalidated for path:', path);
        } else {
            const oldSize = this.cache.size;
            this.cache.clear();
            this.cacheTimestamp.clear();
            this.debug.verbose('Settings cache cleared completely. Was holding', oldSize, 'entries');
        }
    }

    /**
     * Invalidate all cached settings when settings change
     * This is called when VS Code settings or database settings are modified
     */
    onSettingsChange(): void {
        this.debug.verbose('Settings change detected - clearing entire settings cache');
        this.invalidate(); // Clear entire cache
    }

    /**
     * Get cache statistics for debugging
     */
    getCacheStats(): {
        size: number;
        entries: { path: string; age: number }[];
        hitRate?: number;
    } {
        const now = Date.now();
        const entries: { path: string; age: number }[] = [];
        
        for (const [path, timestamp] of this.cacheTimestamp.entries()) {
            entries.push({
                path,
                age: now - timestamp
            });
        }

        return {
            size: this.cache.size,
            entries: entries.sort((a, b) => b.age - a.age) // Most recent first
        };
    }

    /**
     * Clean up expired entries from cache
     * Called periodically to prevent memory leaks
     */
    cleanupExpired(): void {
        const now = Date.now();
        const expiredPaths: string[] = [];

        for (const [path, timestamp] of this.cacheTimestamp.entries()) {
            if (now - timestamp >= this.CACHE_TTL) {
                expiredPaths.push(path);
            }
        }

        if (expiredPaths.length > 0) {
            this.debug.verbose('Cleaning up', expiredPaths.length, 'expired settings cache entries');
            for (const path of expiredPaths) {
                this.invalidate(path);
            }
        }
    }

    /**
     * Check if a path has valid cached settings
     */
    has(path: string): boolean {
        const timestamp = this.cacheTimestamp.get(path);
        if (!timestamp) {
            return false;
        }

        return (Date.now() - timestamp < this.CACHE_TTL);
    }

    /**
     * Get all cached paths (for debugging)
     */
    getCachedPaths(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Dispose of the cache
     */
    dispose(): void {
        this.debug.verbose('Disposing SettingsCache with', this.cache.size, 'entries');
        this.cache.clear();
        this.cacheTimestamp.clear();
    }
}