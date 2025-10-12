# Development Setup Guide

This guide will get you up and running with the VS Code Code Counter extension development environment in minutes.

## 📋 Prerequisites

### Required Software
- **Node.js**: Version 16.x or higher
- **npm**: Version 8.x or higher (comes with Node.js)
- **Visual Studio Code**: Latest stable version
- **Git**: For version control

### Recommended VS Code Extensions
- **TypeScript and JavaScript Language Features**: Built-in
- **ESLint**: Code quality and style enforcement
- **Prettier**: Code formatting
- **Mocha Test Explorer**: Enhanced test running experience
- **GitLens**: Enhanced Git integration

---

## 🛠️ Environment Setup

### 1. Repository Setup
```bash
# Clone the repository
git clone https://github.com/DelightfulGames/vscode-code-counter.git
cd vscode-code-counter

# Install dependencies
npm install

# Verify installation
npm run compile
```

### 2. VS Code Configuration
The project includes pre-configured VS Code settings in `.vscode/`:

#### `launch.json` - Debug Configuration
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run Extension",
            "type": "extensionHost",
            "request": "launch",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}"
            ],
            "outFiles": [
                "${workspaceFolder}/out/**/*.js"
            ],
            "preLaunchTask": "npm: compile"
        },
        {
            "name": "Extension Tests",
            "type": "extensionHost", 
            "request": "launch",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}",
                "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
            ],
            "outFiles": [
                "${workspaceFolder}/out/test/**/*.js"
            ],
            "preLaunchTask": "npm: compile"
        }
    ]
}
```

#### `tasks.json` - Build Tasks
```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "type": "npm",
            "script": "compile",
            "group": "build",
            "label": "npm: compile",
            "presentation": {
                "panel": "dedicated",
                "reveal": "never"
            },
            "problemMatcher": ["$tsc"]
        },
        {
            "type": "npm",
            "script": "watch",
            "group": "build",
            "isBackground": true,
            "label": "npm: watch",
            "presentation": {
                "panel": "dedicated", 
                "reveal": "never"
            },
            "problemMatcher": ["$tsc-watch"]
        }
    ]
}
```

### 3. TypeScript Configuration
The project uses strict TypeScript configuration in `tsconfig.json`:

```json
{
    "compilerOptions": {
        "module": "commonjs",
        "target": "es6",
        "outDir": "out",
        "lib": ["es6"],
        "sourceMap": true,
        "rootDir": "src",
        "strict": true,
        "noImplicitReturns": true,
        "noImplicitAny": true,
        "noImplicitThis": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true
    },
    "exclude": ["node_modules", ".vscode-test"]
}
```

---

## 🏃 Running the Extension

### Development Mode
1. **Open Project**: Open the extension folder in VS Code
2. **Start Compilation**: Press `Ctrl+Shift+P` → "Tasks: Run Task" → "npm: compile"
3. **Launch Extension**: Press `F5` or use "Run Extension" debug configuration
4. **Test in Extension Host**: A new VS Code window opens with the extension loaded

### Watch Mode (Recommended)
```bash
# Start TypeScript compilation in watch mode
npm run watch
```

Then press `F5` to launch the Extension Development Host. The extension will automatically reload when you make changes.

### Manual Testing Workflow
1. **Make Code Changes**: Edit TypeScript files in `src/`
2. **Compile**: `Ctrl+Shift+P` → "Tasks: Run Task" → "npm: compile"
3. **Reload Extension**: In Extension Development Host, press `Ctrl+R`
4. **Test Functionality**: Use Command Palette to test extension commands

---

## 🧪 Testing Workflow

### Running Tests Locally
```bash
# Run all tests
npm test

# Run tests with detailed output
npm test -- --reporter spec

# Run specific test file
npm test -- --grep "LineCounterService"
```

### Test Development Workflow
1. **Write Tests**: Add tests in `src/test/suite/`
2. **Compile**: `npm run compile`
3. **Run Tests**: `npm test`
4. **Debug Tests**: Use "Extension Tests" debug configuration

### Test File Structure
```typescript
// src/test/suite/myService.test.ts
import { expect } from 'chai';
import { MyService } from '../../services/myService';

describe('MyService Tests', () => {
    let service: MyService;

    beforeEach(() => {
        service = new MyService();
    });

    it('should perform expected functionality', () => {
        const result = service.doSomething();
        expect(result).to.equal('expected');
    });

    afterEach(() => {
        // Cleanup if needed
    });
});
```

---

## 📦 Build Process

### Development Build
```bash
# Compile TypeScript to JavaScript
npm run compile

# Watch for changes and auto-compile
npm run watch

# Lint code
npm run lint

# Run tests
npm test
```

### Production Build
```bash
# Clean previous builds
rm -rf out/

# Compile with optimizations
npm run compile

# Run full test suite
npm test

# Lint and validate
npm run lint
```

### Package Extension
```bash
# Install VSCE (VS Code Extension CLI)
npm install -g vsce

