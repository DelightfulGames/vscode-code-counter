/**
 * VS Code Code Counter Extension - Core Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

// VS Code API reference
const vscode = acquireVsCodeApi();

// Debug wrapper that sends messages to VS Code extension debugService
const debug = {
    verbose: (...args) => {
        vscode.postMessage({
            command: 'debugLog',
            level: 'verbose',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        });
    },
    info: (...args) => {
        vscode.postMessage({
            command: 'debugLog',
            level: 'info',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        });
    },
    warning: (...args) => {
        vscode.postMessage({
            command: 'debugLog',
            level: 'warning',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        });
    },
    error: (...args) => {
        vscode.postMessage({
            command: 'debugLog',
            level: 'error',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        });
    }
};

//# sourceURL=core.js