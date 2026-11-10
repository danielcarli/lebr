# LEBR — Laboratório de Estruturas Brasil

**Software livre de cálculo estrutural segundo as normas brasileiras** — concreto armado (ABNT NBR 6118:2023),
madeira (NBR 7190-1:2022 e NBR 16936:2023), fundações, vento e estabilidade global. Desktop para Windows, macOS e
Linux, com interface no modelo do VS Code e projetos gravados em **JSON aberto**.

![Licença AGPL-3.0](https://img.shields.io/badge/licen%C3%A7a-AGPL--3.0-blue)
![Estado: fase inicial](https://img.shields.io/badge/estado-fase%20inicial%20de%20desenvolvimento-orange)
![Colaboradores procurados](https://img.shields.io/badge/procuramos-colaboradores-brightgreen)

<p align="center">
  <a href="https://github.com/danielcarli/lebr/releases/latest/download/LEBR-Instalador.exe"><img alt="Baixar para Windows" src="https://img.shields.io/badge/Windows-LEBR--Instalador.exe-B85438?style=for-the-badge&logo=windows&logoColor=white"></a>
  <a href="https://github.com/danielcarli/lebr/releases/latest/download/LEBR-mac-arm64.dmg"><img alt="Baixar para Mac com chip Apple" src="https://img.shields.io/badge/macOS-Apple%20Silicon%20%28.dmg%29-B85438?style=for-the-badge&logo=apple&logoColor=white"></a>
  <a href="https://github.com/danielcarli/lebr/releases/latest/download/LEBR-mac-x64.dmg"><img alt="Baixar para Mac Intel" src="https://img.shields.io/badge/macOS-Intel%20%28.dmg%29-B85438?style=for-the-badge&logo=apple&logoColor=white"></a>
  <a href="https://github.com/danielcarli/lebr/releases/latest/download/LEBR-linux-x86_64.AppImage"><img alt="Baixar para Linux (AppImage)" src="https://img.shields.io/badge/Linux-AppImage-B85438?style=for-the-badge&logo=linux&logoColor=white"></a>
  <a href="https://github.com/danielcarli/lebr/releases/latest/download/LEBR-linux-amd64.deb"><img alt="Baixar para Debian e Ubuntu (.deb)" src="https://img.shields.io/badge/Debian%20%2F%20Ubuntu-.deb-B85438?style=for-the-badge&logo=debian&logoColor=white"></a>
</p>

> [!TIP]
> **Baixar o LEBR** (última versão publicada):
> - **Windows 10 e 11:** [LEBR-Instalador.exe](https://github.com/danielcarli/lebr/releases/latest/download/LEBR-Instalador.exe) (cerca de 2 MB) — monta o LEBR no seu
>   computador a partir da última versão do GitHub e serve também para atualizar.
> - **macOS:** [LEBR-mac-arm64.dmg](https://github.com/danielcarli/lebr/releases/latest/download/LEBR-mac-arm64.dmg) para Macs com chip Apple (M1 a M4) ou
>   [LEBR-mac-x64.dmg](https://github.com/danielcarli/lebr/releases/latest/download/LEBR-mac-x64.dmg) para Macs Intel — arraste o LEBR para Aplicativos; como ainda não tem a
>   assinatura da Apple, libere na primeira vez em **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim**.
> - **Linux (x64):** [LEBR-linux-x86_64.AppImage](https://github.com/danielcarli/lebr/releases/latest/download/LEBR-linux-x86_64.AppImage) para qualquer distribuição
>   (`chmod +x` e abrir) ou [LEBR-linux-amd64.deb](https://github.com/danielcarli/lebr/releases/latest/download/LEBR-linux-amd64.deb) para Debian, Ubuntu e Mint
>   (`sudo apt install ./LEBR-linux-amd64.deb`).
>
> Detalhes e requisitos em [INSTALACAO.md](INSTALACAO.md). Outras versões na [página de releases](https://github.com/danielcarli/lebr/releases).

> [!WARNING]
> **O LEBR está em fase inicial de desenvolvimento e não deve ser usado para calcular estruturas reais.**
> Cada função ainda precisa ser conferida de forma independente. Os resultados servem para estudo e para o próprio
> desenvolvimento do programa — nunca substituem o projeto e a responsabilidade de um profissional habilitado.

> [!IMPORTANT]
> **Procuramos colaboradores** para criar **estudos de caso** e fazer a **validação independente de cada função**,
> com **cálculos feitos à mão ou em planilhas** comparados com os resultados do programa. Engenheiros, professores,
> pesquisadores e estudantes são bem-vindos — veja [Como colaborar](#como-colaborar).

![Tela inicial do LEBR](imagens/tela-inicial.png)

*Capturas da versão 0.35.0, com o exemplo de edifício de 3 pavimentos que acompanha o programa.*

---

## O que o LEBR faz hoje

| Área | O que já existe |
|---|---|
| **Vigas** | vigas contínuas com balanços, envoltória das combinações, flexão, cortante, torção, fissuração e flechas, viga invertida e baldrame, **detalhamento com lista de ferros editável** |
| **Lajes** | maciças por elementos finitos (bordas apoiadas, engastadas ou livres, punção), treliçadas, nervuradas e alveolares; **planta de armação** das maciças |
| **Pilares** | flexo-compressão oblíqua, 2ª ordem local, momentos mínimos; **detalhamento com arranques, traspasse e grampos** |
| **Edifício** | montagem por pavimentos, grelha do pavimento, pórtico espacial, vento (NBR 6123), desaprumo, α e γz |
| **Fundações** | sondagem SPT, sapatas isoladas, estacas (Aoki-Velloso e Décourt-Quaresma) e blocos sobre estacas |
| **Elementos especiais** | escadas retas, em L e em U; reservatórios elevados e enterrados |
| **Otimização** | por elemento: **menos bitolas diferentes** (obra mais simples), **menos aço** ou **menos segmentos de barra** (menos peças a cortar e montar), com todas as verificações atendidas |
| **Interface** | barra de cálculo fixa com o estado, índice das seções, sugestão da menor seção que atende, cálculo num *Web Worker*, legenda e filtro de pendências no explorador, ajuste a telas pequenas |
| **Montagem** | planta de arquitetura em **DXF como fundo**, eixos e malha de encaixe |
| **Saída** | memorial de cálculo, PDF por elemento, **memorial do edifício** e **cargas na fundação** em PDF, quantitativos e CSV, **pranchas em DXF**, **armadura em 3D** de cada elemento |
| **Madeira** | vigas, pilares e entrepisos pela NBR 7190-1:2022 |
| **Validação** | 315 casos conferidos a cada versão, **158 deles tirados de exercícios resolvidos publicados** (apostilas, livros, TCCs), com o relatório **LEBR × fontes** |
| **Instalação** | instalador do Windows que monta o programa a partir da última versão do GitHub e avisa quando há versão nova |
| **Temas** | claro, escuro e **blueprint** (desenhos, 3D e montagem em cópia heliográfica; página do elemento em branco) |

O caminho até um projeto real está no [roteiro](ROTEIRO.md).

## Capturas de tela

### A tela de um elemento

Cada elemento abre numa aba própria: no topo, o tipo de estrutura, o **código** e o **nome** (editável com um
clique); depois do filete, a norma, o resumo e o estado do cálculo — **Atende** em verde. À esquerda, o explorador
agrupa os elementos por pavimento, com **duas bolinhas** em cada um: a do **cálculo** (atende, não atende,
desatualizado) e a da **montagem** (vazia se ainda não foi posicionado, verde se os apoios conferem com a planta,
vermelha se há um erro de ligação). O losango marca problema, o círculo cheio, em ordem, e o anel, o que falta
fazer; o botão ⓘ mostra a legenda e o funil deixa só os elementos com pendências. A barra de cálculo acompanha a
rolagem com o estado sempre à vista e, em telas largas, um índice das seções fica ao lado da página.

A **barra inferior** resume a situação do projeto pela cor: **verde musgo** quando todos os elementos estão calculados e
atendem às verificações, **terracota** quando algum não atende, tem erro de cálculo ou erro de montagem, e **cinza
chumbo** enquanto há elementos ainda não calculados ou desatualizados (ou nenhum projeto aberto). Passar o mouse
sobre a barra mostra o motivo.

![As três cores da barra de status](imagens/barra-de-status.png)

![Cabeçalho e dados de uma viga](imagens/elemento-cabecalho.png)

### Vigas: esforços e detalhamento

Envoltória de momentos, cortantes, torção e flechas, com o memorial completo. Cada diagrama tem a legenda das linhas:
no momento fletor e na cortante de cálculo, a **linha contínua** é o máximo de cada seção entre as combinações e a
**tracejada**, o mínimo.

![Diagramas de uma viga contínua](imagens/viga-diagramas.png)

Elevação com a armação: barras cortadas pelo diagrama deslocado, ganchos, estribos e a lista de ferros, que pode ser
editada (bitola, quantidade, comprimento).

![Detalhamento de uma viga](imagens/viga-detalhamento.png)

Quando o elemento não atende, a página sugere a menor alteração que faz todas as verificações passarem, com o botão
**Aplicar**.

![Sugestão de seção para uma viga que não atende](imagens/sugestao-secao.png)

### Armadura em 3D

Na seção de detalhamento da viga, do pilar e da laje, **Armadura em 3D** mostra as barras daquele elemento, isoladas,
dentro do concreto transparente — gira, aproxima e destaca a posição da lista de ferros sob o mouse. As barras seguem
os espaçamentos livres da NBR 6118 (18.3.2.2 nas vigas, 18.4.2.2 nos pilares) e os estribos contornam as barras de
canto e fecham com ganchos de 135°, alternando o canto; a linha abaixo da vista resume barras por camada e espaçamentos.

| Viga | Pilar | Laje |
|---|---|---|
| ![Armadura da viga em 3D](imagens/armadura-3d-viga.png) | ![Armadura do pilar em 3D](imagens/armadura-3d-pilar.png) | ![Armadura da laje em 3D](imagens/armadura-3d-laje.png) |

### Pilares e lajes

Lance do pilar com os arranques na fundação, o traspasse com o lance de cima, estribos e grampos suplementares.

![Detalhamento de um pilar](imagens/pilar-detalhamento.png)

Pilar de seção circular: **Forma da seção → Circular** e o diâmetro D. No mínimo 6 barras no contorno, λ = 4·le/D,
flexão oblíqua com a curva de interação da seção circular e estribos circulares.

| Seção e detalhamento | Armadura em 3D |
|---|---|
| ![Pilar circular — detalhamento](imagens/pilar-circular.png) | ![Pilar circular em 3D](imagens/armadura-3d-pilar-circular.png) |

Planta de armação da laje maciça: positivas, negativas nas bordas engastadas e distribuição.

![Armação de uma laje maciça](imagens/laje-armacao.png)

### Montagem da estrutura

Pavimentos, planta com lajes, vigas e pilares encaixados, e as ligações entre os elementos — que levam as cargas de
um para o outro. **Conectar automaticamente** cria as ligações pela geometria, e a segunda bolinha do explorador
avisa quando alguma não confere.

![Montagem por pavimentos](imagens/montagem.png)

A planta de arquitetura em DXF pode ficar no fundo de cada pavimento, com os **eixos** do projeto e uma **malha de
encaixe**: os pilares e as vigas encostam nos cantos das paredes, nos eixos e nos cruzamentos.

![Planta de arquitetura no fundo da montagem](imagens/montagem-planta-dxf.png)

### Visualização 3D e abas lado a lado

Duas abas podem ficar lado a lado (`Ctrl+\`, ou arrastando a aba), e a visualização 3D pode ficar **fixa à
direita** enquanto os elementos abrem à esquerda. O painel de controles do 3D se recolhe para a cena ocupar a área
toda.

![Elemento e visualização 3D lado a lado](imagens/abas-lado-a-lado-3d.png)

![Visualização 3D no tema escuro](imagens/visualizacao-3d-escuro.png)

### Otimização das bitolas

Na seção Armadura de cada elemento, a **otimização** escolhe as bitolas por um de três critérios: **menos bitolas
diferentes** (obra mais simples), **menos aço** ou **menos segmentos de barra** (menos peças cortadas das barras de
12 m, com um teto de aço a mais). O programa calcula as combinações, descarta as que não atendem e
compara o resultado com a escolha automática. **Calcular › Otimizar todos os elementos** aplica o critério ao projeto.

![Otimização das bitolas de uma viga](imagens/otimizacao-bitolas.png)

![Menos segmentos de barra num pilar](imagens/otimizacao-segmentos.png)

### Quantitativos

Concreto, fôrma e aço por bitola, por pavimento e do projeto, com o resumo do aço e as perdas — exportável em CSV.

![Quantitativos de materiais](imagens/quantitativos.png)

### Memorial do edifício e cargas na fundação

O memorial reúne os dados do projeto, a situação, as cargas na fundação, os quantitativos e, por pavimento, cada
elemento com as verificações e o memorial de cálculo, num PDF só. A tabela de cargas na fundação sai também à parte,
com a planta de locação.

![Memorial do edifício](imagens/memorial-edificio.png)

### Pranchas em DXF

Fôrmas por pavimento, locação dos pilares com as cargas na fundação e armação de vigas, pilares e lajes, com camadas
separadas — abrem no LibreCAD, QCAD e AutoCAD.

![Exportação das pranchas](imagens/exportar-dxf.png)

| Planta de fôrmas (DXF) | Armação de vigas (DXF) |
|---|---|
| ![Planta de fôrmas](imagens/dxf-formas.png) | ![Armação de vigas](imagens/dxf-armacao-vigas.png) |

### Banco de validação

Cada caso compara o resultado do LEBR com um valor de referência calculado fora do programa — normas, tabelas
clássicas, cálculo manual — com a fonte e a tolerância.

![Relatório de validação](imagens/validacao.png)

### Exercícios resolvidos: LEBR × fontes

**Ajuda › Exercícios resolvidos** reúne os 158 problemas tirados de apostilas, livros, TCCs e dissertações
publicados online (Bastos/UNESP, Pinheiro/EESC-USP, UFPR, PUC Goiás, Alonso e outros). Cada problema traz o
enunciado, a fonte com o link, o valor publicado no material, o valor do LEBR, a diferença e as hipóteses que mudam
de um para o outro. No fim estão as divergências que a comparação revelou — como o limite k ≤ 2 do τRd1 na punção,
que precisa de revisão — e os exercícios que ficaram de fora. A página sai também em PDF. Detalhes em
[VALIDACAO-BIBLIOGRAFIA.md](VALIDACAO-BIBLIOGRAFIA.md).

![Exercícios resolvidos: LEBR × fontes](imagens/exercicios-resolvidos.png)

### Tema blueprint

Além do claro e do escuro, o tema **blueprint** traz a cópia heliográfica para os desenhos: o explorador, as abas e
os menus ficam em azul bem escuro; a página do elemento fica branca, com o texto do tema claro e os destaques em azul;
os desenhos, as vistas 3D e a planta da montagem ficam em papel azul, com traço branco, quadriculado e o amarelo do
lápis. A lista de pavimentos da montagem continua branca. Troque em **Exibir › Tema blueprint** ou clicando no nome
do tema na barra inferior.

| Elemento | Montagem |
|---|---|
| ![Tema blueprint: elemento](imagens/tema-blueprint.png) | ![Tema blueprint: montagem](imagens/tema-blueprint-montagem.png) |

### Roteiro

**Ajuda › Roteiro** mostra o que já foi feito, o que está parcial e o que falta, por área e por fase, e o plano
para o lançamento da estrutura na planta.

![Roteiro](imagens/roteiro.png)

---

## Como colaborar

O que mais ajuda o projeto agora é **conferência independente**. Não é preciso programar.

### 1. Estudos de caso

Monte um elemento ou um edifício pequeno no LEBR (há quatro exemplos na tela inicial), **calcule por fora** — à mão
ou numa planilha — e compare. Bons candidatos:

- viga contínua com balanço; laje maciça com borda livre; pilar com 2ª ordem e flexão oblíqua;
- sapata, bloco sobre estacas e capacidade de estacas a partir de um boletim de sondagem;
- escada em U, reservatório elevado, forças de vento e γz de um edifício pequeno;
- quantitativos e a lista de ferros de uma viga detalhada.

Publique o estudo (o arquivo `.lebr.json`, a planilha ou o memorial manual e a comparação) numa *issue* do
repositório. Diferenças são tão valiosas quanto acertos.

### 2. Validação independente de cada função

Escolha uma função do motor de cálculo (`src/engine/`) — ancoragem, flexão, punção, decalagem, capacidade de estaca… —,
refaça a conta com a norma e registre o caso no **banco de validação** (`validacao/casos/*.json`):

```json
{
  "id": "det-al",
  "titulo": "Decalagem do diagrama de momentos (modelo I): d = 45 cm, VSd = 200 kN, Vc = 50 kN",
  "fonte": "NBR 6118, 17.4.2.2: aℓ = d·VSd/[2·(VSd − Vc)] = 45·200/(2·150) = 30 cm, entre 0,5·d e d → 30 cm.",
  "alvo": "motor",
  "funcao": "detalhamento.decalagem",
  "args": [{ "d": 45, "Vd": 200, "Vc": 50 }],
  "esperado": [{ "grandeza": "aℓ", "caminho": "", "valor": 30.0, "unidade": "cm", "tolerancia": 0.0001 }]
}
```

O valor esperado **não pode vir do próprio LEBR**: ele sai da norma, de um livro, de uma tabela ou do seu cálculo, e a
`fonte` diz de onde. `npm run validar` roda todos os casos e grava o relatório; no programa, **Ajuda › Relatório de
validação** mostra o mesmo resultado. Formato completo em [VALIDACAO.md](VALIDACAO.md).

### 3. Revisão normativa

Os documentos da pasta `docs/` e os avisos do programa marcam os pontos **a conferir** no texto das normas (valores
reunidos de trabalhos acadêmicos, critérios de referência). Uma revisão com a norma em mãos é muito bem-vinda.

### 4. Código

Novos módulos (lajes, aço, madeira, fundações) entram pelo contrato descrito em [MODULOS.md](MODULOS.md). Antes de um
*pull request*, rode `npm test` e `npm run validar`.

O guia resumido está em [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Como rodar

Requisitos: [Node.js](https://nodejs.org) 20 ou superior.

```bash
npm install      # instala o Electron
npm start        # abre o programa
npm test         # testes do motor de cálculo e dos módulos
npm run validar  # banco de casos de validação (grava validacao/relatorio.html)
```

## Licença

O LEBR é **software livre**, distribuído sob a **GNU Affero General Public License, versão 3** ([LICENSE](../LICENSE)):
você pode usá-lo, estudá-lo, modificá-lo e redistribuí-lo, desde que as versões distribuídas mantenham a mesma licença e
o código-fonte aberto — inclusive as versões modificadas oferecidas para uso pela rede. É distribuído **sem nenhuma garantia**.

## Autoria

Idealizado e desenvolvido por **Daniel Michelon De Carli**, com uso do Claude (modelo Opus 5.5), e aberto a
colaboradores.
