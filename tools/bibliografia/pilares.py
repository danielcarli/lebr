# Gera validacao/casos/27-bibliografia-pilares.json — exercícios resolvidos de pilares publicados online.
import json
BASTOS = dict(fonte='BASTOS, P. S. S. Pilares de concreto armado (notas de aula, Estruturas de Concreto II). UNESP – Faculdade de Engenharia de Bauru, maio de 2017. NBR 6118:2014.',
              url='https://professor.pucgoias.edu.br/sitedocente/admin/arquivosUpload/14026/material/Pilares.pdf')
SCAD = dict(fonte='SCADELAI, M. A. Dimensionamento de pilares de acordo com a NBR 6118:2003 (dissertação de mestrado, orient. L. M. Pinheiro). EESC-USP, 2004.',
            url='https://teses.usp.br/teses/disponiveis/18/18134/tde-31032016-165300/publico/Dissert_Scadelai_MuriloA.pdf')
UNICH = dict(fonte='SILVA, J. C. Dimensionamento de pilares retangulares em flexo-compressão oblíqua pela NBR 6118:2014 e verificação pelo programa P-Calc (TCC). Centro Universitário Christus (Unichristus), 2023.',
             url='https://repositorio.unichristus.edu.br/jspui/bitstream/123456789/1596/1/Jozivaldo%20de%20Carvalho%20Silva.pdf')
UFU = dict(fonte='COSTANTIN, G. M. Análise comparativa do dimensionamento e comportamento de uma estrutura em concreto armado com e sem o auxílio de um programa computacional (TCC). Universidade Federal de Uberlândia, 2021.',
           url='https://repositorio.ufu.br/bitstream/123456789/32302/4/An%c3%a1liseComparativaDimensionamento.pdf')
NOTA_MT = 'O LEBR calcula λ = 3,46·le/h, M1d,mín = Nd(0,015 + 0,03h), αb e λ1 (15.8.2) e o pilar-padrão com curvatura aproximada (15.8.3.3.2), como a fonte.'

def item(g, c, v, u='', tol=0.005, **k):
    e = {'grandeza': g, 'caminho': c, 'valor': v, 'unidade': u, 'tolerancia': tol}; e.update(k); return e

casos = []
def mt(id, titulo, ref, local, descricao, fck, Nd, h, b, le, esperado, MA=0, MB=0, nota=NOTA_MT):
    a = {'Nd': Nd, 'h': h, 'b': b, 'le': le, 'c': {'$concreto': fck}}
    if MA: a['MA'] = MA; a['MB'] = MB
    casos.append({'id': id, 'titulo': titulo, 'fonte': f"{ref['fonte']} {local}.", 'referencia': ref['fonte'], 'local': local, 'url': ref['url'], 'descricao': descricao, 'nota': nota,
                  'alvo': 'motor', 'funcao': 'pilar.momentoTotal', 'args': [a], 'esperado': esperado})

def af(id, titulo, ref, local, descricao, fck, Nd, Md, b, h, dl, As, abaco):
    casos.append({'id': id, 'titulo': titulo, 'fonte': f"{ref['fonte']} {local}.", 'referencia': ref['fonte'], 'local': local, 'url': ref['url'], 'descricao': descricao,
                  'nota': f"A fonte lê ω no {abaco} (armadura simétrica em duas faces, diagrama parábola-retângulo); o LEBR integra a seção com o diagrama retangular simplificado e duas camadas de As/2 a d' das faces. A leitura gráfica do ábaco e a diferença de diagrama explicam diferenças de alguns por cento — tolerância de 10%.",
                  'alvo': 'motor', 'funcao': 'pilar.armaduraDuasFaces', 'args': [{'Nd': Nd, 'Md': Md, 'b': b, 'h': h, 'dl': dl, 'c': {'$concreto': fck}, 's': {'$aco': 500}}],
                  'esperado': [item('As (armadura total)', 'As', As, 'cm²', 0.10)]})

