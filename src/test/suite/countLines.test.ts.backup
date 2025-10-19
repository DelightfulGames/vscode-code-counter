import { expect } from 'chai';
import { CountLinesCommand } from '../../commands/countLines';

suite('CountLinesCommand Tests', () => {
    let command: CountLinesCommand;
    
    setup(() => {
        command = new CountLinesCommand();
    });

    test('should create CountLinesCommand instance', () => {
        expect(command).to.be.instanceOf(CountLinesCommand);
        expect(command).to.have.property('execute').that.is.a('function');
        expect(command).to.have.property('executeAndShowPanel').that.is.a('function');
    });

    test('should have execute method', () => {
        expect(typeof command.execute).to.equal('function');
    });

    test('should have executeAndShowPanel method', () => {
        expect(typeof command.executeAndShowPanel).to.equal('function');
    });

    // Note: Full integration testing of this command requires VS Code extension test environment
    // The command's business logic is primarily tested through its service dependencies:
    // - LineCounterService (tested in lineCounter.test.ts)
    // - XmlGeneratorService (tested in xmlGenerator.test.ts) 
    // - HtmlGeneratorService (tested in htmlGenerator.test.ts)
    // - WebViewReportService (would need separate tests)
});