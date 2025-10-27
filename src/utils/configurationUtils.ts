/**
 * Configuration utility functions for VS Code Code Counter Extension
 */

import * as vscode from 'vscode';

export interface ConfigurationSettings {
    badges: {
        low: string;
        medium: string;
        high: string;
    };
    folderBadges: {
        low: string;
        medium: string;
        high: string;
    };
    thresholds: {
        mid: number;
        high: number;
    };
    excludePatterns: string[];
    debug: string;
}

/**
 * Get current VS Code configuration for Code Counter
 */
export function getCurrentConfiguration(): ConfigurationSettings {
    const config = vscode.workspace.getConfiguration('codeCounter');
    const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
    const folderEmojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis.folders');
    
    return {
        badges: {
            low: emojiConfig.get('normal', '🟢'),
            medium: emojiConfig.get('warning', '🟡'), 
            high: emojiConfig.get('danger', '🔴')
        },
        folderBadges: {
            low: folderEmojiConfig.get('normal', '🟩'),
            medium: folderEmojiConfig.get('warning', '🟨'),
            high: folderEmojiConfig.get('danger', '🟥')
        },
        thresholds: {
            mid: config.get('lineThresholds.midThreshold', 300),
            high: config.get('lineThresholds.highThreshold', 1000)
        },
        excludePatterns: config.get<string[]>('excludePatterns', [
            '**/node_modules/**',
            '**/out/**',
            '**/bin/**', 
            '**/dist/**',
            '**/.git/**',
            '**/.*/**',
            '**/.*',
            '**/**-lock.json'            
        ]),
        debug: config.get('debug', 'none')
    };
}

/**
 * Add source property to settings for inheritance tracking
 */
export function addSourceToSettings(settings: any): any {
    const config = getCurrentConfiguration();
    
    return {
        ...settings,
        // Ensure parent settings always have default values for JavaScript placeholders
        'codeCounter.lineThresholds.midThreshold': settings['codeCounter.lineThresholds.midThreshold'] ?? config.thresholds.mid,
        'codeCounter.lineThresholds.highThreshold': settings['codeCounter.lineThresholds.highThreshold'] ?? config.thresholds.high,
        'codeCounter.emojis.normal': settings['codeCounter.emojis.normal'] ?? config.badges.low,
        'codeCounter.emojis.warning': settings['codeCounter.emojis.warning'] ?? config.badges.medium,
        'codeCounter.emojis.danger': settings['codeCounter.emojis.danger'] ?? config.badges.high,
        'codeCounter.emojis.folders.normal': settings['codeCounter.emojis.folders.normal'] ?? config.folderBadges.low,
        'codeCounter.emojis.folders.warning': settings['codeCounter.emojis.folders.warning'] ?? config.folderBadges.medium,
        'codeCounter.emojis.folders.danger': settings['codeCounter.emojis.folders.danger'] ?? config.folderBadges.high,
        source: 'database'
    };
}

/**
 * Get notification and output settings
 */
export function getNotificationAndOutputSettings(): {
    showNotificationOnAutoGenerate: boolean;
    outputDirectory: string;
    autoGenerate: boolean;
} {
    const config = vscode.workspace.getConfiguration('codeCounter');
    return {
        showNotificationOnAutoGenerate: config.get<boolean>('showNotificationOnAutoGenerate', false),
        outputDirectory: config.get<string>('outputDirectory', './.cc/reports'),
        autoGenerate: config.get<boolean>('autoGenerate', true)
    };
}