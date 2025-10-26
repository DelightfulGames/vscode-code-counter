// Simple test to check what directories are being found by getAllWorkspaceDirectories in extension.ts
const path = require('path');
const fs = require('fs').promises;

async function getAllWorkspaceDirectories(workspacePath) {
    const directories = [workspacePath]; // Include workspace root
    
    async function scanDirectory(dirPath, depth = 0) {
        // Limit recursion depth to prevent infinite loops and performance issues
        if (depth > 4) return;
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Skip common system directories that shouldn't be in settings
                    const skipDirs = [
                        'node_modules', '.git', 'out', 'dist', 'build', 
                        '.next', 'coverage', '.nyc_output', '.cache', 'tmp', 'temp'
                    ];
                    
                    if (skipDirs.includes(entry.name)) {
                        console.log(`  ${entry.name}: SKIPPED (in skip list)`);
                        continue;
                    }
                    
                    console.log(`  ${entry.name}: INCLUDED ${entry.name.startsWith('.') ? '(hidden)' : ''}`);
                    
                    const subDirPath = path.join(dirPath, entry.name);
                    directories.push(subDirPath);
                    
                    // Recursively scan subdirectories
                    await scanDirectory(subDirPath, depth + 1);
                }
            }
        } catch (error) {
            // Silently skip directories we can't read
            console.log(`Could not scan directory ${dirPath}:`, error.message);
        }
    }
    
    await scanDirectory(workspacePath);
    return directories;
}

async function testDirectories() {
    const workspacePath = 'C:\\Users\\jacoo\\vscode-code-counter';
    console.log('Testing getAllWorkspaceDirectories function from extension.ts...\n');
    
    const directories = await getAllWorkspaceDirectories(workspacePath);
    
    console.log(`\nTotal directories found: ${directories.length}`);
    
    const hiddenDirs = directories.filter(dir => {
        const name = path.basename(dir);
        return name.startsWith('.');
    });
    
    console.log(`Hidden directories found: ${hiddenDirs.length}`);
    hiddenDirs.forEach(dir => {
        console.log(`  ${dir}`);
    });
    
    // Check specifically for the expected hidden directories
    const expectedHidden = ['.github', '.vscode', '.vscode-test'];
    expectedHidden.forEach(name => {
        const found = directories.some(dir => path.basename(dir) === name);
        console.log(`${name}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    });
}

testDirectories();