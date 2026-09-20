/** Rowspan-aware hover bands for mdcss auto-zebra tables.
 *
 * The bridge stripes `table.mdcss-auto` by "bands": a rowspan merge forces
 * every row it covers into one stripe, so merged cells show a single color
 * across their span. That band layout only exists in the generator's
 * union-find, so this module recomputes it on the live DOM (same algorithm
 * as postparser_zebra) and stamps `data-tbl-band` on each body row. The
 * delegated hover handlers then highlight the whole band — hovering a row
 * lights up the rows its merged cells span, matching the stripe grouping. */

export function applyTableBands(host: HTMLElement): void {
    for (const table of host.querySelectorAll<HTMLTableElement>('table.mdcss-auto')) {
        const rows = table.tBodies[0] ? [...table.tBodies[0]!.rows] : [];
        if (rows.length === 0)
            continue;
        const parent = rows.map((_, index) => index);
        const find = (x: number): number => {
            while (parent[x] !== x) {
                parent[x] = parent[parent[x]];
                x = parent[x];
            }
            return x;
        };
        rows.forEach((row, index) => {
            for (const cell of row.cells) {
                for (let k = index + 1; k <= Math.min(index + cell.rowSpan - 1, rows.length - 1); k++) {
                    const ra = find(index);
                    const rb = find(k);
                    if (ra === rb)
                        continue;
                    if (ra < rb)
                        parent[rb] = ra;
                    else
                        parent[ra] = rb;
                }
            }
        });
        const bandIds = new Map<number, number>();
        rows.forEach((row, index) => {
            const root = find(index);
            let band = bandIds.get(root);
            if (band === undefined) {
                band = bandIds.size;
                bandIds.set(root, band);
            }
            row.dataset.tblBand = String(band);
        });
    }
}

type BandHoverEvent = { target: EventTarget | null; relatedTarget: EventTarget | null };

export function onTableBandOver(event: BandHoverEvent): void {
    const row = (event.target as HTMLElement | null)?.closest?.<HTMLTableRowElement>('table.mdcss-auto tbody tr[data-tbl-band]');
    if (!row)
        return;
    for (const marked of document.querySelectorAll('.tbl-band-hover'))
        marked.classList.remove('tbl-band-hover');
    const table = row.closest('table');
    const band = row.dataset.tblBand;
    if (!table || band === undefined)
        return;
    for (const tr of table.querySelectorAll<HTMLTableRowElement>(`tbody tr[data-tbl-band="${band}"]`))
        tr.classList.add('tbl-band-hover');
}

export function onTableBandOut(event: BandHoverEvent): void {
    const related = event.relatedTarget as HTMLElement | null;
    if (related?.closest?.('table.mdcss-auto tbody'))
        return;
    for (const marked of document.querySelectorAll('.tbl-band-hover'))
        marked.classList.remove('tbl-band-hover');
}
