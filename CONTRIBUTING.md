<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

GitHub Repository: https://github.com/DelightfulGames/vscode-code-counter  
VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->
# 🌟 **Contributing**
We welcome contributions from developers, architects, and VS Code enthusiasts!

## **Setup**
1. Clone this repository
```bash
git clone https://github.com/DelightfulGames/vscode-code-counter.git
cd vscode-code-counter
```
2. Install dependencies
```bash
npm install
```
3. Run all 249 tests
```bash
npm run test
```
4. Generate coverage reports
```bash
npm run test:coverage
```
5. Open in VS Code and press `F5` to launch Extension Development Host
```bash
code .
```
6. Setup and develop your enhancements [docs/development-setup.md](./docs/development-setup.md)
7. Commit your changes to your repo and make a pull request to the main branch

### **Configuration**
- **`codeCounter.excludePatterns`**: Array of glob patterns for files to exclude
- **`codeCounter.outputDirectory`**: output directory for code counter reports
- **`codeCounter.cacheLineCounts`**: Cache counts of files on save to improve performance
- **`codeCounter.lineThresholds.midThreshold`**: Mid threshold for the 🟢 badge
- **`codeCounter.lineThresholds.highThreshold`**: High threshold for the 🟡 badge
- **`codeCounter.emojis.normal`**: Badge to use for content less than the Mid threshold (Default:🟢)
- **`codeCounter.emojis.warning`**: Badge to use for content greater than the Mid threshold, but lower than the High threshold (Default:🟡)
- **`codeCounter.emojis.danger`**: Badge to use for content greater than the High threshold (Default:🔴)

#### **Settings**
See [package.json](./package.json) under `contributes.configuration`

### Building and Packaging
> Create .vsix file for distribution
```bash
npm run compile    # Compile TypeScript
npm run test       # Run test suite
npm run package    # Create .vsix file for distribution
```

## Development
### **Contribution Areas**
- 🎨 **UI/UX Improvements**: Enhanced visual indicators
- 📊 **Analytics Features**: New report formats and metrics  
- 🧪 **Testing**: Expand our comprehensive test suite
- 📚 **Documentation**: Guides and tutorials

### **Code Quality Standards**
- All PRs must pass all tests
- Maintain or improve 41% coverage
- TypeScript strict mode compliance
- VS Code API best practices
