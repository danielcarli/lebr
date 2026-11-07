# Funções comuns aos geradores dos casos de validação da bibliografia (validacao/casos/2x-bibliografia-*.json).
import json, os

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def item(g, c, v, u='', tol=0.005, **k):
    """Uma grandeza esperada: nome, caminho no resultado, valor publicado, unidade e tolerância relativa."""
    e = {'grandeza': g, 'caminho': c, 'valor': v, 'unidade': u, 'tolerancia': tol}
    e.update(k)
    return e


def caso(id, titulo, ref, local, descricao, funcao, args, esperado, nota=None):
    """Caso que chama uma função do motor. `ref` = {fonte, url}; `local` = onde está na fonte."""
    c = {'id': id, 'titulo': titulo, 'fonte': f"{ref['fonte']} {local}.", 'url': ref['url'], 'descricao': descricao}
    if nota:
        c['nota'] = nota
    c.update({'alvo': 'motor', 'funcao': funcao, 'args': args, 'esperado': esperado})
    return c


def gravar(nome, grupo, descricao, casos):
    ids = [c['id'] for c in casos]
    assert len(ids) == len(set(ids)), 'ids repetidos'
    caminho = os.path.join(RAIZ, 'validacao', 'casos', nome)
    with open(caminho, 'w', encoding='utf-8') as f:
        json.dump({'grupo': grupo, 'descricao': descricao, 'casos': casos}, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'{nome}: {len(casos)} casos, {sum(len(c["esperado"]) for c in casos)} grandezas')


C = lambda fck: {'$concreto': fck}
S = {'$aco': 500}
