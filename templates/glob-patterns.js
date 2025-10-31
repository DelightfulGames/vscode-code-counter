/**
 * VS Code Code Counter Extension - Glob Patterns Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

// Exclusion pattern functions
function addPattern() {
    const input = document.getElementById('newPattern');
    const pattern = input.value.trim();
    if (pattern) {
        // Check if we're in workspace mode
        const currentDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
        const isWorkspaceMode = currentDirectory !== '<global>';
        
        vscode.postMessage({
            command: 'addGlobPattern',
            pattern: pattern,
            currentDirectory: currentDirectory,
            isWorkspaceMode: isWorkspaceMode
        });
        input.value = '';
    }
}

function removePattern(pattern) {
    // Check if we're in workspace mode
    const currentDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
    const isWorkspaceMode = currentDirectory !== '<global>';
    
    vscode.postMessage({
        command: 'removeGlobPattern',
        pattern: pattern,
        currentDirectory: currentDirectory,
        isWorkspaceMode: isWorkspaceMode
    });
}

function resetPatterns() {
    // Check if we're in workspace mode
    const currentDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
    const isWorkspaceMode = currentDirectory !== '<global>';
    
    vscode.postMessage({
        command: 'resetGlobPatterns',
        currentDirectory: currentDirectory,
        isWorkspaceMode: isWorkspaceMode
    });
}

// Inclusion pattern functions
function addIncludePattern() {
    const input = document.getElementById('newIncludePattern');
    const pattern = input.value.trim();
    if (pattern) {
        // Check if we're in workspace mode
        const currentDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
        const isWorkspaceMode = currentDirectory !== '<global>';
        
        vscode.postMessage({
            command: 'addIncludeGlobPattern',
            pattern: pattern,
            currentDirectory: currentDirectory,
            isWorkspaceMode: isWorkspaceMode
        });
        input.value = '';
    }
}

function removeIncludePattern(pattern) {
    // Check if we're in workspace mode
    const currentDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
    const isWorkspaceMode = currentDirectory !== '<global>';
    
    vscode.postMessage({
        command: 'removeIncludeGlobPattern',
        pattern: pattern,
        currentDirectory: currentDirectory,
        isWorkspaceMode: isWorkspaceMode
    });
}

function resetIncludePatterns() {
    // Check if we're in workspace mode
    const currentDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
    const isWorkspaceMode = currentDirectory !== '<global>';
    
    vscode.postMessage({
        command: 'resetIncludeGlobPatterns',
        currentDirectory: currentDirectory,
        isWorkspaceMode: isWorkspaceMode
    });
}

//# sourceURL=glob-patterns.js