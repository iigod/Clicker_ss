// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Конфигурация сервера
const SERVER_URL = 'https://your-app.herokuapp.com'; // Замените на ваш URL

// Данные игры
let gameState = {
    score: 0,
    power: 1,
    cps: 0,
    level: 1,
    autoClickerEnabled: false,
    lastSaveTime: Date.now(),
    backgroundEarnings: 0,
    boosts: {
        critical: { level: 0, cost: 50, active: false },
        timewarp: { level: 0, cost: 80, active: false, duration: 0 },
        golden: { level: 0, cost: 120, active: false, clicksLeft: 0 },
        rainbow: { level: 0, cost: 200, active: false, duration: 0 }
    },
    upgrades: {
        power: { level: 0, cost: 10 },
        auto: { level: 0, cost: 30 },
        mega: { level: 0, cost: 100 }
    },
    achievements: {
        firstClick: { unlocked: false, progress: 0, target: 1 },
        novice: { unlocked: false, progress: 0, target: 10 },
        pro: { unlocked: false, progress: 0, target: 50 },
        master: { unlocked: false, progress: 0, target: 100 },
        god: { unlocked: false, progress: 0, target: 500 },
        collector: { unlocked: false, progress: 0, target: 3 },
        rich: { unlocked: false, progress: 0, target: 1000 }
    }
};

// Система достижений
const achievementsConfig = {
    firstClick: {
        name: "Первый шаг",
        description: "Сделайте первый клик",
        icon: "🎯",
        reward: "+5 очков"
    },
    novice: {
        name: "Новичок",
        description: "Достигните 10 очков",
        icon: "⭐",
        reward: "+10 очков"
    },
    pro: {
        name: "Профи",
        description: "Достигните 50 очков",
        icon: "🏆",
        reward: "+25 очков"
    },
    master: {
        name: "Мастер",
        description: "Достигните 100 очков",
        icon: "👑",
        reward: "+50 очков"
    },
    god: {
        name: "Бог кликов",
        description: "Достигните 500 очков",
        icon: "💎",
        reward: "+100 очков"
    },
    collector: {
        name: "Коллекционер",
        description: "Купите 3 улучшения",
        icon: "🛍️",
        reward: "Удвоение автокликера"
    },
    rich: {
        name: "Богач",
        description: "Накопите 1000 очков",
        icon: "💰",
        reward: "Тройная сила клика"
    }
};

// Загрузка сохраненных данных
async function loadGame() {
    const saved = localStorage.getItem('clickerGame');
    if (saved) {
        const parsed = JSON.parse(saved);
        gameState = { ...gameState, ...parsed };
        checkBackgroundEarnings();
    }
    
    await updatePlayerOnServer();
    await loadGlobalLeaderboard();
    
    updateDisplay();
    updateAchievementsDisplay();
    updateAutoClickerButton();
    startNotificationTimer();
}

// Сохранение игрока на сервере
async function updatePlayerOnServer() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    try {
        const response = await fetch(`${SERVER_URL}/api/save-player`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerId: user.id.toString(),
                name: user.first_name || 'Аноним',
                username: user.username || '',
                score: gameState.score,
                level: gameState.level
            })
        });
        
        const data = await response.json();
        console.log('Данные сохранены на сервере:', data);
    } catch (error) {
        console.log('Ошибка сохранения на сервере:', error);
        // Fallback на локальное сохранение
        savePlayerProgressLocally();
    }
}

// Загрузка глобальной таблицы лидеров с сервера
async function loadGlobalLeaderboard() {
    try {
        const response = await fetch(`${SERVER_URL}/api/leaderboard`);
        const data = await response.json();
        
        if (data.success) {
            updateLeaderboardDisplay(data.players);
        } else {
            throw new Error('Ошибка загрузки лидерборда');
        }
    } catch (error) {
        console.log('Ошибка загрузки с сервера:', error);
        // Fallback на локальные данные
        updateLeaderboardDisplayFromLocal();
    }
}

