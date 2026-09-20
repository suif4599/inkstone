import { describe, expect, it } from 'vitest';
import { applyTableBands } from './table-bands';

function rows(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLTableRowElement>('tbody tr')].map((tr) => tr.dataset.tblBand);
}

describe('applyTableBands', () => {
  it('marks rowspan-merged rows as one band', () => {
    const host = document.createElement('div');
    host.innerHTML = `<table class="mdcss-auto"><tbody>
      <tr><td>A1</td><td>B1</td></tr>
      <tr><td rowspan="2">A2</td><td>B2</td></tr>
      <tr><td>B3</td></tr>
      <tr><td>A4</td><td>B4</td></tr>
    </tbody></table>`;
    applyTableBands(host);
    expect(rows(host)).toEqual(['0', '1', '1', '2']);
  });

  it('propagates staggered merges transitively', () => {
    const host = document.createElement('div');
    host.innerHTML = `<table class="mdcss-auto"><tbody>
      <tr><td rowspan="2">a</td><td rowspan="3">b</td><td>c</td></tr>
      <tr><td rowspan="2">d</td></tr>
      <tr><td>e</td></tr>
    </tbody></table>`;
    applyTableBands(host);
    expect(rows(host)).toEqual(['0', '0', '0']);
  });

  it('ignores tables outside auto mode', () => {
    const host = document.createElement('div');
    host.innerHTML = `<table class="mdcss-zebra"><tbody><tr><td>a</td></tr></tbody></table>`;
    applyTableBands(host);
    expect(rows(host)).toEqual([undefined]);
  });
});
