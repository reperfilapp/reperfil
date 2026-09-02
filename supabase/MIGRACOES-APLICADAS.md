# Controle de migrações aplicadas no banco

Este arquivo existe porque as migrações não rodam sozinhas: o usuário cola
cada uma manualmente no SQL Editor do Supabase, então só ele sabe, na
prática, o que já está de verdade no banco de produção. Este arquivo é o
registro combinado entre as sessões — atualizar aqui é o "registrar" que o
usuário pede quando confirma que aplicou.

**Regra para quem mexer neste arquivo:** toda migração nova criada entra
aqui como `[ ] pendente` no mesmo commit/edição que a cria. Só vira `[x]`
quando o usuário confirmar explicitamente que rodou no Supabase — nunca
antes, mesmo que a sintaxe já tenha sido validada com `npm run banco:validar`
(validar sintaxe não é a mesma coisa que já estar aplicada).

## Status em 01/09/2026: nenhuma pendente

- [x] 20260901600000_limite_semelhanca_desenho_configuravel.sql
- [x] 20260901500000_desenhos_tecnicos_parecidos.sql
- [x] 20260901400000_acabamento_adota_codigo_igual.sql
- [x] 20260901300000_sincronizacao_em_lote_central.sql
- [x] 20260901200000_acessorios_na_tela_inicial.sql
- [x] 20260901100000_sincronizacao_central_acessorios_acabamentos.sql
- [x] 20260831800000_sincronizar_foto_sem_nova_revisao.sql
- [x] 20260831900000_foto_desenho_acessorio.sql
- [x] 20260831700000_priorizar_foto_na_busca_visual.sql
- [x] 20260831600000_embedding_na_sincronizacao_central.sql
- [x] 20260831500000_atalho_linhas_e_sistemas.sql
- [x] 20260831400000_cards_tela_inicial_configuraveis.sql
- [x] 20260831300000_personalizar_tela_inicial.sql
- [x] 20260831200000_status_embedding_perfil.sql
- [x] 20260831100000_busca_visual_por_foto.sql

- [x] 20260815120000_fundacao.sql
- [x] 20260815120100_cadastros.sql
- [x] 20260815120200_estoque.sql
- [x] 20260815120300_configuracoes_auditoria.sql
- [x] 20260815120400_rls.sql
- [x] 20260815120500_funcoes_estoque.sql
- [x] 20260815130000_padroes_cadastro.sql
- [x] 20260815160000_armazenamento_imagens.sql
- [x] 20260815180000_limite_comprimento_barra.sql
- [x] 20260815190000_fotos_do_perfil.sql
- [x] 20260816100000_aplicacao_do_perfil.sql
- [x] 20260817200000_dimensoes_da_secao.sql
- [x] 20260817220000_medidas_extras_da_secao.sql
- [x] 20260818100000_cargos_de_colaborador.sql
- [x] 20260818100100_colaboradores_e_permissoes.sql
- [x] 20260818110000_permissao_de_cadastros.sql
- [x] 20260818120000_acessos_ao_sistema.sql
- [x] 20260818130000_foto_e_cpf_do_colaborador.sql
- [x] 20260818140000_produtos_e_lista_tecnica.sql
- [x] 20260818150000_imagens_do_produto.sql
- [x] 20260818160000_somar_ao_lote.sql
- [x] 20260819100000_ordem_da_lista_tecnica.sql
- [x] 20260820100000_ajustar_quantidade_lote.sql
- [x] 20260820110000_apagar_modelo_perfil.sql
- [x] 20260820120000_novos_estados.sql
- [x] 20260821100000_logo_organizacao.sql
- [x] 20260821120000_reserva_dados_corte.sql
- [x] 20260822120000_novos_campos_estoque.sql
- [x] 20260822134000_perfil_revisado.sql
- [x] 20260822230000_resto_por_peca.sql
- [x] 20260823100000_zerar_estoque_organizacao.sql
- [x] 20260824100000_apelido_login.sql
- [x] 20260824200000_estoque_acessorios.sql
- [x] 20260824210000_inventario.sql
- [x] 20260825100000_logo_desenvolvedor.sql
- [x] 20260825200000_criar_empresa_self_service.sql
- [x] 20260825210000_criar_empresa_cnpj_telefone.sql
- [x] 20260825300000_excluir_propria_conta.sql
- [x] 20260825400000_confirmacao_email.sql
- [x] 20260825500000_excluir_conta_libera_email.sql
- [x] 20260825600000_reenviar_convite.sql
- [x] 20260825700000_confirmacao_envio_convite.sql
- [x] 20260825800000_serralheiro_cadastra_estoque.sql
- [x] 20260825900000_expiracao_convite.sql
- [x] 20260826100000_confirmacao_via_convite.sql
- [x] 20260826200000_catalogo_central.sql
- [x] 20260827100000_revisao_catalogo_central.sql
- [x] 20260827200000_desenho_tecnico_prevalece.sql
- [x] 20260827300000_unificar_revisao_perfil.sql
- [x] 20260827400000_reenviar_convite_mantem_id.sql
- [x] 20260827500000_evitar_duplicidade_sincronizacao.sql
- [x] 20260827600000_sincronizacao_por_linha.sql
- [x] 20260827700000_apagar_produto.sql
- [x] 20260827800000_liberacao_linha_por_empresa.sql
- [x] 20260827900000_administrar_linhas_por_empresa.sql
- [x] 20260828000000_ordem_manual_linhas.sql
- [x] 20260828100000_ordem_nas_listas_de_linha.sql
- [x] 20260828200000_corrige_ambiguidade_linhas_para_organizacao.sql
- [x] 20260828300000_ordem_linhas_global_central.sql
- [x] 20260828400000_limite_comprimento_lista_tecnica.sql
- [x] 20260828500000_descartar_acessorio.sql
- [x] 20260828600000_excluir_organizacao.sql
- [x] 20260828700000_corte_e_sentido_lista_tecnica.sql
- [x] 20260828800000_simplificar_tipos_de_corte.sql
- [x] 20260828900000_liberacao_produto_por_empresa.sql
- [x] 20260829000000_importar_produto_sem_duplicar.sql
- [x] 20260829100000_cortes_por_peca_na_mesma_linha.sql
- [x] 20260829200000_grupos_de_corte.sql
- [x] 20260829300000_textos_institucionais.sql
