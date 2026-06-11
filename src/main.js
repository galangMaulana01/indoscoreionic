// ==================== KONFIGURASI ====================
const API_BASE_URL = "https://sportmonks-tawny.vercel.app";
const TARGET_LEAGUE_IDS = [501];
let activeSeasonId = null;
let previousViewName = 'matches';
let currentActiveView = 'matches';
let currentTeamIdForSquad = null;

// ==================== UTILITIES & HELPERS ====================
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function showSkeleton(skeletonId, containerId, hideOthers = true) {
  document.getElementById(skeletonId)?.classList.remove('hidden');
  if (containerId) document.getElementById(containerId)?.classList.add('hidden');
  if (hideOthers) {
    const emptyEl = document.getElementById(skeletonId.replace('-skeleton', '-empty'));
    if (emptyEl) emptyEl.classList.add('hidden');
  }
}

function hideSkeletonAndShow(skeletonId, containerId) {
  document.getElementById(skeletonId)?.classList.add('hidden');
  if (containerId) document.getElementById(containerId)?.classList.remove('hidden');
}

// ==================== ROUTING & NAVIGASI ====================
function showView(viewId) {
  ['view-matches', 'view-detail', 'view-standings', 'view-team'].forEach(id =>
    document.getElementById(id).classList.add('hidden')
  );
  document.getElementById(viewId).classList.remove('hidden');
  window.scrollTo(0, 0);
}

function switchMainView(viewName) {
  previousViewName = currentActiveView;
  currentActiveView = viewName;
  document.getElementById('bottom-nav').classList.remove('hidden');

  const navMatches = document.getElementById('nav-btn-matches');
  const navStandings = document.getElementById('nav-btn-standings');

  if (viewName === 'matches') {
    navMatches.classList.add('text-merah'); navMatches.classList.remove('text-gray-500');
    navStandings.classList.add('text-gray-500'); navStandings.classList.remove('text-merah');
    showView('view-matches');
    if (!document.getElementById("matches-container").innerHTML.trim()) {
      fetchAndRenderMatches();
    }
  } else if (viewName === 'standings') {
    navStandings.classList.add('text-merah'); navStandings.classList.remove('text-gray-500');
    navMatches.classList.add('text-gray-500'); navMatches.classList.remove('text-merah');
    showView('view-standings');
    fetchAndRenderStandings();
  }
}

function openMatchDetail(matchId) {
  previousViewName = currentActiveView;
  currentActiveView = 'detail';
  document.getElementById('bottom-nav').classList.add('hidden');

  showSkeleton('scoreboard-skeleton', 'scoreboard-container');
  document.querySelectorAll('.tab-content').forEach(el => el.innerHTML = '');
  switchDetailTab('overview');
  showView('view-detail');
  loadMatchDetailData(matchId);
}

function goBackFromDetail() {
  document.getElementById('bottom-nav').classList.remove('hidden');
  switchMainView(previousViewName === 'detail' ? 'matches' : previousViewName);
}

function goBackFromTeam() {
  document.getElementById('bottom-nav').classList.remove('hidden');
  if (previousViewName === 'standings') switchMainView('standings');
  else switchMainView('matches');
}

// ==================== SKELETON MATCHES ====================
function renderMatchesSkeleton() {
  const skeletonContainer = document.getElementById('matches-skeleton');
  skeletonContainer.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    skeletonContainer.innerHTML += `
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3 px-1">
          <div class="skeleton skeleton-circle w-5 h-5"></div>
          <div class="skeleton skeleton-text w-32"></div>
        </div>
        <div class="space-y-2">
          <div class="skeleton-match-card">
            <div class="flex items-center gap-3 w-[35%]"><div class="skeleton skeleton-circle w-8 h-8"></div><div class="skeleton skeleton-text w-20"></div></div>
            <div class="flex flex-col items-center w-[30%]"><div class="skeleton skeleton-text w-12 h-6"></div><div class="skeleton skeleton-text w-14 h-4 mt-1"></div></div>
            <div class="flex items-center justify-end gap-3 w-[35%]"><div class="skeleton skeleton-text w-20"></div><div class="skeleton skeleton-circle w-8 h-8"></div></div>
          </div>
          <div class="skeleton-match-card">
            <div class="flex items-center gap-3 w-[35%]"><div class="skeleton skeleton-circle w-8 h-8"></div><div class="skeleton skeleton-text w-20"></div></div>
            <div class="flex flex-col items-center w-[30%]"><div class="skeleton skeleton-text w-12 h-6"></div><div class="skeleton skeleton-text w-14 h-4 mt-1"></div></div>
            <div class="flex items-center justify-end gap-3 w-[35%]"><div class="skeleton skeleton-text w-20"></div><div class="skeleton skeleton-circle w-8 h-8"></div></div>
          </div>
        </div>
      </div>
    `;
  }
  skeletonContainer.classList.remove('hidden');
  document.getElementById('matches-container').classList.add('hidden');
  document.getElementById('matches-empty').classList.add('hidden');
}

