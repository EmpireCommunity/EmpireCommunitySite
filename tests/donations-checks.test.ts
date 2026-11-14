import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  donationsBlock, donationsBlockElsewhere, noReferrerMeta, reservedDonationsPath, supportPage, supportStatus,
} from '../scripts/lib/donations-checks.ts';

const errors = (findings: { level?: string }[]) => findings.filter((f) => f.level === 'error').length;

const MESSAGE = 'Money donations are not open yet.';
const REFERRER = '<meta name="referrer" content="no-referrer">';
const NOT_OPEN = `<p data-donations="not-open" class="x">${MESSAGE}</p>`;
const notOpenPage = (block = NOT_OPEN, extra = '') => `<head>${REFERRER}</head><main>${block}${extra}</main>`;

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
const openPage = (block = openBlock(), extra = '') => `<head>${REFERRER}</head><main>${block}${extra}</main>`;
const OPEN = { status: 'open', notOpenMessage: MESSAGE, locale: 'pt-br' } as const;
const swap = (from: string, to: string) => {
  assert.ok(OPEN_FORM.includes(from), `the fixture has "${from}"`);
  return openBlock(OPEN_FORM.replace(from, to));
};

test('support page, not open: one plain-text block, no form, no panel, no Donations script, the no-referrer meta, no beacon (D-28, P2-09)', () => {
  assert.equal(supportPage(notOpenPage(), 'p', MESSAGE).length, 0);
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
    ['no referrer meta', `<main>${NOT_OPEN}</main>`],
    ['a referrer meta with another policy', `<head><meta name="referrer" content="origin"></head><main>${NOT_OPEN}</main>`],
    ['two referrer metas', `<head>${REFERRER}${REFERRER}</head><main>${NOT_OPEN}</main>`],
  ];
  for (const [label, html] of bad) assert.ok(errors(supportPage(html, 'p', MESSAGE)) >= 1, label);
  assert.equal(supportPage(notOpenPage(NOT_OPEN, '<p data-donations="soon">soon</p>'), 'p', MESSAGE).length, 0, 'the soon notice belongs to the not-open page');
});

test('support page, open: one form that posts to the donations service and to nothing else (P2-09)', () => {
  assert.equal(supportPage(openPage(), 'p', OPEN).length, 0);
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
    ['an iframe in the block', openPage(swap('</form>', '</form><iframe src="/x"></iframe>'))],
    ['an embed in the block', openPage(swap('</form>', '</form><embed src="/x">'))],
    ['a base in the block', openPage(swap('</form>', '</form><base href="/">'))],
    ['an amount without inputmode decimal', openPage(swap(' inputmode="decimal"', ''))],
    ['an amount with another inputmode', openPage(swap('inputmode="decimal"', 'inputmode="numeric"'))],
    ['a preset container that is not hidden', openPage(swap('data-amount-presets hidden', 'data-amount-presets'))],
    ['two submit buttons', openPage(swap('</form>', '<button type="submit">Again</button></form>'))],
    ['a script inside the block', openPage(swap('</form>', '</form><script>x()</script>'))],
    ['a meta inside the block', openPage(swap('</form>', '</form><meta http-equiv="refresh" content="0;url=https://x.test">'))],
    ['a link element inside the block', openPage(swap('</form>', '</form><link rel="prefetch" href="/x">'))],
    ['a second form outside the block', openPage(openBlock(), '<form action="/x"></form>')],
    ['the soon notice beside the open block', openPage(openBlock(), '<p data-donations="soon">soon</p>')],
    ['both blocks', openPage(openBlock(), '<p data-donations="not-open">x</p>')],
    ['no block', openPage('')],
    ['an unclosed block', openPage('<div data-donations="open"><form></form>')],
    ['no referrer meta', `<main>${openBlock()}</main>`],
  ];
  for (const [label, html] of bad) assert.ok(errors(supportPage(html, 'p', OPEN)) >= 1, label);
  // The state must be the one the site data asks for, either way round.
  assert.equal(errors(supportPage(openPage(), 'p', { status: 'not-open', notOpenMessage: MESSAGE, locale: 'pt-br' })), 1);
  assert.equal(errors(supportPage(openPage('<p data-donations="not-open">x</p>'), 'p', OPEN)), 1);
});

