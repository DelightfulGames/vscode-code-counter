import { XMLBuilder } from 'fast-xml-parser';
import { LineCountResult, FileInfo } from '../types';

export class XmlGeneratorService {
    
    generateXml(result: LineCountResult): string {
        const xmlData = {
            codeCounter: {
                '@_generatedAt': result.generatedAt.toISOString(),
                '@_workspacePath': result.workspacePath,
                summary: {
                    totalFiles: result.totalFiles,
                    totalLines: result.totalLines
                },
                languageStats: {
                    language: Object.entries(result.languageStats).map(([name, stats]) => ({
                        '@_name': name,
                        '@_files': stats.files,
                        '@_lines': stats.lines
                    }))
                },
                files: {
                    file: result.files.map(file => this.convertFileToXml(file))
                }
            }
        };

        const builder = new XMLBuilder({
            attributeNamePrefix: '@_',
            ignoreAttributes: false,
            format: true,
            indentBy: '  '
        });

        return builder.build(xmlData);
    }

    private convertFileToXml(file: FileInfo) {
        const fileName = require('path').basename(file.relativePath);
        const directory = require('path').dirname(file.relativePath);
        
        return {
            '@_path': file.path,
            '@_relativePath': file.relativePath,
            '@_fullPath': file.fullPath || file.relativePath,
            '@_fileName': fileName,
            '@_directory': directory === '.' ? '' : directory,
            '@_language': file.language,
            '@_lines': file.lines,
            '@_codeLines': file.codeLines,
            '@_commentLines': file.commentLines,
            '@_blankLines': file.blankLines,
            '@_size': file.size
        };
    }
}