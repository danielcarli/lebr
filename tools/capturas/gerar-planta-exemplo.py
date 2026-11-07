# Planta de arquitetura simples (DXF R12, metros) para o fundo da montagem do exemplo de 3 pavimentos.
import math
E = []
def linha(c, x1, y1, x2, y2): E.append(f"0\nLINE\n8\n{c}\n10\n{x1:.4f}\n20\n{y1:.4f}\n30\n0\n11\n{x2:.4f}\n21\n{y2:.4f}\n31\n0")
def arco(c, x, y, r, a1, a2): E.append(f"0\nARC\n8\n{c}\n10\n{x:.4f}\n20\n{y:.4f}\n30\n0\n40\n{r:.4f}\n50\n{a1}\n51\n{a2}")
def texto(c, x, y, h, t): E.append(f"0\nTEXT\n8\n{c}\n10\n{x:.4f}\n20\n{y:.4f}\n30\n0\n40\n{h}\n1\n{t}\n72\n1\n11\n{x:.4f}\n21\n{y:.4f}\n31\n0")
T = 0.15
def parede(x1, y1, x2, y2, vaos=(), t=T):
    """parede horizontal ou vertical pelo eixo, com vãos [(a, b)] medidos a partir do início"""
    hz = y1 == y2; L = abs(x2 - x1) if hz else abs(y2 - y1); s = 1 if (x2 > x1 if hz else y2 > y1) else -1
    def p(u, v): return (x1 + s * u, y1 + v) if hz else (x1 + v, y1 + s * u)
    cortes = [0] + [w for a, b in sorted(vaos) for w in (a, b)] + [L]
    for i in range(0, len(cortes), 2):
        a, b = cortes[i], cortes[i + 1]
        for v in (-t / 2, t / 2): linha('PAREDES', *p(a, v), *p(b, v))
        for u in (a, b):
            if 0 < u < L: linha('PAREDES', *p(u, -t / 2), *p(u, t / 2))
    for a, b in vaos: yield p(a, 0), p(b, 0), hz
def porta(it, lado=1):
    for (xa, ya), (xb, yb), hz in it:
        w = math.hypot(xb - xa, yb - ya)
        if hz:
            linha('PORTAS', xa, ya, xa, ya + lado * w); arco('PORTAS', xa, ya, w, 0 if lado > 0 else 270, 90 if lado > 0 else 360)
        else:
            linha('PORTAS', xa, ya, xa + lado * w, ya); arco('PORTAS', xa, ya, w, 0 if lado < 0 else 270, 90 if lado < 0 else 360) if False else arco('PORTAS', xa, ya, w, 270 if lado > 0 else 180, 360 if lado > 0 else 270)
def janela(it):
    for (xa, ya), (xb, yb), hz in it:
        for v in (-T / 2, 0, T / 2):
            if hz: linha('JANELAS', xa, ya + v, xb, yb + v)
            else: linha('JANELAS', xa + v, ya, xb + v, yb)
# paredes externas (eixos nos pilares: x 0..8, y 0..10)
janela(parede(0, 0, 8, 0, [(1.0, 3.0), (5.0, 7.0)]))
janela(parede(0, 10, 8, 10, [(4.8, 6.6)]))
janela(parede(0, 0, 0, 10, [(1.5, 3.5)]))
janela(parede(8, 0, 8, 10, [(1.5, 3.5), (6.2, 8.2)]))
# internas
porta(parede(4, 0, 4, 5, [(3.6, 4.4)]), 1)
porta(parede(0, 5, 8, 5, [(2.6, 3.4), (4.6, 5.4)]), 1)
parede(2, 5, 2, 10, [], 0.12) and None
for _ in parede(2, 5, 2, 10, [], 0.12): pass
porta(parede(4, 5, 4, 10, [(0.3, 1.1)]), -1)
# escada (degraus) entre x 0..2, y 5..10
for k in range(1, 15): linha('ESCADA', 0.08, 5.15 + k * 0.30, 1.92, 5.15 + k * 0.30)
linha('ESCADA', 1.0, 5.3, 1.0, 9.6)
# sacada
for _ in parede(0, -1.2, 4, -1.2, [], 0.1): pass
for x in (0, 4):
    for _ in parede(x, 0, x, -1.2, [], 0.1): pass
for nome, x, y in [('SALA', 2.0, 2.0), ('COZINHA', 6.0, 2.0), ('QUARTO', 3.0, 7.0), ('SUÍTE', 6.0, 7.0), ('ESCADA', 1.0, 9.65), ('SACADA', 2.0, -0.7)]:
    texto('TEXTOS', x, y, 0.22, nome)
# bancada e cama (mobiliário simples)
for a in [(4.2, 0.2, 7.8, 0.2), (4.2, 0.8, 7.8, 0.8)]: linha('MOBILIARIO', *a)
for a in [(5.2, 9.75, 6.8, 9.75), (5.2, 7.75, 6.8, 7.75), (5.2, 9.75, 5.2, 7.75), (6.8, 9.75, 6.8, 7.75)]: linha('MOBILIARIO', *a)
cab = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nENTITIES"
open('' + __import__('os').path.join(__import__('os').path.dirname(__file__), 'planta-exemplo.dxf') + '', 'w', encoding='utf-8').write(cab + "\n" + "\n".join(E) + "\n0\nENDSEC\n0\nEOF\n")
print(len(E), 'entidades')
