import assert from 'node:assert/strict';
import { test } from 'node:test';
import { htmlCharsetProblem } from '../scripts/lib/security-headers.ts';

// Fixture responses for the charset rule of scripts/http-test.ts, so its red path is proved without a running image (Ensaio s13).
const answer = (status: number, contentType?: string) => new Response('x', { status, headers: contentType === undefined ? {} : { 'content-type': contentType } });

test('an HTML answer without charset=utf-8 is a problem, and the right header is not', () => {
  for (const [status, type] of [[200, 'text/html'], [206, 'text/html'], [200, 'text/html; charset=iso-8859-1'], [200, 'text/html; charset=utf-16'], [200, 'text/html; charset=utf-8; x=y'], [200, 'TEXT/HTML'], [200, 'text/html;charset=utf-80']] as const) {
    assert.match(htmlCharsetProblem(answer(status, type)) ?? '', /without charset=utf-8/, `${status} ${type}`);
  }
  for (const [status, type] of [[200, 'text/html; charset=utf-8'], [206, 'text/html; charset=UTF-8'], [200, 'text/html;charset=utf-8'], [200, 'TEXT/HTML; CHARSET=UTF-8']] as const) {
    assert.equal(htmlCharsetProblem(answer(status, type)), undefined, `${status} ${type}`);
  }
});

// nginx's charset filter does not run on redirect or error answers, so only a 2xx page is held to the rule (the CI run that proved it
// failed on two 301 bodies and passed on every page).
test('a redirect or error answer and a non-HTML answer are not held to the rule', () => {
  for (const [status, type] of [[301, 'text/html'], [302, 'text/html'], [404, 'text/html'], [200, 'application/json'], [200, 'text/css'], [200, 'image/svg+xml'], [200, undefined]] as const) {
    assert.equal(htmlCharsetProblem(answer(status, type)), undefined, `${status} ${type}`);
  }
});
