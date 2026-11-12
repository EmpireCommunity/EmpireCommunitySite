# T-69: revisão de design depois da revisão do dono no rc

Spec para a Vitral implementar e a Retina verificar. Risco: Low/Medium (UI). Base: o rc em `https://empirecommunity.org`
medido em 2026-11-12, `EmpireAssets/docs/EmpireCommunity-DESIGN.md` (fonte dos tokens) e as decisões D-29, D-36, D-40,
D-41 e D-42. Capturas do estado atual e do protótipo em `~/files/bussola-t69/`.

A direção O Livro-Ata Aberto continua: mesmas cores, fontes, filetes, linha pautada e regra de cor para dado. O que muda é
escala, densidade, largura e a identidade de cada página. Nenhum texto novo é criado; só há remoções, listadas em §5.

## 1. Diagnóstico medido

| Problema do dono | Medição no rc |
|---|---|
| Fonte grande, pouco cabe na tela | Título de toda página em Display de 72 px, corpo de 18 px, lead de 20 px, botões de 56 px, header de 72 px, seção de 96 px |
| Coluna estreita, lados vazios | Conteúdo para em 1312 px: em 1920 px sobram 304 px de cada lado. Lead limitado a 56 caracteres e texto a 68 |
| Título da Home longo | Três linhas de 72 px, 233 px de altura |
| Toda página parece igual | Home e páginas internas abrem com o mesmo título de 72 px no mesmo lugar. A página atual só tem sublinhado de 1 px no menu |
| `/discord` comprido | Duas versões na mesma URL, 2760 px de altura. A caixa de marcar fica em y = 1246 px em 1440 × 900 |

O dono usou zoom de 80%. Em 1920 px, 80% deixa o conteúdo ainda mais estreito na tela (1050 px físicos), então a
largura não vem do zoom. O alvo é o tamanho de letra e o espaçamento de 80%, com um container mais largo.

## 2. Tokens

### 2.1 Escala tipográfica

Peso e entrelinha continuam os mesmos, salvo onde a tabela indica. Fluido entre 390 e 1440 px, como hoje.

| Token | Antes (desktop / mobile) | Depois (desktop / mobile) | CSS |
|---|---|---|---|
| `display` | 72 / 40 | **56 / 36**, entrelinha 1.1 | `clamp(2.25rem, 1.786rem + 1.905vw, 3.5rem)` |
| `page-title` (novo) | — | **40 / 28**, peso 300, entrelinha 1.15 | `clamp(1.75rem, 1.471rem + 1.143vw, 2.5rem)` |
| `headline` | 42 / 32 | **32 / 24** | `clamp(1.5rem, 1.314rem + 0.762vw, 2rem)` |
| `figure` | 40 / 32 | **32 / 28** | `clamp(1.75rem, 1.657rem + 0.381vw, 2rem)` |
| `title` | 24 | **20** | `1.25rem` |
| `lead` | 20 | **18** | `1.125rem` |
| `body` | 18 | **16** | `1rem` |
| `body-sm` | 16 | **14** | `0.875rem` |
| `nav` | 16 | **15** | `0.9375rem` |
| `button` | 18 | **16** | `1rem` |
| `label` | 14 | **13** (novo mínimo do site) | `0.8125rem` |
| `ledger-amount` | 18 | **16** | `1rem` |

Regras de uso:

- `display` só existe no `h1` da Home.
- `page-title` é o `h1` de toda página interna, inclusive as legais, a 404 e as de regras (§4).
- O corpo fica em 16 px e não em 14,4 px (80% exatos) para manter leitura confortável e AA.

### 2.2 Largura e grade

| Item | Antes | Depois |
|---|---|---|
| Conteúdo máximo (`frame`) | 1312 px | **1600 px**: `max-width: calc(1600px + 2 * 48px)` |
| Margem lateral | 16 / 32 / 64 px | **16 / 32 / 48 px** (abaixo de 640, de 640 a 1023, a partir de 1024) |
| Índice (≥ 1024 px) | 4 + 8 colunas | **3 + 9 colunas**. A Margem passa para o início da coluna 4; a coluna direita tem 24 px de padding à esquerda (antes 32) |
| Medida do lead | 56ch | **64ch** |
| Medida do texto corrido | 68ch | **72ch** (vale para Índice, legal e FAQ) |
| `h1` da Home | 9 colunas | **10 colunas**: duas linhas a partir de 1366 px |

### 2.3 Espaçamento e alturas

Os tokens de espaçamento (4 a 128) não mudam; muda o uso.

