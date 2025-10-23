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
import { WorkspaceSettingsService, ResolvedSettings } from './workspaceSettingsService';

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

export class PathBasedSettingsService {
    private workspaceSettingsService: WorkspaceSettingsService | null = null;
    
    constructor() {
        this.initializeWorkspaceService();
    }

    /**
     * Set workspace settings service manually (for testing)
     */
    public setWorkspaceSettingsService(service: WorkspaceSettingsService): void {
        this.workspaceSettingsService = service;
    }

    private initializeWorkspaceService(): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            this.workspaceSettingsService = new WorkspaceSettingsService(workspacePath);
        }
    }

    /**
     * Get resolved settings for a specific file or folder path
     */
    private async getResolvedSettingsForPath(filePath: string): Promise<ResolvedSettings | null> {
        if (!this.workspaceSettingsService) {
            return null;
        }

        // Normalize the file path to handle both string paths and URI objects
        let normalizedPath: string;
        if (filePath.startsWith('file://')) {
            normalizedPath = vscode.Uri.parse(filePath).fsPath;
        } else {
            normalizedPath = filePath;
        }
        
        // Get the directory path (for files) or use as-is (for directories)
        const directoryPath = path.dirname(normalizedPath);
            
        try {
            const resolvedSettings = await this.workspaceSettingsService.getResolvedSettings(directoryPath);
            return resolvedSettings;
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
        const customEmojis = await this.getCustomEmojisForPath(filePath);
        
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
}