// ==================== ESTADO GLOBAL ====================

let allPlayers = [];
let selectedPlayer = null;
let schedule = [];
let gamesByPlayer = {};

// ==================== CONFIGURAÇÃO ====================

const JSON_URL = 'https://raw.githubusercontent.com/zurkstk/projetonba/refs/heads/main/stats.json';
const SCHEDULE_URL = 'https://raw.githubusercontent.com/zurkstk/projetonba/refs/heads/main/schedule.json';

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    loadSchedule();
    setupFileUpload();
    if (JSON_URL) loadFromURL(JSON_URL);

    // 🔽 Adicionar opções de ordenação por diferença
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
        const options = [
            { value: 'diff_points', text: 'Diferença em Pontos (Proj − Line)' },
            { value: 'diff_rebounds', text: 'Diferença em Ressaltos (Proj − Line)' },
            { value: 'diff_assists', text: 'Diferença em Assistências (Proj − Line)' },
            { value: 'diff_fg3PtMade', text: 'Diferença em Triplos (Proj − Line)' },
            { value: 'diff_steals', text: 'Diferença em Roubos (Proj − Line)' },
            { value: 'diff_blocks', text: 'Diferença em Bloqueios (Proj − Line)' },
            { value: 'diff_pointsReboundsAssists', text: 'Diferença em PRA (Proj − Line)' },
            { value: 'diff_fantasyPts', text: 'Diferença em Fantasy (Proj − Line)' }
        ];
        options.forEach(opt => {
            if (!sortSelect.querySelector(`option[value="${opt.value}"]`)) {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                sortSelect.appendChild(option);
            }
        });
    }
});

// ==================== CARREGAMENTO DE DADOS ====================

async function loadSchedule() {
    try {
        const response = await fetch(SCHEDULE_URL);
        if (!response.ok) throw new Error('Erro ao carregar schedule');
        schedule = await response.json();
        console.log('Schedule carregado:', schedule.length, 'jogos');
    } catch (error) {
        console.log('Erro ao carregar schedule:', error);
    }
}

function setupFileUpload() {
    const input = document.getElementById('fileInput');
    if (!input) return;
    input.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('fileName').textContent = `Ficheiro selecionado: ${file.name}`;
            loadFile(file);
        }
    });
}

function loadFile(file) {
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            allPlayers = JSON.parse(e.target.result);
            document.getElementById('errorMessage').classList.add('hidden');
            document.getElementById('uploadSection').classList.add('hidden');
            if (schedule.length === 0) await loadSchedule();
            initializeApp();
        } catch (error) {
            showError('Erro ao ler o ficheiro JSON. Verifica se o formato está correto.');
            console.error('Erro:', error);
        }
    };
    reader.onerror = function () {
        showError('Erro ao carregar o ficheiro.');
    };
    reader.readAsText(file);
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

async function loadFromURL(url) {
    try {
        document.getElementById('uploadSection').innerHTML = '<h2>⏳ A carregar dados...</h2>';
        if (schedule.length === 0) await loadSchedule();

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const data = await response.json();

        allPlayers = data;
        document.getElementById('errorMessage').classList.add('hidden');
        document.getElementById('uploadSection').classList.add('hidden');
        initializeApp();
    } catch (error) {
        showError(`Erro ao carregar o ficheiro da URL: ${error.message}.`);
        document.getElementById('uploadSection').innerHTML = `
            <h2>📁 Carregar Ficheiro JSON</h2>
            <p>Seleciona o ficheiro <strong>statsa.json</strong> com os dados dos jogadores</p>
            <div class="file-input-wrapper">
                <input type="file" id="fileInput" accept=".json" />
                <label for="fileInput" class="file-input-label">📤 Escolher Ficheiro</label>
            </div>
            <p id="fileName" style="margin-top: 16px; color: #10b981; font-weight: 600;"></p>
        `;
        setupFileUpload();
    }
}

// ==================== INICIALIZAÇÃO DA APP ====================