| Item | Antes | Depois |
|---|---|---|
| Header | 56 px, 72 px a partir de 1024 | **56 px em todas as larguras** (lockup continua com 28 px de altura). Faixa de idioma de 44 px abaixo de 640 continua |
| `section-y` | 64 / 96 | **40 / 64** (abaixo de 1024, a partir de 1024) |
| Seção de texto do Índice | 48 / 64 | **32 / 48** |
| Linha pautada | padding 24, `lg:min-h-[92px]` nas linhas com links | **padding 16**, sem altura mínima fixa: a altura vem do conteúdo (o alvo de 44 px dos links continua) |
| Título de seção de linhas | desce 24 px para alinhar | desce **16 px** |
| Hero da Home | 96 acima, 96 abaixo; lead a 24; botões a 48 | **56 acima, 64 abaixo** (40 / 48 abaixo de 1024); lead a **16**; botões a **32** |
| Faça parte | 96 / 64 | **64 / 48** |
| Faixa de números, `figure-item` | `24px 32px 24px 0` | `16px 24px 16px 0` |

### 2.4 Botões de canal

Altura **48 px** (antes 56), largura **240 px** em par e sozinho (antes 280), texto `button` de 16 px, ícone de 20 px.
Canto, cores e estados iguais. Em `/discord` abaixo de 640 px, o par continua lado a lado (D-41), cada um com metade da
largura menos a medianiz de 16 px.

## 3. Identidade de página

Objetivo: em qualquer captura de tela dá para dizer se é a Home ou qual página interna é.

### 3.1 Header (todas as páginas)

- Filete `pauta` de 1 px na borda de baixo do header, em todas as páginas.
- **Item atual do menu:** texto `papel`, peso 500, e uma barra de 2 px em `papel` colada na borda de baixo do header
  (sobre o filete), com a largura do texto. Substitui o sublinhado de 1 px com `underline-offset-8`. `aria-current="page"`
  continua.
- Itens em repouso: `papel-suave`, peso 400. Hover: `papel`, sem barra.
- **Menu recolhido:** item atual em `papel`, peso 500, com barra de 2 px em `papel` à esquerda do texto
  (`border-inline-start`, 12 px de padding).
- **Seletor de idioma:** mantém o sublinhado de 1 px do idioma atual. Ele não usa a barra, para não competir com a página.
- **Logo:** sempre leva à Home da língua da página (correção em andamento na T-70). Na Home tem `aria-current="page"`.
- Na Home nenhum item do menu está marcado. Nas páginas de regras (§4) também não.

### 3.2 Home

Continua sem faixa: `h1` em `display` sobre `violeta-ata`, lead, botões de canal e A Margem se desenhando uma vez. É a
única página com `display` e com animação, e isso a separa das demais.

### 3.3 Páginas internas: faixa de cabeçalho

Componente novo, `page-head`, em Projetos, Infraestrutura, Participar, Apoiar, Organização, Termos, Privacidade, 404 e
nas páginas de regras.

| Elemento | Especificação |
|---|---|
| Fundo | Faixa de largura total em `violeta-capa`, logo abaixo do header. Sem filete embaixo: a troca de tom já separa |
| Padding vertical | 32 px a partir de 1024 px; 24 px abaixo |
| Grade (≥ 1024 px) | `h1` em `page-title`, `papel`, nas colunas 1 a 3; lead em `lead`, `papel-suave`, nas colunas 4 a 12, até 64ch, alinhado pela primeira linha de base do título (`align-items: baseline`) |
| Abaixo de 1024 px | Título em cima, lead 8 px abaixo |
| Conteúdo extra | Legenda de status (Projetos) e linha de versão (Termos, Privacidade) ficam abaixo do lead, na mesma coluna, em `body-sm` `papel-suave`, 8 px abaixo dele |
| Depois da faixa | O conteúdo começa 32 px abaixo (24 px abaixo de 1024) |

Uso de cor: `violeta-capa` já é token do sistema (painel do menu). Contraste: `papel` 11,97:1 e `papel-suave` 8,06:1
sobre `violeta-capa`. Isso aplica a regra do Flat Ledger ("muda de tom ou ganha um filete") sem cor nova.

### 3.4 Alvo de altura

Viewports de referência: **1920 × 953** (janela de 1920 × 1080 menos a interface do navegador) e **1536 × 730**
(1536 × 864, a tela de notebook mais comum, menos a interface).

| Página | Critério |
|---|---|
| Projetos, Infraestrutura, Participar | Todo o `<main>` termina acima de 953 px em 1920 × 953. O rodapé pode ficar abaixo da dobra |
| `/pt-br/discord/`, `/en-us/discord/` | Regras, caixa e botões visíveis juntos, sem rolar, em 1920 × 953 **e** 1536 × 730 (§4.3). Em 1366 × 657, medir e reportar |
| Home, Organização, Apoiar, legais | Rolam; o ganho vem da escala |

