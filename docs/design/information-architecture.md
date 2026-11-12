# Arquitetura de informação: empirecommunity.org

Tarefa T-1. Autoria: Bússola. Estado: **proposta para revisão do dono**. Risco: Low.
Copy completa em [`docs/content/copy.md`](../content/copy.md). Brief do logo em [`logo-brief.md`](logo-brief.md).
Roteamento e número de membros seguem os contratos [`routing-locale`](../contracts/routing-locale.md) e
[`members-json`](../contracts/members-json.md).

Este documento define estrutura, navegação, seções e wireframes. Cor, tipografia e tokens ficam para a T-2
(`EmpireCommunity-DESIGN.md`), depois da aprovação do dono.

## 1. Brief

| | |
|---|---|
| **Função** | Porta de entrada oficial da organização: o que é a comunidade, o que ela mantém, como entrar e como é financiada. |
| **Quem chega** | Brasileiros que jogam ou gostam de tecnologia e estão pensando em entrar (cerca de 99%). Estrangeiros vindos do GitHub em busca de colaboração ou suporte. Doadores e quem quer checar se a organização é confiável. |
| **Ação principal** | Entrar na comunidade (Discord ou WhatsApp em pt-BR; Discord em en-US). Ação secundária: apoiar. |
| **Prova** | Situação real de cada projeto e servidor, repositórios públicos, número de membros, meta pública em reais. |
| **O que só a EmpireCommunity pode dizer** | Tudo é gratuito, nada é vendido, a meta financeira é pública e o site mostra o que ainda não funciona. |
| **Modo por superfície** (impeccable) | Home e Participar: Persuade. Projetos, Infraestrutura, Apoiar e Organização: Read, com status consultáveis. Termos e Privacidade: Read. |

**Ideia estrutural: registro público.** O site se comporta como o registro aberto de uma organização: linhas, situação
e valores, com o que falta à vista. A referência Co2 (D-1) entra como postura editorial, tema escuro, texto em primeiro
lugar e cor só para classificar. Aqui a cor classifica situação, nunca decora. O layout e a identidade são próprios, e
as fontes da Co2 não são usadas.

**O que o site recusa:** visual gamer, neon, mascotes, grade de três cartões com ícone, depoimentos, contadores
animados, promessas de "maior comunidade". O lado divertido fica no Discord e no WhatsApp.

**Base desta proposta:** brief da T-1 e notas do Project Context. A entrevista de produto do impeccable não foi feita;
a confirmação é a revisão do dono.

## 2. Regras transversais

Cada regra é verificável. A coluna da direita aponta o critério de aceite relacionado.

| Id | Regra | Critério |
|---|---|---|
| R-1 | **Canais em pt-BR:** Discord e WhatsApp usam o mesmo componente, com largura, altura, tipografia, cor e estilo idênticos. Nenhum é "primário". Ordem alfabética: Discord à esquerda (em cima no mobile), WhatsApp à direita (embaixo); na página de regras pt-BR (`/pt-br/discord/`), lado a lado em todas as larguras (D-41). Ícones monocromáticos, sem as cores das marcas. Textos de apoio com a mesma extensão. | C-1 |
| R-2 | **Canais em en-US:** a palavra WhatsApp não aparece em nenhuma página, metadado, `llms.txt` ou texto alternativo de `/en-us/`, nem na página de escolha em `/`. A página de regras em inglês (`/en-us/discord/`) só tem o Discord, e a página de escolha de `/discord` não cita o WhatsApp (D-78). | C-1 |
| R-3 | **Sem CTA de canal no header.** O header leva para Participar. Assim nenhum canal ganha mais peso. | C-1 |
| R-4 | **Link só no que funciona.** O link é renderizado somente quando `status = live` e existe `url`. Em desenvolvimento e Em breve são texto, sem link, sem `href="#"`, sem botão desabilitado. | C-2 |
| R-5 | **Toda entrada passa pela página de regras do idioma (D-41, D-78).** Botões e links de Discord e de WhatsApp, em qualquer página, levam a `/{locale}/discord/` do próprio idioma, nunca a `/discord`. `https://empirecommunity.org/discord` é o endereço público para fora do site e redireciona pelo país. O convite do Discord e o link do WhatsApp só existem nas páginas de regras, o WhatsApp só na pt-BR. | C-2 |
| R-6 | **Seção sem dado real não é renderizada.** Inclui título, separador, espaçamento e âncora. Nada de "em breve", traços ou zeros no lugar do dado. Ver §6. | C-4 |
| R-7 | **Pessoa só com consentimento registrado.** Sem consentimento, a build falha. Vale para fundador e equipe. | C-4 |
| R-8 | **Número de membros:** só o último valor, com a regra de exibição de `members-json` (888 vira `880+`), sem data, sem "atualizado em", sem animação. Aparece apenas na faixa de números da Home. | C-7 |
| R-9 | **Paridade de rotas:** toda página existe nos dois idiomas com o mesmo conteúdo. Exceções permitidas, e só estas: elementos ligados ao WhatsApp (R-2). | C-3 |
| R-10 | **Termos e Privacidade têm conteúdo idêntico** nos dois idiomas. Por causa de R-2, o texto legal não cita o WhatsApp em nenhum idioma e fala em "canais" e "plataformas de conversa". | C-1, C-3 |
| R-11 | **Seletor de idioma sempre visível** em todas as larguras, fora do menu recolhido, levando à página equivalente no outro idioma. Rótulos `Português` e `English`, sem bandeiras (`routing-locale` §2). | C-8 |
| R-12 | **Status nunca só por cor:** o rótulo em texto está sempre presente. | C-6 |
| R-13 | **Infraestrutura em nível geral.** Não publicar cidade, especificação da VPS, portas, topologia, estado de backup ou monitoramento. | — |

