import * as glob from 'glob';
import * as path from 'path';

export function getExcludedFiles(baseDir: string, exclusions: string[]): string[] {
    const excludedFiles: string[] = [];

    exclusions.forEach((exclusion) => {
        const pattern = path.join(baseDir, exclusion);
        const matches = glob.sync(pattern);
        excludedFiles.push(...matches);
    });

    return excludedFiles;
}

export function getIncludedFiles(baseDir: string, pattern: string, exclusions: string[]): string[] {
    const allFiles = glob.sync(path.join(baseDir, pattern));
    const excludedFiles = getExcludedFiles(baseDir, exclusions);

    return allFiles.filter(file => !excludedFiles.includes(file));
}