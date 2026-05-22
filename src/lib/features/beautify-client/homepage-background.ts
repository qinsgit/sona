import { injector } from '@/lib/InjectorManager'
import type { BeautifyGlassConfig } from '@/lib/features/beautify-client/social-sidebar-glass'

const VIEWPORT_ROOT_SELECTOR = 'section#rcp-fe-viewport-root'
const HOMEPAGE_BACKGROUND_STYLE_ID = 'sona-homepage-background-style'

export interface HomepageBackgroundAdjustment {
  scale: number
  offsetX: number
  offsetY: number
}

function getAssetUrl(assetPath: string): string {
  return `//plugins/sona/assets/${assetPath.split('/').map(encodeURIComponent).join('/')}`
}

function escapeCssUrl(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

let currentAssetPath: string | null = null
let adjustments: Record<string, HomepageBackgroundAdjustment> = {}
let glassConfig: BeautifyGlassConfig = {
  blur: 0,
  opacity: 0,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function ensureHomepageBackgroundStyle() {
  if (!currentAssetPath) return

  const assetUrl = escapeCssUrl(getAssetUrl(currentAssetPath))
  const blur = clamp(glassConfig.blur, 0, 40)
  const opacity = clamp(glassConfig.opacity, 0, 100) / 100
  const adjustment = adjustments[currentAssetPath] ?? { scale: 1, offsetX: 0, offsetY: 0 }
  const scale = clamp(adjustment.scale, 1, 3)
  const offsetX = clamp(adjustment.offsetX, -100, 100)
  const offsetY = clamp(adjustment.offsetY, -100, 100)
  const backgroundSize = scale === 1 ? 'cover' : `${Number((scale * 100).toFixed(2))}% auto`
  const backgroundPositionX = `calc(50% + ${Number(offsetX.toFixed(2))}%)`
  const backgroundPositionY = `calc(50% + ${Number(offsetY.toFixed(2))}%)`
  let style = document.getElementById(HOMEPAGE_BACKGROUND_STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = HOMEPAGE_BACKGROUND_STYLE_ID
    document.head.appendChild(style)
  }

  style.textContent = `
    ${VIEWPORT_ROOT_SELECTOR} {
      position: relative !important;
      background-image: url("${assetUrl}") !important;
      background-size: ${backgroundSize} !important;
      background-position: ${backgroundPositionX} ${backgroundPositionY} !important;
      background-repeat: no-repeat !important;
    }

    ${VIEWPORT_ROOT_SELECTOR}::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background: rgba(1, 10, 19, ${opacity});
      backdrop-filter: blur(${blur}px);
      -webkit-backdrop-filter: blur(${blur}px);
    }
  `
}

function tryApplyHomepageBackground(): boolean {
  ensureHomepageBackgroundStyle()

  return true
}

let registered = false

export function updateBeautifyHomepageBackground(assetPath: string | null) {
  currentAssetPath = assetPath

  if (assetPath && !registered) {
    registered = true
    injector.register(tryApplyHomepageBackground)
    tryApplyHomepageBackground()
  } else if (assetPath && registered) {
    tryApplyHomepageBackground()
  } else if (!assetPath && registered) {
    registered = false
    injector.unregister(tryApplyHomepageBackground)
    document.getElementById(HOMEPAGE_BACKGROUND_STYLE_ID)?.remove()
  } else if (!assetPath) {
    document.getElementById(HOMEPAGE_BACKGROUND_STYLE_ID)?.remove()
  }
}

export function updateBeautifyHomepageBackgroundGlassConfig(config: BeautifyGlassConfig) {
  glassConfig = config
  if (registered) {
    ensureHomepageBackgroundStyle()
  }
}

export function updateBeautifyHomepageBackgroundAdjustments(nextAdjustments: Record<string, HomepageBackgroundAdjustment>) {
  adjustments = nextAdjustments
  if (registered) {
    ensureHomepageBackgroundStyle()
  }
}