Medido no protótipo (CSS injetado sobre o rc, só escala e largura): Projetos caiu de 1723 para 1525 px de altura total,
antes de apertar as linhas e de aplicar a faixa de cabeçalho. A Retina confirma o critério na implementação.

## 4. `/discord` em um idioma por página

### 4.1 Rotas (dependem de acordo com o Alicerce, §6)

- Duas páginas: **`/pt-br/discord/`** (regras em pt-BR, botões Discord e WhatsApp) e **`/en-us/discord/`** (regras em
  en-US, só Discord). Mesmo slug nos dois idiomas, então o seletor de idioma já funciona.
- **`/discord`** continua sendo o endereço público (Discord, perfil do GitHub, D-49) e passa a escolher o idioma como `/`:
  Brasil para `/pt-br/discord/`, o resto para `/en-us/discord/`, 302, preservando a query.
- Botões e links de entrada **dentro do site** apontam direto para `/{locale}/discord/`, sem passar por `/discord`.
- Sem a regra (origem direta ou regra desligada), `/discord` mostra a mesma página neutra de escolha de `/`, com os dois
  links. É a minha recomendação; o Alicerce decide o fallback.
- As páginas continuam `noindex`, fora do sitemap e sem cookie, armazenamento ou script.

### 4.2 Layout

Usa o layout das páginas de idioma: header completo (com seletor, nenhum item do menu marcado) e rodapé. Sem A Margem.

