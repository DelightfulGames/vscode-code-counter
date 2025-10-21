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
import * as vscode from 'vscode';
import { FileInfo, LineCountResult } from '../types';

export class LineCounterService {
    
    async countLines(workspacePath: string, excludePatterns: string[] = []): Promise<LineCountResult> {
        const files = await this.getFiles(workspacePath, excludePatterns);
        const fileInfos: FileInfo[] = [];
        
        let totalLines = 0;
        let totalFiles = 0;
        const languageStats: { [language: string]: { files: number; lines: number } } = {};

        for (const filePath of files) {
            try {
                const fileInfo = await this.countFileLines(filePath, workspacePath);
                fileInfos.push(fileInfo);
                
                totalLines += fileInfo.lines;
                totalFiles++;
                
                // Update language statistics
                if (!languageStats[fileInfo.language]) {
                    languageStats[fileInfo.language] = { files: 0, lines: 0 };
                }
                languageStats[fileInfo.language].files++;
                languageStats[fileInfo.language].lines += fileInfo.lines;
                
            } catch (error) {
                console.warn(`Failed to count lines in ${filePath}:`, error);
            }
        }

        return {
            workspacePath,
            totalFiles,
            totalLines,
            files: fileInfos,
            languageStats,
            generatedAt: new Date()
        };
    }

    private async getFiles(workspacePath: string, excludePatterns: string[]): Promise<string[]> {
        // Use VS Code's workspace API instead of glob
        const includePattern = new vscode.RelativePattern(workspacePath, '**/*');
        const excludePattern = excludePatterns.length > 0 
            ? `{${excludePatterns.join(',')}}` 
            : undefined;
        
        const files = await vscode.workspace.findFiles(includePattern, excludePattern);
        return files.map(file => file.fsPath);
    }

    async countFileLines(filePath: string, workspacePath?: string): Promise<FileInfo> {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        let codeLines = 0;
        let commentLines = 0;
        let blankLines = 0;
        
        const language = this.detectLanguage(filePath);
        const commentPatterns = this.getCommentPatterns(language);
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed === '') {
                blankLines++;
            } else if (this.isCommentLine(trimmed, commentPatterns)) {
                commentLines++;
            } else {
                codeLines++;
            }
        }

        const relativePath = workspacePath ? path.relative(workspacePath, filePath) : path.relative(path.dirname(filePath), filePath);
        
        return {
            path: filePath,
            relativePath,
            fullPath: relativePath.replace(/\\/g, '/'), // Use normalized relative path
            language,
            lines: lines.length,
            codeLines,
            commentLines,
            blankLines,
            size: content.length
        };
    }

    private detectLanguage(filePath: string): string {
        const extension = path.extname(filePath).toLowerCase();
        
        const languageMap: { [ext: string]: string } = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.jsx': 'JSX',
            '.tsx': 'TSX',
            '.py': 'Python',
            '.java': 'Java',
            '.c': 'C',
            '.cpp': 'C++',
            '.cs': 'C#',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.rs': 'Rust',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.scala': 'Scala',
            '.html': 'HTML',
            '.css': 'CSS',
            '.scss': 'SCSS',
            '.sass': 'Sass',
            '.less': 'Less',
            '.json': 'JSON',
            '.xml': 'XML',
            '.yaml': 'YAML',
            '.yml': 'YAML',
            '.md': 'Markdown',
            '.txt': 'Text',
            '.sh': 'Shell',
            '.bat': 'Batch',
            '.ps1': 'PowerShell'
        };

        return languageMap[extension] || 'Unknown';
    }

    private getCommentPatterns(language: string): string[] {
        const commentMap: { [lang: string]: string[] } = {
            'JavaScript': ['//', '/*', '*/'],
            'TypeScript': ['//', '/*', '*/'],
            'JSX': ['//', '/*', '*/'],
            'TSX': ['//', '/*', '*/'],
            'Java': ['//', '/*', '*/'],
            'C': ['//', '/*', '*/'],
            'C++': ['//', '/*', '*/'],
            'C#': ['//', '/*', '*/'],
            'PHP': ['//', '/*', '*/', '#'],
            'Python': ['#', '"""', "'''"],
            'Ruby': ['#'],
            'Go': ['//', '/*', '*/'],
            'Rust': ['//', '/*', '*/'],
            'Swift': ['//', '/*', '*/'],
            'Kotlin': ['//', '/*', '*/'],
            'Scala': ['//', '/*', '*/'],
            'HTML': ['<!--', '-->'],
            'XML': ['<!--', '-->'],
            'CSS': ['/*', '*/'],
            'SCSS': ['//', '/*', '*/'],
            'Sass': ['//'],
            'Less': ['//', '/*', '*/'],
            'Shell': ['#'],
            'Batch': ['REM', '::'],
            'PowerShell': ['#', '<#', '#>']
        };

        return commentMap[language] || [];
    }

    private isCommentLine(line: string, commentPatterns: string[]): boolean {
        for (const pattern of commentPatterns) {
            if (line.startsWith(pattern)) {
                return true;
            }
        }
        return false;
    }
}