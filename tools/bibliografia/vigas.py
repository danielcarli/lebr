# Gera validacao/casos/29-bibliografia-vigas.json — exercícios resolvidos de vigas publicados online.
from comum import item, caso, gravar, C, S

BASTOS_FS = dict(fonte='BASTOS, P. S. S. Flexão normal simples – vigas (notas de aula, 2117 – Estruturas de Concreto I). UNESP – Faculdade de Engenharia de Bauru, 2015. NBR 6118:2014.',
                 url='https://professor.pucgoias.edu.br/SiteDocente/admin/arquivosUpload/3922/material/Paulo%20Bastos_FlexaoSimples_Vigas_2015.pdf')
BASTOS_V = dict(fonte='BASTOS, P. S. S. Vigas de concreto armado (notas de aula, 2123 – Estruturas de Concreto II). UNESP – Faculdade de Engenharia de Bauru, 2015. NBR 6118:2014.',
                url='https://assets.lms.toolzz.media/66262031/public/vigas-57df49ac-682d-4c59-8bce-2ec4c3ff4b16.pdf')
BASTOS_T = dict(fonte='BASTOS, P. S. S. Torção em vigas de concreto armado (notas de aula). UNESP – Faculdade de Engenharia de Bauru, 2023. NBR 6118:2023.',
                url='https://wwwp.feb.unesp.br/pbastos/concreto2/Torcao.pdf')
UFPR5 = dict(fonte='UFPR – TC037 Estruturas de Concreto I. Capítulo 5: Flexão simples – armadura longitudinal de viga. Universidade Federal do Paraná, 2015.',
             url='https://estruturas.ufpr.br/wp-content/uploads/2015/04/CA-005-2015.pdf')
UFPR6 = dict(fonte='UFPR – TC037 Estruturas de Concreto I (Dalledone Machado, C. L.; Marino, M. A.). Capítulo 6: Flexão simples – armadura transversal de viga. Universidade Federal do Paraná, 2016.',
             url='https://estruturas.ufpr.br/wp-content/uploads/2016/03/Capitulo6.pdf')
PINHEIRO = dict(fonte='PINHEIRO, L. M.; MUZARDO, C. D.; SANTOS, S. P. Fundamentos do concreto e projeto de edifícios. EESC-USP, 2007. NBR 6118:2003.',
                url='https://arquitetonica.wordpress.com/wp-content/uploads/2011/11/fundamentos-do-concreto-eesc-usp.pdf')
PINHEIRO_ELS = dict(fonte='PINHEIRO, L. M.; MUZARDO, C. D. Estruturas de concreto – Capítulo 14: Estados limites de serviço. EESC-USP, 2004. NBR 6118:2003.',
                    url='https://www.fec.unicamp.br/~almeida/ec702/ELS/14%20ELS.pdf')
LIMA = dict(fonte='LIMA, J. S.; GUARDA, M. C. C.; PINHEIRO, L. M. Estruturas de concreto – Capítulo 18: Torção. EESC-USP, 2003.',
            url='https://www.fec.unicamp.br/~almeida/ec802/Vigas/EESC/Torcao.pdf')
CHAER31 = dict(fonte='CHAER, A. V.; OLIVEIRA, M. G. D. Estruturas de concreto armado I – Capítulo 31: Cisalhamento em vigas. PUC Goiás. NBR 6118:2003.',
               url='https://professor.pucgoias.edu.br/SiteDocente/admin/arquivosUpload/3922/material/c31_cisalhamento.pdf')
CHAER15 = dict(fonte='CHAER, A. V. Estudo dirigido – armadura, flecha, vibração e fissuração em vigas. PUC Goiás, 2015. NBR 6118:2014.',
               url='https://professor.pucgoias.edu.br/SiteDocente/admin/arquivosUpload/3922/material/2015_08_31_viga_biapoiada_ELU_ELS.pdf')
BANDEIRA = dict(fonte='BANDEIRA, A. A. Estruturas de concreto armado segundo a NBR 6118/2014: notas de aula. Salvador, 2015.',
                url='https://professor.pucgoias.edu.br/SiteDocente/admin/arquivosUpload/3922/material/Alex%20Bandeira_Concreto%20(Apostila%20de%20Lajes%20e%20Vigas).pdf')

