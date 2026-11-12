# Copy do site: empirecommunity.org

Tarefa T-1. Autoria: Bússola. Estado: **proposta para revisão do dono**.
Estrutura e regras em [`docs/design/information-architecture.md`](../design/information-architecture.md).

## Convenções

- `[PENDING P-xx]`: dado real que ainda falta. A lista completa está na §9 da arquitetura. O elemento não é renderizado
  enquanto estiver vazio.
- `{{nome}}`: valor vindo de dado.
- Membros: `{{n}}` segue a regra de `members-json` (`880+`). Outros números: `1.234` em pt-BR, `1,234` em en-US.
- Reais: `R$ 3.000` em pt-BR, `R$ 3,000` em en-US; os centavos aparecem só quando o valor os tem (`R$ 284,99`, `R$ 284.99`).
- Datas: `8 de novembro de 2026` em pt-BR, `November 8, 2026` em en-US.
- `—` numa célula significa que o elemento não existe naquele idioma.
- A marca se escreve **EmpireCommunity**, sem espaço. **EmpireHub** é o produto de jogos de mesa, não a comunidade.

## Globais

### Header

| Id | pt-BR | en-US |
|---|---|---|
| nav.projects | Projetos | Projects |
| nav.infrastructure | Infraestrutura | Infrastructure |
| nav.join | Participar | Join |
| nav.support | Apoiar | Support us |
| nav.organization | Organização | Organization |
| nav.menu.open | Menu | Menu |
| nav.menu.close | Fechar | Close |
| nav.skip | Pular para o conteúdo | Skip to content |
| nav.aria | Principal | Main |
| lang.nav.aria | Idioma | Language |
| lang.pt | Português | Português |
| lang.en | English | English |
| logo.alt | EmpireCommunity, página inicial | EmpireCommunity, home page |

### Canais e números

| Id | pt-BR | en-US |
|---|---|---|
| cta.discord | Entrar no Discord | Join the Discord |
| cta.whatsapp | Entrar no WhatsApp | — |
| count.discord | {{n}} membros no Discord | {{n}} Discord members |
| count.whatsapp | {{n}} membros no WhatsApp | — |
| count.repos | {{n}} repositórios públicos | {{n}} public repositories |

### Status

| Id | pt-BR | en-US |
|---|---|---|
| status.live | No ar | Live |
| status.development | Em desenvolvimento | In development |
| status.soon | Em breve | Coming soon |
| link.site | Site | Website |
| link.code | Código | Code |
| link.all | Ver todos | See all |

### Rodapé

| Id | pt-BR | en-US |
|---|---|---|
| footer.site | Site | Site |
| footer.community | Comunidade | Community |
| footer.discord | Discord | Discord |
| footer.whatsapp | WhatsApp | — |
| footer.github | GitHub | GitHub |
| footer.contact | Contato | Contact |
| footer.legal | Legal | Legal |
| footer.terms | Termos de Uso | Terms of Use |
| footer.privacy | Política de Privacidade | Privacy Policy |
| footer.line | EmpireCommunity. Comunidade sediada no Brasil. | EmpireCommunity. A community based in Brazil. |

## Home

