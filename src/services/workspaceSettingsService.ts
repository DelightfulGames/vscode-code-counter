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

// Event payload for workspace settings changes
export interface WorkspaceSettingsChangeEvent {
    directoryPath: string;
    configFilePath: string;
    timestamp: number;
}

// Shared event emitter for workspace settings changes across all instances
class WorkspaceSettingsEvents {
    private static instance: WorkspaceSettingsEvents;
    private _onDidChangeSettings: vscode.EventEmitter<WorkspaceSettingsChangeEvent> = new vscode.EventEmitter<WorkspaceSettingsChangeEvent>();
    readonly onDidChangeSettings: vscode.Event<WorkspaceSettingsChangeEvent> = this._onDidChangeSettings.event;
    
    static getInstance(): WorkspaceSettingsEvents {
        if (!WorkspaceSettingsEvents.instance) {
            WorkspaceSettingsEvents.instance = new WorkspaceSettingsEvents();
        }
        return WorkspaceSettingsEvents.instance;
    }
    
    fireSettingsChanged(directoryPath: string, configFilePath: string): void {
        this._onDidChangeSettings.fire({
            directoryPath,
            configFilePath,
            timestamp: Date.now()
        });
    }
}

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
    'codeCounter.showNotificationOnAutoGenerate': boolean;
    source: 'global' | 'workspace' | string; // string for subdirectory path
}

export interface WorkspaceData {
    currentDirectory: any; 
    mode?: string; 
    directoryTree?: DirectoryNode[]; 
    resolvedSettings?: ResolvedSettings;
    currentSettings?: WorkspaceSettings | null;
    parentSettings?: ResolvedSettings;
    workspacePath?: string; 
    patternsWithSources?: Array<{ pattern: string; source: string; level: 'global' | 'workspace' | 'directory' }>;
}