# --- Bastos 2017 -----------------------------------------------------------------------------------------------
mt('bastos-pil-int-ex1-y', 'Pilar intermediário 20×50, Nd = 1100 kN, le = 280 cm — direção de h = 20 cm', BASTOS, 'Item 15.2.1, Exemplo 1, p. 33',
   'Pilar intermediário biapoiado 20×50 cm, C20, CA-50, Nk = 785,7 kN (γf = 1,4, γn = 1,0), le = 280 cm, sem momentos de 1ª ordem. Calcular λ, λ1, o momento mínimo e o momento total com a 2ª ordem pela curvatura aproximada na direção de menor rigidez.',
   20, 1100, 20, 50, 280, [item('λ', 'lambda', 48.4, '', 0.003), item('λ1', 'lambda1', 35), item('M1d,mín', 'M1min', 23.10, 'kN·m'),
   item('ν', 'nu', 0.77, '', 0.006), item('M2d (Nd·e2, e2 = 1,54 cm)', 'M2', 16.94, 'kN·m', 0.01), item('Md,tot', 'Md', 40.08, 'kN·m')])
mt('bastos-pil-int-ex1-x', 'Pilar intermediário 20×50, Nd = 1100 kN — direção de h = 50 cm (sem 2ª ordem)', BASTOS, 'Item 15.2.1, Exemplo 1, p. 33',
   'Mesmo pilar, direção de maior rigidez: λ = 19,4 < λ1 = 35, 2ª ordem desprezada; Md,tot = M1d,mín.',
   20, 1100, 50, 20, 280, [item('λ', 'lambda', 19.4, '', 0.005), item('M1d,mín', 'M1min', 33.0, 'kN·m'), item('Md,tot', 'Md', 33.0, 'kN·m')])
af('bastos-pil-int-ex1-as', 'Pilar intermediário 20×50, Nd = 1100 kN, Md = 40,08 kN·m — armadura (ábaco A-4)', BASTOS, 'Item 15.2.1, Exemplo 1, p. 33',
   'Mesmo pilar: com ν = 0,77, μ = 0,14 e d\'/h = 0,20, a fonte obtém ω = 0,38 no ábaco A-4 de Venturini e As = 12,49 cm².', 20, 1100, 40.08, 50, 20, 4, 12.49, 'ábaco A-4 de Venturini (1987)')
mt('bastos-pil-int-ex2-y', 'Pilar intermediário 20×50, Nd = 1500 kN, le = 280 cm — direção de h = 20 cm', BASTOS, 'Item 15.2.2, Exemplo 2, p. 37',
   'Mesmo pilar do Exemplo 1 com Nk = 1071 kN (Nd = 1500 kN).',
   20, 1500, 20, 50, 280, [item('λ', 'lambda', 48.4, '', 0.003), item('M1d,mín', 'M1min', 31.5, 'kN·m'), item('ν', 'nu', 1.05, '', 0.005),
   item('M2d (e2 = 1,26 cm)', 'M2', 18.90, 'kN·m', 0.01), item('Md,tot', 'Md', 50.47, 'kN·m')])
af('bastos-pil-int-ex2-as', 'Pilar intermediário 20×50, Nd = 1500 kN, Md = 50,47 kN·m — armadura (ábaco A-4)', BASTOS, 'Item 15.2.2, Exemplo 2, p. 37',
   'μ = 0,18, d\'/h = 0,20: ω = 0,78 no ábaco A-4, As = 25,63 cm².', 20, 1500, 50.47, 50, 20, 4, 25.63, 'ábaco A-4 de Venturini (1987)')
