import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorkspaceDatabaseService } from '../../services/workspaceDatabaseService';
import { LineCounterService } from '../../services/lineCounter';

suite('Inclusion Patterns Tests', () => {
    let tempWorkspace: string;
    let service: WorkspaceDatabaseService;
    let lineCounter: LineCounterService;

    setup(async () => {
        // Create a temporary workspace
        tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'code-counter-test-'));
        service = new WorkspaceDatabaseService(tempWorkspace);
        lineCounter = new LineCounterService();
        
        // Create test directory structure
        await fs.promises.mkdir(path.join(tempWorkspace, 'src'), { recursive: true });
        await fs.promises.mkdir(path.join(tempWorkspace, 'node_modules'), { recursive: true });
        await fs.promises.mkdir(path.join(tempWorkspace, 'test'), { recursive: true });
        
        // Create test files
        await fs.promises.writeFile(path.join(tempWorkspace, 'src', 'index.ts'), 'console.log("main");');
        await fs.promises.writeFile(path.join(tempWorkspace, 'src', 'utils.ts'), 'export const helper = () => {};');
        await fs.promises.writeFile(path.join(tempWorkspace, 'node_modules', 'package.js'), '// dependency');
        await fs.promises.writeFile(path.join(tempWorkspace, 'test', 'index.spec.ts'), 'test("example", () => {});');
        await fs.promises.writeFile(path.join(tempWorkspace, 'package.json'), '{"name": "test"}');
        await fs.promises.writeFile(path.join(tempWorkspace, 'README.md'), '# Test Project');
    });

    teardown(async () => {
        // Clean up temporary workspace
        if (tempWorkspace && fs.existsSync(tempWorkspace)) {
            await fs.promises.rm(tempWorkspace, { recursive: true, force: true });
        }
    });

    test('should have default empty inclusion patterns', async () => {
        const settings = await service.getSettingsWithInheritance(tempWorkspace);
        
        // Default inclusion patterns should be empty array
        assert.deepStrictEqual(settings.resolvedSettings['codeCounter.includePatterns'], []);
        assert.deepStrictEqual(settings.currentSettings?.['codeCounter.includePatterns'], undefined);
    });

    test('should save and retrieve inclusion patterns', async () => {
        const includePatterns = ['**/*.spec.ts', 'node_modules/important/**'];
        
        await service.saveWorkspaceSettings(tempWorkspace, {
            'codeCounter.includePatterns': includePatterns
        });
        
        const settings = await service.getSettingsWithInheritance(tempWorkspace);
        assert.deepStrictEqual(settings.currentSettings?.['codeCounter.includePatterns'], includePatterns);
        assert.deepStrictEqual(settings.resolvedSettings['codeCounter.includePatterns'], includePatterns);
    });

    test('should inherit inclusion patterns from parent directories', async () => {
        const parentIncludePatterns = ['**/*.important'];
        const subDir = path.join(tempWorkspace, 'src');
        
        // Save patterns at workspace level
        await service.saveWorkspaceSettings(tempWorkspace, {
            'codeCounter.includePatterns': parentIncludePatterns
        });
        
        // Child should inherit parent's inclusion patterns
        const childSettings = await service.getSettingsWithInheritance(subDir);
        assert.deepStrictEqual(childSettings.resolvedSettings['codeCounter.includePatterns'], parentIncludePatterns);
        assert.deepStrictEqual(childSettings.parentSettings['codeCounter.includePatterns'], parentIncludePatterns);
    });

    test('should override parent inclusion patterns when child defines them', async () => {
        const parentIncludePatterns = ['**/*.parent'];
        const childIncludePatterns = ['**/*.child'];
        const subDir = path.join(tempWorkspace, 'src');
        
        // Save patterns at both levels
        await service.saveWorkspaceSettings(tempWorkspace, {
            'codeCounter.includePatterns': parentIncludePatterns
        });
        
        await service.saveWorkspaceSettings(subDir, {
            'codeCounter.includePatterns': childIncludePatterns
        });
        
        // Child should use its own patterns, not inherit from parent
        const childSettings = await service.getSettingsWithInheritance(subDir);
        assert.deepStrictEqual(childSettings.currentSettings?.['codeCounter.includePatterns'], childIncludePatterns);
        assert.deepStrictEqual(childSettings.resolvedSettings['codeCounter.includePatterns'], childIncludePatterns);
        assert.deepStrictEqual(childSettings.parentSettings['codeCounter.includePatterns'], parentIncludePatterns);
    });

    test('should get inclusion patterns with sources', async () => {
        const workspacePatterns = ['**/*.workspace'];
        const subdirPatterns = ['**/*.subdir'];
        const subDir = path.join(tempWorkspace, 'src');
        
        await service.saveWorkspaceSettings(tempWorkspace, {
            'codeCounter.includePatterns': workspacePatterns
        });
        
        await service.saveWorkspaceSettings(subDir, {
            'codeCounter.includePatterns': subdirPatterns
        });
        
        const patternsWithSources = await service.getIncludePatternsWithSources(subDir);
        
        assert.strictEqual(patternsWithSources.length, 2);
        assert.deepStrictEqual(patternsWithSources[0], {
            pattern: '**/*.subdir',
            source: path.basename(subDir),
            level: 'directory'
        });
        assert.deepStrictEqual(patternsWithSources[1], {
            pattern: '**/*.workspace',
            source: '<workspace>',
            level: 'workspace'
        });
    });

    test('should include files that match inclusion patterns even when excluded', async () => {
        const excludePatterns = ['node_modules/**', '**/*.spec.ts'];
        const includePatterns = ['**/*.spec.ts', 'node_modules/important/**'];
        
        await service.saveWorkspaceSettings(tempWorkspace, {
            'codeCounter.excludePatterns': excludePatterns,
            'codeCounter.includePatterns': includePatterns
        });
        
        const settings = await service.getSettingsWithInheritance(tempWorkspace);
        const result = await lineCounter.countLinesWithInclusions(
            tempWorkspace, 
            settings.resolvedSettings['codeCounter.excludePatterns'],
            settings.resolvedSettings['codeCounter.includePatterns']
        );
        
        // Should include test/index.spec.ts even though it matches exclusion pattern
        const specFile = result.files.find(f => f.relativePath.includes('index.spec.ts'));
        assert.ok(specFile, 'spec file should be included despite being in exclude patterns');
        
        // Should exclude node_modules/package.js since it doesn't match inclusion patterns
        const nodeModuleFile = result.files.find(f => f.relativePath.includes('package.js'));
        assert.strictEqual(nodeModuleFile, undefined, 'node_modules file should remain excluded');
    });

    test('should handle complex inclusion/exclusion pattern combinations', async () => {
        // Create more complex file structure
        await fs.promises.mkdir(path.join(tempWorkspace, 'docs'), { recursive: true });
        await fs.promises.mkdir(path.join(tempWorkspace, 'build'), { recursive: true });
        await fs.promises.mkdir(path.join(tempWorkspace, 'src', 'important'), { recursive: true });
        
        await fs.promises.writeFile(path.join(tempWorkspace, 'docs', 'api.md'), '# API Docs');
        await fs.promises.writeFile(path.join(tempWorkspace, 'build', 'output.js'), 'compiled code');
        await fs.promises.writeFile(path.join(tempWorkspace, 'src', 'important', 'critical.ts'), 'critical code');
        
        const excludePatterns = ['build/**', 'docs/**', 'node_modules/**'];
        const includePatterns = ['docs/**/*.md', 'src/important/**'];
        
        await service.saveWorkspaceSettings(tempWorkspace, {
            'codeCounter.excludePatterns': excludePatterns,
            'codeCounter.includePatterns': includePatterns
        });
        
        const settings = await service.getSettingsWithInheritance(tempWorkspace);
        const result = await lineCounter.countLinesWithInclusions(
            tempWorkspace,
            settings.resolvedSettings['codeCounter.excludePatterns'],
            settings.resolvedSettings['codeCounter.includePatterns']
        );
        
        // Should include docs/api.md (matches inclusion pattern)
        const docsFile = result.files.find(f => f.relativePath.includes('api.md'));
        assert.ok(docsFile, 'docs markdown file should be included');
        
        // Should include src/important/critical.ts (matches inclusion pattern)
        const criticalFile = result.files.find(f => f.relativePath.includes('critical.ts'));
        assert.ok(criticalFile, 'important source file should be included');
        
        // Should exclude build/output.js (excluded and not in inclusion patterns)
        const buildFile = result.files.find(f => f.relativePath.includes('output.js'));
        assert.strictEqual(buildFile, undefined, 'build file should remain excluded');
    });

    test('should work with empty inclusion patterns (fallback to normal exclusion)', async () => {
        const excludePatterns = ['**/*.spec.ts'];
        const includePatterns: string[] = []; // Empty inclusion patterns
        
        await service.saveWorkspaceSettings(tempWorkspace, {
            'codeCounter.excludePatterns': excludePatterns,
            'codeCounter.includePatterns': includePatterns
        });
        
        const settings = await service.getSettingsWithInheritance(tempWorkspace);
        const result = await lineCounter.countLinesWithInclusions(
            tempWorkspace,
            settings.resolvedSettings['codeCounter.excludePatterns'],
            settings.resolvedSettings['codeCounter.includePatterns']
        );
        
        // Should exclude test files normally when no inclusion patterns defined
        const specFile = result.files.find(f => f.relativePath.includes('index.spec.ts'));
        assert.strictEqual(specFile, undefined, 'spec file should be excluded when no inclusion patterns');
        
        // Should include normal source files
        const srcFile = result.files.find(f => f.relativePath.includes('index.ts'));
        assert.ok(srcFile, 'source files should be included normally');
    });

    test('should merge inclusion patterns from multiple directory levels', async () => {
        const workspacePatterns = ['**/*.global'];
        const srcPatterns = ['**/*.local'];
        const subDir = path.join(tempWorkspace, 'src');
        const deepDir = path.join(subDir, 'components');
        
        await fs.promises.mkdir(deepDir, { recursive: true });
        
        await service.saveWorkspaceSettings(tempWorkspace, {
            'codeCounter.includePatterns': workspacePatterns
        });
        
        await service.saveWorkspaceSettings(subDir, {
            'codeCounter.includePatterns': srcPatterns
        });
        
        // Deep directory should inherit from immediate parent (src), not workspace
        const deepSettings = await service.getSettingsWithInheritance(deepDir);
        assert.deepStrictEqual(deepSettings.resolvedSettings['codeCounter.includePatterns'], srcPatterns);
        
        // But should still be able to trace back to workspace patterns
        const patternsWithSources = await service.getIncludePatternsWithSources(deepDir);
        assert.strictEqual(patternsWithSources.length, 2);
        
        // Should have immediate parent patterns first
        assert.deepStrictEqual(patternsWithSources[0], {
            pattern: '**/*.local',
            source: 'src',
            level: 'directory'
        });
        
        // Then workspace patterns
        assert.deepStrictEqual(patternsWithSources[1], {
            pattern: '**/*.global', 
            source: '<workspace>',
            level: 'workspace'
        });
    });
});