import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  charsetFirst, donationsBlock, donationsBlockElsewhere, noReferrerMeta, reservedDonationsPath, supportPage, supportStatus,
} from '../scripts/lib/donations-checks.ts';

const errors = (findings: { level?: string }[]) => findings.filter((f) => f.level === 'error').length;

const MESSAGE = 'Money donations are not open yet.';
const REFERRER = '<meta name="referrer" content="no-referrer">';
// A whole document, because the guard reads the page with a real HTML parser and a fragment is a parse error (no doctype).
const documentOf = (main: string, head = `<meta charset="utf-8">${REFERRER}`) =>
  `<!doctype html><html lang="pt-BR"><head>${head}<title>t</title></head><body><main>${main}</main></body></html>`;

const NOT_OPEN = `<p data-donations="not-open" class="x">${MESSAGE}</p>`;
const notOpenPage = (block = NOT_OPEN, extra = '') => documentOf(`${block}${extra}`);

const OPEN_FORM = [
  '<form id="donation-form" method="post" action="/donations/api/v1/checkout" class="x">',
  '<input type="hidden" name="locale" value="pt-br">',
  '<label for="amount">Valor</label><input id="amount" name="amount" type="text" inputmode="decimal" required maxlength="14" autocomplete="off">',
  '<div data-amount-presets hidden><button type="button" data-amount="10">R$ 10</button></div>',
  '<input id="display-name" name="display_name" maxlength="20" autocomplete="off">',
  '<button type="submit">Doar</button>',
  '</form>',
].join('');
const openBlock = (form = OPEN_FORM) => `<div data-donations="open"><p id="obrigado">Obrigado</p>${form}</div>`;
const openPage = (block = openBlock(), extra = '') => documentOf(`${block}${extra}`);
const OPEN = { status: 'open', notOpenMessage: MESSAGE, locale: 'pt-br' } as const;
const swap = (from: string, to: string) => {
  assert.ok(OPEN_FORM.includes(from), `the fixture has "${from}"`);
  return openBlock(OPEN_FORM.replace(from, to));
};

test('the fixtures themselves are clean: a valid open page and a valid not-open page pass with no finding', () => {
  assert.deepEqual(supportPage(openPage(), 'p', OPEN), []);
  assert.deepEqual(supportPage(notOpenPage(), 'p', MESSAGE), []);
});

test('support page, not open: one plain-text block, no form, no panel, no Donations script, the meta tags, no beacon (D-28, P2-09)', () => {
  assert.equal(supportPage(notOpenPage(), 'p', { status: 'not-open', notOpenMessage: MESSAGE, locale: 'pt-br' }).length, 0);
  const bad: [string, string][] = [
    ['no block', notOpenPage('')],
    ['two blocks', notOpenPage(NOT_OPEN, NOT_OPEN)],
    ['a link inside the block', notOpenPage(`<p data-donations="not-open">${MESSAGE} <a href="https://x.test">Send</a></p>`)],
    ['another message', notOpenPage('<p data-donations="not-open">Donate now</p>')],
    ['an analytics beacon', notOpenPage(NOT_OPEN, '<script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script>')],
    ['a form while not open', notOpenPage(NOT_OPEN, '<form method="post" action="/donations/api/v1/checkout"></form>')],
    ['a panel marker while not open', notOpenPage(NOT_OPEN, '<div data-donations-panel hidden></div>')],
    ['the Donations panel script while not open', notOpenPage(NOT_OPEN, '<script type="module" src="/_astro/DonationsPanel.astro_astro_type_script_index_0_lang.D4MxFJQI.js"></script>')],
    ['the Donations form script while not open', notOpenPage(NOT_OPEN, '<script type="module" src="/_astro/DonationsOpen.astro_astro_type_script_index_0_lang.CbYV6ULh.js"></script>')],
    ['an unknown donations state', notOpenPage(NOT_OPEN, '<p data-donations="closed">x</p>')],
    ['a nameless select while not open', notOpenPage(NOT_OPEN, '<select><option>1</option></select>')],
    ['no referrer meta', documentOf(NOT_OPEN, '<meta charset="utf-8">')],
    ['a referrer meta with another policy', documentOf(NOT_OPEN, '<meta charset="utf-8"><meta name="referrer" content="origin">')],
    ['two referrer metas', documentOf(NOT_OPEN, `<meta charset="utf-8">${REFERRER}${REFERRER}`)],
    ['no charset meta', documentOf(NOT_OPEN, REFERRER)],
    ['the charset meta not first in head', documentOf(NOT_OPEN, `${REFERRER}<meta charset="utf-8">`)],
    ['another charset', documentOf(NOT_OPEN, `<meta charset="windows-1252">${REFERRER}`)],
  ];
  for (const [label, html] of bad) assert.ok(errors(supportPage(html, 'p', MESSAGE)) >= 1, label);
  assert.equal(supportPage(notOpenPage(NOT_OPEN, '<p data-donations="soon">soon</p>'), 'p', MESSAGE).length, 0, 'the soon notice belongs to the not-open page');
});

