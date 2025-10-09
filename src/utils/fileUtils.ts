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