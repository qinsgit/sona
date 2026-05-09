declare const __PLUGIN_VERSION__: string

import { logger } from '@/index'

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  releaseName: string
  releaseUrl: string
  releaseBody: string
  publishedAt: string
}

interface GithubReleaseResponse {
  tag_name?: string
  name?: string
  html_url?: string
  body?: string
  published_at?: string
}

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'latest' | 'error'
  info: UpdateInfo | null
  error: string
}

const RELEASE_PAGE_URL = 'https://com.hytale.net.cn/WJZ-P/sona/releases'
const RELEASE_API_URLS = [
  'https://com.hytale.net.cn/api.github.com/repos/WJZ-P/sona/releases/latest',
  'https://com.hytale.net.cn/repos/WJZ-P/sona/releases/latest',
  'https://api.github.com/repos/WJZ-P/sona/releases/latest',
]
// 调试更新页时临时填版本号；发布前保持空字符串。
const DEBUG_CURRENT_VERSION = '1.0.0'

let state: UpdateState = {
  status: 'idle',
  info: null,
  error: '',
}
let inFlight: Promise<UpdateState> | null = null
const listeners = new Set<(state: UpdateState) => void>()

function emit() {
  const snapshot = getUpdateState()
  listeners.forEach((listener) => listener(snapshot))
}

function setState(next: UpdateState) {
  state = next
  emit()
}

export function getUpdateState(): UpdateState {
  return {
    ...state,
    info: state.info ? { ...state.info } : null,
  }
}

export function onUpdateStateChange(listener: (state: UpdateState) => void): () => void {
  listeners.add(listener)
  listener(getUpdateState())
  return () => listeners.delete(listener)
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '')
}

function compareVersion(a: string, b: string): number {
  const left = normalizeVersion(a).split(/[.-]/)
  const right = normalizeVersion(b).split(/[.-]/)
  const length = Math.max(left.length, right.length)

  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.parseInt(left[index] ?? '0', 10)
    const rightPart = Number.parseInt(right[index] ?? '0', 10)
    const leftNumber = Number.isFinite(leftPart) ? leftPart : 0
    const rightNumber = Number.isFinite(rightPart) ? rightPart : 0
    if (leftNumber !== rightNumber) return leftNumber - rightNumber
  }

  return 0
}

async function fetchLatestRelease(): Promise<GithubReleaseResponse> {
  const errors: string[] = []

  for (const url of RELEASE_API_URLS) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          Accept: 'application/vnd.github+json, application/json',
        },
      })
      const text = await response.text()

      if (!response.ok) {
        errors.push(`${url} -> ${response.status} ${response.statusText}`)
        continue
      }

      const data = JSON.parse(text) as GithubReleaseResponse
      if (!data.tag_name) {
        errors.push(`${url} -> missing tag_name`)
        continue
      }

      return data
    } catch (err) {
      errors.push(`${url} -> ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  throw new Error(errors.join(' | ') || 'no release api response')
}

export function getReleasePageUrl(): string {
  return RELEASE_PAGE_URL
}

export function checkForUpdates(): Promise<UpdateState> {
  if (inFlight) return inFlight

  setState({ status: 'checking', info: null, error: '' })

  inFlight = fetchLatestRelease()
    .then((release) => {
      const currentVersion = normalizeVersion(DEBUG_CURRENT_VERSION || __PLUGIN_VERSION__)
      const latestVersion = normalizeVersion(release.tag_name ?? '')
      if (!latestVersion || compareVersion(latestVersion, currentVersion) <= 0) {
        const next: UpdateState = { status: 'latest', info: null, error: '' }
        setState(next)
        return next
      }

      const next: UpdateState = {
        status: 'available',
        error: '',
        info: {
          currentVersion,
          latestVersion,
          releaseName: release.name || `Sona v${latestVersion}`,
          releaseUrl: release.html_url || RELEASE_PAGE_URL,
          releaseBody: release.body || '该版本没有填写更新说明。',
          publishedAt: release.published_at || '',
        },
      }
      setState(next)
      logger.info('[Update] 检测到新版本: %s -> %s', currentVersion, latestVersion)
      return next
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      const next: UpdateState = { status: 'error', info: null, error: message }
      setState(next)
      logger.warn('[Update] 检查更新失败:', err)
      return next
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}
