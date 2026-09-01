"""
Extrai os catálogos de acessórios Udinese (Gold, Suprema) para um JSON
intermediário + uma imagem recortada por família de produto.

── ESCOPO DESTA PRIMEIRA VERSÃO ──────────────────────────────────────────
Só Gold e Suprema — os dois catálogos "sistemista" têm o mesmo layout
(título grande + subtítulo + tabela Código/Catálogo/Cor por família). O
catálogo "Componentes" (Udinese geral) tem outro layout — itens sem
variação de cor, sem a mesma estrutura de tabela — e fica de fora por
enquanto; precisaria de uma lógica de extração própria.

── COMO O LAYOUT VIRA DADO ────────────────────────────────────────────────
Cada página tem um texto com tamanhos de fonte bem diferentes por papel:

  20pt  nome do produto (ex.: "Fecho Concha Flare")      → início de família
  14pt  variante do nome (ex.: "220 Com Chave")           → subtítulo
  10pt  "Código"/"Catálogo"/"Cor" (cabeçalho da tabela)   → ignorado
   8pt  linhas da tabela (código, catálogo, cor)          → uma família por Y

Uma família termina onde a próxima começa (ou o fim da página). O desenho
técnico não é extraído separado do render fotorrealista — a página inteira,
da altura do título até a próxima família, vira UMA imagem só (decisão já
tomada: não precisa separar).

Uso:
  python scripts/extrair-catalogo-acessorios.py <pasta-de-saida>
"""
import sys
import json
import re
from pathlib import Path

import fitz
from PIL import Image

PASTA_CATALOGOS = Path("C:/Softs/AppReperfil_Diversos")
CATALOGOS = [
    {"arquivo": "CATÁLOGO_ACESSÓRIOS_GOLD.pdf", "linha": "Gold"},
    {"arquivo": "CATÁLOGO_ACESSÓRIOS_SUPREMA.pdf", "linha": "Suprema"},
]

DPI_RECORTE = 150
MARGEM_PT = 6  # pontos de folga acima do título / abaixo do fim do bloco


def tipologia_da_pagina(pagina):
    """
    "Tipologia" é a legenda pequena (12pt) no canto superior direito de
    TODA página da seção (não só a primeira) — repete a cada página, com o
    nome grande (20pt) da seção logo dela. Não é "o span logo depois" em
    ordem de leitura (a legenda e o nome ficam desalinhados o bastante para
    a ordenação por Y inverter os dois às vezes) — o que identifica o nome
    da seção é ser o texto de 20pt MAIS ALTO da página (menor Y): título de
    produto começa mais abaixo, sempre depois do cabeçalho.
    """
    d = pagina.get_text("dict")
    tem_legenda = False
    menor_y = None
    nome = None

    for bloco in d["blocks"]:
        if "lines" not in bloco:
            continue
        for linha in bloco["lines"]:
            for span in linha["spans"]:
                texto = span["text"].strip()
                if not texto:
                    continue
                if texto == "Tipologia":
                    tem_legenda = True
                elif round(span["size"], 1) == 20.0:
                    y = span["bbox"][1]
                    if menor_y is None or y < menor_y:
                        menor_y = y
                        nome = texto

    return nome if tem_legenda else None


def extrair_blocos_da_pagina(pagina):
    """Devolve a lista de famílias de produto encontradas nesta página."""
    d = pagina.get_text("dict")
    spans = []
    for bloco in d["blocks"]:
        if "lines" not in bloco:
            continue
        for linha in bloco["lines"]:
            for span in linha["spans"]:
                texto = span["text"].strip()
                if not texto or "Udinese ASSA ABLOY" in texto:
                    continue
                spans.append(
                    {
                        "y": span["bbox"][1],
                        "x": span["bbox"][0],
                        "tamanho": round(span["size"], 1),
                        "texto": texto,
                    }
                )
    spans.sort(key=lambda s: (s["y"], s["x"]))

    blocos = []
    atual = None
    for span in spans:
        tam = span["tamanho"]
        if tam == 20.0:
            if atual:
                blocos.append(atual)
            atual = {
                "titulo": span["texto"],
                "subtitulo": None,
                "y_topo": span["y"],
                "linhas_tabela": [],
            }
        elif atual is None:
            continue
        elif tam == 14.0 and atual["subtitulo"] is None:
            atual["subtitulo"] = span["texto"]
        elif tam == 8.0 and span["texto"] not in ("Código", "Catálogo", "Cor"):
            atual["linhas_tabela"].append((round(span["y"], 1), span["texto"]))

    if atual:
        blocos.append(atual)

    # Agrupa as linhas da tabela em trincas (código, catálogo, cor) pela
    # MESMA posição Y — cada linha da tabela tem os três valores alinhados.
    for bloco in blocos:
        por_y = {}
        for y, texto in bloco["linhas_tabela"]:
            por_y.setdefault(y, []).append(texto)

        variacoes = []
        for y in sorted(por_y):
            valores = por_y[y]
            if len(valores) == 3:
                variacoes.append(
                    {
                        "codigo_fabricante": valores[0],
                        "codigo_catalogo": valores[1],
                        "cor": valores[2],
                    }
                )
        bloco["variacoes"] = variacoes
        del bloco["linhas_tabela"]

    # Uma família sem NENHUMA variação capturada é sinal de que o texto não
    # seguiu o padrão esperado (ex.: layout diferente nessa página) — melhor
    # relatar do que inventar um acessório sem código nenhum.
    return [b for b in blocos if b["variacoes"]]


