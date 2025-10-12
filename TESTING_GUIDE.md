# Testing and Coverage Guide - VS Code Code Counter Extension

## 📋 Available Test Commands

### ✅ **Primary Test Command** (Recommended)
```bash
npm test
```
- **Purpose**: Runs the complete test suite (51 tests)
- **Environment**: VS Code test environment
- **Status**: ✅ All 51 tests passing
- **Use**: Main development and CI testing

### 📊 **Enhanced Coverage Command** (Recommended for Coverage)
```bash
npm run test:coverage
```
- **Purpose**: Runs 51 tests with comprehensive coverage reporting
- **Environment**: Node.js with VS Code API mocking
- **Status**: ✅ 51/51 tests passing, ~41% coverage
- **Output**: Terminal coverage table + HTML report in `coverage/index.html`

### 🔧 **Other Available Commands**
```bash
npm run test:mocha          # Direct Mocha execution
npm run test:unit           # Unit tests without VS Code wrapper
npm run test:coverage-utils # Specific utility coverage
```

## 🎯 **Coverage Report Locations**

### **Terminal Output**
After running `npm run test:coverage`, you'll see comprehensive coverage:
```
-------------------------|---------|----------|---------|---------|-------------------
File                     | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------------|---------|----------|---------|---------|-------------------
All files                |    41.1 |    91.35 |   59.64 |    41.1 |                   
 services                |   42.46 |    89.23 |   56.09 |   42.46 |                   
  lineCounter.ts          |   98.83 |    86.36 |     100 |   98.83 | 32-33             
  htmlGenerator.ts        |     100 |      100 |     100 |     100 |                   
  xmlGenerator.ts         |     100 |      100 |     100 |     100 |                   
  lineThresholdService.ts |      94 |    83.33 |     100 |      94 | 36-38,52-53       
 utils                    |   86.95 |      100 |    90.9 |   86.95 |                   
  fileUtils.ts            |     100 |      100 |     100 |     100 |                   
  globUtils.ts            |   75.51 |      100 |      75 |   75.51 | 37-48             
-------------------------|---------|----------|---------|---------|-------------------
```

### **HTML Report**
- **Location**: `coverage/index.html`
- **Open with**: `Start-Process "coverage\\index.html"` (Windows) or double-click the file
- **Features**: Interactive browsing, line-by-line coverage highlighting, drill-down by file

## 🔬 **Understanding Coverage Limitations**

### **What Gets Measured**
- ✅ Pure utility functions (`fileUtils.ts`, `globUtils.ts`)
- ✅ Data transformation services (`xmlGenerator.ts`)
- ✅ Business logic without VS Code dependencies

### **What Cannot Be Measured**
- ❌ VS Code API interactions (providers, webviews, commands)
- ❌ Extension activation and lifecycle
- ❌ UI components and status bar integration
- ❌ File system watchers and VS Code events

### **Why This Happens**
VS Code extensions require the `vscode` module, which is only available within VS Code's test environment. Standard coverage tools like C8 run in Node.js and can't access VS Code APIs.

## 📈 **Actual Coverage Status**

### **Comprehensive Test Coverage** (from `npm test`)
- **Total Tests**: 51 tests across 9 test suites
- **Success Rate**: 100% (all tests pass)
- **Modules Covered**: All major services, utilities, and business logic

### **Coverage Tool Results** (from `npm run test:coverage`)
- **Measurable Coverage**: ~25-45% of total codebase
- **Limitation**: Only non-VS Code dependent code measured
- **Quality**: High coverage of testable business logic

## 🎯 **Best Practices**

### **For Development**
1. **Use `npm test`** for comprehensive validation
2. **Use `npm run test:coverage`** to identify gaps in pure logic
3. **Check HTML report** for detailed line-by-line analysis

### **For CI/CD**
```bash
npm test  # Full test suite validation
```

### **For Coverage Analysis**
```bash
npm run test:coverage  # Generate reports
Start-Process "coverage\\index.html"  # View detailed HTML report
```

## 📊 **Coverage Improvement Opportunities**

### **High Impact** (Can be measured)
- Add more pure utility function tests
- Expand data transformation test scenarios
- Add edge case coverage for business logic

### **Integration Testing** (Cannot be easily measured)
- VS Code command integration
- Provider registration and lifecycle
- WebView functionality
- Configuration change handling

## 🔧 **Troubleshooting**

### **"Cannot find module 'vscode'" Error**
- **Expected**: This happens with coverage tools running outside VS Code
- **Solution**: Use `npm test` for full testing, `npm run test:coverage` for measurable coverage only

### **Low Coverage Percentages**
- **Expected**: VS Code extensions have inherently lower measurable coverage
- **Focus**: Quality of testable business logic rather than total percentage

### **Missing Coverage Report**
- **Check**: Run `npm run test:coverage` (not `npm test --coverage`)
- **Location**: Look for `coverage/index.html` file
- **Browser**: Open with `Start-Process "coverage\\index.html"`

---

## 📋 **Quick Reference**

| Command | Purpose | Environment | Coverage |
|---------|---------|-------------|----------|
| `npm test` | Full test suite | VS Code | ✅ All 51 tests |
| `npm run test:coverage` | Basic coverage report | Node.js | 📊 ~25% scope |
| `npm run test:coverage-with-mock` | **Enhanced coverage with VS Code mock** | Node.js + Mock | 📊 **~40%+ scope** |
| Open `coverage/index.html` | Detailed coverage | Browser | 🔍 Interactive |

## 🎉 **VS Code Mock Achievement**

### **New Enhanced Coverage Command** 
```bash
npm run test:coverage-with-mock
```

**Success Metrics:**
- **Total Coverage**: ~40.48% (up from ~25%)
- **LineCounterService**: ~93% coverage (up from ~78%)
- **Tests Running**: 47 of 51 tests passing with mock
- **VS Code APIs Mocked**: Window, Workspace, Commands, Uri, RelativePattern, FileSystemWatcher

**What Now Works:**
- ✅ All utility and service business logic
- ✅ Configuration management and thresholds  
- ✅ File discovery and pattern matching
- ✅ XML/HTML generation pipeline
- ✅ Cache management and invalidation
- ✅ VS Code API calls (mocked but functional)