test('support page, open: one form that posts to the donations service and to nothing else (P2-09)', () => {
  const bad: [string, string][] = [
    ['a get form', openPage(swap('method="post"', 'method="get"'))],
    ['another action', openPage(swap('/donations/api/v1/checkout', '/donations/api/v1/other'))],
    ['an external action', openPage(swap('/donations/api/v1/checkout', 'https://pay.example/checkout'))],
    ['a payment host as action', openPage(swap('/donations/api/v1/checkout', 'https://www.mercadopago.com.br/checkout'))],
    ['a target', openPage(swap('class="x"', 'class="x" target="_blank"'))],
    ['a multipart form', openPage(swap('class="x"', 'class="x" enctype="multipart/form-data"'))],
    ['the old amount_cents name', openPage(swap('name="amount"', 'name="amount_cents"'))],
    ['an unknown field', openPage(swap('<button type="submit">', '<input name="email"><button type="submit">'))],
    ['a radio for the amount', openPage(swap('<button type="submit">', '<input type="radio" name="amount" value="10"><button type="submit">'))],
    ['a second amount control', openPage(swap('<button type="submit">', '<input name="amount" type="text"><button type="submit">'))],
    ['an amount without maxlength 14', openPage(swap('maxlength="14"', 'maxlength="30"'))],
    ['an amount that is not required', openPage(swap(' required', ''))],
    ['an amount with a pattern attribute', openPage(swap('maxlength="14"', 'maxlength="14" pattern="[0-9]+"'))],
    ['an amount without inputmode decimal', openPage(swap(' inputmode="decimal"', ''))],
    ['an amount with another inputmode', openPage(swap('inputmode="decimal"', 'inputmode="numeric"'))],
    ['a name without maxlength 20', openPage(swap('maxlength="20"', ''))],
    ['no hidden locale', openPage(swap('<input type="hidden" name="locale" value="pt-br">', ''))],
    ['the other locale', openPage(swap('value="pt-br"', 'value="en-us"'))],
    ['a visible locale field', openPage(swap('type="hidden"', 'type="text"'))],
    ['a quick-fill that submits', openPage(swap('<button type="button" data-amount="10">', '<button data-amount="10" name="amount">'))],
    ['a checkbox input', openPage(swap('<button type="submit">', '<input type="checkbox"><button type="submit">'))],
    ['a file input', openPage(swap('<button type="submit">', '<input type="file"><button type="submit">'))],
    ['an image input', openPage(swap('<button type="submit">', '<input type="image" src="/x.png"><button type="submit">'))],
    ['a submit input beside the button', openPage(swap('<button type="submit">', '<input type="submit"><button type="submit">'))],
    ['a reset input', openPage(swap('<button type="submit">', '<input type="reset"><button type="submit">'))],
    ['a named submit button (it would post a fourth field)', openPage(swap('<button type="submit">', '<button type="submit" name="extra" value="x">'))],
    ['a named button that is no submit button', openPage(swap('<button type="button" data-amount="10">', '<button type="button" name="amount" data-amount="10">'))],
    ['the form closed before its controls (an empty form beside them)', openPage(openBlock(OPEN_FORM.replace('<input type="hidden" name="locale"', '</form><input type="hidden" name="locale"')))],
    ['a control of the block outside the form', openPage(swap('</form>', '</form><input name="amount" type="text">'))],
    ['a select in the block', openPage(swap('<button type="submit">', '<select name="amount"><option value="1">1</option></select><button type="submit">'))],
    ['a nameless select in the block', openPage(swap('<button type="submit">', '<select><option>1</option></select><button type="submit">'))],
    ['a select outside the block', openPage(openBlock(), '<select name="x"><option>1</option></select>')],
    ['a nameless select outside the block (only the select rule sees it)', openPage(openBlock(), '<select><option>1</option></select>')],
    ['a preset container that is not hidden', openPage(swap('data-amount-presets hidden', 'data-amount-presets'))],
    ['two submit buttons', openPage(swap('</form>', '<button type="submit">Again</button></form>'))],
    ['a script inside the block', openPage(swap('</form>', '</form><script>x()</script>'))],
    ['a meta inside the block', openPage(swap('</form>', '</form><meta http-equiv="refresh" content="0;url=https://x.test">'))],
    ['a link element inside the block', openPage(swap('</form>', '</form><link rel="prefetch" href="/x">'))],
    ['an iframe in the block', openPage(swap('</form>', '</form><iframe src="/x"></iframe>'))],
    ['an embed in the block', openPage(swap('</form>', '</form><embed src="/x">'))],
    ['a base in the block', openPage(swap('</form>', '</form><base href="/">'))],
    ['a second form outside the block', openPage(openBlock(), '<form action="/x"></form>')],
    ['the soon notice beside the open block', openPage(openBlock(), '<p data-donations="soon">soon</p>')],
    ['both blocks', openPage(openBlock(), '<p data-donations="not-open">x</p>')],
    ['no block', openPage('')],
    ['no referrer meta', documentOf(openBlock(), '<meta charset="utf-8">')],
  ];
  for (const [label, html] of bad) assert.ok(errors(supportPage(html, 'p', OPEN)) >= 1, label);
  // The state must be the one the site data asks for, either way round.
  assert.equal(errors(supportPage(openPage(), 'p', { status: 'not-open', notOpenMessage: MESSAGE, locale: 'pt-br' })), 1);
  assert.equal(errors(supportPage(openPage('<p data-donations="not-open">x</p>'), 'p', OPEN)), 1);
});

