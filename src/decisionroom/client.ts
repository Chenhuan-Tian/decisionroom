import { getAuthToken } from 'deepspace'
export async function action<T = Record<string, unknown>>(name: string, params: Record<string, unknown>): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in to continue.')
  const response = await fetch(`/api/actions/${name}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(params), signal: AbortSignal.timeout(110000) })
  let result: { success?: boolean; data?: T; error?: string }
  try { result = await response.json() } catch { throw new Error('The server returned an unexpected response. Please retry.') }
  if (!response.ok || !result.success) throw new Error(result.error || 'The request failed. Please retry.')
  return result.data as T
}
export function download(name: string, text: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
