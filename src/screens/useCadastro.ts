import { useEffect, useState, useRef, type SetStateAction } from 'react'
import { useApp } from '../store'
import { usePendenciaAtualizacao } from '../atualizacao'
import { guardarLocal, lerLocal } from '../rascunhos'

/** Um rascunho por registro e usuário; navegar nunca descarta trabalho pendente. */
export function useCadastro<T extends { id: string }>(lista: T[], novo: () => T) {
  const app = useApp()
  const chave = `estrudena:fichas:${app.user.id}:${app.tela}`
  const [filtro, setFiltro] = useState('')
  const [rascunhos, setRascunhos] = useState<Record<string, T>>(() => lerLocal(chave, {}))
  const [form, setFormState] = useState<T | null>(() => lista.find(x => x.id === app.registroId) ?? null)
  const formRef = useRef(form); formRef.current = form
  const draftsRef = useRef(rascunhos); draftsRef.current = rascunhos
  const [protegido, setProtegido] = useState(true)
  const salvo = form ? lista.find(x => x.id === form.id) : null
  const igual = (a: unknown, b: unknown) => JSON.stringify(a, (k, v) => k === 'atualizadoEm' ? undefined : v) === JSON.stringify(b, (k, v) => k === 'atualizadoEm' ? undefined : v)
  const pendente = !!form && !igual(form, salvo)
  usePendenciaAtualizacao('cadastro com alterações não salvas',pendente)
  useEffect(() => { if (form && salvo && !pendente && JSON.stringify(form) !== JSON.stringify(salvo)) setFormState(structuredClone(salvo)) }, [salvo, pendente])
  useEffect(() => {
    if (!form && lista.length) setFormState(structuredClone(lista[0]))
  }, [lista, form])
  useEffect(() => {
    const alvo = lista.find(x => x.id === app.registroId)
    if (alvo) setFormState(structuredClone(alvo))
  }, [app.registroId])
  const setForm = (acao: SetStateAction<T | null>) => {
    const atual = formRef.current
    const valor = typeof acao === 'function' ? acao(atual) : acao
    const prox = { ...draftsRef.current }
    if (valor) prox[valor.id] = valor
    else if (atual) delete prox[atual.id]
    draftsRef.current = prox; setRascunhos(prox); setProtegido(guardarLocal(chave, prox))
    formRef.current = valor; setFormState(valor)
  }
  const selecionar = (x: T) => { formRef.current = structuredClone(x); setFormState(formRef.current) }
  const criarNovo = () => setForm(novo())
  const alterar = (patch: Partial<T>) => setForm(f => f ? { ...f, ...patch } : f)
  const descartar = () => {
    if (!form) return
    setRascunhos(ant => { const prox = { ...ant }; delete prox[form.id]; guardarLocal(chave, prox); return prox })
    setFormState(salvo ? structuredClone(salvo) : null)
  }
  const duplicar = () => { if (form) { const base = novo(); const copia = { ...structuredClone(form), id: base.id } as T & { cod?: string; nome?: string; cnpj?: string }; if (copia.cod) copia.cod += '-COPIA'; if (copia.nome) copia.nome += ' (cópia)'; if (copia.cnpj) copia.cnpj = ''; setForm(copia) } }
  const recuperaveis = Object.values(rascunhos).filter(x => !igual(x, lista.find(y => y.id === x.id)))
  const erros: string[] = []
  if (form) {
    const f = form as T & Record<string, any>
    if ('cod' in f && !String(f.cod).trim()) erros.push('Informe o código.')
    if ('nome' in f && !String(f.nome).trim()) erros.push('Informe o nome.')
    if ('desc' in f && !String(f.desc).trim()) erros.push('Informe a descrição.')
    if (f.cod && lista.some(x => x.id !== f.id && (x as any).cod?.toUpperCase() === f.cod.toUpperCase())) erros.push('Este código já está cadastrado.')
    for (const [k, v] of Object.entries(f)) if (typeof v === 'number' && (!Number.isFinite(v) || v < 0)) erros.push(`O campo ${k} deve ser um número maior ou igual a zero.`)
    if (f.markup >= 98) erros.push('Markup deve ser menor que 98%.')
    if (Array.isArray(f.itens) && (!f.itens.length || f.itens.some((x: any) => !(x.qtd > 0)))) erros.push('Inclua itens com quantidades maiores que zero.')
    if (f.aces?.some((x: any) => !(x.qtd > 0))) erros.push('As quantidades dos acessórios devem ser maiores que zero.')
    if (f.composicao?.some((x: any) => !(x.qtd > 0))) erros.push('O consumo de cada matéria-prima deve ser maior que zero.')
  }
  const validar = () => { if (erros.length) { app.say(erros.join(' ')); return false }; return true }
  return { erros, validar, filtro, setFiltro, form, setForm, selecionar, criarNovo, alterar, pendente, protegido, descartar, duplicar,
    recuperaveis, recuperar: (id: string) => setFormState(structuredClone(rascunhos[id])) }
}
export const novoId = (prefixo: string): string => `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