```text
Desktop 1536 × 730
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▤ EmpireCommunity  Projetos Infraestrutura Participar Apoiar Org.  Português English │ 56
├──────────────────────────────────────────────────────────────────────────────┤
│ Regras da comunidade        Atualizadas em 27 de fevereiro de 2025           │ page-head (capa)
├──────────────────────────────────────────────────────────────────────────────┤
│ 1 - Proibição de Spam:                 │ 4 - Sem Propagação de Ódio:         │
│ texto                                  │ texto                               │
│ 2 - Identidade Falsa:                  │ 5 - Seguir as Diretrizes do Discord: │
│ texto                                  │ texto                               │
│ 3 - Proibição de Divulgação ...:       │ 6 - Conteúdo explícito +18:         │
│ texto                                  │ texto                               │
│ Qualquer violação dessa regra resultará em medidas disciplinares apropriadas. │
│ ──────────────────────────────────────────────────────────────────────────── │
│ ☐ Li as regras e concordo com elas.        [ Discord ]  [ WhatsApp ]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Elemento | Especificação |
|---|---|
| Cabeçalho | `page-head` (§3.3). `h1` `discord.heading`; no lugar do lead, a data `discord.updated` em `body-sm` `papel-suave`, na mesma linha de base |
| Regras (≥ 1024 px) | Duas colunas com CSS `columns: 2; column-gap: 48px`; cada regra com `break-inside: avoid`. A ordem fica 1-3 à esquerda e 4-6 à direita, que é a ordem do DOM |
| Regras (< 1024 px) | Uma coluna |
| Título de regra | `title` (20 px), `papel`, `h2`. 4 px até o texto. 16 px entre regras |
| Texto de regra | `body` (16 px), `papel-suave`, `white-space: pre-line`, sem `max-width` próprio (a coluna limita) |
| Encerramento | `body` 500, `papel`, ocupando as duas colunas (fora do bloco de colunas), 16 px abaixo |
| Barra de confirmação | Filete `pauta` em cima, 24 px depois do encerramento, 16 px de padding superior |
| Linha da barra (≥ 640 px) | Flex em uma linha, `align-items: center`, `justify-content: space-between`, altura mínima de 48 px para nada pular ao marcar. À esquerda: caixa nativa de 24 px, 12 px, rótulo `discord.agree` em `body` `papel`. À direita: antes de marcar, `discord.pending` em `body-sm` `papel-suave`; depois, os botões (§2.4), 16 px entre eles |
| Linha da barra (< 640 px) | Caixa e rótulo em cima; botões 16 px abaixo, lado a lado em pt-BR e largura total em en-US |
| Comportamento | O mesmo portão só de CSS de hoje (`.gate`, `:has()`), sem script; sem `:has()`, os botões ficam visíveis |

### 4.3 Medição

Protótipo sobre o rc (só pt-BR, regras em duas colunas, corpo de 15 px, faixa ainda não aplicada): botões terminam em
**681 px em 1536 × 730** e **659 px em 1920 × 953**. Em 1366 × 657 terminaram em 665 px, com cerca de 100 px de espaço
vazio acima do título que a faixa de cabeçalho remove. A spec usa corpo de 16 px; a Retina mede as três larguras e, se
1536 × 730 não couber, a correção combinada é usar `body-sm` só no texto das regras, a partir de 1024 px.
Captura: `~/files/bussola-t69/prototipo-discord-1536x730.png`.

## 5. Texto (só remoções)

| Chave | Antes | Depois |
|---|---|---|
| `discord.agree` pt-BR | Li as regras e concordo com elas. Ao marcar, os botões para entrar aparecem logo abaixo. | Li as regras e concordo com elas. |
| `discord.agree` en-US | I have read the rules and agree with them. Ticking this box shows the join buttons just below. | I have read the rules and agree with them. |
| `discord.pending` pt-BR | Marque a caixa acima para ver os botões. | Marque a caixa para ver os botões. |
| `discord.pending` en-US | Tick the box above to see the buttons. | Tick the box to see the buttons. |
| `discord.jump` | Read in English | Removida (o seletor de idioma substitui) |
| `discord.links.lead` | Escolha por onde entrar. / Join us on Discord. | Não renderizada (os botões já dizem o canal) |

`copy.md` recebe as mesmas mudanças no PR da Vitral.

## 6. Contratos que mudam com o `/discord` por idioma

Proposta para o Alicerce acordar (não editei contratos):

- **ADR-0002, Consequences:** "These two rules are the only redirect rules the site needs" e "`/discord` is a page served
  by the site, not a rule" passam a ser quatro regras: `/` e `/discord`, cada uma com BR e o resto.
- **routing-locale:** linha 6 (referências D-29/D-41), 29-30 (destino dos botões e onde o convite existe), 37 (linha
  `/discord` da tabela), 47 (exceção ao prefixo de idioma), seção "The `/discord` page" (49-96), 113 (contagem de
  regras), 133 (página bilíngue), 152-153 (WhatsApp no container pt-BR), 160 (sitemap), bloco nginx `location = /discord`
  (213-216, vira fallback), 275, 288, 295 e o teste C-9 (passa a valer para cada página de idioma).
- **site-data:** 88-91 (strings `discord.*` e o `<head>` da página, que deixa de ser en-US fixo), 129-135 (o convite
  passa a existir nas duas páginas `/{locale}/discord/`), 199-200 e 211-214 (`join-channels.yaml`: `url` deixa de ser
  `links.discord` dentro do site). `links.discord` continua como o endereço público para fora do site.
- **information-architecture:** R-2, R-5, a lista de rotas (linha 68), as linhas 162 e 492 e a §7.10 inteira; eu reescrevo
  depois do acordo.
- **D-41** precisa de uma emenda registrada pelo dono: "uma página por idioma" no lugar de "as duas na mesma URL".
- Atenção para o Alicerce: D-29 registra que uma regra do Cloudflare para `/discord` "foi relatada como não funcionando".
  Convém saber por quê antes de depender de uma regra de novo.

## 7. Rodapé

Layout padrão: marca à esquerda, grupos de links à direita, barra final centralizada.

| Elemento | Especificação |
|---|---|
| Fundo e padding | `violeta-noite`, 48 px em cima (antes 64). Sem padding embaixo: a barra final fecha |
| Grade (≥ 1024 px) | 12 colunas. Colunas 1 a 4: lockup do header (28 px, `papel`, link para a Home). Colunas 5 a 12: os quatro grupos atuais, 2 colunas cada |
| 640 a 1023 px | Lockup em cima, ocupando a linha; grupos em 2 colunas |
| Abaixo de 640 px | Lockup em cima; grupos em 2 colunas (Site e Comunidade, depois Contato e Legal); e-mails podem quebrar |
| Grupos | Título em `body-sm` 500 `papel`; links em `body-sm` `papel-suave`, alvo de 44 px mantido (compromisso do PRODUCT.md) |
| Barra final | 32 px depois dos grupos, filete `pauta` de 1 px em cima com a largura do `frame`, altura mínima de 56 px, texto `footer.line` em `label` `papel-apagado`, **centralizado** (`text-align: center`) em todas as larguras |

O texto da barra não muda ("EmpireCommunity. Comunidade sediada no Brasil."). Acrescentar "©" e ano seria texto novo e
depende do dono.

## 8. Favicon e GIF

### 8.1 O que foi aprovado e o que está no ar

- O site usa exatamente os arquivos do kit aprovado (`EmpireAssets/assets/icons/logos/restricted/empirecommunity/`), com
  hash igual: `svg/favicon.svg`, `ico/favicon.ico`, `png/icon-192.png`, `png/icon-512.png`, `png/apple-touch-icon.png`.
- O `favicon.svg` aprovado é **quadrado e sem respiro**: as barras ocupam a moldura inteira e os LEDs são quadrados.
- O avatar aprovado (`png/avatar-1024.png`, `gif/avatar.gif`) tem o Rack clean no centro, com 192 px de respiro em
  1024 px. No Discord ele aparece recortado em **círculo, com o logo no meio**, que é o que o dono descreve.
- D-40 descartou as versões "com anel" (contorno). Um disco cheio sem contorno não é anel e não contraria D-40.

### 8.2 O que deve ir ao ar

Favicon em **disco**: círculo cheio em `violeta-ata`, fora dele transparente, sem contorno, com o Rack clean no centro
na mesma composição do avatar.

| Arquivo | Especificação |
|---|---|
| `svg/favicon.svg` | `viewBox="0 0 96 96"`. `<circle cx="48" cy="48" r="48" fill="#271837"/>`. Rack clean com a geometria de `svg/rack-clean.svg` (barras `M16 16H80V32H16Z M16 40H64V56H16Z M16 64H80V80H16Z` em `#efece0`, LEDs `#E3191F` e `#FFB81C`) reduzido a 87,5% em torno do centro (`transform="translate(6 6) scale(0.875)"`, barras de 20 a 76), para os cantos ficarem 8 unidades dentro do círculo |
| `ico/favicon.ico` | 16, 32 e 48 px, fundo transparente fora do disco. 16 e 32 px desenhados na grade de pixels: em 16 px, barras de 2 px de altura nas linhas 4-5, 7-8 e 10-11, de x 3 a 12 (a do meio de 3 a 10), LED vermelho de 1 px em (11, 4) e amarelo em (4, 11); em 32 px, o dobro |
| `png/icon-192.png`, `png/icon-512.png` | Mesmo disco, fundo transparente |
| `png/apple-touch-icon.png` | **Não muda**: quadrado opaco, porque o iOS arredonda sozinho e pinta de preto o que é transparente |

