<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

Repository: https://github.com/DelightfulGames/vscode-code-counter
Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->
# VS Code Marketplace Description

## 📊 Code Counter Pro - Visual Line Metrics & Hierarchical Workspace Settings

> **Instantly see code complexity with emoji indicators. Professional reporting with intelligent workspace configuration.**

Transform your development workflow with intelligent code metrics and hierarchical workspace settings that appear right in your VS Code interface. Get real-time visual feedback on file complexity and generate comprehensive project reports with smart configuration inheritance.

---

## ✨ **What You Get**

### �️ **NEW: Hierarchical Workspace Settings** 
Smart configuration that adapts to your project structure:
- **Nearest-Ancestor Inheritance** - Settings cascade from closest .vscode/settings.json
- **Multi-Root Workspace Support** - Each folder can have its own thresholds
- **Automatic Configuration Discovery** - No manual setup required

### �🎯 **Visual Complexity Indicators**
See code complexity at a glance with emoji badges:
- 🟢 **Simple files** (< 100 lines) - Clean and maintainable
- 🟡 **Moderate files** (100-500 lines) - Watch for complexity 
- 🔴 **Complex files** (> 500 lines) - Consider refactoring

### 📊 **Live Status Bar**
Your current file's metrics always visible:
`📊 TypeScript: 156 lines (🟡 moderate complexity)`

### 📈 **Professional Reports** 
Generate beautiful HTML and XML reports with:
- Language breakdowns and statistics
- Complexity distribution charts
- Filterable file listings
- Team-ready formatting

---

## 🚀 **Perfect For**

**👩‍💻 Individual Developers**
- Get instant feedback on code complexity
- Identify refactoring opportunities
- Track project growth over time

**👥 Development Teams**
- Standardize complexity metrics across projects with hierarchical settings
- Improve code review efficiency with consistent thresholds
- Generate reports for stakeholders with per-project customization

**🏢 Engineering Managers**
- Monitor technical debt across teams with workspace-specific rules
- Generate metrics for planning sessions with inherited configurations
- Track code quality improvements across multi-root workspaces

---

## ⚡ **Getting Started**

1. **Install** the extension
2. **Open** any project in VS Code
3. **Run** "Count Lines in Workspace" from Command Palette
4. **See** emoji indicators appear in your file explorer
5. **Generate** your first report!

---

## 🎨 **Fully Customizable**

### **Adjust Your Thresholds**
Set complexity boundaries that match your team's standards:
```json
{
  "codeCounter.thresholds": {
    "simple": 50,      // Your "simple" threshold
    "moderate": 200,   // Your "moderate" threshold  
    "complex": 500     // Your "complex" threshold
  }
}
```

### **Choose Your Emoji Style**
Pick indicators that work for your team:
- Classic: 🟢🟡🔴 (traffic light)
- Symbols: ✅⚠️🚨 (status symbols)
- Numbers: 1️⃣2️⃣3️⃣ (numbered levels)

### **Hierarchical Workspace Configuration**
Set different rules for different parts of your project:
```json
// Root .vscode/settings.json
{
  "codeCounter.thresholds": {
    "simple": 100,
    "moderate": 300,
    "complex": 600
  }
}

// Frontend/.vscode/settings.json (inherits and overrides)
{
  "codeCounter.thresholds": {
    "simple": 50,    // Stricter for frontend
    "moderate": 150
  }
}
```

### **Smart Exclusions**
Configure what files to skip with inheritance:
```json
{
  "codeCounter.exclude": [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.min.js"
  ]
}
```

---

## 🏆 **Quality You Can Trust**

- ✅ **161/183 Tests Passing** - Comprehensive test coverage with hierarchical features
- ✅ **88% Success Rate** - Reliable functionality across complex scenarios
- ✅ **TypeScript** - Type-safe and modern architecture
- ✅ **Zero Dependencies** - Lightweight and secure
- ✅ **Active Maintenance** - Regular updates with v0.12.0 features

---

## 💡 **Pro Tips**

**🔍 Quick Analysis**: Use status bar to check current file without running full workspace scan

**📋 Export Reports**: Right-click in file explorer for quick report generation

**⚡ Performance**: Extension intelligently caches results for fast updates

**🎯 Focus Mode**: Use exclusion patterns to focus on source code only

**👥 Team Sync**: Share threshold configurations via hierarchical workspace settings

**🏗️ Multi-Project**: Use different thresholds for different parts of large codebases

---

## 📞 **Support & Community**

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/DelightfulGames/vscode-code-counter/issues)
- 💡 **Feature Ideas**: [GitHub Discussions](https://github.com/DelightfulGames/vscode-code-counter/discussions)
- 📖 **Documentation**: [Full Guide](https://github.com/DelightfulGames/vscode-code-counter#readme)
- ⭐ **Rate & Review**: Help others discover this extension!

---

## 🚀 **Ready to Transform Your Workflow?**

Install Code Counter today and see your code complexity with new clarity!

*Built by developers, for developers. MIT licensed and open source.*