# Brief do logo: EmpireCommunity

Tarefa T-1, para uso na T-3. Autoria: Bússola. Destino: Aquarela. O dono escolhe a versão final (D-4).
Estado: **aguardando revisão do dono**.

## Propósito

A EmpireCommunity não tem logo. Ele vai identificar a organização no site institucional (`empirecommunity.org`), como
avatar no Discord e no GitHub e como assinatura em materiais da organização.

A marca representa a organização, não um produto. EmpireMuse e EmpireHub mantêm identidade própria.

## O que precisa comunicar

Organização séria, com projetos, domínios, arrecadação pública e infraestrutura. Comunidade construída em conjunto. O
lado divertido fica no Discord e no WhatsApp; o logo não precisa representá-lo.

## Entregas

| Peça | Especificação |
|---|---|
| Símbolo | Sozinho, em área quadrada |
| Logotipo | `EmpireCommunity`, uma palavra, com E e C maiúsculos |
| Assinatura horizontal | Símbolo + logotipo |
| Variantes de cor | Uma cor clara para fundo escuro, uma cor escura para fundo claro |
| Prancha de decisão | Três direções, lado a lado, em preto e branco, com testes de tamanho |

Depois da escolha do dono:

| Arquivo | Tamanho |
|---|---|
| SVG mestre (símbolo, logotipo, assinatura) | Vetor, texto convertido em curvas |
| `favicon.svg` | Vetor, otimizado para 16 px |
| `favicon.ico` | 16, 32 e 48 px |
| `apple-touch-icon.png` | 180 × 180 px |
| Ícones do manifesto | 192 × 192 e 512 × 512 px |
| Avatar Discord e GitHub | 1024 × 1024 px, PNG, seguro para recorte circular |

Os nomes `favicon.ico`, `favicon.svg` e `apple-touch-icon.png` seguem `routing-locale`.

## Testes obrigatórios

- Legível a 16 px no favicon e a 32 px de altura no header.
- Funciona em uma única cor, sem degradê, sombra ou transparência parcial.
- Sobrevive ao recorte circular do avatar, sem perder partes do símbolo.
- Contraste de pelo menos 3:1 contra o fundo em que for aplicado (WCAG 2.2, componente gráfico).
- Reconhecível sem a palavra ao lado.
- Margem de respiro definida, e tamanho mínimo declarado para símbolo e assinatura.

## Paleta

O desenho é aprovado em preto e branco. A cor final sai da T-2. Tema escuro é o contexto principal (D-1).

## Tipografia

Logotipo desenhado à mão ou derivado de fonte de licença aberta (SIL OFL), com a licença registrada. Sem as fontes da
Co2, que são proprietárias.

## Territórios sugeridos

Pontos de partida. A Aquarela pode trocar um deles se chegar a algo mais forte, mantendo três direções na prancha.

| Território | Ideia |
|---|---|
| Rack | Três barras horizontais que são ao mesmo tempo a letra E e unidades de um rack de servidor |
| Encaixe | Módulos que se encaixam para formar E, ou E e C, sugerindo algo construído por muitas pessoas |
| Demarcação | Um E recortado de um bloco, ou um território quadrado, lendo "império" como terreno comum |

## Fazer

- Geometria simples e construída, que resista a tamanhos muito pequenos.
- Forma própria, que não dependa de tendência.
- Arquivos vetoriais limpos, sem máscaras desnecessárias.

## Não fazer

- Coroas, louros, águias, escudos, espadas e outras referências literais a "império". A coroa também já aparece no
  EmpireMuse.
- Símbolos ligados a militarismo, supremacia ou movimentos de ódio, nem variações estilizadas: raios de sol nascente,
  fasces, cruzes de ferro, águias imperiais, formas parecidas com suástica.
- Controles de videogame, pixel art, mascotes, personagens de anime (identidade do EmpireMuse).
- Neon, brilho, degradê, cromado, efeito 3D.
- Anéis entrelaçados como os do logo da Co2, ou qualquer semelhança com logos de Discord, GitHub ou WhatsApp.
- Banco de imagens, kits da EmpireAssets com restrição de redistribuição, ou imagem gerada entregue como arquivo final.
  O final é vetor construído.

## Referências

- Direção do site: [`information-architecture.md`](information-architecture.md), §1 (registro público).
- Co2 (`EmpireAssets/docs/Co2-DESIGN.md`): só pela postura sóbria. Não copiar.
- Logo do EmpireMuse (`EmpireMuse/EmpireMuse/assets/brand/logo-256.png`): exemplo do que precisa ficar diferente.

## Rascunhos e fluxo

Rascunhos em `/var/tmp/agentes/EmpireCommunitySite/logo/`. A Bússola revisa a prancha contra este brief antes de o dono
escolher. O destino dos arquivos finais é definido na T-3.
