// Quick test script to validate debug webview functionality
// This can be run manually to check if the file logging integration works

const vscode = require('vscode');
const { DebugService } = require('./out/services/debugService');

async function testDebugWebview() {
    console.log('Testing Debug Service webview integration...');
    
    // Test 1: Configure debug service to file
    const debugService = DebugService.getInstance();
    debugService.configure('file');
    
    // Test 2: Check if log file path is available
    const logFilePath = debugService.getLogFilePath();
    console.log('Log file path:', logFilePath);
    
    // Test 3: Write a test log entry
    debugService.verbose('Test log entry for webview validation');
    
    console.log('Test completed. Check if file exists at:', logFilePath);
}

// Export for potential use
module.exports = { testDebugWebview };