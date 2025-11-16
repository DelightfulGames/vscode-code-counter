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
import { fileTypeFromBuffer } from 'file-type';
import { DebugService } from './debugService';
import { WorkspaceDatabaseService } from './workspaceDatabaseService';

export interface BinaryDetectionResult {
    isBinary: boolean;
    detectionMethod: string;
    fileSize: number;
}

export class BinaryDetectionService {
    private debug = DebugService.getInstance();
    private databaseService: WorkspaceDatabaseService;
    private workspacePath: string;
    
    // 1GB file size limit
    private readonly MAX_FILE_SIZE = 1024 * 1024 * 1024;
    
    // Buffer size for null byte and magic number detection
    private readonly DETECTION_BUFFER_SIZE = 8192; // 8KB

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.databaseService = new WorkspaceDatabaseService(workspacePath);
    }

    /**
     * Detect if a file is binary using dual detection method with caching
     */
    async isBinary(filePath: string): Promise<BinaryDetectionResult> {
        const startTime = Date.now();
        
        try {
            // Check file size first - skip files larger than 1GB
            const stats = await fs.promises.stat(filePath);
            if (stats.size > this.MAX_FILE_SIZE) {
                const result = {
                    isBinary: true,
                    detectionMethod: 'size_limit_exceeded',
                    fileSize: stats.size
                };
                
                this.debug.verbose('File size exceeds limit:', {
                    filePath,
                    fileSize: stats.size,
                    maxSize: this.MAX_FILE_SIZE
                });
                
                return result;
            }

            const modificationTime = Math.floor(stats.mtimeMs);
            
            // Check cache first using relative path
            const relativePath = this.getRelativePath(filePath);
            const cachedResult = await this.databaseService.getBinaryFileStatus(relativePath, modificationTime);
            if (cachedResult !== null) {
                const endTime = Date.now();
                this.debug.verbose('Binary detection cache hit:', {
                    filePath,
                    relativePath,
                    isBinary: cachedResult,
                    processingTimeMs: endTime - startTime
                });
                
                return {
                    isBinary: cachedResult,
                    detectionMethod: 'cache',
                    fileSize: stats.size
                };
            }

            // Perform detection
            const detectionResult = await this.performBinaryDetection(filePath, stats.size);
            
            // Cache the result using relative path
            await this.databaseService.setBinaryFileStatus(
                relativePath, 
                modificationTime, 
                detectionResult.isBinary, 
                stats.size, 
                detectionResult.detectionMethod
            );

            const endTime = Date.now();
            this.debug.verbose('Binary detection completed:', {
                filePath,
                isBinary: detectionResult.isBinary,
                detectionMethod: detectionResult.detectionMethod,
                fileSize: stats.size,
                processingTimeMs: endTime - startTime
            });

            return detectionResult;

        } catch (error) {
            this.debug.error('Binary detection failed for', filePath, ':', error);
            // Default to binary on error for safety
            return {
                isBinary: true,
                detectionMethod: 'error_fallback',
                fileSize: 0
            };
        }
    }

    /**
     * Perform the actual binary detection using both null bytes and magic numbers
     */
    private async performBinaryDetection(filePath: string, fileSize: number): Promise<BinaryDetectionResult> {
        try {
            // Read the detection buffer
            const buffer = await this.readDetectionBuffer(filePath);
            
            // Method 1: Check for null bytes in the first 8KB
            const hasNullBytes = this.hasNullBytes(buffer);
            if (hasNullBytes) {
                return {
                    isBinary: true,
                    detectionMethod: 'null_bytes',
                    fileSize
                };
            }

            // Method 2: Magic number detection using file-type library
            const fileType = await fileTypeFromBuffer(buffer);
            if (fileType) {
                return {
                    isBinary: true,
                    detectionMethod: `magic_number_${fileType.ext}`,
                    fileSize
                };
            }

            // If neither method detected binary, it's likely a text file
            return {
                isBinary: false,
                detectionMethod: 'text_content',
                fileSize
            };

        } catch (error) {
            this.debug.error('Error during binary detection:', error);
            return {
                isBinary: true,
                detectionMethod: 'detection_error',
                fileSize
            };
        }
    }

    /**
     * Read detection buffer from file with streaming for performance
     */
    private async readDetectionBuffer(filePath: string): Promise<Buffer> {
        const fileHandle = await fs.promises.open(filePath, 'r');
        try {
            const buffer = Buffer.alloc(this.DETECTION_BUFFER_SIZE);
            const { bytesRead } = await fileHandle.read(buffer, 0, this.DETECTION_BUFFER_SIZE, 0);
            return buffer.subarray(0, bytesRead);
        } finally {
            await fileHandle.close();
        }
    }

    /**
     * Check for null bytes in buffer - a strong indicator of binary content
     */
    private hasNullBytes(buffer: Buffer): boolean {
        return buffer.includes(0);
    }

    /**
     * Batch update cache during file moves/deletes
     */
    async updateCacheForFileMove(oldPath: string, newPath: string): Promise<void> {
        try {
            await this.databaseService.removeBinaryFileStatus(oldPath);
            this.debug.verbose('Removed binary cache entry for moved file:', { oldPath, newPath });
        } catch (error) {
            this.debug.error('Failed to update binary cache for file move:', error);
        }
    }

    /**
     * Remove cache entry for deleted file
     */
    async updateCacheForFileDelete(filePath: string): Promise<void> {
        try {
            await this.databaseService.removeBinaryFileStatus(filePath);
            this.debug.verbose('Removed binary cache entry for deleted file:', { filePath });
        } catch (error) {
            this.debug.error('Failed to update binary cache for file delete:', error);
        }
    }

    /**
     * Clear all binary file cache entries
     */
    async clearCache(): Promise<void> {
        try {
            await this.databaseService.clearBinaryFileCache();
            this.debug.info('Cleared binary detection cache');
        } catch (error) {
            this.debug.error('Failed to clear binary detection cache:', error);
        }
    }

    /**
     * Convert absolute file path to relative path for storage
     */
    private getRelativePath(filePath: string): string {
        return path.relative(this.workspacePath, filePath);
    }

    /**
     * Cleanup non-existent files from cache during startup
     */
    async cleanupCache(): Promise<void> {
        try {
            await this.databaseService.cleanupBinaryFileCache();
            this.debug.info('Completed binary cache cleanup');
        } catch (error) {
            this.debug.error('Failed to cleanup binary cache:', error);
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.databaseService.dispose();
    }
}