// ==================== FETCH MATCHES ====================
async function fetchAndRenderMatches() {
  const skeletonDiv = document.getElementById('matches-skeleton');
  const container = document.getElementById("matches-container");
  const emptyDiv = document.getElementById("matches-empty");

  renderMatchesSkeleton();
  container.innerHTML = "";
  emptyDiv.classList.add("hidden");
  let totalRendered = 0;

  try {
    for (const leagueId of TARGET_LEAGUE_IDS) {
      const leagueRes = await fetch(`${API_BASE_URL}/leagues/${leagueId}`);
      const leagueJson = await leagueRes.json();
      const league = leagueJson?.data;
      if (!league) continue;

      let seasonId = league.currentseason?.id;
      if (!seasonId) continue;
      if (!activeSeasonId) activeSeasonId = seasonId;

      const standingsRes = await fetch(`${API_BASE_URL}/standings/seasons/${seasonId}`);
      const standingsJson = await standingsRes.json();
      const standings = standingsJson?.data || [];
      if (standings.length === 0) continue;

      const roundId = standings[0].round_id;
      const roundRes = await fetch(`${API_BASE_URL}/rounds/${roundId}`);
      const roundJson = await roundRes.json();
      const fixtureSummaries = roundJson?.data?.fixtures || [];
      if (fixtureSummaries.length === 0) continue;

      let fixturesHTML = '';
      for (const summary of fixtureSummaries) {
        const fixtureRes = await fetch(`${API_BASE_URL}/fixtures/${summary.id}?include=participants,scores`);
        const fixtureJson = await fixtureRes.json();
        const fixtureData = fixtureJson.data;
        if (!fixtureData) continue;

        const participants = fixtureData.participants || [];
        const homeTeam = participants.find(p => p.meta?.location === 'home') || {};
        const awayTeam = participants.find(p => p.meta?.location === 'away') || {};

        const homeScore = fixtureData.scores?.find(s => s.description === "CURRENT" && s.score?.participant === "home")?.score.goals ?? "0";
        const awayScore = fixtureData.scores?.find(s => s.description === "CURRENT" && s.score?.participant === "away")?.score.goals ?? "0";
        const statusRaw = fixtureData.state?.short_name || "NS";
        const statusLabel = statusRaw === "FT" ? "FT" : (statusRaw === "NS" ? "Belum mulai" : statusRaw);

        fixturesHTML += `
          <div class="flex items-center justify-between py-3 px-3 bg-kartu rounded-xl mb-3 cursor-pointer transition-all" onclick="openMatchDetail(${fixtureData.id})">
            <div class="flex items-center gap-3 w-[35%]">
              <img src="${homeTeam.image_path || 'https://placehold.co/40'}" class="w-8 h-8 object-contain" alt="">
              <span class="text-sm font-semibold text-gray-200 truncate">${escapeHtml(homeTeam.name) || 'TBA'}</span>
            </div>
            <div class="flex flex-col items-center w-[30%]">
              <span class="text-xl font-black text-white">${homeScore} - ${awayScore}</span>
              <span class="text-[10px] font-bold text-merah bg-gray-800 px-2 py-0.5 rounded-full mt-1">${statusLabel}</span>
            </div>
            <div class="flex items-center justify-end gap-3 w-[35%]">
              <span class="text-sm font-semibold text-gray-200 truncate text-right">${escapeHtml(awayTeam.name) || 'TBA'}</span>
              <img src="${awayTeam.image_path || 'https://placehold.co/40'}" class="w-8 h-8 object-contain" alt="">
            </div>
          </div>`;
        totalRendered++;
      }

      if (fixturesHTML) {
        container.insertAdjacentHTML('beforeend', `
          <div class="mb-6 bg-transparent">
            <div class="mb-3 flex items-center gap-2 px-1">
              <img src="${league.image_path}" class="w-10 h-10 object-contain">
              <h3 class="font-bold text-md text-white tracking-wider">${escapeHtml(league.name)}</h3>
            </div>
            <div class="space-y-2">${fixturesHTML}</div>
          </div>
        `);
      }
    }

    skeletonDiv.classList.add('hidden');
    if (totalRendered > 0) {
      container.classList.remove('hidden');
    } else {
      emptyDiv.classList.remove('hidden');
    }
  } catch (error) {
    console.error(error);
    skeletonDiv.classList.add('hidden');
    emptyDiv.classList.remove('hidden');
  }

  // Sembunyikan global loader
  const globalLoader = document.getElementById('global-loading');
  if (globalLoader && !globalLoader.classList.contains('fade-out')) {
    globalLoader.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => globalLoader.remove(), 500);
  }
}

