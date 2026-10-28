import { F1Element, define } from './base.js';
import { html, raw, esc, cls } from '../core/dom.js';

let chartId = 0;

const DEFAULT_WIDTH = 760;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeColor(color, fallback = '#ff2d16') {
  return /^#[0-9a-f]{6}$/i.test(color || '') ? color : fallback;
}

function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min, min + 1];
  const rough = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let value = start; value <= max + step * 0.001 && ticks.length < 12; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  if (ticks.length < 2) return [min, max];
  return ticks;
}

function selectXValues(values, maxTicks = 6) {
  const unique = [...new Set(values.filter(isFiniteNumber))].sort((a, b) => a - b);
  if (unique.length <= maxTicks) return unique;
  const picked = new Set([unique[0], unique[unique.length - 1]]);
  const step = (unique.length - 1) / (maxTicks - 1);
  for (let i = 1; i < maxTicks - 1; i += 1) {
    picked.add(unique[Math.round(i * step)]);
  }
  return [...picked].sort((a, b) => a - b);
}

class LineChart extends F1Element {
  constructor() {
    super();
    this._config = {};
    this._geometry = null;
    this._gradients = [];
  }

  set config(value) {
    this._config = value || {};
    this.update();
  }

  get config() {
    return this._config;
  }

  onConnect() {
    this.listen(this, 'pointermove', (event) => this.onPointerMove(event));
    this.listen(this, 'pointerleave', () => this.hideTip());
    this.listen(this, 'pointercancel', () => this.hideTip());

    if (typeof ResizeObserver !== 'undefined') {
      this._lastWidth = Math.round(this.getBoundingClientRect().width);
      this._resizeObserver = new ResizeObserver(() => {
        const width = Math.round(this.getBoundingClientRect().width);
        if (!width || Math.abs(width - this._lastWidth) < 8) return;
        this._lastWidth = width;
        this.update();
      });
      this._resizeObserver.observe(this);
    }
  }

