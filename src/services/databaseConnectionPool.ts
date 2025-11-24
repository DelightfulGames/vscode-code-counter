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
import initSqlJs, { Database } from 'sql.js';
import { DebugService } from './debugService';

/**
 * Database Connection Pool for managing SQLite connections
 * Reduces memory usage by reusing connections instead of creating new ones for each operation
 */
export class DatabaseConnectionPool {
    private static instance: DatabaseConnectionPool;
    private connections: Map<string, Database> = new Map();
    private connectionCount: Map<string, number> = new Map();
    private initialized: Map<string, boolean> = new Map();
    private debug: DebugService;

    private constructor() {
        this.debug = DebugService.getInstance();
        this.debug.verbose('DatabaseConnectionPool initialized');
    }

    static getInstance(): DatabaseConnectionPool {
        if (!this.instance) {
            this.instance = new DatabaseConnectionPool();
        }
        return this.instance;
    }

    /**
     * Get a database connection for the specified path
     * Reuses existing connections when available
     */
    async getConnection(dbPath: string): Promise<Database> {
        if (this.connections.has(dbPath)) {
            const count = this.connectionCount.get(dbPath) || 0;
            this.connectionCount.set(dbPath, count + 1);
            this.debug.verbose('Reusing existing database connection for:', dbPath, 'ref count:', count + 1);
            return this.connections.get(dbPath)!;
        }

        this.debug.verbose('Creating new database connection for:', dbPath);
        const connection = await this.createConnection(dbPath);
        this.connections.set(dbPath, connection);
        this.connectionCount.set(dbPath, 1);
        return connection;
    }

    /**
     * Release a database connection
     * Closes the connection when no longer referenced
     */
    releaseConnection(dbPath: string): void {
        const count = this.connectionCount.get(dbPath) || 0;
        if (count <= 1) {
            // Close connection when no longer needed
            const connection = this.connections.get(dbPath);
            if (connection) {
                this.debug.verbose('Closing database connection for:', dbPath);
                connection.close();
                this.connections.delete(dbPath);
                this.connectionCount.delete(dbPath);
                this.initialized.delete(dbPath);
            }
        } else {
            this.connectionCount.set(dbPath, count - 1);
            this.debug.verbose('Released database connection reference for:', dbPath, 'ref count:', count - 1);
        }
    }

    /**
     * Check if a database connection exists and is initialized
     */
    isInitialized(dbPath: string): boolean {
        return this.initialized.get(dbPath) || false;
    }

    /**
     * Mark a database as initialized
     */
    markInitialized(dbPath: string): void {
        this.initialized.set(dbPath, true);
    }

    /**
     * Create a new database connection
     */
    private async createConnection(dbPath: string): Promise<Database> {
        const SQL = await initSqlJs({
            // Use bundled wasm file - handle both development and packaged extension paths
            locateFile: (file: string) => {
                // Multiple path attempts for different extension deployment scenarios
                const pathsToTry = [
                    // Packaged extension - node_modules at same level as out/
                    path.join(__dirname, '../node_modules/sql.js/dist/', file),
                    // Development - node_modules at root level
                    path.join(__dirname, '../../node_modules/sql.js/dist/', file),
                    // Alternative packaged path - if bundled differently
                    path.join(__dirname, 'node_modules/sql.js/dist/', file),
                    // Extension root relative path
                    path.join(__dirname, '../../../node_modules/sql.js/dist/', file)
                ];
                
                for (const attemptPath of pathsToTry) {
                    if (fs.existsSync(attemptPath)) {
                        this.debug.verbose('Using sql.js file:', attemptPath);
                        return attemptPath;
                    }
                }
                
                // Fallback to default behavior
                this.debug.error('sql.js file not found in expected paths, using default');
                return file;
            }
        });

        let db: Database;
        
        try {
            if (fs.existsSync(dbPath)) {
                // Load existing database
                const data = fs.readFileSync(dbPath);
                db = new SQL.Database(data);
                this.debug.verbose('Loaded existing database from:', dbPath);
            } else {
                // Create new database
                db = new SQL.Database();
                this.debug.verbose('Created new database for:', dbPath);
            }
        } catch (error) {
            this.debug.error('Failed to create/load database:', error);
            // Fallback to new database
            db = new SQL.Database();
        }

        return db;
    }

    /**
     * Save a database to file
     */
    saveDatabase(dbPath: string): void {
        const connection = this.connections.get(dbPath);
        if (!connection) {
            this.debug.error('Attempted to save non-existent database connection:', dbPath);
            return;
        }

        try {
            const data = connection.export();
            this.debug.verbose('Saving database to file:', dbPath, 'size:', data.length, 'bytes');
            
            // Ensure directory exists
            const dir = path.dirname(dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(dbPath, data);
            this.debug.verbose('Database saved successfully to:', dbPath);
        } catch (error) {
            this.debug.error('Failed to save database to file:', dbPath, error);
        }
    }

    /**
     * Get connection statistics for debugging
     */
    getConnectionStats(): { path: string; refCount: number; initialized: boolean }[] {
        const stats: { path: string; refCount: number; initialized: boolean }[] = [];
        for (const [path, refCount] of this.connectionCount.entries()) {
            stats.push({
                path,
                refCount,
                initialized: this.initialized.get(path) || false
            });
        }
        return stats;
    }

    /**
     * Clean up all connections (called on extension disposal)
     */
    dispose(): void {
        this.debug.verbose('Disposing DatabaseConnectionPool, closing', this.connections.size, 'connections');
        
        for (const [dbPath, connection] of this.connections.entries()) {
            try {
                // Save before closing
                this.saveDatabase(dbPath);
                connection.close();
            } catch (error) {
                this.debug.error('Error disposing database connection:', dbPath, error);
            }
        }
        
        this.connections.clear();
        this.connectionCount.clear();
        this.initialized.clear();
    }
}