test('svg in the block: an animation that can rewrite an address is refused, an svg address is judged like any other (Sentinela S6)', () => {
  const svg = (inner: string) => openPage(swap('</form>', `</form><svg viewBox="0 0 1 1">${inner}</svg>`));
  assert.equal(errors(supportPage(svg('<path d="M0 0"/>'), 'p', OPEN)), 0, 'an honest svg passes');
  const bad: [string, string][] = [
    ['animate', '<a href="/x"><animate attributeName="href" values="//evil.example/"/></a>'],
    ['set', '<a href="/x"><set attributeName="href" to="https://evil.example/"/></a>'],
    ['animateTransform', '<animateTransform attributeName="transform" type="rotate" to="1"/>'],
    ['animateMotion', '<animateMotion path="M0 0"/>'],
    ['an external xlink:href', '<a xlink:href="https://evil.example/"><text>x</text></a>'],
    ['an external svg href', '<a href="//evil.example/"><text>x</text></a>'],
    ['use with an external href', '<use href="https://evil.example/x.svg#a"/>'],
  ];
  for (const [label, inner] of bad) assert.ok(errors(supportPage(svg(inner), 'p', OPEN)) >= 1, label);
});

test('every address in the open block is local: one slash that is not followed by a slash or a backslash, or a fragment (Sentinela S1, M2)', () => {
  const inBlock = (href: string) => openPage(swap('</form>', `</form><a href="${href}">x</a>`));
  for (const href of ['/pt-br/terms-of-service/', '/pt-br/privacy-policy/#donations', '#obrigado', '/x?y=1']) assert.equal(errors(supportPage(inBlock(href), 'p', OPEN)), 0, href);
  const foreign = [
    'https://pay.example/', 'http://pay.example/', '//pay.example/', '/\\pay.example/', '\\\\pay.example/', ' /x', '\t/x', 'javascript:alert(1)',
    'data:text/html,x', 'mailto:a@b.c', 'x/y', '',
    // Character references are decoded by the parser, so these ARE the protocol-relative address a browser resolves (Sentinela C1).
    '&#47;&#47;pay.example/', '/&#47;evil.example/pay', '/&#x2F;evil.example/pay', '/&sol;evil.example', 'java&#115;cript:x',
    // A control or space character inside the address (Sentinela C2): a browser drops a tab or a newline before it resolves.
    '/\t/evil.example/pay', '/\n/evil.example/pay', '/\r/evil.example', '/ /evil.example', '/\u0000/x', '/\u0085/x', '/x y',
    // An `&` that is still an `&` after decoding.
    '/x?a=1&amp;b=2',
  ];
  // (A browser's URL parser drops a tab or newline and reads "/\t/evil.example" as "//evil.example": that is why the rule refuses
  // the character instead of trusting the local test on the raw value. The WHATWG URL algorithm is not re-run here.)
  for (const href of foreign) assert.ok(errors(supportPage(inBlock(href), 'p', OPEN)) >= 1, JSON.stringify(href));
  for (const [attribute, tag] of [['src', 'img'], ['srcset', 'img'], ['poster', 'video'], ['data', 'span'], ['ping', 'a'], ['cite', 'blockquote'], ['background', 'table'], ['manifest', 'span']] as const) {
    assert.ok(errors(supportPage(openPage(swap('</form>', `</form><${tag} ${attribute}="https://pay.example/x">x</${tag}>`)), 'p', OPEN)) >= 1, attribute);
  }
});

