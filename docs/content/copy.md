# Copy do site: empirecommunity.org

Tarefa T-1. Autoria: Bússola. Estado: **proposta para revisão do dono**.
Estrutura e regras em [`docs/design/information-architecture.md`](../design/information-architecture.md).

## Convenções

- `[PENDING P-xx]`: dado real que ainda falta. A lista completa está na §9 da arquitetura. O elemento não é renderizado
  enquanto estiver vazio.
- `{{nome}}`: valor vindo de dado.
- Membros: `{{n}}` segue a regra de `members-json` (`880+`). Outros números: `1.234` em pt-BR, `1,234` em en-US.
- Reais: `R$ 3.000` em pt-BR, `R$ 3,000` em en-US.
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
| count.whatsapp | {{n}} membros no WhatsApp `[PENDING P-08]` | — |
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
| funding.body | A EmpireCommunity vive de doações voluntárias por Pix. A meta atual é de R$ 3.000 para montar um servidor próprio, com Xeon e 128 GB de RAM, que vai hospedar mais servidores de jogos. | EmpireCommunity runs on voluntary donations through Pix, Brazil's instant payment system. Our current goal is R$ 3,000 to build our own server, with a Xeon and 128 GB of RAM, to host more game servers. |
| funding.progress | {{arrecadado}} de R$ 3.000 `[PENDING P-03]` | {{raised}} of R$ 3,000 `[PENDING P-03]` |
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
| activity.updated | Atualizado em {{data}} | Updated on {{date}} |

## Infraestrutura e servidores de jogos

| Id | pt-BR | en-US |
|---|---|---|
| meta.title | Infraestrutura e servidores de jogos: EmpireCommunity | Infrastructure and game servers: EmpireCommunity |
| meta.description | Os servidores de jogos da EmpireCommunity, o que vem a seguir e onde a comunidade roda. | EmpireCommunity's game servers, what comes next, and where the community runs. |
| title | Infraestrutura e servidores de jogos | Infrastructure and game servers |
| lead | O que está disponível para jogar hoje, o que vem a seguir e onde tudo isso roda. | What you can play today, what comes next, and where it all runs. |
| servers.title | Servidores de jogos | Game servers |
| minecraft.name | Minecraft | Minecraft |
| minecraft.access | Para jogar, fale com a comunidade no Discord ou no WhatsApp. | To play, talk to the community on Discord. |
| minecraft.details | {{endereço, versão e requisitos}} `[PENDING P-09]` | {{address, version and requirements}} `[PENDING P-09]` |
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
| whatsapp.body | O grupo EmpireCommunity. Conversa e pedidos de jogos. | — |
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
| faq.abroad.a | Pode, pelo Discord. É nele que atendemos quem é de fora. O grupo de WhatsApp é de brasileiros. | Yes, on Discord. That is where we talk with people from other countries. |
| faq.contact.q | Como falo com a equipe? | How do I reach the team? |
| faq.contact.a | O caminho mais rápido é o Discord. Também atendemos por contact@empirecommunity.org. | Discord is the fastest way. You can also write to contact@empirecommunity.org. |

## Apoiar

