const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

type RequestOptions = {
  method?: HttpMethod
  body?: unknown
  token?: string | null
}

function buildHeaders(token?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = buildHeaders(options.token)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const payload = (await response.json()) as { message?: string }
      if (payload.message) {
        message = payload.message
      }
    } catch {
      // Ignore parse errors and use fallback message.
    }
    throw new Error(message)
  }

  if (response.headers.get('Content-Type')?.includes('text/csv')) {
    return (await response.text()) as T
  }

  return (await response.json()) as T
}

export async function apiRequestBlob(path: string, options: RequestOptions = {}) {
  const headers = buildHeaders(options.token)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const payload = (await response.json()) as { message?: string }
      if (payload.message) {
        message = payload.message
      }
    } catch {
      // Ignore parse errors and use fallback message.
    }
    throw new Error(message)
  }

  return response
}