| Id | pt-BR | en-US |
|---|---|---|
| meta.title | EmpireCommunity: comunidade brasileira de jogos e tecnologia | EmpireCommunity: a Brazilian gaming and technology community |
| meta.description | Comunidade brasileira de jogadores e aficionados por tecnologia. Servidores de jogos e bots para Discord, gratuitos e mantidos por doações voluntárias. | A Brazilian community of gamers and technology enthusiasts. Free game servers and Discord bots, funded by voluntary donations. |
| hero.title | Uma comunidade brasileira que mantém servidores de jogos e desenvolve software. | A Brazilian community that runs game servers and builds software. |
| hero.lead | Somos jogadores e aficionados por tecnologia. Tudo aqui é gratuito, vive de doações voluntárias e nada é vendido. | We are gamers and technology enthusiasts. Everything here is free, runs on voluntary donations, and nothing is for sale. |
| hero.link | Ver projetos | See projects |
| purpose.title | Propósito | Purpose |
| purpose.body | A EmpireCommunity existe para que ninguém precise jogar sozinho. Reunimos quem gosta de jogos e de tecnologia em um ambiente amigável e mantemos servidores para que cada pessoa possa entrar no mundo quando quiser, de graça, com o apoio de doações voluntárias. | EmpireCommunity exists so that no one has to play alone. We bring together people who enjoy games and technology in a friendly environment, and we keep servers running so that anyone can enter the world whenever they want, for free, with the support of voluntary donations. |
| what.title | O que fazemos | What we do |
| what.servers.title | Servidores de jogos | Game servers |
| what.servers.body | Hospedamos servidores para os membros jogarem. O Minecraft está no ar; Palworld, Project Zomboid e Factorio chegam em breve. | We host game servers for our members. Minecraft is live; Palworld, Project Zomboid and Factorio are coming soon. |
| what.bots.title | Bots para Discord | Discord bots |
| what.bots.body | O EmpireMuse toca música nos canais de voz. O EmpireBot, em desenvolvimento, vai integrar o Discord aos servidores de jogos. | EmpireMuse plays music in voice channels. EmpireBot, in development, will connect Discord to our game servers. |
| what.community.title | Comunidade | Community |
| what.community.body | Um ambiente amigável no Discord e no WhatsApp, onde os membros conversam e pedem novos jogos. | A friendly place on Discord, where members talk and request new games. |
| projects.title | Projetos | Projects |
| servers.title | Servidores de jogos | Game servers |
| servers.request | Pedir um jogo | Request a game |
| funding.title | Como nos mantemos | How we are funded |
| funding.body | A EmpireCommunity vive de doações voluntárias. O primeiro marco é de R$ 5.384,99, para montar um servidor próprio, com Xeon e 128 GB de RAM, que vai hospedar mais servidores de jogos. Depois dele, continuam os custos da comunidade: energia dos servidores, melhorias, hospedagem e domínios. As doações em dinheiro ainda não estão abertas. | EmpireCommunity runs on voluntary donations. The first milestone is R$ 5,384.99, to build our own server, with a Xeon and 128 GB of RAM, to host more game servers. After that, community costs continue: server power, upgrades, hosting and domains. Money donations are not open yet. |
| funding.link | Apoiar | Support us |
| join.title | Faça parte. | Join us. |
| join.body | A entrada é gratuita. | Joining is free. |

## Projetos

| Id | pt-BR | en-US |
|---|---|---|
| meta.title | Projetos: EmpireCommunity | Projects: EmpireCommunity |
| meta.description | Os projetos da EmpireCommunity e a situação real de cada um. | EmpireCommunity's projects and the actual status of each one. |
| title | Projetos | Projects |
| lead | Tudo o que a organização desenvolve, com a situação real de cada projeto. Só há link para o que já funciona. | Everything the organization builds, with the actual status of each project. Only what already works has a link. |
| legend.live | No ar: funcionando e disponível. | Live: running and available. |
| legend.development | Em desenvolvimento: em construção, ainda sem acesso público. | In development: being built, not yet publicly available. |
| empiremuse.body | Bot de música para Discord, com player interativo e painel web. | Music bot for Discord, with an interactive player and a web panel. |
| empiremuse.credit | Obra derivada do MuseHeart-MusicBot, de zRitsu (GPL-2.0). | Derivative work of MuseHeart-MusicBot, by zRitsu (GPL-2.0). |
| relay.body | Anuncia no Discord as novas versões dos projetos da organização. Status: `[PENDING P-10]` | Announces new releases of the organization's projects on Discord. Status: `[PENDING P-10]` |
| site.body | Este site. | This website. |
| empirehub.body | Jogos de mesa, tabuleiro e cartas dentro do Discord, como Discord Activity. | Tabletop, board and card games inside Discord, as a Discord Activity. |
| empirebot.body | Integra o Discord aos servidores de jogos: vínculo de conta, whitelist e cargos. | Connects Discord to game servers: account linking, whitelist and roles. |
| empirecraft.body | Mod para Minecraft. | A Minecraft mod. |
| open.title | Código aberto | Open source |
| open.body | Os repositórios públicos ficam na organização EmpireCommunity no GitHub. Cada um tem a própria licença. Para colaborar, leia os guias da organização e fale com a gente no Discord. | Public repositories live under the EmpireCommunity organization on GitHub. Each one has its own license. To contribute, read the organization's guides and talk to us on Discord. |
| open.github | Ver no GitHub | View on GitHub |
| open.guides | Guias de colaboração | Contribution guides |
| activity.title | Atividade recente | Recent activity |
| activity.updated | Atualizado em {{date}} | Updated on {{date}} |

## Infraestrutura e servidores de jogos