| Id | pt-BR | en-US |
|---|---|---|
| meta.title | Apoiar: EmpireCommunity | Support us: EmpireCommunity |
| meta.description | A meta da EmpireCommunity é de R$ 3.000 para montar um servidor próprio. Veja como doar e o que já foi feito. | EmpireCommunity's goal is R$ 3,000 to build its own server. See how to donate and what has been done so far. |
| title | Apoiar | Support us |
| lead | A EmpireCommunity é gratuita e vive de doações voluntárias. Doar nunca é obrigatório. | EmpireCommunity is free and runs on voluntary donations. Donating is never required. |
| goal.title | Meta atual | Current goal |
| goal.value | R$ 3.000 | R$ 3,000 |
| goal.body | A meta é montar um servidor local, com Xeon e 128 GB de RAM, para hospedar mais servidores de jogos. Ele está em montagem e ainda não está em uso. | The goal is to build a local server, with a Xeon and 128 GB of RAM, to host more game servers. It is being built and is not in use yet. |
| goal.progress | {{arrecadado}} de R$ 3.000 `[PENDING P-03]` | {{raised}} of R$ 3,000 `[PENDING P-03]` |
| pix.title | Doar por Pix | Donate with Pix |
| pix.key.label | Chave Pix | Pix key |
| pix.key.value | `[PENDING P-01]` | `[PENDING P-01]` |
| pix.name.label | Favorecido | Recipient |
| pix.name.value | `[PENDING P-01]` | `[PENDING P-01]` |
| pix.copy | Copiar chave | Copy key |
| pix.copied | Chave copiada | Key copied |
| pix.warning | Confira o nome do favorecido antes de confirmar. | Check the recipient's name before you confirm. |
| pix.abroad | — | Pix is a Brazilian payment system and usually requires a Brazilian bank account. If you can't use it, the other options on this page are still open to you. |
| parts.title | Peças do servidor | Server parts |
| parts.col.part | Peça | Part |
| parts.col.value | Valor | Value |
| parts.col.status | Situação | Status |
| parts.status.bought | Comprada | Bought |
| parts.status.donated | Doada | Donated |
| parts.status.missing | Falta | Needed |
| parts.items | `[PENDING P-02]` | `[PENDING P-02]` |
| donate.parts.title | Doar peças | Donate parts |
| donate.parts.body | Também aceitamos peças doadas para o servidor. Antes de enviar, fale com a equipe pelo Discord ou por contact@empirecommunity.org. | We also accept donated parts for the server. Before sending anything, talk to the team on Discord or at contact@empirecommunity.org. |
| other.title | Outras formas de ajudar | Other ways to help |
| other.body | Parte do nosso código é pública. Colaborações são bem-vindas no GitHub. | Part of our code is public. Contributions are welcome on GitHub. |
| transparency.title | Transparência | Transparency |
| transparency.sold | Nada é vendido. | Nothing is for sale. |
| transparency.data | Dados de usuários não são vendidos nem divulgados. | User data is never sold or disclosed. |
| transparency.perks | Recursos só para doadores podem existir na instância hospedada, por causa do custo de VPS. Eles nunca são retirados das versões self-hosted. | Donor-only features may exist on the hosted instance, because of VPS costs. They are never removed from self-hosted versions. |

## Organização

| Id | pt-BR | en-US |
|---|---|---|
| meta.title | Organização: EmpireCommunity | Organization: EmpireCommunity |
| meta.description | Quem mantém a EmpireCommunity, como ela funciona e seus endereços oficiais. | Who runs EmpireCommunity, how it works, and its official addresses. |
| title | Organização | Organization |
| lead | A EmpireCommunity é uma comunidade de jogadores e aficionados por tecnologia, sediada no Brasil. | EmpireCommunity is a community of gamers and technology enthusiasts, based in Brazil. |
| since | Desde {{ano}} `[PENDING P-06]` | Since {{year}} `[PENDING P-06]` |
| purpose.title | Propósito | Purpose |
| purpose.body | `[PENDING P-07]` | `[PENDING P-07]` |
| how.title | Como funciona | How it works |
| how.free | Tudo é gratuito e vive de doações voluntárias. | Everything is free and runs on voluntary donations. |
| how.sold | Nada é vendido. | Nothing is for sale. |
| how.data | Dados de usuários não são vendidos nem divulgados. | User data is never sold or disclosed. |
| names.title | Nomes | Names |
| names.community | **EmpireCommunity** é a organização e a comunidade, e dá nome ao servidor no Discord e ao grupo no WhatsApp. | **EmpireCommunity** is the organization and the community, and the name of its Discord server. |
| names.hub | **EmpireHub** é o produto de jogos de mesa dentro do Discord. | **EmpireHub** is the tabletop games product inside Discord. |
| founder.title | Fundador | Founder |
| founder.name | Leonne Martins `[PENDING P-05: consentimento]` | Leonne Martins `[PENDING P-05: consent]` |
| founder.role | Fundador | Founder |
| founder.nickname | `[PENDING P-05]` | `[PENDING P-05]` |
| founder.bio | `[PENDING P-05]` | `[PENDING P-05]` |
| team.title | Equipe | Team |
| team.items | `[PENDING P-04]` | `[PENDING P-04]` |
| addresses.title | Endereços oficiais | Official addresses |
| addresses.col.address | Endereço | Address |
| addresses.col.purpose | Função | Purpose |
| addresses.col.status | Situação | Status |
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

