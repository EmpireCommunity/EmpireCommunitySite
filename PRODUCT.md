# Product

<!-- impeccable:product-schema 1 -->

Base: arquitetura e copy aprovadas pelo dono (`docs/design/information-architecture.md`, `docs/content/copy.md`). Sem
entrevista separada do impeccable; o que ainda não foi decidido está marcado como aberto.

## Platform

web

## Stack

Astro estático, TypeScript e Tailwind 4, sem React (ADR-0001).

## Users

- **Quem pensa em entrar (a maioria):** brasileiros que jogam ou gostam de tecnologia. Querem entender o que é a
  comunidade e entrar no Discord ou no WhatsApp.
- **Estrangeiros vindos do GitHub:** buscam colaboração ou suporte, em inglês, pelo Discord.
- **Quem avalia a organização:** quer verificar se ela é confiável e como se mantém. Doadores entram nesse grupo quando
  as doações abrirem (D-28).

## Product Purpose

Ser a porta de entrada oficial da EmpireCommunity: dizer o que ela é, o que mantém, como entrar e como é financiada.
Sucesso é o visitante entender isso em segundos e entrar por um canal oficial.

## Positioning

Tudo é gratuito, nada é vendido, e o site mostra a situação real de cada coisa, inclusive o que ainda não funciona.

## Operating Context

Hipótese, sem dado de acesso que a confirme: a maioria chega por links compartilhados no Discord, no WhatsApp e no
GitHub, muitas vezes pelo celular. O site é estático e funciona sem JavaScript no essencial.

## Capabilities and Constraints

- Páginas em `/pt-br/` e `/en-us/`, com os mesmos slugs. A raiz escolhe o idioma pelo país, e o seletor fica sempre visível.
- WhatsApp só em pt-BR, com peso igual ao do Discord. Em en-US, só Discord.
- Discord sempre por `https://empirecommunity.org/discord`.
- Link só no que funciona. Status em vocabulário fechado: No ar, Em desenvolvimento, Em breve.
- Número de membros: só o último valor, sem data.
- Seção sem dado real não é renderizada.
- Pessoa só aparece com consentimento registrado.
- Infraestrutura só em nível geral: sem localização, especificação detalhada, portas, topologia, backup ou monitoramento.
- Sem cookies próprios e sem registros de acesso na origem.

**Doações fora do lançamento (D-28):** o site abre sem receber dinheiro e sem indicar forma de enviar. Doações e o painel
de transparência abrem juntos depois, com contrato, modelo de ameaças e revisão jurídica.

**Direção para depois (D-21):** a chave Pix fixa foi descartada. As doações passarão pelo gateway Mercado Pago, com saldo,
total arrecadado, entradas, saídas e justificativas públicos. A arquitetura depende de pesquisa e de decisões do dono.

## Brand Commitments

- O nome é **EmpireCommunity**, sem espaço. **EmpireHub** é o produto de jogos de mesa, não a comunidade.
- O site tem identidade própria, separada de EmpireMuse e EmpireHub. O logo ainda não existe (`docs/design/logo-brief.md`).
- Voz simples, direta e sem exagero. Sem "maior comunidade", sem depoimentos.
- O lado divertido fica no Discord e no WhatsApp.
- Não usar símbolos ligados a militarismo, supremacia ou movimentos de ódio, nem referências literais a "império".
- A comunidade não tem Facebook nem outras redes sociais.

## Evidence on Hand

Situação dos projetos e servidores (arquitetura, §5), repositórios públicos no GitHub e número de membros do Discord. A
transparência financeira só existe depois da abertura das doações (D-28). Faltam dados do dono, listados na arquitetura,
§9. Nada disso pode ser inventado.

## Product Principles

1. Mostrar a situação real vale mais do que parecer maior.
2. Faltou dado, some a seção.
3. Nenhum canal é favorecido em relação ao outro.
4. O dinheiro é público e verificável.
5. Pedir o mínimo de quem visita: sem conta, sem cookies, sem formulário.

## Accessibility & Inclusion

WCAG 2.2 AA. Status e valores nunca só por cor. Alvos de toque de pelo menos 44 × 44 px, foco visível, `lang` correto em
cada página, link para pular ao conteúdo, tabelas com cabeçalho semântico.