| Id | pt-BR | en-US |
|---|---|---|
| meta.title | Infraestrutura e servidores de jogos: EmpireCommunity | Infrastructure and game servers: EmpireCommunity |
| meta.description | Os servidores de jogos da EmpireCommunity, o que vem a seguir e onde a comunidade roda. | EmpireCommunity's game servers, what comes next, and where the community runs. |
| title | Infraestrutura e servidores de jogos | Infrastructure and game servers |
| lead | O que está disponível para jogar hoje, o que vem a seguir e onde tudo isso roda. | What you can play today, what comes next, and where it all runs. |
| servers.title | Servidores de jogos | Game servers |
| minecraft.name | Minecraft | Minecraft |
| minecraft.access | O acesso se dá pelo Discord, que em breve funcionará como whitelist dos servidores. | Access is through Discord, which will soon act as the servers' whitelist. |
| palworld.name | Palworld | Palworld |
| zomboid.name | Project Zomboid | Project Zomboid |
| factorio.name | Factorio | Factorio |
| request.title | Pedir um jogo | Request a game |
| request.body | Os membros podem pedir novos jogos no Discord ou no WhatsApp. | Members can request new games on Discord. |
| request.link | Participar | Join |
| where.title | Onde tudo roda | Where it all runs |
| where.body | Os serviços da comunidade rodam em um servidor virtual no Brasil, com tráfego protegido pela Cloudflare. | The community's services run on a virtual server in Brazil, with traffic protected by Cloudflare. |
| own.title | Servidor próprio | Our own server |
| own.status | Em montagem | Being built |
| own.body | Estamos montando um servidor local, com Xeon e 128 GB de RAM, para hospedar mais servidores de jogos. Ele ainda não está em uso. | We are building a local server, with a Xeon and 128 GB of RAM, to host more game servers. It is not in use yet. |
| own.link | Apoiar a montagem | Support the build |

## Como participar

| Id | pt-BR | en-US |
|---|---|---|
| meta.title | Como participar: EmpireCommunity | How to join: EmpireCommunity |
| meta.description | Entre na EmpireCommunity pelo Discord ou pelo WhatsApp. É gratuito. | Join EmpireCommunity on Discord. It's free. |
| title | Como participar | How to join |
| lead | A EmpireCommunity é aberta a quem gosta de jogos e tecnologia. Escolha o canal que preferir. | EmpireCommunity is open to anyone who enjoys games and technology. |
| discord.title | Discord | Discord |
| discord.body | O servidor EmpireCommunity. Conversa e pedidos de jogos. | The EmpireCommunity server. Most members are Brazilian. Discord is also how people from other countries reach us for contact, support and collaboration on open source projects. |
| whatsapp.title | WhatsApp | — |
| whatsapp.body | Uma comunidade de 12 grupos. Conversa e pedidos de jogos. | — |
| do.title | O que dá para fazer | What you can do |
| do.play.title | Jogar | Play |
| do.play.body | Veja quais servidores estão no ar. | See which servers are live. |
| do.request.title | Pedir um jogo | Request a game |
| do.request.body | Peça novos jogos no Discord ou no WhatsApp. | Request new games on Discord. |
| do.contribute.title | Colaborar | Contribute |
| do.contribute.body | Parte do nosso código é pública, no GitHub. | Part of our code is public, on GitHub. |
| do.support.title | Apoiar | Support us |
| do.support.body | Doações são voluntárias e ajudam a manter tudo no ar. | Donations are voluntary and help keep everything running. |
| faq.title | Perguntas frequentes | Frequently asked questions |
| faq.paid.q | É pago? | Does it cost anything? |
| faq.paid.a | Não. Tudo é gratuito e nada é vendido. A comunidade vive de doações voluntárias. | No. Everything is free and nothing is for sale. The community runs on voluntary donations. |
| faq.donate.q | Preciso doar? | Do I have to donate? |
| faq.donate.a | Não. Doar é sempre opcional. | No. Donating is always optional. |
| faq.request.q | Posso pedir um jogo? | Can I request a game? |
| faq.request.a | Pode. Faça o pedido no Discord ou no WhatsApp. | Yes. Ask on Discord. |
| faq.abroad.q | Não moro no Brasil. Posso participar? | I don't live in Brazil. Can I join? |
| faq.abroad.a | Pode, pelo Discord. É nele que atendemos quem é de fora. A comunidade no WhatsApp é de brasileiros. | Yes, on Discord. That is where we talk with people from other countries. |
| faq.contact.q | Como falo com a equipe? | How do I reach the team? |
| faq.contact.a | O caminho mais rápido é o Discord. Também atendemos por contact@empirecommunity.org. | Discord is the fastest way. You can also write to contact@empirecommunity.org. |

## Apoiar

