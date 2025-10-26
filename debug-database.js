const path = require('path');
const fs = require('fs');

// Load the WorkspaceDatabaseService
const { WorkspaceDatabaseService } = require('./out/services/workspaceDatabaseService');

async function debugDatabase() {
    console.log('Testing WorkspaceDatabaseService...\n');
    
    const workspacePath = 'C:\\Users\\jacoo\\vscode-code-counter';
    const dbService = new WorkspaceDatabaseService();
    
    try {
        console.log('1. Getting directory tree from database...');
        const directoryTree = await dbService.getDirectoryTreeFromDatabase(workspacePath);
        
        console.log('Directory tree structure:');
        console.log(JSON.stringify(directoryTree, null, 2));
        
        // Check if hidden directories are in the tree
        const flattenTree = (node, result = []) => {
            result.push(node.path);
            if (node.children) {
                node.children.forEach(child => flattenTree(child, result));
            }
            return result;
        };
        
        const allPaths = flattenTree(directoryTree);
        console.log('\nAll paths in tree:');
        allPaths.forEach(p => {
            const name = path.basename(p);
            const isHidden = name.startsWith('.');
            console.log(`  ${p} ${isHidden ? '(HIDDEN)' : ''}`);
        });
        
        const hiddenPaths = allPaths.filter(p => path.basename(p).startsWith('.'));
        console.log(`\nFound ${hiddenPaths.length} hidden paths in directory tree:`);
        hiddenPaths.forEach(p => console.log(`  ${p}`));
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugDatabase();