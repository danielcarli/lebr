# Lançamento da estrutura: boas práticas dos programas consolidados

Pesquisa de 07/11/2026 em manuais, documentação e materiais de ensino de **TQS**, **AltoQi Eberick** e **CYPECAD**
(com ETABS e Robot onde ajudou), para orientar como o LEBR recebe o edifício. O resultado entrou no
[roteiro](ROTEIRO.md) como a área **Lançamento da estrutura** e o **plano de ação L1 a L15**.

## A filosofia comum

Os três programas seguem o mesmo fluxo: **critérios e pavimentos primeiro → a arquitetura como fundo de cada
pavimento → pilares, vigas e lajes em planta → processamento global → análise → dimensionamento → detalhamento**.
O engenheiro escolhe a seção e a carga do próximo elemento antes de inserir, o programa reconhece contornos e
cruzamentos pela geometria, e **nada é calculado enquanto houver algo indefinido**.

## Boas práticas

1. **Critérios antes de lançar.** A classe de agressividade define o fck mínimo e os cobrimentos (TQS, "Critérios ›
   Materiais"; CYPECAD, "General data"), com exceção por elemento.
2. **Pavimentos numa tabela, com repetição.** O TQS trata o andar tipo como um objeto que se repete; o CYPECAD agrupa
   pisos iguais (3 a 5) com um projeto só; o ETABS usa "Master Story" e "Similar To".
3. **Cópia entre pavimentos**, total ou seletiva (TQS "Copiar planta"; Eberick "Copiar pilares/vigas para outros
   pavimentos"; CYPECAD "Copy from another group", que substitui tudo e pede confirmação).
4. **Ordem da concepção:** do tipo para cima e para baixo; pilares nos cantos, nas áreas comuns e nas paredes,
   alinhados em pórticos (4 a 6 m); vigas sob as alvenarias; lajes do arranjo das vigas; evitar viga sobre viga e
   pilar nascendo em viga.
5. **Arquitetura como referência externa por pavimento**, com camadas por tipo de elemento (TQS, Eberick, CYPECAD).
6. **Encaixes, eixos e coordenadas digitadas** — globais e relativas (CYPECAD), ponto de referência do elemento
   (TQS, tecla F), eixos de locação e ortogonal (Eberick).
7. **Pilar com ponto fixo e lance** (centro, borda ou canto; pavimento inicial e final; pilar sobre pilar; arranque).
   No TQS o pilar é um elemento só da fundação ao topo.
8. **Viga em cadeia:** clique de nó em nó, o programa liga os pilares intermediários; alternância eixo/face e
   deslocamento (Eberick, CYPECAD, TQS); "Quick Draw" por linha de grade no ETABS.
9. **Cruzamento de vigas explícito:** cada cruzamento diz quem apoia em quem; no TQS, por padrão nenhuma transfere,
   "Definir todos os apoios" resolve e **o processamento não roda com cruzamento indefinido**. No ETABS, nó a menos de
   1 mm de uma barra é considerado apoiado nela.
10. **Laje por clique dentro do contorno fechado**, com direção principal obrigatória e fechamento de bordo (TQS); no
    CYPECAD cada perímetro fechado vira um pano "aguardando definição", que bloqueia o cálculo.
11. **"Dados atuais"** — seção, carga e próximo número definidos antes de inserir; conta-gotas e pincel de
    propriedades (TQS "Ler/Atribuir dados atuais"; CYPECAD "Copy from"; Eberick "Copiar dados").
12. **Vínculos editáveis com padrão razoável** (laje–viga de 0,01 a 1 por lado no TQS; "Rotular todas" no Eberick;
    coeficiente de engaste dos pilares no CYPECAD).
13. **Cargas por catálogo, por pavimento e por parede**: uso do pavimento aplicado às lajes (CYPECAD); cargas
    nomeadas por laje e por parede (TQS); altura da parede = pé-direito − viga ou − laje.
14. **Lançamento a partir do DXF/IFC**: o assistente do CYPECAD gera pilares, vigas de contorno e cargas pelas
    camadas; IfcWall vira carga linear. O Eberick cria a edificação a partir de IFC.
15. **Pré-dimensionamento por regras práticas**: viga L/10 a L/12; laje h ≥ Lx/40 e os mínimos da norma; pilar pela
    área de influência (Nk = q·Ai·n, γ = 1,8/2,2/2,5). Nenhum dos três programas confirmou fazer isso sozinho durante
    o lançamento.
16. **Consistência antes de calcular**: lista de erros e avisos por elemento e pavimento (TQS, CYPECAD, Eberick;
    "Check Model" no ETABS).
17. **3D sempre à mão** durante o lançamento.
18. **Renumeração** da esquerda para a direita e de cima para baixo (P, V, L).
19. **Modelo físico separado do analítico**, e versões gravadas antes de processar (TQS, controle de versões).
20. **Fluxo fechado**: corrigir, reprocessar e repetir até tudo atender.

## TQS × Eberick × CYPECAD

| Ponto | TQS | Eberick | CYPECAD |
|---|---|---|---|
| Pavimentos | andar tipo único com repetição | cópia entre pavimentos | grupos de pisos (até 5), envoltória |
| Arquitetura | referência DWG/IFC por pavimento | referência no croqui; edificação a partir de IFC | gabaritos DXF/DWG; assistente automático DXF e IFC |
| Pilar | elemento único; nasce/morre | copiar; otimizar prumadas | ponto fixo; grupo inicial e final |
| Viga | eixo ou face; captura de poligonal | nó a nó, liga os pilares intermediários | contínua; linha de ajuste e deslocamento |
| Cruzamento viga–viga | explícito; indefinido bloqueia | não confirmado | não confirmado |
| Laje | clique no contorno; direção obrigatória | contorno de vigas e pilares | pano "aguardando definição" bloqueia |
| Cargas de parede | carga linear por material × altura | carga no trecho da viga | manual ou a partir de IfcWall |
| Consistência | cruzamentos + lista de erros | erros com código | panos indefinidos + erros em vermelho |
| Renumeração | Renumerar | Renumerar 1 2 3 | Renumber |

## O que o LEBR já tem e o que falta

**Já tem:** planta DXF por pavimento com camadas, opacidade e ajuste; encaixe nos pontos da planta, nos eixos e na
malha; "Conectar automaticamente" com aviso de ligação; 3D fixo ao lado; parâmetros pela CAA; duplicar pavimento;
catálogo de cargas da NBR 6120; sugestão da menor seção depois do cálculo.

**Feito:** L1 tolerância e fusão de nós (0.36.0) — tolerância em Parâmetros › Montagem, apoio encostado na face do
pilar a menos dela, Estrutura › Limpar geometria e aviso de folga com o botão Encostar. L2 painel de problemas que
bloqueia o cálculo (0.37.0) — regras independentes em `src/renderer/core/consistencia.js`, lista por pavimento no
painel Problemas com zoom no ponto da planta; um erro desabilita Calcular e Calcular todos. Os arquivos de teste
(`test/fixtures/consistencia`, gerados por `tools/consistencia/gerar-casos.mjs`) têm um defeito cada e geram
exatamente um problema; os exemplos geram zero.

L3 apoio explícito nos cruzamentos (0.38.0) — `src/renderer/core/cruzamentos.js`; a escolha fica em
`pavimento.cruzamentos`, a grelha põe rótula na viga apoiada e "sem transferência" não cria nó comum.

L4 viga em cadeia (0.39.0) — `vigasEmCadeia` em `src/renderer/core/lancamento.js`, modo V na montagem.

L5 laje por clique no contorno (0.40.0) — `regioesDoPavimento` e `criarLajeNaRegiao` em `src/renderer/core/lancamento.js`; os fechamentos de bordo ficam em `pavimento.fechamentos`.

L6 dados do próximo elemento e conta-gotas e L7 critérios por elemento (0.41.0) — `dadosAtuais`, `copiarPropriedades` e `aplicarPropriedades` em `src/renderer/core/lancamento.js`; `src/renderer/core/criterios.js` e `elemento.criterios`. Correções de um clique: `correcaoDe` e `resolverAutomaticamente` em `src/renderer/core/consistencia.js`.

L8 pré-dimensionamento no lançamento (0.42.0) — `src/renderer/core/predimensionamento.js`.

L13 carga padrão por pavimento (0.45.0) — `pavimento.cargaPadrao` e `aplicarCargaPadrao` em `src/renderer/core/lancamento.js`.

L11 renumeração (0.46.0) — `src/renderer/core/renumerar.js`.

L10 pilar com ponto fixo e lance (0.47.0) — `src/renderer/core/pilares.js`; a transição (pilar sobre viga) é uma ligação `concentrada` criada por `detectarLigacoes`.

L9 pavimento tipo e cópia seletiva (0.48.0) — `src/renderer/core/tipos.js` (`pavimento.repeticoes`, `expandirTipos`).

L12 paredes do DXF como cargas (0.49.0) — `src/renderer/core/paredes.js` (`paredesDeSegmentos`, `planoDeParedes`, `aplicarParedes`); cargas marcadas com `origem: 'paredes'`.

L15 importar IFC, mínimo (0.50.0) — `src/engine/ifc.js` (leitor STEP e geometria) e `src/renderer/core/importar-ifc.js` (`planoIfc`, `aplicarIfc`); teste com um IFC no estilo do Revit em `test/fixtures/ifc/`.

**Laje nervurada em 3D (0.56.0):** `modules/comum/nervurada-geometria.js` monta a geometria (m = ⌊(L − bw)/e⌋ vazios
por direção, nervura nas duas pontas, a sobra como faixa maciça de borda; travamentos a L/2 acima de 4 m e nos terços
acima de 6 m nas lajes em uma direção). A vista 3D do edifício junta as caixas numa malha por laje; o detalhamento
(`detalhamentoNervurada`) e o modelo 3D da armadura (`modeloNervurada`) usam a mesma geometria.

**Falta** (plano em etapas no [roteiro](ROTEIRO.md#plano-de-ação-lançamento-da-estrutura)): L14 versões do projeto.

## O que não foi confirmado

- TQS: o nome do comando de verificação de consistência antes do processamento, pré-dimensionamento de pilares e
  leitura de paredes da arquitetura como carga.
- Eberick: pavimento tipo nativo (a apostila da UFSC indica cópia), tratamento do cruzamento viga–viga e carga
  automática de paredes. O site de suporte da AltoQi não pôde ser aberto.
- CYPECAD: detalhes do "Renumber" e de uma verificação de geometria do grupo.
- NBR 6118, Tabelas 7.1 e 7.2: citadas de conhecimento prévio; o exemplo do TQS (CAA II: laje 2,5 cm, viga e pilar
  3,0 cm) é coerente com elas.

## Fontes

- TQS: [vigas no Modelador](https://docs.tqs.com.br/Docs/PrintAllReport/3778) ·
  [lajes no Modelador](https://docs.tqs.com.br/Docs/PrintAllReport/3779) ·
  [controle de versões](https://docs.tqs.com.br/Docs/PrintAllReport/3293) ·
  [projeto estrutural no ambiente BIM (ABECE)](https://dl.tqs.com.br/files/Projeto_Estrutural_no_Ambiente_BIM_TQSABECE.pdf) ·
  [Jornal TQS 32](https://dl.tqs.com.br/tqs-news/JornalTQS32.pdf)
- CYPECAD: [entrada da estrutura](https://info.cype.com/en/product/cypecad-entering-the-structure/) ·
  [entrada automática DXF/DWG e IFC](https://info.cype.com/en/subject/cypecad-automatic-entry-of-projects-dxf-dwg-and-cad-bim-models/) ·
  [introdução](https://info.cype.com/en/product/cypecad-introduction/) ·
  [pilares e grupos](https://info.cype.com/en/product/cypecad-column-input/) ·
  [copiar de outro grupo](https://info.cype.com/en/subject/cypecad-copy-from-another-group/) ·
  [manual](https://downloads2.cype.com/documents_en/manuals/ccadmu09.pdf)
- ETABS: [Story Data](https://docs.csiamerica.com/help-files/etabs/Menus/File/New_Model/Story_Data_Form.htm) ·
  [tolerâncias](https://docs.csiamerica.com/help-files/etabs/Menus/Options/Tolerances.htm) ·
  [tutorial](https://docs.csiamerica.com/manuals/etabs/Introductory%20Tutorial.pdf)
- AltoQi: [e-book de concepção estrutural](https://lps.altoqi.com.br/hubfs/%5BMKT%5D%20Materiais%20Ricos/Ebooks/%5BEbook%5D%20Concep%C3%A7%C3%A3o%20estrutural.pdf)
- Ensino: [curso de Eberick (UFSC/GEBIM)](https://gebim.paginas.ufsc.br/files/2021/03/Curso-Eberick-e-QiBuilder-B%C3%A1sico.pdf) ·
  [manual TQS (UFPA)](https://bdm.ufpa.br/bitstreams/1094ae26-8458-4e3f-b1f4-950adb884f49/download) ·
  [TCC TQS (Unipar)](https://unipar.br/documentos/277/Projeto_estrutural_de_uma_edificacao_de_pequeno_porte_no_software_TQS.pdf) ·
  [mover elementos no TQS (UFPel)](https://wp.ufpel.edu.br/grupodeestudosanalisedeestruturas/files/2022/03/Como-movimentar-elementos-no-tqs-1.pdf) ·
  [concepção e pré-dimensionamento (UNESP)](https://wwwp.feb.unesp.br/pbastos/concreto1/Rel.%20Final%20Marcos.pdf) ·
  [TCC Eberick (UNESP)](https://repositorio.unesp.br/bitstreams/c3f6efbb-81ae-46bc-ad17-a39b755f9099/download) ·
  [TCC Eberick (UFPE)](https://repositorio.ufpe.br/bitstream/123456789/44706/1/TCC%20-%20GUSTAVO%20HENRIQUE%20NORAT%20PINTOR.pdf)
