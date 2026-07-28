import { useEffect, useState } from 'react'

/**
 * Estado comum dos cadastros: filtro, item selecionado e rascunho da ficha.
 * O rascunho é local até "Salvar" — a lista continua refletindo o banco.
 */
export function useCadastro<T extends { id: string }>(lista: T[], novo: () => T) {
  const [filtro, setFiltro] = useState('')
  const [form, setForm] = useState<T | null>(null)

  // Seleciona o primeiro registro quando não há nada escolhido.
  useEffect(() => {
    if (!form && lista.length) setForm(structuredClone(lista[0]))
  }, [lista, form])

  const selecionar = (x: T) => setForm(structuredClone(x))
  const criarNovo = () => setForm(novo())
  const alterar = (patch: Partial<T>) => setForm(f => (f ? { ...f, ...patch } : f))

  return { filtro, setFiltro, form, setForm, selecionar, criarNovo, alterar }
}

/** Gera um id textual estável para registros novos. */
export const novoId = (prefixo: string): string =>
  `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
