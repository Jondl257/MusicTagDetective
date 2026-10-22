import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/musicbrainz.mjs';
test('missing server configuration fails closed',async()=>{delete process.env.TEST_ACCESS_CODE;delete process.env.MUSICTAG_USER_AGENT;const r=await handler(new Request('https://test.invalid/api/search?operation=search&title=Test'));assert.equal(r.status,503)});
test('bad test code never reaches database or upstream',async()=>{process.env.TEST_ACCESS_CODE='1234567890123456';process.env.MUSICTAG_USER_AGENT='Test/1 (local test contact)';const r=await handler(new Request('https://test.invalid/api/search?operation=search&title=Test',{headers:{'x-test-code':'wrong'}}));assert.equal(r.status,401)});
test('invalid operation blocked after authentication',async()=>{const r=await handler(new Request('https://test.invalid/api/search?operation=evil',{headers:{'x-test-code':process.env.TEST_ACCESS_CODE}}));assert.equal(r.status,400)});
