import { logger } from '@/index'
import { injector } from '@/lib/InjectorManager'
import { store } from '@/lib/store'

const FRIEND_AVATAR_SELECTOR = 'lol-uikit-radial-progress img.icon-image'
const REGALIA_AVATAR_SELECTOR = [
  'lol-regalia-crest-v2-element.regalia-parties-v2-crest-element',
  'lol-regalia-crest-v2-element.regalia-profile-crest-element',
].join(',')
const PROFILE_ICON_ATTR = 'profile-icon-url'

let customAvatarRegistered = false
let customAvatarObserver: MutationObserver | null = null
let customAvatarRaf = 0

const patchedFriendImages = new Set<HTMLImageElement>()
const patchedRegaliaElements = new Set<Element>()
const originalFriendImageSrc = new WeakMap<HTMLImageElement, string | null>()
const originalRegaliaProfileIconUrl = new WeakMap<Element, string | null>()

function getAssetUrl(assetPath: string): string {
  return `//plugins/sona/assets/${assetPath.split('/').map(encodeURIComponent).join('/')}`
}

function getCurrentAvatarUrl(): string {
  const [assetPath] = store.get('customAvatarAssetPaths')
  return assetPath ? getAssetUrl(assetPath) : ''
}

function patchFriendAvatar(image: HTMLImageElement, avatarUrl: string): boolean {
  if (!originalFriendImageSrc.has(image)) {
    originalFriendImageSrc.set(image, image.getAttribute('src'))
  }

  if (image.getAttribute('src') === avatarUrl) return false

  image.setAttribute('src', avatarUrl)
  patchedFriendImages.add(image)
  return true
}

function patchRegaliaAvatar(element: Element, avatarUrl: string): boolean {
  if (!originalRegaliaProfileIconUrl.has(element)) {
    originalRegaliaProfileIconUrl.set(element, element.getAttribute(PROFILE_ICON_ATTR))
  }

  if (element.getAttribute(PROFILE_ICON_ATTR) === avatarUrl) return false

  element.setAttribute(PROFILE_ICON_ATTR, avatarUrl)
  ;(element as unknown as { profileIconUrl?: string }).profileIconUrl = avatarUrl
  patchedRegaliaElements.add(element)
  return true
}

function applyCustomAvatar(): boolean {
  const avatarUrl = getCurrentAvatarUrl()
  if (!avatarUrl) return false

  let changed = false

  document.querySelectorAll<HTMLImageElement>(FRIEND_AVATAR_SELECTOR).forEach((image) => {
    changed = patchFriendAvatar(image, avatarUrl) || changed
  })

  document.querySelectorAll(REGALIA_AVATAR_SELECTOR).forEach((element) => {
    changed = patchRegaliaAvatar(element, avatarUrl) || changed
  })

  return changed || patchedFriendImages.size > 0 || patchedRegaliaElements.size > 0
}

function scheduleApplyCustomAvatar() {
  if (customAvatarRaf) return

  customAvatarRaf = requestAnimationFrame(() => {
    customAvatarRaf = 0
    applyCustomAvatar()
  })
}

function startCustomAvatarObserver() {
  if (customAvatarObserver) return

  customAvatarObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.attributeName === 'src' || mutation.attributeName === PROFILE_ICON_ATTR) {
        scheduleApplyCustomAvatar()
        return
      }
    }
  })

  customAvatarObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', PROFILE_ICON_ATTR],
  })
}

function restorePatchedAvatars() {
  patchedFriendImages.forEach((image) => {
    const original = originalFriendImageSrc.get(image)
    if (original == null) image.removeAttribute('src')
    else image.setAttribute('src', original)
  })
  patchedFriendImages.clear()

  patchedRegaliaElements.forEach((element) => {
    const original = originalRegaliaProfileIconUrl.get(element)
    if (original == null) element.removeAttribute(PROFILE_ICON_ATTR)
    else element.setAttribute(PROFILE_ICON_ATTR, original)
    ;(element as unknown as { profileIconUrl?: string }).profileIconUrl = original ?? ''
  })
  patchedRegaliaElements.clear()
}

function enableCustomAvatar() {
  if (!customAvatarRegistered) {
    injector.register(applyCustomAvatar)
    customAvatarRegistered = true
  }

  startCustomAvatarObserver()
  applyCustomAvatar()
}

function disableCustomAvatar() {
  if (customAvatarRegistered) {
    injector.unregister(applyCustomAvatar)
    customAvatarRegistered = false
  }

  if (customAvatarObserver) {
    customAvatarObserver.disconnect()
    customAvatarObserver = null
  }

  if (customAvatarRaf) {
    cancelAnimationFrame(customAvatarRaf)
    customAvatarRaf = 0
  }

  restorePatchedAvatars()
}

export function updateBeautifyCustomAvatar() {
  if (getCurrentAvatarUrl()) {
    enableCustomAvatar()
    logger.info('[BeautifyAvatar] 自定义头像已启用')
  } else {
    disableCustomAvatar()
    logger.info('[BeautifyAvatar] 自定义头像已禁用')
  }
}
