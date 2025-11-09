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
import { XMLBuilder } from 'fast-xml-parser';
import { LineCountResult, FileInfo } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class XmlGeneratorService {
    
    async generateXmlFile(result: LineCountResult, outputPath: string): Promise<string> {
        const xmlData = this.generateXml(result); 

        const xmlFilePath = path.join(outputPath, 'code-counter-data.xml');
        await fs.promises.writeFile(xmlFilePath, xmlData);

        return xmlFilePath;
    }

    generateXml(result: LineCountResult): string {
        // Get version from package.json
        const packageJsonPath = path.join(__dirname, '../../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const version = packageJson.version;
        
        const xmlData = {
            codeCounter: {
                '@_generatedAt': result.generatedAt.toISOString(),
                '@_generatedBy': `VS Code Code Counter v${version} by DelightfulGames`,
                '@_generatorUrl': 'https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter',
                '@_workspacePath': result.workspacePath,
                '@_version': version,
                files: {
                    file: result.files.map(file => this.convertFileToXml(file))
                }
            }
        };

        const builder = new XMLBuilder({
            attributeNamePrefix: '@_',
            ignoreAttributes: false,
            format: true,
            indentBy: '  '
        });

        return builder.build(xmlData);
    }

    private convertFileToXml(file: FileInfo) {
        const fileName = require('path').basename(file.relativePath);
        const directory = require('path').dirname(file.relativePath);
        
        return {
            '@_relativePath': file.relativePath,
            '@_fileName': fileName,
            '@_directory': directory === '.' ? '' : directory,
            '@_language': file.language,
            '@_lines': file.lines,
            '@_codeLines': file.codeLines,
            '@_commentLines': file.commentLines,
            '@_blankLines': file.blankLines,
            '@_size': file.size
        };
    }
}