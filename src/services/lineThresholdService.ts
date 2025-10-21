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
import * as vscode from 'vscode';

export type ColorThreshold = 'normal' | 'warning' | 'danger';

export interface ColorThresholdConfig {
    enabled: boolean;
    midThreshold: number;
    highThreshold: number;
}

export interface CustomEmojis {
    normal: string;
    warning: string;
    danger: string;
}

export class lineThresholdService {
    
    static getCustomEmojis(): CustomEmojis {
        const config = vscode.workspace.getConfiguration('codeCounter.emojis');
        return {
            normal: config.get<string>('normal', '🟢'),
            warning: config.get<string>('warning', '🟡'),
            danger: config.get<string>('danger', '🔴')
        };
    }
    
    static getThresholdConfig(): ColorThresholdConfig {
        const config = vscode.workspace.getConfiguration('codeCounter.lineThresholds');
        
        let midThreshold = config.get<number>('midThreshold', 300);
        let highThreshold = config.get<number>('highThreshold', 1000);
        
        // Ensure High threshold is higher than mid threshold
        if (highThreshold <= midThreshold) {
            highThreshold = midThreshold + 100;
            console.warn(`High threshold (${config.get('highThreshold')}) must be higher than mid threshold (${midThreshold}). Using ${highThreshold} instead.`);
        }
        
        return {
            enabled: true, // Always enabled - users can disable extension if they don't want badges
            midThreshold: midThreshold,
            highThreshold: highThreshold
        };
    }
    
    static getColorThreshold(lineCount: number): ColorThreshold {
        const config = this.getThresholdConfig();
        
        // Badges are always enabled - users disable extension if they don't want them
        if (false) { // Keep the structure but never disable
            return 'normal';
        }
        
        if (lineCount >= config.highThreshold) {
            return 'danger';
        } else if (lineCount >= config.midThreshold) {
            return 'warning';
        } else {
            return 'normal';
        }
    }
    
    static getThemeEmoji(threshold: ColorThreshold): string {
        const customEmojis = this.getCustomEmojis();
        
        switch (threshold) {
            case 'normal':
                return customEmojis.normal;
            case 'warning':
                return customEmojis.warning;
            case 'danger':
                return customEmojis.danger;
        }
    }
    
    static formatLineCountWithEmoji(lineCount: number): { text: string; emoji: string } {
        const threshold = this.getColorThreshold(lineCount);
        const emoji = this.getThemeEmoji(threshold);
        
        let text: string;
        if (lineCount < 1000) {
            text = `${lineCount}L`;
        } else if (lineCount < 1000000) {
            text = `${(lineCount / 1000).toFixed(1)}kL`;
        } else {
            text = `${(lineCount / 1000000).toFixed(1)}ML`;
        }
        
        return { text, emoji };
    }
    
    static getStatusBarText(lineCount: number): { text: string; emoji: string } {
        const threshold = this.getColorThreshold(lineCount);
        const emoji = this.getThemeEmoji(threshold);
        
        let text: string;
        if (lineCount < 1000) {
            text = `${lineCount} lines`;
        } else if (lineCount < 1000000) {
            text = `${(lineCount / 1000).toFixed(1)}k lines`;
        } else {
            text = `${(lineCount / 1000000).toFixed(1)}M lines`;
        }
        
        return { text, emoji };
    }
    
    static createColoredTooltip(fileName: string, lineCount: number, codeLines: number, commentLines: number, blankLines: number, size: number): string {
        const threshold = this.getColorThreshold(lineCount);
        const config = this.getThresholdConfig();
        const emoji = this.getThemeEmoji(threshold);
        
        let thresholdInfo = '';
        if (config.enabled) {
            switch (threshold) {
                case 'normal':
                    thresholdInfo = ` (${emoji} Below ${config.midThreshold} lines)`;
                    break;
                case 'warning':
                    thresholdInfo = ` (${emoji} Above ${config.midThreshold} lines)`;
                    break;
                case 'danger':
                    thresholdInfo = ` (${emoji} Above ${config.highThreshold} lines)`;
                    break;
            }
        }
        
        return `${fileName}${thresholdInfo}\n` +
               `──────────────────\n` +
               `Total Lines: ${lineCount.toLocaleString()}\n` +
               `Code Lines: ${codeLines.toLocaleString()}\n` +
               `Comment Lines: ${commentLines.toLocaleString()}\n` +
               `Blank Lines: ${blankLines.toLocaleString()}\n` +
               `File Size: ${this.formatFileSize(size)}`;
    }
    
    private static formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
}