test('every address in the open block is local: one slash that is not followed by a slash or a backslash, or a fragment (Sentinela S1)', () => {
  const local = ['/pt-br/terms-of-service/', '/pt-br/privacy-policy/#donations', '#obrigado', '/x?y=1'];
  for (const href of local) assert.equal(errors(supportPage(openPage(swap('</form>', `</form><a href="${href}">x</a>`)), 'p', OPEN)), 0, href);
  const foreign = [
    'https://pay.example/', 'http://pay.example/', '//pay.example/', '/\\pay.example/', '\\\\pay.example/', ' /x', '\t/x', 'javascript:alert(1)',
    'data:text/html,x', 'mailto:a@b.c', 'x/y', '', '&#47;&#47;pay.example/', '&#x2F;pay.example', 'java&#115;cript:x',
  ];
  for (const href of foreign) assert.ok(errors(supportPage(openPage(swap('</form>', `</form><a href="${href}">x</a>`)), 'p', OPEN)) >= 1, JSON.stringify(href));
  for (const [attribute, tag] of [['src', 'img'], ['srcset', 'img'], ['poster', 'video'], ['data', 'span'], ['xlink:href', 'a'], ['ping', 'a']] as const) {
    assert.ok(errors(supportPage(openPage(swap('</form>', `</form><${tag} ${attribute}="https://pay.example/x">x</${tag}>`)), 'p', OPEN)) >= 1, attribute);
  }
});

// One table pins what the checks read as the contract's value and what they refuse as a coded variant (Ensaio s2): case and
// spacing of the markup are free, but quoting other than double quotes, an entity, a suffix, a duplicate or a different case
// of a NAME is not the value the contract names, because the grammar is strict and attribute values are compared as written.
test('coded variants: case and spacing of the markup are free, a coded or altered value, or any quoting but double quotes, fails closed', () => {
  const variants: [string, string, boolean][] = [
    ['single quotes (the strict grammar takes double-quoted values only)', OPEN_FORM.replace('method="post" action="/donations/api/v1/checkout"', "method='post' action='/donations/api/v1/checkout'"), false],
    ['unquoted values (same)', OPEN_FORM.replace('method="post" action="/donations/api/v1/checkout"', 'method=post action=/donations/api/v1/checkout'), false],
    ['upper-case tag and attribute names', OPEN_FORM.replace('<form id="donation-form" method="post"', '<FORM ID="donation-form" METHOD="post"').replace('</form>', '</FORM>'), true],
    ['upper-case method and type values', OPEN_FORM.replace('method="post"', 'method="POST"').replace('type="hidden"', 'type="HIDDEN"'), true],
    ['line breaks and tabs inside the tag', OPEN_FORM.replace('method="post" action', 'method="post"\n\t action'), true],
    ['attributes in another order', OPEN_FORM.replace('type="text" inputmode="decimal" required maxlength="14"', 'maxlength="14" required inputmode="decimal" type="text"'), true],
    ['an entity in the action', OPEN_FORM.replace('action="/donations', 'action="&#47;donations'), false],
    ['a query string on the action', OPEN_FORM.replace('checkout"', 'checkout?x=1"'), false],
    ['a trailing space in the action', OPEN_FORM.replace('checkout"', 'checkout "'), false],
    ['a duplicated action (the first one wins)', OPEN_FORM.replace('action="/donations/api/v1/checkout"', 'action="/elsewhere" action="/donations/api/v1/checkout"'), false],
    ['an entity in a field name', OPEN_FORM.replace('name="amount"', 'name="am&#111;unt"'), false],
    ['a capital in a field name', OPEN_FORM.replace('name="amount"', 'name="Amount"'), false],
    ['an entity in the method', OPEN_FORM.replace('method="post"', 'method="po&#115;t"'), false],
    ['an entity in the locale value', OPEN_FORM.replace('value="pt-br"', 'value="pt&#45;br"'), false],
    ['an entity in a number', OPEN_FORM.replace('maxlength="14"', 'maxlength="&#49;4"'), false],
    ['a quoted greater-than hiding an override', OPEN_FORM.replace('<button type="submit">', '<input type="text" value="a>b" formaction="https://pay.example/"><button type="submit">'), false],
  ];
  for (const [label, form, accepted] of variants) {
    const found = errors(supportPage(openPage(openBlock(form)), 'p', OPEN));
    assert.equal(found === 0, accepted, `${label}: ${found} error(s)`);
  }
});

