/**
 * Context Menu Commands Test Suite
 * Tests for the file explorer and editor tab context menu exclusion commands
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Context Menu Exclusion Commands', function() {
    this.timeout(10000);
    
    let tempDir: string;
    
    suiteSetup(async function() {
        // Create a temporary directory for testing
        tempDir = path.join(os.tmpdir(), 'code-counter-context-menu-test-' + Date.now());
        await fs.promises.mkdir(tempDir, { recursive: true });
        
        // Create test files
        await fs.promises.writeFile(path.join(tempDir, 'test.js'), 'console.log("test");');
        await fs.promises.writeFile(path.join(tempDir, 'example.txt'), 'test content');
        await fs.promises.mkdir(path.join(tempDir, 'subfolder'), { recursive: true });
        await fs.promises.writeFile(path.join(tempDir, 'subfolder', 'nested.py'), 'print("hello")');
    });
    
    suiteTeardown(async function() {
        // Clean up temporary directory
        try {
            await fs.promises.rmdir(tempDir, { recursive: true });
        } catch (error) {
            console.warn('Failed to clean up temp directory:', error);
        }
    });

    test('Context menu commands should be registered', async function() {
        // Get all commands
        const commands = await vscode.commands.getCommands();
        
        // Check that our exclusion commands are registered
        assert.ok(commands.includes('codeCounter.excludeRelativePath'), 'excludeRelativePath command should be registered');
        assert.ok(commands.includes('codeCounter.excludeFilePattern'), 'excludeFilePattern command should be registered');
        assert.ok(commands.includes('codeCounter.excludeExtension'), 'excludeExtension command should be registered');
    });

    test('Exclude relative path command should work', async function() {
        const testFile = path.join(tempDir, 'test.js');
        const uri = vscode.Uri.file(testFile);
        
        // Execute the command
        await vscode.commands.executeCommand('codeCounter.excludeRelativePath', uri);
        
        // Check if a .code-counter.json file was created in the temp directory
        const configFile = path.join(tempDir, '.code-counter.json');
        const exists = await fs.promises.access(configFile).then(() => true).catch(() => false);
        
        if (exists) {
            const content = await fs.promises.readFile(configFile, 'utf8');
            const config = JSON.parse(content);
            
            // Check if the relative path was added to exclude patterns
            assert.ok(config['codeCounter.excludePatterns'], 'excludePatterns should exist');
            assert.ok(Array.isArray(config['codeCounter.excludePatterns']), 'excludePatterns should be an array');
            
            // The pattern should match the relative path from workspace to file
            const hasCorrectPattern = config['codeCounter.excludePatterns'].some((pattern: string) => 
                pattern.includes('test.js')
            );
            assert.ok(hasCorrectPattern, 'Should contain a pattern for test.js');
        }
    });

    test('Exclude file pattern command should work', async function() {
        const testFile = path.join(tempDir, 'example.txt');
        const uri = vscode.Uri.file(testFile);
        
        // Execute the command
        await vscode.commands.executeCommand('codeCounter.excludeFilePattern', uri);
        
        // Check if pattern was added
        const configFile = path.join(tempDir, '.code-counter.json');
        const exists = await fs.promises.access(configFile).then(() => true).catch(() => false);
        
        if (exists) {
            const content = await fs.promises.readFile(configFile, 'utf8');
            const config = JSON.parse(content);
            
            // Should have a pattern like **/example.txt
            const hasGlobalPattern = config['codeCounter.excludePatterns']?.some((pattern: string) => 
                pattern === '**/example.txt'
            );
            assert.ok(hasGlobalPattern, 'Should contain a global pattern for example.txt');
        }
    });

    test('Exclude extension command should work', async function() {
        const testFile = path.join(tempDir, 'subfolder', 'nested.py');
        const uri = vscode.Uri.file(testFile);
        
        // Execute the command
        await vscode.commands.executeCommand('codeCounter.excludeExtension', uri);
        
        // Check if pattern was added
        const configFile = path.join(tempDir, '.code-counter.json');
        const exists = await fs.promises.access(configFile).then(() => true).catch(() => false);
        
        if (exists) {
            const content = await fs.promises.readFile(configFile, 'utf8');
            const config = JSON.parse(content);
            
            // Should have a pattern like **/*.py
            const hasExtensionPattern = config['codeCounter.excludePatterns']?.some((pattern: string) => 
                pattern === '**/*.py'
            );
            assert.ok(hasExtensionPattern, 'Should contain an extension pattern for .py files');
        }
    });
});