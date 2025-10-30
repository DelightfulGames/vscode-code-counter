/**
 * VS Code Code Counter Extension
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import initSqlJs, { Database } from 'sql.js';
import { DebugService } from './debugService';

export interface WorkspaceSettings {
    'codeCounter.lineThresholds.midThreshold'?: number;
    'codeCounter.lineThresholds.highThreshold'?: number;
    'codeCounter.emojis.normal'?: string;
    'codeCounter.emojis.warning'?: string;
    'codeCounter.emojis.danger'?: string;
    'codeCounter.emojis.folders.normal'?: string;
    'codeCounter.emojis.folders.warning'?: string;
    'codeCounter.emojis.folders.danger'?: string;
    'codeCounter.excludePatterns'?: string[];
    'codeCounter.includePatterns'?: string[];
    'codeCounter.showNotificationOnAutoGenerate'?: boolean;
}

export interface ResolvedSettings {
    'codeCounter.lineThresholds.midThreshold': number;
    'codeCounter.lineThresholds.highThreshold': number;
    'codeCounter.emojis.normal': string;
    'codeCounter.emojis.warning': string;
    'codeCounter.emojis.danger': string;
    'codeCounter.emojis.folders.normal': string;
    'codeCounter.emojis.folders.warning': string;
    'codeCounter.emojis.folders.danger': string;
    'codeCounter.excludePatterns': string[];
    'codeCounter.includePatterns': string[];
    'codeCounter.showNotificationOnAutoGenerate': boolean;
}

export interface SettingsWithInheritance {
    resolvedSettings: ResolvedSettings;
    currentSettings: WorkspaceSettings;
    parentSettings: WorkspaceSettings;
}

/**
 * Database-powered workspace settings service
 * Replaces scattered .code-counter.json files with a lightweight SQLite database
 */
export class WorkspaceDatabaseService implements vscode.Disposable {
    private db: Database | undefined;
    private workspacePath: string;
    private codeCounterDir: string;
    private reportsDir: string;
    private dbPath: string;
    private initPromise: Promise<void>;
    private instanceId: string = Math.random().toString(36).substr(2, 9);
    private debug = DebugService.getInstance();

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.codeCounterDir = path.join(workspacePath, '.vscode', 'code-counter');
        this.reportsDir = path.join(this.codeCounterDir, 'reports');
        this.dbPath = path.join(this.codeCounterDir, 'code-counter.db');
        
        this.debug.verbose('WorkspaceDatabaseService created for path:', workspacePath, 'instanceId:', this.instanceId, 'dbPath:', this.dbPath);
        
        // Ensure directory structure exists
        this.ensureDirectoryStructure();
        