mt('bastos-pil-ext-ex1', 'Pilar de extremidade 20×70, Nd = 1554 kN, M1d,A = −M1d,B = 21,7 kN·m', BASTOS, 'Item 16.2.1, Exemplo 1, p. 41',
   'Pilar de extremidade 20×70 cm, C20, Nd = 1554 kN, le = 280 cm, momentos de 1ª ordem de 21,7 kN·m nas extremidades (sinais opostos) na direção de h = 20 cm. Como M1d,A < M1d,mín, vale αb = 1,0.',
   20, 1554, 20, 70, 280, [item('λ', 'lambda', 48.4, '', 0.003), item('λ1', 'lambda1', 35), item('αb', 'alfaB', 1.0), item('M1d,mín', 'M1min', 32.634, 'kN·m'),
   item('M2d (e2 = 1,53 cm)', 'M2', 23.78, 'kN·m', 0.01), item('Md,tot', 'Md', 56.428, 'kN·m', 0.003)], MA=21.7, MB=-21.7)
af('bastos-pil-ext-ex1-as', 'Pilar de extremidade 20×70, Nd = 1554 kN, Md = 56,43 kN·m — armadura (ábaco A-4)', BASTOS, 'Item 16.2.1, Exemplo 1, p. 41',
   'μ = 0,14, d\'/h = 0,20: ω = 0,40, As = 18,40 cm².', 20, 1554, 56.428, 70, 20, 4, 18.40, 'ábaco A-4 de Venturini (1987)')
mt('bastos-pil-ext-ex2', 'Pilar de extremidade esbelto 20×70, Nd = 1554 kN, le = 460 cm (λ = 79,6)', BASTOS, 'Item 16.2.2, Exemplo 2, p. 46',
   'Pilar 20×70 cm, C20, Nd = 1554 kN, le = 460 cm; o momento de 1ª ordem atua na direção de h = 70 cm e a 2ª ordem na de h = 20 cm.',
   20, 1554, 20, 70, 460, [item('λ', 'lambda', 79.6, '', 0.003), item('M1d,mín', 'M1min', 32.634, 'kN·m'), item('M2d (e2 = 4,13 cm)', 'M2', 64.18, 'kN·m', 0.01),
   item('Md,tot', 'Md', 96.854, 'kN·m', 0.003)])
af('bastos-pil-ext-ex2-as', 'Pilar de extremidade 20×70, Nd = 1554 kN, Md = 96,85 kN·m — armadura (ábaco A-4)', BASTOS, 'Item 16.2.2, Exemplo 2, p. 46',
   'μ = 0,24, d\'/h = 0,20: ω = 0,79, As = 36,34 cm².', 20, 1554, 96.854, 70, 20, 4, 36.34, 'ábaco A-4 de Venturini (1987)')
mt('bastos-pil-ext-ex3-x', 'Pilar de extremidade 20×40, Nd = 700 kN — direção de h = 20 cm (2ª ordem)', BASTOS, 'Item 16.2.3, Exemplo 3, p. 51',
   'Pilar 20×40 cm, C20, Nd = 700 kN, le = 280 cm; na direção de h = 20 cm só há o momento mínimo, com 2ª ordem (λ = 48,4).',
   20, 700, 20, 40, 280, [item('λ', 'lambda', 48.4, '', 0.003), item('M1d,mín', 'M1min', 14.70, 'kN·m'), item('ν', 'nu', 0.61, '', 0.01), item('Md,tot', 'Md', 27.059, 'kN·m', 0.006)])
mt('bastos-pil-ext-ex3-y', 'Pilar de extremidade 20×40 com M1d,A = M1d,B = 70 kN·m (αb = 1,0)', BASTOS, 'Item 16.2.3, Exemplo 3, p. 51',
   'Mesmo pilar, direção de h = 40 cm, momentos de 1ª ordem iguais nas extremidades (curvatura simples): αb = 1,0, λ = 24,2 < λ1 = 35.',
   20, 700, 40, 20, 280, [item('λ', 'lambda', 24.2, '', 0.005), item('αb', 'alfaB', 1.0), item('λ1', 'lambda1', 35), item('M1d,mín', 'M1min', 18.90, 'kN·m'), item('Md,tot', 'Md', 70.0, 'kN·m')], MA=70, MB=70)
