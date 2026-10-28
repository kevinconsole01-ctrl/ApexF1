import { html, icon, setHTML } from '../core/dom.js';
import { formatPoints, meetingTitle, teamColor } from '../core/format.js';
import { state } from '../core/store.js';
import { asyncSection, emptyState, fill, pageHead, skeletonRows } from '../core/page.js';
import { getMeetingDrivers } from '../data/drivers.js';
import { getDriverStandings } from '../data/standings.js';
import { driverCard } from '../components/driver.js';

function gridMarkup(rows) {
  return html`${rows.map((row) => driverCard(row.driver, { position: row.position, points: row.points }))}`;
}

function teamChips(teams, active, total) {
  return html`<button class="chip ${active === 'all' ? 'is-active' : ''}" type="button" data-team="all">
      Tutti <span class="chip__num">${total}</span>
    </button>
    ${teams.map((team) => html`<button class="chip ${active === team.name ? 'is-active' : ''}" type="button" data-team="${team.name}" style="--team:${team.color}">
      <span class="dot" style="--team:${team.color}"></span>${team.name}
    </button>`)}`;
}

function driversView(data) {
  const wrapper = document.createElement('div');
  wrapper.className = 'stack';
  wrapper.style.gap = '14px';

  const teams = [...new Map(data.rows.map((row) => [row.driver.team_name || '—', {
    name: row.driver.team_name || '—',
    color: row.teamColor,
    count: data.rows.filter((item) => (item.driver.team_name || '—') === (row.driver.team_name || '—')).length,
  }])).values()];

  let search = '';
  let activeTeam = 'all';

  wrapper.innerHTML = html`
    <div class="drivers-toolbar">
      <label class="search-field">
        ${icon('search')}
        <input type="search" data-search placeholder="Cerca pilota, numero o team…" aria-label="Cerca pilota, numero o team" autocomplete="off">
      </label>
      <span class="muted small" data-count></span>
    </div>
    <div class="chip-row" data-team-row>${teamChips(teams, activeTeam, data.rows.length)}</div>
    <div class="drivers-grid" data-grid></div>
  `;

  const searchInput = wrapper.querySelector('[data-search]');
  const teamRow = wrapper.querySelector('[data-team-row]');
  const grid = wrapper.querySelector('[data-grid]');
  const count = wrapper.querySelector('[data-count]');

  function renderGrid() {
    const needle = search.trim().toLowerCase();
    const rows = data.rows.filter((row) => {
      const driver = row.driver;
      const team = driver.team_name || '—';
      const haystack = [driver.full_name, driver.name_acronym, driver.driver_number, driver.team_name, driver.first_name, driver.last_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (activeTeam === 'all' || team === activeTeam) && (!needle || haystack.includes(needle));
    });

    fill(grid, gridMarkup(rows));
    count.textContent = `${rows.length} di ${data.rows.length} piloti`;
    if (!rows.length) {
      fill(grid, emptyState('Nessun pilota trovato', 'Prova a cambiare ricerca o filtro squadra.', 'search'));
    }
  }

  searchInput.addEventListener('input', (event) => {
    search = event.target.value;
    renderGrid();
  });

  teamRow.addEventListener('click', (event) => {
    const button = event.target.closest('[data-team]');
    if (!button) return;
    activeTeam = button.dataset.team;
    setHTML(teamRow, teamChips(teams, activeTeam, data.rows.length));
    renderGrid();
  });

  renderGrid();
  return wrapper;
}

export function driversPage() {
  const catalog = state.catalog;
  const el = document.createElement('div');
  el.className = 'page page-enter';
  if (!catalog) {
    el.innerHTML = html`${emptyState('Dati non disponibili', 'Ricarica la pagina per recuperare la stagione.', 'warning')}`;
    return { el, destroy() {} };
  }

  const meeting = catalog.latestCompleted || catalog.liveMeeting || catalog.nextRace;

  el.innerHTML = html`
    ${pageHead({
      eyebrow: `Stagione ${catalog.year} · ${meeting ? meetingTitle(meeting) : 'Piloti'}`,
      title: 'Piloti',
      subtitle: 'La griglia della stagione con posizione iridata, punti e squadra. Cerca un pilota o filtra per team.',
      actions: html`<a class="btn" href="#/standings">${icon('trophy')} Classifiche</a><a class="btn" href="#/schedule">${icon('calendar')} Calendario</a>`,
    })}
    <div data-slot="drivers">${skeletonRows(8)}</div>
  `;

  const disposers = [];
  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="drivers"]'),
      async () => {
        if (!meeting) return { rows: [], meeting: null };
        const [driverMap, standings] = await Promise.all([
          getMeetingDrivers(meeting.meeting_key),
          getDriverStandings(catalog).catch(() => ({ rows: [] })),
        ]);
        const standingMap = new Map(standings.rows.map((row) => [Number(row.driver_number), row]));
        const rows = [...driverMap.values()]
          .map((driver) => {
            const standing = standingMap.get(Number(driver.driver_number));
            return {
              driver,
              position: standing?.position ?? null,
              points: standing?.points ?? 0,
              teamColor: standing?.teamColor || teamColor(driver.team_colour),
            };
          })
          .sort((a, b) => {
            const posA = a.position ?? 999;
            const posB = b.position ?? 999;
            if (posA !== posB) return posA - posB;
            return String(a.driver.last_name || '').localeCompare(String(b.driver.last_name || ''), 'it');
          });
        return { rows, meeting };
      },
      (data) => {
        if (!data.rows.length) {
          return emptyState('Nessun pilota disponibile', 'OpenF1 non ha ancora pubblicato la lista piloti per questo weekend.', 'users');
        }
        return driversView(data);
      },
      { skeleton: skeletonRows(8) },
    ),
  );

  return {
    el,
    destroy() {
      disposers.forEach((dispose) => dispose());
    },
  };
}