function initializeApp() {
    console.log('=== INICIALIZANDO APP ===');
    allPlayers = Object.values(allPlayers.reduce((u, p) => ((u[p.name] = p), u), {}));

    document.getElementById('filtersSection').classList.remove('hidden');
    document.getElementById('playersGrid').classList.remove('hidden');
    populateTeamFilter();
    mapGamesToPlayers();
    renderPlayers();
    updatePlayerCount();
    setupEventListeners();
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', renderPlayers);
    document.getElementById('teamFilter').addEventListener('change', renderPlayers);
    document.getElementById('sortBy').addEventListener('change', renderPlayers);
    document.getElementById('backButton').addEventListener('click', () => {
        selectedPlayer = null;
        showPlayersList();
    });
}

// ==================== GESTÃO DE JOGOS ====================

function mapGamesToPlayers() {
    gamesByPlayer = {};
    const gamesByTeam = {};
    const now = new Date();

    schedule.forEach(game => {
        const gameTime = new Date(game.time);
        if (!gamesByTeam[game.home] || new Date(gamesByTeam[game.home].time) > gameTime) {
            if (gameTime >= now) gamesByTeam[game.home] = game;
        }
        if (!gamesByTeam[game.away] || new Date(gamesByTeam[game.away].time) > gameTime) {
            if (gameTime >= now) gamesByTeam[game.away] = game;
        }
    });

    allPlayers.forEach(player => {
        if (gamesByTeam[player.team]) gamesByPlayer[player.id] = gamesByTeam[player.team];
    });
}

function getGameInfo(player) {
    const game = gamesByPlayer[player.id];
    if (!game) return null;
    const isHome = game.home === player.team;
    const opponent = isHome ? game.away : game.home;
    const venue = isHome ? 'vs' : '@';
    const gameDate = new Date(game.time);
    return {
        opponent,
        venue,
        date: gameDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
        time: gameDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    };
}

// ==================== FILTROS E ORDENAÇÃO ====================

function populateTeamFilter() {
    const teams = [...new Set(allPlayers.map(p => p.team))].sort();
    const teamFilter = document.getElementById('teamFilter');
    teamFilter.innerHTML = '<option value="all">Todas as Equipas</option>';
    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamFilter.appendChild(option);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
        const metrics = [
            { key: 'points', label: 'Pontos' },
            { key: 'rebounds', label: 'Ressaltos' },
            { key: 'assists', label: 'Assistências' },
            { key: 'fg3PtMade', label: 'Triplos' },
            { key: 'steals', label: 'Roubos' },
            { key: 'blocks', label: 'Bloqueios' },
            { key: 'pointsReboundsAssists', label: 'PRA' },
            { key: 'fantasyPts', label: 'Fantasy' }
        ];
        metrics.forEach(m => {
            const optAsc = document.createElement('option');
            optAsc.value = `diff_${m.key}_asc`;
            optAsc.textContent = `Diferença em ${m.label} ↑ (Proj − Line)`;
            sortSelect.appendChild(optAsc);

            const optDesc = document.createElement('option');
            optDesc.value = `diff_${m.key}_desc`;
            optDesc.textContent = `Diferença em ${m.label} ↓ (Proj − Line)`;
            sortSelect.appendChild(optDesc);
        });
    }
});

// --- substitui a função getDiffValue existente por esta (retorna diferença assinada) ---
function getSignedDiffValue(player, key) {
    const proj = Number(player.projections?.[key] ?? 0);
    const line = Number(player.lines?.[key] ?? 0);
    return proj - line; // **assinado** (proj - line)
}

// --- se quiseres manter também a opção por diferença absoluta, podes usar esta ---
function getAbsDiffValue(player, key) {
    return Math.abs(getSignedDiffValue(player, key));
}