test('the whole support page is scanned, not only the block: no form attribute, no override, no named control outside, even behind a quoted greater-than (Sentinela S2)', () => {
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
    ['a quoted greater-than before a form attribute', '<input title="a>b" form="donation-form">'],
    ['a quoted greater-than before formaction', '<a title=\'x>y\' formaction="https://pay.example/">x</a>'],
  ];
  for (const [label, extra] of stray) {
    assert.ok(errors(supportPage(openPage(openBlock(), extra), 'p', OPEN)) >= 1, `open: ${label}`);
    assert.ok(errors(supportPage(notOpenPage(NOT_OPEN, extra), 'p', MESSAGE)) >= 1, `not open: ${label}`);
  }
  // The same tags INSIDE the block are found too, behind a quoted greater-than.
  assert.ok(errors(supportPage(openPage(swap('<button type="submit">', '<input type="text" title="a>b" formaction="https://pay.example/"><button type="submit">')), 'p', OPEN)) >= 1);
  assert.ok(errors(supportPage(openPage(swap('<button type="submit">', '<input type="text" title="a>b" name="email"><button type="submit">')), 'p', OPEN)) >= 1);
  assert.equal(errors(supportPage(openPage(openBlock(), '<a href="/pt-br/" title="a>b">ok</a>'), 'p', OPEN)), 0, 'a quoted greater-than in an honest attribute is fine');
});

// Sentinela's proof of concept (P2-09 re-check M1 and M2): the page is read by the strict grammar, so nothing hides in a
// stretch a tolerant scanner would read as one quoted value, and an address is judged as the browser resolves it.
test('strict grammar: a quote that is not a double-quoted value, a comment or a stray "<" is a finding, so nothing hides behind it (Sentinela M1)', () => {
  const after: [string, string][] = [
    ['A: a form-tied button whose unquoted value ends in a quote', '<button form=donation-form formaction=/x name=evil value=a">go</button>'],
    ['B: a second form whose unquoted value ends in a quote', '<form method=post action=//evil.example/ id=a"><input name=amount></form>'],
    ['a single-quoted value', "<a title='x' href='/pt-br/'>x</a>"],
    ['an unquoted value', '<a href=/pt-br/>x</a>'],
    ['a quote inside a bare attribute name', '<a x"y="z">x</a>'],
    ['a comment', '<!-- <form action="/x"> -->'],
    ['a comment that hides a quote', '<!-- " --><p>x</p>'],
    ['a CDATA section', '<![CDATA[ x ]]>'],
    ['a processing instruction', '<?php x ?>'],
    ['a stray "<"', '<p>1 < 2</p>'],
    ['a "<" before a space', '< form action="/x">'],
    ['a noscript element', '<noscript><form action="/x"></form></noscript>'],
    ['a template element', '<template><input name="amount" form="donation-form"></template>'],
    ['a textarea element', '<textarea><form action="/x"></textarea>'],
    ['an xmp element', '<xmp><form action="/x"></xmp>'],
    ['an unclosed script', '<script>var x = 1;'],
    ['an empty noscript (the element itself)', '<noscript></noscript>'],
    ['an empty template (the element itself)', '<template></template>'],
    ['an empty textarea (the element itself)', '<textarea></textarea>'],
  ];
  for (const [label, extra] of after) {
    assert.ok(errors(supportPage(openPage(openBlock(), extra), 'p', OPEN)) >= 1, `open: ${label}`);
    assert.ok(errors(supportPage(notOpenPage(NOT_OPEN, extra), 'p', MESSAGE)) >= 1, `not open: ${label}`);
    assert.ok(donationsBlock(openPage(openBlock(), extra), 'live', 'pt-br').findings.length > 0, `monitor: ${label}`);
  }
  // What the strict grammar does accept: the doctype, double-quoted values with a ">" or a single quote inside, bare attributes,
  // self-closing tags, and the text of a script or a style (read as the browser reads it, not as markup).
  const honest = '<!doctype html><a href="/pt-br/" title="a>b" data-x="it\'s" hidden>x</a><br/><script type="application/ld+json">{"a":"<b>"}</script><style>a > b { c: "d" }</style>';
  assert.equal(errors(supportPage(openPage(openBlock(), honest), 'p', OPEN)), 0);
});