Uma única versão, com os dois idiomas na mesma página (`routing-locale`).

| Id | Texto |
|---|---|
| chooser.meta.title | EmpireCommunity |
| chooser.title | EmpireCommunity |
| chooser.link.pt | Português (Brasil) |
| chooser.link.en | English |
| 404.meta.title | Página não encontrada · Page not found |
| 404.title.pt | Página não encontrada |
| 404.body.pt | Este endereço não existe ou mudou de lugar. |
| 404.link.pt | Ir para o início |
| 404.title.en | Page not found |
| 404.body.en | This address does not exist or has moved. |
| 404.link.en | Go to the home page |

---

# Textos legais

> **Rascunho para revisão do dono.** Linguagem simples, sem revisão de advogado. Os fatos vêm de `EMPIRECOMMUNITY.md`.
> Cláusulas propostas, sem fato de origem: Termos 3 (doação por engano), 6, 8 e 9; Privacidade 9 e 12 (prazos de remoção
> ficam de fora até o dono confirmá-los na revisão jurídica). Os dois idiomas têm o
> mesmo conteúdo e, por isso, não citam o WhatsApp.
>
> **Revisão jurídica necessária antes de receber doações:** Privacidade 2, 3 e 10. Não manter registros de acesso é
> exceção decidida pelo dono (D-20) e precisa ser conferida diante do Marco Civil da Internet.

## Termos de Uso (pt-BR)

Meta: título "Termos de Uso: EmpireCommunity"; descrição "As regras de uso do site da EmpireCommunity."

Vigência: `[PENDING P-12]`

**1. Sobre este site.** Este site apresenta a EmpireCommunity, comunidade de jogadores e aficionados por tecnologia
sediada no Brasil. Ao usar o site, você concorda com estes termos.

**2. Gratuidade.** O site e os serviços da comunidade são gratuitos. Nada é vendido.

**3. Doações.** Doações são voluntárias e não são condição para participar da comunidade. Recursos só para doadores
podem existir na instância hospedada, por causa do custo de VPS, e nunca são retirados das versões self-hosted. Se você
doou por engano, escreva para legal@empirecommunity.org; cada caso é avaliado individualmente. `[PENDING P-13]`

**4. Informações do site.** Procuramos manter status, metas e demais informações atualizados, mas eles podem mudar sem
aviso.

**5. Serviços, canais e links de terceiros.** O site aponta para serviços e canais de terceiros, como plataformas de
conversa e o GitHub, que têm regras próprias. Os serviços hospedados pela EmpireCommunity podem ter termos próprios.

**6. Disponibilidade.** Servidores de jogos e projetos são mantidos pela comunidade e podem mudar, ser interrompidos ou
encerrados.

**7. Marcas e conteúdo.** Marcas e assets da EmpireCommunity pertencem ao seu fundador, Leonne Martins. O código de cada
projeto segue a licença do respectivo repositório.

**8. Uso adequado.** Não use o site para atacar, sobrecarregar ou tentar burlar a segurança dele ou de terceiros, nem
para se passar pela EmpireCommunity.

**9. Responsabilidade.** O site é oferecido como está, na medida permitida pela lei.

**10. Lei aplicável e foro.** Valem as leis do Brasil, em especial a Lei Geral de Proteção de Dados (LGPD) e o Marco
Civil da Internet. Fica eleito o foro de Goiânia-GO.

