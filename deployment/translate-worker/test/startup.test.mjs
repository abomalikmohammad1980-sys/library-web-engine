import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

test('background agent reconnects after offline startup without a dashboard',{timeout:25000},async()=>{
 const fixture=new URL('./fixtures/offline-startup.mjs',import.meta.url).href;
 const agent=fileURLToPath(new URL('../local-agent/agent.mjs',import.meta.url));
 const {stdout}=await promisify(execFile)(process.execPath,['--import',fixture,agent],{
  timeout:22000,env:{...process.env,LOCAL_TRANSLATION_URL:'https://example.test',LOCAL_TRANSLATION_AGENT_TOKEN:'test-only-'.repeat(5)}
 });
 assert.match(stdout,/TEST_RECONNECTED_AFTER_OFFLINE/);
 assert.match(stdout,/completed=1/);
 assert.match(stdout,/Stopped/);
});
