/**
 * Workspace utility functions for VS Code Code Counter Extension
 */

import * as path from 'path';
import * as fs from 'fs';
import { DirectoryNode } from '../services/workspaceSettingsService';
import { WorkspaceDatabaseService, ResolvedSettings } from '../services/workspaceDatabaseService';
import { DebugService } from '../services/debugService';

const debug = DebugService.getInstance();

/**
 * Service instance cache to prevent excessive database connections
 */
const workspaceServiceCache = new Map<string, WorkspaceDatabaseService>();

/**
 * Get workspace service instance with caching
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

/**
 * Invalidate cache for a specific workspace (forces fresh reload on next access)
 */
export function invalidateWorkspaceServiceCache(workspacePath: string): void {
    const normalizedPath = path.normalize(workspacePath);
    if (workspaceServiceCache.has(normalizedPath)) {
        debug.verbose('Invalidating cached WorkspaceDatabaseService for:', normalizedPath);
        workspaceServiceCache.delete(normalizedPath);
    }
}

/**
 * Cleanup function for extension deactivation
 */
export function clearServiceCache(): void {
    workspaceServiceCache.clear();
}

/**
 * Get all actual directories in workspace
 */
export async function getAllWorkspaceDirectories(workspacePath: string): Promise<string[]> {
    const directories: string[] = [workspacePath]; // Include workspace root
    const fs = require('fs').promises;
    
    async function scanDirectory(dirPath: string, depth: number = 0): Promise<void> {
        // Limit recursion depth to prevent infinite loops and performance issues
        if (depth > 4) return;
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const fullPath = path.join(dirPath, entry.name);
                    
                    // Skip common directories that should not be scanned
                    if (shouldSkipDirectory(entry.name)) {
                        continue;
                    }
                    
                    directories.push(fullPath);
                    await scanDirectory(fullPath, depth + 1);
                }
            }
        } catch (error) {
            // Silently skip directories we can't read
            debug.verbose(`Could not scan directory ${dirPath}:`, error instanceof Error ? error.message : String(error));
        }
    }
    
    await scanDirectory(workspacePath);
    return directories;
}

/**
 * Check if a directory should be skipped during scanning
 */
function shouldSkipDirectory(name: string): boolean {
    const skipPatterns = [
        'node_modules',
        '.git',
        'out',
        'bin',
        'dist',
        'build',
        'coverage',
        '.vscode-test',
        '.nyc_output'
    ];
    return skipPatterns.includes(name);
}

/**
 * Get directory tree from database with proper hierarchy
 */
export async function getDirectoryTreeFromDatabase(workspaceService: WorkspaceDatabaseService, workspacePath: string): Promise<DirectoryNode[]> {
    // Get directories that have settings in database
    const directoriesWithSettings = await workspaceService.getDirectoriesWithSettings();
    
    // Get all actual subdirectories in the workspace
    const allDirectories = await getAllWorkspaceDirectories(workspacePath);
    
    // Debug: Log found directories
    const hiddenDirs = allDirectories.filter(dir => path.basename(dir).startsWith('.'));
    debug.info(`getDirectoryTreeFromDatabase - Total directories: ${allDirectories.length}, Hidden directories: ${hiddenDirs.length}`);
    hiddenDirs.forEach(dir => debug.info(`  Hidden directory: ${dir}`));
    
    // Create directory tree with both existing directories and those with settings
    const directoryMap = new Map<string, DirectoryNode>();
    const processedPaths = new Set<string>();
    
    // Add all actual directories
    for (const dirPath of allDirectories) {
        const relativePath = path.relative(workspacePath, dirPath);
        const normalizedRelative = relativePath === '' ? '<workspace>' : relativePath.replace(/\\/g, '/');
        
        if (!processedPaths.has(dirPath)) {
            const dirName = relativePath === '' ? '<workspace>' : path.basename(dirPath);
            const node = {
                name: dirName,
                path: dirPath,
                relativePath: normalizedRelative,
                hasSettings: directoriesWithSettings.includes(dirPath),
                children: []
            };
            directoryMap.set(dirPath, node);
            processedPaths.add(dirPath);
        }
    }
    
    // Add any directories from database that might not exist on disk (for completeness)
    for (const dirPath of directoriesWithSettings) {
        if (!processedPaths.has(dirPath) && dirPath !== workspacePath) {
            const relativePath = path.relative(workspacePath, dirPath);
            const normalizedRelative = relativePath === '' ? '<workspace>' : relativePath.replace(/\\/g, '/');
            const dirName = relativePath === '' ? '<workspace>' : path.basename(dirPath);
            
            directoryMap.set(dirPath, {
                name: dirName,
                path: dirPath,
                relativePath: normalizedRelative,
                hasSettings: true,
                children: []
            });
        }
    }
    
    // Build hierarchical structure
    const rootNodes: DirectoryNode[] = [];
    const allNodes = Array.from(directoryMap.values());
    
    for (const node of allNodes) {
        if (node.relativePath === '<workspace>') {
            // Skip workspace root in the tree - it's handled separately
            continue;
        }
        
        // Find parent directory
        const parentPath = path.dirname(node.path);
        const parentNode = directoryMap.get(parentPath);
        
        if (parentNode && parentPath !== node.path && parentNode.relativePath !== '<workspace>') {
            // Add to parent's children
            parentNode.children.push(node);
        } else {
            // This is a root-level directory (direct child of workspace)
            rootNodes.push(node);
        }
    }
    
    // Sort root nodes: directories with settings first, then alphabetically
    rootNodes.sort((a, b) => {
        if (a.hasSettings && !b.hasSettings) return -1;
        if (!a.hasSettings && b.hasSettings) return 1;
        return a.name.localeCompare(b.name);
    });
    
    // Debug: Log final root nodes
    const hiddenRootNodes = rootNodes.filter(node => node.name.startsWith('.'));
    debug.info(`getDirectoryTreeFromDatabase - Root nodes: ${rootNodes.length}, Hidden root nodes: ${hiddenRootNodes.length}`);
    hiddenRootNodes.forEach(node => debug.info(`  Hidden root node: ${node.name} (${node.path})`));
    
    return rootNodes;
}

/**
 * Get resolved settings from database with proper typing
 */
export async function getResolvedSettingsFromDatabase(workspaceService: WorkspaceDatabaseService, targetPath: string): Promise<ResolvedSettings & { source: string }> {
    const inheritance = await workspaceService.getSettingsWithInheritance(targetPath);
    return {
        ...inheritance.resolvedSettings,
        source: 'database'
    } as ResolvedSettings & { source: string };
}