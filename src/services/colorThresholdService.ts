import * as vscode from 'vscode';

export type ColorThreshold = 'normal' | 'warning' | 'danger';

export interface ColorThresholdConfig {
    enabled: boolean;
    yellowThreshold: number;
    redThreshold: number;
}

export interface CustomColors {
    normal: string;
    warning: string;
    danger: string;
}

export class ColorThresholdService {
    
    static getCustomColors(): CustomColors {
        const config = vscode.workspace.getConfiguration('codeCounter.colors');
        return {
            normal: config.get<string>('normal', '#4CAF50'),
            warning: config.get<string>('warning', '#FFC107'),
            danger: config.get<string>('danger', '#F44336')
        };
    }
    
    static getThresholdConfig(): ColorThresholdConfig {
        const config = vscode.workspace.getConfiguration('codeCounter.colorThresholds');
        
        let yellowThreshold = config.get<number>('yellowThreshold', 300);
        let redThreshold = config.get<number>('redThreshold', 1000);
        
        // Ensure red threshold is higher than yellow threshold
        if (redThreshold <= yellowThreshold) {
            redThreshold = yellowThreshold + 100;
            console.warn(`Red threshold (${config.get('redThreshold')}) must be higher than yellow threshold (${yellowThreshold}). Using ${redThreshold} instead.`);
        }
        
        return {
            enabled: config.get<boolean>('enabled', true),
            yellowThreshold,
            redThreshold
        };
    }
    
    static getColorThreshold(lineCount: number): ColorThreshold {
        const config = this.getThresholdConfig();
        
        if (!config.enabled) {
            return 'normal';
        }
        
        if (lineCount >= config.redThreshold) {
            return 'danger';
        } else if (lineCount >= config.yellowThreshold) {
            return 'warning';
        } else {
            return 'normal';
        }
    }
    
    static getThemeColor(threshold: ColorThreshold): vscode.ThemeColor | string {
        const customColors = this.getCustomColors();
        
        // Check if custom colors are set (not defaults), if so use them directly
        const isCustomColor = (color: string, defaultColor: string) => color !== defaultColor;
        
        switch (threshold) {
            case 'normal':
                if (isCustomColor(customColors.normal, '#4CAF50')) {
                    return customColors.normal;
                }
                return new vscode.ThemeColor('codeCounter.lineCount.normal');
            case 'warning':
                if (isCustomColor(customColors.warning, '#FFC107')) {
                    return customColors.warning;
                }
                return new vscode.ThemeColor('codeCounter.lineCount.warning');
            case 'danger':
                if (isCustomColor(customColors.danger, '#F44336')) {
                    return customColors.danger;
                }
                return new vscode.ThemeColor('codeCounter.lineCount.danger');
        }
    }
    
    static formatLineCountWithColor(lineCount: number): { text: string; color: vscode.ThemeColor | string } {
        const threshold = this.getColorThreshold(lineCount);
        const color = this.getThemeColor(threshold);
        
        let text: string;
        if (lineCount < 1000) {
            text = `${lineCount}L`;
        } else if (lineCount < 1000000) {
            text = `${(lineCount / 1000).toFixed(1)}kL`;
        } else {
            text = `${(lineCount / 1000000).toFixed(1)}ML`;
        }
        
        return { text, color };
    }
    
    static getStatusBarText(lineCount: number): { text: string; color: vscode.ThemeColor | string } {
        const threshold = this.getColorThreshold(lineCount);
        const color = this.getThemeColor(threshold);
        
        let text: string;
        if (lineCount < 1000) {
            text = `${lineCount} lines`;
        } else if (lineCount < 1000000) {
            text = `${(lineCount / 1000).toFixed(1)}k lines`;
        } else {
            text = `${(lineCount / 1000000).toFixed(1)}M lines`;
        }
        
        return { text, color };
    }
    
    static createColoredTooltip(fileName: string, lineCount: number, codeLines: number, commentLines: number, blankLines: number, size: number): string {
        const threshold = this.getColorThreshold(lineCount);
        const config = this.getThresholdConfig();
        
        let thresholdInfo = '';
        if (config.enabled) {
            switch (threshold) {
                case 'normal':
                    thresholdInfo = ` (✅ Below ${config.yellowThreshold} lines)`;
                    break;
                case 'warning':
                    thresholdInfo = ` (⚠️ Above ${config.yellowThreshold} lines)`;
                    break;
                case 'danger':
                    thresholdInfo = ` (🚨 Above ${config.redThreshold} lines)`;
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