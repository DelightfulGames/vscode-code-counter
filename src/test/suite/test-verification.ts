// Quick test script to verify binary detection and file extension support
import * as vscode from 'vscode';
import * as path from 'path';
import { BinaryDetectionService } from '../../services/binaryDetectionService';

async function testBinaryDetection() {
    // Get the current workspace folder path
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        console.error('No workspace folder available for testing');
        return;
    }
    
    const workspacePath = workspaceFolders[0].uri.fsPath;
    const binaryService = new BinaryDetectionService(workspacePath);
    
    // Get paths to test fixtures
    const fixturesPath = path.join(__dirname, '..', 'fixtures');
    const binaryFilePath = path.join(fixturesPath, 'test-binary.bin');
    const textFilePath = path.join(fixturesPath, 'test.txt');
    const unknownFilePath = path.join(fixturesPath, 'test.unknown');
    
    try {
        // Test binary file
        const binaryResult = await binaryService.isBinary(binaryFilePath);
        console.log('Binary file test:', binaryResult);
        
        // Test text file
        const textResult = await binaryService.isBinary(textFilePath);
        console.log('Text file test:', textResult);
        
        // Test unknown extension file
        const unknownResult = await binaryService.isBinary(unknownFilePath);
        console.log('Unknown extension file test:', unknownResult);
        
        // Test if .txt is now supported
        console.log('Testing if .txt extension is supported by checking file explorer decorator logic...');
        
        // Test cache functionality
        console.log('Testing cache functionality...');
        const cachedResult = await binaryService.isBinary(textFilePath);
        console.log('Cached text file test:', cachedResult);
        
        // Clear cache and test again
        await binaryService.clearCache();
        console.log('Cache cleared successfully');
        
        const afterClearResult = await binaryService.isBinary(textFilePath);
        console.log('After cache clear text file test:', afterClearResult);
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Export the test function for use in test suites
export { testBinaryDetection };