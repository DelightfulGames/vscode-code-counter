/**
 * Exclusion patterns utility functions for VS Code Code Counter Extension
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { DebugService } from '../services/debugService';
import { WorkspaceSettings } from '../services/workspaceDatabaseService';
import { getWorkspaceService } from './workspaceUtils';
import { safeRelativePath } from './pathUtils';
import { refreshFileExplorerDecorator, invalidateWorkspaceServiceCache } from '../shared/extensionUtils';

const debug = DebugService.getInstance();

/**
 * Find the nearest directory to a file path for adding exclusion patterns
 */
export async function findNearestConfigDirectory(filePath: string): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open');
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    debug.verbose('findNearestConfigDirectory: workspacePath =', workspacePath);
    debug.verbose('findNearestConfigDirectory: filePath =', filePath);
    
    const workspaceService = getWorkspaceService(workspacePath);
    
    // For files, use the directory; for directories, use the directory itself
    const stats = await fs.promises.stat(filePath);
    let currentDir = stats.isFile() ? path.dirname(filePath) : filePath;
    debug.verbose('findNearestConfigDirectory: currentDir =', currentDir);

    // Ensure the directory is within the workspace
    if (!currentDir.startsWith(workspacePath)) {
        debug.verbose('findNearestConfigDirectory: currentDir not in workspace, returning workspacePath');
        return workspacePath;
    }

    // Get all directories with settings
    const dirsWithSettings = await workspaceService.getDirectoriesWithSettings();
    debug.verbose('findNearestConfigDirectory: dirsWithSettings =', dirsWithSettings);
    
    // If no directories have settings, use workspace root
    if (dirsWithSettings.length === 0) {
        debug.verbose('findNearestConfigDirectory: no dirs with settings, returning workspacePath');
        return workspacePath;
    }

    // Traverse up the directory tree to find the nearest parent with settings
    let searchDir = currentDir;
    while (searchDir.length >= workspacePath.length) {
        debug.verbose('findNearestConfigDirectory: checking searchDir =', searchDir);
        // Check if current directory has settings
        if (dirsWithSettings.includes(searchDir)) {
            debug.verbose('findNearestConfigDirectory: found settings in searchDir, returning', searchDir);
            return searchDir;
        }
        
        // Move up one directory level
        const parentDir = path.dirname(searchDir);
        if (parentDir === searchDir) {
            // Reached filesystem root, break to avoid infinite loop
            debug.verbose('findNearestConfigDirectory: reached filesystem root');
            break;
        }
        searchDir = parentDir;
    }

    // No parent directory with settings found, use workspace root
    debug.verbose('findNearestConfigDirectory: no parent found, returning workspacePath');
    return workspacePath;
}

/**
 * Add an exclusion pattern to the nearest appropriate directory's settings,
 * properly inheriting from parent directories
 */
