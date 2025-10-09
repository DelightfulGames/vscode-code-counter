export interface FileData {
    filePath: string;
    lineCount: number;
}

export interface LineCount {
    totalLines: number;
    countedFiles: FileData[];
}