| Id | pt-BR | en-US |
|---|---|---|
| meta.title | Apoiar: EmpireCommunity | Support us: EmpireCommunity |
| meta.description | O primeiro marco da EmpireCommunity é de R$ 5.384,99 para montar um servidor próprio. Veja as peças e o que já foi feito. | EmpireCommunity's first milestone is R$ 5,384.99 to build its own server. See the parts and what has been done so far. |
| title | Apoiar | Support us |
| lead | A EmpireCommunity é gratuita e vive de doações voluntárias. Doar nunca é obrigatório. | EmpireCommunity is free and runs on voluntary donations. Donating is never required. |
| goal.title | Meta atual | Current goal |
| goal.value | R$ 5.384,99 | R$ 5,384.99 |
| goal.body | A meta é montar um servidor local, com Xeon e 128 GB de RAM, para hospedar mais servidores de jogos. Ele está em montagem e ainda não está em uso. Esse é o primeiro marco: depois dele, continuam os custos da comunidade, como energia dos servidores, melhorias, hospedagem e domínios. | The goal is to build a local server, with a Xeon and 128 GB of RAM, to host more game servers. It is being built and is not in use yet. This is the first milestone: after it, community costs continue, such as server power, upgrades, hosting and domains. |
| goal.progress | {{secured}} de R$ 5.384,99 | {{secured}} of R$ 5,384.99 |
| support.goal.reached | Este marco foi alcançado. Os custos da comunidade continuam: energia dos servidores, melhorias, hospedagem e domínios. | This milestone has been reached. Community costs continue: server power, upgrades, hosting and domains. |
| support.progress.criterion | O progresso conta o valor das peças já compradas ou doadas, não dinheiro recebido. | Progress counts the value of parts already bought or donated, not money received. |
| support.notice | Doações em dinheiro abrem em breve. | Money donations open soon. |
| support.donations.notOpen | As doações em dinheiro ainda não estão abertas. O site não recebe dinheiro e não indica nenhuma forma de enviar. | Money donations are not open yet. This website does not receive money and does not give any way to send it. |
| parts.title | Peças do servidor | Server parts |
| parts.col.part | Peça | Part |
| parts.col.value | Valor | Value |
| parts.col.status | Situação | Status |
| parts.status.bought | Comprada | Bought |
| parts.status.donated | Doada | Donated |
| parts.status.missing | Falta | Needed |
| parts.items | Vêm de `support.yaml` (nome nos dois idiomas, quantidade, valor unitário, situação). Sem fotos por enquanto. | Come from `support.yaml` (name in both languages, quantity, unit price, status). No photos for now. |
| donate.parts.title | Doar peças | Donate parts |
| donate.parts.body | Também aceitamos peças doadas para o servidor. Antes de enviar, fale com a equipe pelo Discord ou por contact@empirecommunity.org. | We also accept donated parts for the server. Before sending anything, talk to the team on Discord or at contact@empirecommunity.org. |
| other.title | Outras formas de ajudar | Other ways to help |
| other.body | Parte do nosso código é pública. Colaborações são bem-vindas no GitHub. | Part of our code is public. Contributions are welcome on GitHub. |
| transparency.title | Transparência | Transparency |
| transparency.sold | Nada é vendido. | Nothing is for sale. |
| transparency.data | Este site não vende dados de usuários e só os compartilha com os fornecedores necessários para funcionar, como explica a Política de Privacidade. | This website does not sell user data and shares it only with the providers needed to run it, as the Privacy Policy explains. |

## Organização

| Id | pt-BR | en-US |
|---|---|---|
| meta.title | Organização: EmpireCommunity | Organization: EmpireCommunity |
| meta.description | Quem mantém a EmpireCommunity, como ela funciona e seus endereços oficiais. | Who runs EmpireCommunity, how it works, and its official addresses. |
| title | Organização | Organization |
| lead | A EmpireCommunity é uma comunidade de jogadores e aficionados por tecnologia, sediada no Brasil. | EmpireCommunity is a community of gamers and technology enthusiasts, based in Brazil. |
| since | Desde {{year}} | Since {{year}} |
| origin.title | Como começou | How it started |
| origin.p1 | Tudo começou com a dificuldade de encontrar pessoas para jogar junto. O fundador sempre gostou de jogos de estratégia e de construção e imaginava como seria jogá-los com amigos. Só que jogar junto não bastava: o mundo só existia enquanto alguém estivesse online. Daí veio a vontade de hospedar os jogos, para que cada um pudesse entrar a qualquer momento. | It all started with the difficulty of finding people to play with. The founder always enjoyed strategy and building games and imagined what it would be like to play them with friends. But playing together was not enough: the world only existed while someone was online. That led to the desire to host the games, so that anyone could join at any time. |
| origin.p2 | Em 20 de agosto de 2022 nasceu o servidor no Discord. Foram chegando pessoas com o mesmo interesse, a comunidade cresceu e, juntos, arrecadamos verba para hospedar servidores, principalmente de Minecraft com modpacks. | On August 20, 2022, the Discord server was born. People with the same interest kept arriving, the community grew and, together, we raised funds to host servers, mainly Minecraft with modpacks. |
| how.title | Como funciona | How it works |
| how.free | Tudo é gratuito e vive de doações voluntárias. | Everything is free and runs on voluntary donations. |
| how.sold | Nada é vendido. | Nothing is for sale. |
| how.data | Este site não vende dados de usuários e só os compartilha com os fornecedores necessários para funcionar, como explica a Política de Privacidade. | This website does not sell user data and shares it only with the providers needed to run it, as the Privacy Policy explains. |
| names.title | Nomes | Names |
| names.community | **EmpireCommunity** é a organização e a comunidade, e dá nome ao servidor no Discord e à comunidade no WhatsApp. | **EmpireCommunity** is the organization and the community, and the name of its Discord server. |
| names.hub | **EmpireHub** é o produto de jogos de mesa dentro do Discord. | **EmpireHub** is the tabletop games product inside Discord. |
| founder.title | Fundador | Founder |
| founder.name | Leonne Martins `[PENDING P-05: consentimento]` | Leonne Martins `[PENDING P-05: consent]` |
| founder.role | Fundador | Founder |
| founder.nickname | `[PENDING P-05]` | `[PENDING P-05]` |
| founder.bio | `[PENDING P-05]` | `[PENDING P-05]` |
| team.title | Equipe | Team |
| team.items | `[PENDING P-04]` | `[PENDING P-04]` |
| addresses.title | Endereços oficiais | Official addresses |
| addresses.main | Este site | This website |
| addresses.muse | Site e painel do EmpireMuse | EmpireMuse website and panel |
| addresses.hub | Site do EmpireHub | EmpireHub website |
| addresses.cloud | Servidores de jogos: status e acesso | Game servers: status and access |
| addresses.github | Organização no GitHub | GitHub organization |
| addresses.note | Por enquanto a comunidade não mantém perfis em outras redes sociais. Perfis com o nosso nome fora desta lista não são oficiais. | For now, the community has no profiles on other social networks. Profiles using our name outside this list are not official. |
| contact.title | Contato | Contact |
| contact.discord | O caminho mais rápido é o Discord. | Discord is the fastest way. |
| contact.general | Assuntos gerais: contact@empirecommunity.org | General matters: contact@empirecommunity.org |
| contact.legal | Assuntos legais e dados pessoais: legal@empirecommunity.org | Legal matters and personal data: legal@empirecommunity.org |

