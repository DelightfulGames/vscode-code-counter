/**
 * Path utility functions for VS Code Code Counter Extension
 */

import * as path from 'path';
import { DebugService } from '../services/debugService';

const debug = DebugService.getInstance();

/**
 * Security: Validate and sanitize directory paths to prevent path traversal attacks
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

/**
 * Safe function to calculate target path
 */
export function calculateTargetPath(workspacePath: string, currentDirectory: string): string {
    const sanitizedDir = validateAndSanitizeDirectory(currentDirectory);
    return sanitizedDir === '<workspace>' ? workspacePath : path.join(workspacePath, sanitizedDir);
}

/**
 * Normalize path safely for consistent storage and display
 */
export function normalizePath(inputPath: string): string {
    return path.normalize(inputPath).replace(/\\/g, '/');
}

/**
 * Safely calculate relative path between two paths
 */
export function safeRelativePath(from: string, to: string): string {
    const normalizedFrom = path.resolve(path.normalize(from));
    const normalizedTo = path.resolve(path.normalize(to));
    
    // Security check: ensure target is within workspace bounds
    if (!normalizedTo.startsWith(normalizedFrom)) {
        debug.error('SECURITY: Target path is outside workspace bounds');
        throw new Error('Target path is outside workspace bounds');
    }
    
    const relativePath = path.relative(normalizedFrom, normalizedTo);
    
    // Additional validation to prevent path traversal
    if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
        debug.error('SECURITY: Calculated relative path contains path traversal or is absolute:', relativePath);
        throw new Error('Invalid relative path calculated');
    }
    
    return relativePath.replace(/\\/g, '/') || '';
}