**11. Alterações e contato.** Estes termos podem mudar, e a data de vigência será atualizada. Dúvidas:
legal@empirecommunity.org.

## Terms of Use (en-US)

Meta: title "Terms of Use: EmpireCommunity"; description "The rules for using the EmpireCommunity website."

Effective date: `[PENDING P-12]`

**1. About this website.** This website presents EmpireCommunity, a community of gamers and technology enthusiasts based
in Brazil. By using the website, you agree to these terms.

**2. Free of charge.** The website and the community's services are free. Nothing is for sale.

**3. Donations.** Donations are voluntary and are not a condition for taking part in the community. Donor-only features
may exist on the hosted instance, because of VPS costs, and are never removed from self-hosted versions. If you donated
by mistake, write to legal@empirecommunity.org; each case is assessed individually. `[PENDING P-13]`

**4. Website information.** We try to keep statuses, goals and other information up to date, but they may change without
notice.

**5. Third-party services, channels and links.** The website points to third-party services and channels, such as chat
platforms and GitHub, which have their own rules. Services hosted by EmpireCommunity may have their own terms.

**6. Availability.** Game servers and projects are maintained by the community and may change, be interrupted or be
discontinued.

**7. Trademarks and content.** EmpireCommunity's trademarks and assets belong to its founder, Leonne Martins. Each
project's code follows the license of its repository.

**8. Acceptable use.** Do not use the website to attack, overload or try to bypass the security of the website or of
third parties, or to impersonate EmpireCommunity.

**9. Liability.** The website is provided as is, to the extent permitted by law.

**10. Governing law and venue.** The laws of Brazil apply, in particular the General Data Protection Law (LGPD) and the
Brazilian Civil Rights Framework for the Internet (Marco Civil da Internet). The courts of Goiânia-GO, Brazil, have
jurisdiction.

**11. Changes and contact.** These terms may change, and the effective date will be updated. Questions:
legal@empirecommunity.org.

## Política de Privacidade (pt-BR)

Meta: título "Política de Privacidade: EmpireCommunity"; descrição "Quais dados o site da EmpireCommunity trata e por quê."

Vigência: `[PENDING P-12]`

**1. Quem é responsável.** A controladora dos dados é a equipe administrativa da EmpireCommunity. `[PENDING P-11]`
Esta política vale para o site empirecommunity.org. Os demais serviços da comunidade têm políticas próprias.

**2. O que este site não faz.** O site não tem formulários, contas ou cadastro, não define cookies próprios, não mantém
registros de acesso e não vende nem divulga dados de usuários.

**3. Registros técnicos.** O servidor do site não mantém registros de acesso. Ele guarda apenas registros mínimos de
erro, para diagnóstico. Esses registros podem conter o endereço de conexão de quem acessava o site quando o erro
ocorreu, são substituídos em rotação curta e se perdem quando o servidor do site é recriado. O serviço automático que
atualiza o número de membros armazena apenas esse número da comunidade e dados técnicos da própria atualização, sem
nenhum dado de visitantes.

**4. Estatísticas de uso.** Usamos o Cloudflare Web Analytics para saber quantas visitas cada página recebe. Essa
ferramenta não usa cookies nem armazenamento local no seu navegador e não identifica pessoas.

**5. Escolha de idioma.** Ao acessar o endereço principal, a Cloudflare identifica o país da conexão para enviar você à
versão em português ou em inglês. O site não guarda essa informação.

**6. Contato por e-mail.** Se você nos escrever, usaremos o que você enviar para responder.

**7. Doações.** O Pix é feito no aplicativo do seu banco, e o site não recebe dados dessa operação. Quem recebe a doação
vê as informações que o banco mostrar, como o nome de quem pagou.

**8. Com quem os dados são compartilhados.** Apenas com os fornecedores necessários para o site funcionar: a hospedagem
e a Cloudflare. A Cloudflare processa as requisições como intermediária, nos próprios termos, e mantém registros
próprios, fora do controle deste site. Links para outras plataformas seguem as políticas delas.

