# VS Code Marketplace Description

## 📊 Code Counter - Visual Line Metrics & Project Analytics

> **Instantly see code complexity with emoji indicators. Professional reporting for teams.**

Transform your development workflow with intelligent code metrics that appear right in your VS Code interface. Get real-time visual feedback on file complexity and generate comprehensive project reports.

---

## ✨ **What You Get**

### 🎯 **Visual Complexity Indicators**
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
- Standardize complexity metrics across projects
- Improve code review efficiency
- Generate reports for stakeholders

**🏢 Engineering Managers**
- Monitor technical debt across teams
- Generate metrics for planning sessions
- Track code quality improvements

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

### **Smart Exclusions**
Configure what files to skip:
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

- ✅ **51/51 Tests Passing** - Thoroughly tested
- ✅ **41% Code Coverage** - Reliable functionality  
- ✅ **TypeScript** - Type-safe and modern
- ✅ **Zero Dependencies** - Lightweight and secure
- ✅ **Active Maintenance** - Regular updates

---

## 💡 **Pro Tips**

**🔍 Quick Analysis**: Use status bar to check current file without running full workspace scan

**📋 Export Reports**: Right-click in file explorer for quick report generation

**⚡ Performance**: Extension intelligently caches results for fast updates

**🎯 Focus Mode**: Use exclusion patterns to focus on source code only

**👥 Team Sync**: Share threshold configurations via workspace settings

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