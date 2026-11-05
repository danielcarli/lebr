# Criando módulos para o LEBR

Cada tipo de elemento estrutural (viga de concreto, laje maciça, pilar…) é um **módulo**.
O núcleo do programa não sabe calcular nada: ele só guarda o projeto, desenha a
interface e chama os módulos. Por isso novos tipos — laje treliçada, nervurada,
alveolar, madeira, aço — entram sem alterar o núcleo nem o formato do arquivo.

## Onde ficam os módulos

| Tipo | Local | Quando usar |
|---|---|---|
| Interno | `src/modules/<nome>/` e registrado em `src/modules/index.js` | Módulos mantidos no repositório |
| Externo | Pasta de módulos do usuário (menu **Módulos → Abrir pasta de módulos externos**) | Módulos de terceiros, testes, protótipos |

A pasta externa fica em `<dados do usuário>/LEBR/modulos/`. Cada subpasta
com um `index.js` é carregada ao iniciar o programa. Veja o esqueleto em
`exemplos/modulos/esqueleto-modulo/`.

## Contrato

O `index.js` exporta por padrão uma **fábrica**: uma função que recebe a `api`
e devolve a definição do módulo.

```js
export default function meuModulo(api) {
  return {
    // identificação ------------------------------------------------------
    id: 'concreto.laje.nervurada',   // único; gravado em cada elemento do JSON
    nome: 'Laje nervurada',
    nomeCurto: 'Laje nervurada',     // opcional, usado nas etiquetas
    categoria: 'lajes',              // 'vigas' | 'lajes' | 'pilares' | nova categoria
    prefixo: 'LN',                   // códigos LN1, LN2…
    sigla: 'CL3',                    // opcional: 3 letras/algarismos (aparece no cabeçalho, junto da norma) — material + tipo + nº
    icone: 'laje',                   // nome de ícone de api.ui.icone (explorador e abas)
    forma: 'laje',                   // opcional: ícone do cabeçalho do elemento (viga, laje, pilar); padrão = icone
    material: 'Concreto armado',
    norma: 'NBR 6118:2023',
    versao: '0.1.0',
    descricao: 'Texto curto para a lista de módulos.',
    novaCategoria: { id: 'madeira', nome: 'Madeira' }, // opcional

    // dados ----------------------------------------------------------------
    criar(projeto) { return { /* dados iniciais do elemento */ }; },
    resumo(el) { return 'linha de resumo'; },             // opcional

    // cálculo (deve ser puro, sem DOM) -----------------------------------------
    calcular(el, ctx) {
      return {
        ok: true,                    // todas as verificações atendem?
        avisos: [],                  // textos exibidos acima dos resultados
        verificacoes: [{ nome, item, valor, limite, ok }],
        memorial: [{ titulo, linhas: [] }],
        // …qualquer outro dado que renderResultado precise
      };
    },

    // ligações com outros elementos (opcional) -----------------------------------
    ligacoes(el) { return [{ id: 'x0', nome: 'Borda esquerda', tipo: 'linear' }]; },
    cargasTransmitidas(el, ctx) { return { x0: { g: 5.2, q: 2.1 } }; },

    // quantitativos (opcional): concreto (m³), fôrma (m²) e aço por bitola (kg) para a tela Quantitativos
    quantitativos(el, resultado, projeto) { return { concreto: 0.6, forma: 6.2, aco: { 10: 12.3, 5: 4.1 }, notas: [] }; },

    // interface ------------------------------------------------------------------
    renderEntrada(raiz, ctx) { /* monta o formulário em `raiz` */ },
    renderResultado(raiz, resultado, ctx) { /* instrumentos, desenhos, tabelas */ },
  };
}
```

### Contexto de cálculo (`ctx` em `calcular` e `cargasTransmitidas`)

| Campo | Descrição |
|---|---|
| `ctx.projeto`, `ctx.parametros` | Projeto completo e parâmetros globais |
| `ctx.materiais` | `{ concreto, aco, gg, ggFav, gq, psi0, psi1, psi2, casos, combinacoes, gama, caa, dmax }` já com coeficientes; `combinacoes` é a lista ELU/ELS para os casos G e Q |
| `ctx.elemento(id)` | Busca outro elemento |
| `ctx.cargasDe(id, ligacao)` | Cargas características `{ g, q }` que outro elemento transmite. Detecta dependência circular. |

### Contexto do editor (`ctx` em `renderEntrada` / `renderResultado`)