Acessibilidade mínima para a T-2 detalhar: `lang` correto por página, link "pular para o conteúdo", foco visível,
alvos de toque com pelo menos 44 × 44 px, contraste AA, tabelas com cabeçalho semântico.

## 3. Mapa do site e rotas

```text
/                 redireciona pelo país (Cloudflare); página de escolha se a regra estiver desligada
├── /pt-br/  e  /en-us/
│   ├── projects/
│   ├── game-servers/
│   ├── join/
│   ├── support/
│   ├── organization/      falta no contrato routing-locale (ver §11)
│   ├── terms-of-service/
│   ├── privacy-policy/
│   └── discord/           regras da comunidade e links de entrada, um idioma por página (D-41, D-78)
/discord          redireciona pelo país para a página de regras (D-78); página de escolha se a regra estiver desligada
/404.html         página neutra e bilíngue
```

Slugs iguais e em inglês nos dois idiomas, conforme `routing-locale` §1. O idioma da rota vem do primeiro segmento.

| Página | Chave | Caminho | Rótulo no menu (pt / en) |
|---|---|---|---|
| Home | `home` | `/` do idioma | logo |
| Projetos | `projects` | `projects/` | Projetos / Projects |
| Infraestrutura e servidores de jogos | `game-servers` | `game-servers/` | Infraestrutura / Infrastructure |
| Como participar | `join` | `join/` | Participar / Join |
| Apoiar | `support` | `support/` | Apoiar / Support us |
| Organização | `organization` | `organization/` | Organização / Organization |
| Termos | `terms` | `terms-of-service/` | rodapé |
| Privacidade | `privacy` | `privacy-policy/` | rodapé |
| Regras da comunidade | `discord` | `discord/` | fora do menu; botões de entrada |

Em inglês o rótulo é "Support us" para não ser confundido com suporte técnico.

Raiz, `hreflang` e seletor seguem `routing-locale` §2 a §4 e ADR-0002. Como o idioma está na URL, nada é gravado no
navegador, o que sustenta a afirmação da Política de Privacidade.

## 4. Navegação

**Header**, igual em todas as páginas:

- Esquerda: logo (`EmpireCommunity`), link para a Home do idioma. Nas páginas sem idioma (seletor raiz, 404 e `/discord`) o logo leva a `/`, o seletor raiz, que a Cloudflare redireciona para um idioma.
- Centro ou direita: Projetos, Infraestrutura, Participar, Apoiar, Organização.
- Extrema direita: seletor `Português` / `English`, com o idioma atual marcado.
- Abaixo de 1024 px: os cinco itens vão para um menu recolhido. Logo, botão Menu e seletor continuam visíveis (R-11).
- Em 390 px: o seletor fica em uma faixa fina acima da linha do logo, porque os dois rótulos por extenso não cabem ao
  lado do logo e do botão.

**Rodapé**, em quatro grupos:

| Grupo | pt-BR | en-US |
|---|---|---|
| Site | as cinco páginas | as cinco páginas |
| Comunidade | Discord, WhatsApp (mesmo peso), GitHub | Discord, GitHub |
| Contato | `contact@`, `legal@` | `contact@`, `legal@` |
| Legal | Termos, Privacidade | Terms, Privacy |

