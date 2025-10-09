export function readFileContents(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const fs = require('fs');
        fs.readFile(filePath, 'utf8', (err: NodeJS.ErrnoException | null, data: string) => {
            if (err) {
                return reject(err);
            }
            resolve(data);
        });
    });
}

export function isFileType(filePath: string, extension: string): boolean {
    return filePath.endsWith(extension);
}

export function getFileName(filePath: string): string {
    return filePath.split('/').pop() || '';
}

export function getFileSize(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const fs = require('fs');
        fs.stat(filePath, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
            if (err) {
                return reject(err);
            }
            resolve(stats.size);
        });
    });
}