import { F1Element, define } from './base.js';
import { html } from '../core/dom.js';
import { navigate } from '../core/router.js';

function alignClass(align) {
  if (align === 'right') return 'is-right';
  if (align === 'center') return 'is-center';
  return '';
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'it', { numeric: true, sensitivity: 'base' });
}

class DataTable extends F1Element {
  constructor() {
    super();
    this._config = {};
    this._sort = null;
  }

  set config(value) {
    this._config = value || {};
    this._sort = this._config.sort ? { ...this._config.sort } : null;
    this.update();
  }

  get config() {
    return this._config;
  }

  onConnect() {
    this.listen(this, 'click', (event) => {
      const sortButton = event.target.closest('[data-sort-key]');
      if (sortButton && this.contains(sortButton)) {
        this.toggleSort(sortButton.dataset.sortKey);
        return;
      }
      const row = event.target.closest('tr[data-href]');
      if (row) navigate(row.dataset.href.replace(/^#/, ''));
    });

    this.listen(this, 'keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('button, a')) return;
      const row = event.target.closest('tr[data-href]');
      if (!row) return;
      event.preventDefault();
      navigate(row.dataset.href.replace(/^#/, ''));
    });
  }

  toggleSort(key) {
    if (!this._sort || this._sort.key !== key) {
      this._sort = { key, dir: 'asc' };
    } else if (this._sort.dir === 'asc') {
      this._sort = { key, dir: 'desc' };
    } else {
      this._sort = null;
    }
    this.update();
  }

  template() {
    const config = this._config || {};
    const columns = config.columns || [];
    const rows = [...(config.rows || [])];
    const sort = this._sort;

    if (sort) {
      const column = columns.find((item) => item.key === sort.key);
      if (column) {
        rows.sort((rowA, rowB) => {
          const valueA = column.sortValue ? column.sortValue(rowA) : rowA[column.key];
          const valueB = column.sortValue ? column.sortValue(rowB) : rowB[column.key];
          return compareValues(valueA, valueB) * (sort.dir === 'asc' ? 1 : -1);
        });
      }
    }

    const body = rows.length
      ? html`<tbody>
          ${rows.map((row, rowIndex) => {
            const cellHtml = columns.map((column) => {
              const content = column.render ? column.render(row, rowIndex) : row[column.key];
              const cellClass = [
                alignClass(column.align),
                column.className || '',
                column.hideSm ? 'hide-sm' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return html`<td class="${cellClass}" ${column.label ? html`data-label="${column.label}"` : ''}>${content}</td>`;
            });
            const rowClass = [config.rowClass ? config.rowClass(row) : '', config.highlightRow?.(row) ? 'is-highlight' : '']
              .filter(Boolean)
              .join(' ');
            const href = config.rowHref ? config.rowHref(row) : '';
            return html`<tr
              class="${rowClass}"
              ${href ? html`data-href="${href}" tabindex="0"` : null}
            >${cellHtml}</tr>`;
          })}
        </tbody>`
      : null;

    const head = html`<thead><tr>
      ${columns.map((column) => {
        const isSorted = sort?.key === column.key;
        const ariaSort = isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
        const classes = [alignClass(column.align), column.hideSm ? 'hide-sm' : ''].filter(Boolean).join(' ');
        const style = column.width ? `width:${column.width};` : '';
        return html`<th class="${classes}" style="${style}" aria-sort="${ariaSort}" scope="col">
          ${column.sortable
            ? html`<button class="th-sort" type="button" data-sort-key="${column.key}">
                ${column.label}
                <span class="sort-mark" aria-hidden="true">${isSorted ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
              </button>`
            : column.label}
        </th>`;
      })}
    </tr></thead>`;

    const table = html`<div class="table-scroll ${config.tall ? 'table-scroll--tall' : ''}" style="${config.maxHeight ? `max-height:${config.maxHeight};` : ''}">
      <table class="data-table ${config.dense ? 'is-dense' : ''}" style="${config.minWidth ? `min-width:${config.minWidth};` : ''}" ${config.ariaLabel ? html`aria-label="${config.ariaLabel}"` : null}>
        ${head}
        ${body}
      </table>
      ${!rows.length ? html`<div class="table-empty">${config.emptyText || 'Nessun dato disponibile.'}</div>` : null}
    </div>`;

    return html`${table}${config.caption ? html`<p class="table-caption">${config.caption}</p>` : null}`;
  }
}

define('f1-data-table', DataTable);
export { DataTable };