// Отображение таблицы лидеров с серверными данными
function updateLeaderboardDisplay(players) {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    let leaderboardHTML = '';
    
    if (players.length === 0) {
        leaderboardHTML = `
            <div class="leaderboard-item">
                <span colspan="3" style="text-align: center; opacity: 0.7;">
                    🎮 Станьте первым игроком!
                </span>
            </div>
        `;
    } else {
        leaderboardHTML = players.map((player, index) => {
            const isCurrentPlayer = user && player.id === user.id.toString();
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            const activeIndicator = Date.now() - player.lastUpdated < 300000 ? '🟢' : '⚫';
            
            return `
                <div class="leaderboard-item ${isCurrentPlayer ? 'current-player' : ''}">
                    <span>${medal} ${activeIndicator} ${player.name}${player.username ? ` (@${player.username})` : ''}</span>
                    <span>${player.score}</span>
                    <span>${player.level}</span>
                </div>
            `;
        }).join('');
    }
    
    // Добавляем статистику
    const totalPlayers = players.length;
    const activePlayers = players.filter(p => Date.now() - p.lastUpdated < 300000).length;
    
    const statsHTML = `
        <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; font-size: 0.7em;">
            <div>👥 Всего игроков: ${totalPlayers}</div>
            <div>🟢 Онлайн: ${activePlayers}</div>
            <div>🌐 Данные с сервера</div>
        </div>
    `;
    
    document.getElementById('leaderboard-list').innerHTML = leaderboardHTML + statsHTML;
}

// Fallback: отображение локальных данных
function updateLeaderboardDisplayFromLocal() {
    const playersDatabase = JSON.parse(localStorage.getItem('playersDatabase') || '{}');
    const user = tg.initDataUnsafe.user;
    
    const allPlayers = Object.values(playersDatabase)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
    
    let leaderboardHTML = '';
    
    if (allPlayers.length === 0) {
        leaderboardHTML = `
            <div class="leaderboard-item">
                <span colspan="3" style="text-align: center; opacity: 0.7;">
                    🎮 Подключаемся к серверу...
                </span>
            </div>
        `;
    } else {
        leaderboardHTML = allPlayers.map((player, index) => {
            const isCurrentPlayer = user && player.id === user.id.toString();
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            
            return `
                <div class="leaderboard-item ${isCurrentPlayer ? 'current-player' : ''}">
                    <span>${medal} ${player.name}${player.username ? ` (@${player.username})` : ''}</span>
                    <span>${player.score}</span>
                    <span>${player.level}</span>
                </div>
            `;
        }).join('');
    }
    
    document.getElementById('leaderboard-list').innerHTML = leaderboardHTML + `
        <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; font-size: 0.7em;">
            <div>⚠️ Локальные данные</div>
            <div>Подключите сервер для синхронизации</div>
        </div>
    `;
}

// Локальное сохранение (fallback)
function savePlayerProgressLocally() {
    const user = tg.initDataUnsafe.user;
    if (!user) return;

    const playerData = {
        id: user.id.toString(),
        name: user.first_name || 'Аноним',
        username: user.username || '',
        score: gameState.score,
        level: gameState.level,
        timestamp: Date.now()
    };
    
    let playersDatabase = JSON.parse(localStorage.getItem('playersDatabase') || '{}');
    playersDatabase[playerData.id] = playerData;
    localStorage.setItem('playersDatabase', JSON.stringify(playersDatabase));
}

// Проверка фонового заработка
function checkBackgroundEarnings() {
    const now = Date.now();
    const timeDiff = now - gameState.lastSaveTime;
    
    if (timeDiff > 30000 && gameState.autoClickerEnabled && gameState.cps > 0) {
        const minutesAway = Math.floor(timeDiff / 60000);
        const maxHours = 24;
        
        const effectiveMinutes = Math.min(minutesAway, maxHours * 60);
        const backgroundCPS = gameState.cps * 0.25;
        const earned = Math.floor(backgroundCPS * effectiveMinutes * 60);
        
        if (earned > 0) {
            gameState.backgroundEarnings = earned;
            gameState.score += earned;
            showBackgroundEarningsPopup(earned, effectiveMinutes);
        }
    }
    
    gameState.lastSaveTime = now;
    saveGame();
}