export async function addExclusionPattern(filePath: string, pattern: string): Promise<void> {
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

    // Calculate relative path safely
    const directoryPath = safeRelativePath(workspacePath, targetDirectory);
    
    debug.verbose('addExclusionPattern: workspacePath =', workspacePath);
    debug.verbose('addExclusionPattern: targetDirectory =', targetDirectory);
    debug.verbose('addExclusionPattern: directoryPath =', directoryPath);
    
    // Get current settings with inheritance for this directory
    const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(targetDirectory);
    const inheritedPatterns = settingsWithInheritance.resolvedSettings['codeCounter.excludePatterns'] || [];
    
    // Get current local settings for this directory (not inherited)
    const localSettings = settingsWithInheritance.currentSettings || {};
    const localPatterns = localSettings['codeCounter.excludePatterns'] || [];
    
    // ALSO check global VS Code configuration patterns (added by webview)
    const globalConfig = vscode.workspace.getConfiguration('codeCounter');
    const globalPatterns = globalConfig.get<string[]>('excludePatterns', []);
    
    // Check if pattern already exists in LOCAL patterns for this specific directory
    if (localPatterns.includes(pattern)) {
        vscode.window.showInformationMessage(`Pattern "${pattern}" is already excluded in this directory's local settings`);
        return;
    }
    
    // Check if pattern already exists in global VS Code configuration
    if (globalPatterns.includes(pattern)) {
        vscode.window.showInformationMessage(`Pattern "${pattern}" is already excluded in global VS Code settings`);
        return;
    }
    
    // Check if pattern already exists in inherited patterns from parent directories
    // Calculate parent patterns by subtracting local patterns from resolved patterns
    const resolvedPatterns = inheritedPatterns;
    const parentPatterns = resolvedPatterns.filter(p => !localPatterns.includes(p));
    const isInherited = parentPatterns.includes(pattern);
    
    // Copy all inherited patterns plus add the new one
    // This ensures we maintain all existing exclusions when creating local settings
    const newExcludePatterns = [...inheritedPatterns, pattern];
    
    debug.verbose('Adding exclusion pattern:', {
        pattern,
        inheritedPatterns,
        newExcludePatterns,
        directoryPath
    });
    
    // Update only the excludePatterns in local settings
    const updatedLocalSettings: WorkspaceSettings = { 
        ...localSettings, 
        'codeCounter.excludePatterns': newExcludePatterns 
    };

    // Save the updated settings
    await workspaceService.saveWorkspaceSettings(targetDirectory, updatedLocalSettings);
    
    // CRITICAL: Invalidate the workspace service cache after database changes
    // This ensures fresh data is loaded on next access, preventing stale cache issues
    invalidateWorkspaceServiceCache(workspacePath);
    
    // Verify the pattern was actually saved before proceeding with refreshes
    let verificationAttempts = 0;
    const maxAttempts = 10;
    let patternSaved = false;
    
    while (verificationAttempts < maxAttempts && !patternSaved) {
        try {
            // Wait a bit for database operations to complete
            await new Promise(resolve => setTimeout(resolve, 50 + (verificationAttempts * 25)));
            
            // Verify pattern was saved
            const verificationSettings = await workspaceService.getSettingsWithInheritance(targetDirectory);
            const savedPatterns = verificationSettings.resolvedSettings['codeCounter.excludePatterns'] || [];
            
            patternSaved = savedPatterns.includes(pattern);
            
            if (patternSaved) {
                debug.verbose('Pattern verification successful after', verificationAttempts + 1, 'attempts');
                break;
            }
        } catch (error) {
            debug.warning('Pattern verification failed, attempt', verificationAttempts + 1, ':', error);
        }
        
        verificationAttempts++;
    }
    
    if (!patternSaved) {
        debug.warning('Pattern verification failed after', maxAttempts, 'attempts - proceeding anyway');
    }
    
    // Refresh file explorer decorators to ensure the change is visible
    refreshFileExplorerDecorator();
    
    // Show confirmation
    const displayPath = directoryPath || '<workspace>';
    const inheritanceNote = isInherited ? ' (pattern was inherited, now explicitly set locally)' : '';
    vscode.window.showInformationMessage(`Added exclusion pattern "${pattern}" to ${displayPath} settings${inheritanceNote}`);
}

/**
 * Create relative path pattern for a file or directory
 */
export function createRelativePathPattern(workspacePath: string, filePath: string): string {
    const stats = fs.statSync(filePath);
    let relativePath = path.relative(workspacePath, filePath);
    
    if (!relativePath) {
        throw new Error('Cannot create pattern for workspace root');
    }
    
    relativePath = stats.isDirectory() ? relativePath + '/**' : relativePath;
    // Use forward slashes for consistency and add leading slash for proper glob matching
    let pattern = relativePath.replace(/\\/g, '/');
    if (!pattern.startsWith('/')) {
        pattern = '/' + pattern;
    }
    return pattern;
}

/**
 * Create filename pattern for excluding files by name
 */