NOTA_FLEX = 'O LEBR usa o diagrama retangular (λ = 0,8, αc = 0,85) e o limite x/d = 0,45 (17.2.3), como a fonte. Compara-se a armadura calculada (antes da mínima).'
NOTA_EST = 'Modelo de cálculo I (θ = 45°, estribos verticais): VRd2 = 0,27·αv2·fcd·bw·d, Vc = Vc0 = 0,6·fctd·bw·d e ρsw,mín = 0,2·fct,m/fywk, como a fonte.'

casos = []


def flex(id, titulo, ref, local, descricao, Md, b, h, d, fck, esperado, dl=4, nota=NOTA_FLEX):
    casos.append(caso(id, titulo, ref, local, descricao, 'flexao.dimensionarFlexao',
                      [{'Md': Md, 'b': b, 'h': h, 'd': d, 'dl': dl, 'c': C(fck), 's': S}], esperado, nota))


def estribos(id, titulo, ref, local, descricao, Vd, bw, d, fck, esperado, nota=NOTA_EST):
    casos.append(caso(id, titulo, ref, local, descricao, 'cisalhamento.dimensionarEstribos',
                      [{'Vd': Vd, 'bw': bw, 'd': d, 'c': C(fck), 's': S}], esperado, nota))


# ------------------------------------------------------------------------------------------------ flexão
flex('bastos-fs-ex1', 'Viga 20×50, Mk = 100 kN·m, C20 — armadura simples', BASTOS_FS, 'Seção 7.3, 1º exemplo, p. 17–22',
     'Calcular a armadura longitudinal de uma viga 20×50 cm (d = 47 cm) sob momento positivo característico de 10 000 kN·cm, C20, CA-50, γf = 1,4.',
     140, 20, 50, 47, 20, [item('As', 'AsCalc', 8.10, 'cm²', 0.005), item('x', 'x', 18.1, 'cm', 0.005), item('x/d', 'xi', 0.39, '', 0.015)])
flex('bastos-fs-ex3', 'Viga 22×60, Mk = −150 kN·m, C25 — armadura negativa', BASTOS_FS, 'Seção 7.3, 3º exemplo, p. 28–30',
     'Armadura negativa de uma viga 22×60 cm (d = 55 cm) com Mk = −15 000 kN·cm, C25, CA-50.',
     210, 22, 60, 55, 25, [item('As', 'AsCalc', 9.95, 'cm²', 0.005), item('x', 'x', 16.2, 'cm', 0.005)])
flex('bastos-fs-dupla1', 'Viga 20×50, Md = 219,8 kN·m, C25 — armadura dupla', BASTOS_FS, 'Seção 8.3, 1º exemplo, p. 38–41',
     'Viga 20×50 cm, d = 45 cm, d\' = 3 cm, Mk = −15 700 kN·cm (Md = 21 980 kN·cm), C25, CA-50. Com armadura simples x/d = 0,58 > 0,45: fixa-se x = 0,45d e acrescenta-se armadura comprimida.',
     219.8, 20, 50, 45, 25, [item('x = 0,45d', 'x', 20.25, 'cm', 0.001), item('As (tracionada)', 'AsCalc', 13.41, 'cm²', 0.005), item("A's (comprimida)", 'Asl', 2.10, 'cm²', 0.005)], dl=3)
flex('bastos-fs-dupla2', 'Viga 14×60, Md = 259 kN·m, C30 — armadura dupla', BASTOS_FS, 'Seção 8.3, 2º exemplo, p. 41–43',
     'Viga 14×60 cm, d = 54 cm, d\' = 4 cm, Mk = −18 500 kN·cm (Md = 25 900 kN·cm), C30, CA-50.',
     259, 14, 60, 54, 30, [item('As (tracionada)', 'AsCalc', 13.17, 'cm²', 0.006)], dl=4,
     nota=NOTA_FLEX + " A fonte resolve com as tabelas de Kc e Ks; A's = 2,03 cm² (Ks' tabelado) não é comparado — pelas equações dá 1,82 cm².")