mt('bastos-pil-ext-ex4-y', 'Pilar de extremidade 20×40 com M1d,A = −M1d,B = 70 kN·m (αb = 0,4)', BASTOS, 'Item 16.2.4, Exemplo 4, p. 54',
   'Igual ao Exemplo 3, mas com momentos de sinais opostos (curvatura dupla): αb = 0,4 e λ1 = 70,3.',
   20, 700, 40, 20, 280, [item('αb', 'alfaB', 0.4), item('λ1', 'lambda1', 70.3, '', 0.003), item('Md,tot', 'Md', 70.0, 'kN·m')], MA=70, MB=-70)
mt('bastos-pil-canto-ex1-x', 'Pilar de canto 20×50, Nd = 1148 kN, le = 280 cm — direção de h = 20 cm', BASTOS, 'Item 17.2.1, Exemplo 1, p. 59',
   'Pilar de canto 20×50 cm, C20, Nd = 1148 kN, momentos de 1ª ordem de 20,41 kN·m (direção de h = 20 cm, sinais opostos), menores que o mínimo: αb = 1,0.',
   20, 1148, 20, 50, 280, [item('λ', 'lambda', 48.4, '', 0.003), item('M1d,mín', 'M1min', 24.108, 'kN·m'), item('αb', 'alfaB', 1.0),
   item('M2d (e2 = 1,51 cm)', 'M2', 17.33, 'kN·m', 0.01), item('Md,tot', 'Md', 41.416, 'kN·m', 0.003)], MA=20.41, MB=-20.41)
mt('bastos-pil-canto-ex1-y', 'Pilar de canto 20×50, Nd = 1148 kN — direção de h = 50 cm', BASTOS, 'Item 17.2.1, Exemplo 1, p. 59',
   'Mesmo pilar, direção de h = 50 cm: momentos de 17,26 kN·m menores que o mínimo (34,44 kN·m) e λ = 19,4 < 35.',
   20, 1148, 50, 20, 280, [item('λ', 'lambda', 19.4, '', 0.005), item('M1d,mín', 'M1min', 34.44, 'kN·m'), item('Md,tot', 'Md', 34.44, 'kN·m')], MA=17.26, MB=-17.26)
mt('bastos-pil-canto-ex2-x', 'Pilar de canto esbelto 20×50, Nd = 1148 kN, le = 460 cm (λ = 79,6)', BASTOS, 'Item 17.2.2, Exemplo 2, p. 62',
   'Pilar de canto 20×50 cm, C20, Nd = 1148 kN, le = 460 cm, momentos de 1ª ordem de 14,23 kN·m (menores que o mínimo) na direção de h = 20 cm.',
   20, 1148, 20, 50, 460, [item('λ', 'lambda', 79.6, '', 0.003), item('M2d (e2 = 4,07 cm)', 'M2', 46.72, 'kN·m', 0.01), item('Md,tot', 'Md', 70.821, 'kN·m', 0.003)], MA=14.23, MB=-14.23)
mt('bastos-pil-canto-ex3-x', 'Pilar de canto 20×30 com momentos opostos — direção de h = 30 cm (λ1 = 68,0)', BASTOS, 'Item 17.2.3, Exemplo 3, p. 66',
   'Pilar de canto 20×30 cm, C20, Nd = 504 kN, le = 280 cm, M1d,A = −M1d,B = 26,83 kN·m na direção de h = 30 cm: αb = 0,4, λ = 32,3 < λ1, sem 2ª ordem.',
   20, 504, 30, 20, 280, [item('λ', 'lambda', 32.3, '', 0.004), item('αb', 'alfaB', 0.4), item('λ1', 'lambda1', 68.0, '', 0.003), item('M1d,mín', 'M1min', 12.096, 'kN·m'), item('Md,tot', 'Md', 26.83, 'kN·m')], MA=26.83, MB=-26.83)
