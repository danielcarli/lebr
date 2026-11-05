# Como colaborar com o LEBR

O LEBR está em **fase inicial de desenvolvimento** e **não deve ser usado para calcular estruturas reais**. Para
chegar lá, cada função precisa de **validação independente**: cálculos feitos **à mão** ou em **planilhas**, por
outras pessoas, comparados com os resultados do programa. É aí que a sua ajuda faz mais diferença — e não é preciso
programar.

## Formas de ajudar

1. **Estudos de caso** — monte um elemento ou um edifício pequeno, calcule por fora e compare com o LEBR. Abra uma
   *issue* com o arquivo `.lebr.json`, a planilha ou o memorial manual e a tabela de comparação.
2. **Casos de validação** — refaça uma função do motor (`src/engine/`) com a norma e registre o caso em
   `validacao/casos/*.json` (formato em [docs/VALIDACAO.md](docs/VALIDACAO.md)). O valor esperado nunca vem do
   próprio LEBR, e o campo `fonte` diz de onde ele saiu.
3. **Diferenças** — quando o seu cálculo e o LEBR não baterem, abra uma *issue* com os dados, a referência da norma
   (item, tabela, edição) e o valor que você encontrou.
4. **Revisão normativa** — os pontos marcados *a conferir* em `docs/` e nos avisos do programa.
5. **Código** — novos módulos pelo contrato de [docs/MODULOS.md](docs/MODULOS.md); antes de um *pull request*, rode
   `npm test` e `npm run validar`.

## Boas práticas para um caso de validação

- Uma grandeza por linha, com unidade e tolerância justificada (arredondamento de tabela, método numérico).
- Cite a edição da norma ou do livro e o item.
- Quando o caso não bater, não alargue a tolerância: anote a conclusão na `fonte` e abra uma *issue*.

## Cabeçalho dos arquivos

Todo arquivo JavaScript do LEBR começa com o cabeçalho de autoria e licença (GPL-3.0, `SPDX-License-Identifier:
GPL-3.0-only`). Ao criar um arquivo novo, copie o cabeçalho de um arquivo existente; se a contribuição for sua,
acrescente o seu nome numa linha de copyright.

## Licença das contribuições

O LEBR é distribuído sob a **GNU General Public License, versão 3** ([LICENSE](LICENSE)). Ao enviar uma contribuição,
você concorda em licenciá-la nos mesmos termos.

Apresentação do projeto, com capturas de tela: [docs/APRESENTACAO.md](docs/APRESENTACAO.md).