Última linha do rodapé: nome da organização e "sediada no Brasil". Sem ano: a data de fundação fica em Organização.

## 5. Status

Vocabulário fechado. O dado vem de arquivo, para mudar sem mexer em layout.

| Contexto | Valor | pt-BR | en-US | Link? |
|---|---|---|---|---|
| Projeto | `live` | No ar | Live | Sim, se houver URL funcionando |
| Projeto | `in-development` | Em desenvolvimento | In development | Não |
| Servidor de jogo | `live` | No ar | Live | Não: o acesso se dá pelo Discord (D-37) |
| Servidor de jogo | `coming-soon` | Em breve | Coming soon | Não |

### Catálogo inicial de projetos, verificado em 2026-11-08

| Projeto | Status | Links | Evidência |
|---|---|---|---|
| EmpireMuse | `live` | Site `muse.empirecommunity.org`; código no GitHub | Site responde 200; repositório público. Crédito obrigatório: derivado do MuseHeart-MusicBot, de zRitsu (GPL-2.0). |
| github-worker-relay | `live` (dono confirma, P-10) | Código no GitHub | Repositório público, v2.1.0. Não há URL pública para checar se está em execução. |
| EmpireCommunitySite | `live` no lançamento | Código no GitHub | Este site. |
| EmpireHub | `in-development` | Nenhum | `empirehub.com.br` responde 404. Repositório principal privado. |
| EmpireBot | `in-development` | Nenhum | Ainda não implantado (D-13). Repositório privado. |
| EmpireCraft | `in-development` | Nenhum | Repositório público só com README e licença. |

Fora do catálogo: EmpireAssets (biblioteca privada e interna) e `.github` (perfil da organização). Os subprojetos
(Panel, RPC-app, LL-binaries, jishaku, HubEngine, HubGames e demais) ficam dentro do projeto-pai, para não inflar a lista.

## 6. Seções que somem quando vazias

| Pendência | Seção afetada | Com dado vazio |
|---|---|---|
| P-02 Peças | Apoiar › Peças do servidor | Tabela some, com título |
| P-03 Valor arrecadado | Apoiar › progresso da meta (D-39: não aparece na Home) | Só a meta aparece; sem barra e sem "R$ 0" |
| P-04 Equipe | Organização › Equipe | Seção some |
| P-05 Fundador | Organização › Fundador | Sem consentimento registrado, a build falha (R-7). Apelido, bio e foto somem individualmente |
| GitHub | Home › repositórios públicos; Projetos › Atividade recente | Item e seção somem |

O número do Discord não some: sempre existe o valor embutido na build (`members-json` §3 e §4). Esse valor precisa ser
real, nunca inventado. Se uma faixa inteira ficar vazia, ela não é renderizada.

## 7. Páginas

Larguras de referência: desktop 1440, tablet 768, mobile 390. Os wireframes mostram estrutura, não proporção visual
final. Marcas: `[P-xx]` some quando vazio; `(pt)` existe só em pt-BR.

### Reflow por largura

| Padrão | Desktop 1440 | Tablet 768 | Mobile 390 |
|---|---|---|---|
| Header | Logo, cinco itens, seletor | Logo, seletor, botão Menu | Faixa com o seletor; abaixo, logo e botão Menu |
| Índice (título + linhas) | Título em 3 colunas, linhas em 9 (T-69) | Título acima, linhas na largura total | Igual ao tablet |
| Par de canais (pt) | Dois blocos iguais lado a lado | Dois blocos iguais lado a lado | Empilhados, largura total, Discord primeiro |
| Par de botões em `/pt-br/discord/` | Lado a lado | Lado a lado | Lado a lado (D-41) |
| Linha de status | Nome, descrição, status e links na mesma linha | Nome e status na 1ª linha; descrição e links abaixo | Tudo empilhado, status logo abaixo do nome |
| Tabela de peças | Tabela | Tabela | Linhas empilhadas, cada uma com rótulo e valor |
| Faixa de números | Até 3 itens em linha | Até 3 itens em linha | Empilhados |
| Texto longo | Coluna de leitura de até 72 caracteres (T-69) | Igual | Largura total com margem de 16 px |

### 7.1 Home

Propósito: dizer em segundos o que é a organização e oferecer a entrada. Sequência: afirmação, prova, o que existe,
como se mantém, entrada.