export class WorkspaceSettingsService {
    private static readonly CONFIG_FILE_NAME = '.code-counter.json';
    private workspacePath: string;
    private static events = WorkspaceSettingsEvents.getInstance();

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
    }

    // Static getter for global event access
    static get onDidChangeSettings(): vscode.Event<WorkspaceSettingsChangeEvent> {
        return WorkspaceSettingsService.events.onDidChangeSettings;
    }

    /**
     * Get the resolved settings for a specific directory
     */
    async getResolvedSettings(directoryPath: string): Promise<ResolvedSettings> {
        const settingsChain = await this.getSettingsChain(directoryPath);
        const globalSettings = this.getGlobalSettings();
        
        // Start with global settings as base
        let resolved: ResolvedSettings = {
            'codeCounter.lineThresholds.midThreshold': globalSettings['codeCounter.lineThresholds.midThreshold'] ?? 300,
            'codeCounter.lineThresholds.highThreshold': globalSettings['codeCounter.lineThresholds.highThreshold'] ?? 1000,
            'codeCounter.emojis.normal': globalSettings['codeCounter.emojis.normal'] ?? '🟢',
            'codeCounter.emojis.warning': globalSettings['codeCounter.emojis.warning'] ?? '🟡',
            'codeCounter.emojis.danger': globalSettings['codeCounter.emojis.danger'] ?? '🔴',
            'codeCounter.emojis.folders.normal': globalSettings['codeCounter.emojis.folders.normal'] ?? '🟩',
            'codeCounter.emojis.folders.warning': globalSettings['codeCounter.emojis.folders.warning'] ?? '🟨',
            'codeCounter.emojis.folders.danger': globalSettings['codeCounter.emojis.folders.danger'] ?? '🟥',
            'codeCounter.excludePatterns': [...(globalSettings['codeCounter.excludePatterns'] ?? [
                '**/node_modules/**',
                '**/out/**',
                '**/bin/**', 
                '**/dist/**',
                '**/.git/**',
                '**/.*/**',
                '**/.*',
                '**/**-lock.json'
            ])],
            'codeCounter.showNotificationOnAutoGenerate': globalSettings['codeCounter.showNotificationOnAutoGenerate'] ?? false,
            source: 'global'
        };

        // Apply settings from closest parent with .code-counter.json
        // For excludePatterns, we want to use the nearest ancestor that defines it, not merge
        let excludePatternsFound = false;
        
        for (const { settings, source } of settingsChain.reverse()) {
            // Apply each setting if it exists in the workspace settings
            if (settings['codeCounter.lineThresholds.midThreshold'] !== undefined) {
                resolved['codeCounter.lineThresholds.midThreshold'] = settings['codeCounter.lineThresholds.midThreshold'];
            }
            if (settings['codeCounter.lineThresholds.highThreshold'] !== undefined) {
                resolved['codeCounter.lineThresholds.highThreshold'] = settings['codeCounter.lineThresholds.highThreshold'];
            }
            if (settings['codeCounter.emojis.normal'] !== undefined) {
                resolved['codeCounter.emojis.normal'] = settings['codeCounter.emojis.normal'];
            }
            if (settings['codeCounter.emojis.warning'] !== undefined) {
                resolved['codeCounter.emojis.warning'] = settings['codeCounter.emojis.warning'];
            }
            if (settings['codeCounter.emojis.danger'] !== undefined) {
                resolved['codeCounter.emojis.danger'] = settings['codeCounter.emojis.danger'];
            }
            if (settings['codeCounter.emojis.folders.normal'] !== undefined) {
                resolved['codeCounter.emojis.folders.normal'] = settings['codeCounter.emojis.folders.normal'];
            }
            if (settings['codeCounter.emojis.folders.warning'] !== undefined) {
                resolved['codeCounter.emojis.folders.warning'] = settings['codeCounter.emojis.folders.warning'];
            }
            if (settings['codeCounter.emojis.folders.danger'] !== undefined) {
                resolved['codeCounter.emojis.folders.danger'] = settings['codeCounter.emojis.folders.danger'];
            }
            // For excludePatterns, only use the first (nearest) ancestor that defines it
            if (!excludePatternsFound && settings['codeCounter.excludePatterns'] !== undefined) {
                resolved['codeCounter.excludePatterns'] = [...settings['codeCounter.excludePatterns']];
                excludePatternsFound = true;
            }
            if (settings['codeCounter.showNotificationOnAutoGenerate'] !== undefined) {
                resolved['codeCounter.showNotificationOnAutoGenerate'] = settings['codeCounter.showNotificationOnAutoGenerate'];
            }
            resolved.source = source;
        }

        return resolved;
    }

    /**
     * Get settings with inheritance information for UI display
     */
    async getSettingsWithInheritance(directoryPath: string): Promise<{
        currentSettings: WorkspaceSettings | null;
        parentSettings: ResolvedSettings;
        resolvedSettings: ResolvedSettings;
    }> {
        // Get current directory's own settings (if any)
        const configPath = path.join(directoryPath, WorkspaceSettingsService.CONFIG_FILE_NAME);
        let currentSettings: WorkspaceSettings | null = null;
        
        if (await this.fileExists(configPath)) {
            try {
                currentSettings = await this.readSettingsFile(configPath);
            } catch (error) {
                console.error(`Failed to read settings from ${configPath}:`, error);
            }
        }

        // Get parent settings (what would be inherited if current settings didn't exist)
        const parentPath = directoryPath === this.workspacePath ? 
            null : // For workspace root, parent is global
            path.dirname(directoryPath); // For subdirectories, parent is parent directory

        let parentSettings: ResolvedSettings;
        if (parentPath) {
            parentSettings = await this.getResolvedSettings(parentPath);
        } else {
            // Use global settings as parent for workspace root
            const globalSettings = this.getGlobalSettings();
            parentSettings = {
                'codeCounter.lineThresholds.midThreshold': globalSettings['codeCounter.lineThresholds.midThreshold'] ?? 300,
                'codeCounter.lineThresholds.highThreshold': globalSettings['codeCounter.lineThresholds.highThreshold'] ?? 1000,
                'codeCounter.emojis.normal': globalSettings['codeCounter.emojis.normal'] ?? '🟢',
                'codeCounter.emojis.warning': globalSettings['codeCounter.emojis.warning'] ?? '🟡',
                'codeCounter.emojis.danger': globalSettings['codeCounter.emojis.danger'] ?? '🔴',
                'codeCounter.emojis.folders.normal': globalSettings['codeCounter.emojis.folders.normal'] ?? '🟩',
                'codeCounter.emojis.folders.warning': globalSettings['codeCounter.emojis.folders.warning'] ?? '🟨',
                'codeCounter.emojis.folders.danger': globalSettings['codeCounter.emojis.folders.danger'] ?? '🟥',
                'codeCounter.excludePatterns': [...(globalSettings['codeCounter.excludePatterns'] ?? [
                    '**/node_modules/**',
                    '**/out/**',
                    '**/bin/**', 
                    '**/dist/**',
                    '**/.git/**',
                    '**/.*/**',
                    '**/.*',
                    '**/**-lock.json'
                ])],
                'codeCounter.showNotificationOnAutoGenerate': globalSettings['codeCounter.showNotificationOnAutoGenerate'] ?? false,
                source: 'global'
            };
        }

        // Get fully resolved settings
        const resolvedSettings = await this.getResolvedSettings(directoryPath);

        return {
            currentSettings,
            parentSettings,
            resolvedSettings
        };
    }

    /**
     * Get the settings chain from a directory up to workspace root
     */
    private async getSettingsChain(directoryPath: string): Promise<Array<{ settings: WorkspaceSettings; source: string }>> {
        const chain: Array<{ settings: WorkspaceSettings; source: string }> = [];
        let currentPath = directoryPath;

        while (currentPath.startsWith(this.workspacePath)) {
            const configPath = path.join(currentPath, WorkspaceSettingsService.CONFIG_FILE_NAME);
            
            if (await this.fileExists(configPath)) {
                try {
                    const settings = await this.readSettingsFile(configPath);
                    const source = currentPath === this.workspacePath ? 'workspace' : path.relative(this.workspacePath, currentPath);
                    chain.push({ settings, source });
                } catch (error) {
                    console.error(`Failed to read settings from ${configPath}:`, error);
                }
            }

            if (currentPath === this.workspacePath) {
                break;
            }
            currentPath = path.dirname(currentPath);
        }

        return chain;
    }

    /**
     * Get global settings from VS Code configuration
     */
    private getGlobalSettings(): WorkspaceSettings {
        const config = vscode.workspace.getConfiguration('codeCounter');
        const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
        const folderEmojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis.folders');
        
        return {
            'codeCounter.lineThresholds.midThreshold': config.get<number>('lineThresholds.midThreshold'),
            'codeCounter.lineThresholds.highThreshold': config.get<number>('lineThresholds.highThreshold'),
            'codeCounter.emojis.normal': emojiConfig.get<string>('normal'),
            'codeCounter.emojis.warning': emojiConfig.get<string>('warning'),
            'codeCounter.emojis.danger': emojiConfig.get<string>('danger'),
            'codeCounter.emojis.folders.normal': folderEmojiConfig.get<string>('normal'),
            'codeCounter.emojis.folders.warning': folderEmojiConfig.get<string>('warning'),
            'codeCounter.emojis.folders.danger': folderEmojiConfig.get<string>('danger'),
            'codeCounter.excludePatterns': config.get<string[]>('excludePatterns'),
            'codeCounter.showNotificationOnAutoGenerate': config.get<boolean>('showNotificationOnAutoGenerate')
        };
    }

    /**
     * Save workspace settings to a specific directory
     * Creates .code-counter.json file on-demand when settings are provided
     */
    async saveWorkspaceSettings(directoryPath: string, settings: WorkspaceSettings): Promise<void> {
        const configPath = path.join(directoryPath, WorkspaceSettingsService.CONFIG_FILE_NAME);
        
        // Remove undefined values to keep file clean
        const cleanSettings = this.cleanSettings(settings);
        
        // Check if cleaned settings result in an empty object
        if (Object.keys(cleanSettings).length === 0) {
            // If empty, delete the file instead of creating an empty one
            if (await this.fileExists(configPath)) {
                await this.deleteSettingsFile(configPath);
            }
            // Note: If file doesn't exist and settings are empty, no action needed
        } else {
            // Write the file with the cleaned settings
            await fs.promises.writeFile(configPath, JSON.stringify(cleanSettings, null, 2), 'utf8');
            
            // Fire event to notify decorators that settings changed
            WorkspaceSettingsService.events.fireSettingsChanged(directoryPath, configPath);
        }
    }

    /**
     * Delete a settings file
     */
    async deleteSettingsFile(configPath: string): Promise<void> {
        if (await this.fileExists(configPath)) {
            await fs.promises.unlink(configPath);
            
            // Fire event to notify decorators that settings file was deleted
            const directoryPath = path.dirname(configPath);
            WorkspaceSettingsService.events.fireSettingsChanged(directoryPath, configPath);
        }
    }

    /**
     * Clean up empty settings files in workspace
     * Call this when webview closes to remove any empty .code-counter.json files
     */
    async cleanupEmptySettingsFiles(): Promise<void> {
        const directoriesWithSettings = await this.getDirectoriesWithSettings();
        
        for (const dir of directoriesWithSettings) {
            const configPath = path.join(dir, WorkspaceSettingsService.CONFIG_FILE_NAME);
            
            try {
                const content = await fs.promises.readFile(configPath, 'utf-8');
                const settings = JSON.parse(content);
                
                // If the settings object is empty or only has empty values, delete the file
                if (this.isEmptySettings(settings)) {
                    await this.deleteSettingsFile(configPath);
                }
            } catch (error) {
                // If we can't read/parse the file, leave it alone to be safe
                console.log(`Could not check settings file ${configPath} for cleanup:`, error);
            }
        }
    }

    /**
     * Check if a directory has a .code-counter.json file
     */
    async hasSettings(directoryPath: string): Promise<boolean> {
        const configPath = path.join(directoryPath, WorkspaceSettingsService.CONFIG_FILE_NAME);
        return await this.fileExists(configPath);
    }

    /**
     * Check if a settings file exists and is empty
     */
    async hasEmptySettings(directoryPath: string): Promise<boolean> {
        const configPath = path.join(directoryPath, WorkspaceSettingsService.CONFIG_FILE_NAME);
        
        if (!await this.fileExists(configPath)) {
            return false;
        }
        
        try {
            const content = await fs.promises.readFile(configPath, 'utf-8');
            const settings = JSON.parse(content);
            return this.isEmptySettings(settings);
        } catch (error) {
            // If we can't read/parse the file, consider it not empty to be safe
            return false;
        }
    }

    /**
     * Get all directories in workspace that have .code-counter.json files
     */
    async getDirectoriesWithSettings(): Promise<string[]> {
        const directories: string[] = [];
        await this.scanDirectoryForSettings(this.workspacePath, directories);
        return directories;
    }

    /**
     * Get directory tree structure for webview
     */
    async getDirectoryTree(): Promise<DirectoryNode[]> {
        const tree = await this.buildDirectoryTree(this.workspacePath);
        return tree;
    }

    /**
     * Get exclude patterns with their inheritance source information
     */
    async getExcludePatternsWithSources(directoryPath: string): Promise<Array<{ pattern: string; source: string; level: 'global' | 'workspace' | 'directory' }>> {
        const patterns: Array<{ pattern: string; source: string; level: 'global' | 'workspace' | 'directory' }> = [];
        
        // Get settings chain from current directory to workspace root
        const settingsChain = await this.getSettingsChain(directoryPath);
        
        // Find the nearest ancestor that defines excludePatterns
        let sourceFound = false;
        for (const { settings, source } of settingsChain) {
            const excludePatterns = settings['codeCounter.excludePatterns'];
            if (excludePatterns && Array.isArray(excludePatterns)) {
                // Found the nearest ancestor with exclude patterns defined
                for (const pattern of excludePatterns) {
                    const level: 'global' | 'workspace' | 'directory' = 
                        source === 'workspace' ? 'workspace' : 'directory';
                    const displaySource = source === 'workspace' ? '<workspace>' : source;
                    patterns.push({ pattern, source: displaySource, level });
                }
                sourceFound = true;
                break; // Stop at the first (nearest) ancestor that defines patterns
            }
        }
        
        // If no workspace settings define patterns, use global patterns
        if (!sourceFound) {
            const globalSettings = this.getGlobalSettings();
            const globalPatterns = globalSettings['codeCounter.excludePatterns'] || [];
            for (const pattern of globalPatterns) {
                patterns.push({ pattern, source: '<global>', level: 'global' });
            }
        }
        
        return patterns;
    }

    private async buildDirectoryTree(rootPath: string): Promise<DirectoryNode[]> {
        const nodes: DirectoryNode[] = [];
        
        try {
            const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Skip common system directories that shouldn't be in settings
                    const skipDirs = [
                        'node_modules', '.git', 'coverage', 'out', 'dist', 'build'
                    ];
                    
                    if (skipDirs.includes(entry.name)) {
                        continue;
                    }
                    
                    const fullPath = path.join(rootPath, entry.name);
                    const hasSettings = await this.hasSettings(fullPath);
                    const children = await this.buildDirectoryTree(fullPath);
                    
                    nodes.push({
                        name: entry.name,
                        path: fullPath,
                        relativePath: path.relative(this.workspacePath, fullPath),
                        hasSettings,
                        children
                    });
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${rootPath}:`, error);
        }

        return nodes.sort((a, b) => a.name.localeCompare(b.name));
    }

    private async scanDirectoryForSettings(dirPath: string, result: string[]): Promise<void> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Skip common system directories that shouldn't be in settings
                    const skipDirs = [
                        'node_modules', '.git', 'coverage', 'out', 'dist', 'build'
                    ];
                    
                    if (skipDirs.includes(entry.name)) {
                        continue;
                    }
                    
                    const fullPath = path.join(dirPath, entry.name);
                    
                    if (await this.hasSettings(fullPath)) {
                        result.push(fullPath);
                    }
                    
                    await this.scanDirectoryForSettings(fullPath, result);
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error);
        }
    }

    private async readSettingsFile(configPath: string): Promise<WorkspaceSettings> {
        const content = await fs.promises.readFile(configPath, 'utf8');
        return JSON.parse(content) as WorkspaceSettings;
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private cleanSettings(settings: WorkspaceSettings): WorkspaceSettings {
        const cleaned: WorkspaceSettings = {};
        
        // Copy only defined values to keep the file clean
        const settingsKeys: (keyof WorkspaceSettings)[] = [
            'codeCounter.lineThresholds.midThreshold',
            'codeCounter.lineThresholds.highThreshold',
            'codeCounter.emojis.normal',
            'codeCounter.emojis.warning',
            'codeCounter.emojis.danger',
            'codeCounter.emojis.folders.normal',
            'codeCounter.emojis.folders.warning',
            'codeCounter.emojis.folders.danger',
            'codeCounter.excludePatterns',
            'codeCounter.showNotificationOnAutoGenerate'
        ];

        for (const key of settingsKeys) {
            if (settings[key] !== undefined) {
                (cleaned as any)[key] = settings[key];
            }
        }

        return cleaned;
    }

    private isEmptySettings(settings: WorkspaceSettings): boolean {
        return Object.keys(this.cleanSettings(settings)).length === 0;
    }

    async resetField(directoryPath: string, fieldPath: string): Promise<void> {
        const settingsPath = path.join(directoryPath, '.code-counter.json');
        
        try {
            let settings: WorkspaceSettings = {};
            
            // Load existing settings if they exist
            if (await fs.promises.access(settingsPath).then(() => true).catch(() => false)) {
                const content = await fs.promises.readFile(settingsPath, 'utf-8');
                settings = JSON.parse(content);
            }
            
            // Map UI field paths to the standardized workspace settings keys
            let settingKey: keyof WorkspaceSettings | null = null;
            
            if (fieldPath === 'excludePatterns') {
                settingKey = 'codeCounter.excludePatterns';
            } else if (fieldPath === 'badges.low') {
                settingKey = 'codeCounter.emojis.normal';
            } else if (fieldPath === 'badges.medium') {
                settingKey = 'codeCounter.emojis.warning';
            } else if (fieldPath === 'badges.high') {
                settingKey = 'codeCounter.emojis.danger';
            } else if (fieldPath === 'folderBadges.low') {
                settingKey = 'codeCounter.emojis.folders.normal';
            } else if (fieldPath === 'folderBadges.medium') {
                settingKey = 'codeCounter.emojis.folders.warning';
            } else if (fieldPath === 'folderBadges.high') {
                settingKey = 'codeCounter.emojis.folders.danger';
            } else if (fieldPath === 'thresholds.mid') {
                settingKey = 'codeCounter.lineThresholds.midThreshold';
            } else if (fieldPath === 'thresholds.high') {
                settingKey = 'codeCounter.lineThresholds.highThreshold';
            } else if (fieldPath === 'emojis.normal') {
                settingKey = 'codeCounter.emojis.normal';
            } else if (fieldPath === 'emojis.warning') {
                settingKey = 'codeCounter.emojis.warning';
            } else if (fieldPath === 'emojis.danger') {
                settingKey = 'codeCounter.emojis.danger';
            } else if (fieldPath === 'emojis.folders.normal') {
                settingKey = 'codeCounter.emojis.folders.normal';
            } else if (fieldPath === 'emojis.folders.warning') {
                settingKey = 'codeCounter.emojis.folders.warning';
            } else if (fieldPath === 'emojis.folders.danger') {
                settingKey = 'codeCounter.emojis.folders.danger';
            } else if (fieldPath === 'lineThresholds.midThreshold') {
                settingKey = 'codeCounter.lineThresholds.midThreshold';
            } else if (fieldPath === 'lineThresholds.highThreshold') {
                settingKey = 'codeCounter.lineThresholds.highThreshold';
            }
            
            // Remove the specific field if we found a valid mapping
            if (settingKey) {
                delete (settings as any)[settingKey];
            }
            
            // Clean up empty objects and remove file if empty
            if (this.isEmptySettings(settings)) {
                await fs.promises.unlink(settingsPath).catch(() => {}); // Ignore errors if file doesn't exist
            } else {
                const cleanedSettings = this.cleanSettings(settings);
                await fs.promises.writeFile(settingsPath, JSON.stringify(cleanedSettings, null, 2));
            }
        } catch (error) {
            console.error('Error resetting field:', error);
            throw error;
        }
    }
}

export interface DirectoryNode {
    name: string;
    path: string;
    relativePath: string;
    hasSettings: boolean;
    children: DirectoryNode[];
}