export function createFilenamePattern(filePath: string): string {
    const fileName = path.basename(filePath);
    if (!fileName) {
        throw new Error('Cannot extract filename from path');
    }
    
    const stats = fs.statSync(filePath);
    let pattern = `**/${fileName}`;
    if (stats.isDirectory()) {
        pattern += '/**';
    }
    
    return pattern;
}

/**
 * Create extension pattern for excluding files by extension
 */
export function createExtensionPattern(filePath: string): string {
    const extension = path.extname(filePath);
    if (!extension) {
        throw new Error('File has no extension');
    }
    
    return `**/*${extension}`;
}

/**
 * Handle excluding a file/folder by relative path
 */
export async function handleExcludeRelativePath(resource: vscode.Uri): Promise<void> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const filePath = resource.fsPath;
        
        debug.verbose('handleExcludeRelativePath: resource =', resource);
        debug.verbose('handleExcludeRelativePath: resource.fsPath =', resource.fsPath);
        debug.verbose('handleExcludeRelativePath: workspacePath =', workspacePath);
        
        if (!filePath) {
            vscode.window.showErrorMessage('Invalid file path for exclusion');
            return;
        }
        
        const stats = await fs.promises.stat(filePath);
        
        // Create relative path pattern
        let relativePath = path.relative(workspacePath, filePath);
        if (!relativePath) {
            vscode.window.showErrorMessage('Could not determine relative path for exclusion');
            return;
        }
        relativePath = stats.isDirectory() ? relativePath + '/**' : relativePath;
        // Use forward slashes for consistency and add leading slash for proper glob matching
        let pattern = relativePath.replace(/\\/g, '/');
        if (!pattern.startsWith('/')) {
            pattern = '/' + pattern;
        }
        
        if (!pattern) {
            vscode.window.showErrorMessage('Could not create exclusion pattern');
            return;
        }
        
        await addExclusionPattern(filePath, pattern);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to exclude path: ${error}`);
    }
}

/**
 * Handle excluding files by name pattern (basename)
 */
export async function handleExcludeFilePattern(resource: vscode.Uri): Promise<void> {
    try {
        const filePath = resource.fsPath;
        
        debug.verbose('handleExcludeFilePattern: resource =', resource);
        debug.verbose('handleExcludeFilePattern: resource.fsPath =', resource.fsPath);
        
        if (!filePath) {
            vscode.window.showErrorMessage('Invalid file path for exclusion');
            return;
        }
        
        const fileName = path.basename(filePath);
        
        if (!fileName) {
            vscode.window.showErrorMessage('Could not determine file name for exclusion');
            return;
        }
        
        const stats = await fs.promises.stat(filePath);
        let directoryPath = stats.isFile() ? path.dirname(filePath) : filePath;

        // Create a global pattern for this filename
        let pattern = `**/${fileName}`;
        if (stats.isDirectory())
            pattern += '/**';
        
        if (!pattern || pattern === '**/') {
            vscode.window.showErrorMessage('Could not create valid exclusion pattern');
            return;
        }
        
        await addExclusionPattern(filePath, pattern);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to exclude file pattern: ${error}`);
    }
}

/**
 * Handle excluding files by extension
 */
export async function handleExcludeExtension(resource: vscode.Uri): Promise<void> {
    try {
        const filePath = resource.fsPath;
        
        debug.verbose('handleExcludeExtension: resource =', resource);
        debug.verbose('handleExcludeExtension: resource.fsPath =', resource.fsPath);
        
        if (!filePath) {
            vscode.window.showErrorMessage('Invalid file path for exclusion');
            return;
        }
        
        const extension = path.extname(filePath);
        
        if (!extension) {
            vscode.window.showWarningMessage('Selected file has no extension to exclude');
            return;
        }
        
        // Create a global pattern for this extension
        const pattern = `**/*${extension}`;
        
        if (!pattern || pattern === '**/*') {
            vscode.window.showErrorMessage('Could not create valid extension exclusion pattern');
            return;
        }
        
        await addExclusionPattern(filePath, pattern);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to exclude extension: ${error}`);
    }
}