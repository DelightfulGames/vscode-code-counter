import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

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

export class WorkspaceSettingsService {
    private static readonly CONFIG_FILE_NAME = '.code-counter.json';
    private workspacePath: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
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
            'codeCounter.emojis.folders.normal': globalSettings['codeCounter.emojis.folders.normal'] ?? '�',
            'codeCounter.emojis.folders.warning': globalSettings['codeCounter.emojis.folders.warning'] ?? '�',
            'codeCounter.emojis.folders.danger': globalSettings['codeCounter.emojis.folders.danger'] ?? '�',
            'codeCounter.excludePatterns': globalSettings['codeCounter.excludePatterns'] ?? [
                '**/node_modules/**',
                '**/out/**',
                '**/bin/**', 
                '**/dist/**',
                '**/.git/**',
                '**/.**/**',
                '**/*.vsix',
                '**/.code-counter.json',
                '**/**-lock.json'
            ],
            'codeCounter.showNotificationOnAutoGenerate': globalSettings['codeCounter.showNotificationOnAutoGenerate'] ?? false,
            source: 'global'
        };

        // Apply settings from closest parent with .code-counter.json
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
            if (settings['codeCounter.excludePatterns'] !== undefined) {
                resolved['codeCounter.excludePatterns'] = settings['codeCounter.excludePatterns'];
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
                'codeCounter.emojis.folders.normal': globalSettings['codeCounter.emojis.folders.normal'] ?? '�',
                'codeCounter.emojis.folders.warning': globalSettings['codeCounter.emojis.folders.warning'] ?? '�',
                'codeCounter.emojis.folders.danger': globalSettings['codeCounter.emojis.folders.danger'] ?? '🟥',
                'codeCounter.excludePatterns': globalSettings['codeCounter.excludePatterns'] ?? [
                    '**/node_modules/**',
                    '**/out/**',
                    '**/bin/**', 
                    '**/dist/**',
                    '**/.git/**',
                    '**/.**/**',
                    '**/*.vsix',
                    '**/.code-counter.json',
                    '**/**-lock.json'
                ],
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
     * Create or update workspace settings file
     */
    async saveWorkspaceSettings(directoryPath: string, settings: WorkspaceSettings, skipCleanup: boolean = false): Promise<void> {
        const configPath = path.join(directoryPath, WorkspaceSettingsService.CONFIG_FILE_NAME);
        
        // Remove undefined values to keep file clean
        const cleanSettings = this.cleanSettings(settings);
        
        // If all settings are empty and cleanup is not skipped, delete the file
        if (!skipCleanup && this.isEmptySettings(cleanSettings)) {
            await this.deleteSettingsFile(configPath);
            return;
        }

        await fs.promises.writeFile(configPath, JSON.stringify(cleanSettings, null, 2), 'utf8');
    }

    /**
     * Delete a settings file
     */
    async deleteSettingsFile(configPath: string): Promise<void> {
        if (await this.fileExists(configPath)) {
            await fs.promises.unlink(configPath);
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

    private async buildDirectoryTree(rootPath: string): Promise<DirectoryNode[]> {
        const nodes: DirectoryNode[] = [];
        
        try {
            const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
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
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
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