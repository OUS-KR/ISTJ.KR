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

function getRandomValue(base, variance) {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(currentRandFn() * (max - min + 1)) + min;
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
        precision: 50,
        efficiency: 50,
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
        if (loaded.precision === undefined) loaded.precision = 50;
        if (loaded.efficiency === undefined) loaded.efficiency = 50;
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
        <p><b>책임감:</b> ${gameState.responsibility} | <b>안정성:</b> ${gameState.stability} | <b>질서:</b> ${gameState.order} | <b>정확성:</b> ${gameState.precision} | <b>효율성:</b> ${gameState.efficiency}</p>
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
    "daily_event_data_loss": { text: "", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_rule_conflict": { text: "", choices: [{ text: "확인", action: "return_to_intro" }] },
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
    "daily_event_system_glitch": { text: "", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_unexpected_audit": { text: "", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_resource_discovery": { text: "", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_archivist_dispute": {
        text: "기록관들 사이에 업무 방식에 대한 논쟁이 발생했습니다. 당신의 중재가 필요합니다.",
        choices: [
            { text: "원칙에 따라 중재한다.", action: "mediate_dispute_principled" },
            { text: "효율성을 우선하여 중재한다.", action: "mediate_dispute_efficient" },
            { text: "개입하지 않는다.", action: "ignore_dispute" }
        ]
    },
    "daily_event_external_pressure": {
        text: "외부로부터 규정 완화에 대한 압력이 들어왔습니다. 어떻게 대응하시겠습니까?",
        choices: [
            { text: "원칙을 고수한다.", action: "uphold_principles" },
            { text: "일부 유연성을 발휘한다.", action: "show_flexibility" },
            { text: "압력을 무시한다.", action: "ignore_pressure" }
        ]
    },
    "game_over_responsibility": { text: "책임감 부족으로 기록 보관소의 신뢰가 무너졌습니다.", choices: [], final: true },
    "game_over_stability": { text: "안정성을 잃은 보관소는 혼란에 빠졌습니다.", choices: [], final: true },
    "game_over_order": { text: "질서가 무너져 모든 기록이 뒤섞였습니다.", choices: [], final: true },
    "game_over_precision": { text: "정확성이 떨어져 기록 보관소의 신뢰를 잃었습니다.", choices: [], final: true },
    "game_over_efficiency": { text: "비효율적인 운영으로 기록 보관소가 마비되었습니다.", choices: [], final: true },
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
    },
    "archivist_dispute_result": {
        text: "",
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "external_pressure_result": {
        text: "",
        choices: [{ text: "확인", action: "return_to_intro" }]
    }
};

const auditOutcomes = [
    {
        condition: (gs) => gs.order < 50,
        weight: 30,
        effect: (gs) => {
            const orderGain = getRandomValue(5, 2);
            const precisionGain = getRandomValue(3, 1);
            return {
                changes: { order: gs.order + orderGain, precision: gs.precision + precisionGain },
                message: `기록 감사 중 사소한 규칙 위반을 발견하고 바로잡았습니다. (+${orderGain} 질서, +${precisionGain} 정확성)`
            };
        }
    },
    {
        condition: (gs) => gs.resources.facts < 30,
        weight: 25,
        effect: (gs) => {
            const factsGain = getRandomValue(10, 5);
            return {
                changes: { resources: { ...gs.resources, facts: gs.resources.facts + factsGain } },
                message: `오래된 기록에서 중요한 사실 자료를 발견했습니다! (+${factsGain} 사실)`
            };
        }
    },
    {
        condition: (gs) => gs.efficiency < 50,
        weight: 20,
        effect: (gs) => {
            const efficiencyGain = getRandomValue(5, 2);
            return {
                changes: { efficiency: gs.efficiency + efficiencyGain },
                message: `감사 과정에서 비효율적인 절차를 개선했습니다. (+${efficiencyGain} 효율성)`
            };
        }
    },
    {
        condition: () => true, // Default outcome
        weight: 25,
        effect: (gs) => {
            const responsibilityGain = getRandomValue(3, 1);
            return {
                changes: { responsibility: gs.responsibility + responsibilityGain },
                message: `기록 감사를 완료했습니다. 특별한 문제는 없었지만, 업무에 대한 책임감이 고취됩니다. (+${responsibilityGain} 책임감)`
            };
        }
    }
];

const talkOutcomes = [
    {
        condition: (gs, archivist) => archivist.reliability < 60,
        weight: 40,
        effect: (gs, archivist) => {
            const reliabilityGain = getRandomValue(10, 5);
            const responsibilityGain = getRandomValue(5, 2);
            const updatedArchivists = gs.archivists.map(a => a.id === archivist.id ? { ...a, reliability: Math.min(100, a.reliability + reliabilityGain) } : a);
            return {
                changes: { archivists: updatedArchivists, responsibility: gs.responsibility + responsibilityGain },
                message: `${archivist.name}${getWaGwaParticle(archivist.name)} 면담을 통해 그의 신뢰도를 높이고 당신의 책임감을 고취했습니다. (+${reliabilityGain} ${archivist.name} 신뢰도, +${responsibilityGain} 책임감)`
            };
        }
    },
    {
        condition: (gs, archivist) => archivist.personality === "원칙주의자",
        weight: 20,
        effect: (gs, archivist) => {
            const orderGain = getRandomValue(10, 3);
            const precisionGain = getRandomValue(5, 2);
            return {
                changes: { order: gs.order + orderGain, precision: gs.precision + precisionGain },
                message: `${archivist.name}와(과) 원칙에 대한 심도 깊은 대화를 나누며 질서와 정확성이 상승했습니다. (+${orderGain} 질서, +${precisionGain} 정확성)`
            };
        }
    },
    {
        condition: (gs, archivist) => archivist.skill === "데이터 분석",
        weight: 15,
        effect: (gs, archivist) => {
            const efficiencyGain = getRandomValue(5, 2);
            return {
                changes: { efficiency: gs.efficiency + efficiencyGain },
                message: `${archivist.name}에게서 효율적인 데이터 분석 방법을 배워 효율성이 향상되었습니다. (+${efficiencyGain} 효율성)`
            };
        }
    },
    {
        condition: () => true, // Default positive outcome
        weight: 25,
        effect: (gs, archivist) => {
            const stabilityGain = getRandomValue(5, 2);
            const responsibilityGain = getRandomValue(3, 1);
            return {
                changes: { stability: gs.stability + stabilityGain, responsibility: gs.responsibility + responsibilityGain },
                message: `${archivist.name}와(과) 업무에 대한 이야기를 나누며 보관소의 안정성과 당신의 책임감이 조금 더 단단해졌습니다. (+${stabilityGain} 안정성, +${responsibilityGain} 책임감)`
            };
        }
    },
    {
        condition: (gs) => gs.stability < 40,
        weight: 20, // Increased weight when conditions met
        effect: (gs, archivist) => {
            const reliabilityLoss = getRandomValue(10, 3);
            const stabilityLoss = getRandomValue(5, 2);
            const orderLoss = getRandomValue(5, 2);
            const updatedArchivists = gs.archivists.map(a => a.id === archivist.id ? { ...a, reliability: Math.max(0, a.reliability - reliabilityLoss) } : a);
            return {
                changes: { archivists: updatedArchivists, stability: gs.stability - stabilityLoss, order: gs.order - orderLoss },
                message: `${archivist.name}와(과)의 대화 중 불만이 터져 나와 신뢰도와 안정성, 질서가 감소했습니다. (-${reliabilityLoss} ${archivist.name} 신뢰도, -${stabilityLoss} 안정성, -${orderLoss} 질서)`
            };
        }
    },
    {
        condition: (gs) => gs.efficiency < 30,
        weight: 15, // Increased weight when conditions met
        effect: (gs, archivist) => {
            const actionLoss = getRandomValue(1, 0);
            const precisionLoss = getRandomValue(5, 2);
            return {
                changes: { actionPoints: gs.actionPoints - actionLoss, precision: gs.precision - precisionLoss },
                message: `${archivist.name}와(과)의 대화가 길어졌지만, 비효율적인 논의로 업무력과 정확성이 감소했습니다. (-${actionLoss} 업무력, -${precisionLoss} 정확성)`
            };
        }
    }
];

const reportOutcomes = [
    {
        condition: (gs) => gs.order > 70 && gs.precision > 70,
        weight: 30,
        effect: (gs) => {
            const stabilityGain = getRandomValue(15, 5);
            const efficiencyGain = getRandomValue(10, 3);
            return {
                changes: { stability: gs.stability + stabilityGain, efficiency: gs.efficiency + efficiencyGain },
                message: `정확하고 질서정연한 보고를 통해 보관소의 안정성과 효율성이 크게 향상되었습니다! (+${stabilityGain} 안정성, +${efficiencyGain} 효율성)`
            };
        }
    },
    {
        condition: (gs) => gs.responsibility < 40,
        weight: 25,
        effect: (gs) => {
            const responsibilityLoss = getRandomValue(10, 4);
            const orderLoss = getRandomValue(5, 2);
            return {
                changes: { responsibility: gs.responsibility - responsibilityLoss, order: gs.order - orderLoss },
                message: `보고 내용에 중대한 누락이 발견되었습니다. 당신의 책임감과 보관소의 질서가 감소합니다. (-${responsibilityLoss} 책임감, -${orderLoss} 질서)`
            };
        }
    },
    {
        condition: (gs) => gs.resources.logs < 20,
        weight: 20,
        effect: (gs) => {
            const logsGain = getRandomValue(10, 5);
            return {
                changes: { resources: { ...gs.resources, logs: gs.resources.logs + logsGain } },
                message: `보고서 작성 중 새로운 기록 자료를 정리했습니다. (+${logsGain} 기록)`
            };
        }
    },
    {
        condition: () => true, // Default outcome
        weight: 25,
        effect: (gs) => {
            const stabilityGain = getRandomValue(5, 2);
            const orderGain = getRandomValue(3, 1);
            return {
                changes: { stability: gs.stability + stabilityGain, order: gs.order + orderGain },
                message: `정기 보고를 완료했습니다. 보관소의 안정성과 질서가 유지됩니다. (+${stabilityGain} 안정성, +${orderGain} 질서)`
            };
        }
    }
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

        const possibleOutcomes = auditOutcomes.filter(outcome => outcome.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
        const rand = currentRandFn() * totalWeight;

        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(outcome => {
            cumulativeWeight += outcome.weight;
            return rand < cumulativeWeight;
        });

        if (!chosenOutcome) { // Fallback to default if something goes wrong
            chosenOutcome = auditOutcomes.find(o => o.condition());
        }

        const result = chosenOutcome.effect(gameState);
        updateState({ ...result.changes, dailyActions: { ...gameState.dailyActions, audited: true } }, result.message);
    },
    talk_to_archivists: () => {
        if (!spendActionPoint()) return;
        const archivist = gameState.archivists[Math.floor(currentRandFn() * gameState.archivists.length)];
        if (gameState.dailyActions.talkedTo.includes(archivist.id)) { updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, archivist.id] } }, `${archivist.name}${getWaGwaParticle(archivist.name)} 이미 면담했습니다.`); return; }
        
        const possibleOutcomes = talkOutcomes.filter(outcome => outcome.condition(gameState, archivist));
        const totalWeight = possibleOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
        const rand = currentRandFn() * totalWeight;

        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(outcome => {
            cumulativeWeight += outcome.weight;
            return rand < cumulativeWeight;
        });

        if (!chosenOutcome) { // Fallback to default if something goes wrong
            chosenOutcome = talkOutcomes.find(o => o.condition());
        }

        const result = chosenOutcome.effect(gameState, archivist);
        updateState({ ...result.changes, dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, archivist.id] } }, result.message);
    },
    receive_report: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.reportReceived) { updateState({ dailyActions: { ...gameState.dailyActions, reportReceived: true } }, "오늘은 이미 정기 보고를 받았습니다."); return; }

        const possibleOutcomes = reportOutcomes.filter(outcome => outcome.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
        const rand = currentRandFn() * totalWeight;

        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(outcome => {
            cumulativeWeight += outcome.weight;
            return rand < cumulativeWeight;
        });

        if (!chosenOutcome) { // Fallback to default if something goes wrong
            chosenOutcome = reportOutcomes.find(o => o.condition());
        }

        const result = chosenOutcome.effect(gameState);
        updateState({ ...result.changes, dailyActions: { ...gameState.dailyActions, reportReceived: true } }, result.message);
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
        let reward = { responsibility: 0, stability: 0, order: 0, precision: 0, efficiency: 0 };
        
        if (choice === "strict") {
            const orderGain = getRandomValue(5, 2);
            const stabilityLoss = getRandomValue(2, 1);
            message = `원칙에 따라 엄격하게 해석했습니다. (+${orderGain} 질서, -${stabilityLoss} 안정성)`;
            reward.order += orderGain;
            reward.stability -= stabilityLoss;
        } else {
            const stabilityGain = getRandomValue(5, 2);
            const orderLoss = getRandomValue(2, 1);
            message = `현실을 고려하여 유연하게 해석했습니다. (+${stabilityGain} 안정성, -${orderLoss} 질서)`;
            reward.stability += stabilityGain;
            reward.order -= orderLoss;
        }
        
        updateState({ ...reward, currentScenarioId: 'difference_resolution_result' }, message);
    },
    mediate_difference: () => {
        if (!spendActionPoint()) return;
        const orderGain = getRandomValue(10, 3);
        const responsibilityGain = getRandomValue(5, 2);
        const precisionGain = getRandomValue(5, 2);
        const message = `과거의 판례를 통해 명확한 기준을 세웠습니다. (+${orderGain} 질서, +${responsibilityGain} 책임감, +${precisionGain} 정확성)`;
        updateState({ order: gameState.order + orderGain, responsibility: gameState.responsibility + responsibilityGain, precision: gameState.precision + precisionGain, currentScenarioId: 'difference_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const stabilityLoss = getRandomValue(10, 3);
        const orderLoss = getRandomValue(5, 2);
        const message = `결정을 보류했습니다. 기록관들의 혼란이 가중됩니다. (-${stabilityLoss} 안정성, -${orderLoss} 질서)`;
        updateState({ stability: gameState.stability - stabilityLoss, order: gameState.order - orderLoss, currentScenarioId: 'difference_resolution_result' }, message);
    },
    mediate_dispute_principled: () => {
        if (!spendActionPoint()) return;
        const orderGain = getRandomValue(10, 3);
        const responsibilityGain = getRandomValue(5, 2);
        const message = `원칙에 따라 기록관들의 논쟁을 중재했습니다. 질서와 책임감이 향상됩니다. (+${orderGain} 질서, +${responsibilityGain} 책임감)`;
        updateState({ order: gameState.order + orderGain, responsibility: gameState.responsibility + responsibilityGain, currentScenarioId: 'archivist_dispute_result' }, message);
    },
    mediate_dispute_efficient: () => {
        if (!spendActionPoint()) return;
        const efficiencyGain = getRandomValue(10, 3);
        const stabilityGain = getRandomValue(5, 2);
        const message = `효율성을 우선하여 기록관들의 논쟁을 중재했습니다. 효율성과 안정성이 향상됩니다. (+${efficiencyGain} 효율성, +${stabilityGain} 안정성)`;
        updateState({ efficiency: gameState.efficiency + efficiencyGain, stability: gameState.stability + stabilityGain, currentScenarioId: 'archivist_dispute_result' }, message);
    },
    ignore_dispute: () => {
        if (!spendActionPoint()) return;
        const orderLoss = getRandomValue(10, 3);
        const efficiencyLoss = getRandomValue(5, 2);
        const message = `기록관들의 논쟁에 개입하지 않았습니다. 질서와 효율성이 저하됩니다. (-${orderLoss} 질서, -${efficiencyLoss} 효율성)`;
        updateState({ order: gameState.order - orderLoss, efficiency: gameState.efficiency - efficiencyLoss, currentScenarioId: 'archivist_dispute_result' }, message);
    },
    uphold_principles: () => {
        if (!spendActionPoint()) return;
        const responsibilityGain = getRandomValue(10, 3);
        const orderGain = getRandomValue(5, 2);
        const message = `외부 압력에도 불구하고 원칙을 고수했습니다. 책임감과 질서가 강화됩니다. (+${responsibilityGain} 책임감, +${orderGain} 질서)`;
        updateState({ responsibility: gameState.responsibility + responsibilityGain, order: gameState.order + orderGain, currentScenarioId: 'external_pressure_result' }, message);
    },
    show_flexibility: () => {
        if (!spendActionPoint()) return;
        const stabilityGain = getRandomValue(10, 3);
        const efficiencyGain = getRandomValue(5, 2);
        const message = `일부 유연성을 발휘하여 외부 압력에 대응했습니다. 안정성과 효율성이 향상됩니다. (+${stabilityGain} 안정성, +${efficiencyGain} 효율성)`;
        updateState({ stability: gameState.stability + stabilityGain, efficiency: gameState.efficiency + efficiencyGain, currentScenarioId: 'external_pressure_result' }, message);
    },
    ignore_pressure: () => {
        if (!spendActionPoint()) return;
        const stabilityLoss = getRandomValue(10, 3);
        const responsibilityLoss = getRandomValue(5, 2);
        const message = `외부 압력을 무시했습니다. 보관소의 안정성과 당신의 책임감이 저하됩니다. (-${stabilityLoss} 안정성, -${responsibilityLoss} 책임감)`;
        updateState({ stability: gameState.stability - stabilityLoss, responsibility: gameState.responsibility - responsibilityLoss, currentScenarioId: 'external_pressure_result' }, message);
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_gather_facts: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.archiveLevel * 0.1) + (gameState.dailyBonus.verificationSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            const factsGain = getRandomValue(5, 2);
            message = `역사적 사실을 수집했습니다! (+${factsGain} 사실)`;
            changes.resources = { ...gameState.resources, facts: gameState.resources.facts + factsGain };
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
            const rulesGain = getRandomValue(5, 2);
            message = `법률 및 규칙을 검토했습니다! (+${rulesGain} 규칙)`;
            changes.resources = { ...gameState.resources, rules: gameState.resources.rules + rulesGain };
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
            const logsGain = getRandomValue(5, 2);
            message = `업무일지를 작성했습니다! (+${logsGain} 기록)`;
            changes.resources = { ...gameState.resources, logs: gameState.resources.logs + logsGain };
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
            const orderGain = getRandomValue(10, 3);
            message = `사실 기록고를 건설했습니다! (+${orderGain} 질서)`;
            changes.order = gameState.order + orderGain;
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
            const stabilityGain = getRandomValue(10, 3);
            message = `규정집의 방을 구축했습니다! (+${stabilityGain} 안정성)`;
            changes.stability = gameState.stability + stabilityGain;
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
            const orderGain = getRandomValue(20, 5);
            const stabilityGain = getRandomValue(20, 5);
            message = `중앙 통제실을 건설했습니다! (+${orderGain} 질서, +${stabilityGain} 안정성)`;
            changes.order = gameState.order + orderGain;
            changes.stability = gameState.stability + stabilityGain;
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
            const responsibilityGain = getRandomValue(15, 5);
            const orderGain = getRandomValue(10, 3);
            message = `데이터 보안부를 신설했습니다! (+${responsibilityGain} 책임감, +${orderGain} 질서)`;
            changes.responsibility = gameState.responsibility + responsibilityGain;
            changes.order = gameState.order + orderGain;
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
            const precisionGain = getRandomValue(15, 5);
            const efficiencyGain = getRandomValue(10, 3);
            message = `역사 박물관을 개관했습니다! (+${precisionGain} 정확성, +${efficiencyGain} 효율성)`;
            changes.precision = gameState.precision + precisionGain;
            changes.efficiency = gameState.efficiency + efficiencyGain;
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
            message = `${gameState.sections[facilityKey].name} 섹션의 보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
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
        if (rand < 0.3) { 
            const rulesGain = getRandomValue(20, 5);
            const logsGain = getRandomValue(20, 5);
            updateState({ resources: { ...gameState.resources, rules: gameState.resources.rules + rulesGain, logs: gameState.resources.logs + logsGain } }); 
            updateGameDisplay(`과거 사건 검토 중 누락된 규정을 발견했습니다! (+${rulesGain} 규칙, +${logsGain} 기록)`); 
        }
        else if (rand < 0.5) { 
            const stabilityGain = getRandomValue(10, 3);
            const orderGain = getRandomValue(10, 3);
            updateState({ stability: gameState.stability + stabilityGain, order: gameState.order + orderGain }); 
            updateGameDisplay(`과거 사건에서 현재의 질서를 바로잡을 교훈을 얻었습니다. (+${stabilityGain} 안정성, +${orderGain} 질서)`); 
        }
        else { updateGameDisplay("과거 사건을 검토했지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_request: () => {
        if (!spendActionPoint()) return;
        if (gameState.resources.logs >= 50) {
            const verifiedDataGain = getRandomValue(1, 0);
            const stabilityGain = getRandomValue(5, 2);
            updateState({ resources: { ...gameState.resources, logs: gameState.resources.logs - 50, verified_data: (gameState.resources.verified_data || 0) + verifiedDataGain }, stability: gameState.stability + stabilityGain });
            updateGameDisplay(`데이터 검증을 완료하여 검증된 데이터를 얻었습니다! (+${verifiedDataGain} 검증된 데이터) 보관소의 안정성이 향상됩니다. (+${stabilityGain} 안정성)`);
        } else { updateGameDisplay("검증에 필요한 기록이 부족합니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    decline_request: () => {
        if (!spendActionPoint()) return;
        const responsibilityLoss = getRandomValue(5, 2);
        updateState({ responsibility: gameState.responsibility - responsibilityLoss, currentScenarioId: 'intro' }, `외부 기관의 요청을 거절했습니다. 당신의 책임감이 약간 감소합니다. (-${responsibilityLoss} 책임감)`);
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

function calculateMinigameReward(minigameName, score) {
    let rewards = { responsibility: 0, stability: 0, order: 0, precision: 0, efficiency: 0, message: "" };

    switch (minigameName) {
        case "기억력 순서 맞추기":
            if (score >= 51) {
                rewards.responsibility = getRandomValue(15, 5);
                rewards.stability = getRandomValue(10, 3);
                rewards.order = getRandomValue(5, 2);
                rewards.precision = getRandomValue(5, 2);
                rewards.message = `완벽한 기억력입니다! 모든 절차를 기억했습니다. (+${rewards.responsibility} 책임감, +${rewards.stability} 안정성, +${rewards.order} 질서, +${rewards.precision} 정확성)`;
            } else if (score >= 21) {
                rewards.responsibility = getRandomValue(10, 3);
                rewards.stability = getRandomValue(5, 2);
                rewards.precision = getRandomValue(3, 1);
                rewards.message = `훌륭한 기억력입니다. (+${rewards.responsibility} 책임감, +${rewards.stability} 안정성, +${rewards.precision} 정확성)`;
            } else if (score >= 0) {
                rewards.responsibility = getRandomValue(5, 2);
                rewards.message = `훈련을 완료했습니다. (+${rewards.responsibility} 책임감)`;
            } else {
                rewards.message = `훈련을 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "사실 확인 퀴즈":
            if (score >= 3) {
                rewards.responsibility = getRandomValue(10, 3);
                rewards.precision = getRandomValue(5, 2);
                rewards.message = `모든 사실을 정확히 확인했습니다! (+${rewards.responsibility} 책임감, +${rewards.precision} 정확성)`;
            } else if (score >= 1) {
                rewards.responsibility = getRandomValue(5, 2);
                rewards.message = `사실 확인 퀴즈를 완료했습니다. (+${rewards.responsibility} 책임감)`;
            } else {
                rewards.message = `사실 확인 퀴즈를 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "오류 검출":
            if (score >= 3) {
                rewards.stability = getRandomValue(10, 3);
                rewards.precision = getRandomValue(5, 2);
                rewards.message = `시스템의 오류를 모두 찾아냈습니다. (+${rewards.stability} 안정성, +${rewards.precision} 정확성)`;
            } else if (score >= 1) {
                rewards.stability = getRandomValue(5, 2);
                rewards.message = `오류 검출을 완료했습니다. (+${rewards.stability} 안정성)`;
            } else {
                rewards.message = `오류 검출을 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "일정 계획":
            if (score >= 3) {
                rewards.order = getRandomValue(10, 3);
                rewards.efficiency = getRandomValue(5, 2);
                rewards.message = `완벽한 일정입니다. 모든 것이 질서정연합니다. (+${rewards.order} 질서, +${rewards.efficiency} 효율성)`;
            } else if (score >= 1) {
                rewards.order = getRandomValue(5, 2);
                rewards.message = `일정 계획을 완료했습니다. (+${rewards.order} 질서)`;
            } else {
                rewards.message = `일정 계획을 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "문서 분류하기":
            if (score >= 3) {
                rewards.responsibility = getRandomValue(5, 2);
                rewards.order = getRandomValue(5, 2);
                rewards.efficiency = getRandomValue(5, 2);
                rewards.message = `모든 문서를 규칙에 맞게 분류했습니다. (+${rewards.responsibility} 책임감, +${rewards.order} 질서, +${rewards.efficiency} 효율성)`;
            } else if (score >= 1) {
                rewards.responsibility = getRandomValue(3, 1);
                rewards.order = getRandomValue(3, 1);
                rewards.message = `문서 분류를 완료했습니다. (+${rewards.responsibility} 책임감, +${rewards.order} 질서)`;
            } else {
                rewards.message = `문서 분류를 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
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
                precision: gameState.precision + rewards.precision,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "사실 확인 퀴즈",
        description: "주어진 정보가 사실인지 아닌지 판단하세요. 3문제 중 2문제 이상 맞히면 성공!",
        start: (gameArea, choicesDiv) => {
            const questions = [
                { q: "ISTJ는 변화에 대한 저항이 강하다.", a: true },
                { q: "ISTJ는 감정 표현에 능숙하다.", a: false },
                { q: "ISTJ는 계획적이고 체계적인 것을 선호한다.", a: true }
            ];
            gameState.minigameState = { questions: questions.sort(() => currentRandFn() - 0.5), currentQ: 0, correctAnswers: 0, score: 0 };
            minigames[1].render(gameArea, choicesDiv);
        },
        render: (gameArea, choicesDiv) => {
            const state = gameState.minigameState;
            if (state.currentQ >= state.questions.length) { minigames[1].end(); return; }
            const q = state.questions[state.currentQ];
            gameArea.innerHTML = `<p><b>문제 ${state.currentQ + 1}:</b> ${q.q}</p>`;
            choicesDiv.innerHTML = `
                <button class="choice-btn" data-answer="true">사실</button>
                <button class="choice-btn" data-answer="false">아님</button>
            `;
            choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
                button.addEventListener('click', () => minigames[1].processAction('answer', button.dataset.answer === 'true'));
            });
        },
        processAction: (actionType, value) => {
            const state = gameState.minigameState;
            if (actionType === 'answer') {
                if (value === state.questions[state.currentQ].a) {
                    state.correctAnswers++;
                    updateGameDisplay("정확합니다!");
                } else {
                    updateGameDisplay("틀렸습니다.");
                }
                state.currentQ++;
                setTimeout(() => minigames[1].render(document.getElementById('gameArea'), document.getElementById('gameChoices')), 1000);
            }
        },
        end: () => {
            const state = gameState.minigameState;
            state.score = state.correctAnswers;
            const rewards = calculateMinigameReward(minigames[1].name, state.score);
            updateState({
                responsibility: gameState.responsibility + rewards.responsibility,
                precision: gameState.precision + rewards.precision,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "오류 검출",
        description: "다음 문장에서 논리적 오류를 찾아내세요. 3문제 중 2문제 이상 맞히면 성공!",
        start: (gameArea, choicesDiv) => {
            const questions = [
                { q: "모든 새는 날 수 있다. 참새는 새다. 그러므로 참새는 날 수 있다.", a: "오류 없음" },
                { q: "비가 오면 땅이 젖는다. 땅이 젖었다. 그러므로 비가 왔다.", a: "오류 있음 (역이의 오류)" },
                { q: "모든 사람은 죽는다. 소크라테스는 사람이다. 그러므로 소크라테스는 죽는다.", a: "오류 없음" }
            ];
            gameState.minigameState = { questions: questions.sort(() => currentRandFn() - 0.5), currentQ: 0, correctAnswers: 0, score: 0 };
            minigames[2].render(gameArea, choicesDiv);
        },
        render: (gameArea, choicesDiv) => {
            const state = gameState.minigameState;
            if (state.currentQ >= state.questions.length) { minigames[2].end(); return; }
            const q = state.questions[state.currentQ];
            gameArea.innerHTML = `<p><b>문제 ${state.currentQ + 1}:</b> ${q.q}</p>`;
            choicesDiv.innerHTML = `
                <button class="choice-btn" data-answer="오류 없음">오류 없음</button>
                <button class="choice-btn" data-answer="오류 있음 (역이의 오류)">오류 있음</button>
            `;
            choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
                button.addEventListener('click', () => minigames[2].processAction('answer', button.dataset.answer));
            });
        },
        processAction: (actionType, value) => {
            const state = gameState.minigameState;
            if (actionType === 'answer') {
                if (value === state.questions[state.currentQ].a) {
                    state.correctAnswers++;
                    updateGameDisplay("정확합니다!");
                } else {
                    updateGameDisplay("틀렸습니다.");
                }
                state.currentQ++;
                setTimeout(() => minigames[2].render(document.getElementById('gameArea'), document.getElementById('gameChoices')), 1000);
            }
        },
        end: () => {
            const state = gameState.minigameState;
            state.score = state.correctAnswers;
            const rewards = calculateMinigameReward(minigames[2].name, state.score);
            updateState({
                stability: gameState.stability + rewards.stability,
                precision: gameState.precision + rewards.precision,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "일정 계획",
        description: "주어진 업무들을 가장 효율적인 순서로 계획하세요. (예: A-B-C 순서로 입력)",
        start: (gameArea, choicesDiv) => {
            const problems = [
                { tasks: ["보고서 작성 (3시간)", "회의 참석 (1시간)", "자료 조사 (2시간)"], correctOrder: "회의 참석-자료 조사-보고서 작성" },
                { tasks: ["이메일 확인 (0.5시간)", "팀원 면담 (2시간)", "문서 정리 (1시간)"], correctOrder: "이메일 확인-문서 정리-팀원 면담" }
            ];
            gameState.minigameState = { problems: problems.sort(() => currentRandFn() - 0.5), currentP: 0, correctOrders: 0, score: 0, playerInput: "" };
            minigames[3].render(gameArea, choicesDiv);
        },
        render: (gameArea, choicesDiv) => {
            const state = gameState.minigameState;
            if (state.currentP >= state.problems.length) { minigames[3].end(); return; }
            const problem = state.problems[state.currentP];
            gameArea.innerHTML = `<p><b>문제 ${state.currentP + 1}:</b> 다음 업무들을 효율적인 순서로 계획하세요.</p><ul>${problem.tasks.map(t => `<li>${t}</li>`).join('')}</ul><input type="text" id="minigameInput" placeholder="예: 회의 참석-자료 조사-보고서 작성" style="width: 100%; padding: 8px; margin-top: 10px;">`;
            choicesDiv.innerHTML = `<button class="choice-btn" data-action="submitOrder">제출</button>`;
            document.getElementById('minigameInput').addEventListener('change', (e) => { state.playerInput = e.target.value; });
            choicesDiv.querySelector('.choice-btn').addEventListener('click', () => minigames[3].processAction('submitOrder'));
        },
        processAction: (actionType) => {
            const state = gameState.minigameState;
            if (actionType === 'submitOrder') {
                const problem = state.problems[state.currentP];
                if (state.playerInput.trim() === problem.correctOrder) {
                    state.correctOrders++;
                    updateGameDisplay("완벽한 계획입니다!");
                } else {
                    updateGameDisplay(`틀렸습니다. 정답은: ${problem.correctOrder}`);
                }
                state.currentP++;
                setTimeout(() => minigames[3].render(document.getElementById('gameArea'), document.getElementById('gameChoices')), 1500);
            }
        },
        end: () => {
            const state = gameState.minigameState;
            state.score = state.correctOrders;
            const rewards = calculateMinigameReward(minigames[3].name, state.score);
            updateState({
                order: gameState.order + rewards.order,
                efficiency: gameState.efficiency + rewards.efficiency,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "문서 분류하기",
        description: "주어진 문서를 올바른 섹션으로 분류하세요. 3문제 중 2문제 이상 맞히면 성공!",
        start: (gameArea, choicesDiv) => {
            const questions = [
                { doc: "1950년대 전쟁 관련 기록", correctSection: "역사 박물관" },
                { doc: "새로운 데이터 보안 규정", correctSection: "규정집의 방" },
                { doc: "기록관 업무 평가 보고서", correctSection: "사실 기록고" }
            ];
            gameState.minigameState = { questions: questions.sort(() => currentRandFn() - 0.5), currentQ: 0, correctClassifications: 0, score: 0 };
            minigames[4].render(gameArea, choicesDiv);
        },
        render: (gameArea, choicesDiv) => {
            const state = gameState.minigameState;
            if (state.currentQ >= state.questions.length) { minigames[4].end(); return; }
            const q = state.questions[state.currentQ];
            gameArea.innerHTML = `<p><b>문서 ${state.currentQ + 1}:</b> ${q.doc}</p>`;
            choicesDiv.innerHTML = `
                <button class="choice-btn" data-section="사실 기록고">사실 기록고</button>
                <button class="choice-btn" data-section="규정집의 방">규정집의 방</button>
                <button class="choice-btn" data-section="중앙 통제실">중앙 통제실</button>
                <button class="choice-btn" data-section="데이터 보안부">데이터 보안부</button>
                <button class="choice-btn" data-section="역사 박물관">역사 박물관</button>
            `;
            choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
                button.addEventListener('click', () => minigames[4].processAction('classify', button.dataset.section));
            });
        },
        processAction: (actionType, value) => {
            const state = gameState.minigameState;
            if (actionType === 'classify') {
                if (value === state.questions[state.currentQ].correctSection) {
                    state.correctClassifications++;
                    updateGameDisplay("올바르게 분류했습니다!");
                } else {
                    updateGameDisplay(`틀렸습니다. 정답은: ${state.questions[state.currentQ].correctSection}`);
                }
                state.currentQ++;
                setTimeout(() => minigames[4].render(document.getElementById('gameArea'), document.getElementById('gameChoices')), 1000);
            }
        },
        end: () => {
            const state = gameState.minigameState;
            state.score = state.correctClassifications;
            const rewards = calculateMinigameReward(minigames[4].name, state.score);
            updateState({
                responsibility: gameState.responsibility + rewards.responsibility,
                order: gameState.order + rewards.order,
                efficiency: gameState.efficiency + rewards.efficiency,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    }
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
            message = `${gameState.sections[facilityKey].name} 섹션의 보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
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
    // High Responsibility: Verification success chance increase
    if (gameState.responsibility >= 70) {
        gameState.dailyBonus.verificationSuccess += 0.1;
        message += "높은 책임감 덕분에 자료 검증 성공률이 증가합니다. ";
    }
    // Low Responsibility: Archivist reliability decrease
    if (gameState.responsibility < 30) {
        gameState.archivists.forEach(a => a.reliability = Math.max(0, a.reliability - getRandomValue(5, 2)));
        message += "책임감 부족으로 기록관들의 신뢰도가 하락합니다. ";
    }

    // High Stability: Action points increase
    if (gameState.stability >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "높은 안정성 덕분에 업무력이 증가합니다. ";
    }
    // Low Stability: Action points decrease
    if (gameState.stability < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "안정성이 낮아져 업무에 차질이 생깁니다. ";
    }

    // High Order: Facility durability decay slower
    if (gameState.order >= 70) {
        Object.keys(gameState.sections).forEach(key => {
            if (gameState.sections[key].built) gameState.sections[key].durability = Math.min(100, gameState.sections[key].durability + getRandomValue(1, 0)); // Slightly increase durability
        });
        message += "확립된 질서 덕분에 섹션 관리가 더 잘 이루어집니다. ";
    }
    // Low Order: Facility durability decay faster
    if (gameState.order < 30) {
        Object.keys(gameState.sections).forEach(key => {
            if (gameState.sections[key].built) gameState.sections[key].durability = Math.max(0, gameState.sections[key].durability - getRandomValue(2, 1)); // Faster decay
        });
        message += "질서가 무너져 섹션들이 빠르게 노후화됩니다. ";
    }

    // High Precision: Efficiency boost or resource discovery chance
    if (gameState.precision >= 70) {
        const efficiencyGain = getRandomValue(5, 2);
        gameState.efficiency = Math.min(100, gameState.efficiency + efficiencyGain);
        message += `당신의 높은 정확성 덕분에 업무 효율이 향상됩니다. (+${efficiencyGain} 효율성) `; 
        if (currentRandFn() < 0.2) { // 20% chance for resource discovery
            const resourceType = currentRandFn() < 0.5 ? "rules" : "logs";
            const amount = getRandomValue(5, 2);
            gameState.resources[resourceType] += amount;
            message += `정밀한 분석을 통해 새로운 ${resourceType === "rules" ? "규칙" : "기록"} 자료를 발견했습니다! (+${amount} ${resourceType === "rules" ? "규칙" : "기록"}) `; 
        }
    }
    // Low Precision: Responsibility decrease or action point loss
    if (gameState.precision < 30) {
        const responsibilityLoss = getRandomValue(5, 2);
        gameState.responsibility = Math.max(0, gameState.responsibility - responsibilityLoss);
        message += `정확성 부족으로 업무에 차질이 생겨 책임감이 감소합니다. (-${responsibilityLoss} 책임감) `; 
        if (currentRandFn() < 0.1) { // 10% chance for action point loss
            const actionLoss = getRandomValue(1, 0);
            gameState.actionPoints = Math.max(0, gameState.actionPoints - actionLoss);
            message += `부정확한 판단으로 업무력을 낭비했습니다. (-${actionLoss} 업무력) `; 
        }
    }

    // High Efficiency: Stability and Order boost
    if (gameState.efficiency >= 70) {
        const stabilityGain = getRandomValue(5, 2);
        const orderGain = getRandomValue(5, 2);
        gameState.stability = Math.min(100, gameState.stability + stabilityGain);
        gameState.order = Math.min(100, gameState.order + orderGain);
        message += `효율적인 운영 덕분에 보관소의 안정성과 질서가 향상됩니다! (+${stabilityGain} 안정성, +${orderGain} 질서) `; 
    }
    // Low Efficiency: Stability and Order decrease
    if (gameState.efficiency < 30) {
        const stabilityLoss = getRandomValue(5, 2);
        const orderLoss = getRandomValue(5, 2);
        gameState.stability = Math.max(0, gameState.stability - stabilityLoss);
        gameState.order = Math.max(0, gameState.order - orderLoss);
        message += `비효율적인 업무 처리로 보관소의 안정성과 질서가 저하됩니다. (-${stabilityLoss} 안정성, -${orderLoss} 질서) `; 
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

const weightedDailyEvents = [
    { id: "daily_event_data_loss", weight: 10, condition: () => true, onTrigger: () => {
        const factsLoss = getRandomValue(10, 5);
        gameScenarios.daily_event_data_loss.text = `시스템 오류로 일부 데이터가 유실되었습니다. (-${factsLoss} 사실)`;
        updateState({ resources: { ...gameState.resources, facts: Math.max(0, gameState.resources.facts - factsLoss) } });
    } },
    { id: "daily_event_rule_conflict", weight: 10, condition: () => true, onTrigger: () => {
        const rulesLoss = getRandomValue(10, 5);
        gameScenarios.daily_event_rule_conflict.text = `기존 규칙과 새로운 규칙이 충돌합니다. (-${rulesLoss} 규칙)`;
        updateState({ resources: { ...gameState.resources, rules: Math.max(0, gameState.resources.rules - rulesLoss) } });
    } },
    { id: "daily_event_interpretation_difference", weight: 15, condition: () => gameState.archivists.length >= 2 },
    { id: "daily_event_new_archivist", weight: 10, condition: () => gameState.sections.centralControlRoom.built && gameState.archivists.length < gameState.maxArchivists, onTrigger: () => {
        const newArchivist = generateRandomArchivist();
        gameState.pendingNewArchivist = newArchivist;
        gameScenarios["daily_event_new_archivist"].text = `새로운 기록관 ${newArchivist.name}(${newArchivist.personality}, ${newArchivist.skill})이(가) 합류하고 싶어 합니다. (현재 기록관 수: ${gameState.archivists.length} / ${gameState.maxArchivists})`;
    }},
    { id: "daily_event_verification_request", weight: 15, condition: () => gameState.sections.centralControlRoom.built },
    { id: "daily_event_system_glitch", weight: 8, condition: () => true, onTrigger: () => {
        const precisionLoss = getRandomValue(5, 2);
        gameScenarios.daily_event_system_glitch.text = `예상치 못한 시스템 오류가 발생했습니다. 정확성이 저하됩니다. (-${precisionLoss} 정확성)`;
        updateState({ precision: gameState.precision - precisionLoss });
    } },
    { id: "daily_event_unexpected_audit", weight: 7, condition: () => true, onTrigger: () => {
        const responsibilityLoss = getRandomValue(5, 2);
        gameScenarios.daily_event_unexpected_audit.text = `외부 기관으로부터 예고 없는 감사가 시작되었습니다. 당신의 책임감이 시험받습니다. (-${responsibilityLoss} 책임감)`;
        updateState({ responsibility: gameState.responsibility - responsibilityLoss });
    } },
    { id: "daily_event_resource_discovery", weight: 12, condition: () => gameState.day > 5, onTrigger: () => {
        const resourceType = currentRandFn() < 0.5 ? "verified_data" : (currentRandFn() < 0.5 ? "facts" : "rules");
        const amount = getRandomValue(10, 5);
        const efficiencyGain = getRandomValue(5, 2);
        gameState.resources[resourceType] += amount;
        gameState.efficiency += efficiencyGain;
        gameScenarios.daily_event_resource_discovery.text = `자료 수집 중 숨겨진 ${resourceType === "facts" ? "사실" : resourceType === "rules" ? "규칙" : "검증된 데이터"} 저장소를 발견했습니다! (+${amount} ${resourceType === "facts" ? "사실" : resourceType === "rules" ? "규칙" : "검증된 데이터"}, +${efficiencyGain} 효율성)`;
    } },
    { id: "daily_event_archivist_dispute", weight: 10, condition: () => gameState.archivists.length >= 3 && gameState.order < 50 },
    { id: "daily_event_external_pressure", weight: 8, condition: () => gameState.stability < 50 || gameState.order < 50 }
];

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
        if (a.skill === '사실 검증') { gameState.resources.facts += getRandomValue(1, 0); skillBonusMessage += `${a.name}의 능력 덕분에 사실을 추가로 얻었습니다. `; }
        else if (a.skill === '규칙 적용') { gameState.resources.rules += getRandomValue(1, 0); skillBonusMessage += `${a.name}의 도움으로 규칙을 추가로 얻었습니다. `; }
        else if (a.skill === '데이터 분석') { gameState.efficiency += getRandomValue(1, 0); skillBonusMessage += `${a.name} 덕분에 보관소의 효율성이 +1 향상되었습니다. `; }
    });

    Object.keys(gameState.sections).forEach(key => {
        const facility = gameState.sections[key];
        if(facility.built) {
            facility.durability -= 1;
            if(facility.durability <= 0) {
                facility.built = false;
                durabilityMessage += `${facility.name} 섹션이 파손되었습니다! 보수가 필요합니다. `; 
            }
        }
    });

    gameState.resources.facts -= gameState.archivists.length * 2;
    let dailyMessage = "새로운 관리일이 시작되었습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.facts < -(gameState.archivists.length * 5)) {
        gameState.stability -= 10;
        dailyMessage += "사실 자료가 부족하여 보관소의 안정이 흔들립니다! (-10 안정성)";
    }
    
    // --- New Weighted Random Event Logic ---
    let eventId = "intro";
    const possibleEvents = weightedDailyEvents.filter(event => !event.condition || event.condition());
    const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
    const rand = currentRandFn() * totalWeight;
    
    let cumulativeWeight = 0;
    let chosenEvent = null;

    for (const event of possibleEvents) {
        cumulativeWeight += event.weight;
        if (rand < cumulativeWeight) {
            chosenEvent = event;
            break;
        }
    }

    if (chosenEvent) {
        eventId = chosenEvent.id;
        if (chosenEvent.onTrigger) {
            chosenEvent.onTrigger();
        }
    }
    
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
