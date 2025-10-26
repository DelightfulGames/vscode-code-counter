// Quick test to debug hidden directory scanning
const fs = require('fs');
const path = require('path');

// Simulate the directory scanning logic
async function testDirectoryScanning() {
    console.log('Testing directory scanning logic...');
    
    // Get current workspace directory
    const workspacePath = process.cwd();
    console.log('Workspace path:', workspacePath);
    
    // Read directory entries
    try {
        const entries = await fs.promises.readdir(workspacePath, { withFileTypes: true });
        
        console.log('\nAll directory entries:');
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const isHidden = entry.name.startsWith('.');
                console.log(`${isHidden ? '🔍' : '📂'} ${entry.name}${isHidden ? ' (HIDDEN)' : ''}`);
            }
        }
        
        // Apply current skip logic from workspaceSettingsService
        const skipDirs = ['node_modules', '.git', 'coverage'];
        
        console.log('\nAfter applying skip filter:');
        const filteredEntries = [];
        for (const entry of entries) {
            if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
                const isHidden = entry.name.startsWith('.');
                console.log(`${isHidden ? '🔍' : '📂'} ${entry.name}${isHidden ? ' (HIDDEN)' : ''}`);
                filteredEntries.push(entry.name);
            }
        }
        
        const hasHiddenAfterFilter = filteredEntries.some(name => name.startsWith('.'));
        console.log(`\nHidden directories after filter: ${hasHiddenAfterFilter ? 'YES' : 'NO'}`);
        
        if (hasHiddenAfterFilter) {
            const hiddenDirs = filteredEntries.filter(name => name.startsWith('.'));
            console.log('Hidden directories found:', hiddenDirs);
        }
        
    } catch (error) {
        console.error('Error reading directory:', error);
    }
}

testDirectoryScanning();