/**
 * Junta as migrations num arquivo único, para aplicar de uma vez no SQL
 * Editor do Supabase sem colar seis arquivos na ordem certa.
 *
 * Uso: npm run banco:consolidar
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR_MIGRATIONS = 'supabase/migrations'
const ARQUIVO_SAIDA = 'supabase/aplicar-tudo.sql'

const arquivos = fs.readdirSync(DIR_MIGRATIONS).sort()

const cabecalho = `-- ============================================================================
-- RePerfil — Esquema completo do banco (Fase 1)
-- ============================================================================
--
-- Arquivo GERADO automaticamente juntando as migrations em ordem.
-- Não edite este arquivo: edite os arquivos em supabase/migrations/ e
-- gere novamente com  npm run banco:consolidar
--
-- Como aplicar: cole o conteúdo inteiro no SQL Editor do Supabase e execute.
-- ============================================================================
`

const corpo = arquivos
  .map(
    (arquivo) =>
      `\n\n-- <<< ${arquivo} >>>\n\n` +
      fs.readFileSync(path.join(DIR_MIGRATIONS, arquivo), 'utf8'),
  )
  .join('')

fs.writeFileSync(ARQUIVO_SAIDA, cabecalho + corpo)

console.log(
  `Gerado ${ARQUIVO_SAIDA} a partir de ${arquivos.length} migrations ` +
    `(${(cabecalho + corpo).split('\n').length} linhas).`,
)
