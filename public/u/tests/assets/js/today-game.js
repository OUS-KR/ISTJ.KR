// today-game.js - ISTJ - 원칙의 기록 보관소 (The Archive of Principles)

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

function getRandomValue(base, variance) {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(currentRandFn() * (max - min + 1)) + min;
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "를";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "와";
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
        accuracy: 50,
        efficiency: 50,
        actionPoints: 10, // Represents '업무력'
        maxActionPoints: 10,
        resources: { facts: 10, rules: 10, records: 5, verified_data: 0 },
        archivists: [
            { id: "bernard", name: "버나드", personality: "원칙주의자", skill: "사실 검증", reliability: 70 },
            { id: "irene", name: "아이린", personality: "현실주의자", skill: "규칙 적용", reliability: 60 }
        ],
        maxArchivists: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { verificationSuccess: 0 },
        dailyActions: { audited: false, reported: false, interviewed: [], minigamePlayed: false },
        sections: {
            factArchive: { built: false, durability: 100, name: "사실 기록고", description: "검증된 사실들을 보관합니다.", effect_description: "사실 자동 생성 및 정확성 보너스." },
            rulebookRoom: { built: false, durability: 100, name: "규정집의 방", description: "보관소의 모든 규칙을 제정하고 관리합니다.", effect_description: "규칙 생성 및 질서 향상." },
            centralControl: { built: false, durability: 100, name: "중앙 통제실", description: "보관소의 모든 활동을 총괄합니다.", effect_description: "새로운 기록관 채용 및 책임감 강화." },
            dataSecurity: { built: false, durability: 100, name: "데이터 보안부", description: "기록의 무결성을 유지하고 외부 위협을 막습니다.", effect_description: "과거 기록을 통해 스탯 및 자원 획득." },
            historyMuseum: { built: false, durability: 100, name: "역사 박물관", description: "대중에게 검증된 역사를 전시합니다.", effect_description: "검증된 데이터 획득 및 고급 활동 잠금 해제." }
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
        if (!loaded.sections) {
            loaded.sections = {
                factArchive: { built: false, durability: 100, name: "사실 기록고" },
                rulebookRoom: { built: false, durability: 100, name: "규정집의 방" },
                centralControl: { built: false, durability: 100, name: "중앙 통제실" },
                dataSecurity: { built: false, durability: 100, name: "데이터 보안부" },
                historyMuseum: { built: false, durability: 100, name: "역사 박물관" }
            };
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
        <p><b>${gameState.day}일차 관리</b></p>
        <p><b>업무력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>책임감:</b> ${gameState.responsibility} | <b>안정성:</b> ${gameState.stability} | <b>질서:</b> ${gameState.order} | <b>정확성:</b> ${gameState.accuracy} | <b>효율성:</b> ${gameState.efficiency}</p>
        <p><b>자원:</b> 사실 ${gameState.resources.facts}, 규칙 ${gameState.resources.rules}, 기록 ${gameState.resources.records}, 검증된 데이터 ${gameState.resources.verified_data || 0}</p>
        <p><b>보관소 레벨:</b> ${gameState.archiveLevel}</p>
        <p><b>동료 기록관 (${gameState.archivists.length}/${gameState.maxArchivists}):</b></p>
        <ul>${archivistListHtml}</ul>
        <p><b>운영 섹션:</b></p>
        <ul>${Object.values(gameState.sections).filter(s => s.built).map(s => `<li>${s.name} (내구성: ${s.durability})</li>`).join('') || '없음'}</ul>
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
    } else if (gameState.currentScenarioId === 'action_section_management') {
        dynamicChoices = [];
        if (!gameState.sections.factArchive.built) dynamicChoices.push({ text: "사실 기록고 건설 (기록 50, 규칙 20)", action: "build_factArchive" });
        if (!gameState.sections.rulebookRoom.built) dynamicChoices.push({ text: "규정집의 방 건설 (규칙 30, 사실 30)", action: "build_rulebookRoom" });
        if (!gameState.sections.centralControl.built) dynamicChoices.push({ text: "중앙 통제실 건설 (기록 100, 규칙 50)", action: "build_centralControl" });
        if (!gameState.sections.dataSecurity.built) dynamicChoices.push({ text: "데이터 보안부 신설 (규칙 80, 사실 40)", action: "build_dataSecurity" });
        if (gameState.sections.rulebookRoom.built && !gameState.sections.historyMuseum.built) {
            dynamicChoices.push({ text: "역사 박물관 개관 (기록 150, 검증된 데이터 5)", action: "build_historyMuseum" });
        }
        Object.keys(gameState.sections).forEach(key => {
            const section = gameState.sections[key];
            if (section.built && section.durability < 100) {
                dynamicChoices.push({ text: `${section.name} 보수 (규칙 10, 사실 10)`, action: "maintain_section", params: { section: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}' >${choice.text}</button>`).join('');
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

// --- Game Data (ISTJ Themed) ---
const gameScenarios = {
    "intro": { text: "오늘은 보관소를 위해 무엇을 하시겠습니까?", choices: [
        { text: "기록 감사", action: "audit_records" },
        { text: "기록관 면담", action: "interview_archivist" },
        { text: "정기 보고", action: "regular_report" },
        { text: "자료 수집", action: "show_resource_gathering_options" },
        { text: "섹션 관리", action: "show_section_management_options" },
        { text: "휴식 시간", action: "show_break_time_options" },
        { text: "오늘의 업무", action: "play_minigame" }
    ]},
    "action_resource_gathering": {
        text: "어떤 자료를 수집하시겠습니까?",
        choices: [
            { text: "사실 수집", action: "gather_facts" },
            { text: "규칙 제정", action: "establish_rules" },
            { text: "기록 보관", action: "archive_records" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    "action_section_management": { text: "어떤 섹션을 관리하시겠습니까?", choices: [] },
    "break_time_menu": {
        text: "어떤 휴식을 취하시겠습니까?",
        choices: [
            { text: "서고 정리 (업무력 1 소모)", action: "organize_archives" },
            { text: "규정집 정독 (업무력 1 소모)", action: "read_rulebook" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    // Game Over Scenarios
    "game_over_responsibility": { text: "책임감의 무게를 이기지 못했습니다. 기록 보관소는 혼란에 빠집니다.", choices: [], final: true },
    "game_over_stability": { text: "보관소의 안정성이 무너졌습니다. 더 이상 신뢰할 수 있는 기록은 없습니다.", choices: [], final: true },
    "game_over_order": { text: "질서가 사라진 보관소는 단순한 종이 더미일 뿐입니다.", choices: [], final: true },
    "game_over_resources": { text: "보관소를 유지할 자원이 모두 소진되었습니다.", choices: [], final: true },
};

const auditOutcomes = [
    { weight: 30, condition: (gs) => gs.accuracy > 60, effect: (gs) => { const v = getRandomValue(10, 5); return { changes: { stability: gs.stability + v }, message: `완벽한 감사로 보관소의 안정성이 크게 향상되었습니다! (+${v} 안정성)` }; } },
    { weight: 25, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { order: gs.order + v }, message: `기록 감사를 통해 보관소의 질서를 바로잡았습니다. (+${v} 질서)` }; } },
    { weight: 20, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { resources: { ...gs.resources, records: gs.resources.records - v } }, message: `감사 중 오래된 기록 일부가 회손되었습니다. (-${v} 기록)` }; } },
    { weight: 15, condition: (gs) => gs.accuracy < 40, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { efficiency: gs.efficiency - v }, message: `부정확한 감사로 인해 업무 효율성이 떨어집니다. (-${v} 효율성)` }; } },
];

const interviewOutcomes = [
    { weight: 40, condition: (gs, archivist) => archivist.reliability < 80, effect: (gs, archivist) => { const v = getRandomValue(10, 5); const updated = gs.archivists.map(a => a.id === archivist.id ? { ...a, reliability: Math.min(100, a.reliability + v) } : a); return { changes: { archivists: updated }, message: `${archivist.name}${getWaGwaParticle(archivist.name)}의 체계적인 면담으로 신뢰도가 상승했습니다. (+${v} 신뢰도)` }; } },
    { weight: 30, condition: () => true, effect: (gs, archivist) => { const v = getRandomValue(5, 2); return { changes: { accuracy: gs.accuracy + v }, message: `${archivist.name}에게서 중요한 사실을 확인했습니다. (+${v} 정확성)` }; } },
    { weight: 20, condition: (gs) => gs.order < 40, effect: (gs, archivist) => { const v = getRandomValue(10, 3); const updated = gs.archivists.map(a => a.id === archivist.id ? { ...a, reliability: Math.max(0, a.reliability - v) } : a); return { changes: { archivists: updated }, message: `보관소의 질서가 어지러워 ${archivist.name}이(가) 불만을 표합니다. (-${v} 신뢰도)` }; } },
];

const reportOutcomes = [
    { weight: 40, condition: (gs) => gs.accuracy > 60, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { stability: gs.stability + v }, message: `정확한 정기 보고로 보관소의 안정성이 강화됩니다. (+${v} 안정성)` }; } },
    { weight: 30, condition: () => true, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { efficiency: gs.efficiency + v }, message: `보고서를 작성하며 업무 프로세스를 개선했습니다. (+${v} 효율성)` }; } },
    { weight: 20, condition: (gs) => gs.responsibility < 40, effect: (gs) => { const v = getRandomValue(10, 4); return { changes: { order: gs.order - v }, message: `책임감 없는 보고서로 인해 보관소의 질서가 흔들립니다. (-${v} 질서)` }; } },
];

const minigames = [
    {
        name: "문서 분류하기",
        description: "주어진 규칙에 따라 문서를 올바른 카테고리로 분류하세요.",
        start: (gameArea, choicesDiv) => {
            const categories = ["역사", "과학", "법률"];
            const documents = [{ doc: "갈릴레오의 재판 기록", cat: "역사" }, { doc: "뉴턴의 프린키피아 원고", cat: "과학" }].sort(() => currentRandFn() - 0.5);
            gameState.minigameState = { score: 0, stage: 1, problems: documents };
            minigames[0].render(gameArea, choicesDiv);
        },
        render: (gameArea, choicesDiv) => {
            const state = gameState.minigameState;
            if (state.stage > state.problems.length) { minigames[0].end(); return; }
            const problem = state.problems[state.stage - 1];
            gameArea.innerHTML = `<p><b>문서:</b> ${problem.doc}</p><p>어디에 보관하시겠습니까?</p>`;
            choicesDiv.innerHTML = ["역사", "과학", "법률"].map(cat => `<button class="choice-btn">${cat}</button>`).join('');
            choicesDiv.querySelectorAll('.choice-btn').forEach(button => button.addEventListener('click', () => minigames[0].processAction('select_category', button.innerText)));
        },
        processAction: (actionType, value) => {
            const state = gameState.minigameState;
            const problem = state.problems[state.stage - 1];
            if (value === problem.cat) { state.score += 50; updateGameDisplay("정확한 분류입니다!"); } else { updateGameDisplay("분류에 오류가 있었습니다."); }
            state.stage++;
            setTimeout(() => minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices')), 1500);
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({ accuracy: gameState.accuracy + rewards.accuracy, efficiency: gameState.efficiency + rewards.efficiency, currentScenarioId: 'intro' }, rewards.message);
        }
    },
];

function calculateMinigameReward(minigameName, score) {
    let rewards = { accuracy: 0, efficiency: 0, message: "" };
    if (score >= 100) { rewards.accuracy = 15; rewards.efficiency = 10; rewards.message = `완벽한 분류입니다! (+15 정확성, +10 효율성)`; } 
    else if (score >= 50) { rewards.accuracy = 10; rewards.efficiency = 5; rewards.message = `정확한 분류입니다. (+10 정확성, +5 효율성)`; } 
    else { rewards.accuracy = 5; rewards.message = `분류 작업을 완료했습니다. (+5 정확성)`; }
    return rewards;
}

function spendActionPoint() {
    if (gameState.actionPoints <= 0) { updateGameDisplay("업무력이 부족합니다."); return false; }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    audit_records: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = auditOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    interview_archivist: () => {
        if (!spendActionPoint()) return;
        const archivist = gameState.archivists[Math.floor(currentRandFn() * gameState.archivists.length)];
        const possibleOutcomes = interviewOutcomes.filter(o => !o.condition || o.condition(gameState, archivist));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState, archivist);
        updateState(result.changes, result.message);
    },
    regular_report: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = reportOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    show_resource_gathering_options: () => updateState({ currentScenarioId: 'action_resource_gathering' }),
    show_section_management_options: () => updateState({ currentScenarioId: 'action_section_management' }),
    show_break_time_options: () => updateState({ currentScenarioId: 'break_time_menu' }),
    gather_facts: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, facts: gameState.resources.facts + gain } }, `새로운 사실을 수집했습니다. (+${gain} 사실)`);
    },
    establish_rules: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, rules: gameState.resources.rules + gain } }, `명확한 규칙을 제정했습니다. (+${gain} 규칙)`);
    },
    archive_records: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(5, 2);
        updateState({ resources: { ...gameState.resources, records: gameState.resources.records + gain } }, `기록을 보관 처리했습니다. (+${gain} 기록)`);
    },
    build_factArchive: () => {
        if (!spendActionPoint()) return;
        const cost = { records: 50, rules: 20 };
        if (gameState.resources.records >= cost.records && gameState.resources.rules >= cost.rules) {
            gameState.sections.factArchive.built = true;
            const v = getRandomValue(10, 3);
            updateState({ accuracy: gameState.accuracy + v, resources: { ...gameState.resources, records: gameState.resources.records - cost.records, rules: gameState.resources.rules - cost.rules } }, `사실 기록고를 건설했습니다! (+${v} 정확성)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_rulebookRoom: () => {
        if (!spendActionPoint()) return;
        const cost = { rules: 30, facts: 30 };
        if (gameState.resources.rules >= cost.rules && gameState.resources.facts >= cost.facts) {
            gameState.sections.rulebookRoom.built = true;
            const v = getRandomValue(10, 3);
            updateState({ order: gameState.order + v, resources: { ...gameState.resources, rules: gameState.resources.rules - cost.rules, facts: gameState.resources.facts - cost.facts } }, `규정집의 방을 건설했습니다! (+${v} 질서)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_centralControl: () => {
        if (!spendActionPoint()) return;
        const cost = { records: 100, rules: 50 };
        if (gameState.resources.records >= cost.records && gameState.resources.rules >= cost.rules) {
            gameState.sections.centralControl.built = true;
            const v = getRandomValue(15, 5);
            updateState({ responsibility: gameState.responsibility + v, resources: { ...gameState.resources, records: gameState.resources.records - cost.records, rules: gameState.resources.rules - cost.rules } }, `중앙 통제실을 건설했습니다! (+${v} 책임감)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_dataSecurity: () => {
        if (!spendActionPoint()) return;
        const cost = { rules: 80, facts: 40 };
        if (gameState.resources.rules >= cost.rules && gameState.resources.facts >= cost.facts) {
            gameState.sections.dataSecurity.built = true;
            const v = getRandomValue(15, 5);
            updateState({ stability: gameState.stability + v, resources: { ...gameState.resources, rules: gameState.resources.rules - cost.rules, facts: gameState.resources.facts - cost.facts } }, `데이터 보안부를 신설했습니다! (+${v} 안정성)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_historyMuseum: () => {
        if (!spendActionPoint()) return;
        const cost = { records: 150, verified_data: 5 };
        if (gameState.resources.records >= cost.records && gameState.resources.verified_data >= cost.verified_data) {
            gameState.sections.historyMuseum.built = true;
            const v = getRandomValue(20, 5);
            updateState({ tradition: gameState.tradition + v, resources: { ...gameState.resources, records: gameState.resources.records - cost.records, verified_data: gameState.resources.verified_data - cost.verified_data } }, `역사 박물관을 개관했습니다! (+${v} 전통)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    maintain_section: (params) => {
        if (!spendActionPoint()) return;
        const sectionKey = params.section;
        const cost = { rules: 10, facts: 10 };
        if (gameState.resources.rules >= cost.rules && gameState.resources.facts >= cost.facts) {
            gameState.sections[sectionKey].durability = 100;
            updateState({ resources: { ...gameState.resources, rules: gameState.resources.rules - cost.rules, facts: gameState.resources.facts - cost.facts } }, `${gameState.sections[sectionKey].name} 섹션을 보수했습니다.`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    organize_archives: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.5) {
            const v = getRandomValue(10, 5);
            updateState({ efficiency: gameState.efficiency + v }, `서고를 완벽하게 정리하여 효율성이 상승했습니다! (+${v} 효율성)`);
        } else {
            const v = getRandomValue(5, 2);
            updateState({ order: gameState.order - v }, `정리 중 작은 실수가 있었습니다. (-${v} 질서)`);
        }
    },
    read_rulebook: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.6) {
            const v = getRandomValue(10, 5);
            updateState({ tradition: gameState.tradition + v }, `규정집을 정독하며 보관소의 전통을 되새겼습니다. (+${v} 전통)`);
        } else {
            updateState({}, `규정집은 변함이 없었습니다.`);
        }
    },
    play_minigame: () => {
        if (!spendActionPoint()) return;
        const minigame = minigames[0];
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } });
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 다음 날로 넘어갈 수 없습니다."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
};

function applyStatEffects() {
    let message = "";
    if (gameState.responsibility >= 70) { message += "강한 책임감으로 보관소의 신뢰도가 상승합니다. "; }
    if (gameState.stability >= 70) { const v = getRandomValue(5, 2); gameState.resources.records += v; message += `보관소가 안정되어 새로운 기록이 발견됩니다. (+${v} 기록) `; }
    if (gameState.order >= 70) { const v = getRandomValue(2, 1); gameState.archivists.forEach(a => a.reliability = Math.min(100, a.reliability + v)); message += `확립된 질서 덕분에 기록관들의 신뢰도가 상승합니다. (+${v} 신뢰도) `; }
    if (gameState.accuracy < 30) { gameState.actionPoints -= 1; message += "정확성이 떨어져 업무력이 1 감소합니다. "; }
    if (gameState.efficiency < 30) { Object.keys(gameState.sections).forEach(key => { if(gameState.sections[key].built) gameState.sections[key].durability -= 1; }); message += "효율성이 저하되어 섹션들이 노후화됩니다. "; }
    return message;
}

const weightedDailyEvents = [
    { id: "system_error", weight: 10, condition: () => gameState.efficiency < 40, onTrigger: () => { const v = getRandomValue(10, 3); updateState({ efficiency: gameState.efficiency - v, stability: gameState.stability - v }, `시스템 오류가 발생했습니다. (-${v} 효율성, -${v} 안정성)`); } },
    { id: "rule_conflict", weight: 5, condition: () => true, onTrigger: () => { const v = getRandomValue(15, 5); updateState({ resources: { ...gameState.resources, rules: Math.max(0, gameState.resources.rules - v) }, order: gameState.order - 5 }, `규칙 간 충돌이 발견되어 일부 규칙을 폐기합니다. (-${v} 규칙, -5 질서)`); } },
    { id: "new_data_verified", weight: 15, condition: () => true, onTrigger: () => { const v = getRandomValue(10, 5); updateState({ accuracy: gameState.accuracy + v }, `새로운 데이터가 검증되었습니다! (+${v} 정확성)`); } },
];

function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
    updateState({ actionPoints: 10, dailyEventTriggered: true });
    const statEffectMessage = applyStatEffects();
    let dailyMessage = "기록 보관소에 새로운 아침이 밝았습니다. " + statEffectMessage;

    if (gameState.responsibility <= 0) { gameState.currentScenarioId = "game_over_responsibility"; }
    else if (gameState.stability <= 0) { gameState.currentScenarioId = "game_over_stability"; }
    else if (gameState.order <= 0) { gameState.currentScenarioId = "game_over_order"; }
    else if (gameState.resources.facts <= 0 && gameState.day > 1) { gameState.currentScenarioId = "game_over_resources"; }

    let eventId = "intro";
    const possibleEvents = weightedDailyEvents.filter(event => !event.condition || event.condition());
    if (possibleEvents.length > 0) {
        const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenEvent = possibleEvents.find(event => (cumulativeWeight += event.weight) >= rand);
        if (chosenEvent) {
            eventId = chosenEvent.id;
            if (chosenEvent.onTrigger) chosenEvent.onTrigger();
        }
    }
    if (!gameScenarios[gameState.currentScenarioId]) {
        gameState.currentScenarioId = eventId;
    }
    updateGameDisplay(dailyMessage + (gameScenarios[gameState.currentScenarioId]?.text || ''));
    renderChoices(gameScenarios[gameState.currentScenarioId]?.choices || []);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 기록 보관소를 폐쇄하시겠습니까? 모든 기록이 사라집니다.")) {
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