// What the parser decodes is what the browser sees, so a coded spelling that decodes to the contract's value IS the contract's
// value and passes; any spelling that decodes to something else fails. Quoting, case and spacing are free for the same reason.
test('spellings: markup spelling that reads as the contract value passes, any value that reads differently fails (Ensaio s2)', () => {
  const variants: [string, string, boolean][] = [
    ['single quotes', OPEN_FORM.replace('method="post" action="/donations/api/v1/checkout"', "method='post' action='/donations/api/v1/checkout'"), true],
    ['unquoted values', OPEN_FORM.replace('method="post" action="/donations/api/v1/checkout"', 'method=post action=/donations/api/v1/checkout'), true],
    ['upper-case tag and attribute names', OPEN_FORM.replace('<form id="donation-form" method="post"', '<FORM ID="donation-form" METHOD="post"').replace('</form>', '</FORM>'), true],
    ['upper-case method and type values', OPEN_FORM.replace('method="post"', 'method="POST"').replace('type="hidden"', 'type="HIDDEN"'), true],
    ['line breaks and tabs inside the tag', OPEN_FORM.replace('method="post" action', 'method="post"\n\t action'), true],
    ['attributes in another order', OPEN_FORM.replace('type="text" inputmode="decimal" required maxlength="14"', 'maxlength="14" required inputmode="decimal" type="text"'), true],
    ['an entity that decodes to the action', OPEN_FORM.replace('action="/donations', 'action="&#47;donations'), true],
    ['an entity that decodes to the field name', OPEN_FORM.replace('name="amount"', 'name="am&#111;unt"'), true],
    ['an entity that decodes to the method', OPEN_FORM.replace('method="post"', 'method="po&#115;t"'), true],
    ['an entity that decodes to the locale', OPEN_FORM.replace('value="pt-br"', 'value="pt&#45;br"'), true],
    ['an entity that decodes to the maxlength', OPEN_FORM.replace('maxlength="14"', 'maxlength="&#49;4"'), true],
    ['a query string on the action', OPEN_FORM.replace('checkout"', 'checkout?x=1"'), false],
    ['a trailing space in the action', OPEN_FORM.replace('checkout"', 'checkout "'), false],
    ['a duplicated action (the first one wins)', OPEN_FORM.replace('action="/donations/api/v1/checkout"', 'action="/elsewhere" action="/donations/api/v1/checkout"'), false],
    ['a capital in a field name', OPEN_FORM.replace('name="amount"', 'name="Amount"'), false],
    ['an entity that decodes to another name', OPEN_FORM.replace('name="amount"', 'name="amount&#95;cents"'), false],
    ['an entity that decodes to another locale', OPEN_FORM.replace('value="pt-br"', 'value="en&#45;us"'), false],
    ['a quoted greater-than hiding an override', OPEN_FORM.replace('<button type="submit">', '<input type="text" value="a>b" formaction="https://pay.example/"><button type="submit">'), false],
  ];
  for (const [label, form, accepted] of variants) {
    const found = errors(supportPage(openPage(openBlock(form)), 'p', OPEN));
    assert.equal(found === 0, accepted, `${label}: ${found} error(s)`);
  }
});

