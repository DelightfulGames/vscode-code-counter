/**
 * VS Code Code Counter Extension
 * Extension Utilities - Shared Functions
 * 
 * Functions for service caching, configuration management, and extension helper utilities
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceDatabaseService } from '../services/workspaceDatabaseService';
import { PathBasedSettingsService } from '../services/pathBasedSettingsService';
import { FileExplorerDecorationProvider } from '../providers/fileExplorerDecorator';
import { DebugService } from '../services/debugService';
import { ResolvedSettings } from '../services/workspaceSettingsService';
import { getDirectoryTreeFromDatabase } from './directoryUtils';

// Initialize debug service
const debug = DebugService.getInstance();

// Service instance cache to prevent excessive database connections
const workspaceServiceCache = new Map<string, WorkspaceDatabaseService>();

// Global references for extension state management
let globalPathBasedSettings: PathBasedSettingsService | null = null;
let globalFileExplorerDecorator: FileExplorerDecorationProvider | null = null;
let globalEmojiPickerPanel: vscode.WebviewPanel | null = null;
let globalCurrentDirectory: string = '<workspace>';

/**
 * Service cache management functions
 */
export function getWorkspaceService(workspacePath: string): WorkspaceDatabaseService {
    const normalizedPath = path.normalize(workspacePath);
    
    if (!workspaceServiceCache.has(normalizedPath)) {
        debug.info('Creating new WorkspaceDatabaseService for production use');
        workspaceServiceCache.set(normalizedPath, new WorkspaceDatabaseService(normalizedPath));
    } else {
        debug.verbose('Reusing existing WorkspaceDatabaseService from cache');
    }
    
    return workspaceServiceCache.get(normalizedPath)!;
}

export function invalidateWorkspaceServiceCache(workspacePath: string): void {
    const normalizedPath = path.normalize(workspacePath);
    if (workspaceServiceCache.has(normalizedPath)) {
        debug.verbose('Invalidating cached WorkspaceDatabaseService for:', normalizedPath);
        workspaceServiceCache.delete(normalizedPath);
    }
}

export function clearServiceCache(): void {
    workspaceServiceCache.clear();
}

/**
 * Global state management functions
 */
export function setGlobalPathBasedSettings(pathBasedSettings: PathBasedSettingsService): void {
    globalPathBasedSettings = pathBasedSettings;
}

export function setGlobalFileExplorerDecorator(fileExplorerDecorator: FileExplorerDecorationProvider): void {
    globalFileExplorerDecorator = fileExplorerDecorator;
}

export function setGlobalEmojiPickerPanel(panel: vscode.WebviewPanel | null): void {
    globalEmojiPickerPanel = panel;
}

export function setGlobalCurrentDirectory(directory: string): void {
    globalCurrentDirectory = directory;
}

export function getGlobalCurrentDirectory(): string {
    return globalCurrentDirectory;
}

/**
 * Configuration and settings management
 */