  onDisconnect() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  template() {
    const config = this._config || {};
    const series = (config.series || [])
      .map((item, index) => ({
        ...item,
        color: safeColor(item.color, index === 0 ? '#ff2d16' : '#58a6ff'),
        points: (item.points || [])
          .filter((point) => isFiniteNumber(point.x) && isFiniteNumber(point.y))
          .sort((a, b) => a.x - b.x),
      }))
      .filter((item) => item.points.length > 0);

    const allPoints = series.flatMap((item) => item.points.map((point) => ({ ...point, color: item.color, name: item.name })));
    if (!allPoints.length) {
      return html`<div class="chart__empty">${config.emptyText || 'Nessun dato disponibile per questo grafico.'}</div>`;
    }

    const height = Number(config.height) || 240;
    const width = Math.max(300, Math.round(config.width || this.getBoundingClientRect().width || DEFAULT_WIDTH));
    const compact = width < 520;
    const margin = compact
      ? { top: 12, right: 10, bottom: 24, left: 46 }
      : { top: 14, right: 18, bottom: 28, left: 48 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    let xMin = Math.min(...allPoints.map((point) => point.x));
    let xMax = Math.max(...allPoints.map((point) => point.x));
    if (xMin === xMax) {
      xMin -= 1;
      xMax += 1;
    }

    let yMin = config.minY ?? Math.min(...allPoints.map((point) => point.y));
    let yMax = config.maxY ?? Math.max(...allPoints.map((point) => point.y));
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }

    const integerY = config.invertY && allPoints.every((point) => Number.isInteger(point.y)) && yMax - yMin <= 12;
    let yTicks;
    if (integerY) {
      yTicks = [];
      for (let value = Math.ceil(yMin); value <= Math.floor(yMax); value += 1) yTicks.push(value);
    } else {
      yTicks = niceTicks(yMin, yMax, config.yTickCount || 5);
      if (config.minY == null) yMin = Math.min(yMin, yTicks[0]);
      if (config.maxY == null) yMax = Math.max(yMax, yTicks[yTicks.length - 1]);
    }

    const xScale = (value) => margin.left + ((value - xMin) / (xMax - xMin)) * plotW;
    const yScale = (value) => {
      const ratio = (value - yMin) / (yMax - yMin);
      return config.invertY ? margin.top + ratio * plotH : margin.top + plotH - ratio * plotH;
    };

    const xFormat = config.xFormat || ((value) => String(value));
    const yFormat = config.yFormat || ((value) => String(value));
    const xValues = selectXValues(allPoints.map((point) => point.x), config.xTickCount || (compact ? 4 : 6));

    const uuid = `chart-${++chartId}`;
    this._gradients = series.map((item) => `${uuid}-${Math.random().toString(36).slice(2, 6)}`);

    const defs = html`<defs>
      ${series.map((item, index) => html`<linearGradient id="${this._gradients[index]}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${item.color}" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="${item.color}" stop-opacity="0"/>
      </linearGradient>`)}
    </defs>`;

    const grid = html`<g aria-hidden="true">
      ${yTicks.map((tick) => html`<line class="chart__grid" x1="${margin.left}" x2="${width - margin.right}" y1="${yScale(tick)}" y2="${yScale(tick)}"/>
        <text x="${margin.left - 8}" y="${yScale(tick) + 3}" text-anchor="end">${(config.yTickFormat || yFormat)(tick)}</text>`)}
      ${xValues.map((tick) => html`<text x="${xScale(tick)}" y="${height - 8}" text-anchor="middle">${(config.xTickFormat || xFormat)(tick)}</text>`)}
      <line class="chart__axis" x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + plotH}" y2="${margin.top + plotH}"/>
    </g>`;

    const paths = series.map((item, index) => {
      const linePath = item.points
        .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'}${xScale(point.x).toFixed(2)},${yScale(point.y).toFixed(2)}`)
        .join(' ');
      const first = item.points[0];
      const last = item.points[item.points.length - 1];
      const areaPath = `M${xScale(first.x).toFixed(2)},${margin.top + plotH} ${linePath.replace(/^M/, 'L')} L${xScale(last.x).toFixed(2)},${margin.top + plotH} Z`;
      const showArea = config.area !== false && series.length === 1 && item.area !== false;
      return html`<g>
        ${showArea ? html`<path class="chart__area" d="${areaPath}" fill="url(#${this._gradients[index]})"/>` : null}
        <path class="chart__line" d="${linePath}" stroke="${item.color}" ${item.dashed ? raw('stroke-dasharray="4 4"') : null}/>
      </g>`;
    });

    const showDots = config.showDots !== false && allPoints.length <= 44;
    const dots = showDots
      ? html`<g>
          ${series.map((item) => item.points.map((point) => {
            const isHighlight = config.highlightX != null && point.x === config.highlightX;
            return html`<circle class="chart__dot ${isHighlight ? 'chart__dot--highlight' : ''}" cx="${xScale(point.x)}" cy="${yScale(point.y)}" r="${isHighlight ? 4.4 : 2.6}" fill="${isHighlight ? '#ff2d16' : item.color}" ${isHighlight ? raw('stroke="#fff"') : null}><title>${xFormat(point.x)}: ${yFormat(point.y)}</title></circle>`;
          }))}
        </g>`
      : null;

    const baseline = config.baseline != null && isFiniteNumber(Number(config.baseline))
      ? html`<g>
          <line x1="${margin.left}" x2="${width - margin.right}" y1="${yScale(Number(config.baseline))}" y2="${yScale(Number(config.baseline))}" stroke="rgba(255,255,255,.24)" stroke-dasharray="4 5"/>
          ${config.baselineLabel ? html`<text x="${width - margin.right}" y="${yScale(Number(config.baseline)) - 5}" text-anchor="end">${config.baselineLabel}</text>` : null}
        </g>`
      : null;

    this._geometry = {
      points: allPoints.map((point) => ({
        ...point,
        px: xScale(point.x),
        py: yScale(point.y),
      })),
      series,
      xScale,
      yScale,
      xMin,
      xMax,
      margin,
      height,
      width,
      xFormat,
      yFormat,
      config,
    };

    const legend = series.length && config.showLegend !== false
      ? html`<div class="chart__legend">
          ${series.map((item) => html`<span class="chart__legend-item"><i class="chart__legend-dot" style="--c:${item.color}"></i>${item.name || 'Serie'}</span>`)}
        </div>`
      : null;

    return html`<div class="chart" data-chart>
      ${legend}
      <div class="chart__plot" style="position:relative">
        <svg class="chart__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${config.ariaLabel || 'Grafico dati'}">
          <title>${config.ariaLabel || 'Grafico dati'}</title>
          ${defs}
          ${grid}
          ${baseline}
          ${paths}
          ${dots}
          <line class="chart__cursor" x1="0" x2="0" y1="${margin.top}" y2="${margin.top + plotH}" stroke="rgba(255,255,255,.22)" stroke-dasharray="3 3" opacity="0"/>
        </svg>
        <div class="chart__tip" data-chart-tip role="status" aria-live="off"></div>
      </div>
      ${config.foot ? html`<p class="chart__foot">${config.foot}</p>` : null}
    </div>`;
  }

