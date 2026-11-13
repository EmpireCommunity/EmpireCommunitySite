import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discordChooser, discordLinks, discordPage, internalDiscordLinks } from '../scripts/lib/dist-checks.ts';

const inviteUrl = 'https://discord.com/invite/approved';
const whatsappUrl = 'https://chat.whatsapp.com/group';
const expected = { locale: 'pt-br' as const, inviteUrl, whatsappUrl, date: '27 de fevereiro de 2025', rules: [{ title: 'Spam', body: 'Do not spam.' }], closing: 'Thank you.' };
const gate = `<html lang="pt-BR"><head><meta name="robots" content="noindex"></head><main><h1>Rules</h1><p>${expected.date}</p><h2>Spam</h2><p>Do not spam.</p><p>Thank you.</p><p>https://discord.com/terms</p><section class="gate"><input type="checkbox" id="agree" class="agree" autocomplete="off"><label for="agree">I agree</label><div class="gate-links"><a href="${inviteUrl}" rel="noopener noreferrer">Discord</a><a href="${whatsappUrl}" rel="noopener noreferrer">WhatsApp</a></div></section></main></html>`;

test('locale gate validates one group, owner rules/date and following join links', () => {
  assert.deepEqual(discordPage(gate, 'pt-br/discord/index.html', expected), []);
  const bad = [
    gate.replace('class="gate"', 'class="other"'), gate.replace('autocomplete="off"', 'name="agreement"'),
    gate.replace('for="agree"', 'for="other"'), gate.replace('Do not spam.', 'Changed rule'),
    gate.replace('Thank you.', ''), gate.replace(expected.date, ''),
    gate.replace('<main>', `<main><a href="${inviteUrl}">early</a>`),
    gate.replace('</section>', '').replace('</main>', '</section></main>'),
    gate.replace('class="agree"', 'class="other"'), gate.replace('<head>', '<head><script src="/a.js"></script>'),
    gate.replace('noindex', 'index'), gate.replace('<main>', '<main><form>'),
    gate.replace('<head>', '<head><meta http-equiv="refresh" content="0">'),
    gate.replace('rel="noopener noreferrer"', ''), gate.replace('</main>', `<a href="${whatsappUrl}">extra</a></main>`),
    gate.replace('<head>', '<head><title>WhatsApp</title>'),
    gate.replace('autocomplete="off"', 'autocomplete="off" disabled'), gate.replace('autocomplete="off"', 'autocomplete="off" checked'),
  ];
  for (const html of bad.filter((html) => html !== gate)) assert.ok(discordPage(html, 'pt-br/discord/index.html', expected).length > 0, html);
  const en = gate.replace('lang="pt-BR"', 'lang="en-US"').replace(/<a href="https:\/\/chat.whatsapp.com\/group"[^>]*>WhatsApp<\/a>/, '');
  assert.deepEqual(discordPage(en, 'en-us/discord/index.html', { ...expected, locale: 'en-us' }), []);
  assert.ok(discordPage(gate.replace('lang="pt-BR"', 'lang="en-US"'), 'en-us/discord/index.html', { ...expected, locale: 'en-us' }).length > 0);
});

const chooser = '<html lang="en-US"><head><meta name="robots" content="noindex"></head><main><a href="/pt-br/discord/" lang="pt-BR">Português (Brasil)</a><a href="/en-us/discord/" lang="en-US">English</a></main></html>';
test('neutral chooser contains the two locale links and no gate, rules, invite, WhatsApp or script', () => {
  assert.deepEqual(discordChooser(chooser, 'discord/index.html', ['Do not spam.']), []);
  for (const html of [chooser.replace('pt-BR', 'en-US'), chooser.replace('/pt-br/discord/', '/pt-br/'),
    chooser.replace('English', 'Wrong label'), chooser.replace('</main>', '<input type="checkbox"></main>'),
    chooser.replace('</main>', '<p>Do not spam.</p></main>'), chooser.replace('</main>', `<a href="${inviteUrl}">Join</a></main>`),
    chooser.replace('<head>', '<head><script src="/a.js"></script>'), chooser.replace('noindex', 'index'),
    chooser.replace('<head>', '<head><link rel="canonical" href="/discord">'), chooser.replace('</main>', '<p>WhatsApp</p></main>')]) {
    assert.ok(discordChooser(html, 'discord/index.html', ['Do not spam.']).length > 0, html);
  }
});

test('site join links use the current locale gate; the language selector may switch locales', () => {
  const good = '<a href="/pt-br/discord/">Join</a><a href="/en-us/discord/" hreflang="en-US" lang="en-US">English</a>';
  assert.deepEqual(internalDiscordLinks(good, 'pt-br/join/index.html', 'pt-br'), []);
  for (const href of ['/discord', '/discord/', 'https://empirecommunity.org/discord?x=1', '/en-us/discord/']) {
    assert.ok(internalDiscordLinks(`<a href="${href}">Join</a>`, 'pt-br/index.html', 'pt-br').length > 0, href);
  }
});

test('regression: published comments cannot hide Discord URLs from the dist scan', () => {
  const comment = `<!-- <a href="${inviteUrl}">invite</a> -->`;
  assert.ok(discordLinks(comment, 'en-us/index.html', 'approved', false).length > 0);
  assert.ok(discordChooser(chooser + comment, 'discord/index.html').length > 0);
  assert.ok(discordPage(gate + comment, 'pt-br/discord/index.html', expected).length > 0);
});