def recortar_bloco(pagina, y_topo_pt, y_fim_pt, dpi=DPI_RECORTE):
    escala = dpi / 72
    pix = pagina.get_pixmap(dpi=dpi)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    y0 = max(0, int((y_topo_pt - MARGEM_PT) * escala))
    y1 = pix.height if y_fim_pt is None else min(pix.height, int((y_fim_pt - MARGEM_PT) * escala))

    return img.crop((0, y0, pix.width, y1))


def slug(texto):
    texto = texto.lower()
    texto = re.sub(r"[àáâã]", "a", texto)
    texto = re.sub(r"[éê]", "e", texto)
    texto = re.sub(r"[í]", "i", texto)
    texto = re.sub(r"[óô]", "o", texto)
    texto = re.sub(r"[ú]", "u", texto)
    texto = re.sub(r"[ç]", "c", texto)
    texto = re.sub(r"[^a-z0-9]+", "-", texto).strip("-")
    return texto or "sem-nome"


def processar_catalogo(caminho_pdf, linha, pasta_saida):
    doc = fitz.open(caminho_pdf)
    pasta_imagens = pasta_saida / "imagens"
    pasta_imagens.mkdir(parents=True, exist_ok=True)

    familias = []
    tipologia_atual = None
    paginas_sem_bloco = []

    for i, pagina in enumerate(doc):
        tipologia_nova = tipologia_da_pagina(pagina)
        if tipologia_nova:
            tipologia_atual = tipologia_nova

        blocos = extrair_blocos_da_pagina(pagina)

        if not blocos:
            # Página só de título de tipologia, índice, ou capa — não é erro.
            if not tipologia_nova:
                paginas_sem_bloco.append(i + 1)
            continue

        for j, bloco in enumerate(blocos):
            y_fim = blocos[j + 1]["y_topo"] if j + 1 < len(blocos) else None
            recorte = recortar_bloco(pagina, bloco["y_topo"], y_fim)

            nome_produto = f"{bloco['titulo']} {bloco['subtitulo'] or ''}".strip()
            nome_arquivo = f"{linha.lower()}-p{i+1}-{slug(nome_produto)}.png"
            recorte.save(pasta_imagens / nome_arquivo)

            familias.append(
                {
                    "linha": linha,
                    "pagina": i + 1,
                    "tipologia": tipologia_atual,
                    "nome": nome_produto,
                    "imagem": f"imagens/{nome_arquivo}",
                    "variacoes": bloco["variacoes"],
                }
            )

    doc.close()
    return familias, paginas_sem_bloco


def main():
    if len(sys.argv) < 2:
        print("Uso: python scripts/extrair-catalogo-acessorios.py <pasta-de-saida>")
        sys.exit(1)

    pasta_saida = Path(sys.argv[1])
    pasta_saida.mkdir(parents=True, exist_ok=True)

    todas_familias = []
    for catalogo in CATALOGOS:
        caminho = PASTA_CATALOGOS / catalogo["arquivo"]
        print(f"\n=== {catalogo['linha']} ({caminho.name}) ===")

        familias, sem_bloco = processar_catalogo(caminho, catalogo["linha"], pasta_saida)
        todas_familias.extend(familias)

        total_variacoes = sum(len(f["variacoes"]) for f in familias)
        print(f"  {len(familias)} famílias, {total_variacoes} variações de cor")
        if sem_bloco:
            print(
                f"  {len(sem_bloco)} páginas sem nenhum bloco reconhecido "
                f"(prováveis índice/capa/tipologia): {sem_bloco[:10]}"
                + (" ..." if len(sem_bloco) > 10 else "")
            )

    caminho_json = pasta_saida / "catalogo-acessorios.json"
    with open(caminho_json, "w", encoding="utf-8") as f:
        json.dump(todas_familias, f, ensure_ascii=False, indent=2)

    print(f"\nTotal: {len(todas_familias)} famílias extraídas.")
    print(f"JSON salvo em: {caminho_json}")
    print(f"Imagens em: {pasta_saida / 'imagens'}")
    print(
        "\nNada foi gravado no banco — isto é só extração para arquivo local. "
        "Confira uma amostra das imagens antes de seguir para a importação."
    )


if __name__ == "__main__":
    main()