export function getCurrentConfiguration() {
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

export function addSourceToSettings(settings: any): any {
    // Get current configuration for default values
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

export async function getResolvedSettingsFromDatabase(workspaceService: WorkspaceDatabaseService, targetPath: string): Promise<ResolvedSettings & { source: string }> {
    const inheritance = await workspaceService.getSettingsWithInheritance(targetPath);
    return {
        ...inheritance.resolvedSettings,
        source: 'database'
    } as ResolvedSettings & { source: string };
}

/**
 * Security and path validation functions
 */
export function validateAndSanitizeDirectory(currentDirectory: string): string {
    if (currentDirectory === '<workspace>' || currentDirectory === '<global>') {
        return currentDirectory;
    }
    
    // Check for path traversal attacks
    if (path.isAbsolute(currentDirectory) || currentDirectory.includes('..')) {
        debug.error('SECURITY: Invalid directory path detected:', currentDirectory);
        debug.error('SECURITY: Resetting to workspace to prevent path traversal');
        return '<workspace>';
    }
    
    // Normalize path separators and ensure it's a relative path
    return currentDirectory.replace(/\\/g, '/');
}

export function calculateTargetPath(workspacePath: string, currentDirectory: string): string {
    const sanitizedDir = validateAndSanitizeDirectory(currentDirectory);
    return sanitizedDir === '<workspace>' ? workspacePath : path.join(workspacePath, sanitizedDir);
}

/**
 * Extension notification and refresh functions
 */
export function notifySettingsChanged(): void {
    if (globalPathBasedSettings) {
        globalPathBasedSettings.notifySettingsChanged();
    } else {
        debug.warning('notifySettingsChanged called but globalPathBasedSettings is null');
    }
}

export function refreshFileExplorerDecorator(): void {
    if (globalFileExplorerDecorator) {
        globalFileExplorerDecorator.refresh();
    }
}

/**
 * Workspace data interface for webview operations
 */
export interface WorkspaceData {
    mode: string;
    directoryTree: any[];
    currentDirectory: string;
    resolvedSettings: any;
    currentSettings: any;
    parentSettings: any;
    workspacePath: string;
    patternsWithSources?: any[];
    includePatternsWithSources?: any[];
    hasWorkspaceSettings?: boolean;
}

/**
 * Refresh emoji picker webview with service
 */
export async function refreshEmojiPickerWebviewWithService(workspaceService: WorkspaceDatabaseService, workspacePath: string): Promise<void> {
    if (!globalEmojiPickerPanel) {
        // No panel is open, nothing to refresh
        return;
    }

    try {
        debug.info('Refreshing emoji picker webview with existing service instance');
        
        // Force a 200ms delay to ensure database operations have completed
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Create a completely fresh service instance to avoid any caching issues
        const freshService = getWorkspaceService(workspacePath);
        debug.verbose('Using cached service instance for refresh (cache provides fresh data)');
        
        // Get workspace-level data for emoji display (emojis should always be workspace-level)
        const workspaceInheritanceInfo = await freshService.getSettingsWithInheritance(workspacePath);
        debug.verbose('Workspace inheritance info for emojis:', {
            currentSettings: workspaceInheritanceInfo.currentSettings,
            resolvedSettings: workspaceInheritanceInfo.resolvedSettings,
            parentSettings: workspaceInheritanceInfo.parentSettings
        });
        const workspaceResolvedSettings = workspaceInheritanceInfo.resolvedSettings;
        const globalConfig = getCurrentConfiguration();
        
        const badges = {
            low: workspaceResolvedSettings['codeCounter.emojis.normal'] || globalConfig.badges.low,
            medium: workspaceResolvedSettings['codeCounter.emojis.warning'] || globalConfig.badges.medium,
            high: workspaceResolvedSettings['codeCounter.emojis.danger'] || globalConfig.badges.high
        };
        const folderBadges = {
            low: workspaceResolvedSettings['codeCounter.emojis.folders.normal'] || globalConfig.folderBadges.low,
            medium: workspaceResolvedSettings['codeCounter.emojis.folders.warning'] || globalConfig.folderBadges.medium,
            high: workspaceResolvedSettings['codeCounter.emojis.folders.danger'] || globalConfig.folderBadges.high
        };
        const thresholds = {
            mid: workspaceResolvedSettings['codeCounter.lineThresholds.midThreshold'] || globalConfig.thresholds.mid,
            high: workspaceResolvedSettings['codeCounter.lineThresholds.highThreshold'] || globalConfig.thresholds.high
        };
        const excludePatterns = workspaceResolvedSettings['codeCounter.excludePatterns'] || globalConfig.excludePatterns;
        debug.verbose('Exclude patterns from workspace level:', excludePatterns);

        // Build workspace data for the webview using the fresh service
        const directoryTree = await getDirectoryTreeFromDatabase(freshService, workspacePath);
        
        // Calculate target path for the current directory (ensure normalized path separators)
        const currentDirectory = (globalCurrentDirectory || '<workspace>').replace(/\\/g, '/');
        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                          currentDirectory === '<global>' ? workspacePath :
                          path.join(workspacePath, currentDirectory);
        
        // Get inheritance info and patterns for the specific directory
        const targetInheritanceInfo = await freshService.getSettingsWithInheritance(targetPath);
        const patternsWithSources = await freshService.getExcludePatternsWithSources(targetPath);
        
        debug.verbose('Refresh targeting directory:', currentDirectory, 'at path:', targetPath);
        debug.verbose('Patterns for current directory:', patternsWithSources);
        debug.verbose('Directory tree paths:', directoryTree.map(dir => dir.relativePath));
        debug.verbose('Current directory for selection highlighting:', currentDirectory);
        
        const workspaceData = {
            mode: 'workspace' as const,
            directoryTree,
            currentDirectory,
            resolvedSettings: {
                ...workspaceInheritanceInfo.resolvedSettings,
                source: 'database'
            } as any,
            currentSettings: {
                ...workspaceInheritanceInfo.currentSettings,
                source: 'database'
            } as any,
            parentSettings: addSourceToSettings(workspaceInheritanceInfo.parentSettings),
            workspacePath,
            patternsWithSources
        };

        debug.verbose('Final webview refresh data validation:', {
            'excludePatterns length': excludePatterns?.length || 0,
            'excludePatterns content': excludePatterns,
            'workspaceData.resolvedSettings has excludePatterns': !!workspaceData.resolvedSettings['codeCounter.excludePatterns'],
            'workspaceData.currentSettings has excludePatterns': !!workspaceData.currentSettings['codeCounter.excludePatterns'],
            'workspaceData.parentSettings has excludePatterns': !!workspaceData.parentSettings['codeCounter.excludePatterns']
        });

        // Import and use webview content generation function
        const { getEmojiPickerWebviewContent } = await import('./webviewUtils');
        
        // Update the webview content
        globalEmojiPickerPanel.webview.html = getEmojiPickerWebviewContent(
            badges, 
            folderBadges, 
            thresholds, 
            excludePatterns, 
            workspaceData, 
            globalEmojiPickerPanel.webview
        );

        debug.info('Emoji picker webview refreshed with updated exclusion patterns');
    } catch (error) {
        debug.error('Failed to refresh emoji picker webview with service:', error);
    }
}

/**
 * Find the nearest directory with configuration settings for a given file path
 */
export async function findNearestConfigDirectory(filePath: string): Promise<string> {
    const vscode = await import('vscode');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open');
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    
    const workspaceService = new WorkspaceDatabaseService(workspacePath);
    
    // For files, use the directory; for directories, use the directory itself
    const fs = await import('fs');
    const stats = await fs.promises.stat(filePath);
    let currentDir = stats.isFile() ? path.dirname(filePath) : filePath;

    // Ensure the directory is within the workspace
    if (!currentDir.startsWith(workspacePath)) {
        return workspacePath;
    }

    // Get all directories with settings
    const dirsWithSettings = await workspaceService.getDirectoriesWithSettings();
    
    // If no directories have settings, use workspace root
    if (dirsWithSettings.length === 0) {
        return workspacePath;
    }

    // Traverse up the directory tree to find the nearest parent with settings
    let searchDir = currentDir;
    while (searchDir.length >= workspacePath.length) {
        // Check if current directory has settings
        if (dirsWithSettings.includes(searchDir)) {
            return searchDir;
        }
        
        // Move up one directory level
        const parentDir = path.dirname(searchDir);
        if (parentDir === searchDir) {
            // Reached filesystem root, break to avoid infinite loop
            break;
        }
        searchDir = parentDir;
    }

    // No parent directory with settings found, use workspace root
    return workspacePath;
}

/**
 * Add an exclusion pattern to the nearest appropriate directory's settings,
 * properly inheriting from parent directories
 */
export async function addExclusionPattern(filePath: string, pattern: string): Promise<void> {
    const vscode = await import('vscode');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open');
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const workspaceService = getWorkspaceService(workspacePath);
    
    // Find the appropriate directory for this file
    const targetDirectory = await findNearestConfigDirectory(filePath);
    
    // Validate pattern is not null/undefined/empty
    if (!pattern || pattern.trim() === '') {
        vscode.window.showErrorMessage('Cannot add empty exclusion pattern');
        return;
    }

    // Get the relative path for the target directory
    // Normalize paths to ensure consistent format and resolve any symbolic links
    const normalizedWorkspacePath = path.resolve(path.normalize(workspacePath));
    const normalizedTargetDirectory = path.resolve(path.normalize(targetDirectory));
    
    // Ensure target directory is within workspace before calculating relative path
    if (!normalizedTargetDirectory.startsWith(normalizedWorkspacePath)) {
        debug.error('SECURITY: Target directory is outside workspace bounds');
        vscode.window.showErrorMessage('Cannot add exclusion pattern: Target directory is outside workspace');
        return;
    }
    
    // Calculate relative path safely
    let relativePath = path.relative(normalizedWorkspacePath, normalizedTargetDirectory);
    
    // Additional validation to prevent path traversal
    if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
        debug.error('SECURITY: Calculated relative path contains path traversal or is absolute:', relativePath);
        vscode.window.showErrorMessage('Cannot add exclusion pattern: Invalid directory path');
        return;
    }
    
    // Normalize path separators for consistent storage
    const directoryPath = relativePath.replace(/\\/g, '/') || '';
    
    // Get current settings with inheritance for this directory
    // Pass the absolute target directory path, not the relative path
    const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(normalizedTargetDirectory);
    const inheritedPatterns = settingsWithInheritance.resolvedSettings['codeCounter.excludePatterns'] || [];
    
    // Check if pattern already exists in inherited patterns
    if (inheritedPatterns.includes(pattern)) {
        vscode.window.showInformationMessage(`Pattern "${pattern}" is already excluded (inherited or local)`);
        return;
    }
    
    // Get current local settings for this directory (not inherited)
    const localSettings = settingsWithInheritance.currentSettings || {};
    
    // Copy all inherited patterns plus add the new one
    // This ensures we maintain all existing exclusions when creating local settings
    const newExcludePatterns = [...inheritedPatterns, pattern];
    
    // Update only the excludePatterns in local settings
    const updatedLocalSettings: any = { 
        ...localSettings, 
        'codeCounter.excludePatterns': newExcludePatterns 
    };

    // Save the updated settings - pass absolute target directory path, not relative
    await workspaceService.saveWorkspaceSettings(normalizedTargetDirectory, updatedLocalSettings);
    
    // Notify settings changed first to trigger decorator refresh
    notifySettingsChanged();
    
    // Refresh file explorer decorators to ensure inheritance chain is updated
    refreshFileExplorerDecorator();
    
    // Add small delay to ensure database operations and decorator updates are fully committed
    await new Promise(resolve => setTimeout(resolve, 660));
    
    // Force refresh by creating a new service instance to ensure we get the latest state
    // This avoids any potential caching issues with the current service instance
    const refreshService = new WorkspaceDatabaseService(workspacePath);
    await refreshEmojiPickerWebviewWithService(refreshService, workspacePath);
    
    // Show confirmation
    const displayPath = directoryPath || '<workspace>';
    vscode.window.showInformationMessage(`Added exclusion pattern "${pattern}" to ${displayPath} settings`);
}