flex('ufpr-ex5-1', 'Viga 20×50, MSd = 125 kN·m, C35', UFPR5, 'Exemplo 5.1, p. 5-20/5-21',
     'Dimensionar As de viga 20×50 cm (d = 45 cm), MSd = 125 kN·m, C35, CA-50 (formulação com βx, βz).',
     125, 20, 50, 45, 35, [item('As', 'AsCalc', 6.93, 'cm²', 0.005), item('βx = x/d', 'xi', 0.197, '', 0.005)])
flex('pinheiro-ex8-5-1', 'Seção 30×45, Mk = 170 kN·m, C25 (tabelas kc/ks)', PINHEIRO, 'Exemplo 8.5.1, p. 8.7',
     'As de seção 30×45 cm, d = 42 cm, Mk = 170 kN·m (Md = 238 kN·m), C25, CA-50, pelas tabelas de kc e ks.',
     238, 30, 45, 42, 25, [item('As', 'AsCalc', 15.87, 'cm²', 0.005)], dl=3,
     nota='A fonte (NBR 6118:2003) não limita x/d; aqui x/d fica muito perto de 0,45 e o LEBR acrescenta 0,05 cm² de armadura comprimida. A armadura tracionada coincide.')
flex('chaer-2015-elu', 'Viga biapoiada 20×50, vão 6 m, Md = 166,95 kN·m, C30', CHAER15, 'p. 1/13 a 3/13',
     'Viga biapoiada 20×50 cm, vão de 6 m, g = 22,5 kN/m e q = 4 kN/m (Qu = 37,1 kN/m), d = 40 cm, C30, CA-50.',
     166.95, 20, 50, 40, 30, [item('x', 'x', 17.322, 'cm', 0.002), item('kx = x/d', 'xi', 0.4331, '', 0.002), item('As', 'AsCalc', 11.611, 'cm²', 0.002)])
flex('bandeira-4-3-4', 'Seção 12×70, Md = 84 kN·m, C25 — domínio 2', BANDEIRA, 'Item 4.3.4, p. 36–38',
     'Seção 12×70 cm, d = 64 cm, momento característico de 6000 kN·cm (Md = 8400 kN·cm), C25, CA-50.',
     84, 12, 70, 64, 25, [item('ξ = x/d', 'xi', 0.1497, '', 0.002), item('x', 'x', 9.5811, 'cm', 0.002), item('As', 'AsCalc', 3.21, 'cm²', 0.005)],
     nota=NOTA_FLEX + ' Os resultados da fonte só fecham com o momento dado tomado como característico e majorado por 1,4.')
flex('bandeira-4-3-6', 'Viga biapoiada de 4 m com 50 kN/m — armadura dupla (ξ = 0,45)', BANDEIRA, 'Item 4.3.6, p. 39–41',
     'Viga biapoiada de 4 m com 50 kN/m: Md = 1,4·50·4²/8 = 140 kN·m, d = 33 cm, d\' = 5 cm, C30, CA-50; ξ = 0,572 > 0,45 → armadura dupla.',
     140, 20, 40, 33, 30, [item('As', 'AsCalc', 11.83, 'cm²', 0.005), item("A's", 'Asl', 1.88, 'cm²', 0.005)], dl=5,
     nota=NOTA_FLEX + ' A largura não está legível no texto extraído; os resultados da fonte fecham com b = 20 cm.')

# ------------------------------------------------------------------------------------------------ força cortante
estribos('ufpr-ex6-1', 'VRd2 e Vc de viga 20×40, C25', UFPR6, 'Exemplos 6.1 e 6.2, p. 6-7',
         'Viga 20×40 cm, d = 35 cm, C25 (fcd = 1,79 kN/cm², αv2 = 0,9): máxima força cortante pela biela comprimida (modelo I) e parcela do concreto.',
         100, 20, 35, 25, [item('VRd2', 'VRd2', 304.48, 'kN', 0.003), item('Vc', 'Vc', 53.76, 'kN', 0.003)],
         NOTA_EST + ' A fonte arredonda fcd para 1,79 kN/cm² (exato: 1,786).')
