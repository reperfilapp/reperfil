/**
 * Valida a SINTAXE dos arquivos SQL sem precisar de banco.
 *
 * Limites conhecidos, para não dar falsa sensação de segurança:
 *  • valida sintaxe, NÃO semântica — tabela inexistente passa batido;
 *  • o corpo das funções PL/pgSQL é apenas texto para o parser, então erro
 *    dentro de uma função só aparece quando o banco realmente a compila.
 *
 * Ou seja: passar aqui é condição necessária, não suficiente. A prova de
 * verdade é aplicar no banco e rodar supabase/testes/verificar-rls.sql.
 *
 * Uso: npm run banco:validar
 */
import fs from 'node:fs'
import path from 'node:path'
import iniciarParser from 'pg-query-emscripten'

const alvos = [
  ...fs
    .readdirSync('supabase/migrations')
    .sort()
    .map((a) => path.join('supabase/migrations', a)),
  'supabase/seed.sql',
  'supabase/testes/verificar-rls.sql',
]

let falhas = 0

for (const arquivo of alvos) {
  // Instância nova por arquivo: o parser é WebAssembly e acumula memória,
  // quebrando depois de alguns arquivos grandes na mesma instância.
  const pg = await iniciarParser()
  const sql = fs.readFileSync(arquivo, 'utf8')
  const resultado = pg.parse(sql)

  if (resultado.error) {
    falhas += 1
    console.error(`ERRO  ${arquivo}`)
    console.error(
      `      ${resultado.error.message} (posição ${resultado.error.cursorpos})`,
    )
  } else {
    console.log(
      `ok    ${arquivo}  (${resultado.parse_tree.stmts.length} comandos)`,
    )
  }
}

if (falhas > 0) {
  console.error(`\n${falhas} arquivo(s) com erro de sintaxe.`)
  process.exit(1)
}

console.log('\nSintaxe validada. Falta aplicar no banco e rodar os testes de RLS.')