## Páginas especiais

Uma única versão, com os dois idiomas na mesma página (`routing-locale`). O `<title>` da 404 fica só em inglês, o idioma da página (`html lang="en-US"`): um `<title>` não marca troca de idioma. O português fica na seção própria com `lang="pt-BR"`.

| Id | Texto |
|---|---|
| chooser.meta.title | EmpireCommunity |
| chooser.title | EmpireCommunity |
| chooser.link.pt | Português (Brasil) |
| chooser.link.en | English |
| 404.meta.title | Page not found |
| 404.title.pt | Página não encontrada |
| 404.body.pt | Este endereço não existe ou mudou de lugar. |
| 404.link.pt | Ir para o início |
| 404.title.en | Page not found |
| 404.body.en | This address does not exist or has moved. |
| 404.link.en | Go to the home page |

## Regras da comunidade: `/discord` (D-41)

Uma página por idioma (`/pt-br/discord/` e `/en-us/discord/`, D-78). Comportamento em `routing-locale`,
dados em `site-data` §14 e layout na §7.10 da arquitetura. Nenhum texto desta seção cita o WhatsApp, e nenhum pode dizer
ou sugerir que a confirmação fica registrada, é verificada ou é exigida pelo site.

| Id | pt-BR | en-US |
|---|---|---|
| meta.discord.title | Regras da comunidade: EmpireCommunity | Community rules: EmpireCommunity |
| meta.discord.description | As regras da comunidade EmpireCommunity e como entrar. | The EmpireCommunity rules and how to join. |
| discord.heading | Regras da comunidade | Community rules |
| discord.updated | Atualizadas em {{date}} | Updated on {{date}} |
| discord.agree | Li as regras e concordo com elas. | I have read the rules and agree with them. |
| discord.pending | Marque a caixa para ver os botões. | Tick the box to see the buttons. |

`{{date}}` vem de `updatedOn` (`2025-02-27`): `27 de fevereiro de 2025` em pt-BR e `February 27, 2025` em en-US.
`discord.jump` e `discord.links.lead` foram removidas (T-69 §5): o seletor de idioma substitui a primeira e os botões já dizem o canal.

Rótulos dos botões, vindos de `join-channels.yaml` (`site-data` §3 e §8): `Discord` e `WhatsApp` na página pt-BR;
`Discord` na página en-US.

### Texto das regras

Coluna pt-BR: texto literal do dono, sem revisão, inclusive número, dois-pontos e pontuação; a única alteração do dono foi
retirar a marcação de emoji do Discord. Coluna en-US: tradução fiel da Bússola, que mantém o nome do canal. `<br>` marca
a quebra de linha do original.

