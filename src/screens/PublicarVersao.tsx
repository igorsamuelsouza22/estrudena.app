import { useCallback, useEffect, useState } from 'react'
import { chamar, ponte } from '../api'
import { useApp } from '../store'
import { Campo, Card, InputFicha, muted45, muted50 } from '../ui'
import type { EstadoAtualizacao, VersaoPublicada } from '../shared/types'

const mb = (bytes: number): string => (bytes / 1024 / 1024).toFixed(1) + ' MB'

const quando = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}

/**
 * Publica uma nova versão do sistema para toda a rede.
 *
 * O instalador é guardado no banco do servidor; a partir daí cada terminal
 * percebe a versão nova sozinho e se atualiza. Não há hospedagem, pasta
 * compartilhada nem internet envolvidos.
 */
export function PublicarVersao() {
  const app = useApp()
  const [estado, setEstado] = useState<EstadoAtualizacao | null>(null)
  const [historico, setHistorico] = useState<VersaoPublicada[]>([])
  const [versao, setVersao] = useState('')
  const [notas, setNotas] = useState('')
  const [repo, setRepo] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      const e = await chamar(ponte().estadoAtualizacao())
      setEstado(e)
      setVersao(v => v || e.versaoLocal)
      setRepo(e.repo)
      setHistorico(await chamar(ponte().historicoVersoes()))
    } catch (e) {
      app.say(e instanceof Error ? e.message : 'Não consegui ler as versões.')
    }
  }, [app])

  const salvarRepo = async () => {
    try {
      const salvo = await chamar(ponte().definirRepo(repo))
      setRepo(salvo)
      app.say(salvo ? `Atualizações também virão de ${salvo}` : 'Atualização só pelo servidor')
      if (salvo) {
        setDiagnostico('Conferindo o repositório…')
        setDiagnostico(await chamar(ponte().testarRepo(salvo)))
      } else {
        setDiagnostico('')
      }
      await recarregar()
    } catch (e) {
      app.say(e instanceof Error ? e.message : 'Não consegui salvar o repositório.')
    }
  }

  const conferirRepo = async () => {
    if (!repo.trim()) return
    setDiagnostico('Conferindo o repositório…')
    try {
      setDiagnostico(await chamar(ponte().testarRepo(repo)))
    } catch (e) {
      setDiagnostico(e instanceof Error ? e.message : 'Não consegui conferir.')
    }
  }

  useEffect(() => { void recarregar() }, [recarregar])

  const publicar = async () => {
    setOcupado(true)
    try {
      const r = await chamar(ponte().publicarVersao(versao.trim(), notas.trim(), app.user.nome))
      if (!r) { app.say('Publicação cancelada'); return }
      app.say(`Versão ${r.versao} publicada (${mb(r.tamanho)})`)
      setNotas('')
      await recarregar()
    } catch (e) {
      app.say(e instanceof Error ? e.message : 'Não consegui publicar.')
    } finally {
      setOcupado(false)
    }
  }

  const publicada = estado?.disponivel
  const local = estado?.versaoLocal ?? '—'

  return (
    <div style={{ gridColumn: '1/-1' }}>
      <Card
        titulo="Atualização do sistema"
        direita={<span style={{ fontSize: 12, color: muted45 }}>esta máquina está na versão {local}</span>}
      >
        <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '11px 13px' }}>
          <div style={{ gridColumn: '1/-1', fontSize: 13, color: muted50, lineHeight: 1.5 }}>
            Há dois caminhos, e os terminais usam sempre a versão mais nova entre eles.
            Pelo <strong>GitHub</strong>, quem desenvolve publica a release e os terminais
            com internet percebem sozinhos. Pelo <strong>servidor</strong>, o instalador
            fica guardado no banco e funciona sem internet nenhuma.
          </div>

          <Campo
            label="Repositório no GitHub (opcional)" span={2}
            nota={
              repo
                ? `Os terminais consultam github.com/${repo}. Precisa ser público.`
                : 'Deixe em branco para usar só o servidor. Ex.: usuario/sistema-estrudena'
            }
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <InputFicha valor={repo} onChange={setRepo} placeholder="usuario/repositorio" />
              <button
                className="btn btn-secondary" style={{ minHeight: 28, padding: '2px 10px', fontSize: 13 }}
                onClick={() => void salvarRepo()}
              >salvar</button>
              <button
                className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 10px', fontSize: 13 }}
                onClick={() => void conferirRepo()}
              >conferir</button>
            </div>
          </Campo>
          <div style={{ gridColumn: 'span 2', alignSelf: 'end', fontSize: 12, lineHeight: 1.45, paddingBottom: 6 }}>
            {diagnostico
              ? <span style={{ color: diagnostico.startsWith('Tudo certo') ? 'var(--color-accent-700)' : 'var(--color-accent-800)' }}>
                  {diagnostico}
                </span>
              : <span style={{ color: muted45 }}>
                  A release precisa ter a etiqueta no formato <code>v1.2.3</code> e o
                  instalador <code>.exe</code> anexado. Use <strong>conferir</strong> para
                  testar antes.
                </span>}
          </div>

          <Campo label="Versão a publicar" nota="No formato 1.2.3, igual ao nome do instalador.">
            <InputFicha valor={versao} onChange={setVersao} placeholder="1.1.0" />
          </Campo>
          <Campo label="O que mudou (aparece no aviso)" span={3}>
            <InputFicha valor={notas} onChange={setNotas} placeholder="ex.: correção do PDF e novo fluxo de proposta" />
          </Campo>

          <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, fontSize: 13, color: muted50 }}>
              {publicada
                ? `Versão disponível para os terminais: ${publicada.versao} (${mb(publicada.tamanho)}, ${
                    publicada.origem === 'github' ? 'via GitHub' : `no servidor, por ${publicada.publicadoPor || '—'}`
                  }).`
                : 'Nenhuma versão disponível ainda.'}
            </span>
            <button
              className="btn btn-primary" style={{ minHeight: 30, padding: '4px 14px', fontSize: 13 }}
              disabled={ocupado}
              onClick={() => void publicar()}
            >{ocupado ? 'Publicando…' : 'Escolher instalador e publicar'}</button>
          </div>

          {!!historico.length && (
            <div style={{ gridColumn: '1/-1' }}>
              <table className="table" style={{ fontSize: 13 }}>
                <thead><tr>
                  <th>Versão</th><th>Publicada em</th><th>Por</th><th>Arquivo</th>
                  <th style={{ textAlign: 'right' }}>Tamanho</th><th style={{ width: 26 }} />
                </tr></thead>
                <tbody>
                  {historico.map(v => (
                    <tr key={v.versao}>
                      <td style={{ fontFamily: 'var(--font-heading)', fontSize: 14 }}>
                        {v.versao}
                        {v.versao === local && (
                          <span style={{ fontSize: 11, color: muted45, paddingLeft: 6 }}>(esta máquina)</span>
                        )}
                      </td>
                      <td className="tnum" style={{ whiteSpace: 'nowrap' }}>{quando(v.publicadoEm)}</td>
                      <td>{v.publicadoPor || '—'}</td>
                      <td className="trunc" style={{ maxWidth: 240, fontSize: 12, color: muted50 }}>{v.arquivo}</td>
                      <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{mb(v.tamanho)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost" style={{ fontSize: 13, padding: '1px 5px' }}
                          onClick={() => void app.gravar(
                            () => chamar(ponte().removerVersao(v.versao)).then(recarregar),
                            `Versão ${v.versao} removida`
                          )}
                        >remover</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: muted45, paddingTop: 8, lineHeight: 1.5 }}>
                Os instaladores ocupam espaço no banco — remova as versões antigas que não
                forem mais necessárias.
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
