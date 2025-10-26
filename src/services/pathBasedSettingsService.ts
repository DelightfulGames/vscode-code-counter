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
import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceDatabaseService, ResolvedSettings } from './workspaceDatabaseService';

export type ColorThreshold = 'normal' | 'warning' | 'danger';

export interface CustomEmojis {
    normal: string;
    warning: string;
    danger: string;
}

export interface FolderEmojis {
    normal: string;
    warning: string;
    danger: string;
}

export interface ColorThresholdConfig {
    enabled: boolean;
    midThreshold: number;
    highThreshold: number;
}

export class PathBasedSettingsService implements vscode.Disposable {
    private workspaceServices: Map<string, WorkspaceDatabaseService> = new Map();
    private _onDidChangeSettings: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
    readonly onDidChangeSettings: vscode.Event<string> = this._onDidChangeSettings.event;
    
    constructor() {
        // Listen to VS Code configuration changes as fallback
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('codeCounter')) {
                this._onDidChangeSettings.fire('global');
            }
        });
    }

    /**
     * Set workspace settings service manually (for testing)
     */
    public setWorkspaceSettingsService(service: WorkspaceDatabaseService): void {
        // For backwards compatibility with tests
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            console.log('DEBUG: Setting workspace service for path:', workspacePath);
            this.workspaceServices.set(workspacePath, service);
        }
    }

    /**
     * Clear all cached workspace services (for testing)
     */
    public clearWorkspaceServices(): void {
        this.workspaceServices.clear();
    }

    private getWorkspaceService(filePath: string): WorkspaceDatabaseService | null {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        if (!workspaceFolder) {
            console.log('DEBUG: No workspace folder found for', filePath);
            return null;
        }

        const workspacePath = workspaceFolder.uri.fsPath;
        console.log('DEBUG: Workspace folder found:', workspacePath, 'for file:', filePath);
        console.log('DEBUG: Available services keys:', Array.from(this.workspaceServices.keys()));
        
        if (!this.workspaceServices.has(workspacePath)) {
            console.log('DEBUG: No service found in cache for:', workspacePath);
            // In tests, we should always have a service set via setWorkspaceSettingsService
            // If we reach here during tests, it means the service wasn't properly configured
            if (process.env.NODE_ENV === 'test') {
                console.error('*** CRITICAL: Creating new WorkspaceDatabaseService during tests - this WILL cause data isolation issues ***');
            } else {
                console.log('Creating new WorkspaceDatabaseService for production use');
            }
            this.workspaceServices.set(workspacePath, new WorkspaceDatabaseService(workspacePath));
        }
        
        const service = this.workspaceServices.get(workspacePath) || null;
        console.log('DEBUG: getWorkspaceService returning service for', workspacePath, 'found:', !!service);
        return service;
    }

    async getResolvedSettings(filePath: string): Promise<ResolvedSettings> {
        console.log('DEBUG: PathBasedSettingsService.getResolvedSettings called for:', filePath);
        const workspaceService = this.getWorkspaceService(filePath);
        console.log('DEBUG: getWorkspaceService returned:', !!workspaceService);
        
        if (!workspaceService) {
            // Fallback to global settings if no workspace
            const config = vscode.workspace.getConfiguration('codeCounter');
            const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
            const folderEmojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis.folders');
            
            return {
                'codeCounter.excludePatterns': config.get<string[]>('excludePatterns', []),
                'codeCounter.emojis.normal': emojiConfig.get('normal', '🟢'),
                'codeCounter.emojis.warning': emojiConfig.get('warning', '🟡'),
                'codeCounter.emojis.danger': emojiConfig.get('danger', '🔴'),
                'codeCounter.emojis.folders.normal': folderEmojiConfig.get('normal', '🟩'),
                'codeCounter.emojis.folders.warning': folderEmojiConfig.get('warning', '🟨'),
                'codeCounter.emojis.folders.danger': folderEmojiConfig.get('danger', '🟥'),
                'codeCounter.lineThresholds.midThreshold': config.get('lineThresholds.midThreshold', 300),
                'codeCounter.lineThresholds.highThreshold': config.get('lineThresholds.highThreshold', 1000),
                'codeCounter.showNotificationOnAutoGenerate': config.get('showNotificationOnAutoGenerate', false)
            } as ResolvedSettings;
        }

        try {
            // Get directory path for the file
            const directoryPath = path.dirname(filePath);
            console.log('DEBUG: Calling getSettingsWithInheritance for directory:', directoryPath);
            const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(directoryPath);
            console.log('DEBUG: Got resolved settings:', JSON.stringify(settingsWithInheritance.resolvedSettings, null, 2));
            
            // Return the resolved settings that include inheritance
            return settingsWithInheritance.resolvedSettings;
        } catch (error) {
            console.error('Failed to get database settings, falling back to global:', error);
            
            // Fallback to global settings
            const config = vscode.workspace.getConfiguration('codeCounter');
            const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
            const folderEmojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis.folders');
            
            return {
                'codeCounter.excludePatterns': config.get<string[]>('excludePatterns', []),
                'codeCounter.emojis.normal': emojiConfig.get('normal', '🟢'),
                'codeCounter.emojis.warning': emojiConfig.get('warning', '🟡'),
                'codeCounter.emojis.danger': emojiConfig.get('danger', '🔴'),
                'codeCounter.emojis.folders.normal': folderEmojiConfig.get('normal', '🟩'),
                'codeCounter.emojis.folders.warning': folderEmojiConfig.get('warning', '🟨'),
                'codeCounter.emojis.folders.danger': folderEmojiConfig.get('danger', '🟥'),
                'codeCounter.lineThresholds.midThreshold': config.get('lineThresholds.midThreshold', 300),
                'codeCounter.lineThresholds.highThreshold': config.get('lineThresholds.highThreshold', 1000),
                'codeCounter.showNotificationOnAutoGenerate': config.get('showNotificationOnAutoGenerate', false)
            } as ResolvedSettings;
        }
    }

    /**
     * Get resolved settings for a specific file or folder path (legacy method)
     */
    private async getResolvedSettingsForPath(filePath: string): Promise<ResolvedSettings | null> {
        try {
            return await this.getResolvedSettings(filePath);
        } catch (error) {
            console.warn('Failed to get resolved settings for path:', filePath, error);
            return null;
        }
    }

    /**
     * Get custom emojis for a specific file path
     */
    async getCustomEmojisForPath(filePath: string): Promise<CustomEmojis> {
        const resolvedSettings = await this.getResolvedSettingsForPath(filePath);
        
        if (resolvedSettings) {
            return {
                normal: resolvedSettings['codeCounter.emojis.normal'],
                warning: resolvedSettings['codeCounter.emojis.warning'],
                danger: resolvedSettings['codeCounter.emojis.danger']
            };
        }

        // Fallback to global settings
        const config = vscode.workspace.getConfiguration('codeCounter.emojis');
        return {
            normal: config.get<string>('normal', '🟢'),
            warning: config.get<string>('warning', '🟡'),
            danger: config.get<string>('danger', '🔴')
        };
    }

    /**
     * Get folder emojis for a specific folder path
     */
    async getFolderEmojisForPath(folderPath: string): Promise<FolderEmojis> {
        const resolvedSettings = await this.getResolvedSettingsForPath(folderPath);
        
        if (resolvedSettings) {
            return {
                normal: resolvedSettings['codeCounter.emojis.folders.normal'],
                warning: resolvedSettings['codeCounter.emojis.folders.warning'],
                danger: resolvedSettings['codeCounter.emojis.folders.danger']
            };
        }

        // Fallback to global settings
        const config = vscode.workspace.getConfiguration('codeCounter.emojis.folders');
        return {
            normal: config.get<string>('normal', '🟩'),
            warning: config.get<string>('warning', '🟨'),
            danger: config.get<string>('danger', '🟥')
        };
    }

    /**
     * Get threshold configuration for a specific file path
     */
    async getThresholdConfigForPath(filePath: string): Promise<ColorThresholdConfig> {
        const resolvedSettings = await this.getResolvedSettingsForPath(filePath);
        
        let midThreshold: number;
        let highThreshold: number;

        if (resolvedSettings) {
            midThreshold = resolvedSettings['codeCounter.lineThresholds.midThreshold'];
            highThreshold = resolvedSettings['codeCounter.lineThresholds.highThreshold'];
        } else {
            // Fallback to global settings
            const config = vscode.workspace.getConfiguration('codeCounter.lineThresholds');
            midThreshold = config.get<number>('midThreshold', 300);
            highThreshold = config.get<number>('highThreshold', 1000);
        }
        
        // Ensure High threshold is higher than mid threshold
        if (highThreshold <= midThreshold) {
            highThreshold = midThreshold + 100;
            console.warn(`High threshold (${highThreshold}) must be higher than mid threshold (${midThreshold}). Using ${highThreshold} instead.`);
        }
        
        return {
            enabled: true,
            midThreshold: midThreshold,
            highThreshold: highThreshold
        };
    }

    /**
     * Get color threshold classification for line count at specific path
     */
    async getColorThresholdForPath(lineCount: number, filePath: string): Promise<ColorThreshold> {
        const config = await this.getThresholdConfigForPath(filePath);
        
        if (lineCount >= config.highThreshold) {
            return 'danger';
        } else if (lineCount >= config.midThreshold) {
            return 'warning';
        } else {
            return 'normal';
        }
    }

    /**
     * Get theme emoji for threshold at specific path
     */
    async getThemeEmojiForPath(threshold: ColorThreshold, filePath: string): Promise<string> {
        console.log('DEBUG: getThemeEmojiForPath called for threshold:', threshold, 'filePath:', filePath);
        const customEmojis = await this.getCustomEmojisForPath(filePath);
        console.log('DEBUG: customEmojis retrieved:', JSON.stringify(customEmojis));
        
        switch (threshold) {
            case 'normal':
                return customEmojis.normal;
            case 'warning':
                return customEmojis.warning;
            case 'danger':
                return customEmojis.danger;
        }
    }

    /**
     * Get folder emoji for threshold at specific path
     */
    async getFolderEmojiForPath(threshold: ColorThreshold, folderPath: string): Promise<string> {
        const folderEmojis = await this.getFolderEmojisForPath(folderPath);
        
        switch (threshold) {
            case 'normal':
                return folderEmojis.normal;
            case 'warning':
                return folderEmojis.warning;
            case 'danger':
                return folderEmojis.danger;
            default:
                return '⬜'; // White square for unknown
        }
    }

    /**
     * Get exclude patterns for a specific file path
     */
    async getExcludePatternsForPath(filePath: string): Promise<string[]> {
        const resolvedSettings = await this.getResolvedSettingsForPath(filePath);
        
        if (resolvedSettings) {
            return resolvedSettings['codeCounter.excludePatterns'];
        }

        // Fallback to global settings
        const config = vscode.workspace.getConfiguration('codeCounter');
        return config.get<string[]>('excludePatterns', [
            '**/node_modules/**',
            '**/out/**',
            '**/bin/**', 
            '**/dist/**',
            '**/.git/**',
            '**/.*/**',
            '**/.*',
            '**/**-lock.json'
        ]);
    }

    /**
     * Get include patterns for a specific file path
     */
    async getIncludePatternsForPath(filePath: string): Promise<string[]> {
        const resolvedSettings = await this.getResolvedSettingsForPath(filePath);
        
        if (resolvedSettings) {
            return resolvedSettings['codeCounter.includePatterns'] || [];
        }

        // Fallback to global settings
        const config = vscode.workspace.getConfiguration('codeCounter');
        return config.get<string[]>('includePatterns', []);
    }

    /**
     * Format line count with emoji for specific path
     */
    async formatLineCountWithEmojiForPath(lineCount: number, filePath: string): Promise<{ text: string; emoji: string }> {
        const threshold = await this.getColorThresholdForPath(lineCount, filePath);
        const emoji = await this.getThemeEmojiForPath(threshold, filePath);
        
        let text: string;
        if (lineCount < 1000) {
            text = `${lineCount}L`;
        } else if (lineCount < 1000000) {
            text = `${(lineCount / 1000).toFixed(1)}kL`;
        } else {
            text = `${(lineCount / 1000000).toFixed(1)}ML`;
        }
        
        return { text, emoji };
    }

    /**
     * Get status bar text for specific path
     */
    async getStatusBarTextForPath(lineCount: number, filePath: string): Promise<{ text: string; emoji: string }> {
        const threshold = await this.getColorThresholdForPath(lineCount, filePath);
        const emoji = await this.getThemeEmojiForPath(threshold, filePath);
        
        let text: string;
        if (lineCount < 1000) {
            text = `${lineCount} lines`;
        } else if (lineCount < 1000000) {
            text = `${(lineCount / 1000).toFixed(1)}k lines`;
        } else {
            text = `${(lineCount / 1000000).toFixed(1)}M lines`;
        }
        
        return { text, emoji };
    }

    /**
     * Notify that settings have changed (call this when database settings are updated)
     */
    public notifySettingsChanged(): void {
        // Clear cached services so fresh instances are created with updated settings
        this.clearWorkspaceServices();
        this._onDidChangeSettings.fire('database');
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this._onDidChangeSettings.dispose();
        this.workspaceServices.clear();
    }
}