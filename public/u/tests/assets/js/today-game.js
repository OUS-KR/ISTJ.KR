// today-game.js - 원칙의 기록 보관소 (The Archive of Principles)

// --- Utility Functions ---
function getDailySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

// --- Game State Management ---
let gameState = {};
let currentRandFn = null;

function resetGameState() {
    gameState = {
        day: 1,
        responsibility: 50,
        stability: 50,
        order: 50,
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { facts: 10, rules: 10, logs: 5, verified_data: 0 },
        archivists: [
            { id: "alpha", name: "알파 기록관", personality: "원칙주의자", skill: "사실 검증", reliability: 80 },
            { id: "beta", name: "베타 기록관", personality: "현실주의자", skill: "규칙 적용", reliability: 70 }
        ],
        maxArchivists: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { verificationSuccess: 0 },
        dailyActions: { audited: false, reportReceived: false, talkedTo: [], minigamePlayed: false },
        sections: {
            factArchive: { built: false, durability: 100 },
            rulebookRoom: { built: false, durability: 100 },
            centralControlRoom: { built: false, durability: 100 },
            dataSecurityDept: { built: false, durability: 100 },
            historyMuseum: { built: false, durability: 100 }
        },
        archiveLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('istjArchiveGame', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('istjArchiveGame');
    const today = new Date().toISOString().slice(0, 10);
    if (savedState) {
        let loaded = JSON.parse(savedState);
        if (!loaded.dailyBonus) loaded.dailyBonus = { verificationSuccess: 0 };
        if (!loaded.archivists || loaded.archivists.length === 0) {
            loaded.archivists = [
                { id: "alpha", name: "알파 기록관", personality: "원칙주의자", skill: "사실 검증", reliability: 80 },
                { id: "beta", name: "베타 기록관", personality: "현실주의자", skill: "규칙 적용", reliability: 70 }
            ];
        }
        Object.assign(gameState, loaded);

        currentRandFn = mulberry32(getDailySeed() + gameState.day);

        if (gameState.lastPlayedDate !== today) {
            gameState.day += 1;
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0;
            gameState.dailyEventTriggered = false;
            processDailyEvents();
        }
    } else {
        resetGameState();
        processDailyEvents();
    }
    renderAll();
}

function updateState(changes, displayMessage = null) {
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && changes[key] !== null && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderAll(displayMessage);
}

// --- UI Rendering ---
function updateGameDisplay(text) {
    const gameArea = document.getElementById('gameArea');
    if(gameArea && text) gameArea.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) return;
    const archivistListHtml = gameState.archivists.map(a => `<li>${a.name} (${a.skill}) - 신뢰도: ${a.reliability}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>관리:</b> ${gameState.day}일차</p>
        <p><b>업무력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>책임감:</b> ${gameState.responsibility} | <b>안정성:</b> ${gameState.stability} | <b>질서:</b> ${gameState.order}</p>
        <p><b>자원:</b> 사실 ${gameState.resources.facts}, 규칙 ${gameState.resources.rules}, 기록 ${gameState.resources.logs}, 검증된 데이터 ${gameState.resources.verified_data || 0}</p>
        <p><b>보관소 레벨:</b> ${gameState.archiveLevel}</p>
        <p><b>기록관 (${gameState.archivists.length}/${gameState.maxArchivists}):</b></p>
        <ul>${archivistListHtml}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = [];

    if (gameState.currentScenarioId === 'intro') {
        dynamicChoices = gameScenarios.intro.choices;
    } else if (gameState.currentScenarioId === 'action_facility_management') {
        dynamicChoices = gameScenarios.action_facility_management.choices ? [...gameScenarios.action_facility_management.choices] : [];
        if (!gameState.sections.factArchive.built) dynamicChoices.push({ text: "사실 기록고 건설 (사실 50, 기록 20)", action: "build_fact_archive" });
        if (!gameState.sections.rulebookRoom.built) dynamicChoices.push({ text: "규정집의 방 구축 (규칙 30, 기록 30)", action: "build_rulebook_room" });
        if (!gameState.sections.centralControlRoom.built) dynamicChoices.push({ text: "중앙 통제실 건설 (사실 100, 규칙 50, 기록 50)", action: "build_central_control_room" });
        if (!gameState.sections.dataSecurityDept.built) dynamicChoices.push({ text: "데이터 보안부 신설 (규칙 80, 기록 40)", action: "build_data_security_dept" });
        if (gameState.sections.rulebookRoom.built && gameState.sections.rulebookRoom.durability > 0 && !gameState.sections.historyMuseum.built) {
            dynamicChoices.push({ text: "역사 박물관 개관 (규칙 50, 기록 100)", action: "build_history_museum" });
        }
        Object.keys(gameState.sections).forEach(key => {
            const facility = gameState.sections[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${key} 보수 (규칙 10, 기록 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}''>${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (gameActions[action]) {
                gameActions[action](JSON.parse(button.dataset.params || '{}'));
            }
        });
    });
}

function renderAll(customDisplayMessage = null) {
    const desc = document.getElementById('gameDescription');
    if (desc) desc.style.display = 'none';
    renderStats();
    
    if (!gameState.currentScenarioId.startsWith('minigame_')) {
        const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
        updateGameDisplay(customDisplayMessage || scenario.text);
        renderChoices(scenario.choices);
    }
}

// --- Game Data ---
const gameScenarios = {
    "intro": { text: "오늘의 업무는 무엇입니까?", choices: [
        { text: "기록 감사", action: "audit" },
        { text: "기록관과 면담", action: "talk_to_archivists" },
        { text: "정기 보고", action: "receive_report" },
        { text: "자료 수집", action: "show_resource_collection_options" },
        { text: "섹션 관리", action: "show_facility_options" },
        { text: "오늘의 미니게임", action: "play_minigame" }
    ]},
    "daily_event_interpretation_difference": {
        text: "새로운 규칙의 해석을 두고 기록관들 사이에 의견 차이가 발생했습니다.",
        choices: [
            { text: "원칙에 따라 엄격하게 해석한다.", action: "handle_difference", params: { choice: "strict" } },
            { text: "현실을 고려하여 유연하게 해석한다.", action: "handle_difference", params: { choice: "flexible" } },
            { text: "과거의 판례를 찾아본다.", action: "mediate_difference" },
            { text: "결정을 보류한다.", action: "ignore_event" }
        ]
    },
    "daily_event_data_loss": { text: "시스템 오류로 일부 데이터가 유실되었습니다. (-10 사실)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_rule_conflict": { text: "기존 규칙과 새로운 규칙이 충돌합니다. (-10 규칙)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_verification_request": {
        text: "외부 기관에서 데이터 검증을 요청했습니다. [기록 50]을 사용하여 검증을 완료하면 [검증된 데이터]를 얻을 수 있습니다.",
        choices: [
            { text: "요청을 수락한다", action: "accept_request" },
            { text: "요청을 거절한다", action: "decline_request" }
        ]
    },
    "daily_event_new_archivist": {
        choices: [
            { text: "그의 꼼꼼함을 보고 즉시 채용한다.", action: "welcome_new_unique_archivist" },
            { text: "기존 기록관들과의 효율성을 지켜본다.", action: "observe_archivist" },
            { text: "우리 보관소와는 맞지 않는 것 같다.", action: "reject_archivist" }
        ]
    },
    "game_over_responsibility": { text: "책임감 부족으로 기록 보관소의 신뢰가 무너졌습니다.", choices: [], final: true },
    "game_over_stability": { text: "안정성을 잃은 보관소는 혼란에 빠졌습니다.", choices: [], final: true },
    "game_over_order": { text: "질서가 무너져 모든 기록이 뒤섞였습니다.", choices: [], final: true },
    "game_over_resources": { text: "자원이 모두 고갈되어 기록 보관소를 유지할 수 없습니다.", choices: [], final: true },
    "action_resource_collection": {
        text: "어떤 자료를 수집하시겠습니까?",
        choices: [
            { text: "역사적 사실 수집 (사실)", action: "perform_gather_facts" },
            { text: "법률 및 규칙 검토 (규칙)", action: "perform_review_rules" },
            { text: "업무일지 작성 (기록)", "action": "perform_write_logs" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_facility_management": {
        text: "어떤 섹션을 관리하시겠습니까?",
        choices: []
    },
    "resource_collection_result": {
        text: "",
        choices: [{ text: "확인", action: "show_resource_collection_options" }]
    },
    "facility_management_result": {
        text: "",
        choices: [{ text: "확인", action: "show_facility_options" }]
    },
    "difference_resolution_result": {
        text: "",
        choices: [{ text: "확인", action: "return_to_intro" }]
    }
};

function calculateMinigameReward(minigameName, score) {
    let rewards = { responsibility: 0, stability: 0, order: 0, message: "" };

    switch (minigameName) {
        case "기억력 순서 맞추기":
            if (score >= 51) {
                rewards.responsibility = 15;
                rewards.stability = 10;
                rewards.order = 5;
                rewards.message = `완벽한 기억력입니다! 모든 절차를 기억했습니다. (+15 책임감, +10 안정성, +5 질서)`;
            } else if (score >= 21) {
                rewards.responsibility = 10;
                rewards.stability = 5;
                rewards.message = `훌륭한 기억력입니다. (+10 책임감, +5 안정성)`;
            } else if (score >= 0) {
                rewards.responsibility = 5;
                rewards.message = `훈련을 완료했습니다. (+5 책임감)`;
            } else {
                rewards.message = `훈련을 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "사실 확인 퀴즈":
            rewards.responsibility = 10;
            rewards.message = `모든 사실을 정확히 확인했습니다! (+10 책임감)`;
            break;
        case "오류 검출":
            rewards.stability = 10;
            rewards.message = `시스템의 오류를 모두 찾아냈습니다. (+10 안정성)`;
            break;
        case "일정 계획":
            rewards.order = 10;
            rewards.message = `완벽한 일정입니다. 모든 것이 질서정연합니다. (+10 질서)`;
            break;
        case "문서 분류하기":
            rewards.responsibility = 5;
            rewards.order = 5;
            rewards.message = `모든 문서를 규칙에 맞게 분류했습니다. (+5 책임감, +5 질서)`;
            break;
        default:
            rewards.message = `미니게임 ${minigameName}을(를) 완료했습니다.`;
            break;
    }
    return rewards;
}

const minigames = [
    {
        name: "기억력 순서 맞추기",
        description: "화면에 나타나는 업무 절차 순서를 기억하고 정확하게 입력하세요. 단계가 올라갈수록 어려워집니다!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { currentSequence: [], playerInput: [], stage: 1, score: 0, showingSequence: false };
            minigames[0].render(gameArea, choicesDiv);
            minigames[0].showSequence();
        },
        render: (gameArea, choicesDiv) => {
            gameArea.innerHTML = `
                <p><b>단계:</b> ${gameState.minigameState.stage} | <b>점수:</b> ${gameState.minigameState.score}</p>
                <p id="sequenceDisplay" style="font-size: 2em; font-weight: bold; min-height: 1.5em;"></p>
                <p>순서를 기억하고 입력하세요:</p>
                <div id="playerInputDisplay" style="font-size: 1.5em; min-height: 1.5em;">${gameState.minigameState.playerInput.join(' ')}</div>
            `;
            choicesDiv.innerHTML = `
                <div class="number-pad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="choice-btn num-btn" data-value="${num}">${num}</button>`).join('')}
                    <button class="choice-btn num-btn" data-value="0">0</button>
                    <button class="choice-btn submit-btn" data-action="submitSequence">입력 완료</button>
                    <button class="choice-btn reset-btn" data-action="resetInput">초기화</button>
                </div>
            `;
            choicesDiv.querySelectorAll('.num-btn').forEach(button => {
                button.addEventListener('click', () => minigames[0].processAction('addInput', button.dataset.value));
            });
            choicesDiv.querySelector('.submit-btn').addEventListener('click', () => minigames[0].processAction('submitSequence'));
            choicesDiv.querySelector('.reset-btn').addEventListener('click', () => minigames[0].processAction('resetInput'));
        },
        showSequence: () => {
            gameState.minigameState.showingSequence = true;
            gameState.minigameState.currentSequence = [];
            const sequenceLength = gameState.minigameState.stage + 2;
            for (let i = 0; i < sequenceLength; i++) {
                gameState.minigameState.currentSequence.push(Math.floor(currentRandFn() * 10));
            }

            const sequenceDisplay = document.getElementById('sequenceDisplay');
            let i = 0;
            const interval = setInterval(() => {
                if (i < gameState.minigameState.currentSequence.length) {
                    sequenceDisplay.innerText = gameState.minigameState.currentSequence[i];
                    i++;
                } else {
                    clearInterval(interval);
                    sequenceDisplay.innerText = "입력하세요!";
                    gameState.minigameState.showingSequence = false;
                }
            }, 800);
        },
        processAction: (actionType, value = null) => {
            if (gameState.minigameState.showingSequence) return;

            if (actionType === 'addInput') {
                gameState.minigameState.playerInput.push(parseInt(value));
                document.getElementById('playerInputDisplay').innerText = gameState.minigameState.playerInput.join(' ');
            } else if (actionType === 'resetInput') {
                gameState.minigameState.playerInput = [];
                document.getElementById('playerInputDisplay').innerText = '';
            } else if (actionType === 'submitSequence') {
                const correct = gameState.minigameState.currentSequence.every((num, i) => num === gameState.minigameState.playerInput[i]);

                if (correct && gameState.minigameState.playerInput.length === gameState.minigameState.currentSequence.length) {
                    gameState.minigameState.score += gameState.minigameState.currentSequence.length * 10;
                    gameState.minigameState.stage++;
                    gameState.minigameState.playerInput = [];
                    updateGameDisplay("정답입니다! 다음 단계로 넘어갑니다.");
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                    setTimeout(() => minigames[0].showSequence(), 1500);
                } else {
                    updateGameDisplay("오답입니다. 게임 종료.");
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({
                responsibility: gameState.responsibility + rewards.responsibility,
                stability: gameState.stability + rewards.stability,
                order: gameState.order + rewards.order,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    { name: "사실 확인 퀴즈", description: "주어진 정보의 진위 여부를 빠르게 판단하세요.", start: (ga, cd) => { ga.innerHTML = "<p>사실 확인 퀴즈 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[1].end()'>종료</button>"; gameState.minigameState = { score: 10 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[1].name, gameState.minigameState.score); updateState({ responsibility: gameState.responsibility + r.responsibility, stability: gameState.stability + r.stability, order: gameState.order + r.order, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "오류 검출", description: "복잡한 문서에서 논리적 오류나 사실과 다른 부분을 찾아내세요.", start: (ga, cd) => { ga.innerHTML = "<p>오류 검출 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[2].end()'>종료</button>"; gameState.minigameState = { score: 15 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[2].name, gameState.minigameState.score); updateState({ responsibility: gameState.responsibility + r.responsibility, stability: gameState.stability + r.stability, order: gameState.order + r.order, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "일정 계획", description: "주어진 업무들을 가장 효율적인 순서로 계획하세요.", start: (ga, cd) => { ga.innerHTML = "<p>일정 계획 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[3].end()'>종료</button>"; gameState.minigameState = { score: 20 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[3].name, gameState.minigameState.score); updateState({ responsibility: gameState.responsibility + r.responsibility, stability: gameState.stability + r.stability, order: gameState.order + r.order, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "문서 분류하기", description: "수많은 문서를 정해진 규칙에 따라 완벽하게 분류하세요.", start: (ga, cd) => { ga.innerHTML = "<p>문서 분류하기 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[4].end()'>종료</button>"; gameState.minigameState = { score: 25 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[4].name, gameState.minigameState.score); updateState({ responsibility: gameState.responsibility + r.responsibility, stability: gameState.stability + r.stability, order: gameState.order + r.order, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } }
];

// --- Game Actions ---
function spendActionPoint() {
    if (gameState.actionPoints <= 0) {
        updateGameDisplay("업무력이 부족합니다.");
        return false;
    }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    audit: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.audited) { updateState({ dailyActions: { ...gameState.dailyActions, audited: true } }, "오늘은 이미 모든 기록을 감사했습니다."); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, audited: true } };
        let message = "기록을 감사하며 오류를 확인합니다.";
        const rand = currentRandFn();
        if (rand < 0.3) { message += " 사소한 오류를 발견하여 수정했습니다. (+2 질서)"; changes.order = gameState.order + 2; }
        else if (rand < 0.6) { message += " 오래된 기록에서 새로운 사실을 발견했습니다. (+2 사실)"; changes.resources = { ...gameState.resources, facts: gameState.resources.facts + 2 }; }
        else { message += " 특별한 문제는 발견되지 않았습니다."; }
        
        updateState(changes, message);
    },
    talk_to_archivists: () => {
        if (!spendActionPoint()) return;
        const archivist = gameState.archivists[Math.floor(currentRandFn() * gameState.archivists.length)];
        if (gameState.dailyActions.talkedTo.includes(archivist.id)) { updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, archivist.id] } }, `${archivist.name}${getWaGwaParticle(archivist.name)} 이미 면담했습니다.`); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, archivist.id] } };
        let message = `${archivist.name}${getWaGwaParticle(archivist.name)} 면담했습니다. `;
        if (archivist.reliability > 80) { message += "그의 보고를 통해 보관소의 안정성이 향상되었습니다. (+5 안정성)"; changes.stability = gameState.stability + 5; }
        else if (archivist.reliability < 40) { message += "그의 업무 태만에 책임감을 느낍니다. (-5 책임감)"; changes.responsibility = gameState.responsibility - 5; }
        else { message += "그와의 대화를 통해 업무 절차를 재확인했습니다. (+2 질서)"; changes.order = gameState.order + 2; }
        
        updateState(changes, message);
    },
    receive_report: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.reportReceived) {
            const message = "오늘은 이미 정기 보고를 받았습니다. (-5 안정성)";
            gameState.stability -= 5;
            updateState({ stability: gameState.stability }, message);
            return;
        }
        updateState({ dailyActions: { ...gameState.dailyActions, reportReceived: true } });
        const rand = currentRandFn();
        let message = "정기 보고를 받았습니다. ";
        if (rand < 0.5) { message += "모든 기록이 정확하게 관리되고 있습니다. (+10 안정성, +5 질서)"; updateState({ stability: gameState.stability + 10, order: gameState.order + 5 }); }
        else { message += "보고 과정에서 사소한 실수가 있었지만, 즉시 바로잡았습니다. (+5 책임감)"; updateState({ responsibility: gameState.responsibility + 5 }); }
        updateGameDisplay(message);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            lastPlayedDate: new Date().toISOString().slice(0, 10),
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
    handle_difference: (params) => {
        if (!spendActionPoint()) return;
        const { choice } = params;
        let message = "";
        let reward = { responsibility: 0, stability: 0, order: 0 };
        
        if (choice === "strict") {
            message = "원칙에 따라 엄격하게 해석했습니다. (+5 질서, -2 안정성)";
            reward.order += 5;
            reward.stability -= 2;
        } else {
            message = "현실을 고려하여 유연하게 해석했습니다. (+5 안정성, -2 질서)";
            reward.stability += 5;
            reward.order -= 2;
        }
        
        updateState({ ...reward, currentScenarioId: 'difference_resolution_result' }, message);
    },
    mediate_difference: () => {
        if (!spendActionPoint()) return;
        const message = "과거의 판례를 통해 명확한 기준을 세웠습니다. (+10 질서, +5 책임감)";
        updateState({ order: gameState.order + 10, responsibility: gameState.responsibility + 5, currentScenarioId: 'difference_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const message = "결정을 보류했습니다. 기록관들의 혼란이 가중됩니다. (-10 안정성, -5 질서)";
        updateState({ stability: gameState.stability - 10, order: gameState.order - 5, currentScenarioId: 'difference_resolution_result' }, message);
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_gather_facts: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.archiveLevel * 0.1) + (gameState.dailyBonus.verificationSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "역사적 사실을 수집했습니다! (+5 사실)";
            changes.resources = { ...gameState.resources, facts: gameState.resources.facts + 5 };
        } else {
            message = "사실 수집에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_review_rules: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.archiveLevel * 0.1) + (gameState.dailyBonus.verificationSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "법률 및 규칙을 검토했습니다! (+5 규칙)";
            changes.resources = { ...gameState.resources, rules: gameState.resources.rules + 5 };
        } else {
            message = "검토에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_write_logs: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.archiveLevel * 0.1) + (gameState.dailyBonus.verificationSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "업무일지를 작성했습니다! (+5 기록)";
            changes.resources = { ...gameState.resources, logs: gameState.resources.logs + 5 };
        } else {
            message = "작성에 실패했습니다.";
        }
        updateState(changes, message);
    },
    build_fact_archive: () => {
        if (!spendActionPoint()) return;
        const cost = { facts: 50, logs: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.logs >= cost.logs && gameState.resources.facts >= cost.facts) {
            gameState.sections.factArchive.built = true;
            message = "사실 기록고를 건설했습니다!";
            changes.order = gameState.order + 10;
            changes.resources = { ...gameState.resources, logs: gameState.resources.logs - cost.logs, facts: gameState.resources.facts - cost.facts };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_rulebook_room: () => {
        if (!spendActionPoint()) return;
        const cost = { rules: 30, logs: 30 };
        let message = "";
        let changes = {};
        if (gameState.resources.rules >= cost.rules && gameState.resources.logs >= cost.logs) {
            gameState.sections.rulebookRoom.built = true;
            message = "규정집의 방을 구축했습니다!";
            changes.stability = gameState.stability + 10;
            changes.resources = { ...gameState.resources, rules: gameState.resources.rules - cost.rules, logs: gameState.resources.logs - cost.logs };
        } else {
            message = "자원이 부족하여 구축할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_central_control_room: () => {
        if (!spendActionPoint()) return;
        const cost = { facts: 100, rules: 50, logs: 50 };
        let message = "";
        let changes = {};
        if (gameState.resources.rules >= cost.rules && gameState.resources.logs >= cost.logs && gameState.resources.facts >= cost.facts) {
            gameState.sections.centralControlRoom.built = true;
            message = "중앙 통제실을 건설했습니다!";
            changes.order = gameState.order + 20;
            changes.stability = gameState.stability + 20;
            changes.resources = { ...gameState.resources, rules: gameState.resources.rules - cost.rules, logs: gameState.resources.logs - cost.logs, facts: gameState.resources.facts - cost.facts };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_data_security_dept: () => {
        if (!spendActionPoint()) return;
        const cost = { rules: 80, logs: 40 };
        let message = "";
        let changes = {};
        if (gameState.resources.rules >= cost.rules && gameState.resources.logs >= cost.logs) {
            gameState.sections.dataSecurityDept.built = true;
            message = "데이터 보안부를 신설했습니다!";
            changes.responsibility = gameState.responsibility + 15;
            changes.order = gameState.order + 10;
            changes.resources = { ...gameState.resources, rules: gameState.resources.rules - cost.rules, logs: gameState.resources.logs - cost.logs };
        } else {
            message = "자원이 부족하여 신설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_history_museum: () => {
        if (!spendActionPoint()) return;
        const cost = { rules: 50, logs: 100 };
        let message = "";
        let changes = {};
        if (gameState.resources.rules >= cost.rules && gameState.resources.logs >= cost.logs) {
            gameState.sections.historyMuseum.built = true;
            message = "역사 박물관을 개관했습니다!";
            changes.resources = { ...gameState.resources, rules: gameState.resources.rules - cost.rules, logs: gameState.resources.logs - cost.logs };
        } else {
            message = "자원이 부족하여 개관할 수 없습니다.";
        }
        updateState(changes, message);
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { rules: 10, logs: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.rules >= cost.rules && gameState.resources.logs >= cost.logs) {
            gameState.sections[facilityKey].durability = 100;
            message = `${facilityKey} 섹션의 보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            changes.resources = { ...gameState.resources, rules: gameState.resources.rules - cost.rules, logs: gameState.resources.logs - cost.logs };
        } else {
            message = "보수에 필요한 자원이 부족합니다.";
        }
        updateState(changes, message);
    },
    upgrade_archive: () => {
        if (!spendActionPoint()) return;
        const cost = 20 * (gameState.archiveLevel + 1);
        if (gameState.resources.rules >= cost && gameState.resources.logs >= cost) {
            gameState.archiveLevel++;
            updateState({ resources: { ...gameState.resources, rules: gameState.resources.rules - cost, logs: gameState.resources.logs - cost }, archiveLevel: gameState.archiveLevel });
            updateGameDisplay(`기록 보관소를 업그레이드했습니다! 모든 검증 성공률이 10% 증가합니다. (현재 레벨: ${gameState.archiveLevel})`);
        } else { updateGameDisplay(`업그레이드에 필요한 자원이 부족합니다. (규칙 ${cost}, 기록 ${cost} 필요)`); }
        updateState({ currentScenarioId: 'intro' });
    },
    review_past_cases: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) { updateState({ resources: { ...gameState.resources, rules: gameState.resources.rules + 20, logs: gameState.resources.logs + 20 } }); updateGameDisplay("과거 사건 검토 중 누락된 규정을 발견했습니다! (+20 규칙, +20 기록)"); }
        else if (rand < 0.5) { updateState({ stability: gameState.stability + 10, order: gameState.order + 10 }); updateGameDisplay("과거 사건에서 현재의 질서를 바로잡을 교훈을 얻었습니다. (+10 안정성, +10 질서)"); }
        else { updateGameDisplay("과거 사건을 검토했지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_request: () => {
        if (!spendActionPoint()) return;
        if (gameState.resources.logs >= 50) {
            updateState({ resources: { ...gameState.resources, logs: gameState.resources.logs - 50, verified_data: (gameState.resources.verified_data || 0) + 1 } });
            updateGameDisplay("데이터 검증을 완료하여 검증된 데이터를 얻었습니다! 보관소의 안정성이 향상됩니다.");
        } else { updateGameDisplay("검증에 필요한 기록이 부족합니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    decline_request: () => {
        if (!spendActionPoint()) return;
        updateGameDisplay("외부 기관의 요청을 거절했습니다. 다음 기회를 기다려야겠습니다.");
        updateState({ currentScenarioId: 'intro' });
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        
        const minigameIndex = (gameState.day - 1) % minigames.length;
        const minigame = minigames[minigameIndex];
        
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
};

function applyStatEffects() {
    let message = "";
    if (gameState.responsibility >= 70) {
        gameState.dailyBonus.verificationSuccess += 0.1;
        message += "높은 책임감 덕분에 자료 검증 성공률이 증가합니다. ";
    }
    if (gameState.responsibility < 30) {
        gameState.archivists.forEach(a => a.reliability = Math.max(0, a.reliability - 5));
        message += "책임감 부족으로 기록관들의 신뢰도가 하락합니다. ";
    }

    if (gameState.stability >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "높은 안정성 덕분에 업무력이 증가합니다. ";
    }
    if (gameState.stability < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "안정성이 낮아져 업무에 차질이 생깁니다. ";
    }

    if (gameState.order >= 70) {
        Object.keys(gameState.sections).forEach(key => {
            if (gameState.sections[key].built) gameState.sections[key].durability = Math.min(100, gameState.sections[key].durability + 1);
        });
        message += "확립된 질서 덕분에 섹션 관리가 더 잘 이루어집니다. ";
    }
    if (gameState.order < 30) {
        Object.keys(gameState.sections).forEach(key => {
            if (gameState.sections[key].built) gameState.sections[key].durability = Math.max(0, gameState.sections[key].durability - 2);
        });
        message += "질서가 무너져 섹션들이 빠르게 노후화됩니다. ";
    }
    return message;
}

function generateRandomArchivist() {
    const names = ["감마 기록관", "델타 기록관", "엡실론 기록관", "제타 기록관"];
    const personalities = ["원칙주의적인", "현실적인", "분석적인", "꼼꼼한"];
    const skills = ["사실 검증", "규칙 적용", "데이터 분석", "보안"];
    const randomId = Math.random().toString(36).substring(2, 9);

    return {
        id: randomId,
        name: names[Math.floor(currentRandFn() * names.length)],
        personality: personalities[Math.floor(currentRandFn() * personalities.length)],
        skill: skills[Math.floor(currentRandFn() * skills.length)],
        reliability: 50
    };
}

// --- Daily/Initialization Logic ---
function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);

    updateState({
        actionPoints: 10,
        maxActionPoints: 10,
        dailyActions: { audited: false, reportReceived: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true,
        dailyBonus: { verificationSuccess: 0 }
    });

    const statEffectMessage = applyStatEffects();

    let skillBonusMessage = "";
    let durabilityMessage = "";

    gameState.archivists.forEach(a => {
        if (a.skill === '사실 검증') { gameState.resources.facts++; skillBonusMessage += `${a.name}의 능력 덕분에 사실을 추가로 얻었습니다. `; }
        else if (a.skill === '규칙 적용') { gameState.resources.rules++; skillBonusMessage += `${a.name}의 도움으로 규칙을 추가로 얻었습니다. `; }
        else if (a.skill === '데이터 분석') { gameState.order++; skillBonusMessage += `${a.name} 덕분에 보관소의 질서가 +1 향상되었습니다. `; }
    });

    Object.keys(gameState.sections).forEach(key => {
        const facility = gameState.sections[key];
        if(facility.built) {
            facility.durability -= 1;
            if(facility.durability <= 0) {
                facility.built = false;
                durabilityMessage += `${key} 섹션이 파손되었습니다! 보수가 필요합니다. `; 
            }
        }
    });

    gameState.resources.facts -= gameState.archivists.length * 2;
    let dailyMessage = "새로운 관리일이 시작되었습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.facts < 0) {
        gameState.stability -= 10;
        dailyMessage += "사실 자료가 부족하여 보관소의 안정이 흔들립니다! (-10 안정성)";
    }
    
    const rand = currentRandFn();
    let eventId = "intro";
    if (rand < 0.15) { eventId = "daily_event_data_loss"; updateState({resources: {...gameState.resources, facts: Math.max(0, gameState.resources.facts - 10)}}); }
    else if (rand < 0.30) { eventId = "daily_event_rule_conflict"; updateState({resources: {...gameState.resources, rules: Math.max(0, gameState.resources.rules - 10)}}); }
    else if (rand < 0.5 && gameState.archivists.length >= 2) { eventId = "daily_event_interpretation_difference"; }
    else if (rand < 0.7 && gameState.sections.centralControlRoom.built && gameState.archivists.length < gameState.maxArchivists) {
        eventId = "daily_event_new_archivist";
        const newArchivist = generateRandomArchivist();
        gameState.pendingNewArchivist = newArchivist;
        gameScenarios["daily_event_new_archivist"].text = `새로운 기록관 ${newArchivist.name}(${newArchivist.personality}, ${newArchivist.skill})이(가) 합류하고 싶어 합니다. (현재 기록관 수: ${gameState.archivists.length} / ${gameState.maxArchivists})`;
    }
    else if (rand < 0.85 && gameState.sections.centralControlRoom.built) { eventId = "daily_event_verification_request"; }
    
    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 기록 보관소를 초기화하시겠습니까? 모든 기록이 사라집니다.")) {
        localStorage.removeItem('istjArchiveGame');
        resetGameState();
        saveGameState();
        location.reload();
    }
}

window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', gameActions.manualNextDay);
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};
