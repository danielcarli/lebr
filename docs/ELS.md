# Serviço das vigas — fissuras e flechas

Implementado em `src/engine/fissuracao.js` e usado pelo módulo de viga de concreto (versão 0.11).

## Abertura de fissuras (NBR 6118:2023, 17.3.3.2)

Para cada vão (armadura positiva) e cada apoio com armadura negativa:

1. **Momento**: o maior da combinação frequente (G + ψ1·Q) no trecho.
2. **Formação de fissuras**: Mr = 1,5·fctk,inf·Ic/yt (17.3.1). Se Ms < Mr, a seção não fissura e a verificação atende.
3. **Tensão na armadura**: σs no estádio II puro, com αe = 15.
4. **Abertura**, para cada barra da camada mais tracionada:

   w1 = φ/(12,5·η1) · σs/Es · 3σs/fct,m      w2 = φ/(12,5·η1) · σs/Es · (4/ρr + 45)      wk = menor dos dois

   com η1 = 2,25 (CA-50), 1,4 (CA-60) ou 1,0 (CA-25) e ρr = As,barra/Acr.
5. **Limite** (Tabela 13.4, concreto armado): 0,4 mm na CAA I; 0,3 mm nas CAA II e III; 0,2 mm na CAA IV.

**Região de envolvimento Acr** (critério do LEBR): retângulo cujos lados ficam a no máximo 7,5·φ do eixo da barra,
limitado pelas faces da peça, pela metade da distância às barras vizinhas e pela linha neutra. As barras ficam
igualmente espaçadas na largura útil (b − 2·(c + φt)). Com duas ou mais camadas, só a camada mais tracionada
entra, com σs calculado na altura útil do conjunto.

## Flechas (17.3.2)

- **Imediata**: combinação quase permanente, rigidez equivalente de Branson por vão (17.3.2.1.1), Mr com fct,m.
- **Diferida**: αf·f0, com αf = Δξ/(1 + 50ρ') e Δξ = ξ(70 meses) − ξ(t0) pela Tabela 17.1. A idade no
  carregamento t0 fica em **Parâmetros do projeto › Durabilidade e serviço** (padrão 1 mês, αf = 1,32).
  O mesmo t0 vale para as lajes maciça, treliçada e nervurada.
- **Limites** (Tabela 13.3): total ≤ l/250 (aceitabilidade visual) e flecha só da carga acidental ≤ l/350
  (vibrações sentidas no piso). Em balanços, l = 2 × comprimento do balanço.

## Validação

`validacao/casos/08-els-vigas.json` confere o estádio II, w1, w2 e wk de uma seção calculada à mão,
αf para duas idades e os limites das Tabelas 13.3 e 13.4 dentro do módulo.
