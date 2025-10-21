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

export class FileUtils {
    
    static async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    static async ensureDirectory(dirPath: string): Promise<void> {
        if (!(await this.fileExists(dirPath))) {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
    }
    
    static async readFileContent(filePath: string): Promise<string> {
        return fs.promises.readFile(filePath, 'utf8');
    }
    
    static async writeFileContent(filePath: string, content: string): Promise<void> {
        const dir = path.dirname(filePath);
        await this.ensureDirectory(dir);
        return fs.promises.writeFile(filePath, content);
    }
    
    static getFileExtension(filePath: string): string {
        return path.extname(filePath).toLowerCase();
    }
    
    static getRelativePath(fromPath: string, toPath: string): string {
        return path.relative(fromPath, toPath);
    }
    
    static async getFileSize(filePath: string): Promise<number> {
        const stats = await fs.promises.stat(filePath);
        return stats.size;
    }
}