# Package extension
vsce package

# This creates a .vsix file for distribution
```

---

## 🔧 Development Tools

### Debugging Configuration

#### Extension Debugging
- **Breakpoints**: Set breakpoints in TypeScript files
- **Debug Console**: Use `console.log()` for debugging output
- **Variable Inspection**: Hover over variables to inspect values
- **Call Stack**: Navigate through function calls

#### WebView Debugging
1. **Open Extension**: Launch extension in development mode
2. **Open Settings**: Run "Code Counter: Customize Line Count Colors"
3. **Developer Tools**: Right-click WebView → "Open Developer Tools"
4. **Debug**: Use browser developer tools for HTML/CSS/JavaScript

### Code Quality Tools

#### ESLint Configuration (`.eslintrc.json`)
```json
{
    "extends": [
        "@typescript-eslint/eslint-plugin/dist/configs/recommended.json"
    ],
    "parser": "@typescript-eslint/parser",
    "plugins": ["@typescript-eslint"],
    "rules": {
        "@typescript-eslint/naming-convention": [
            "warn",
            {
                "selector": "import",
                "format": ["camelCase", "PascalCase"]
            }
        ],
        "@typescript-eslint/semi": "warn",
        "curly": "warn",
        "eqeqeq": "warn",
        "no-throw-literal": "warn",
        "semi": "off"
    }
}
```

#### Git Hooks (Recommended)
```bash
# Install Husky for Git hooks
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm test"
```

---

## 🌐 Extension Development Patterns

### Service Pattern Implementation
```typescript
// src/services/myService.ts
export class MyService {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('codeCounter');
    }

    public async performAction(): Promise<Result> {
        try {
            // Implementation
            return result;
        } catch (error) {
            console.error('Service error:', error);
            throw error;
        }
    }
}
```

### Provider Pattern Implementation
```typescript
// src/providers/myProvider.ts
export class MyProvider implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('codeCounter')) {
                this.handleConfigChange();
            }
        });
        this.disposables.push(configWatcher);
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
```

### Command Implementation
```typescript
// src/commands/myCommand.ts
export class MyCommand {
    async execute(): Promise<void> {
        try {
            // Command implementation
            vscode.window.showInformationMessage('Command executed successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Command failed: ${error.message}`);
        }
    }
}
```

---

## 📝 Code Style Guidelines

### TypeScript Conventions
- **Naming**: Use camelCase for variables, PascalCase for classes
- **Interfaces**: Prefix with `I` or use descriptive names
- **Types**: Use specific types, avoid `any`
- **Error Handling**: Use try-catch blocks and proper error messages
- **Comments**: Use JSDoc for public APIs

### File Organization
```
src/
├── commands/           # Command implementations
├── providers/          # VS Code API providers  
├── services/          # Business logic services
├── types/             # Type definitions
├── utils/             # Utility functions
└── test/              # Test files
```

### Import Conventions
```typescript
// External libraries first
import * as vscode from 'vscode';
import * as path from 'path';

// Internal imports second
import { MyService } from '../services/myService';
import { MyInterface } from '../types';
```

---

## 🚨 Common Issues & Solutions

### Compilation Issues
```bash
# Clear TypeScript cache
rm -rf out/
npm run compile

# Check for TypeScript errors
npx tsc --noEmit
```

### Extension Not Loading
1. **Check Console**: Look for errors in Extension Development Host console
2. **Verify Manifest**: Ensure `package.json` is valid
3. **Check Dependencies**: Run `npm install` again
4. **Restart Host**: Reload Extension Development Host window

### Test Failures
```bash
# Run tests with detailed output
npm test -- --reporter spec

# Check test file paths
ls src/test/suite/*.test.ts

# Verify test runner configuration
cat .mocharc.json
```

### WebView Issues
1. **CSP Errors**: Check Content Security Policy settings
2. **Resource Loading**: Use VS Code resource URIs
3. **Message Passing**: Verify WebView message protocol
4. **Theme Variables**: Use CSS custom properties

---

## 📚 Additional Resources

### VS Code Extension Development
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

### Testing Resources
- [Mocha Documentation](https://mochajs.org/)
- [Chai Assertion Library](https://www.chaijs.com/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

### TypeScript Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [VS Code Types](https://www.npmjs.com/package/@types/vscode)

---

## 🤝 Contributing Workflow

### Development Process
1. **Create Branch**: `git checkout -b feature/my-feature`
2. **Make Changes**: Implement functionality
3. **Add Tests**: Ensure test coverage
4. **Run Tests**: `npm test`
5. **Lint Code**: `npm run lint`
6. **Commit Changes**: Follow commit message conventions
7. **Push Branch**: `git push origin feature/my-feature`
8. **Create PR**: Submit pull request for review

### Code Review Checklist
- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] New functionality has tests
- [ ] Documentation updated if needed
- [ ] No breaking changes (or properly documented)

---

*This development setup guide provides everything needed to start contributing to the VS Code Code Counter extension effectively.*