Seções: Hero · Números · Propósito · O que fazemos · Projetos · Servidores de jogos · Como nos mantemos · Faça parte.

```text
Desktop 1440
┌────────────────────────────────────────────────────────────────────────┐
│ EmpireCommunity  Projetos Infraestrutura Participar Apoiar Organização │
│                                                     Português · English │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Uma comunidade brasileira que mantém                                  │
│  servidores de jogos e desenvolve software.                            │
│                                                                        │
│  Lead em coluna estreita.                                              │
│                                                                        │
│  [ Entrar no Discord ]  [ Entrar no WhatsApp (pt) ]   Ver projetos →   │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  880+ membros no Discord │ 60 no WhatsApp (pt)         │ 12 repositórios │
├──────────────────────┬─────────────────────────────────────────────────┤
│  Propósito           │ Texto do dono                                   │
├──────────────────────┼─────────────────────────────────────────────────┤
│  O que fazemos       │ ─────────────────────────────────────────────── │
│                      │ Servidores de jogos      texto                  │
│                      │ ─────────────────────────────────────────────── │
│                      │ Bots para Discord        texto                  │
│                      │ ─────────────────────────────────────────────── │
│                      │ Comunidade               texto                  │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Projetos            │ EmpireMuse    texto            No ar   Site →   │
│  Ver todos →         │ EmpireHub     texto    Em desenvolvimento       │
│                      │ EmpireBot     texto    Em desenvolvimento       │
│                      │ EmpireCraft   texto    Em desenvolvimento       │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Servidores de jogos │ Minecraft                      No ar            │
│  Pedir um jogo →     │ Palworld                       Em breve         │
│                      │ Project Zomboid                Em breve         │
│                      │ Factorio                       Em breve         │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Como nos mantemos   │ Texto                                Apoiar →   │
├──────────────────────┴─────────────────────────────────────────────────┤
│  Faça parte.                [ Discord ]      [ WhatsApp (pt) ]         │
├────────────────────────────────────────────────────────────────────────┤
│ Rodapé                                                                 │
└────────────────────────────────────────────────────────────────────────┘

Mobile 390
┌──────────────────────┐
│   Português · English│
│ EmpireCommunity Menu │
├──────────────────────┤
│ Uma comunidade       │
│ brasileira que ...   │
│ Lead                 │
│ [Entrar no Discord ] │
│ [Entrar no WhatsApp] │  (pt)
│ Ver projetos →       │
├──────────────────────┤
│ 880+ membros Discord │
│ 60 WhatsApp          │  (pt)
│ 12 repositórios      │
├──────────────────────┤
│ O que fazemos        │
│ ──────────────────── │
│ Servidores  texto    │
│ ...                  │
├──────────────────────┤
│ Projetos             │
│ EmpireMuse           │
│ No ar                │
│ texto · Site →       │
│ ...                  │
└──────────────────────┘
```

Valores numéricos do wireframe são ilustrativos. Em en-US, o par de canais vira um único bloco do Discord e a faixa de
números tem dois itens.

### 7.2 Projetos

Propósito: mostrar tudo o que a organização desenvolve, com a situação real.

Seções: Título e lead · Legenda de status · Lista completa · Código aberto · Atividade recente (GitHub).

```text
┌──────────────────────┬─────────────────────────────────────────────────┐
│  Projetos            │  Lead                                           │
│                      │  No ar: ...   Em desenvolvimento: ...           │
├──────────────────────┴─────────────────────────────────────────────────┤
│  EmpireMuse           texto + crédito obrigatório   No ar  Site  Código│
│  ──────────────────────────────────────────────────────────────────────│
│  github-worker-relay  texto                         No ar  Código      │
│  ──────────────────────────────────────────────────────────────────────│
│  EmpireCommunitySite  texto                         No ar  Código      │
│  ──────────────────────────────────────────────────────────────────────│
│  EmpireHub            texto              Em desenvolvimento            │
│  EmpireBot            texto              Em desenvolvimento            │
│  EmpireCraft          texto              Em desenvolvimento            │
├──────────────────────┬─────────────────────────────────────────────────┤
│  Código aberto       │ Texto · GitHub → · Guias de colaboração →       │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Atividade recente   │ repositório          data da última atualização │
└──────────────────────┴─────────────────────────────────────────────────┘
```

Ordem: `live` antes de `in-development`; dentro de cada grupo, a ordem do arquivo de dados.

