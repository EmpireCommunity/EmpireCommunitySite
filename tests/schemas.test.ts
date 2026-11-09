import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HttpsUrl, Image, IsoDate, Localized } from '../src/schemas/common.ts';
import { GameServerSchema } from '../src/schemas/game-servers.ts';
import { JoinChannelSchema } from '../src/schemas/join-channels.ts';
import { LegalSchema } from '../src/schemas/legal.ts';
import { ProjectSchema } from '../src/schemas/projects.ts';
import { TeamMemberSchema } from '../src/schemas/team.ts';

const both = (text: string) => ({ 'pt-br': text, 'en-us': text });
const consent = {
  given: true,
  isAdult: true,
  recordedOn: '2026-01-01',
  evidenceRef: 'CONS-0001',
  scope: ['nickname', 'role'],
  historyNoticeGiven: true,
  reviewOn: '2027-01-01',
};
const member = { id: 'p-3f9a1c7d2b40', nickname: 'Fulano', role: both('Mod'), consent };

describe('team consent (C-4)', () => {
  test('accepts a nickname-only entry whose scope covers every present field', () => {
    assert.equal(TeamMemberSchema.safeParse(member).success, true);
  });

  const rejected: [string, unknown][] = [
    ['no consent block', { ...member, consent: undefined }],
    ['consent.given is false', { ...member, consent: { ...consent, given: false } }],
    ['not marked adult', { ...member, consent: { ...consent, isAdult: false } }],
    ['history notice not given', { ...member, consent: { ...consent, historyNoticeGiven: false } }],
    ['missing evidenceRef', { ...member, consent: { ...consent, evidenceRef: undefined } }],
    ['name without name in scope', { ...member, name: 'Nome Real' }],
    ['bio without bio in scope', { ...member, bio: both('texto') }],
    ['scope without name or nickname', { ...member, nickname: undefined, consent: { ...consent, scope: ['role'] } }],
    ['id derived from a name', { ...member, id: 'fulano' }],
  ];
  for (const [label, input] of rejected) {
    test(`rejects ${label}`, () => {
      assert.equal(TeamMemberSchema.safeParse(input).success, false);
    });
  }
});

describe('shared rules', () => {
  const badUrls = ['http://example.com/', 'https://user:pass@example.com/', 'https://example.com/?utm_source=x', 'https://example.com/?ref=a'];
  for (const url of badUrls) {
    test(`HttpsUrl rejects ${url}`, () => {
      assert.equal(HttpsUrl.safeParse(url).success, false);
    });
  }

  test('Localized fails when a translation is missing or carries markup', () => {
    assert.equal(Localized(20).safeParse({ 'pt-br': 'ok' }).success, false);
    assert.equal(Localized(20).safeParse(both('<b>x</b>')).success, false);
    assert.equal(Localized(20).safeParse(both('ok')).success, true);
  });
});

describe('entity rules', () => {
  const project = { id: 'site', name: 'Site', kind: 'site', status: 'in-development', summary: both('x'), order: 1 };
  test('project url only when live (D-7)', () => {
    assert.equal(ProjectSchema.safeParse({ ...project, url: 'https://example.org/' }).success, false);
    assert.equal(ProjectSchema.safeParse({ ...project, status: 'live', url: 'https://example.org/' }).success, true);
  });

  const server = { id: 'minecraft', name: 'Minecraft', summary: both('x') };
  test('game server howToJoin required when live, forbidden otherwise', () => {
    assert.equal(GameServerSchema.safeParse({ ...server, status: 'live' }).success, false);
    assert.equal(GameServerSchema.safeParse({ ...server, status: 'live', howToJoin: both('x') }).success, true);
    assert.equal(GameServerSchema.safeParse({ ...server, status: 'coming-soon', howToJoin: both('x') }).success, false);
    assert.equal(GameServerSchema.safeParse({ ...server, status: 'live', howToJoin: both('x'), address: '1.2.3.4' }).success, false);
  });

  test('WhatsApp channel is pt-br only (C-1); Discord uses the literal link', () => {
    const whatsapp = { id: 'whatsapp', url: 'https://chat.whatsapp.com/abc', audience: ['pt-br'], label: { 'pt-br': 'WhatsApp' }, description: { 'pt-br': 'x' } };
    assert.equal(JoinChannelSchema.safeParse(whatsapp).success, true);
    const leaked = { ...whatsapp, audience: ['pt-br', 'en-us'], label: both('WhatsApp'), description: both('x') };
    assert.equal(JoinChannelSchema.safeParse(leaked).success, false);
    const discord = { id: 'discord', url: 'https://discord.gg/abc', audience: ['pt-br', 'en-us'], label: both('Discord'), description: both('x') };
    assert.equal(JoinChannelSchema.safeParse(discord).success, false);
    assert.equal(JoinChannelSchema.safeParse({ ...discord, url: 'https://empirecommunity.org/discord' }).success, true);
  });
});

describe('IsoDate', () => {
  test('accepts real dates, including 29 February in a leap year', () => {
    for (const date of ['2026-12-01', '2028-02-29', '2026-12-31']) assert.equal(IsoDate.safeParse(date).success, true, date);
  });
  test('rejects dates that are not in the calendar', () => {
    for (const date of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-1-01'])
      assert.equal(IsoDate.safeParse(date).success, false, date);
  });
});

describe('Image src stays inside src/assets', () => {
  const image = (src: string) => Image.safeParse({ src, decorative: true }).success;
  test('accepts files under assets', () => {
    for (const src of ['../assets/logo.webp', '../assets/team/p-3f9a1c7d2b40.jpg', '../assets/a.b-c_d.png'])
      assert.equal(image(src), true, src);
  });
  test('rejects paths that leave src/assets or are not plain files', () => {
    const escapes = [
      '../assets/../../private/photo.png',
      '../assets/../secret.png',
      '../../assets/logo.png',
      '../assets/./logo.png',
      '../assets//logo.png',
      '../assets/.hidden.png',
      '../assets/logo.svg',
      'assets/logo.png',
    ];
    for (const src of escapes) assert.equal(image(src), false, src);
  });
});

describe('legal front matter', () => {
  const front = { title: 'Termos', slug: 'terms-of-service', locale: 'pt-br', version: '1.0' };
  test('an unquoted YAML date (parsed as a Date) and an ISO string are both accepted', () => {
    assert.equal(LegalSchema.safeParse({ ...front, effectiveDate: new Date(Date.UTC(2026, 11, 1)) }).success, true);
    assert.equal(LegalSchema.safeParse({ ...front, effectiveDate: '2026-12-01' }).success, true);
  });
  test('an invalid date is still rejected', () => {
    assert.equal(LegalSchema.safeParse({ ...front, effectiveDate: new Date(Number.NaN) }).success, false);
    assert.equal(LegalSchema.safeParse({ ...front, effectiveDate: '2026-02-30' }).success, false);
  });
});
