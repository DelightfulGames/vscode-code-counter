import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
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
                const fileInfo = await this.countFileLines(filePath);
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
        const includePattern = '**/*';
        const options = {
            cwd: workspacePath,
            ignore: excludePatterns,
            nodir: true,
            absolute: true
        };

        return glob(includePattern, options);
    }

    async countFileLines(filePath: string): Promise<FileInfo> {
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

        return {
            path: filePath,
            relativePath: path.relative(path.dirname(filePath), filePath),
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