// --- no getFilteredAndSortedPlayers: ajusta a lógica de ordenação por diff_... ---
function getFilteredAndSortedPlayers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedTeam = document.getElementById('teamFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    let filtered = allPlayers.filter(player => {
        const matchesSearch = player.name.toLowerCase().includes(searchTerm);
        const matchesTeam = selectedTeam === 'all' || player.team === selectedTeam;
        return matchesSearch && matchesTeam;
    });

    if (sortBy.startsWith('diff_')) {
        // formato esperado: diff_<key>_asc OR diff_<key>_desc
        const parts = sortBy.split('_');
        // parts = ['diff', '<key>', 'asc'/'desc']
        const key = parts[1];
        const order = parts[2] || 'desc';

        filtered.sort((a, b) => {
            const diffA = getSignedDiffValue(a, key);
            const diffB = getSignedDiffValue(b, key);
            // Para ordem ascendente: menor (mais negativo) primeiro
            // Para ordem descendente: maior (mais positivo) primeiro
            return order === 'asc' ? diffA - diffB : diffB - diffA;
        });
    } else {
        filtered.sort((a, b) => {
            const valA = a.projections[sortBy] || 0;
            const valB = b.projections[sortBy] || 0;
            return valB - valA;
        });
    }

    return filtered;
}


// Função auxiliar para calcular a diferença
function getDiffValue(player, key) {
    const proj = player.projections?.[key] ?? 0;
    const line = player.lines?.[key] ?? 0;
    return Math.abs(proj - line);
}

// ==================== RENDERIZAÇÃO DOS CARDS ====================

function renderPlayers() {
    const players = getFilteredAndSortedPlayers();
    const grid = document.getElementById('playersGrid');
    const emptyState = document.getElementById('emptyState');
    grid.innerHTML = '';

    if (players.length === 0) {
        emptyState.classList.remove('hidden');
        grid.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        grid.classList.remove('hidden');
        players.forEach(player => grid.appendChild(createPlayerCard(player)));
    }
    updateResultCount(players.length);
}

