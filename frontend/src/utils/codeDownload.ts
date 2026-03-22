const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
  python: 'py',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
  javascript: 'js',
}

function getFileExtension(language: string) {
  return LANGUAGE_EXTENSION_MAP[String(language || '').toLowerCase()] || 'txt'
}

function toSafeBaseName(input: string) {
  const normalized = String(input || '').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
  return normalized || 'submission'
}

export function downloadSubmissionCode(questionTitle: string, language: string, code: string) {
  const extension = getFileExtension(language)
  const filename = `${toSafeBaseName(questionTitle)}.${extension}`
  const blob = new Blob([String(code || '')], { type: 'text/plain;charset=utf-8' })
  const fileUrl = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = fileUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  URL.revokeObjectURL(fileUrl)
}