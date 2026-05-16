import { store } from '@/lib/store'
import { lcu, LcuEventUri } from '@/lib/lcu'
import type { LCUEventMessage, Lobby } from '@/lib/lcu'
import { logger } from '@/index'
import { sleep } from '@/lib/utils'

// ==================== 点击PLAY自动对应目标对局 ====================

let autoTargetQueueUnsub: (() => void) | null = null
/** 防止循环替换：记录上一次我们自己创建的 lobby queueId */
let pendingTargetQueueId: number | null = null

function onLobbyUpdate(event: LCUEventMessage) {
  // 只处理 Create 或 Update
  if (event.eventType !== 'Create' && event.eventType !== 'Update') return

  const lobby = event.data as Lobby
  if (!lobby?.gameConfig?.queueId) return

  const currentQueueId = lobby.gameConfig.queueId
  const targetQueueId = store.get('targetQueueId') || 430

  // 如果当前就是我们创建的目标队列，跳过
  if (pendingTargetQueueId === currentQueueId) {
    pendingTargetQueueId = null
    return
  }

  // 已经是目标队列，不需要切换
  if (currentQueueId === targetQueueId) return

  logger.info('[AutoTargetQueue] 检测到 lobby 创建，队列 %d → 目标 %d，正在切换...', currentQueueId, targetQueueId)

  // 记住目标队列，避免循环
  pendingTargetQueueId = targetQueueId

  // 离开当前 lobby 并重建目标队列
  replaceLobby(targetQueueId)
}

async function replaceLobby(targetQueueId: number) {
  try {
    await lcu.leaveLobby()
    // 等 lobby 完全清理
    await sleep(300)
    await lcu.createLobby(targetQueueId)
    logger.info('[AutoTargetQueue] 已切换到目标队列 %d ✓', targetQueueId)
  } catch {
    logger.warn('[AutoTargetQueue] 切换队列失败，将在下次 lobby 变化时重试')
    pendingTargetQueueId = null
  }
}

export function updateAutoTargetQueue(enabled: boolean) {
  if (enabled && !autoTargetQueueUnsub) {
    autoTargetQueueUnsub = lcu.observe(LcuEventUri.LOBBY, onLobbyUpdate)
    logger.info('Auto target queue enabled ✓')
  } else if (!enabled && autoTargetQueueUnsub) {
    autoTargetQueueUnsub()
    autoTargetQueueUnsub = null
    pendingTargetQueueId = null
    logger.info('Auto target queue disabled')
  }
}