// Показ попапа фонового заработка
function showBackgroundEarningsPopup(earned, minutes) {
    const popup = document.getElementById('background-popup');
    const content = document.getElementById('background-earned-amount');
    
    content.textContent = `${earned} кликов`;
    
    const popupContent = document.getElementById('background-popup-content');
    popupContent.innerHTML = `
        <p>Пока вы отсутствовали ${Math.floor(minutes / 60)}ч ${minutes % 60}м, ваш автокликер заработал:</p>
        <div class="background-earned-amount">${earned} кликов</div>
        <p class="background-note">💡 Автокликер работает на 25% эффективности когда приложение закрыто</p>
    `;
    
    popup.classList.remove('hidden');
}

// Закрытие попапа фонового заработка
function closeBackgroundPopup() {
    document.getElementById('background-popup').classList.add('hidden');
    gameState.backgroundEarnings = 0;
    updateDisplay();
}

// Сохранение игры
async function saveGame() {
    gameState.lastSaveTime = Date.now();
    localStorage.setItem('clickerGame', JSON.stringify(gameState));
    
    // Сохраняем на сервере
    await updatePlayerOnServer();
}

// Таймер уведомлений (каждые 2 часа)
function startNotificationTimer() {
    setInterval(() => {
        if (gameState.autoClickerEnabled && gameState.cps > 0) {
            showNotification();
        }
    }, 2 * 60 * 60 * 1000);
}

// Показать уведомление
function showNotification() {
    const popup = document.getElementById('notification-popup');
    popup.classList.remove('hidden');
}

// Закрыть уведомление
function closeNotification() {
    document.getElementById('notification-popup').classList.add('hidden');
}

// Остальные функции остаются без изменений...
// [Вставьте сюда все остальные функции из предыдущего кода: toggleAutoClicker, buyBoost, activateBoost, 
//  обработчик клика, checkLevelUp, checkAchievements, unlockAchievement, showAchievementPopup,
//  updateAchievementsDisplay, buyUpgrade, автокликер, updateDisplay, updateProgressBars и т.д.]

// Включение/выключение автокликера
async function toggleAutoClicker() {
    if (gameState.upgrades.auto.level > 0) {
        gameState.autoClickerEnabled = !gameState.autoClickerEnabled;
        updateAutoClickerButton();
        await saveGame();
    } else if (gameState.score >= gameState.upgrades.auto.cost) {
        buyUpgrade('auto');
        gameState.autoClickerEnabled = true;
        updateAutoClickerButton();
    }
}

// Обновление кнопки автокликера
function updateAutoClickerButton() {
    const btn = document.getElementById('auto-clicker-btn');
    const status = document.getElementById('auto-status');
    const desc = document.getElementById('auto-desc');
    
    if (gameState.upgrades.auto.level > 0) {
        desc.textContent = `+${gameState.cps} клик/сек`;
        btn.disabled = false;
        
        if (gameState.autoClickerEnabled) {
            status.textContent = '🟢 Вкл';
            status.classList.add('active');
        } else {
            status.textContent = '🔴 Выкл';
            status.classList.remove('active');
        }
    } else {
        desc.textContent = '+1 клик/сек';
        status.textContent = '🔒 Заблокировано';
        status.classList.remove('active');
        btn.disabled = gameState.score < gameState.upgrades.auto.cost;
    }
}

// Покупка бустов
async function buyBoost(boostType) {
    const boost = gameState.boosts[boostType];
    
    if (gameState.score >= boost.cost) {
        gameState.score -= boost.cost;
        boost.level++;
        
        activateBoost(boostType);
        
        updateDisplay();
        await saveGame();
    }
}

// Активация эффектов бустов
function activateBoost(boostType) {
    const boost = gameState.boosts[boostType];
    
    switch(boostType) {
        case 'critical':
            boost.active = true;
            break;
        case 'timewarp':
            boost.active = true;
            boost.duration = 30;
            setTimeout(() => {
                boost.active = false;
            }, 30000);
            break;
        case 'golden':
            boost.active = true;
            boost.clicksLeft = 10;
            break;
        case 'rainbow':
            boost.active = true;
            boost.duration = 60;
            setTimeout(() => {
                boost.active = false;
            }, 60000);
            break;
    }
}