Atividade recente: até 5 repositórios públicos, do mais recente para o mais antigo, com a data da última atualização.
A regra "sem data" vale só para o número de membros. A origem desse dado ainda não foi decidida (ponto aberto da
ADR-0001); enquanto não houver, a seção não é renderizada.

### 7.3 Infraestrutura e servidores de jogos

Propósito: mostrar o que está disponível para jogar e, em nível geral, onde a comunidade roda.

Seções: Título e lead · Servidores de jogos · Pedir um jogo · Onde tudo roda · Servidor próprio.

```text
┌──────────────────────┬─────────────────────────────────────────────────┐
│  Infraestrutura e    │  Lead                                           │
│  servidores de jogos │                                                 │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Servidores de jogos │ Minecraft  No ar     Acesso pelo Discord        │
│                      │ Palworld   Em breve                             │
│                      │ Project Zomboid  Em breve                       │
│                      │ Factorio   Em breve                             │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Pedir um jogo       │ Texto · Participar →                            │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Onde tudo roda      │ Texto geral (R-13)                              │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Servidor próprio    │ Em montagem · Xeon · 128 GB RAM · Apoiar →      │
└──────────────────────┴─────────────────────────────────────────────────┘
```

Status ao vivo dos servidores fica fora deste site (`empirecommunity.cloud`). Hoje esse endereço responde 404, então
não há link até ele funcionar.

### 7.4 Como participar

Propósito: converter. Sem desvio, sem formulário.

Seções: Título e lead · Canais · O que dá para fazer · Perguntas frequentes.

```text
pt-BR
┌────────────────────────────────────────────────────────────────────────┐
│  Como participar                                                       │
│  Lead                                                                  │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Discord                         │  WhatsApp                           │
│  texto de mesma extensão         │  texto de mesma extensão            │
│  [ Entrar no Discord ]           │  [ Entrar no WhatsApp ]             │
├──────────────────────┬───────────┴─────────────────────────────────────┤
│  O que dá para fazer │ Jogar · Pedir um jogo · Colaborar · Apoiar      │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Perguntas           │ + É pago?                                       │
│  frequentes          │ + Preciso doar?                                 │
│                      │ + Posso pedir um jogo?                          │
│                      │ + Não moro no Brasil. Posso participar?         │
│                      │ + Como falo com a equipe?                       │
└──────────────────────┴─────────────────────────────────────────────────┘

en-US: um único bloco do Discord, em 8 colunas, com a nota sobre a comunidade ser majoritariamente brasileira.
```

Perguntas frequentes usam `<details>` nativo: funcionam sem JavaScript.

**Decisão (T-38): dois blocos de canal, cada um com o próprio botão.** Em pt-BR a página mantém os blocos Discord e
WhatsApp, e os dois botões levam a `/pt-br/discord/` (`site-data` §8, D-78). Um botão único obrigaria a criar outro padrão só para esta
página, sem combinar com a Home; os dois blocos mantêm R-1 e dizem o que é cada canal antes da escolha. Em en-US, um
bloco do Discord, que leva a `/en-us/discord/`.

### 7.5 Apoiar

Propósito: mostrar a meta, as peças e que as doações em dinheiro ainda não estão abertas. No lançamento, o site não
recebe dinheiro nem indica forma de enviar (D-28). É a página mais dependente de dado real.

Seções: Título e lead · Meta atual · Doações ainda não abertas · Peças do servidor · Doar peças · Outras formas de ajudar · Transparência.

```text
┌──────────────────────┬─────────────────────────────────────────────────┐
│  Apoiar              │  Lead                                           │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Meta atual          │  R$ 5.384,99                                    │
│                      │  Texto sobre o servidor próprio                 │
│                      │  ▓▓▓▓░░░░  R$ X de R$ 5.384,99  [P-03]          │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Doações             │  Ainda não abertas: support.donations.notOpen   │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Peças do servidor   │  Foto  Peça   Valor   Situação                  │
│  [P-02]              │  ───────────────────────────────                │
│                      │  ▢     ...    R$ ...  Comprada / Doada / Falta  │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Doar peças          │  Texto · Discord → · contact@                   │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Outras formas       │  Texto · GitHub →                               │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Transparência       │  Regras em linhas separadas                     │
└──────────────────────┴─────────────────────────────────────────────────┘
```

As doações aparecem em um único bloco, `data-donations="not-open"`, com a mensagem `support.donations.notOpen`: sem
instrução de pagamento, dados de conta ou link para provedor (`site-data` §10). Ao alcançar a meta, o texto de progresso
passa a `support.goal.reached`, e nada é escondido ou encerrado (D-22). A doação de peças continua por Discord ou e-mail.
A abertura das doações em dinheiro fica para um contrato posterior (D-28).