// Sentinela's proofs of concept (re-checks of P2-09, confirmed in Chromium): each one hides a control or a form from a
// hand-written scanner while a browser builds it. The parser builds it too, so each is found. `evil` is a button tied to the form.
const EVIL = '<button form=donation-form formaction=/x name=evil value=1>go</button>';
const POCS: [string, string][] = [
  ['A: an unquoted value ending in a quote', '<button form=donation-form formaction=/x name=evil value=a">go</button>'],
  ['B: a second form whose unquoted value ends in a quote', '<form method=post action=//evil.example/ id=a"><input name=amount></form>'],
  ['D1: a no-break space after the tag name, the button inside a quoted value', `<p\u00a0x=">${EVIL}">`],
  ['D2: a vertical tab after the tag name, same', `<p\u000Bx=">${EVIL}">`],
  ['E1: an svg script with src and markup inside it', `<svg><script src="/_astro/x.js"><p>${EVIL}</p></script></svg>`],
  ['E2: an svg script of type ld+json and markup inside it', `<svg><script type="application/ld+json"><p>${EVIL}</p></script></svg>`],
  ['E3: an svg style and markup inside it', `<svg><style><p>${EVIL}</p></style></svg>`],
  ['a noscript holding the form-tied button (markup when scripting is off)', `<noscript>${EVIL}</noscript>`],
  ['a template holding the form-tied button', `<template>${EVIL}</template>`],
  ['the plain control', EVIL],
];

test('Sentinela proofs of concept: every one is refused after the block, in the open page and in the not-open page', () => {
  for (const [label, extra] of POCS) {
    assert.ok(errors(supportPage(openPage(openBlock(), extra), 'p', OPEN)) >= 1, `open: ${label}`);
    assert.ok(errors(supportPage(notOpenPage(NOT_OPEN, extra), 'p', MESSAGE)) >= 1, `not open: ${label}`);
    assert.ok(donationsBlock(openPage(openBlock(), extra), 'live', 'pt-br').findings.length > 0, `monitor: ${label}`);
  }
  // The same tags inside the block.
  for (const [label, extra] of POCS) assert.ok(errors(supportPage(openPage(swap('</form>', `${extra}</form>`)), 'p', OPEN)) >= 1, `in the block: ${label}`);
});

test('markup the standard calls an error is refused, whatever it would mean after recovery', () => {
  const broken: [string, string][] = [
    ['a stray "<"', '<p>1 < 2</p>'],
    ['a "<" before a space', '< form action="/x">'],
    ['a CDATA section in html', '<![CDATA[ x ]]>'],
    ['a processing instruction', '<?php x ?>'],
    ['a missing space between attributes', '<a href="/x"title="y">x</a>'],
    ['a duplicated attribute', '<a href="/x" href="//evil.example/">x</a>'],
    ['a quote in an attribute name', '<a x"y="z">x</a>'],
    ['an unexpected character in an unquoted value', '<a href=/x"y>x</a>'],
    ['an end tag with attributes', '<p>x</p a="b">'],
  ];
  for (const [label, extra] of broken) {
    assert.ok(errors(supportPage(openPage(openBlock(), extra), 'p', OPEN)) >= 1, `open: ${label}`);
    assert.ok(errors(supportPage(notOpenPage(NOT_OPEN, extra), 'p', MESSAGE)) >= 1, `not open: ${label}`);
  }
  assert.ok(errors(supportPage(`<main>${NOT_OPEN}</main>`, 'p', MESSAGE)) >= 1, 'a fragment with no doctype');
});

