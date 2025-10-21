<!-- 
VS Code Code Counter Extension

Copyright (c) 2025 DelightfulGames
Licensed under the MIT License

Repository: https://github.com/DelightfulGames/vscode-code-counter
Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
-->
# Visual Demo Assets Guide

## 📸 **Screenshots Needed**

### **Primary Screenshots** (for marketplace listing)

1. **`file-explorer-with-indicators.png`**
   - **Scene**: VS Code file explorer showing emoji indicators
   - **Example**: 
     ```
     📁 src/
     ├── 🟢 utils.ts
     ├── 🟡 service.ts  
     ├── 🔴 legacy.ts
     └── 📊 components/
     ```
   - **Purpose**: Show instant visual feedback feature

2. **`status-bar-integration.png`**
   - **Scene**: VS Code status bar with Code Counter metrics
   - **Example**: `📊 TypeScript: 156 lines (🟡 moderate complexity)`
   - **Purpose**: Demonstrate live metrics display

3. **`html-report-preview.png`**
   - **Scene**: Generated HTML report in browser
   - **Elements**: Charts, tables, professional formatting
   - **Purpose**: Show professional reporting capability

4. **`configuration-settings.png`**
   - **Scene**: VS Code settings UI with Code Counter options
   - **Elements**: Threshold sliders, emoji selectors, exclusion patterns
   - **Purpose**: Highlight customization options

### **Secondary Screenshots**

5. **`command-palette.png`** - "Count Lines in Workspace" command
6. **`complexity-distribution.png`** - Chart from HTML report  
7. **`team-configuration.png`** - Workspace settings example
8. **`multi-language-support.png`** - Different file types with indicators

---

## 🎬 **GIFs/Animations Needed**

### **Primary Demos** (30-60 seconds each)

1. **`installation-to-first-use.gif`**
   - **Flow**: Install → Open project → Run command → See indicators
   - **Duration**: ~45 seconds
   - **Purpose**: Complete new user experience

2. **`real-time-status-bar.gif`**
   - **Flow**: Navigate between files → Watch status bar update
   - **Duration**: ~30 seconds  
   - **Purpose**: Show live integration

3. **`report-generation.gif`**
   - **Flow**: Run command → Select options → Open HTML report
   - **Duration**: ~60 seconds
   - **Purpose**: Demonstrate professional output

4. **`threshold-customization.gif`**
   - **Flow**: Open settings → Adjust thresholds → See indicators update
   - **Duration**: ~45 seconds
   - **Purpose**: Show flexibility and customization

### **Secondary Demos**

5. **`file-explorer-navigation.gif`** - Using indicators for navigation decisions
6. **`exclusion-patterns.gif`** - Configuring what files to skip
7. **`team-setup.gif`** - Sharing configuration via workspace settings

---

## 🎨 **Visual Style Guidelines**

### **Screenshot Standards**
- **Resolution**: 1920x1080 minimum for clarity
- **VS Code Theme**: Use popular theme (Dark+ or Light+) 
- **Font Size**: Increase for readability (14px+)
- **Cursor**: Hide cursor or position strategically
- **Window**: Clean VS Code window without distracting elements

### **GIF Standards**  
- **Frame Rate**: 15-20 FPS for smooth playback
- **Duration**: 30-60 seconds maximum
- **File Size**: Under 5MB for web compatibility  
- **Quality**: High enough to read text clearly
- **Pace**: Slow enough to follow, fast enough to maintain interest

### **Content Guidelines**
- **Project**: Use realistic but clean example project
- **File Names**: Clear, professional naming
- **Code Content**: Real code examples, not Lorem ipsum
- **Indicators**: Show variety of complexity levels (🟢🟡🔴)

---

## 📂 **Sample Project for Demos**

### **Suggested Demo Project Structure**
```
demo-project/
├── 🟢 README.md                    (42 lines)
├── 🟢 package.json                 (28 lines)  
├── 📁 src/
│   ├── 🟢 index.ts                 (15 lines)
│   ├── 🟢 utils.ts                 (67 lines)
│   ├── 🟡 userService.ts           (156 lines)
│   ├── 🟡 apiClient.ts             (234 lines)
│   ├── 🔴 legacyProcessor.ts       (1,247 lines)
│   └── 📁 components/
│       ├── 🟢 Button.tsx           (45 lines)
│       ├── 🟡 UserForm.tsx         (178 lines)
│       └── 🔴 DataTable.tsx        (567 lines)
├── 📁 tests/                       (excluded)
└── 📁 node_modules/                (excluded)
```

### **Demo Project Benefits**
- **Realistic**: Shows real-world complexity distribution
- **Educational**: Clear examples of different complexity levels
- **Professional**: Uses modern tech stack (TypeScript, React)
- **Relatable**: Familiar file types and naming conventions

---

## 🎯 **Key Messages to Communicate**

### **Through Screenshots**
1. **Instant Recognition** - Emoji indicators are immediately understandable
2. **Professional Quality** - Clean, polished interface integration  
3. **Comprehensive Coverage** - Works across entire project structure
4. **Customizable** - Flexible configuration options

### **Through GIFs**
1. **Effortless Integration** - Works seamlessly with existing workflow
2. **Real-time Feedback** - Live updates as you navigate  
3. **Professional Output** - Quality reports suitable for sharing
4. **Team-Ready** - Easy to configure and standardize

---

## 📋 **Production Checklist**

### **Before Creating Assets**
- [ ] Set up clean demo project with good complexity distribution
- [ ] Configure VS Code with appropriate theme and font size
- [ ] Install Code Counter extension in demo environment
- [ ] Test all workflows to ensure smooth recording
- [ ] Prepare scripts/notes for consistent messaging

### **During Asset Creation**
- [ ] Record multiple takes to ensure quality
- [ ] Verify text readability at various sizes
- [ ] Check that all key features are visible
- [ ] Maintain consistent pacing and style
- [ ] Include variety of file types and complexity levels

### **After Asset Creation**  
- [ ] Optimize file sizes for web delivery
- [ ] Test assets in different contexts (GitHub, VS Code Marketplace)
- [ ] Verify accessibility (alt text, captions if needed)
- [ ] Get feedback from team before finalizing
- [ ] Organize assets with clear naming conventions

---

## 💡 **Creative Ideas**

### **Advanced Demo Concepts**
1. **Split Screen**: Before/After showing project with and without Code Counter
2. **Time-lapse**: Showing complexity indicators updating as code is modified
3. **Team Scenario**: Multiple developers working with shared configuration
4. **Problem-Solution**: Showing how indicators help identify refactoring candidates

### **Interactive Elements**
1. **Hover States**: Show tooltips and additional information  
2. **Animation Highlights**: Draw attention to key features with subtle animations
3. **Callout Boxes**: Add explanatory text overlays for complex features
4. **Progress Indicators**: Show multi-step workflows clearly

---

## 📊 **Analytics Tracking**

### **Metrics to Monitor**
- **Engagement**: Time spent viewing assets
- **Conversion**: Asset views to extension installations  
- **Completion**: Full GIF playthrough rates
- **Sharing**: Social media engagement with visual content

### **A/B Testing Opportunities**
- Different emoji styles in screenshots
- Various VS Code themes (dark vs light)
- Different project complexity distributions
- Screenshot vs GIF effectiveness for different features