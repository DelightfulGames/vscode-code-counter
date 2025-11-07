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
import { LineCountResult, FileInfo } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class CsvGeneratorService {
    
    async generateCsvFile(result: LineCountResult, outputPath: string): Promise<string> {
        const filesData = this.generateFileCsv(result);

        const filesFilePath = path.join(outputPath, 'code-counter-data.csv');

        await fs.promises.writeFile(filesFilePath, filesData);

        return filesFilePath;
    }

    generateFileCsv(result: LineCountResult): string {
        const generatedAt = result.generatedAt.toISOString();
        const headers = [
            'Generated At',
            'File Path',
            'Relative Path', 
            'File Name',
            'Directory',
            'Language',
            'Total Lines',
            'Code Lines',
            'Comment Lines',
            'Blank Lines',
            'File Size (bytes)'
        ];

        const rows = result.files.map(file => {
            const fileName = path.basename(file.relativePath);
            const directory = path.dirname(file.relativePath);
            
            return [
                this.escapeCsvField(generatedAt),
                this.escapeCsvField(file.path || ''),
                this.escapeCsvField(file.relativePath || ''),
                this.escapeCsvField(fileName),
                this.escapeCsvField(directory === '.' ? '' : directory),
                this.escapeCsvField(file.language || ''),
                (file.lines || 0).toString(),
                (file.codeLines || 0).toString(),
                (file.commentLines || 0).toString(),
                (file.blankLines || 0).toString(),
                (file.size || 0).toString()
            ];
        });

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    generateLanguageCsv(result: LineCountResult): string {
        const generatedAt = result.generatedAt.toISOString();
        const headers = [
            'Generated At',
            'Language',
            'File Count',
            'Total Lines',
            'Code Lines',
            'Comment Lines',
            'Blank Lines'
        ];

        const rows = Object.entries(result.languageStats).map(([name, stats]) => {
            // Calculate detailed stats from files for this language
            const languageFiles = result.files.filter(file => file.language === name);
            const codeLines = languageFiles.reduce((sum, file) => sum + (file.codeLines || 0), 0);
            const commentLines = languageFiles.reduce((sum, file) => sum + (file.commentLines || 0), 0);
            const blankLines = languageFiles.reduce((sum, file) => sum + (file.blankLines || 0), 0);
            
            return [
                this.escapeCsvField(generatedAt),
                this.escapeCsvField(name),
                stats.files.toString(),
                stats.lines.toString(),
                codeLines.toString(),
                commentLines.toString(),
                blankLines.toString()
            ];
        });

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    generateSummaryCsv(result: LineCountResult): string {
        // Get version from package.json
        const packageJsonPath = path.join(__dirname, '../../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const version = packageJson.version;
        
        // Calculate detailed line counts from files
        const totalCodeLines = result.files.reduce((sum, file) => sum + (file.codeLines || 0), 0);
        const totalCommentLines = result.files.reduce((sum, file) => sum + (file.commentLines || 0), 0);
        const totalBlankLines = result.files.reduce((sum, file) => sum + (file.blankLines || 0), 0);

        const headers = ['Metric', 'Value'];
        const rows = [
            ['Generated At', this.escapeCsvField(result.generatedAt.toISOString())],
            ['Generated By', this.escapeCsvField(`VS Code Code Counter v${version} by DelightfulGames`)],
            ['Workspace Path', this.escapeCsvField(result.workspacePath)],
            ['Total Files', result.totalFiles.toString()],
            ['Total Lines', result.totalLines.toString()],
            ['Total Code Lines', totalCodeLines.toString()],
            ['Total Comment Lines', totalCommentLines.toString()],
            ['Total Blank Lines', totalBlankLines.toString()],
            ['Language Count', Object.keys(result.languageStats || {}).length.toString()]
        ];

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    private escapeCsvField(field: string): string {
        // Escape CSV field by wrapping in quotes if it contains comma, quote, or newline
        if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
    }
}