estribos('ufpr-ex6-6', 'VRd2 e Vc de viga 20 cm, d = 44 cm, C30', UFPR6, 'Exemplo 6.6',
         'Viga com bw = 20 cm, d = 44 cm, C30, CA-50 (modelo I).',
         100, 20, 44, 30, [item('VRd2', 'VRd2', 447.45, 'kN', 0.003), item('Vc', 'Vc', 76.56, 'kN', 0.003)])
estribos('ufpr-ex6-8-vrd2', 'VRd2 de viga 18×50, C30 (exemplo da decalagem)', UFPR6, 'Exemplo 6.8, p. 6-37',
         'Viga bw = 18 cm, d = 50 cm, C30: dados do exemplo de decalagem (Vc = 78,30 kN, VRd2 = 457,62 kN).',
         224, 18, 50, 30, [item('VRd2', 'VRd2', 457.62, 'kN', 0.003), item('Vc', 'Vc', 78.30, 'kN', 0.003)])
estribos('chaer-31-1', 'Altura mínima pela biela: VSd = 500 kN, bw = 20 cm, C20', CHAER31, 'Exemplo 31.1, p. 31.14–31.15',
         'Menor altura útil de seção retangular com bw = 20 cm, C20, para VSd = 500 kN: d = 70,38 cm (VRd2 = 0,27·0,92·1,429·20·d = 500 kN).',
         500, 20, 70.38, 20, [item('VRd2 com d = 70,38 cm', 'VRd2', 500, 'kN', 0.002)])
estribos('chaer-31-3', 'Viga 12×40 com carga concentrada, C20 — estribos', CHAER31, 'Exemplo 31.3, p. 31.17–31.23',
         'Viga 12×40 cm, d = 36 cm, C20, CA-50, L = 420 cm com carga concentrada; trecho da esquerda com VSd = 87,12 kN.',
         87.12, 12, 36, 20, [item('VRd2', 'VRd2', 153.34, 'kN', 0.002), item('Vc0', 'Vc', 28.64, 'kN', 0.002),
                            item('Asw/s mínimo', 'aswMin', 1.061, 'cm²/m', 0.003), item('Asw/s (trecho E)', 'aswCalc', 4.15, 'cm²/m', 0.005)])
estribos('bastos-vs1-p2', 'Viga contínua VS1 19×60, VSd = 146,9 kN, C25 — estribos', BASTOS_V, 'Seção 13.9 (VS1), p. 27–29',
         'Estribos da viga VS1 19×60 cm (d = 55 cm), C25, CA-50, junto ao pilar P2 (VSd = 1,4·104,9 = 146,9 kN).',
         146.9, 19, 55, 25, [item('VRd2', 'VRd2', 449.4, 'kN', 0.012), item('Vc0', 'Vc', 80.3, 'kN', 0.003),
                             item('Asw/s mínimo', 'aswMin', 1.95, 'cm²/m', 0.005), item('Asw/s', 'aswCalc', 3.01, 'cm²/m', 0.03)],
         NOTA_EST + ' A fonte usa as equações simplificadas do C25 (VRd2 = 0,43·bw·d e Asw = 2,55·VSd/d − 0,20·bw), que arredondam os coeficientes: diferenças de até 3 %.')
estribos('bastos-torcao-ex3-cortante', 'Viga VS1 19×60, C35 — cortante (exemplo de torção)', BASTOS_T, 'Exemplo numérico 3, p. 57–82',
         'Viga VS1 19×60 cm, d = 56 cm, C35, CA-50, VSd = 140,6 kN.',
         140.6, 19, 56, 35, [item('VRd2', 'VRd2', 617.1, 'kN', 0.002), item('Vc0', 'Vc', 102.1, 'kN', 0.005), item('Asw/s mínimo', 'aswMin', 2.44, 'cm²/m', 0.005)])