// Основной клик с учетом бустов
document.getElementById('click-btn').addEventListener('click', async () => {
    let clickPower = gameState.power;
    
    if (gameState.boosts.critical.active && Math.random() < 0.1) {
        clickPower *= 3;
    }
    
    if (gameState.boosts.golden.active && gameState.boosts.golden.clicksLeft > 0) {
        clickPower *= 5;
        gameState.boosts.golden.clicksLeft--;
        if (gameState.boosts.golden.clicksLeft === 0) {
            gameState.boosts.golden.active = false;
        }
    }
    
    if (gameState.boosts.rainbow.active) {
        clickPower *= 1.5;
    }
    
    if (gameState.boosts.timewarp.active) {
        clickPower *= 2;
    }
    
    gameState.score += clickPower;
    checkLevelUp();
    checkAchievements();
    updateDisplay();
    await saveGame();
    
    animateClick();
});

// Анимация клика
function animateClick() {
    const animation = document.getElementById('click-animation');
    animation.style.transform = 'scale(1.1)';
    setTimeout(() => {
        animation.style.transform = 'scale(1)';
    }, 100);
}

// Проверка уровня
function checkLevelUp() {
    const newLevel = Math.floor(gameState.score / 50) + 1;
    if (newLevel > gameState.level) {
        gameState.level = newLevel;
    }
}

// Проверка достижений
function checkAchievements() {
    gameState.achievements.firstClick.progress = gameState.score > 0 ? 1 : 0;
    gameState.achievements.novice.progress = Math.min(gameState.score, 10);
    gameState.achievements.pro.progress = Math.min(gameState.score, 50);
    gameState.achievements.master.progress = Math.min(gameState.score, 100);
    gameState.achievements.god.progress = Math.min(gameState.score, 500);
    gameState.achievements.rich.progress = Math.min(gameState.score, 1000);
    
    const totalUpgrades = Object.values(gameState.upgrades).reduce((sum, upgrade) => sum + upgrade.level, 0);
    gameState.achievements.collector.progress = Math.min(totalUpgrades, 3);

    Object.keys(gameState.achievements).forEach(achievementId => {
        const achievement = gameState.achievements[achievementId];
        const config = achievementsConfig[achievementId];
        
        if (!achievement.unlocked && achievement.progress >= achievement.target) {
            achievement.unlocked = true;
            unlockAchievement(achievementId, config);
        }
    });
}

// Разблокировка достижения
async function unlockAchievement(achievementId, config) {
    switch(achievementId) {
        case 'firstClick':
            gameState.score += 5;
            break;
        case 'novice':
            gameState.score += 10;
            break;
        case 'pro':
            gameState.score += 25;
            break;
        case 'master':
            gameState.score += 50;
            break;
        case 'god':
            gameState.score += 100;
            break;
        case 'collector':
            gameState.cps *= 2;
            break;
        case 'rich':
            gameState.power *= 3;
            break;
    }

    showAchievementPopup(config);
    updateAchievementsDisplay();
    updateDisplay();
    await saveGame();
}

// Показ попапа достижения
function showAchievementPopup(config) {
    const popup = document.getElementById('achievement-popup');
    const content = document.getElementById('popup-achievement-content');
    
    content.innerHTML = `
        <div class="achievement-icon">${config.icon}</div>
        <div class="achievement-name">${config.name}</div>
        <div class="achievement-desc">${config.description}</div>
        <div style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 8px;">
            <strong>Награда:</strong> ${config.reward}
        </div>
    `;
    
    popup.classList.remove('hidden');
    
    setTimeout(() => {
        popup.classList.add('hidden');
    }, 4000);
}

