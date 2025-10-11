// Isolated test runner for coverage without VS Code dependencies
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a temporary test that only tests VS Code-independent modules
const testContent = `
const assert = require('assert');
const { GlobUtils } = require('../out/utils/globUtils');
// Note: Can't test other modules that depend on 'vscode' module without mocking

suite('Coverage Test - VS Code Independent Modules', () => {
    test('GlobUtils basic functionality', () => {
        assert.strictEqual(GlobUtils.matchesPattern('test.js', '*.js'), true);
        assert.strictEqual(GlobUtils.matchesPattern('test.ts', '*.js'), false);
    });
});
`;

// Write temporary test file
fs.writeFileSync('out/test/suite/coverage-isolated.test.js', testContent);

try {
    // Run coverage on just the isolated testable modules
    const result = execSync('npx c8 --reporter=text --reporter=json --include="out/utils/**" --include="out/services/lineCounter.js" --exclude="**/*.test.js" npx mocha out/test/suite/coverage-isolated.test.js --ui tdd', { 
        encoding: 'utf8',
        stdio: 'pipe'
    });
    console.log(result);
    
    // Read and display coverage summary
    if (fs.existsSync('coverage/coverage-summary.json')) {
        const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
        console.log('\n=== COVERAGE SUMMARY ===');
        console.log(JSON.stringify(summary, null, 2));
    }
} catch (error) {
    console.error('Coverage run failed:', error.message);
} finally {
    // Cleanup
    if (fs.existsSync('out/test/suite/coverage-isolated.test.js')) {
        fs.unlinkSync('out/test/suite/coverage-isolated.test.js');
    }
}