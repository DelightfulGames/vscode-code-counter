import * as assert from 'assert';
import { expect } from 'chai';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });

  test('Chai assertion test', () => {
    expect([1, 2, 3]).to.have.lengthOf(3);
    expect('hello world').to.contain('world');
  });

  test('VS Code API test', () => {
    // VS Code extension API should be available
    expect(vscode.window).to.not.be.undefined;
    expect(vscode.commands).to.not.be.undefined;
    expect(vscode.workspace).to.not.be.undefined;
  });
});