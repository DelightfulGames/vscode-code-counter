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

export class JsonGeneratorService {
    
    async generateJsonFile(result: LineCountResult, outputPath: string): Promise<string> {
        const jsonData = this.generateJson(result); 

        const jsonFilePath = path.join(outputPath, 'code-counter-data.json');
        await fs.promises.writeFile(jsonFilePath, jsonData);

        return jsonFilePath;
    }

    generateJson(result: LineCountResult): string {
        // Get version from package.json
        const packageJsonPath = path.join(__dirname, '../../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const version = packageJson.version;
        
        const jsonData = {
            metadata: {
                generatedAt: result.generatedAt.toISOString(),
                generatedBy: `VS Code Code Counter v${version} by DelightfulGames`,
                generatorUrl: 'https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter',
                workspacePath: result.workspacePath,
                version: version
            },
            files: result.files.map(file => this.convertFileToJson(file))
        };

        return JSON.stringify(jsonData, null, 2);
    }

    private convertFileToJson(file: FileInfo) {
        const fileName = path.basename(file.relativePath);
        const directory = path.dirname(file.relativePath);
        
        return {
            path: file.path,
            relativePath: file.relativePath,
            fullPath: file.fullPath || file.relativePath,
            fileName: fileName,
            directory: directory === '.' ? '' : directory,
            language: file.language,
            lines: file.lines || 0,
            codeLines: file.codeLines || 0,
            commentLines: file.commentLines || 0,
            blankLines: file.blankLines || 0,
            size: file.size || 0
        };
    }
}