| Id | pt-BR | en-US |
|---|---|---|
| rules.spam.title | 1 - Proibição de Spam: | 1 - No Spam: |
| rules.spam.body | Não envie mensagens repetitivas, conteúdo não solicitado ou links excessivos em nenhum canal do servidor. Isso inclui spam de emojis, caracteres ou mensagens idênticas. | Do not send repetitive messages, unsolicited content or excessive links in any channel of the server. This includes spamming emojis, characters or identical messages. |
| rules.false-identity.title | 2 - Identidade Falsa: | 2 - False Identity: |
| rules.false-identity.body | Não finja ser outra pessoa, use identidades falsas ou compartilhe informações pessoais de terceiros sem permissão. Seja honesto sobre quem você é. | Do not pretend to be another person, use false identities or share third parties' personal information without permission. Be honest about who you are. |
| rules.advertising.title | 3 - Proibição de Divulgação nos Canais/Privado de Membros: | 3 - No Advertising in Channels or Members' Private Messages: |
| rules.advertising.body | Não envie mensagens de divulgação ou convites nos canais do servidor ou por mensagem privada sem permissão explícita. Isso inclui promover servidores, produtos ou serviços sem autorização. | Do not send advertising messages or invitations in the server's channels or by private message without explicit permission. This includes promoting servers, products or services without authorization. |
| rules.hate.title | 4 - Sem Propagação de Ódio: | 4 - No Spreading of Hate: |
| rules.hate.body | Não compartilhe ou promova discurso de ódio, discriminação, racismo, sexismo, homofobia, transfobia, ou qualquer forma de preconceito ou intolerância com o intuito de ofensa. Piadas de humor negro e brincadeiras entre amigos são permitidas até certo limite, desde que não tenham o intuito de ofender ou denegrir alguém. | Do not share or promote hate speech, discrimination, racism, sexism, homophobia, transphobia, or any form of prejudice or intolerance with the intent to offend. Dark humor jokes and banter among friends are allowed up to a certain limit, as long as they are not intended to offend or demean anyone. |
| rules.discord-guidelines.title | 5 - Seguir as Diretrizes do Discord: | 5 - Follow Discord's Guidelines: |
| rules.discord-guidelines.body | Todos os membros devem seguir as Diretrizes do Discord em todos os canais e interações dentro do servidor. Isso inclui o cumprimento dos Termos de Serviço, Diretrizes da Comunidade e Política de Privacidade do Discord.<br>https://discord.com/terms | All members must follow Discord's Guidelines in all channels and interactions within the server. This includes complying with Discord's Terms of Service, Community Guidelines and Privacy Policy.<br>https://discord.com/terms |
| rules.adult-content.title | 6 - Conteúdo explícito +18: | 6 - Explicit 18+ Content: |
| rules.adult-content.body | Proibido qualquer publicação de conteúdo destinado a adultos como pornografia, nudes, drogas, violência explícita, linguagem vulgar e temas adultos. Exceto no canal #🔞┃sapecagens, o qual é necessário comprovação de idade pelo discord e destinado para discussões sobre temas maduros, humor adulto e memes, desde que não sejam explícitos. | Any posting of content intended for adults, such as pornography, nudes, drugs, explicit violence, vulgar language and adult themes, is prohibited. The exception is the #🔞┃sapecagens channel, which requires age verification through Discord and is intended for discussions of mature topics, adult humor and memes, as long as they are not explicit. |
| rules.closing | Qualquer violação dessa regra resultará em medidas disciplinares apropriadas. | Any violation of this rule will result in appropriate disciplinary action. |

---

# Textos legais

> **Rascunho para revisão do dono.** Linguagem simples, sem revisão de advogado. Os fatos vêm de `EMPIRECOMMUNITY.md`.
> Cláusulas propostas, sem fato de origem: Termos 5, 7 e 8; Privacidade 8 e 11 (prazos de remoção ficam de fora até o dono
> confirmá-los na revisão jurídica). Os dois idiomas têm o mesmo conteúdo e, por isso, não citam o WhatsApp.
>
> **No lançamento, Termos e Privacidade não descrevem doações, provedor de pagamento nem dados de pagamento** (D-28,
> `site-data` §11). O contrato posterior de doações atualiza os dois textos, com nova versão e nova vigência.
>
> **Revisão jurídica necessária antes de receber doações:** Privacidade 2, 3 e 9. Não manter registros de acesso é
> exceção decidida pelo dono (D-20) e precisa ser conferida diante do Marco Civil da Internet.

## Interface das páginas legais

Textos de interface das duas páginas (Termos e Privacidade), usados na página e não no texto legal. A data de vigência só
aparece quando o arquivo do texto tem `effectiveDate` (a data de lançamento, D-51); sem ela, nada é exibido.

| Id | pt-BR | en-US |
|---|---|---|
| legal.version | Versão {{version}} | Version {{version}} |
| legal.effective | Vigência: {{date}} | Effective date: {{date}} |
| legal.toc | Sumário | Contents |