// Обновление отображения достижений
function updateAchievementsDisplay() {
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '';

    Object.keys(achievementsConfig).forEach(achievementId => {
        const config = achievementsConfig[achievementId];
        const achievement = gameState.achievements[achievementId];
        
        const progress = (achievement.progress / achievement.target) * 100;
        
        const achievementElement = document.createElement('div');
        achievementElement.className = `achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`;
        achievementElement.innerHTML = `
            <div class="achievement-icon">${config.icon}</div>
            <div class="achievement-name">${config.name}</div>
            <div class="achievement-desc">${config.description}</div>
            <div class="achievement-progress">
                <div class="achievement-progress-bar" style="width: ${progress}%"></div>
            </div>
            ${achievement.unlocked ? '<div style="margin-top: 5px; font-size: 0.7em; color: gold;">✔ Получено</div>' : ''}
        `;
        
        grid.appendChild(achievementElement);
    });
}

// Покупка улучшений
async function buyUpgrade(type) {
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
                if (upgrade.level === 0) {
                    gameState.autoClickerEnabled = true;
                }
                break;
            case 'mega':
                gameState.power *= 2;
                gameState.cps *= 2;
                upgrade.cost = Math.floor(upgrade.cost * 3);
                break;
        }
        
        upgrade.level++;
        checkAchievements();
        updateDisplay();
        updateAutoClickerButton();
        await saveGame();
    }
}

// Автокликер
setInterval(async () => {
    if (gameState.autoClickerEnabled && gameState.cps > 0) {
        let earned = gameState.cps;
        
        if (gameState.boosts.timewarp.active) {
            earned *= 2;
        }
        if (gameState.boosts.rainbow.active) {
            earned *= 1.5;
        }
        
        gameState.score += earned;
        checkLevelUp();
        checkAchievements();
        updateDisplay();
        await saveGame();
    }
}, 1000);

// Обновление интерфейса
function updateDisplay() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('cps').textContent = gameState.cps;
    document.getElementById('power').textContent = gameState.power;
    document.getElementById('level').textContent = gameState.level;
    
    document.getElementById('power-cost').textContent = gameState.upgrades.power.cost;
    document.getElementById('auto-cost').textContent = gameState.upgrades.auto.cost;
    document.getElementById('mega-cost').textContent = gameState.upgrades.mega.cost;
    
    document.getElementById('background-earned').textContent = gameState.backgroundEarnings;
    
    updateProgressBars();
    
    const user = tg.initDataUnsafe.user;
    if (user) {
        document.getElementById('user-info').innerHTML = `
            <p>Игрок: ${user.first_name || 'Аноним'} ${user.username ? `(@${user.username})` : ''}</p>
            <p>ID: ${user.id}</p>
        `;
    }
    
    document.querySelectorAll('.upgrade-btn').forEach(btn => {
        if (btn.id !== 'auto-clicker-btn') {
            const upgradeType = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
            const upgrade = gameState.upgrades[upgradeType];
            btn.disabled = gameState.score < upgrade.cost;
        }
    });
}

// Обновление прогресс-баров
function updateProgressBars() {
    const cheapestBoostCost = Math.min(...Object.values(gameState.boosts).map(b => b.cost));
    const boostProgress = Math.min((gameState.score / cheapestBoostCost) * 100, 100);
    document.getElementById('boost-progress').style.width = `${boostProgress}%`;
    document.getElementById('next-boost-target').textContent = cheapestBoostCost;
    
    const nextAchievement = Object.values(gameState.achievements)
        .filter(a => !a.unlocked)
        .sort((a, b) => a.target - b.target)[0];
    
    if (nextAchievement) {
        const achievementProgress = Math.min((gameState.score / nextAchievement.target) * 100, 100);
        document.getElementById('achievement-progress').style.width = `${achievementProgress}%`;
        document.getElementById('next-achievement-target').textContent = nextAchievement.target;
    }
}

// Закрытие попапа
document.querySelector('.close-popup').addEventListener('click', () => {
    document.getElementById('achievement-popup').classList.add('hidden');
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    loadGame();
    
    // Обновляем лидерборд каждые 5 секунд
    setInterval(() => {
        loadGlobalLeaderboard();
    }, 5000);
});

// Обработка закрытия приложения
tg.onEvent('viewportChanged', () => {
    if (tg.isClosingConfirmationEnabled) {
        saveGame();
    }
});

// Сохраняем игру при закрытии
window.addEventListener('beforeunload', () => {
    saveGame();
});
