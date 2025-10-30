const { minimatch } = require('minimatch');

const minimatchOptions = {
    dot: true,
    nocase: false,
    flipNegate: false,
    nobrace: false,
    noglobstar: false,
    noext: false,
    nonull: false,
    windowsPathsNoEscape: true
};

const defaultExcludePatterns = [
    "**/node_modules/**",
    "**/out/**", 
    "**/bin/**",
    "**/dist/**",
    "**/.git/**",
    "**/.*/**",
    "**/.*",
    "**/**-lock.json"
];

const testFiles = [
    'node_modules/express/index.js',
    'out/extension.js',
    '.git/config',
    '.github/workflows/ci.yml', 
    '.vscode/settings.json',
    'package-lock.json',
    'src/extension.ts',
    'README.md',
    'coverage/index.html',
    '.eslintrc.json',
    '.gitignore'
];

console.log('Testing minimatch patterns...\n');

for (const testFile of testFiles) {
    console.log(`Testing: ${testFile}`);
    
    for (const pattern of defaultExcludePatterns) {
        const matches = minimatch(testFile, pattern, minimatchOptions);
        if (matches) {
            console.log(`  ✓ EXCLUDED by pattern: ${pattern}`);
            break;
        }
    }
    
    const isExcluded = defaultExcludePatterns.some(pattern => minimatch(testFile, pattern, minimatchOptions));
    console.log(`  Final result: ${isExcluded ? 'EXCLUDED' : 'INCLUDED'}`);
    console.log('');
}