  showTip(event) {
    const geometry = this._geometry;
    if (!geometry) return;
    const svg = this.querySelector('svg');
    const tip = this.querySelector('[data-chart-tip]');
    const cursor = this.querySelector('.chart__cursor');
    if (!svg || !tip || !cursor) return;

    const svgRect = svg.getBoundingClientRect();
    if (!svgRect.width) return;
    if (event.clientY < svgRect.top || event.clientY > svgRect.bottom) {
      this.hideTip();
      return;
    }

    const viewX = ((event.clientX - svgRect.left) / svgRect.width) * geometry.width;
    let nearest = null;
    geometry.points.forEach((point) => {
      if (!nearest || Math.abs(point.px - viewX) < Math.abs(nearest.px - viewX)) nearest = point;
    });
    if (!nearest) return;

    const sameX = geometry.points.filter((point) => Math.abs(point.x - nearest.x) < 1e-6);
    if (!sameX.length) return;

    const first = sameX[0];
    cursor.setAttribute('x1', first.px);
    cursor.setAttribute('x2', first.px);
    cursor.setAttribute('opacity', '1');

    const title = geometry.config.tipTitle ? geometry.config.tipTitle(first.x) : geometry.xFormat(first.x);
    tip.innerHTML = html`<div class="chart__tip-title">${title}</div>
      ${sameX.map((point) => html`<div class="chart__tip-row"><span><i class="chart__legend-dot" style="--c:${point.color}"></i>${point.name || ''}</span><strong>${geometry.yFormat(point.y)}</strong></div>`)}`.value;

    const wrapper = this.querySelector('.chart__plot') || this;
    const wrapperRect = wrapper.getBoundingClientRect();
    const left = Math.min(Math.max((svgRect.left - wrapperRect.left) + (first.px / geometry.width) * svgRect.width, 64), wrapperRect.width - 64);
    const top = (svgRect.top - wrapperRect.top) + (nearest.py / geometry.height) * svgRect.height - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.classList.add('is-visible');
  }

  hideTip() {
    const tip = this.querySelector('[data-chart-tip]');
    const cursor = this.querySelector('.chart__cursor');
    tip?.classList.remove('is-visible');
    cursor?.setAttribute('opacity', '0');
  }

  onPointerMove(event) {
    if (!this._geometry) return;
    if (event.pointerType === 'touch' && event.buttons === 0) {
      // Su touch mostriamo il tooltip solo dopo un tap prolungato/trascinamento.
      this.showTip(event);
      return;
    }
    this.showTip(event);
  }
}

define('f1-line-chart', LineChart);
export { LineChart };