mt('bastos-pil-canto-ex3-y', 'Pilar de canto 20×30 com momentos opostos — direção de h = 20 cm (λ1 = 65,9)', BASTOS, 'Item 17.2.3, Exemplo 3, p. 66',
   'Mesmo pilar, direção de h = 20 cm: M1d,A = −M1d,B = 11,05 kN·m > M1d,mín = 10,58 kN·m, αb = 0,4, λ = 48,4 < λ1 = 65,9.',
   20, 504, 20, 30, 280, [item('λ', 'lambda', 48.4, '', 0.003), item('αb', 'alfaB', 0.4), item('λ1', 'lambda1', 65.9, '', 0.003), item('M1d,mín', 'M1min', 10.584, 'kN·m'), item('Md,tot', 'Md', 11.05, 'kN·m')], MA=11.05, MB=-11.05)
mt('bastos-pil-p8-15x50', 'Edifício — pilar intermediário P8 15×50 (γn = 1,20, Nd = 1176 kN)', BASTOS, 'Item 21.1, Pilar P8, p. 78',
   'Pilar intermediário de edifício de baixa altura, 15×50 cm, C30, Nk = 700 kN, γn = 1,20 (b = 15 cm), Nd = 1176 kN, le = 280 cm.',
   30, 1176, 15, 50, 280, [item('λ', 'lambda', 64.6, '', 0.003), item('M1d,mín', 'M1min', 22.932, 'kN·m'), item('ν', 'nu', 0.73, '', 0.006), item('Md,tot', 'Md', 47.91, 'kN·m', 0.003)])
mt('bastos-pil-p8-14x50', 'Edifício — pilar P8 na seção inicial 14×50 (γn = 1,25, Nd = 1225 kN)', BASTOS, 'Item 21.1, Pilar P8, p. 78',
   'Primeira tentativa do P8 com 14×50 cm (γn = 1,25, Nd = 1225 kN), depois revista por exceder 4% de taxa por lance.',
   30, 1225, 14, 50, 280, [item('λ', 'lambda', 69.2, '', 0.003), item('M1d,mín', 'M1min', 23.52, 'kN·m'), item('ν', 'nu', 0.82, '', 0.006), item('M2d', 'M2', 25.98, 'kN·m', 0.01), item('Md,tot', 'Md', 49.50, 'kN·m', 0.003)])
mt('bastos-pil-p5', 'Edifício — pilar de extremidade P5 15×50 com momento da ligação viga-pilar', BASTOS, 'Item 21.2, Pilar P5, p. 83',
   'Pilar de extremidade 15×50 cm, C30, Nd = 1092 kN (γn = 1,20), le = 280 cm, Md,topo = −Md,base = 33,30 kN·m na direção de h = 15 cm: αb = 0,4, λ1 = 68,9 > λ = 64,6, sem 2ª ordem.',
   30, 1092, 15, 50, 280, [item('λ', 'lambda', 64.6, '', 0.003), item('αb', 'alfaB', 0.4), item('λ1', 'lambda1', 68.9, '', 0.003), item('M1d,mín', 'M1min', 21.29, 'kN·m'), item('Md,tot', 'Md', 33.30, 'kN·m')], MA=33.30, MB=-33.30)
mt('bastos-pil-p6-y', 'Edifício — pilar de extremidade P6 19×19, direção sem momento de viga', BASTOS, 'Item 21.3, Pilar P6, p. 89',
   'Pilar 19×19 cm (sem γn), C30, Nd = 420 kN, le = 280 cm; na direção sem momento de viga, λ = 51,0 > 35 e Md,tot = M1d,mín + Nd·e2 (e2 = 1,98 cm).',
   30, 420, 19, 19, 280, [item('λ', 'lambda', 51.0, '', 0.003), item('M1d,mín', 'M1min', 8.694, 'kN·m'), item('Md,tot', 'Md', 17.026, 'kN·m', 0.003)])