// ==================== BANNER ====================
async function loadBanner() {
  try {
    const response = await fetch(`${API_BASE_URL}/benner`);
    const data = await response.json();
    document.getElementById("benner").innerHTML = `
      <div class="relative overflow-hidden rounded-2xl bg-latar h-32 flex items-center px-5">
        <img src="${data.image_benner}" class="absolute left-0 bottom-0 h-36 object-contain">
        <div class="ml-28 flex-1">
          <img src="${data.image_logo}" class="w-24">
          <p class="text-gray-400 text-sm mt-2 max-w-[180px] leading-tight">${data.desc}</p>
        </div>
        <a href="${data.link}" target="_blank" class="bg-kartu transition text-white font-bold text-2xl px-8 py-4 rounded-2xl">Join</a>
      </div>
    `;
  } catch (e) {
    console.error('Banner error:', e);
  }
}

// ==================== STANDINGS ====================
async function fetchAndRenderStandings() {
  const skeletonDiv = document.getElementById('standings-skeleton');
  const container = document.getElementById("standings-container");
  const emptyDiv = document.getElementById("standings-empty");

  skeletonDiv.classList.remove('hidden');
  container.classList.add('hidden');
  emptyDiv.classList.add('hidden');
  container.innerHTML = "";

  try {
    let seasonId = activeSeasonId;
    if (!seasonId) {
      const leagueRes = await fetch(`${API_BASE_URL}/leagues/${TARGET_LEAGUE_IDS[0]}`);
      const leagueJson = await leagueRes.json();
      seasonId = leagueJson?.data?.currentseason?.id;
      if (!seasonId) throw new Error("No season ID");
      activeSeasonId = seasonId;
    }

    const standingsRes = await fetch(`${API_BASE_URL}/standings/seasons/${seasonId}`);
    const standingsJson = await standingsRes.json();
    let allStandings = standingsJson?.data || [];
    if (allStandings.length === 0) throw new Error("Standings kosong");

    let finalStandings = allStandings.filter(s => s.group_id !== null);
    if (finalStandings.length === 0) {
      const maxStageId = Math.max(...allStandings.map(s => s.stage_id));
      finalStandings = allStandings.filter(s => s.stage_id === maxStageId);
    }

    const groupsMap = new Map();
    for (const standing of finalStandings) {
      const groupId = standing.group_id;
      if (!groupId) continue;
      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, { groupId, groupName: standing.group?.name || `Grup ${groupId}`, standings: [] });
      }
      groupsMap.get(groupId).standings.push(standing);
    }
    if (groupsMap.size === 0) throw new Error("Tidak ada grup ditemukan");

    const leagueRes = await fetch(`${API_BASE_URL}/leagues/${TARGET_LEAGUE_IDS[0]}`);
    const leagueJson = await leagueRes.json();
    const leagueName = leagueJson?.data?.name || "Klasemen Liga";

    let allTablesHTML = '';
    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
      if (a.groupName.includes('Championship')) return -1;
      if (b.groupName.includes('Championship')) return 1;
      return a.groupName.localeCompare(b.groupName);
    });

    for (const group of sortedGroups) {
      group.standings.sort((a, b) => a.position - b.position);
      let tableHTML = `
        <div class="mb-8 bg-kartu rounded shadow-sm border border-gray-800 overflow-hidden">
          <div class="bg-gradient-to-r from-merah to-kuning px-4 py-3">
            <h3 class="text-sm font-black text-white tracking-wide">${escapeHtml(group.groupName)}</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-800 border-b border-gray-700">
                <tr class="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th class="px-3 py-3 w-12">Pos</th><th class="px-2 py-3">Tim</th>
                  <th class="px-2 py-3 text-center">P</th><th class="px-2 py-3 text-center">M</th>
                  <th class="px-2 py-3 text-center">S</th><th class="px-2 py-3 text-center">K</th>
                  <th class="px-2 py-3 text-center">GM</th><th class="px-2 py-3 text-center">GK</th>
                  <th class="px-3 py-3 text-center font-black text-merah">Poin</th>
                </tr>
              </thead>
              <tbody>`;
      for (const standing of group.standings) {
        const participant = standing.participant;
        let teamName = participant?.name || "Tim";
        let teamLogo = participant?.image_path || "";
        let played = 0, wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
        if (standing.details && Array.isArray(standing.details)) {
          for (const det of standing.details) {
            switch (det.type_id) {
              case 129: played = det.value; break; case 130: wins = det.value; break;
              case 131: draws = det.value; break; case 132: losses = det.value; break;
              case 133: goalsFor = det.value; break; case 134: goalsAgainst = det.value; break;
            }
          }
        }
        tableHTML += `
          <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition">
            <td class="px-3 py-2.5 font-bold text-gray-300">${standing.position}</td>
            <td class="px-2 py-2.5 flex items-center gap-2">
              <img src="${teamLogo}" class="w-5 h-5 object-contain" onerror="this.src='https://placehold.co/20'">
              <span class="font-semibold text-gray-200 truncate max-w-[120px] cursor-pointer hover:text-merah hover:underline" onclick="openTeamSquad(${standing.participant_id})">${escapeHtml(teamName)}</span>
            </td>
            <td class="px-2 py-2.5 text-center font-medium text-gray-300">${played}</td>
            <td class="px-2 py-2.5 text-center text-gray-300">${wins}</td>
            <td class="px-2 py-2.5 text-center text-gray-300">${draws}</td>
            <td class="px-2 py-2.5 text-center text-gray-300">${losses}</td>
            <td class="px-2 py-2.5 text-center text-gray-300">${goalsFor}</td>
            <td class="px-2 py-2.5 text-center text-gray-300">${goalsAgainst}</td>
            <td class="px-3 py-2.5 text-center font-black text-merah">${standing.points || 0}</td>
          </tr>`;
      }
      tableHTML += `</tbody></table></div></div>`;
      allTablesHTML += tableHTML;
    }
    allTablesHTML += `<div class="text-center text-[10px] text-gray-500 py-2">${escapeHtml(leagueName)} • Update terbaru</div>`;
    container.innerHTML = allTablesHTML;
    skeletonDiv.classList.add('hidden');
    container.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    skeletonDiv.classList.add('hidden');
    emptyDiv.classList.remove('hidden');
  }
}