`{{version}}` vem do `version` do arquivo (`1.0`); `{{date}}` vem de `effectiveDate`: `1 de dezembro de 2026` em pt-BR e
`December 1, 2026` em en-US (mesma regra de formatação da data das regras da comunidade).

## Termos de Uso (pt-BR)

Meta: título "Termos de Uso: EmpireCommunity"; descrição "As regras de uso do site da EmpireCommunity."

Vigência: `[PENDING P-12]`

**1. Sobre este site.** Este site apresenta a EmpireCommunity, comunidade de jogadores e aficionados por tecnologia
sediada no Brasil. Ao usar o site, você concorda com estes termos.

**2. Gratuidade.** O site e os serviços da comunidade são gratuitos. Nada é vendido.

**3. Informações do site.** Procuramos manter status, metas e demais informações atualizados, mas eles podem mudar sem
aviso.

**4. Serviços, canais e links de terceiros.** O site aponta para serviços e canais de terceiros, como plataformas de
conversa e o GitHub, que têm regras próprias. Os serviços hospedados pela EmpireCommunity podem ter termos próprios.

**5. Disponibilidade.** Servidores de jogos e projetos são mantidos pela comunidade e podem mudar, ser interrompidos ou
encerrados.

**6. Marcas e conteúdo.** Marcas e assets da EmpireCommunity pertencem ao seu fundador, Leone Santos Martins. O código de cada
projeto segue a licença do respectivo repositório.

**7. Uso adequado.** Não use o site para atacar, sobrecarregar ou tentar burlar a segurança dele ou de terceiros, nem
para se passar pela EmpireCommunity.

**8. Responsabilidade.** O site é oferecido como está, na medida permitida pela lei.

**9. Lei aplicável e foro.** Valem as leis do Brasil, em especial a Lei Geral de Proteção de Dados (LGPD) e o Marco
Civil da Internet. Fica eleito o foro de Goiânia-GO.

**10. Alterações e contato.** Estes termos podem mudar, e a data de vigência será atualizada. Dúvidas:
legal@empirecommunity.org.

## Terms of Use (en-US)

Meta: title "Terms of Use: EmpireCommunity"; description "The rules for using the EmpireCommunity website."

Effective date: `[PENDING P-12]`

**1. About this website.** This website presents EmpireCommunity, a community of gamers and technology enthusiasts based
in Brazil. By using the website, you agree to these terms.

**2. Free of charge.** The website and the community's services are free. Nothing is for sale.

**3. Website information.** We try to keep statuses, goals and other information up to date, but they may change without
notice.

**4. Third-party services, channels and links.** The website points to third-party services and channels, such as chat
platforms and GitHub, which have their own rules. Services hosted by EmpireCommunity may have their own terms.

**5. Availability.** Game servers and projects are maintained by the community and may change, be interrupted or be
discontinued.

**6. Trademarks and content.** EmpireCommunity's trademarks and assets belong to its founder, Leone Santos Martins. Each
project's code follows the license of its repository.

**7. Acceptable use.** Do not use the website to attack, overload or try to bypass the security of the website or of
third parties, or to impersonate EmpireCommunity.

**8. Liability.** The website is provided as is, to the extent permitted by law.

**9. Governing law and venue.** The laws of Brazil apply, in particular the General Data Protection Law (LGPD) and the
Brazilian Civil Rights Framework for the Internet (Marco Civil da Internet). The courts of Goiânia-GO, Brazil, have
jurisdiction.

**10. Changes and contact.** These terms may change, and the effective date will be updated. Questions:
legal@empirecommunity.org.

## Política de Privacidade (pt-BR)

Meta: título "Política de Privacidade: EmpireCommunity"; descrição "Quais dados o site da EmpireCommunity trata e por quê."

Vigência: `[PENDING P-12]`

**1. Quem é responsável.** O controlador dos dados, nos termos da LGPD, é Leone Santos Martins, pessoa física. Contato:
legal@empirecommunity.org. Esta política vale para o site empirecommunity.org. Os demais serviços da comunidade têm políticas próprias.

**2. O que este site não faz.** O site não tem formulários, contas ou cadastro, não define cookies próprios, não mantém
registros de acesso e não vende dados de usuários. O item 7 diz com quem os dados são compartilhados.

**3. Registros técnicos.** O servidor do site não mantém registros de acesso. Ele guarda apenas registros mínimos de
erro, para diagnóstico. Esses registros podem conter o endereço de conexão de quem acessava o site quando o erro
ocorreu, são substituídos em rotação curta e se perdem quando o servidor do site é recriado. O serviço automático que
atualiza o número de membros armazena apenas esse número da comunidade e dados técnicos da própria atualização, sem
nenhum dado de visitantes.

