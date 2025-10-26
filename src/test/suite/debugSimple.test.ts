/**
 * Simple Debug Service Tests
 *
 * Basic functionality tests for debugging in isolation
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { ConsoleBackend, DebugService } from '../../services/debugService';

suite('Debug Simple Test', () => {
    let sandbox: sinon.SinonSandbox;
    let consoleStubs: any;

    setup(() => {
        sandbox = sinon.createSandbox();
        consoleStubs = {
            error: sandbox.stub(console, 'error'),
            warn: sandbox.stub(console, 'warn'),
            info: sandbox.stub(console, 'info'),
            log: sandbox.stub(console, 'log')
        };

        // Reset singleton
        (DebugService as any).instance = null;
    });

    teardown(() => {
        sandbox.restore();
        (DebugService as any).instance = null;
    });

    test('console backend should work directly', () => {
        const backend = new ConsoleBackend();
        
        expect(() => backend.error('Direct test error')).to.not.throw;
        expect(backend).to.be.an.instanceof(ConsoleBackend);
    });

    test('debug service should log through console backend', () => {
        const debug = DebugService.getInstance();
        debug.configure('console');
        
        expect(() => debug.error('Service test error')).to.not.throw;
        expect(debug.getCurrentBackend()).to.equal('console');
    });
});