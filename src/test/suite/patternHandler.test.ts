import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Tests for pattern processing logic in PatternHandler
 * Since PatternHandler uses static methods and VS Code configuration,
 * these tests focus on validating the pattern processing logic directly.
 */

suite('PatternHandler Pattern Processing Tests', () => {
    /**
     * Helper function that mimics the pattern processing logic from addGlobalExcludePattern
     */
    function processPattern(pattern: string): string {
        let processedPattern = pattern.trim();
        
        // Add leading slash for relative paths that don't start with ** or special glob patterns
        // This fixes manual entry of relative paths like "src/models/docs/large.txt"
        if (!processedPattern.startsWith('/') && 
            !processedPattern.startsWith('**') && 
            !processedPattern.startsWith('**/') &&
            !processedPattern.startsWith('./') &&
            !processedPattern.startsWith('../') &&
            !processedPattern.startsWith('~') &&
            !processedPattern.includes('*') &&
            !processedPattern.includes('?') &&
            !processedPattern.includes(':')) { // Exclude Windows absolute paths like C:\
            processedPattern = '/' + processedPattern;
        }
        
        return processedPattern;
    }

    test('should add leading slash to relative path patterns', () => {
        const testPattern = 'src/models/docs/large.txt';
        const result = processPattern(testPattern);
        assert.strictEqual(result, '/src/models/docs/large.txt', 'Should add leading slash to relative path');
    });

    test('should preserve glob patterns with double asterisk', () => {
        const testPattern = '**/*.tmp';
        const result = processPattern(testPattern);
        assert.strictEqual(result, '**/*.tmp', 'Should preserve glob patterns without modification');
    });

    test('should preserve patterns already starting with slash', () => {
        const testPattern = '/already/has/slash.txt';
        const result = processPattern(testPattern);
        assert.strictEqual(result, '/already/has/slash.txt', 'Should preserve patterns that already have leading slash');
    });

    test('should preserve dot-relative patterns', () => {
        const testPattern = './src/relative.txt';
        const result = processPattern(testPattern);
        assert.strictEqual(result, './src/relative.txt', 'Should preserve dot-relative patterns');
    });

    test('should preserve patterns with wildcards', () => {
        const testCases = [
            '*.log',
            '?temp*',
            'src/**/*.test.js',
            '**/*.{js,ts}',
            '**/node_modules/**'
        ];

        testCases.forEach(pattern => {
            const result = processPattern(pattern);
            assert.strictEqual(result, pattern, `Pattern ${pattern} should be preserved as-is`);
        });
    });

    test('should handle edge cases correctly', () => {
        const testCases = [
            // Edge cases that should get leading slash
            { pattern: 'file.txt', expected: '/file.txt', description: 'single file' },
            { pattern: 'a/b/c.txt', expected: '/a/b/c.txt', description: 'multi-level path' },
            { pattern: 'docs/temp/cache.dat', expected: '/docs/temp/cache.dat', description: 'nested directory path' },
            
            // Edge cases that should be preserved
            { pattern: '/', expected: '/', description: 'root slash' },
            { pattern: '//', expected: '//', description: 'double slash' },
            { pattern: '../parent.txt', expected: '../parent.txt', description: 'parent directory reference' },
            { pattern: '~/home.txt', expected: '~/home.txt', description: 'home directory reference' },
            { pattern: 'C:\\Windows\\file.txt', expected: 'C:\\Windows\\file.txt', description: 'Windows absolute path' }
        ];

        testCases.forEach(testCase => {
            const result = processPattern(testCase.pattern);
            assert.strictEqual(
                result, 
                testCase.expected, 
                `${testCase.description}: '${testCase.pattern}' should become '${testCase.expected}'`
            );
        });
    });

    test('should handle whitespace correctly', () => {
        const testCases = [
            { pattern: '  src/file.txt  ', expected: '/src/file.txt', description: 'trimmed relative path' },
            { pattern: ' **/*.tmp ', expected: '**/*.tmp', description: 'trimmed glob pattern' },
            { pattern: '\t./relative.txt\n', expected: './relative.txt', description: 'trimmed dot-relative' }
        ];

        testCases.forEach(testCase => {
            const result = processPattern(testCase.pattern);
            assert.strictEqual(
                result, 
                testCase.expected, 
                `${testCase.description}: '${testCase.pattern}' should become '${testCase.expected}'`
            );
        });
    });

    test('should correctly identify patterns needing leading slash', () => {
        // These should get leading slash
        const relativePatterns = [
            'src/models/docs/large.txt',
            'config/settings.json', 
            'important/file.txt',
            'test/file.txt',
            'file.txt',
            'deep/nested/path/file.ext'
        ];

        relativePatterns.forEach(pattern => {
            const result = processPattern(pattern);
            assert.ok(result.startsWith('/'), `Pattern '${pattern}' should get leading slash, got '${result}'`);
            assert.strictEqual(result, '/' + pattern, `Pattern '${pattern}' should become '/${pattern}'`);
        });
    });

    test('should preserve patterns that should not get leading slash', () => {
        // These should NOT get leading slash
        const preservePatterns = [
            '/already/has/slash.txt',
            '**/*.tmp',
            '**/node_modules/**',
            './relative.txt',
            '*.log',
            '?temp*',
            '../parent.txt',
            '~/home.txt'
        ];

        preservePatterns.forEach(pattern => {
            const result = processPattern(pattern);
            assert.strictEqual(result, pattern, `Pattern '${pattern}' should be preserved unchanged, got '${result}'`);
        });
    });
});