### 7.6 Organização

Propósito: responder "quem está por trás disto?".

Seções: Título e lead · Como começou · Como funciona · Nomes · Fundador · Equipe · Endereços oficiais · Contato.

```text
┌──────────────────────┬─────────────────────────────────────────────────┐
│  Organização         │  Lead · Desde {ano}                             │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Como começou        │  Texto do dono, em dois parágrafos              │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Como funciona       │  Gratuito · doações · dados não vendidos        │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Nomes               │  EmpireCommunity / EmpireHub                    │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Fundador            │  Foto[P-05]  Leonne Martins  apelido[P-05]      │
│                      │  Fundador    bio[P-05]                          │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Equipe [P-04]       │  Nome ou apelido   Função                       │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Endereços oficiais  │  endereço     função        situação            │
│                      │  Nota: outras redes não são oficiais            │
├──────────────────────┼─────────────────────────────────────────────────┤
│  Contato             │  Discord → · contact@ · legal@                  │
└──────────────────────┴─────────────────────────────────────────────────┘
```

Endereços oficiais protegem contra imitação. Endereço que ainda não funciona aparece sem link e com "Em breve".

### 7.7 Termos e 7.8 Privacidade

Página de leitura: título, data de vigência (P-12), sumário com âncoras no desktop e coluna única de até 68 caracteres.
Em tablet e mobile, o sumário vira lista acima do texto.

```text
┌───────────────────┬────────────────────────────────────────────────────┐
│ Termos de Uso     │ Vigência: {data} [P-12]                            │
│                   │                                                    │
│ 1. Sobre          │ 1. Sobre este site                                 │
│ 2. Gratuidade     │ Texto em coluna de leitura                         │
│ 3. ...            │ 2. ...                                             │
└───────────────────┴────────────────────────────────────────────────────┘
```

### 7.9 Páginas especiais

- **Escolha de idioma em `/`:** só aparece se as regras da Cloudflare estiverem desligadas. Nome da organização e dois
  links, cada um no próprio idioma. Sem script.
- **404:** uma única página neutra e bilíngue, com links para as duas Homes (`routing-locale` §1).
- **Escolha em `/discord`:** só aparece se as regras da Cloudflare estiverem desligadas. Mesma marcação da escolha de `/`,
  com links para `/pt-br/discord/` e `/en-us/discord/`, sem regras, convite nem WhatsApp (`routing-locale` §1).
- **Regras da comunidade:** páginas `/pt-br/discord/` e `/en-us/discord/`, na §7.10.

### 7.10 Regras da comunidade: `/pt-br/discord/` e `/en-us/discord/` (D-41, D-78)

Propósito: mostrar as regras e, depois da confirmação, liberar a entrada. Comportamento em `routing-locale` §1, dados em
`site-data` §14, texto em `copy.md`. Esta seção define ordem, colunas e tratamento visual; escala e tokens seguem a
revisão T-69 (`docs/design/t69-design-revision.md`). A caixa é só uma confirmação de interface: nada é gravado e nenhum
texto pode sugerir o contrário.

**Um idioma por página (D-78).** Cada página tem as regras, a data, uma caixa e os botões do próprio idioma. São páginas
comuns de idioma: header completo com seletor (nenhum item do menu marcado), faixa de cabeçalho e rodapé. Sem A Margem.
Objetivo medido: regras, caixa e botões visíveis juntos, sem rolar, em 1920 × 953 e 1536 × 730.

```text
Desktop 1536 × 730 (pt-BR)
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▤ EmpireCommunity  Projetos Infraestrutura Participar Apoiar Org.  Português English │
├──────────────────────────────────────────────────────────────────────────────┤
│ Regras da comunidade        Atualizadas em {data}                            │ faixa violeta-capa
├──────────────────────────────────────────────────────────────────────────────┤
│ 1 - Proibição de Spam:                 │ 4 - Sem Propagação de Ódio:         │
│ Texto da regra                         │ Texto da regra                      │
│ 2 - ...                                │ 5 - ...                             │
│ 3 - ...                                │ 6 - Conteúdo explícito +18:         │
│ Frase de encerramento (500)                                                  │
│ ──────────────────────────────────────────────────────────────────────────── │
│ ☐ Li as regras e concordo com elas.         antes: Marque a caixa para ver os botões. │
│                                             depois: [ Discord ]  [ WhatsApp ] │
└──────────────────────────────────────────────────────────────────────────────┘
en-US: o mesmo, em inglês, com um único botão Discord.

Mobile 390
┌──────────────────────┐
│ faixa: Regras da     │
│ comunidade · {data}  │
│ 1 - Proibição de ... │
│ ...                  │
│ 6 - ...              │
│ Encerramento         │
│ ──────────────────── │
│ ☐ Li as regras ...   │
│ [Discord] [WhatsApp] │
└──────────────────────┘
```

