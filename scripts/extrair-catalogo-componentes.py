"""
Extrai o catálogo "Componentes" da Udinese (`CATÁLOGO_ACESSÓRIOS_15x21_UDINESE.pdf`)
para um JSON intermediário + uma foto recortada por produto.

── POR QUE UM SCRIPT SEPARADO DO GOLD/SUPREMA ────────────────────────────
O layout aqui é bem diferente: não há família com variação de cor — é uma
GRADE de até 9 produtos por página (3 colunas × 3 linhas), cada um com:

  14pt   nome da categoria (ex.: "Integrada")   → topo da página, uma vez
   6pt   nome do produto (pode quebrar 2 linhas)
   6pt   "Versões: DIR/ESQ" (opcional — esquerda/direita, não é cor)
   6pt   código único do produto
         + uma foto própria, embutida na própria célula (não um recorte de
           página inteira, como no Gold/Suprema)

Sem tabela de código-por-cor, cada produto vira UMA linha em
`modelos_acessorio` direto — sem usar `codigos_fabricante_acessorio` (essa
tabela existe para variação de cor, que este catálogo não tem).

Uso:
  python scripts/extrair-catalogo-componentes.py <pasta-de-saida>
"""
import sys
import json
import re
from pathlib import Path

import fitz
from PIL import Image

ARQUIVO = Path("C:/Softs/AppReperfil_Diversos/CATÁLOGO_ACESSÓRIOS_15x21_UDINESE.pdf")
DPI_RECORTE = 150
MARGEM_PT = 4


def eh_versao(texto):
    """"Versões: DIR/ESQ" (lado) ou "Versão: 110/220" (voltagem) — as duas
    grafias aparecem, singular e plural."""
    return texto.lower().startswith('vers')


def eh_codigo(texto):
    """Código: maiúsculo, um token só, sem espaço — não precisa de dígito
    (alguns códigos são só letras, ex.: "KITMBOLT"), mas maiúsculo e sem
    espaço já bastam para nunca se confundir com texto corrido de página
    de capa/informações/contracapa (esse é sempre com letra minúscula em
    algum lugar, e as duas checagens juntas eliminam o risco)."""
    return texto.isascii() and texto.isupper() and ' ' not in texto and not eh_versao(texto)


def categoria_da_pagina(pagina):
    """A legenda de 14pt no topo da página (ex.: "Integrada") — repete em
    toda página da seção, igual ao Gold/Suprema, só que aqui não some no
    meio do texto: fica sempre a mesma posição, y < 50pt."""
    d = pagina.get_text("dict")
    for bloco in d["blocks"]:
        if "lines" not in bloco:
            continue
        for linha in bloco["lines"]:
            for span in linha["spans"]:
                if round(span["size"], 1) == 14.0 and span["bbox"][1] < 50:
                    texto = span["text"].strip()
                    if texto:
                        return texto
    return None


def coluna_de(x):
    """3 colunas fixas — os produtos sempre começam perto de x≈35/160/285."""
    if x < 130:
        return 0
    if x < 260:
        return 1
    return 2


