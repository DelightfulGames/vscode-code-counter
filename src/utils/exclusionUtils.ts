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
    
    // Show confirmation
    const displayPath = directoryPath || '<workspace>';
    vscode.window.showInformationMessage(`Added exclusion pattern "${pattern}" to ${displayPath} settings`);
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
    return relativePath.replace(/\\/g, '/'); // Use forward slashes for consistency
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