| Elemento | Especificação |
|---|---|
| `<html lang>` | O da página. `<main>` tem um único grupo de portão (`.gate`) |
| Cabeçalho | `page-head` da T-69. `h1` `discord.heading` em `page-title`; a data `discord.updated` em Body-sm `papel-suave` no lugar do lead, na mesma linha de base a partir de 1024 px e 8 px abaixo do título antes disso |
| Regras (≥ 1024 px) | Duas colunas com `columns: 2; column-gap: 48px`, cada regra com `break-inside: avoid`. Ordem do DOM: 1 a 3 à esquerda, 4 a 6 à direita |
| Regras (< 1024 px) | Uma coluna |
| Título de regra | Title, `papel`, `h2`. Número e dois-pontos fazem parte do texto do dono: não usar `<ol>`. 4 px até o texto; 16 px entre regras |
| Corpo de regra | Body, `papel-suave`, `white-space: pre-line`, para manter o endereço da regra 5 em linha própria. Sem `max-width` próprio: a coluna limita |
| Encerramento | Body com peso 500, `papel`, fora do bloco de colunas, 16 px abaixo dele |
| Barra de confirmação | Filete `pauta` em cima, 24 px depois do encerramento, 16 px de padding superior |
| Linha da barra (≥ 640 px) | Uma linha, `align-items: center`, `justify-content: space-between`, altura mínima de 48 px para nada mudar de posição ao marcar. À esquerda, a caixa nativa de 24 × 24 px (`accent-color: papel`, foco padrão do site), 12 px e o rótulo `discord.agree` em Body `papel`; clicar no rótulo marca a caixa. À direita, o texto de estado ou os botões |
| Linha da barra (< 640 px) | Caixa e rótulo em cima; texto de estado ou botões 16 px abaixo |
| Texto de estado | `discord.pending`, Body-sm, `papel-suave`. Oculto por padrão e só visível dentro de `@supports selector(:has(*))` com a caixa desmarcada, para o navegador sem `:has()` não pedir uma ação que não muda nada |
| Botões, pt-BR | `button-channel` de 48 px, Discord à esquerda, WhatsApp à direita, **lado a lado em todas as larguras** (D-41). 240 px cada a partir de 640 px, medianiz de 16 px. Abaixo de 640 px, `grid-template-columns: repeat(2, minmax(0, 1fr))` e `padding-inline: 8px` |
| Botão, en-US | Só Discord: largura total abaixo de 640 px e 240 px a partir daí |
| Removidos | `Read in English` (o seletor de idioma substitui) e o texto `discord.links.lead` (os botões já dizem o canal) |

## 8. Dados necessários para a implementação

Esta lista diz o que as páginas consomem. O esquema definitivo fica em `site-data` (contrato citado na ADR-0001, ainda
não presente no repositório).

| Dado | Origem | Campos |
|---|---|---|
| Membros Discord | `/data/members.json` e valor embutido | conforme `members-json` |
| Membros WhatsApp | `community.yaml`, manual, só pt-BR | valor |
| Projetos | Arquivo do site | `id`, `status`, `url?`, `repo?`, descrição por idioma, crédito por idioma |
| Servidores de jogos | Arquivo do site | `id`, `status`, detalhes por idioma |
| Apoio | `support.yaml` (`site-data` §10, D-28) | `donations.status: not-open`, `goal`, `specs?`, `parts[]` (nome, valor em centavos, situação, foto, alt por idioma), `partDonations?` |
| Pessoas | Arquivo do site | `name`, `nickname?`, `role`, `bio?`, `photo?`, `consent` (obrigatório) |
| Organização | `community.yaml` e mensagens `organization.*` | `foundedYear` (2022), `purpose` (lido na Home); o texto de origem fica nas mensagens |
| GitHub | A decidir (ADR-0001) | total de repositórios públicos e últimas atualizações |

Não usar o widget do Discord: ele expõe nomes de membros online (R-3 do Risks & Backlog), e D-13 já definiu o caminho.

