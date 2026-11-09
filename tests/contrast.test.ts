import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// WCAG 2.2 AA over the color tokens in src/styles/global.css (DESIGN.md "Contraste verificado"): 4.5:1 for text.
const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const color = (name: string): string => {
  const value = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1];
  assert.ok(value, `token --color-${name} is missing`);
  return value;
};

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};

const TEXT_ON_BACKGROUND: readonly (readonly [text: string, backgrounds: readonly string[]])[] = [
  ['papel', ['violeta-ata', 'violeta-capa', 'violeta-noite']],
  ['papel-suave', ['violeta-ata', 'violeta-capa', 'violeta-noite']],
  ['papel-apagado', ['violeta-ata', 'violeta-capa', 'violeta-noite']],
  ['status-no-ar', ['violeta-ata', 'violeta-capa', 'violeta-noite']],
  ['status-desenvolvimento', ['violeta-ata', 'violeta-capa', 'violeta-noite']],
  ['status-em-breve', ['violeta-ata', 'violeta-capa', 'violeta-noite']],
  ['livro-entrada', ['violeta-ata', 'violeta-capa', 'violeta-noite']],
  ['livro-saida', ['violeta-ata', 'violeta-capa', 'violeta-noite']],
  ['violeta-ata', ['papel', 'papel-hover', 'papel-active']],
];

test('every text token meets 4.5:1 on the backgrounds it is used on', () => {
  for (const [text, backgrounds] of TEXT_ON_BACKGROUND) {
    for (const background of backgrounds) {
      const value = ratio(color(text), color(background));
      assert.ok(value >= 4.5, `${text} on ${background} is ${value.toFixed(2)}:1`);
    }
  }
});

test('pauta-forte, the control outline, meets 3:1 on the page background', () => {
  assert.ok(ratio(color('pauta-forte'), color('violeta-ata')) >= 3);
});