test('what a browser reads as plain text is not a finding: honest markup passes, and inert text is not mistaken for a control', () => {
  const honest = [
    '<a href="/pt-br/" title="a>b" data-x="it\'s" hidden>x</a><br/>',
    '<script type="application/ld+json">{"a":"<b>"}</script>',
    '<style>a > b { c: "d" }</style>',
    '<textarea><form action="/x"></textarea>',
    '<xmp><form action="/x"></xmp>',
    '<!-- <form action="/x"> -->',
    '<p>5 &lt; 6 and a &amp; b</p>',
  ];
  for (const extra of honest) assert.equal(errors(supportPage(openPage(openBlock(), extra), 'p', OPEN)), 0, extra);
});

test('the whole support page is scanned, not only the block: no form attribute, no override, no named control outside (Sentinela S2)', () => {
  const stray: [string, string][] = [
    ['a form attribute on a control outside', '<input name="amount" form="donation-form">'],
    ['a form attribute on a button outside', '<button type="submit" form="donation-form">Doar</button>'],
    ['a form attribute without a name', '<input type="hidden" form="donation-form">'],
    ['formaction on a link', '<a href="/x" formaction="https://pay.example/">x</a>'],
    ['formaction on a button outside', '<button formaction="https://pay.example/">x</button>'],
    ['formmethod on a button outside', '<button formmethod="get">x</button>'],
    ['formtarget on a button outside', '<button formtarget="_blank">x</button>'],
    ['formenctype on a button outside', '<button formenctype="multipart/form-data">x</button>'],
    ['formnovalidate on a button outside', '<button formnovalidate>x</button>'],
    ['a named control outside, no form attribute', '<input name="display_name">'],
    ['a named select outside', '<select name="amount"></select>'],
    ['a named fieldset outside', '<fieldset name="amount"></fieldset>'],
    ['a quoted greater-than before a form attribute', '<input title="a>b" form="donation-form">'],
    ['a quoted greater-than before formaction', '<a title=\'x>y\' formaction="https://pay.example/">x</a>'],
  ];
  for (const [label, extra] of stray) {
    assert.ok(errors(supportPage(openPage(openBlock(), extra), 'p', OPEN)) >= 1, `open: ${label}`);
    assert.ok(errors(supportPage(notOpenPage(NOT_OPEN, extra), 'p', MESSAGE)) >= 1, `not open: ${label}`);
  }
  assert.equal(errors(supportPage(openPage(openBlock(), '<a href="/pt-br/" title="a>b">ok</a>'), 'p', OPEN)), 0, 'a quoted greater-than in an honest attribute is fine');
});

test('the live monitor reads the same page: the open form passes with the path locale, a stray override or the wrong locale fails (Alicerce S2)', () => {
  assert.deepEqual(donationsBlock(openPage(), 'live', 'pt-br').findings, []);
  assert.equal(donationsBlock(openPage(), 'live', 'pt-br').state, 'open');
  assert.ok(donationsBlock(openPage(), 'live', 'en-us').findings.length > 0, 'a pt-br form on the en-us path');
  assert.deepEqual(donationsBlock(openPage(), 'live').findings, [], 'without a path locale it accepts either');
  assert.ok(donationsBlock(openPage(openBlock(), '<a title="a>b" formaction="https://x.test/">x</a>'), 'live', 'pt-br').findings.length > 0);
  assert.equal(donationsBlock(notOpenPage(), 'live', 'pt-br').state, 'not-open');
  assert.equal(donationsBlock(documentOf(''), 'live').state, 'invalid');
});