estribos('pinheiro-15-7', 'Viga V1 22×40, biapoiada, C25 — estribos', PINHEIRO, 'Exemplo 15.7 (viga V1), p. 15.7–15.15',
         'Viga biapoiada 22×40 cm, d = 35,9 cm, C25, CA-50, vão de 410 cm, p = 50 kN/m; força cortante a d/2 da face VSd = 123,2 kN.',
         123.2, 22, 35.9, 25, [item('VRd2', 'VRd2', 342.7, 'kN', 0.002), item('Vc', 'Vc', 60.8, 'kN', 0.002),
                               item('Asw/s', 'aswCalc', 4.44, 'cm²/m', 0.005), item('Asw/s mínimo', 'aswMin', 2.26, 'cm²/m', 0.005)])
estribos('lima-torcao-vrd2', 'Viga 35×50 de marquise, C25 — VRd2', LIMA, 'Item 7, exemplo (viga V1), p. 18.11',
         'Viga 35×50 cm, d = 46,37 cm, C25, VSd = 49,13 kN.',
         49.13, 35, 46.37, 25, [item('VRd2', 'VRd2', 704.24, 'kN', 0.002)])

# ------------------------------------------------------------------------------------------------ decalagem
for id, titulo, ref, local, desc, d, Vd, Vc, al, nota in [
    ('ufpr-ex6-8-al', 'Decalagem: d = 50 cm, VSd = 224 kN, Vc = 78,3 kN', UFPR6, 'Exemplo 6.8, p. 6-37/6-38',
     'al = d·VSd,máx/[2(VSd,máx − Vc)], entre 0,5d e d.', 50, 224, 78.3, 38.44, None),
    ('bastos-vs1-al-p1', 'Decalagem no apoio extremo P1 da VS1 (al calculado > d)', BASTOS_V, 'Seção 13.10 (VS1), p. 30–33',
     'd = 55 cm, VSd = 105,1 kN, Vc = 80,3 kN: al calculado = 116,5 cm > d → al = d = 55 cm.', 55, 105.1, 80.3, 55, None),
    ('bastos-vs1-al-p2', 'Decalagem no apoio interno P2 da VS1', BASTOS_V, 'Seção 13.10 (VS1), p. 33',
     'd = 55 cm, VSd = 146,9 kN, Vc = 80,3 kN: al calculado = 60,7 cm > d → al = 55 cm.', 55, 146.9, 80.3, 55, None),
    ('pinheiro-15-7-al', 'Decalagem da viga V1 22×40', PINHEIRO, 'Exemplo 15.7, p. 15.13',
     'd = 35,9 cm, Vc = 60,8 kN e força cortante na face VSd = 135,8 kN: al ≈ 32 cm.', 35.9, 135.8, 60.8, 32, 'A fonte arredonda al para 32 cm (exato: 32,5 cm); tolerância de 2 %.')]:
    casos.append(caso(id, titulo, ref, local, desc, 'detalhamento.decalagem', [{'d': d, 'Vd': Vd, 'Vc': Vc}],
                      [item('al', '', al, 'cm', 0.02 if nota else 0.002)], nota))

# ------------------------------------------------------------------------------------------------ torção
NOTA_TOR = ('Só a espessura he é conferida: a fonte calcula Ae e ue pela linha dos eixos das barras longitudinais de canto '
            '(Ae = (b − 2c1)(h − 2c1)), e o LEBR pela linha média da parede (Ae = (b − he)(h − he), 17.5.1.4.1); por isso Ae, ue e TRd2 diferem.')
for id, titulo, local, desc, b, h, he in [
    ('bastos-torcao-ex2', 'Seção vazada equivalente da viga V1 19×40', 'Exemplo numérico 2, p. 44–55', 'Viga 19×40 cm (A = 760 cm², u = 118 cm): he = A/u.', 19, 40, 6.4),
    ('bastos-torcao-ex3', 'Seção vazada equivalente da viga VS1 19×60', 'Exemplo numérico 3, p. 57–82', 'Viga 19×60 cm (A = 1140 cm², u = 158 cm): he = A/u.', 19, 60, 7.2)]:
    casos.append(caso(id, titulo, BASTOS_T, local, desc + ' Como A/u < 2c1 (c1 ≈ 4 cm), vale he = A/u ≤ bw − 2c1.', 'torcao.secaoVazada', [{'b': b, 'h': h, 'c1': 4.0}],
                      [item('A', 'A', b * h, 'cm²', 0.0001), item('u', 'u', 2 * (b + h), 'cm', 0.0001), item('he', 'he', he, 'cm', 0.01)], NOTA_TOR))

