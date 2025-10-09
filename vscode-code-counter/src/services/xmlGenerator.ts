export class XmlGenerator {
    private xmlData: string;

    constructor() {
        this.xmlData = '<?xml version="1.0" encoding="UTF-8"?>\n<project>\n</project>';
    }

    public addFileData(fileName: string, lineCount: number): void {
        const fileEntry = `<file>\n\t<name>${fileName}</name>\n\t<lines>${lineCount}</lines>\n</file>\n`;
        this.xmlData = this.xmlData.replace('</project>', `${fileEntry}</project>`);
    }

    public getXml(): string {
        return this.xmlData;
    }

    public saveToFile(filePath: string): void {
        const fs = require('fs');
        fs.writeFileSync(filePath, this.xmlData, 'utf8');
    }
}