function createPlayerCard(player) {
    const colors = getTeamColors(player.team);
    const card = document.createElement('div');
    card.className = 'player-card';
    card.style.background = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`;
    card.onclick = () => showPlayerDetails(player);

    const gameInfo = getGameInfo(player);
    const gameText = gameInfo
        ? `<div class="game-info"><span>${gameInfo.venue} ${gameInfo.opponent} • ${gameInfo.date} ${gameInfo.time}</span></div>`
        : '';

    function getIndicator(line, projection) {
        const projValue = projection.toFixed(1);
        if (projection > line) return `<span class="projection-indicator projection-up">${projValue}</span>`;
        if (projection < line) return `<span class="projection-indicator projection-down">${projValue}</span>`;
        return `<span class="projection-indicator projection-same">${projValue}</span>`;
    }

    card.innerHTML = `
        <div class="player-header">
            <div>
                <div class="player-name">${player.name}</div>
                <span class="player-team">${player.team}</span>
                ${gameText}
            </div>
        </div>

        <div class="player-stats-grid">
            ${createStatItem('PTS', player.lines.points, player.projections.points, getIndicator)}
            ${createStatItem('REB', player.lines.rebounds, player.projections.rebounds, getIndicator)}
            ${createStatItem('AST', player.lines.assists, player.projections.assists, getIndicator)}
            ${createStatItem('3PM', player.lines.fg3PtMade, player.projections.fg3PtMade, getIndicator)}
            ${createStatItem('STL', player.lines.steals, player.projections.steals, getIndicator)}
            ${createStatItem('BLK', player.lines.blocks, player.projections.blocks, getIndicator)}
            ${createStatItem('PRA', player.lines.pointsReboundsAssists, player.projections.pointsReboundsAssists, getIndicator)}
            ${createStatItem('FAN', player.lines.fantasyPts, player.projections.fantasyPts, getIndicator)}
            <div class="stat-item"><div class="stat-value">${player.projections.minutes.toFixed(1)}</div><span class="projection-indicator projection-same">min</span><div class="stat-label">MIN</div></div>
        </div>
    `;
    return card;
}

function createStatItem(label, line, proj, indicatorFn) {
    return `
        <div class="stat-item">
            <div class="stat-value">${line ?? '-'}</div>
            ${proj ? indicatorFn(line, proj) : ''}
            <div class="stat-label">${label}</div>
        </div>
    `;
}

// ==================== DETALHES DO JOGADOR ====================

function showPlayerDetails(player) {
    selectedPlayer = player;
    const colors = getTeamColors(player.team);
    const detailsDiv = document.getElementById('playerDetails');

    const gameInfo = getGameInfo(player);
    const gameInfoHtml = gameInfo
        ? `<p>Próximo Jogo: ${gameInfo.venue} ${gameInfo.opponent} • ${gameInfo.date} ${gameInfo.time}</p>`
        : '<p>Informação do jogo não disponível</p>';

    detailsDiv.innerHTML = `
        <div class="details-section">
            <div class="details-header" style="background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);">
                <h2>${player.name}</h2>
                <p>Equipa: ${player.team}</p>
                ${gameInfoHtml}
            </div>

            <div class="stats-section">
                <h3>📊 Estatísticas Principais</h3>
                <div class="stats-grid">
                    ${createStatCard('Pontos', player.lines.points, player.projections.points, '#10b981')}
                    ${createStatCard('Ressaltos', player.lines.rebounds, player.projections.rebounds, '#3b82f6')}
                    ${createStatCard('Assistências', player.lines.assists, player.projections.assists, '#8b5cf6')}
                    ${createStatCard('Triplos Marcados', player.lines.fg3PtMade, player.projections.fg3PtMade, '#f59e0b')}
                    ${createStatCard('Roubos de Bola', player.lines.steals, player.projections.steals, '#ef4444')}
                    ${createStatCard('Bloqueios', player.lines.blocks, player.projections.blocks, '#6366f1')}
                </div>
            </div>

            <div class="stats-section" style="border-left-color: #ec4899;">
                <h3>🏆 Estatísticas Combinadas</h3>
                <div class="stats-grid">
                    ${createStatCard('PTS + REB + AST', player.lines.pointsReboundsAssists, player.projections.pointsReboundsAssists, '#ec4899')}
                    ${createStatCard('Pontos Fantasy', player.lines.fantasyPts, player.projections.fantasyPts, '#8b5cf6')}
                </div>
            </div>

            <div class="stats-section" style="border-left-color: #f59e0b;">
                <h3>ℹ️ Informação Adicional</h3>
                <div class="stats-grid">
                    <div class="stat-card" style="border-left-color: #f59e0b;">
                        <div class="stat-card-header">Minutos</div>
                        <div class="stat-card-main">${player.projections.minutes.toFixed(1)}</div>
                    </div>
                    ${player.projections.turnovers ? `
                        <div class="stat-card" style="border-left-color: #ef4444;">
                            <div class="stat-card-header">Perdas de Bola</div>
                            <div class="stat-card-main">${player.projections.turnovers.toFixed(1)}</div>
                        </div>` : ''}
                    ${player.projections.doubleDouble !== undefined ? `
                        <div class="stat-card" style="border-left-color: #10b981;">
                            <div class="stat-card-header">Double-Double</div>
                            <div class="stat-card-main">${(player.projections.doubleDouble * 100).toFixed(0)}%</div>
                        </div>` : ''}
                    ${player.projections.tripleDouble !== undefined ? `
                        <div class="stat-card" style="border-left-color: #8b5cf6;">
                            <div class="stat-card-header">Triple-Double</div>
                            <div class="stat-card-main">${(player.projections.tripleDouble * 100).toFixed(0)}%</div>
                        </div>` : ''}
                </div>
            </div>
        </div>
    `;

    document.getElementById('playersGrid').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('backButton').classList.remove('hidden');
    detailsDiv.classList.remove('hidden');
}

function createStatCard(label, lineValue, projectionValue, color) {
    return `
        <div class="stat-card" style="border-left-color: ${color};">
            <div class="stat-card-header">${label}</div>
            <div class="stat-card-values">
                <span class="stat-card-main">${lineValue}</span>
                <span class="stat-card-projection">Proj: ${projectionValue.toFixed(2)}</span>
            </div>
        </div>
    `;
}

// ==================== INTERFACE ====================

function showPlayersList() {
    document.getElementById('playerDetails').classList.add('hidden');
    document.getElementById('backButton').classList.add('hidden');
    document.getElementById('playersGrid').classList.remove('hidden');
    renderPlayers();
}

function updatePlayerCount() {
    document.getElementById('playerCount').textContent =
        `${allPlayers.length} Jogadores | Estatísticas e Projeções`;
}

function updateResultCount(count) {
    document.getElementById('resultCount').textContent =
        `A mostrar ${count} de ${allPlayers.length} jogadores`;
}
