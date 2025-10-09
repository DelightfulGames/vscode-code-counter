import * as vscode from 'vscode';
import { LineCounter } from '../services/lineCounter';
import { XmlGenerator } from '../services/xmlGenerator';
import { HtmlGenerator } from '../services/htmlGenerator';
import { getGlobExclusions } from '../utils/globUtils';

export function countLinesCommand(context: vscode.ExtensionContext) {
    const lineCounter = new LineCounter();
    const xmlGenerator = new XmlGenerator();
    const htmlGenerator = new HtmlGenerator();

    vscode.window.showInputBox({
        prompt: 'Enter glob patterns to exclude files (comma-separated)',
        placeHolder: '*.test.js,*.spec.ts'
    }).then((input) => {
        const exclusions = getGlobExclusions(input);
        lineCounter.countLinesInProject(exclusions).then((fileData) => {
            const xmlData = xmlGenerator.generateXml(fileData);
            htmlGenerator.generateHtml(xmlData);
            vscode.window.showInformationMessage('Line counting completed and report generated.');
        }).catch((error) => {
            vscode.window.showErrorMessage(`Error counting lines: ${error.message}`);
        });
    });
}