// ==================== TEAM SQUAD ====================
async function openTeamSquad(teamId) {
  if (!activeSeasonId) return;
  currentTeamIdForSquad = teamId;
  document.getElementById('bottom-nav').classList.add('hidden');
  showView('view-team');
  showSkeleton('squad-skeleton', 'squad-container');
  await loadSquadData(teamId, activeSeasonId);
}

async function loadSquadData(teamId, seasonId) {
  const skeletonDiv = document.getElementById('squad-skeleton');
  const container = document.getElementById('squad-container');
  const emptyDiv = document.getElementById('squad-empty');
  container.classList.add('hidden');
  emptyDiv.classList.add('hidden');
  skeletonDiv.classList.remove('hidden');

  let hasData = false;
  try {
    const squadRes = await fetch(`${API_BASE_URL}/squads/seasons/${seasonId}/teams/${teamId}`);
    const squadJson = await squadRes.json();
    let playersData = squadJson?.data || [];
    if (playersData.length === 0) throw new Error("Tidak ada pemain");
    hasData = true;

    const teamInfo = playersData[0]?.team || {};
    const teamName = teamInfo.name || "Tim";
    const teamLogo = teamInfo.image_path || "";
    document.getElementById("team-header").innerHTML = `
      <img src="${teamLogo}" class="w-10 h-10 object-contain bg-black rounded-full p-1 shadow">
      <h2 class="text-base font-bold text-white">${escapeHtml(teamName)}</h2>`;

    const positionMap = new Map();
    playersData.forEach(item => {
      const player = item.player;
      if (!player) return;
      const posName = player.position?.name || "Lainnya";
      if (!positionMap.has(posName)) positionMap.set(posName, []);
      positionMap.get(posName).push(item);
    });

    const posOrder = ["Goalkeeper", "Defender", "Midfielder", "Attacker"];
    const sortedPositions = Array.from(positionMap.keys()).sort((a, b) => {
      let idxA = posOrder.indexOf(a), idxB = posOrder.indexOf(b);
      if (idxA === -1) idxA = 999; if (idxB === -1) idxB = 999;
      return idxA - idxB;
    });

    let allHTML = "";
    for (const posName of sortedPositions) {
      const posPlayers = positionMap.get(posName);
      allHTML += `<div class="bg-kartu rounded-2xl shadow-sm border border-gray-800 overflow-hidden">
        <div class="bg-gray-800 px-4 py-2 border-b border-gray-700"><h3 class="text-xs font-black text-merah uppercase tracking-wider">${escapeHtml(posName)}</h3></div>
        <div class="divide-y divide-gray-800">`;
      for (const item of posPlayers) {
        const player = item.player;
        const jersey = item.jersey_number || "-";
        const playerName = player.name || "Tidak diketahui";
        const photo = player.image_path || "https://placehold.co/40";
        let age = "-";
        if (player.date_of_birth) {
          const birthDate = new Date(player.date_of_birth);
          const today = new Date();
          let ageNum = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) ageNum--;
          age = ageNum;
        }
        const nationality = player.nationality?.name || "";
        const flagUrl = player.nationality?.image_path || "";
        allHTML += `<div class="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
              <img src="${photo}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/40'">
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-200">${escapeHtml(playerName)}</p>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 mt-0.5">
                <span class="inline-flex items-center gap-1"><span class="font-bold text-gray-400">No.</span> ${jersey}</span>
                <span class="inline-flex items-center gap-1"><span class="font-bold text-gray-400">Umur</span> ${age}</span>
                ${nationality ? `<span class="inline-flex items-center gap-1"><img src="${flagUrl}" class="w-4 h-4 object-contain" onerror="this.style.display='none'"> ${escapeHtml(nationality)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="text-right"><span class="text-xs text-gray-500 italic">${posName}</span></div>
        </div>`;
      }
      allHTML += `</div></div>`;
    }
    container.innerHTML = allHTML;
  } catch (e) {
    console.error(e);
    hasData = false;
  }
  skeletonDiv.classList.add('hidden');
  if (hasData) container.classList.remove('hidden');
  else emptyDiv.classList.remove('hidden');
}

// ==================== DETAIL MATCH ====================
async function loadMatchDetailData(matchId) {
  showSkeleton('scoreboard-skeleton', 'scoreboard-container');
  try {
    const fixtureRes = await fetch(`${API_BASE_URL}/fixtures/${matchId}?include=participants,scores,events,statistics,lineups,venue,formations`);
    const fixtureJson = await fixtureRes.json();
    const fixtureData = fixtureJson.data;
    if (!fixtureData) throw new Error("Tidak ada data match");

    const participants = fixtureData.participants || [];
    const homeTeam = participants.find(p => p.meta?.location === 'home') || {};
    const awayTeam = participants.find(p => p.meta?.location === 'away') || {};
    const homeId = homeTeam.id;
    const awayId = awayTeam.id;

    const homeScore = fixtureData.scores?.find(s => s.description === "CURRENT" && s.score?.participant === "home")?.score.goals ?? "0";
    const awayScore = fixtureData.scores?.find(s => s.description === "CURRENT" && s.score?.participant === "away")?.score.goals ?? "0";
    const statusRaw = fixtureData.state?.short_name || "NS";
    const statusLabel = statusRaw === "FT" ? "FT" : (statusRaw === "NS" ? "Belum mulai" : statusRaw);

    document.getElementById('home-name').innerText = homeTeam.name || '-';
    document.getElementById('away-name').innerText = awayTeam.name || '-';
    document.getElementById('home-logo').src = homeTeam.image_path || 'https://placehold.co/60';
    document.getElementById('away-logo').src = awayTeam.image_path || 'https://placehold.co/60';
    document.getElementById('match-score').innerText = `${homeScore} - ${awayScore}`;
    document.getElementById('match-status').innerText = statusLabel;

    hideSkeletonAndShow('scoreboard-skeleton', 'scoreboard-container');

    renderOverviewTab(fixtureData, homeId, awayId);
    renderEventsTab(fixtureData, homeId, awayId);
    renderStatsTab(fixtureData, homeId, awayId);
    renderLineupTab(fixtureData, homeId, awayId);
  } catch (err) {
    console.error(err);
    document.getElementById('scoreboard-skeleton').classList.add('hidden');
  }
}

function renderOverviewTab(fixture, homeId, awayId) {
  const section = document.getElementById("tab-overview");
  const events = fixture.events || [];
  const goalEvents = events.filter(e => [14, 16, 17].includes(e.type_id));
  let homeScorers = '', awayScorers = '';
  goalEvents.forEach(e => {
    const isPenalty = e.type_id === 16 ? ' (P)' : '';
    const isOwn = e.type_id === 17 ? ' (OG)' : '';
    const html = `<div class="text-xs text-gray-400 font-medium mb-1.5 flex items-center gap-1"><span class="text-[10px]">⚽</span> ${e.minute}' - ${e.player_name}${isPenalty}${isOwn}</div>`;
    if (e.participant_id === homeId) homeScorers += html;
    else if (e.participant_id === awayId) awayScorers += html;
  });
  const scorersHTML = (homeScorers || awayScorers) ? `<div class="bg-kartu border border-gray-800 shadow-sm rounded p-4"><div class="flex justify-between gap-4"><div class="w-1/2 border-r border-gray-800 pr-2">${homeScorers || '<span class="text-xs text-gray-500 italic">-</span>'}</div><div class="w-1/2 pl-2 text-right flex flex-col items-end">${awayScorers || '<span class="text-xs text-gray-500 italic">-</span>'}</div></div></div>` : '';

  const stats = fixture.statistics || [];
  const getStat = (typeId) => {
    const h = stats.find(s => s.type_id === typeId && s.participant_id === homeId)?.data?.value ?? 0;
    const a = stats.find(s => s.type_id === typeId && s.participant_id === awayId)?.data?.value ?? 0;
    return { home: h, away: a };
  };
  const corners = getStat(34);
  const totalCorners = corners.home + corners.away || 1;
  const cornerHomePct = (corners.home / totalCorners) * 100;
  const venue = fixture.venue || {};
  const formations = fixture.formations || [];
  const homeForm = formations.find(f => f.participant_id === homeId)?.formation || '-';
  const awayForm = formations.find(f => f.participant_id === awayId)?.formation || '-';

  const infoHTML = `<div class="bg-kartu border border-gray-800 shadow-sm rounded p-5 space-y-4"><h4 class="text-xs font-black text-merah uppercase tracking-wider border-b border-gray-800 pb-2">Info Pertandingan</h4><div class="grid grid-cols-2 gap-y-4 gap-x-2 text-xs"><div><p class="text-gray-500 font-medium mb-0.5">Stadion</p><p class="font-bold text-gray-200 truncate">${venue.name || '-'}</p></div><div><p class="text-gray-500 font-medium mb-0.5">Kota</p><p class="font-bold text-gray-200">${venue.city_name || '-'}</p></div><div><p class="text-gray-500 font-medium mb-0.5">Kapasitas</p><p class="font-bold text-gray-200">${venue.capacity ? Number(venue.capacity).toLocaleString('id-ID') : '-'}</p></div><div><p class="text-gray-500 font-medium mb-0.5">Lapangan</p><p class="font-bold text-gray-200 capitalize">${venue.surface || '-'}</p></div><div class="col-span-2 pt-3 border-t border-gray-800 flex justify-between items-center"><div><p class="text-gray-500 font-medium mb-0.5">Formasi Home</p><p class="font-black text-sm text-merah">${homeForm}</p></div><div class="text-right"><p class="text-gray-500 font-medium mb-0.5">Formasi Away</p><p class="font-black text-sm text-gray-400">${awayForm}</p></div></div></div></div>`;
  section.innerHTML = `${scorersHTML}${infoHTML}`;
}

function renderEventsTab(fixture, homeId, awayId) {
  const section = document.getElementById("tab-events");
  const events = fixture.events || [];
  if (!events.length) { section.innerHTML = `<div class="bg-kartu border border-gray-800 shadow-sm rounded p-8 text-center text-sm font-medium text-gray-500">Belum ada kejadian tercatat.</div>`; return; }
  events.sort((a, b) => a.minute - b.minute);
  let html = '<div class="relative border-l-2 border-gray-800 ml-4 md:mx-auto md:w-full space-y-5 py-2">';
  events.forEach(e => {
    if (e.type_id === 10) return;
    const isHome = e.participant_id === homeId;
    let icon = "⏱️", detail = e.info || "";
    if (e.type_id === 14) { icon = "⚽"; detail = `Gol! ${e.info || ''}`; }
    else if (e.type_id === 16) { icon = "⚽"; detail = "Gol Penalti"; }
    else if (e.type_id === 17) { icon = "❌"; detail = "Gol Bunuh Diri"; }
    else if (e.type_id === 18) { icon = "🔄"; detail = `Keluar: ${e.related_player_name || '-'}`; }
    else if (e.type_id === 19) { icon = "🟨"; detail = "Kartu Kuning"; }
    else if (e.type_id === 20) { icon = "🟥"; detail = "Kartu Merah"; }
    html += `<div class="relative flex items-center ${isHome ? 'justify-start' : 'justify-end'} w-full"><div class="absolute -left-[9px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-kartu border-4 border-merah shadow-sm z-10"></div><div class="bg-kartu border border-gray-800 rounded p-3 shadow-sm w-[85%] sm:w-[45%] ${isHome ? 'ml-5' : 'mr-5 text-right'} hover:shadow-md transition"><div class="flex items-center gap-2 mb-1 ${isHome ? 'justify-start' : 'justify-end'}"><span class="text-xs font-black text-merah bg-gray-800 px-1.5 py-0.5 rounded">${e.minute}'</span><span class="text-sm">${icon}</span><span class="text-xs font-bold text-gray-300 line-clamp-1">${e.player_name || 'Pemain'}</span></div><p class="text-[11px] text-gray-500 font-medium line-clamp-1">${detail}</p></div></div>`;
  });
  section.innerHTML = html + '</div>';
}

function renderStatsTab(fixture, homeId, awayId) {
  const section = document.getElementById("tab-stats");
  const stats = fixture.statistics || [];
  if (!stats.length) { section.innerHTML = `<div class="bg-kartu border border-gray-800 shadow-sm rounded p-8 text-center text-sm font-medium text-gray-500">Statistik belum tersedia.</div>`; return; }
  let unique = [];
  stats.forEach(s => { if (!unique.some(t => t.id === s.type_id)) unique.push(s.type); });
  let html = `<div class="bg-kartu border border-gray-800 shadow-sm rounded p-5 space-y-4">`;
  unique.forEach(type => {
    const homeVal = stats.find(s => s.type_id === type.id && s.participant_id === homeId)?.data?.value ?? 0;
    const awayVal = stats.find(s => s.type_id === type.id && s.participant_id === awayId)?.data?.value ?? 0;
    let total = parseFloat(homeVal) + parseFloat(awayVal);
    let homePct = 50, awayPct = 50;
    if (total > 0) {
      if (type.name.includes('%') || type.code.includes('percentage')) { homePct = parseFloat(homeVal); awayPct = parseFloat(awayVal); }
      else { homePct = (parseFloat(homeVal) / total) * 100; awayPct = (parseFloat(awayVal) / total) * 100; }
    }
    html += `<div class="space-y-1.5 py-1"><div class="flex justify-between items-center text-xs font-bold text-gray-300"><span class="w-10 bg-gray-800 py-0.5 rounded text-center">${homeVal}</span><span class="text-gray-500 font-semibold text-[10px] uppercase tracking-wider truncate px-2 text-center flex-1">${type.name}</span><span class="w-10 bg-gray-800 py-0.5 rounded text-center">${awayVal}</span></div><div class="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden flex"><div class="bg-merah h-full transition-all duration-300" style="width: ${homePct}%"></div><div class="bg-gray-600 h-full transition-all duration-300" style="width: ${awayPct}%"></div></div></div>`;
  });
  section.innerHTML = html + '</div>';
}

function renderLineupTab(fixture, homeId, awayId) {
  const section = document.getElementById("tab-lineup");
  const lineups = fixture.lineups || [];
  if (!lineups.length) { section.innerHTML = `<div class="bg-kartu border border-gray-800 shadow-sm rounded p-8 text-center text-sm font-medium text-gray-500">Susunan pemain belum dirilis.</div>`; return; }
  const homeStart = lineups.filter(l => l.team_id === homeId && l.type_id === 11);
  const awayStart = lineups.filter(l => l.team_id === awayId && l.type_id === 11);
  const homeSubs = lineups.filter(l => l.team_id === homeId && l.type_id === 12);
  const awaySubs = lineups.filter(l => l.team_id === awayId && l.type_id === 12);
  const genRows = (homeArr, awayArr) => {
    let rows = '';
    const maxLen = Math.max(homeArr.length, awayArr.length);
    for (let i = 0; i < maxLen; i++) {
      const h = homeArr[i], a = awayArr[i];
      rows += `<div class="grid grid-cols-2 gap-4 py-2.5 border-b border-gray-800 last:border-0 text-xs hover:bg-gray-800/30 transition"><div class="flex items-center gap-2 min-w-0 px-2">${h ? `<span class="w-5 h-5 bg-merah/20 text-merah rounded-md font-bold flex items-center justify-center shrink-0 text-[10px]">${h.jersey_number || '-'}</span><span class="font-semibold text-gray-300 truncate">${h.player_name}</span>` : ''}</div><div class="flex items-center gap-2 justify-end min-w-0 text-right px-2">${a ? `<span class="font-semibold text-gray-300 truncate">${a.player_name}</span><span class="w-5 h-5 bg-gray-800 text-gray-400 rounded-md font-bold flex items-center justify-center shrink-0 text-[10px]">${a.jersey_number || '-'}</span>` : ''}</div></div>`;
    }
    return rows;
  };
  section.innerHTML = `<div class="bg-kartu border border-gray-800 shadow-sm rounded p-4"><h4 class="text-xs font-black text-merah uppercase tracking-wider border-b border-gray-800 pb-3 text-center mb-1">Starting Eleven</h4><div class="flex flex-col">${genRows(homeStart, awayStart)}</div></div><div class="bg-kartu border border-gray-800 shadow-sm rounded p-4"><h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800 pb-3 text-center mb-1">Cadangan</h4><div class="flex flex-col">${genRows(homeSubs, awaySubs)}</div></div>`;
}

function switchDetailTab(tabName) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.getElementById(`tab-${tabName}`).classList.remove("hidden");
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("bg-merah", "text-white");
    btn.classList.add("bg-gray-800", "text-gray-300");
  });
  const activeBtn = document.getElementById(`btn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove("bg-gray-800", "text-gray-300");
    activeBtn.classList.add("bg-merah", "text-white");
  }
}

// ==================== VIDEO SPLASH ====================
function initVideoSplash() {
  const splashDiv = document.getElementById('video-splash');
  const video = document.getElementById('splash-video');
  if (!splashDiv) return;

  const removeSplash = () => {
    if (splashDiv && splashDiv.parentNode) {
      splashDiv.style.transition = 'opacity 0.5s';
      splashDiv.style.opacity = '0';
      setTimeout(() => splashDiv.remove(), 500);
    }
  };

  if (video) {
    // Unmute video agar ada suara (Ionic/Capacitor native tidak ada autoplay restriction)
    video.muted = false;
    video.volume = 1.0;

    // Coba play dengan suara, fallback ke muted jika browser blokir
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Browser blokir autoplay dengan suara, coba muted
        video.muted = true;
        video.play().catch(() => removeSplash());
      });
    }

    video.addEventListener('ended', removeSplash);
    video.addEventListener('error', removeSplash);
  } else {
    removeSplash();
  }
}

// ==================== AUTH ====================
function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (window.google?.accounts?.id) resolve();
      else reject(new Error('Google Sign-In gagal dimuat'));
    };
    script.onerror = () => reject(new Error('Gagal menghubungi Google.'));
    document.head.appendChild(script);
  });
}

const GOOGLE_CLIENT_ID = "147017120613-p0fuo93avtdaqarpbnh7sfhks7q8nnbo.apps.googleusercontent.com";
const AUTH_KEY = "indoscore_user";
let usingFallback = false;

function getStoredUser() {
  try {
    const data = localStorage.getItem(AUTH_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
}
function saveUser(user) { localStorage.setItem(AUTH_KEY, JSON.stringify(user)); }
function clearUser() { localStorage.removeItem(AUTH_KEY); }
function isModalDismissedThisSession() { return sessionStorage.getItem("auth_modal_dismissed") === "true"; }
function setModalDismissed() { sessionStorage.setItem("auth_modal_dismissed", "true"); }

function updateHeaderUI(user) {
  const headerContainer = document.querySelector("#view-matches header .max-w-2xl");
  if (!headerContainer) return;
  const existingAuth = document.getElementById("auth-header-section");
  if (existingAuth) existingAuth.remove();

  if (user) {
    const firstName = user.name ? user.name.split(" ")[0] : "User";
    const authHTML = `
      <div id="auth-header-section" class="flex items-center justify-between mt-1 pb-2 px-4 relative">
        <div class="flex items-center gap-2 cursor-pointer" onclick="toggleUserMenu()">
          <div class="w-8 h-8 rounded-full bg-merah flex items-center justify-center text-white font-bold text-sm">
            ${firstName.charAt(0).toUpperCase()}
          </div>
          <span class="text-sm font-semibold text-white">${firstName}</span>
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        <div id="user-dropdown" class="hidden absolute right-4 top-14 bg-[#1f1f1f] border border-gray-700 rounded-xl shadow-xl z-50 py-1 w-36 text-sm">
          <button onclick="handleLogout()" class="block w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 font-medium">Keluar</button>
        </div>
      </div>`;
    headerContainer.insertAdjacentHTML("beforeend", authHTML);
  } else {
    const authHTML = `
      <div id="auth-header-section" class="flex justify-end px-4 mt-1 pb-2">
        <button onclick="openAuthModal()" class="text-xs font-bold bg-gray-800 hover:bg-gray-700 text-white px-4 py-1.5 rounded-full transition active:scale-95">Masuk</button>
      </div>`;
    headerContainer.insertAdjacentHTML("beforeend", authHTML);
  }
}

function toggleUserMenu() {
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) dropdown.classList.toggle("hidden");
}

document.addEventListener("click", function(e) {
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown && !dropdown.classList.contains("hidden") && !e.target.closest("#auth-header-section")) {
    dropdown.classList.add("hidden");
  }
});

function openAuthModal() {
  document.getElementById("auth-modal-overlay").classList.remove("hidden");
  document.getElementById("auth-error").classList.add("hidden");
}
function closeAuthModal() {
  document.getElementById("auth-modal-overlay").classList.add("hidden");
}

async function initGoogleOneTap() {
  try {
    await loadGoogleScript();
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse, auto_select: false, context: "signin" });
    usingFallback = false;
  } catch (err) {
    usingFallback = true;
  }
}

async function handleGoogleLogin() {
  document.getElementById("auth-error").classList.add("hidden");
  if (usingFallback || !window.google?.accounts?.id) {
    window.location.href = `${API_BASE_URL}/auth/google/login`;
    return;
  }
  try {
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        window.location.href = `${API_BASE_URL}/auth/google/login`;
      }
    });
  } catch (err) {
    window.location.href = `${API_BASE_URL}/auth/google/login`;
  }
}

function handleGoogleResponse(response) {
  if (response.credential) authenticateWithBackend(response.credential);
  else showAuthError("Gagal mendapatkan kredensial dari Google.");
}

async function authenticateWithBackend(idToken) {
  document.getElementById("auth-error").classList.add("hidden");
  try {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.detail || "Login gagal");
    saveUser(data.user);
    closeAuthModal();
    updateHeaderUI(data.user);
  } catch (error) {
    showAuthError(error.message);
  }
}

function showAuthError(message) {
  const errorDiv = document.getElementById("auth-error");
  document.getElementById("auth-error-text").textContent = message;
  errorDiv.classList.remove("hidden");
}

function handleLogout() {
  clearUser();
  updateHeaderUI(null);
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function handleAuthRedirect() {
  const hash = window.location.hash;
  if (hash.includes("auth_success=")) {
    try {
      const userData = JSON.parse(hash.split("auth_success=")[1].split("&")[0]);
      saveUser(userData);
      updateHeaderUI(userData);
      history.replaceState(null, null, " ");
      closeAuthModal();
    } catch (e) { console.error("Gagal parse user data dari redirect:", e); }
  } else if (hash.includes("auth_error=")) {
    const errorMsg = decodeURIComponent(hash.split("auth_error=")[1].split("&")[0]);
    showAuthError(errorMsg);
    history.replaceState(null, null, " ");
    openAuthModal();
  }
}

function initAuth() {
  handleAuthRedirect();
  const existingUser = getStoredUser();
  updateHeaderUI(existingUser);
  if (!existingUser && !isModalDismissedThisSession()) {
    setTimeout(() => { if (!getStoredUser()) openAuthModal(); }, 7000);
  }
  initGoogleOneTap().catch(() => {});
  document.getElementById("btn-google-login")?.addEventListener("click", handleGoogleLogin);
  document.getElementById("btn-skip-auth")?.addEventListener("click", () => {
    setModalDismissed();
    closeAuthModal();
  });
  document.getElementById("auth-modal-overlay")?.addEventListener("click", function(e) {
    if (e.target === this) { setModalDismissed(); closeAuthModal(); }
  });
}

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', () => {
  initVideoSplash();
  loadBanner();
  fetchAndRenderMatches();
  initAuth();
});