def extrair_produtos_da_pagina(pagina):
    """Uma célula (nome + código [+ versões]) por produto, agrupada por
    coluna e reconhecida pelo CÓDIGO como fim de cada célula — assim não
    depende de coordenada Y exata, só da ordem de leitura dentro da coluna."""
    d = pagina.get_text("dict")
    spans_por_coluna = {0: [], 1: [], 2: []}

    for bloco in d["blocks"]:
        if "lines" not in bloco:
            continue
        for linha in bloco["lines"]:
            for span in linha["spans"]:
                texto = span["text"].strip()
                if not texto:
                    continue
                tam = round(span["size"], 1)
                y = span["bbox"][1]
                if tam == 14.0 and y < 50:
                    continue  # legenda da categoria
                if y > 560:
                    continue  # rodapé (número da página, "Catálogo Componentes | ...")
                if tam not in (6.0, 7.0, 7.5):
                    continue
                spans_por_coluna[coluna_de(span["bbox"][0])].append(
                    (y, span["bbox"][1], span["bbox"][3], texto)
                )

    produtos = []
    for col, spans in spans_por_coluna.items():
        spans.sort(key=lambda s: s[0])
        pendentes = []
        y_topo_pendentes = None

        for _, ytop, ybottom, texto in spans:
            if eh_codigo(texto):
                nome_partes = [t for t in pendentes if not eh_versao(t)]
                tem_versoes = any(eh_versao(t) for t in pendentes)
                if nome_partes:
                    produtos.append(
                        {
                            "nome": ' '.join(nome_partes),
                            "codigo": texto,
                            "versoes_dir_esq": tem_versoes,
                            "y_topo": y_topo_pendentes,
                            "y_fim": ybottom,
                            "coluna": col,
                        }
                    )
                pendentes = []
                y_topo_pendentes = None
            else:
                if y_topo_pendentes is None:
                    y_topo_pendentes = ytop
                pendentes.append(texto)

    return produtos


def foto_da_celula(pagina, produto, pix, escala):
    """Recorta a foto embutida na célula deste produto — da altura do nome
    até o código, só na largura da coluna dele (não a página inteira)."""
    largura_coluna = pagina.rect.width / 3
    x0 = produto["coluna"] * largura_coluna
    x1 = x0 + largura_coluna

    y0 = max(0, produto["y_topo"] - MARGEM_PT)
    y1 = min(pagina.rect.height, produto["y_fim"] + MARGEM_PT)

    caixa = (
        int(x0 * escala),
        int(y0 * escala),
        int(x1 * escala),
        int(y1 * escala),
    )
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples).crop(caixa)


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


def main():
    if len(sys.argv) < 2:
        print("Uso: python scripts/extrair-catalogo-componentes.py <pasta-de-saida>")
        sys.exit(1)

    pasta_saida = Path(sys.argv[1])
    pasta_imagens = pasta_saida / "imagens"
    pasta_imagens.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(ARQUIVO)
    escala = DPI_RECORTE / 72

    todos_produtos = []
    categoria_atual = None
    paginas_sem_produto = []

    for i, pagina in enumerate(doc):
        nova_categoria = categoria_da_pagina(pagina)
        if nova_categoria:
            categoria_atual = nova_categoria

        produtos = extrair_produtos_da_pagina(pagina)
        if not produtos:
            paginas_sem_produto.append(i + 1)
            continue

        pix = pagina.get_pixmap(dpi=DPI_RECORTE)

        for p in produtos:
            recorte = foto_da_celula(pagina, p, pix, escala)
            nome_arquivo = f"p{i+1}-{slug(p['nome'])[:60]}-{slug(p['codigo'])}.png"
            recorte.save(pasta_imagens / nome_arquivo)

            todos_produtos.append(
                {
                    "pagina": i + 1,
                    "categoria": categoria_atual,
                    "nome": p["nome"],
                    "codigo": p["codigo"],
                    "versoes_dir_esq": p["versoes_dir_esq"],
                    "imagem": f"imagens/{nome_arquivo}",
                }
            )

    doc.close()

    caminho_json = pasta_saida / "catalogo-componentes.json"
    with open(caminho_json, "w", encoding="utf-8") as f:
        json.dump(todos_produtos, f, ensure_ascii=False, indent=2)

    print(f"Total: {len(todos_produtos)} produtos extraídos.")
    print(f"JSON salvo em: {caminho_json}")
    print(f"Imagens em: {pasta_imagens}")
    if paginas_sem_produto:
        print(
            f"{len(paginas_sem_produto)} páginas sem nenhum produto "
            f"(prováveis capa/índice/info): {paginas_sem_produto}"
        )
    print(
        "\nNada foi gravado no banco — isto é só extração para arquivo local. "
        "Confira uma amostra das imagens antes de seguir para a importação."
    )


if __name__ == "__main__":
    main()