No site, a Vitral só copia os arquivos novos para `public/` com os mesmos nomes; `BrandHead.astro` não muda.

### 8.3 GIF: falta informação

O site não usa nenhum GIF: conferi o HTML de `/`, das páginas pt-BR e en-US e de `/discord`, e o código-fonte. A única
animação do site é A Margem se desenhando na Home. Os GIFs aprovados (D-40, D-42) são `gif/avatar.gif` (512 × 512,
LEDs acendendo e apagando) e `gif/banner.gif` (960 × 540), idênticos à cópia entregue em
`~/files/EmpireCommunity-marca/gif/`. Para especificar a correção, preciso saber onde o dono viu o GIF (servidor do
Discord, perfil, outro lugar) e, se possível, uma captura do que foi apresentado.

## 9. Pedido para a Aquarela

1. Favicon em disco (§8.2): `svg/favicon.svg`, `ico/favicon.ico`, `png/icon-192.png`, `png/icon-512.png` no kit do
   EmpireAssets e na cópia de `~/files/EmpireCommunity-marca/`, mais uma folha de prévia em 16, 32 e 48 px sobre aba clara
   e escura. A folha vai ao dono antes da troca no site.
2. GIF: nada até a resposta de §8.3.

## 10. Depois da aprovação

- `EmpireAssets/docs/EmpireCommunity-DESIGN.md` recebe a nova escala, a largura, `page-title`, `page-head`, o item atual
  do menu, o rodapé e o favicon em disco. O push daquele repositório é do Regente de lá (D-46).
- `information-architecture.md` §4, §7 e §7.10 são atualizados por mim depois do acordo de §6.

## 11. Verificação (Retina)

- Medidas de §2 em 390, 768, 1440 e 1920 px; nenhuma rolagem horizontal em 320 px.
- Critérios de altura de §3.4 nos viewports indicados.
- Item atual do menu visível em cada página interna; Home sem item marcado e com `display`; páginas internas com
  `page-head`.
- `/pt-br/discord/` sem nenhum texto em inglês e `/en-us/discord/` sem a palavra WhatsApp; ao marcar a caixa, nada muda de
  posição.
- Rodapé com a barra final centralizada em todas as larguras.
- Favicon em disco visível na aba em 16 px (Chrome e Firefox, tema claro e escuro).
- Contrastes: todos os pares já estão na tabela do DESIGN.md; `page-head` usa `papel` e `papel-suave` sobre
  `violeta-capa` (11,97:1 e 8,06:1).