        // Initialize database asynchronously
        this.initPromise = this.initializeDatabase();
    }

    /**
     * Ensure the .vscode/code-counter/ directory structure exists
     */
    private ensureDirectoryStructure(): void {
        if (!fs.existsSync(this.codeCounterDir)) {
            fs.mkdirSync(this.codeCounterDir, { recursive: true });
        }
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    /**
     * Initialize database asynchronously
     */
    private async initializeDatabase(): Promise<void> {
        try {
            this.debug.verbose('Initializing database for path:', this.workspacePath);
            const SQL = await initSqlJs({
                // Use bundled wasm file - handle both development and packaged extension paths
                locateFile: (file: string) => {
                    // Try packaged extension path first
                    const packagedPath = path.join(__dirname, '../node_modules/sql.js/dist/', file);
                    if (fs.existsSync(packagedPath)) {
                        this.debug.verbose('Using packaged sql.js file:', packagedPath);
                        return packagedPath;
                    }
                    // Fallback to development path
                    const devPath = path.join(__dirname, '../../node_modules/sql.js/dist/', file);
                    this.debug.verbose('Using development sql.js file:', devPath);
                    return devPath;
                }
            });
            
            // Load existing database or create new one
            let data: Uint8Array | undefined;
            if (fs.existsSync(this.dbPath)) {
                data = fs.readFileSync(this.dbPath);
                this.debug.verbose('Loaded existing database file, size:', data.length, 'bytes from', this.dbPath);
            } else {
                this.debug.verbose('No existing database file found at', this.dbPath);
            }
            
            this.db = new SQL.Database(data);
            this.initializeSchema();
            
            // Show what's currently in the database
            const stmt = this.db!.prepare(`
                SELECT COUNT(*) as count FROM workspace_settings
            `);
            stmt.bind([]);
            if (stmt.step()) {
                const result = stmt.getAsObject();
                this.debug.verbose('Database initialized with', result.count, 'settings records');
            }
            stmt.free();
        } catch (error) {
            this.debug.error('Failed to initialize database:', error);
            throw error;
        }
    }

    /**
     * Initialize database schema
     */
    private initializeSchema(): void {
        if (!this.db) return;
        
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS workspace_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                directory_path TEXT NOT NULL,
                setting_key TEXT NOT NULL,
                setting_value TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(directory_path, setting_key)
            );

            CREATE INDEX IF NOT EXISTS idx_directory_path 
                ON workspace_settings(directory_path);
            
            CREATE INDEX IF NOT EXISTS idx_setting_key 
                ON workspace_settings(setting_key);
        `);
        
        // Save the database to disk
        this.saveToFile();
    }

    /**
     * Save database to file
     */
    private saveToFile(): void {
        if (!this.db) return;
        
        try {
            const data = this.db.export();
            this.debug.verbose('saveToFile exporting database size:', data.length, 'bytes to', this.dbPath);
            fs.writeFileSync(this.dbPath, data);
            this.debug.verbose('saveToFile completed successfully');
        } catch (error) {
            this.debug.error('Failed to save database:', error);
        }
    }

    /**
     * Ensure database is initialized
     */
    private async ensureInitialized(): Promise<void> {
        await this.initPromise;
        if (!this.db) {
            throw new Error('Database not initialized');
        }
    }

    /**
     * Get settings for a specific directory path with inheritance
     */
    async getSettingsWithInheritance(directoryPath: string): Promise<SettingsWithInheritance> {
        await this.ensureInitialized();
        
        // Handle empty directoryPath or workspace root
        let relativePath: string;
        const normalizedDir = path.normalize(directoryPath).toLowerCase();
        const normalizedWorkspace = path.normalize(this.workspacePath).toLowerCase();
        this.debug.verbose('Path comparison - directoryPath:', directoryPath);
        this.debug.verbose('Path comparison - this.workspacePath:', this.workspacePath);
        this.debug.verbose('Path comparison - normalizedDir:', normalizedDir);
        this.debug.verbose('Path comparison - normalizedWorkspace:', normalizedWorkspace);
        this.debug.verbose('Path comparison - are equal:', normalizedDir === normalizedWorkspace);
        
        if (!directoryPath || directoryPath === '' || normalizedDir === normalizedWorkspace) {
            this.debug.verbose('Using workspace root relativePath (empty string)');
            relativePath = '';
        } else {
            this.debug.verbose('Computing relative path...');
            // Ensure we're working with absolute paths for safe relative calculation
            const normalizedWorkspacePath = path.resolve(path.normalize(this.workspacePath));
            const normalizedDirectoryPath = path.resolve(path.normalize(directoryPath));
            this.debug.verbose('normalizedWorkspacePath:', normalizedWorkspacePath);
            this.debug.verbose('normalizedDirectoryPath:', normalizedDirectoryPath);
            
            // Security check: ensure directory is within workspace (case-insensitive on Windows)
            if (!normalizedDirectoryPath.toLowerCase().startsWith(normalizedWorkspacePath.toLowerCase())) {
                this.debug.error('SECURITY: Directory path is outside workspace bounds:', directoryPath);
                this.debug.error('SECURITY: normalizedDirectoryPath does not start with normalizedWorkspacePath');
                relativePath = ''; // Fallback to workspace root
            } else {
                this.debug.verbose('Security check passed, calculating relative path...');
                relativePath = path.relative(normalizedWorkspacePath, normalizedDirectoryPath).replace(/\\/g, '/');
                this.debug.verbose('Calculated relativePath before security check:', relativePath);
                
                // Additional security check for path traversal
                if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
                    this.debug.error('SECURITY: Calculated relative path contains path traversal:', relativePath);
                    relativePath = ''; // Fallback to workspace root
                } else {
                    this.debug.verbose('All security checks passed, final relativePath:', relativePath);
                }
            }
        }
        
        this.debug.verbose('getSettingsWithInheritance for', directoryPath, 'relativePath:', relativePath, 'instanceId:', this.instanceId, 'workspacePath:', this.workspacePath);
        
        // Get all settings that apply to this path (including parent paths)
        const query = `
            SELECT directory_path, setting_key, setting_value
            FROM workspace_settings 
            WHERE (directory_path = '' OR directory_path = ? OR ? LIKE directory_path || '/%')
            ORDER BY LENGTH(directory_path) ASC
        `;
        this.debug.verbose('SQL Query:', query);
        this.debug.verbose('Query parameters:', [relativePath, relativePath]);
        
        const stmt = this.db!.prepare(query);
        
        stmt.bind([relativePath, relativePath]);
        const rows: any[] = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        
        this.debug.verbose('Found rows:', rows);
        
        // Debug: Show what's actually in the database
        const debugStmt = this.db!.prepare('SELECT directory_path, setting_key, setting_value FROM workspace_settings ORDER BY directory_path, setting_key');
        debugStmt.bind([]);
        const allRows: any[] = [];
        while (debugStmt.step()) {
            allRows.push(debugStmt.getAsObject());
        }
        debugStmt.free();
        this.debug.verbose('All rows in database:', allRows.length, 'total rows');
        this.debug.verbose('All rows:', allRows);
        
        let resolvedSettings: any = this.getGlobalDefaults();
        let currentSettings: WorkspaceSettings = {};
        let parentSettings: WorkspaceSettings = {};
        
        // Apply settings in order (global -> workspace -> parent dirs -> current dir)
        for (const row of rows) {
            const value = JSON.parse(row.setting_value);
            resolvedSettings[row.setting_key] = value;
            
            if (row.directory_path === relativePath) {
                currentSettings[row.setting_key as keyof WorkspaceSettings] = value;
            } else {
                parentSettings[row.setting_key as keyof WorkspaceSettings] = value;
            }
        }
        
        return {
            resolvedSettings,
            currentSettings,
            parentSettings
        };
    }

    /**
     * Set a setting for a specific directory
     */
    async setSetting(directoryPath: string, key: keyof WorkspaceSettings, value: any): Promise<void> {
        await this.ensureInitialized();
        const relativePath = path.relative(this.workspacePath, directoryPath).replace(/\\/g, '/');
        
        const stmt = this.db!.prepare(`
            INSERT OR REPLACE INTO workspace_settings 
            (directory_path, setting_key, setting_value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        stmt.run([relativePath, key, JSON.stringify(value)]);
        stmt.free();
        this.saveToFile();
    }

    /**
     * Save multiple settings for a directory
     */
    async saveWorkspaceSettings(directoryPath: string, settings: WorkspaceSettings): Promise<void> {
        await this.ensureInitialized();
        
        // Handle empty directoryPath or workspace root
        let relativePath: string;
        if (!directoryPath || directoryPath === '' || path.normalize(directoryPath) === path.normalize(this.workspacePath)) {
            relativePath = '';
        } else {
            const calculatedRelative = path.relative(this.workspacePath, directoryPath).replace(/\\/g, '/');
            
            // SECURITY: Validate that the relative path doesn't escape workspace
            if (calculatedRelative.includes('..') || path.isAbsolute(calculatedRelative)) {
                this.debug.error('SECURITY: Invalid directory path detected in saveWorkspaceSettings:', directoryPath);
                this.debug.error('SECURITY: Calculated relative path contains path traversal:', calculatedRelative);
                this.debug.error('SECURITY: Workspace path:', this.workspacePath);
                throw new Error(`Invalid directory path: Path traversal detected in ${directoryPath}`);
            }
            
            relativePath = calculatedRelative;
        }
        
        this.debug.verbose('saveWorkspaceSettings called for', directoryPath, 'relativePath:', relativePath, 'settings:', settings, 'instanceId:', this.instanceId, 'dbPath:', this.dbPath);
        
        // Process all settings
        for (const [key, value] of Object.entries(settings)) {
            if (value !== undefined) {
                this.debug.verbose('Saving setting', key, '=', value, 'for path', relativePath);
                try {
                    const stmt = this.db!.prepare(`
                        INSERT OR REPLACE INTO workspace_settings 
                        (directory_path, setting_key, setting_value, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    `);

                    const result = stmt.run([relativePath, key, JSON.stringify(value)]);
                    this.debug.verbose(`Insert result for ${key}:`, result, 'changes:', this.db!.getRowsModified());
                    stmt.free();
                } catch (error) {
                    this.debug.error(`Failed to save setting ${key}:`, error);
                    throw error;
                }
            }
        }
        
        this.saveToFile();
        this.debug.verbose('saveWorkspaceSettings completed, data saved to file');
        
        // Add a small delay to ensure file operation completes
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Verify the data was saved correctly - first check all data in database
        const allDataStmt = this.db!.prepare(`
            SELECT directory_path, setting_key, setting_value FROM workspace_settings 
            ORDER BY directory_path, setting_key
        `);
        const allRows: any[] = [];
        while (allDataStmt.step()) {
            allRows.push(allDataStmt.getAsObject());
        }
        allDataStmt.free();
        this.debug.verbose(`All database contents after save:`, allRows);
        
        // Then verify the specific path
        const verifyStmt = this.db!.prepare(`
            SELECT * FROM workspace_settings 
            WHERE directory_path = ? 
            ORDER BY setting_key
        `);
        verifyStmt.bind([relativePath]);
        const verifyRows: any[] = [];
        while (verifyStmt.step()) {
            verifyRows.push(verifyStmt.getAsObject());
        }
        verifyStmt.free();
        this.debug.verbose(`Verification query results for path '${relativePath}':`, verifyRows.length > 0 ? verifyRows.map(r => `${r.setting_key}=${r.setting_value}`) : 'NO RESULTS FOUND');
    }

    /**
     * Delete settings for a specific directory
     */
    async deleteSettingsForPath(directoryPath: string): Promise<void> {
        await this.ensureInitialized();
        const relativePath = path.relative(this.workspacePath, directoryPath).replace(/\\/g, '/');
        
        const stmt = this.db!.prepare(`
            DELETE FROM workspace_settings 
            WHERE directory_path = ?
        `);
        
        stmt.run([relativePath]);
        stmt.free();
    }

    /**
     * Clear all settings in the database (for testing)
     */
    async clearAllSettings(): Promise<void> {
        await this.ensureInitialized();
        
        const stmt = this.db!.prepare(`DELETE FROM workspace_settings`);
        stmt.run([]);
        stmt.free();
        
        // Save the cleared database to file
        this.saveToFile();
    }

    /**
     * Reset a specific field to inherit from parent (removes the field from local settings)
     */
    async resetField(directoryPath: string, fieldPath: string): Promise<void> {
        await this.ensureInitialized();
        const relativePath = path.relative(this.workspacePath, directoryPath).replace(/\\/g, '/');
        
        // Map field paths to database setting keys
        const fieldMappings: { [key: string]: string | string[] } = {
            'lineThresholds.midThreshold': 'codeCounter.lineThresholds.midThreshold',
            'lineThresholds.highThreshold': 'codeCounter.lineThresholds.highThreshold',
            'emojis.normal': 'codeCounter.emojis.normal',
            'emojis.warning': 'codeCounter.emojis.warning',
            'emojis.danger': 'codeCounter.emojis.danger',
            'emojis.folders.normal': 'codeCounter.emojis.folders.normal',
            'emojis.folders.warning': 'codeCounter.emojis.folders.warning',
            'emojis.folders.danger': 'codeCounter.emojis.folders.danger',
            'excludePatterns': 'codeCounter.excludePatterns',
            'includePatterns': 'codeCounter.includePatterns',
            // Support group resets
            'emojis': [
                'codeCounter.emojis.normal',
                'codeCounter.emojis.warning', 
                'codeCounter.emojis.danger',
                'codeCounter.emojis.folders.normal',
                'codeCounter.emojis.folders.warning',
                'codeCounter.emojis.folders.danger'
            ],
            'lineThresholds': [
                'codeCounter.lineThresholds.midThreshold',
                'codeCounter.lineThresholds.highThreshold'
            ]
        };
        
        const settingKeys = fieldMappings[fieldPath];
        if (!settingKeys) {
            this.debug.warning(`Unknown field path for reset: ${fieldPath}`);
            return;
        }
        
        // Handle both single fields and groups
        const keysToDelete = Array.isArray(settingKeys) ? settingKeys : [settingKeys];
        
        // Delete each setting key for this directory
        for (const settingKey of keysToDelete) {
            const stmt = this.db!.prepare(`
                DELETE FROM workspace_settings 
                WHERE directory_path = ? AND setting_key = ?
            `);
            
            stmt.run([relativePath, settingKey]);
            stmt.free();
        }
        
        // Save changes to disk
        this.saveToFile();
    }

    /**
     * Get all directories with settings
     */
    async getDirectoriesWithSettings(): Promise<string[]> {
        await this.ensureInitialized();
        const stmt = this.db!.prepare(`
            SELECT DISTINCT directory_path
            FROM workspace_settings 
            ORDER BY directory_path
        `);
        
        stmt.bind([]);
        const rows: any[] = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        
        return rows
            .filter((row: any) => row.directory_path !== null && row.directory_path !== undefined)
            .map((row: any) => 
                row.directory_path === '' ? this.workspacePath : path.join(this.workspacePath, row.directory_path)
            );
    }

    /**
     * Get exclude patterns with sources for a directory
     */
    async getExcludePatternsWithSources(directoryPath: string): Promise<Array<{ pattern: string; source: string; level: 'global' | 'workspace' | 'directory' }>> {
        const inheritance = await this.getSettingsWithInheritance(directoryPath);
        const patterns: Array<{ pattern: string; source: string; level: 'global' | 'workspace' | 'directory' }> = [];
        
        const excludePatterns = inheritance.resolvedSettings['codeCounter.excludePatterns'] || [];
        
        for (const pattern of excludePatterns) {
            // Determine source based on where the pattern is defined
            let source = '<global>';
            let level: 'global' | 'workspace' | 'directory' = 'global';
            
            // Check if pattern exists in current or parent settings
            if (inheritance.currentSettings['codeCounter.excludePatterns']?.includes(pattern)) {
                const relativePath = path.relative(this.workspacePath, directoryPath);
                source = relativePath === '' ? '<workspace>' : relativePath;
                level = relativePath === '' ? 'workspace' : 'directory';
            } else if (inheritance.parentSettings['codeCounter.excludePatterns']?.includes(pattern)) {
                level = 'workspace';
                source = '<workspace>';
            }
            
            patterns.push({ pattern, source, level });
        }
        
        return patterns;
    }

    async getIncludePatternsWithSources(directoryPath: string): Promise<Array<{ pattern: string; source: string; level: 'global' | 'workspace' | 'directory' }>> {
        const patterns: Array<{ pattern: string; source: string; level: 'global' | 'workspace' | 'directory' }> = [];
        
        // Get all settings in the inheritance chain to show each layer
        const relativePath = path.relative(this.workspacePath, directoryPath);
        
        // Build the path hierarchy to check each level
        const pathParts = relativePath.split(path.sep).filter(part => part !== '');
        const pathsToCheck: Array<{ path: string; source: string; level: 'global' | 'workspace' | 'directory' }> = [
            { path: '', source: '<workspace>', level: 'workspace' }
        ];
        
        let currentPath = '';
        for (const part of pathParts) {
            currentPath = currentPath ? path.join(currentPath, part) : part;
            pathsToCheck.push({ 
                path: currentPath, 
                source: path.basename(currentPath), 
                level: 'directory' 
            });
        }
        
        // Query database for each path level (in reverse order to show most specific first)
        for (let i = pathsToCheck.length - 1; i >= 0; i--) {
            const pathInfo = pathsToCheck[i];
            const query = `
                SELECT setting_value
                FROM workspace_settings
                WHERE directory_path = ? AND setting_key = 'codeCounter.includePatterns'
            `;
            
            const stmt = this.db!.prepare(query);
            stmt.bind([pathInfo.path]);
            
            if (stmt.step()) {
                const row = stmt.getAsObject();
                const includePatterns = JSON.parse((row as any).setting_value) as string[];
                for (const pattern of includePatterns) {
                    patterns.push({ pattern, source: pathInfo.source, level: pathInfo.level });
                }
            }
            stmt.free();
        }
        
        // Add global patterns at the end if they exist
        const globalConfig = vscode.workspace.getConfiguration('codeCounter');
        const globalPatterns = globalConfig.get<string[]>('includePatterns', []);
        for (const pattern of globalPatterns) {
            patterns.push({ pattern, source: '<global>', level: 'global' });
        }
        
        return patterns;
    }

    /**
     * Get global default settings
     */
    private getGlobalDefaults(): ResolvedSettings {
        const config = vscode.workspace.getConfiguration('codeCounter');
        const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
        const folderEmojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis.folders');
        
        return {
            'codeCounter.lineThresholds.midThreshold': config.get<number>('lineThresholds.midThreshold', 300),
            'codeCounter.lineThresholds.highThreshold': config.get<number>('lineThresholds.highThreshold', 1000),
            'codeCounter.emojis.normal': emojiConfig.get<string>('normal', '🟢'),
            'codeCounter.emojis.warning': emojiConfig.get<string>('warning', '🟡'),
            'codeCounter.emojis.danger': emojiConfig.get<string>('danger', '🔴'),
            'codeCounter.emojis.folders.normal': folderEmojiConfig.get<string>('normal', '🟩'),
            'codeCounter.emojis.folders.warning': folderEmojiConfig.get<string>('warning', '🟨'),
            'codeCounter.emojis.folders.danger': folderEmojiConfig.get<string>('danger', '🟥'),
            'codeCounter.excludePatterns': config.get<string[]>('excludePatterns', []),
            'codeCounter.includePatterns': config.get<string[]>('includePatterns', []),
            'codeCounter.showNotificationOnAutoGenerate': config.get<boolean>('showNotificationOnAutoGenerate', false)
        };
    }

    /**
     * Migrate and cleanup .code-counter.json files
     * Imports all settings to database and then deletes the JSON files
     */
    async migrateAndCleanupJsonFiles(): Promise<{ migrated: number; deleted: number; errors: string[] }> {
        const errors: string[] = [];
        let migrated = 0;
        let deleted = 0;
        
        try {
            const jsonFiles = await this.findCodeCounterJsonFiles();
            
            if (jsonFiles.length === 0) {
                this.debug.verbose('No .code-counter.json files found to migrate');
                return { migrated: 0, deleted: 0, errors: [] };
            }
            
            this.debug.info(`Found ${jsonFiles.length} .code-counter.json files to migrate and cleanup`);
            
            for (const jsonFile of jsonFiles) {
                try {
                    // First, try to migrate the settings
                    const content = await fs.promises.readFile(jsonFile, 'utf8');
                    const settings = JSON.parse(content) as WorkspaceSettings;
                    
                    const directoryPath = path.dirname(jsonFile);
                    await this.saveWorkspaceSettings(directoryPath, settings);
                    
                    migrated++;
                    this.debug.info(`Migrated settings from ${jsonFile}`);
                    
                    // After successful migration, delete the JSON file immediately
                    try {
                        await fs.promises.unlink(jsonFile);
                        deleted++;
                        this.debug.info(`Deleted migrated file: ${jsonFile}`);
                        
                    } catch (deleteError) {
                        const errorMsg = `Failed to delete ${jsonFile} after migration: ${deleteError}`;
                        errors.push(errorMsg);
                        this.debug.warning(errorMsg);
                    }
                    
                } catch (migrationError) {
                    const errorMsg = `Failed to migrate ${jsonFile}: ${migrationError}`;
                    errors.push(errorMsg);
                    this.debug.error(errorMsg);
                    // Don't delete if migration failed
                }
            }
        } catch (error) {
            errors.push(`Migration scan failed: ${error}`);
        }
        
        return { migrated, deleted, errors };
    }

    /**
     * Find all .code-counter.json files in workspace
     */
    private async findCodeCounterJsonFiles(): Promise<string[]> {
        const files: string[] = [];
        
        const scanDirectory = async (dir: string): Promise<void> => {
            try {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        // Skip common system directories that shouldn't contain settings
                        const skipDirs = [
                            'node_modules', '.git', 'coverage', 'out', 'dist', 'build'
                        ];
                        
                        if (!skipDirs.includes(entry.name)) {
                            await scanDirectory(fullPath);
                        }
                    } else if (entry.isFile() && entry.name === '.code-counter.json') {
                        files.push(fullPath);
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        };
        
        await scanDirectory(this.workspacePath);
        return files;
    }

    /**
     * Get reports directory path
     */
    getReportsDirectory(): string {
        return this.reportsDir;
    }

    /**
     * Get code-counter directory path  
     */
    getCodeCounterDirectory(): string {
        return this.codeCounterDir;
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        if (this.db) {
            this.db.close();
        }
    }
}