## 9. Pendências do dono

`PENDING` significa dado real que ainda não existe. Nada aqui foi inventado.

| Id | O que falta | Recomendação |
|---|---|---|
| P-02 | Peças do Xeon: nome, valor, situação, fotos | Nome, valor e situação enviados pelo dono em 2026-11-11 (`support.yaml`); faltam as fotos, sem etiquetas com números de série |
| P-03 | Valor já arrecadado | Calculado a partir das peças de P-02 (`site-data` §10): R$ 620 em 2026-11-11. Só em Apoiar (D-39). Sem esse número, a barra de progresso não aparece |
| P-04 | Equipe: nomes ou apelidos, funções, consentimento | Consentimento por escrito, guardado fora do repositório público |
| P-05 | Fundador: apelido, bio curta, foto, registro de consentimento | O próprio dono registra o consentimento |
| P-06 | Fechada por D-37 | Fundação em 20 de agosto de 2022 |
| P-07 | Fechada por D-39 | Propósito na Home e origem em Organização, com o texto do dono |
| P-08 | Fechada por D-37 | WhatsApp é uma comunidade de 12 grupos, com 60 membros (valor manual, sem data na tela, D-14) |
| P-09 | Fechada por D-37 | O acesso ao Minecraft se dá pelo Discord, que em breve funcionará como whitelist. Endereço e versão não são publicados (`site-data` §13) |
| P-10 | Confirmar se o `github-worker-relay` está em produção | |
| P-11 | Fechada por D-23 | Controlador: o dono, pessoa física. A Privacidade mostra só o nome legal e o e-mail `legal@` |
| P-12 | Data de vigência de Termos e Privacidade | A data da publicação |
| P-13 | Regra para doação feita por engano | Fora do lançamento (D-28): volta com o contrato de doações |

## 10. Decisões para o dono

| Id | Decisão | Recomendação |
|---|---|---|
| O-1 | Projeto em desenvolvimento com repositório público (hoje EmpireCraft) recebe link para o código? | Não. Segue a leitura estrita de D-7. A página tem link geral para o GitHub da organização |
| O-2 | Fechada por D-41 e D-78 | As regras da comunidade ficam em `/pt-br/discord/` e `/en-us/discord/`, §7.10 |
| O-3 | Termos e Privacidade são rascunho em linguagem simples, feito sem advogado | Publicar assim é aceitável para um site sem coleta de dados, mas vale uma revisão jurídica pontual antes de receber doações, incluindo a ausência de registros de acesso (D-20) |

**Conferir na implementação**, porque a Política de Privacidade afirma: nenhum registro de acesso na origem e registros de erro em rotação curta (D-20); ausência de
cookies próprios; país identificado pela Cloudflare sem armazenamento pelo site. A Cloudflare informa que o Web Analytics
não usa cookies nem armazenamento local e descarta o IP. Em um texto de 2025 ela ressalva que essa caracterização não se
aplica ao tráfego da União Europeia e do Reino Unido; só importa se esse público crescer.

## 11. Conflitos encontrados e como foram tratados

| Conflito | Tratamento |
|---|---|
| `routing-locale` não tem rota para Organização, página pedida na T-1 | Rota proposta aqui (`organization/`). Alicerce precisa incluir a chave no contrato |
| Requirements pede número do WhatsApp "com data"; D-14 proíbe data | Vale D-14, a decisão mais recente |
| "Mesmo conteúdo nos dois idiomas" em textos legais × WhatsApp só em pt-BR | R-10: texto legal não cita o WhatsApp |
| `EmpireAssets/docs/EmpireCommunity-DESIGN.md` cita Facebook; `EMPIRECOMMUNITY.md` diz que não há | Vale `EMPIRECOMMUNITY.md`. O arquivo será substituído na T-2 |
| `README.md` deste repositório cita `empirehub.com.br`, um link do Discord fora da regra R-5 e React | Fora do escopo da T-1; registrado para o Regente |
| `https://empirecommunity.org/discord` responde 404 hoje | `/discord` redireciona pelo país para as páginas de regras, que entram no ar com o site (D-29, D-78) |

## 12. O que fica para a T-2

Direção visual completa (rodada de conceito do impeccable), `PRODUCT.md`, tokens, tipografia aberta, componentes com
todos os estados e decisão sobre uma eventual faixa visual na Home. O hero foi desenhado para funcionar só com texto,
então nenhuma imagem é pré-requisito.