**9. Base legal.** Tratamos registros de erro e estatísticas com base em legítimo interesse, para manter o site
funcionando e seguro, e mensagens para atender ao seu pedido de contato.

**10. Por quanto tempo.** O servidor do site não guarda registros de acesso, e os registros de erro são substituídos em
rotação curta. Os demais dados ficam enquanto estiverem em uso e são apagados a pedido, exceto o que a lei obrigar a
guardar.

**11. Seus direitos.** Pela LGPD, você pode pedir confirmação do tratamento, acesso, correção, anonimização, portabilidade
ou eliminação dos seus dados. Basta escrever para legal@empirecommunity.org.

**12. Pessoas listadas no site.** Só aparecem na página Organização pessoas maiores de idade que deram consentimento
registrado, e somente com os dados que cada uma autorizou. Para retirar o consentimento ou pedir a remoção, escreva para
legal@empirecommunity.org; removemos esses dados do site e dos arquivos que publicamos. O código e os dados deste site
ficam em um repositório público no GitHub, que guarda o histórico de todas as alterações. Por isso, mesmo depois da
remoção, o que já foi publicado continua nesse histórico e em cópias do repositório feitas por outras pessoas. Cada
pessoa é avisada disso antes de ser listada.

**13. Alterações.** Esta política pode mudar, e a data de vigência será atualizada.

## Privacy Policy (en-US)

Meta: title "Privacy Policy: EmpireCommunity"; description "What data the EmpireCommunity website handles and why."

Effective date: `[PENDING P-12]`

**1. Who is responsible.** The data controller is the administrative team of EmpireCommunity. `[PENDING P-11]` This
policy applies to the empirecommunity.org website. The community's other services have their own policies.

**2. What this website does not do.** The website has no forms, accounts or registration, sets no cookies of its own,
keeps no access logs, and does not sell or disclose user data.

**3. Technical records.** The website's server keeps no access logs. It keeps only minimal error records, for diagnosis.
These records may contain the connection address of whoever was accessing the website when the error occurred, are
replaced on a short rotation, and are lost when the website's server is recreated. The automated service that updates
the member count stores only that community number and technical data about its own update, with no visitor data.

**4. Usage statistics.** We use Cloudflare Web Analytics to learn how many visits each page receives. This tool does not
use cookies or local storage in your browser and does not identify people.

**5. Language selection.** When you open the main address, Cloudflare identifies the country of your connection to send
you to the Portuguese or English version. The website does not keep this information.

**6. Contact by email.** If you write to us, we will use what you send in order to reply.

**7. Donations.** Pix payments are made in your bank's app, and the website receives no data about them. The recipient
sees whatever the bank displays, such as the payer's name.

**8. Who data is shared with.** Only the providers needed to run the website: the hosting provider and Cloudflare.
Cloudflare processes requests as an intermediary, on its own terms, and keeps its own records, outside this website's
control. Links to other platforms follow those platforms' policies.

**9. Legal basis.** We process error records and statistics on the basis of legitimate interest, to keep the website
running and secure, and messages to respond to your contact request.

**10. How long.** The website's server keeps no access logs, and error records are replaced on a short rotation. Other
data is kept while in use and is deleted on request, except what the law requires us to keep.

**11. Your rights.** Under the LGPD, you may request confirmation of processing, access, correction, anonymization,
portability or deletion of your data. Just write to legal@empirecommunity.org.

**12. People listed on the website.** Only adults who have given recorded consent appear on the Organization page, and
only with the data each person has authorized. To withdraw consent or request removal, write to
legal@empirecommunity.org; we remove that data from the website and from the files we publish. This website's code and
data are in a public repository on GitHub, which keeps the history of every change. Because of this, even after removal,
what was already published remains in that history and in copies of the repository made by other people. Each person is
told this before being listed.

**13. Changes.** This policy may change, and the effective date will be updated.
