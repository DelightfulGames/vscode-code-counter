/**
 * Test setup that installs VS Code mocks before running tests
 * This allows tests to run with coverage outside of the VS Code environment
 */

// Install the VS Code mock before any modules are loaded
import { mockVSCode } from './mocks/vscode-mock';

// Install as a Node.js module that can be required
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
    if (id === 'vscode') {
        return mockVSCode;
    }
    return originalRequire.apply(this, arguments);
};

// Also install globally for dynamic imports
(global as any).vscode = mockVSCode;

console.log('✅ VS Code mock installed for testing');

export { mockVSCode };