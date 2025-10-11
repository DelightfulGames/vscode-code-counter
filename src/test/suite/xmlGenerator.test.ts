import { expect } from 'chai';
import { XmlGeneratorService } from '../../services/xmlGenerator';
import { LineCountResult, FileInfo } from '../../types';

suite('XmlGeneratorService Tests', () => {
    let xmlGenerator: XmlGeneratorService;
    
    suiteSetup(() => {
        xmlGenerator = new XmlGeneratorService();
    });

    test('should generate valid XML with basic data', () => {
        const mockResult: LineCountResult = {
            workspacePath: '/test/workspace',
            totalFiles: 2,
            totalLines: 250,
            generatedAt: new Date('2024-01-01T12:00:00.000Z'),
            languageStats: {
                'JavaScript': { files: 1, lines: 150 },
                'TypeScript': { files: 1, lines: 100 }
            },
            files: [
                {
                    path: '/test/workspace/file1.js',
                    relativePath: 'file1.js',
                    language: 'JavaScript',
                    lines: 150,
                    codeLines: 120,
                    commentLines: 20,
                    blankLines: 10,
                    size: 5000
                },
                {
                    path: '/test/workspace/file2.ts',
                    relativePath: 'file2.ts',
                    language: 'TypeScript',
                    lines: 100,
                    codeLines: 85,
                    commentLines: 10,
                    blankLines: 5,
                    size: 4000
                }
            ]
        };

        const xml = xmlGenerator.generateXml(mockResult);
        
        // Verify XML structure
        expect(xml).to.be.a('string');
        expect(xml).to.include('<codeCounter');
        expect(xml).to.include('</codeCounter>');
        
        // Verify workspace and generation info
        expect(xml).to.include('generatedAt="2024-01-01T12:00:00.000Z"');
        expect(xml).to.include('workspacePath="/test/workspace"');
        
        // Verify summary data
        expect(xml).to.include('<totalFiles>2</totalFiles>');
        expect(xml).to.include('<totalLines>250</totalLines>');
        
        // Verify language stats
        expect(xml).to.include('name="JavaScript"');
        expect(xml).to.include('name="TypeScript"');
        expect(xml).to.include('files="1"');
        expect(xml).to.include('lines="150"');
        expect(xml).to.include('lines="100"');
        
        // Verify file information
        expect(xml).to.include('path="/test/workspace/file1.js"');
        expect(xml).to.include('relativePath="file1.js"');
        expect(xml).to.include('language="JavaScript"');
        expect(xml).to.include('codeLines="120"');
        expect(xml).to.include('commentLines="20"');
        expect(xml).to.include('blankLines="10"');
        expect(xml).to.include('size="5000"');
    });

    test('should handle empty data gracefully', () => {
        const emptyResult: LineCountResult = {
            workspacePath: '/empty/workspace',
            totalFiles: 0,
            totalLines: 0,
            generatedAt: new Date('2024-01-01T12:00:00.000Z'),
            languageStats: {},
            files: []
        };

        const xml = xmlGenerator.generateXml(emptyResult);
        
        expect(xml).to.be.a('string');
        expect(xml).to.include('<codeCounter');
        expect(xml).to.include('</codeCounter>');
        expect(xml).to.include('<totalFiles>0</totalFiles>');
        expect(xml).to.include('<totalLines>0</totalLines>');
        expect(xml).to.include('workspacePath="/empty/workspace"');
        
        // Should handle empty arrays/objects
        expect(xml).to.include('<languageStats');
        expect(xml).to.include('<files');
    });

    test('should properly escape special characters in XML', () => {
        const specialCharsResult: LineCountResult = {
            workspacePath: '/workspace with spaces & symbols',
            totalFiles: 1,
            totalLines: 50,
            generatedAt: new Date('2024-01-01T12:00:00.000Z'),
            languageStats: {
                'C++': { files: 1, lines: 50 }
            },
            files: [
                {
                    path: '/workspace/file with <special> & "chars".cpp',
                    relativePath: 'file with <special> & "chars".cpp',
                    language: 'C++',
                    lines: 50,
                    codeLines: 40,
                    commentLines: 5,
                    blankLines: 5,
                    size: 2000
                }
            ]
        };

        const xml = xmlGenerator.generateXml(specialCharsResult);
        
        expect(xml).to.be.a('string');
        expect(xml).to.include('<codeCounter');
        
        // XML should properly escape special characters
        expect(xml).to.include('&amp;'); // & should be escaped
        expect(xml).to.include('&lt;'); // < should be escaped  
        expect(xml).to.include('&gt;'); // > should be escaped
        expect(xml).to.include('&quot;'); // " should be escaped
        
        // Should include the language name
        expect(xml).to.include('C++');
    });

    test('should generate valid XML with multiple languages', () => {
        const multiLangResult: LineCountResult = {
            workspacePath: '/multi/lang/project',
            totalFiles: 5,
            totalLines: 1000,
            generatedAt: new Date('2024-01-01T12:00:00.000Z'),
            languageStats: {
                'JavaScript': { files: 2, lines: 400 },
                'TypeScript': { files: 1, lines: 300 },
                'CSS': { files: 1, lines: 200 },
                'HTML': { files: 1, lines: 100 }
            },
            files: [
                {
                    path: '/multi/lang/project/app.js',
                    relativePath: 'app.js',
                    language: 'JavaScript',
                    lines: 200,
                    codeLines: 160,
                    commentLines: 30,
                    blankLines: 10,
                    size: 8000
                },
                {
                    path: '/multi/lang/project/utils.js',
                    relativePath: 'utils.js',
                    language: 'JavaScript',
                    lines: 200,
                    codeLines: 170,
                    commentLines: 20,
                    blankLines: 10,
                    size: 7500
                }
            ]
        };

        const xml = xmlGenerator.generateXml(multiLangResult);
        
        // Should include all languages
        expect(xml).to.include('name="JavaScript"');
        expect(xml).to.include('name="TypeScript"');
        expect(xml).to.include('name="CSS"');
        expect(xml).to.include('name="HTML"');
        
        // Should have correct totals
        expect(xml).to.include('<totalFiles>5</totalFiles>');
        expect(xml).to.include('<totalLines>1000</totalLines>');
        
        // Should include language stats
        expect(xml).to.include('files="2"'); // JavaScript
        expect(xml).to.include('lines="400"'); // JavaScript
    });

    test('should handle files with zero values correctly', () => {
        const zeroValuesResult: LineCountResult = {
            workspacePath: '/test',
            totalFiles: 1,
            totalLines: 0,
            generatedAt: new Date('2024-01-01T12:00:00.000Z'),
            languageStats: {
                'Empty': { files: 1, lines: 0 }
            },
            files: [
                {
                    path: '/test/empty.txt',
                    relativePath: 'empty.txt',
                    language: 'Text',
                    lines: 0,
                    codeLines: 0,
                    commentLines: 0,
                    blankLines: 0,
                    size: 0
                }
            ]
        };

        const xml = xmlGenerator.generateXml(zeroValuesResult);
        
        expect(xml).to.include('lines="0"');
        expect(xml).to.include('codeLines="0"');
        expect(xml).to.include('commentLines="0"');
        expect(xml).to.include('blankLines="0"');
        expect(xml).to.include('size="0"');
    });

    test('should format XML with proper indentation', () => {
        const simpleResult: LineCountResult = {
            workspacePath: '/test',
            totalFiles: 1,
            totalLines: 10,
            generatedAt: new Date('2024-01-01T12:00:00.000Z'),
            languageStats: {
                'JavaScript': { files: 1, lines: 10 }
            },
            files: [
                {
                    path: '/test/simple.js',
                    relativePath: 'simple.js',
                    language: 'JavaScript',
                    lines: 10,
                    codeLines: 8,
                    commentLines: 1,
                    blankLines: 1,
                    size: 500
                }
            ]
        };

        const xml = xmlGenerator.generateXml(simpleResult);
        
        // Should be formatted with proper line breaks and indentation
        expect(xml).to.include('\n');
        expect(xml).to.include('  '); // Should have 2-space indentation
        
        // Should have nested structure
        const lines = xml.split('\n');
        expect(lines.length).to.be.greaterThan(5); // Should be multi-line
    });

    test('should handle various file extensions and languages', () => {
        const diverseResult: LineCountResult = {
            workspacePath: '/diverse',
            totalFiles: 6,
            totalLines: 600,
            generatedAt: new Date('2024-01-01T12:00:00.000Z'),
            languageStats: {
                'Python': { files: 1, lines: 100 },
                'Java': { files: 1, lines: 100 },
                'C#': { files: 1, lines: 100 },
                'Go': { files: 1, lines: 100 },
                'Rust': { files: 1, lines: 100 },
                'Swift': { files: 1, lines: 100 }
            },
            files: [
                {
                    path: '/diverse/script.py',
                    relativePath: 'script.py',
                    language: 'Python',
                    lines: 100,
                    codeLines: 80,
                    commentLines: 15,
                    blankLines: 5,
                    size: 3000
                },
                {
                    path: '/diverse/Main.java',
                    relativePath: 'Main.java',
                    language: 'Java',
                    lines: 100,
                    codeLines: 85,
                    commentLines: 10,
                    blankLines: 5,
                    size: 3500
                }
            ]
        };

        const xml = xmlGenerator.generateXml(diverseResult);
        
        // Should handle all language names correctly
        expect(xml).to.include('name="Python"');
        expect(xml).to.include('name="Java"');
        expect(xml).to.include('name="C#"');
        expect(xml).to.include('name="Go"');
        expect(xml).to.include('name="Rust"');
        expect(xml).to.include('name="Swift"');
        
        // Should handle file extensions
        expect(xml).to.include('script.py');
        expect(xml).to.include('Main.java');
    });
});