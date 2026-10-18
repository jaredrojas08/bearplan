<script lang="ts">
  import type { Status } from '../types'

  let { counts, height = 12 }: { counts: Record<Status | 'empty', number>; height?: number } = $props()

  let total = $derived(counts.done + counts.prog + counts.plan + counts.empty)
  let label = $derived(
    `${counts.done} completed, ${counts.prog} in progress, ${counts.plan} planned, ${counts.empty} empty of ${total}`,
  )
  const pct = (n: number) => `${(100 * n) / (total || 1)}%`
</script>

<div class="bar" role="img" aria-label={label} style:height="{height}px">
  <span style:width={pct(counts.done)} style:background="var(--done)"></span>
  <span style:width={pct(counts.prog)} style:background="var(--prog)"></span>
  <span style:width={pct(counts.plan)} style:background="var(--plan)"></span>
</div>