mt('bastos-pil-p1-x', 'Edifício — pilar de canto P1 19×25, direção de h = 25 cm (λ1 = 80,0)', BASTOS, 'Item 21.4, Pilar P1, p. 94',
   'Pilar de canto 19×25 cm, C30, Nd = 182 kN, momentos de 25,41 kN·m (sinais opostos, e1 = 13,96 cm) na direção de h = 25 cm: αb = 0,4, λ1 = 80,0.',
   30, 182, 25, 19, 280, [item('λ (a fonte imprime 38,9; 3,46·280/25 = 38,75)', 'lambda', 38.9, '', 0.005), item('αb', 'alfaB', 0.4), item('λ1', 'lambda1', 80.0, '', 0.003), item('M1d,mín', 'M1min', 4.095, 'kN·m'), item('Md,tot', 'Md', 25.41, 'kN·m')], MA=25.41, MB=-25.41)
mt('bastos-pil-p1-y', 'Edifício — pilar de canto P1 19×25, direção de h = 19 cm (λ1 = 73,4)', BASTOS, 'Item 21.4, Pilar P1, p. 94',
   'Mesmo pilar, direção de h = 19 cm: momentos de 12,02 kN·m (e1 = 6,60 cm, sinais opostos), αb = 0,4, λ1 = 73,4 > λ = 51,0.',
   30, 182, 19, 25, 280, [item('λ', 'lambda', 51.0, '', 0.003), item('λ1', 'lambda1', 73.4, '', 0.003), item('M1d,mín', 'M1min', 3.767, 'kN·m'), item('Md,tot', 'Md', 12.02, 'kN·m')], MA=12.02, MB=-12.02)
# --- Scadelai 2004 ---------------------------------------------------------------------------------------------
mt('scadelai-ex1-ab04', 'Pilar 26×40, le = 675 cm (λ = 90), αb = 0,4 — curvatura aproximada', SCAD, 'Exemplo 1, item 7.1.1, p. 71',
   'Pilar biapoiado 26×40 cm, C25, CA-50, Nd = 1302 kN, le = 675 cm, momentos de extremidade de 29,69 kN·m com sinais opostos (αb = 0,4).',
   25, 1302, 26, 40, 675, [item('λ', 'lambda', 90, '', 0.003), item('λ1', 'lambda1', 65.24, '', 0.002), item('M1d,mín', 'M1min', 29.69, 'kN·m', 0.002),
   item('ν', 'nu', 0.70, '', 0.006), item('1/r (1/m)', 'curvatura', 0.016, '1/m', 0.004), item('Md,tot', 'Md', 106.8, 'kN·m', 0.002)], MA=29.69, MB=-29.69,
   nota=NOTA_MT + ' A fonte usa a NBR 6118:2003, com as mesmas expressões.')
af('scadelai-ex1-ab04-as', 'Pilar 26×40, Nd = 1302 kN, Md = 106,8 kN·m — armadura (ábaco A-3)', SCAD, 'Exemplo 1, item 7.1.1, p. 71',
   'Mesmo pilar: ν = 0,70, μ = 0,22, d\'/h ≈ 0,15: ω = 0,56 no ábaco A-3 de Venturini, As = 23,92 cm².', 25, 1302, 106.8, 40, 26, 4, 23.92, 'ábaco A-3 de Venturini et al. (1987)')
mt('scadelai-ex1-ab1', 'Pilar 26×40, le = 675 cm (λ = 90), αb = 1,0 — curvatura aproximada', SCAD, 'Exemplo 1, item 7.2.1, p. 82',
   'Mesmo pilar com αb = 1,0 (sem momentos de 1ª ordem além do mínimo): λ1 = 35.',
   25, 1302, 26, 40, 675, [item('λ1', 'lambda1', 35), item('Md,tot', 'Md', 124.61, 'kN·m', 0.002)], nota=NOTA_MT + ' A fonte usa a NBR 6118:2003, com as mesmas expressões.')
