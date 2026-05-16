import { logger } from '@/index'

// ==================== 一键卸下勋章 ====================

async function removeAllRegalia() {
  try {
    const payload = {
      bannerAccent: '',
      title: '',
      challengeIds: [],
      crestType: '',
      selectedChallenges: [],
      challengeCrystalLevels: {},
    }

    const res = await fetch('/lol-challenges/v1/update-player-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      logger.info('[RemoveRegalia] 勋章已卸下 ✓')
    } else {
      logger.warn('[RemoveRegalia] 卸下失败: %d %s', res.status, await res.text())
    }
  } catch (err) {
    logger.error('[RemoveRegalia] 异常:', err)
  }
}

let removeRegaliaUnsub: (() => void) | null = null

export function updateRemoveRegalia(enabled: boolean) {
  if (enabled && !removeRegaliaUnsub) {
    removeAllRegalia()
    removeRegaliaUnsub = () => {}
    logger.info('Remove regalia done ✓')
  } else if (!enabled && removeRegaliaUnsub) {
    removeRegaliaUnsub()
    removeRegaliaUnsub = null
  }
}