**4. Estatísticas de uso.** Usamos o Cloudflare Web Analytics para saber quantas visitas as páginas do site recebem. A
página Apoiar e a página de regras da comunidade (/discord) não usam essa ferramenta, e as visitas a elas não são
contadas. Essa ferramenta não usa cookies nem armazenamento local no seu navegador e não identifica pessoas.

**5. Escolha de idioma.** Ao acessar o endereço principal, a Cloudflare identifica o país da conexão para enviar você à
versão em português ou em inglês. O site não guarda essa informação.

**6. Contato por e-mail.** Se você nos escrever, usaremos o que você enviar para responder.

**7. Com quem os dados são compartilhados.** Apenas com os fornecedores necessários para o site funcionar: a hospedagem
e a Cloudflare. A Cloudflare processa a conexão entre você e o site e mantém registros próprios, fora do controle deste
site. Os serviços externos para os quais o site aponta têm termos e políticas de privacidade próprios.

**8. Base legal.** Tratamos registros de erro e estatísticas com base em legítimo interesse, para manter o site
funcionando e seguro, e mensagens para atender ao seu pedido de contato.

**9. Por quanto tempo.** O servidor do site não guarda registros de acesso, e os registros de erro são substituídos em
rotação curta. Os demais dados ficam enquanto estiverem em uso e são apagados a pedido, exceto o que a lei obrigar a
guardar.

**10. Seus direitos.** Pela LGPD, você pode pedir confirmação do tratamento, acesso, correção, anonimização, portabilidade
ou eliminação dos seus dados. Basta escrever para legal@empirecommunity.org.

**11. Pessoas listadas no site.** Só aparecem na página Organização pessoas maiores de idade que deram consentimento
registrado, e somente com os dados que cada uma autorizou. Para retirar o consentimento ou pedir a remoção, escreva para
legal@empirecommunity.org; removemos esses dados do site e dos arquivos que publicamos. O código e os dados deste site
ficam em um repositório público no GitHub, que guarda o histórico de todas as alterações. Por isso, mesmo depois da
remoção, o que já foi publicado continua nesse histórico e em cópias do repositório feitas por outras pessoas. Cada
pessoa é avisada disso antes de ser listada.

**12. Alterações.** Esta política pode mudar, e a data de vigência será atualizada.

## Privacy Policy (en-US)

Meta: title "Privacy Policy: EmpireCommunity"; description "What data the EmpireCommunity website handles and why."

Effective date: `[PENDING P-12]`

**1. Who is responsible.** The data controller under the LGPD is Leone Santos Martins, a natural person. Contact:
legal@empirecommunity.org. This policy applies to the empirecommunity.org website. The community's other services have their own policies.

**2. What this website does not do.** The website has no forms, accounts or registration, sets no cookies of its own,
keeps no access logs, and does not sell user data. Item 7 says who data is shared with.

**3. Technical records.** The website's server keeps no access logs. It keeps only minimal error records, for diagnosis.
These records may contain the connection address of whoever was accessing the website when the error occurred, are
replaced on a short rotation, and are lost when the website's server is recreated. The automated service that updates
the member count stores only that community number and technical data about its own update, with no visitor data.

**4. Usage statistics.** We use Cloudflare Web Analytics to learn how many visits the website's pages receive. The
Support page and the community rules page (/discord) do not use this tool, and visits to them are not counted. This tool does not
use cookies or local storage in your browser and does not identify people.

**5. Language selection.** When you open the main address, Cloudflare identifies the country of your connection to send
you to the Portuguese or English version. The website does not keep this information.

**6. Contact by email.** If you write to us, we will use what you send in order to reply.

**7. Who data is shared with.** Only the providers needed to run the website: the hosting provider and Cloudflare.
Cloudflare processes the connection between you and the website and keeps its own records, outside this website's
control. External services linked from the website have their own terms and privacy policies.

**8. Legal basis.** We process error records and statistics on the basis of legitimate interest, to keep the website
running and secure, and messages to respond to your contact request.

**9. How long.** The website's server keeps no access logs, and error records are replaced on a short rotation. Other
data is kept while in use and is deleted on request, except what the law requires us to keep.

**10. Your rights.** Under the LGPD, you may request confirmation of processing, access, correction, anonymization,
portability or deletion of your data. Just write to legal@empirecommunity.org.

**11. People listed on the website.** Only adults who have given recorded consent appear on the Organization page, and
only with the data each person has authorized. To withdraw consent or request removal, write to
legal@empirecommunity.org; we remove that data from the website and from the files we publish. This website's code and
data are in a public repository on GitHub, which keeps the history of every change. Because of this, even after removal,
what was already published remains in that history and in copies of the repository made by other people. Each person is
told this before being listed.

**12. Changes.** This policy may change, and the effective date will be updated.
