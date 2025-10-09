# vscode-code-counter

## Overview
The `vscode-code-counter` is a Visual Studio Code extension designed to count the lines of code in a project while allowing users to specify glob patterns for file exclusions. The extension generates an XML datasource that drives an HTML report, which is created in the specified directory whenever files are saved.

## Features
- Count lines of code in all files within a project.
- Support for glob patterns to exclude specific files or directories.
- Automatic generation of an XML datasource from the counted lines and file data.
- Creation of an HTML report based on the XML datasource.

## Project Structure
```
vscode-code-counter
├── src
│   ├── extension.ts          # Main entry point for the extension
│   ├── commands
│   │   └── countLines.ts     # Command to count lines in project files
│   ├── providers
│   │   └── fileWatcher.ts     # Monitors file changes and triggers counting
│   ├── services
│   │   ├── lineCounter.ts      # Contains methods to count lines in files
│   │   ├── xmlGenerator.ts      # Creates XML datasource from counted lines
│   │   └── htmlGenerator.ts     # Generates HTML report from XML datasource
│   ├── utils
│   │   ├── globUtils.ts        # Utility functions for glob patterns
│   │   └── fileUtils.ts        # Utility functions for file operations
│   └── types
│       └── index.ts            # Interfaces and types used throughout the project
├── templates
│   └── report.html             # Template for the HTML report
├── package.json                # Configuration file for npm
├── tsconfig.json               # TypeScript configuration file
├── webpack.config.js           # Webpack configuration file
└── README.md                   # Documentation for the project
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd vscode-code-counter
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Usage
1. Open the command palette in Visual Studio Code (Ctrl+Shift+P).
2. Run the command `Count Lines` to initiate the line counting process.
3. Specify any glob patterns for exclusions when prompted.
4. Upon saving files, an XML datasource will be generated, and an HTML report will be created in the specified directory.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.