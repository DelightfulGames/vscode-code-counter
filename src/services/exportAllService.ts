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
import { LineCountResult } from '../types';
import { XmlGeneratorService } from './xmlGenerator';
import { JsonGeneratorService } from './jsonGenerator';
import { CsvGeneratorService } from './csvGenerator';
import { HtmlGeneratorService } from './htmlGenerator';
import * as fs from 'fs';
import * as path from 'path';

export interface ExportResults {
    xmlPath?: string;
    jsonPath?: string;
    csvPath?: string;
    htmlPath?: string;
    outputDirectory: string;
    totalFiles: number;
}

export class ExportAllService {
    private xmlGenerator: XmlGeneratorService;
    private jsonGenerator: JsonGeneratorService;
    private csvGenerator: CsvGeneratorService;
    private htmlGenerator: HtmlGeneratorService;

    constructor() {
        this.xmlGenerator = new XmlGeneratorService();
        this.jsonGenerator = new JsonGeneratorService();
        this.csvGenerator = new CsvGeneratorService();
        this.htmlGenerator = new HtmlGeneratorService();
    }

    /**
     * Export all formats (XML, JSON, CSV, HTML) to the specified output directory
     */
    async exportAllFormats(result: LineCountResult, outputDirectory: string): Promise<ExportResults> {
        // Ensure output directory exists
        await this.ensureDirectoryExists(outputDirectory);

        const results: ExportResults = {
            outputDirectory,
            totalFiles: 0
        };

        try {
            // Export XML
            results.xmlPath = await this.xmlGenerator.generateXmlFile(result, outputDirectory);
            results.totalFiles++;

            // Export JSON
            results.jsonPath = await this.jsonGenerator.generateJsonFile(result, outputDirectory);
            results.totalFiles++;

            // Export CSV (multiple files)
            results.csvPath = await this.csvGenerator.generateCsvFile(result, outputDirectory);
            results.totalFiles++;

        } catch (error) {
            throw new Error(`Failed to export all formats: ${error}`);
        }

        return results;
    }

    /**
     * Ensure a directory exists, creating it if necessary
     */
    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.promises.access(dirPath);
        } catch {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
    }
}