test('addresses in the block are judged as the browser resolves them: no "&", no control or space character, then the local rule (Sentinela M2)', () => {
  const inBlock = (href: string) => openPage(swap('</form>', `</form><a href="${href}">x</a>`));
  const refused = ['/&#47;evil.example/pay', '/&#x2F;evil.example/pay', '/&sol;evil.example', '/\t/evil.example/pay', '/\n/evil.example/pay', '/\r/evil.example', '/ /evil.example', '/\u0000/x', '/\u0085/x', '/x?a=1&b=2', '/x y'];
  for (const href of refused) assert.ok(errors(supportPage(inBlock(href), 'p', OPEN)) >= 1, JSON.stringify(href));
  for (const href of ['/pt-br/terms-of-service/#donations', '#obrigado', '/x?a=1']) assert.equal(errors(supportPage(inBlock(href), 'p', OPEN)), 0, href);
  // The two PoC hosts: these resolve outside the site once the browser has dropped the tab or read the reference.
  for (const href of ['/&#47;evil.example/pay', '/\t/evil.example/pay']) {
    assert.equal(new URL(href.replace('&#47;', '/'), 'https://empirecommunity.org/pt-br/support/').host, 'evil.example', href);
  }
});

test('the live monitor reads the same page: the open form passes with the path locale, a stray override or the wrong locale fails (Alicerce S2)', () => {
  assert.deepEqual(donationsBlock(openPage(), 'live', 'pt-br').findings, []);
  assert.equal(donationsBlock(openPage(), 'live', 'pt-br').state, 'open');
  assert.ok(donationsBlock(openPage(), 'live', 'en-us').findings.length > 0, 'a pt-br form on the en-us path');
  assert.deepEqual(donationsBlock(openPage(), 'live').findings, [], 'without a path locale it accepts either');
  assert.ok(donationsBlock(openPage(openBlock(), '<a title="a>b" formaction="https://x.test/">x</a>'), 'live', 'pt-br').findings.length > 0);
  assert.equal(donationsBlock(notOpenPage(), 'live', 'pt-br').state, 'not-open');
  assert.equal(donationsBlock('<main></main>', 'live').state, 'invalid');
});

test('the no-referrer meta is read from real tags', () => {
  assert.equal(noReferrerMeta(REFERRER, 'p').length, 0);
  assert.equal(noReferrerMeta('<META NAME="Referrer" CONTENT="No-Referrer">', 'p').length, 0);
  assert.equal(noReferrerMeta('<p title="<meta name=referrer content=no-referrer>">x</p>', 'p').length, 1, 'inside an attribute is not a tag');
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