| Campo | Descrição |
|---|---|
| `ctx.elemento` | Elemento atual (sempre a versão mais recente) |
| `ctx.alterar(fn, { estrutural })` | Única forma de modificar dados. Entra no desfazer/refazer e marca o resultado como desatualizado. Use `estrutural: true` quando a mudança exige redesenhar o formulário (ex.: nova carga). |
| `ctx.materiais` | Igual ao do cálculo |
| `ctx.contextoCalculo()` | Contexto de cálculo, útil para prévias |
| `ctx.fontesDeCarga(tipo)` | Elementos com ligações `'linear'` ou `'pontual'` |
| `ctx.abrirElemento(id)`, `ctx.calcular()` | Navegação e cálculo |

### API (`api`)

| Grupo | Conteúdo |
|---|---|
| `api.dom` | `h(tag, props, ...filhos)`, `s()` para SVG, `limpar()` |
| `api.ui` | `secao`, `ficha`, `campo`, `selecao`, `segmentado`, `alternar`, `botao`, `tabela`, `numeroGrande`, `medidor`, `arco`, `faixa`, `mostrador`, `gradePontos`, `selo`, `vazio`, `icone` |
| `api.menus` | `abrirMenu`, `menuContexto` |
| `api.formatar` | `num(v, casas)` no padrão brasileiro, `lerNumero` |
| `api.motor` | `materiais`, `flexao`, `cisalhamento`, `barras`, `vigaSolver`, `placa`, `flexocompressao`, `secaoT`, `madeira`, `cargas` (catálogo da NBR 6120: `cargaUso`, `cargaParede`, `cargaRevestimento`…), `combinacoes` (`gerarCombinacoes`, `envolvente`, `extremo`) |

## Boas práticas

- Mantenha o cálculo em um arquivo separado e sem dependências de interface, como
  `calculo.js` nos módulos internos. Assim ele pode ser testado com `npm test`.
- Unidades: dimensões de seção em cm, vãos em m, cargas em kN, kN/m e kN/m²,
  momentos em kN·m, tensões em MPa.
- Cite o item da norma em cada verificação (`item: '17.4.2.2'`).
- Nunca remova campos de elementos antigos: o JSON do usuário deve continuar abrindo.

## Siglas dos módulos

O cabeçalho de cada elemento mostra o `nome` do módulo no topo (por exemplo, VIGA DE CONCRETO ARMADO), o **código
do elemento** em destaque e o nome dele logo abaixo; depois do filete vêm a norma, o módulo e a sua **sigla** (entre
parênteses), o resumo e o estado do cálculo. A sigla tem três caracteres alfanuméricos com o material, o tipo e um
número de ordem. Um módulo externo pode
declarar a sua (`sigla`); se não declarar, o LEBR gera uma a partir da primeira letra do
`material` e do `prefixo`, com o primeiro número livre. Siglas repetidas são recusadas.

| Sigla | Módulo |
|---|---|
| CV1 | Viga de concreto armado |
| CL1 | Laje maciça |
| CL2 | Laje treliçada |
| CL3 | Laje nervurada |
| CL4 | Laje alveolar |
| CP1 | Pilar de concreto armado |
| MV1 | Viga de madeira |
| MP1 | Pilar / montante de madeira |
| ML1 | Entrepiso de madeira |
| GS1 | Sondagem SPT (geotecnia) |
| CS1 | Sapata isolada |
| GE1 | Estaca isolada (geotecnia) |
| CB1 | Bloco sobre estacas (concreto) |
| CE1 | Escada de concreto armado |
| CR1 | Reservatório retangular |

Para os próximos materiais, a mesma regra: aço `A` (AV1, AP1…); geotecnia `G` (GS1 sondagem, e as fundações a seguir).

Um módulo que não deve ser posicionado nos pavimentos da montagem (como a sondagem) declara `montagem: false`: ele não aparece no menu **Adicionar** da montagem.


## Cálculo fora da interface (0.32)

Os módulos internos são calculados num *Web Worker* (`src/renderer/core/calculo-worker.js`), com as funções de
`src/validacao/calculos.js`, para a janela não travar. Basta um elemento de **módulo externo** no projeto para todos os
cálculos voltarem a rodar na interface, com o `calcular` do próprio módulo — o contrato não muda. Um módulo interno
novo precisa estar registrado também em `MODULOS_CALCULO` (o mesmo registro do banco de validação).