af('scadelai-ex1-ab1-as', 'Pilar 26×40, Nd = 1302 kN, Md = 124,61 kN·m — armadura (ábaco A-3)', SCAD, 'Exemplo 1, item 7.2.1, p. 82',
   'ν = 0,70, μ = 0,26: ω = 0,68, As = 29,04 cm².', 25, 1302, 124.61, 40, 26, 4, 29.04, 'ábaco A-3 de Venturini et al. (1987)')
# --- TCCs ------------------------------------------------------------------------------------------------------
mt('unichristus-p5', 'Pilar 20×40 com le = 520 cm (λ ≈ 90): limite 1/r ≤ 0,005/h', UNICH, 'Seção 4, pilar P5 (Tabelas 10, 16, 23 e 29)',
   'Pilar 20×40 cm, C25, CA-50, Nd = 440,9 kN, le = 520 cm; na direção de h = 20 cm, como ν = 0,309 é baixo, a curvatura fica limitada a 0,005/h e e2 = 6,76 cm.',
   25, 440.9, 20, 40, 520, [item('λ', 'lambda', 89.96, '', 0.002), item('M1d,mín', 'M1min', 9.259, 'kN·m', 0.002), item('ν', 'nu', 0.309, '', 0.004),
   item('M2d', 'M2', 29.805, 'kN·m', 0.002), item('Md,tot', 'Md', 39.064, 'kN·m', 0.002)])
mt('ufu-p8', 'Pilar intermediário 14×26 (γn = 1,25), le = 350 cm (λ = 86,5)', UFU, 'Seção 6.3, Tabela 24 (P8)',
   'Pilar intermediário 14×26 cm, C25, Nk = 113 kN, γn = 1,25, Nd = 198 kN, le = 350 cm (carga por área de influência de 16,9 m²).',
   25, 198, 14, 26, 350, [item('λ', 'lambda', 86.5, '', 0.003), item('M1d,mín', 'M1min', 3.81, 'kN·m', 0.006), item('ν', 'nu', 0.305, '', 0.004), item('Md,tot', 'Md', 12.49, 'kN·m', 0.006)])
mt('ufu-p9', 'Pilar intermediário 14×45 (γn = 1,25), le = 350 cm', UFU, 'Seção 6.3, Tabela 24 (P9)',
   'Pilar intermediário 14×45 cm, C25, Nk = 288 kN, Nd = 504 kN, le = 350 cm.',
   25, 504, 14, 45, 350, [item('λ', 'lambda', 86.5, '', 0.003), item('M1d,mín', 'M1min', 9.68, 'kN·m', 0.006), item('ν', 'nu', 0.448, '', 0.004), item('Md,tot', 'Md', 31.75, 'kN·m', 0.006)])
af('ufu-p9-as', 'Pilar 14×45, Nd = 504 kN, Md = 31,75 kN·m — armadura (ábaco de Venturini)', UFU, 'Seção 6.3, Tabela 24 (P9)',
   'μx = 0,202, d\'/h = 0,29: ω = 0,70 (Venturini, 1987), As = 18,11 cm².', 25, 504, 31.75, 45, 14, 4.1, 18.11, 'ábaco de Venturini (1987)')

json.dump({'grupo': 'Bibliografia — pilares', 'descricao': 'Exercícios resolvidos publicados (apostila de P. S. S. Bastos/UNESP, dissertação de M. A. Scadelai/EESC-USP, TCCs): esbeltez, momento mínimo, αb, λ1, 2ª ordem pela curvatura aproximada e armadura por ábaco.', 'casos': casos},
          open('/home/claude/lebr/validacao/casos/27-bibliografia-pilares.json', 'w'), ensure_ascii=False, indent=1)
print(len(casos), 'casos')
