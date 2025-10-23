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
export class GlobUtils {
    
    static matchesPattern(filePath: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = this.globToRegex(pattern);
        const regex = new RegExp(regexPattern, 'i');
        return regex.test(filePath);
    }
    
    static matchesAnyPattern(filePath: string, patterns: string[]): boolean {
        return patterns.some(pattern => this.matchesPattern(filePath, pattern));
    }
    
    private static globToRegex(pattern: string): string {
        // Escape special regex characters except for glob wildcards
        let regex = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
        
        // Handle path separators first (both forward and backward slashes)
        regex = regex.replace(/\//g, '[/\\\\]');
        
        // Now handle glob patterns
        regex = regex.replace(/\*\*/g, '.__DOUBLE_STAR__'); // Temporarily replace **
        regex = regex.replace(/\*/g, '[^/\\\\]*'); // * matches anything except path separators
        regex = regex.replace(/\?/g, '[^/\\\\]'); // ? matches single char except path separators
        
        // Handle ** correctly - it should match zero or more path segments
        // **/ should match "" (empty string) or "dir/" or "dir/subdir/"
        regex = regex.replace(/\.__DOUBLE_STAR__\[\/\\\\\]/g, '(?:.*[/\\\\])?'); // **/ matches zero or more dirs
        regex = regex.replace(/\[\/\\\\\]\.__DOUBLE_STAR__/g, '(?:[/\\\\].*)?'); // /** matches optional path  
        regex = regex.replace(/\.__DOUBLE_STAR__/g, '.*'); // ** alone matches everything
        
        return `^${regex}$`;
    }
    
    static getDefaultExclusions(): string[] {
        return [
            '**/node_modules/**',
            '**/out/**',
            '**/dist/**',
            '**/.git/**',
            '**/.*/**',
            '**/.*',
            '**/**-lock.json'
        ];
    }
}