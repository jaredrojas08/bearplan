<script lang="ts">
  let { name, size = 16, stroke = 1.8 }: { name: string; size?: number; stroke?: number } = $props()

  // Path data from the design mockups, all on a 24px grid.
  const PATHS: Record<string, string[]> = {
    home: ['M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
    calendar: ['M3 10h18M8 3v4M16 3v4', 'M6 5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z'],
    book: ['M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z'],
    grid: ['M6 4h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 4h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M6 14h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z', 'M16 14h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z'],
    moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
    sun: ['M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
    settings: ['M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z', 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1'],
    cap: ['M2 9l10-5 10 5-10 5z', 'M6 11v5c3 2 9 2 12 0v-5'],
    pen: ['M4 20l4-1 11-11-3-3L5 16z'],
    flask: ['M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3'],
    sigma: ['M18 5H6l6 7-6 7h12'],
    code: ['M8 7l-5 5 5 5M16 7l5 5-5 5'],
    star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'],
    run: ['M14 2a2 2 0 1 0 0 4a2 2 0 1 0 0-4z', 'M6 21l4-6 3 2 1 4M8 11l3-3 4 2 3 3'],
    plus: ['M12 5v14M5 12h14'],
    search: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'M20 20l-3.5-3.5'],
    check: ['M5 12l5 5L20 7'],
    close: ['M6 6l12 12M18 6L6 18'],
    upload: ['M12 16V4M7 9l5-5 5 5M4 20h16'],
    download: ['M12 4v12M7 11l5 5 5-5M4 20h16'],
  }
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each PATHS[name] ?? [] as d (d)}
    <path {d} />
  {/each}
</svg>
