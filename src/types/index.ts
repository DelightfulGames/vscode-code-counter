export interface FileInfo {
    path: string;
    relativePath: string;
    language: string;
    lines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
    size: number;
}

export interface LineCountResult {
    workspacePath: string;
    totalFiles: number;
    totalLines: number;
    files: FileInfo[];
    languageStats: { [language: string]: { files: number; lines: number } };
    generatedAt: Date;
}

export interface ReportConfig {
    excludePatterns: string[];
    outputDirectory: string;
    autoGenerate: boolean;
}