# ------------------------------------------------------------------------------------------------ estádio II
casos.append(caso('pinheiro-els-estadio2', 'Estádio II da viga 22×40 com 4 ø 20 (αe = 8,82)', PINHEIRO_ELS, 'Item 14.6, exemplo, p. 14.10–14.16',
                  'Viga biapoiada 22×40 cm, d = 35,9 cm, As = 4 ø 20 = 12,60 cm², C25, Ec = 23 800 MPa, αe = 210 000/23 800 = 8,82: linha neutra e inércia no estádio II para a flecha.',
                  'fissuracao.estadioII', [{'b': 22, 'd': 35.9, 'As': 12.6, 'ae': 8.82}],
                  [item('x_II', 'x', 14.66, 'cm', 0.002), item('I_II', 'I', 73240, 'cm⁴', 0.002)]))
casos.append(caso('pinheiro-els-estadio2-ae15', 'Estádio II da viga 22×40 com αe = 15 (fissuração)', PINHEIRO_ELS, 'Item 14.6, exemplo, p. 14.14',
                  'Mesma viga, com αe = 15 (17.3.3.2) para a tensão na armadura na abertura de fissuras.',
                  'fissuracao.estadioII', [{'b': 22, 'd': 35.9, 'As': 12.6, 'ae': 15}],
                  [item('x_II', 'x', 17.69, 'cm', 0.002), item('I_II', 'I', 103269, 'cm⁴', 0.002)]))
casos.append(caso('pinheiro-els-sigma-s', 'Tensão na armadura para a fissuração, viga 22×40, Md,freq = 92,5 kN·m', PINHEIRO_ELS, 'Item 14.6, exemplo, p. 14.14–14.15',
                  'Momento da combinação frequente 92,5 kN·m, 4 ø 20, αe = 15: σs = αe·M·(d − x)/I_II.',
                  'fissuracao.aberturaFissuras', [{'Ms': 92.5, 'b': 22, 'h': 40, 'd': 35.9, 'phi': 20, 'n': 4, 'cob': 2.5, 'phiT': 5, 'fctm': 2.565}],
                  [item('σs (αe = 15)', 'sigma', 244.7, 'MPa', 0.005)],
                  'Só σs é comparado. A fonte toma Acr = 87,62 cm² por barra; o LEBR monta a região de envolvimento de cada barra (até 7,5ø do eixo, limitada pelas vizinhas), e wk sai 0,16 mm contra 0,19 mm da fonte. O LEBR usa As = 4·π·1² = 12,57 cm² (a fonte, 12,60).'))
casos.append(caso('chaer-2015-estadio2', 'Estádio II da viga 20×50 com As = 12,06 cm² (αe = 7,825)', CHAER15, 'p. 4/13 a 6/13',
                  'Viga 20×50 cm com 6 ø 16 (As,ef = 12,064 cm²) em duas camadas, d real = 50 − 6,23 = 43,77 cm, αe = 7,825.',
                  'fissuracao.estadioII', [{'b': 20, 'd': 43.77, 'As': 12.064, 'ae': 7.825}],
                  [item('x_II', 'x', 16.147, 'cm', 0.002), item('I_II', 'I', 100100, 'cm⁴', 0.002)],
                  'A fonte dá I_II = 1,001×10⁻³ m⁴ (100 100 cm⁴).'))

gravar('29-bibliografia-vigas.json', 'Bibliografia — vigas',
       'Exercícios resolvidos publicados (apostilas de P. S. S. Bastos/UNESP, UFPR, L. M. Pinheiro/EESC-USP, A. V. Chaer/PUC Goiás, A. A. Bandeira): flexão simples e dupla, estribos, decalagem, seção vazada da torção e estádio II.',
       casos)
