// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Данные игры
let gameState = {
    score: 0,
    power: 1,
    cps: 0,
    upgrades: {
        power: { level: 0, cost: 10 },
        auto: { level: 0, cost: 30 },
        mega: { level: 0, cost: 100 }
    }
};

// Загрузка сохраненных данных
function loadGame() {
    const saved = localStorage.getItem('clickerGame');
    if (saved) {
        gameState = JSON.parse(saved);
    }
    updateDisplay();
}

// Сохранение игры
function saveGame() {
    localStorage.setItem('clickerGame', JSON.stringify(gameState));
}

// Основной клик
document.getElementById('click-btn').addEventListener('click', () => {
    gameState.score += gameState.power;
    updateDisplay();
    saveGame();
});

// Покупка улучшений
function buyUpgrade(type) {
    const upgrade = gameState.upgrades[type];
    
    if (gameState.score >= upgrade.cost) {
        gameState.score -= upgrade.cost;
        
        switch(type) {
            case 'power':
                gameState.power += 1;
                upgrade.cost = Math.floor(upgrade.cost * 1.5);
                break;
            case 'auto':
                gameState.cps += 1;
                upgrade.cost = Math.floor(upgrade.cost * 2);
                break;
            case 'mega':
                gameState.power *= 2;
                gameState.cps *= 2;
                upgrade.cost = Math.floor(upgrade.cost * 3);
                break;
        }
        
        upgrade.level++;
        updateDisplay();
        saveGame();
    }
}

// Автокликер
setInterval(() => {
    if (gameState.cps > 0) {
        gameState.score += gameState.cps;
        updateDisplay();
        saveGame();
    }
}, 1000);

// Обновление интерфейса
function updateDisplay() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('cps').textContent = gameState.cps;
    document.getElementById('power').textContent = gameState.power;
    
    // Обновление информации о пользователе Telegram
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-info').innerHTML = `
            <p>Игрок: ${user.first_name || 'Аноним'}</p>
            <p>ID: ${user.id}</p>
        `;
    }
    
    // Обновление кнопок улучшений
    document.querySelectorAll('.upgrade-btn').forEach(btn => {
        const upgradeType = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
        const upgrade = gameState.upgrades[upgradeType];
        btn.querySelector('.price').textContent = `Цена: ${upgrade.cost} кликов`;
        btn.disabled = gameState.score < upgrade.cost;
    });
}

// Таблица лидеров
function updateLeaderboard() {
    const leaderboard = JSON.parse(localStorage.getItem('clickerLeaderboard') || '[]');
    
    const user = tg.initDataUnsafe.user;
    if (user) {
        const playerIndex = leaderboard.findIndex(p => p.id === user.id);
        const playerData = {
            id: user.id,
            name: user.first_name || 'Аноним',
            score: gameState.score
        };
        
        if (playerIndex !== -1) {
            if (gameState.score > leaderboard[playerIndex].score) {
                leaderboard[playerIndex] = playerData;
            }
        } else {
            leaderboard.push(playerData);
        }
        
        leaderboard.sort((a, b) => b.score - a.score);
        localStorage.setItem('clickerLeaderboard', JSON.stringify(leaderboard.slice(0, 10)));
        
        const leaderboardHTML = leaderboard.map((player, index) => `
            <div class="leaderboard-item">
                <span>${index + 1}. ${player.name}</span>
                <span>${player.score}</span>
            </div>
        `).join('');
        
        document.getElementById('leaderboard-list').innerHTML = leaderboardHTML;
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    loadGame();
    updateLeaderboard();
    setInterval(updateLeaderboard, 5000);
});

// Обработка закрытия
tg.onEvent('viewportChanged', () => {
    if (tg.isClosingConfirmationEnabled) {
        saveGame();
        updateLeaderboard();
    }
});