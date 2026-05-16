import { logger } from '@/index'
import { sleep } from '@/lib/utils'

// ==================== 自动领取战利品 ====================

interface PlayerLootItem {
  lootId: string
  count: number
  type: string
  localizedName: string
  localizedDescription: string
}

interface LootRecipe {
  recipeName: string
  slots: Array<{ lootIds: string[]; quantity: number }>
  outputs: Array<{ lootId: string; quantity: number }>
  description: string
}

async function claimAllLoot() {
  try {
    const lootRes = await fetch('/lol-loot/v1/player-loot')
    if (!lootRes.ok) {
      logger.warn('[AutoClaimLoot] 获取战利品列表失败')
      return
    }
    const lootItems = (await lootRes.json()) as PlayerLootItem[]

    const materials = lootItems.filter((item) => item.type === 'MATERIAL' && item.count > 0)
    if (materials.length === 0) {
      logger.info('[AutoClaimLoot] 没有可领取的战利品')
      return
    }

    logger.info('[AutoClaimLoot] 发现 %d 种材料，开始领取...', materials.length)
    let claimed = 0

    for (const mat of materials) {
      try {
        const recipeRes = await fetch(`/lol-loot/v1/recipes/initial-item/${mat.lootId}`)
        if (!recipeRes.ok) continue
        const recipes = (await recipeRes.json()) as LootRecipe[]

        for (const recipe of recipes) {
          const hasExternalSlot = recipe.slots.some(
            (slot) => !slot.lootIds.some((lid) => lid === mat.lootId)
          )
          if (hasExternalSlot) continue

          for (let i = 0; i < mat.count; i++) {
            const craftRes = await fetch(`/lol-loot/v1/recipes/${recipe.recipeName}/craft`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify([mat.lootId]),
            })
            if (craftRes.ok) {
              claimed++
              logger.info('[AutoClaimLoot] 已领取: %s → %s', mat.localizedName, recipe.description)
            }
            await sleep(500)
          }
        }
      } catch {
        // ignore
      }
    }

    logger.info('[AutoClaimLoot] 领取完成，共 %d 次', claimed)
  } catch (err) {
    logger.error('[AutoClaimLoot] 异常:', err)
  }
}

let autoClaimLootUnsub: (() => void) | null = null

export function updateAutoClaimLoot(enabled: boolean) {
  if (enabled && !autoClaimLootUnsub) {
    claimAllLoot()
    autoClaimLootUnsub = () => {}
    logger.info('Auto claim loot done ✓')
  } else if (!enabled && autoClaimLootUnsub) {
    autoClaimLootUnsub()
    autoClaimLootUnsub = null
  }
}