// Why the page is read twice: a `noscript` in `head` is text when scripting is on and markup when it is off, so a second referrer meta
// inside it exists for a visitor without scripts and not for one with them. Only the scripting-off reading sees it (Sentinela G).
test('the meta checks run on both readings: a referrer or charset meta that exists only when scripting is off is found (Sentinela S9)', () => {
  const only = (inNoscript: string) => documentOf(NOT_OPEN, `<meta charset="utf-8">${REFERRER}<noscript>${inNoscript}</noscript>`);
  assert.deepEqual(supportPage(only(''), 'p', MESSAGE), [], 'an empty noscript is harmless');
  const hostile: [string, string][] = [
    ['a second referrer meta with another policy', '<meta name="referrer" content="unsafe-url">'],
    ['a second referrer meta with the same policy', REFERRER],
  ];
  for (const [label, inside] of hostile) {
    assert.equal(noReferrerMeta(only(inside), 'p').length, 1, `referrer: ${label}`);
    assert.ok(errors(supportPage(only(inside), 'p', MESSAGE)) >= 1, `page: ${label}`);
  }
  // The charset meta must be first in both readings: a noscript that opens the head breaks it in both.
  assert.equal(charsetFirst(documentOf(NOT_OPEN, '<noscript><meta charset="utf-8"></noscript><meta charset="utf-8">'), 'p').length, 1);
  assert.equal(charsetFirst(documentOf(NOT_OPEN, `<meta charset="utf-8">${REFERRER}`), 'p').length, 0);
});

test('the encoding and referrer metas are read from the parsed head', () => {
  assert.equal(noReferrerMeta(documentOf('', `<meta charset="utf-8">${REFERRER}`), 'p').length, 0);
  assert.equal(noReferrerMeta(documentOf('', '<META NAME="Referrer" CONTENT="No-Referrer">'), 'p').length, 0);
  assert.equal(noReferrerMeta(documentOf('<p title="<meta name=referrer content=no-referrer>">x</p>', '<meta charset="utf-8">'), 'p').length, 1, 'inside an attribute is not a tag');
  assert.equal(charsetFirst(documentOf(''), 'p').length, 0);
  assert.equal(charsetFirst(documentOf('', '<META CHARSET="UTF-8">'), 'p').length, 0);
  for (const head of ['', REFERRER, `<meta http-equiv="content-type" content="text/html; charset=utf-8">${REFERRER}`, `<title>x</title><meta charset="utf-8">`, '<meta charset="utf-16">']) {
    assert.equal(charsetFirst(documentOf('', head), 'p').length, 1, head);
  }
});

test('donations.status and the legal gate: the build refuses open while the legal texts are pending (m4)', () => {
  const data = (status: unknown) => ({ donations: { status }, goal: {} });
  assert.deepEqual(supportStatus(data('not-open'), true), { status: 'not-open', findings: [] });
  assert.deepEqual(supportStatus(data('not-open'), false), { status: 'not-open', findings: [] });
  assert.deepEqual(supportStatus(data('open'), false), { status: 'open', findings: [] });
  const gated = supportStatus(data('open'), true);
  assert.equal(gated.status, 'open');
  assert.equal(errors(gated.findings), 1, 'open with the legal texts pending fails');
  for (const bad of [data('opening'), data(undefined), data(true), { donations: 'open' }, { donations: null }, {}, null, 'open', 7]) {
    const result = supportStatus(bad, false);
    assert.equal(result.status, undefined, JSON.stringify(bad));
    assert.equal(errors(result.findings), 1, JSON.stringify(bad));
  }
});

test('/donations/ is reserved, and the donations parts exist on the support pages only (P2-09)', () => {
  assert.equal(reservedDonationsPath(['pt-br/support/index.html', 'donations', 'donations/healthz', 'donationsx/a']).length, 2);
  assert.equal(donationsBlockElsewhere('<p data-donations="not-open">x</p>', 'q').length, 1);
  assert.equal(donationsBlockElsewhere('<div data-donations-panel hidden></div>', 'q').length, 1);
  assert.equal(donationsBlockElsewhere('<script type="module" src="/_astro/DonationsPanel.astro_astro_type_script_index_0_lang.x.js"></script>', 'q').length, 1);
  assert.equal(donationsBlockElsewhere('<p title="a>b" data-donations="open">x</p>', 'q').length, 1);
  assert.equal(donationsBlockElsewhere('<a x=a" data-donations=open>x</a>', 'q').length, 1, 'raw text: behind an unquoted quote');
  assert.equal(donationsBlockElsewhere('<!-- data-donations-panel -->', 'q').length, 1, 'raw text: in a comment');
  assert.equal(donationsBlockElsewhere('<p>x</p><script type="module" src="/_astro/page.abc.js"></script>', 'q').length, 0);
});
