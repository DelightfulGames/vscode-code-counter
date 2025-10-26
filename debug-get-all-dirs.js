// Debug script to test getAllWorkspaceDirectories function
const fs = require('fs');
const path = require('path');

// Copy of the getAllWorkspaceDirectories function logic to test
async function testGetAllWorkspaceDirectories(workspacePath) {
    const directories = [workspacePath]; // Include workspace root
    
    async function scanDirectory(dirPath, depth = 0) {
        // Limit recursion depth to prevent infinite loops and performance issues
        if (depth > 4) return;
        
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            
            console.log(`\nScanning depth ${depth}: ${dirPath}`);
            console.log('Found entries:', entries.filter(e => e.isDirectory()).map(e => e.name));
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Skip common system directories that shouldn't be in settings
                    const skipDirs = [
                        'node_modules', '.git', 'out', 'dist', 'build', 
                        '.next', 'coverage', '.nyc_output', '.cache', 'tmp', 'temp'
                    ];
                    
                    const isSkipped = skipDirs.includes(entry.name);
                    const isHidden = entry.name.startsWith('.');
                    
                    console.log(`  ${entry.name}: ${isSkipped ? 'SKIPPED' : 'INCLUDED'}${isHidden ? ' (hidden)' : ''}`);
                    
                    if (!isSkipped) {
                        const subDirPath = path.join(dirPath, entry.name);
                        directories.push(subDirPath);
                        
                        // Recursively scan subdirectories
                        await scanDirectory(subDirPath, depth + 1);
                    }
                }
            }
        } catch (error) {
            console.log(`Could not scan directory ${dirPath}:`, error.message);
        }
    }
    
    await scanDirectory(workspacePath);
    return directories;
}

// Test with current workspace
async function runTest() {
    const workspacePath = process.cwd();
    console.log('Testing getAllWorkspaceDirectories with:', workspacePath);
    
    const directories = await testGetAllWorkspaceDirectories(workspacePath);
    
    console.log('\n=== FINAL RESULTS ===');
    console.log('Total directories found:', directories.length);
    
    const hiddenDirs = directories.filter(dir => {
        const basename = path.basename(dir);
        return basename.startsWith('.');
    });
    
    console.log('Hidden directories found:', hiddenDirs.length);
    if (hiddenDirs.length > 0) {
        console.log('Hidden directories:', hiddenDirs.map(dir => path.basename(dir)));
    }
}

runTest();