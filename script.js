// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Данные игры
let gameState = {
    score: 0,
    power: 1,
    cps: 0,
    level: 1,
    autoClickerEnabled: false,
    lastSaveTime: Date.now(),
    backgroundEarnings: 0,
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
function loadGame() {
    const saved = localStorage.getItem('clickerGame');
    if (saved) {
        const parsed = JSON.parse(saved);
        gameState = { ...gameState, ...parsed };
        
        // Проверяем фоновый заработок
        checkBackgroundEarnings();
    }
    updateDisplay();
    updateAchievementsDisplay();
    updateAutoClickerButton();
}

// Проверка фонового заработка
function checkBackgroundEarnings() {
    const now = Date.now();
    const timeDiff = now - gameState.lastSaveTime;
    
    if (timeDiff > 30000 && gameState.autoClickerEnabled && gameState.cps > 0) { // 30 секунд минимальное отсутствие
        const minutesAway = Math.floor(timeDiff / 60000);
        const maxHours = 24; // Максимум 24 часа фоновой работы
        
        const effectiveMinutes = Math.min(minutesAway, maxHours * 60);
        const backgroundCPS = gameState.cps * 0.25; // 25% эффективности (75% менее эффективно)
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
function saveGame() {
    gameState.lastSaveTime = Date.now();
    localStorage.setItem('clickerGame', JSON.stringify(gameState));
}

// Включение/выключение автокликера
function toggleAutoClicker() {
    if (gameState.upgrades.auto.level > 0) {
        gameState.autoClickerEnabled = !gameState.autoClickerEnabled;
        updateAutoClickerButton();
        saveGame();
    } else if (gameState.score >= gameState.upgrades.auto.cost) {
        // Покупка автокликера
        buyUpgrade('auto');
        gameState.autoClickerEnabled = true;
        updateAutoClickerButton();
    }
}

// Обновление кнопки автокликера
function updateAutoClickerButton() {
    const btn = document.getElementById('auto-clicker-btn');
    const status = document.getElementById('auto-status');
    const text = document.getElementById('auto-clicker-text');
    
    if (gameState.upgrades.auto.level > 0) {
        // Улучшение уже куплено
        text.textContent = `Автокликер (${gameState.cps} клик/сек)`;
        btn.disabled = false;
        
        if (gameState.autoClickerEnabled) {
            status.textContent = '🟢 Вкл';
            status.classList.add('active');
        } else {
            status.textContent = '🔴 Выкл';
            status.classList.remove('active');
        }
    } else {
        // Улучшение еще не куплено
        text.textContent = 'Автокликер (+1 клик/сек)';
        status.textContent = '🔒 Заблокировано';
        status.classList.remove('active');
        btn.disabled = gameState.score < gameState.upgrades.auto.cost;
    }
}

// Основной клик
document.getElementById('click-btn').addEventListener('click', () => {
    gameState.score += gameState.power;
    checkLevelUp();
    checkAchievements();
    updateDisplay();
    saveGame();
});

// Проверка уровня
function checkLevelUp() {
    const newLevel = Math.floor(gameState.score / 50) + 1;
    if (newLevel > gameState.level) {
        gameState.level = newLevel;
        // Можно добавить бонус за уровень
    }
}

// Проверка достижений
function checkAchievements() {
    // Обновляем прогресс достижений
    gameState.achievements.firstClick.progress = gameState.score > 0 ? 1 : 0;
    gameState.achievements.novice.progress = Math.min(gameState.score, 10);
    gameState.achievements.pro.progress = Math.min(gameState.score, 50);
    gameState.achievements.master.progress = Math.min(gameState.score, 100);
    gameState.achievements.god.progress = Math.min(gameState.score, 500);
    gameState.achievements.rich.progress = Math.min(gameState.score, 1000);
    
    // Считаем общее количество улучшений
    const totalUpgrades = Object.values(gameState.upgrades).reduce((sum, upgrade) => sum + upgrade.level, 0);
    gameState.achievements.collector.progress = Math.min(totalUpgrades, 3);

    // Проверяем разблокировку
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
function unlockAchievement(achievementId, config) {
    // Выдаем награду
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

    // Показываем попап
    showAchievementPopup(config);
    
    // Обновляем отображение
    updateAchievementsDisplay();
    updateDisplay();
    saveGame();
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
    
    // Автоматическое закрытие через 4 секунды
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
                // При первой покупке включаем автокликер
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
        checkAchievements(); // Проверяем достижения после покупки
        updateDisplay();
        updateAutoClickerButton();
        saveGame();
    }
}

// Автокликер
setInterval(() => {
    if (gameState.autoClickerEnabled && gameState.cps > 0) {
        gameState.score += gameState.cps;
        checkLevelUp();
        checkAchievements();
        updateDisplay();
        saveGame();
    }
}, 1000);

// Обновление интерфейса
function updateDisplay() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('cps').textContent = gameState.cps;
    document.getElementById('power').textContent = gameState.power;
    document.getElementById('level').textContent = gameState.level;
    
    // Обновление информации о фоновом заработке
    const backgroundInfo = document.getElementById('background-earned');
    backgroundInfo.textContent = gameState.backgroundEarnings;
    
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
        if (btn.id !== 'auto-clicker-btn') {
            const upgradeType = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
            const upgrade = gameState.upgrades[upgradeType];
            btn.querySelector('.price').textContent = `Цена: ${upgrade.cost} кликов`;
            btn.disabled = gameState.score < upgrade.cost;
        }
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
            score: gameState.score,
            level: gameState.level
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
                <span>${index + 1}. ${player.name} (Ур. ${player.level})</span>
                <span>${player.score}</span>
            </div>
        `).join('');
        
        document.getElementById('leaderboard-list').innerHTML = leaderboardHTML;
    }
}

// Закрытие попапа
document.querySelector('.close-popup').addEventListener('click', () => {
    document.getElementById('achievement-popup').classList.add('hidden');
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    loadGame();
    updateLeaderboard();
    setInterval(updateLeaderboard, 5000);
});

// Обработка закрытия приложения
tg.onEvent('viewportChanged', () => {
    if (tg.isClosingConfirmationEnabled) {
        saveGame();
        updateLeaderboard();
    }
});

// Сохраняем игру при закрытии вкладки/приложения
window.addEventListener('beforeunload', () => {
    saveGame();
});