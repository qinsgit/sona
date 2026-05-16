import { logger } from '@/index'
import { lcu, LcuEventUri } from '@/lib/lcu'
import type { LCUEventMessage, GameflowPhase } from '@/lib/lcu'

// ==================== 对局结束自动关闭游戏 ====================

let autoCloseGameUnsub: (() => void) | null = null

function onGamePhaseChange(event: LCUEventMessage) {
  const phase = event.data as GameflowPhase
  if (phase === 'WaitingForStats' || phase === 'EndOfGame') {
    logger.info('[AutoCloseGame] 对局结束，关闭游戏...')
    lcu.earlyExitGame().catch((err) => {
      logger.error('[AutoCloseGame] 关闭游戏失败:', err)
    })
  }
}

export function updateAutoCloseGame(enabled: boolean) {
  if (enabled && !autoCloseGameUnsub) {
    autoCloseGameUnsub = lcu.observe(LcuEventUri.GAMEFLOW_PHASE_CHANGE, onGamePhaseChange)
    logger.info('Auto close game enabled ✓')
  } else if (!enabled && autoCloseGameUnsub) {
    autoCloseGameUnsub()
    autoCloseGameUnsub = null
    logger.info('Auto close game disabled')
  }
}
