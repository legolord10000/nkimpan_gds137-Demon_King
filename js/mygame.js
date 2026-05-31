var canvas;
var context;
var timer;
var interval;

// =========================
//   NEW: GAME STATES
// =========================
var gameState = "menu"; // menu | instructions | overworld | battle

// Circular menu buttons using trig
var menuButtonsData = [
    { label: "Start", angle: -Math.PI / 8, radius: 0 }, 
    { label: "Instructions", angle: Math.PI/2, radius: 150 }
];

function pointInCircle(px, py, cx, cy, r) {
    var dx = px - cx;
    var dy = py - cy;
    return dx * dx + dy * dy <= r * r;
}

// =========================
//   DRAW MAIN MENU
// =========================
function drawMainMenu() {
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#fff";
    context.textAlign = "center";

    context.font = "64px Arial";
    context.fillText("Monster Recruiter", canvas.width / 2, canvas.height / 2 - 150);

    context.font = "28px Arial";
    context.fillText("by Nathan Kimpan", canvas.width / 2, canvas.height / 2 - 110);

    var cx = canvas.width / 2;
    var cy = canvas.height / 2 + 20;
    var buttonRadius = 70;

    context.font = "24px Arial";

    for (var i = 0; i < menuButtonsData.length; i++) {
        var b = menuButtonsData[i];
        var bx = cx + Math.cos(b.angle) * b.radius;
        var by = cy + Math.sin(b.angle) * b.radius;

        // Draw button
        context.beginPath();
        context.fillStyle = "#333";
        context.arc(bx, by, buttonRadius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#fff";
        context.lineWidth = 3;
        context.stroke();

        // Label
        context.fillStyle = "#fff";
        context.fillText(b.label, bx, by + 8);

        // Save for hit detection
        b.screenX = bx;
        b.screenY = by;
        b.screenR = buttonRadius;
    }
}

// =========================
//   DRAW INSTRUCTIONS
// =========================
function drawInstructionsScreen() {
    context.fillStyle = "#111";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#fff";
    context.textAlign = "center";

    context.font = "48px Arial";
    context.fillText("Instructions", canvas.width / 2, 80);

    context.font = "22px Arial";

    var lines = [
        "WASD to move in the overworld.",
        "Walk in the tall grass to trigger battles.",
        "Left-click to choose actions in battle.",
        "Right-click to go back a menu.",
        "",
        "Goal: Reach the cyan goal to win.",
        "",
        "Battle Actions:",
        "Strike – Deal damage",
        "Guard – Reduce damage taken",
        "Heal – Restore HP",
        "Poison – Damage over time",
        "",
        "Click anywhere to return to the Main Menu."
    ];

    for (var i = 0; i < lines.length; i++) {
        context.fillText(lines[i], canvas.width / 2, 140 + i * 30);
    }
}

// =========================
//   YOUR ORIGINAL GAME CODE
// =========================

var player;
var inGrass = false;
var encounter = false;
var transitionActive = false;
var bars = [];
var barsInitialized = false;
var resetGameTriggered = false;
var overworldSavedX = 0;
var overworldSavedY = 0;
var fX = 0.85;
var fY = 0.85;
var gravity = 0;

// --- Battle ---
var MAX_HP = 20;
var enemyHP = MAX_HP;
var enemyColor = "#cc4444";
var playerGuard = false;
var enemyGuard = false;
var playerPoison = 0;
var enemyPoison = 0;
var battleMessage = "A wild monster approached!";
var battleHelpText = "";
var battleMenu = "main";
var playerTurnLocked = false;

var RECRUIT_ITEM_DROP_CHANCE = 0.12;
var masterRecruterUnlocked = false;

var enemyLevel = 1;

var recruitItems = [
    { name: "recruter", catchRate: 0.10, count: 5 },
    { name: "great recruter", catchRate: 0.15, count: 3 },
    { name: "hyper recruter", catchRate: 0.20, count: 2 },
    { name: "master recruter", catchRate: 1.00, count: 0 }
];

// TM1 = blue starter; TM2–TM4 = recruited monsters
var party = [
    { name: "TM1", hp: MAX_HP, maxHp: MAX_HP, color: "#4488ff", enteredBattle: false,
      level: 1, exp: 0, expToNext: 20 },
    null,
    null,
    null
];
var activePartyIndex = 0;

// --- Menu layout ---
var MENU_TOP = function () { return canvas.height - 150; };
var MENU_ROW_SPLIT = function () { return canvas.height - 70; };
var MENU_LEFT_X = function () { return canvas.width / 2; };
var MENU_RIGHT_X = function () { return canvas.width * 0.75; };
var MENU_HIT_W = 200;

canvas = document.getElementById("canvas");
context = canvas.getContext("2d");

player = new GameObject({ x: 100, y: canvas.height / 2 - 100 });

// Platforms...
platform0 = new GameObject();
platform0.width = 200;
platform0.x = platform0.width / 2;
platform0.y = canvas.height - platform0.height / 2;
platform0.color = "#ff66cc";

platform1 = new GameObject();
platform1.width = 200;
platform1.x = 300 + platform1.width / 2;
platform1.y = canvas.height - 150;
platform1.color = "#ffcc00";

platform2 = new GameObject();
platform2.width = 200;
platform2.x = 600 + platform2.width / 2;
platform2.y = canvas.height - 250;
platform2.color = "#ff6600";

platform3 = new GameObject();
platform3.width = 200;
platform3.x = 900 + platform3.width / 2;
platform3.y = canvas.height - 350;
platform3.color = "#66ccff";

platform4 = new GameObject();
platform4.width = 200;
platform4.x = 900 + platform4.width / 2;
platform4.y = canvas.height - 550;
platform4.color = "#9166ff";

platform5 = new GameObject();
platform5.width = 200;
platform5.x = 450 + platform5.width / 2;
platform5.y = canvas.height - 400;
platform5.color = "#66ff33";

goal = new GameObject({ width: 24, height: 50, x: canvas.width - 50, y: 100, color: "#00ffff" });
// =========================
//   BATTLE HELPERS
// =========================

function activeFighter() {
    return party[activePartyIndex];
}

function playerHP() {
    var f = activeFighter();
    return f ? f.hp : 0;
}

function setPlayerHP(value) {
    var f = activeFighter();
    if (f) {
        f.hp = Math.max(0, Math.min(value, f.maxHp));
    }
}

function randomMonsterColor() {
    var palette = [
        "#e74c3c", "#e67e22", "#f39c12", "#2ecc71", "#1abc9c",
        "#3498db", "#9b59b6", "#e91e63", "#ff5722", "#00bcd4"
    ];
    return palette[Math.floor(Math.random() * palette.length)];
}

function partyFull() {
    return party[1] && party[2] && party[3];
}

function firstEmptyRecruitSlot() {
    for (var i = 1; i <= 3; i++) {
        if (!party[i]) return i;
    }
    return -1;
}

function partyMenuLabels() {
    return [
        "TM1",
        party[1] ? "TM2" : "N/A",
        party[2] ? "TM3" : "N/A",
        party[3] ? "TM4" : "N/A"
    ];
}

function itemMenuLabel(index) {
    var item = recruitItems[index];
    if (item.count <= 0) return "N/A";
    return item.name + " x" + item.count;
}

function itemMenuLabels() {
    var labels = [];
    for (var i = 0; i < recruitItems.length; i++) {
        labels.push(itemMenuLabel(i));
    }
    return labels;
}

function itemMenuButtons() {
    var buttons = menuButtons(itemMenuLabels());
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].itemIndex = i;
    }
    return buttons;
}

function rollRecruitItemDrop() {
    if (Math.random() >= RECRUIT_ITEM_DROP_CHANCE) return "";
    var pool = [0, 1, 2];
    if (masterRecruterUnlocked) pool.push(3);
    var idx = pool[Math.floor(Math.random() * pool.length)];
    recruitItems[idx].count++;
    return " You found a " + recruitItems[idx].name + "!";
}

function livingPartyIndex(excludeIndex) {
    for (var i = 0; i < party.length; i++) {
        if (i === excludeIndex) continue;
        if (party[i] && party[i].hp > 0) return i;
    }
    return -1;
}

function enemyMaxHP() {
    return MAX_HP + enemyLevel * 2;
}

function resetBattleState() {
    playerGuard = false;
    enemyGuard = false;
    playerPoison = 0;
    enemyPoison = 0;
    battleMessage = "A wild monster approached!";
    battleHelpText = "Left click to choose an option. Right click to go back.";
    battleMenu = "main";
    playerTurnLocked = false;
    activePartyIndex = 0;

    var p = activeFighter();
    var base = p ? p.level : 1;
    var minL = Math.max(1, base - 10);
    var maxL = Math.min(100, base + 10);
    enemyLevel = Math.floor(Math.random() * (maxL - minL + 1)) + minL;

    enemyHP = enemyMaxHP();
    enemyColor = randomMonsterColor();

    if (party[0]) party[0].enteredBattle = true;
    for (var i = 1; i <= 3; i++) {
        if (party[i]) party[i].enteredBattle = false;
    }
}

function clearBattleHelp() {
    battleHelpText = "";
}

function closeSubMenu() {
    battleMenu = "main";
    battleMessage = "Choose an action:";
    clearBattleHelp();
}

function recruitChance(item) {
    var missingHp = enemyMaxHP() - enemyHP;
    var hpBonus = (missingHp / enemyMaxHP()) * 0.35;
    return Math.min(item.catchRate + hpBonus, 1);
}

function tryRecruit(itemIndex) {
    var item = recruitItems[itemIndex];
    battleMenu = "main";

    if (partyFull()) {
        battleMessage = "party is full for now";
        return;
    }

    if (item.count <= 0) {
        battleMessage = "You're out of " + item.name + "!";
        return;
    }

    if (enemyHP <= 0) {
        battleMessage = "It fainted — you can't recruit it now!";
        return;
    }

    item.count--;
    var chance = recruitChance(item);
    var roll = Math.random();

    if (roll < chance) {
        if (partyFull()) {
            battleMessage = "party is full for now";
            item.count++;
            return;
        }
        var slot = firstEmptyRecruitSlot();
        var tmName = "TM" + slot;
        party[slot] = {
            name: tmName,
            hp: MAX_HP,
            maxHp: MAX_HP,
            color: enemyColor,
            enteredBattle: false,
            level: enemyLevel,
            exp: 0,
            expToNext: 20
        };
        battleMessage = "Gotcha! " + tmName + " joined your team!" + rollRecruitItemDrop();
        playerTurnLocked = true;
        setTimeout(endBattleAndReturn, 1200);
        return;
    }

    battleMessage = item.name + " failed! (" + Math.round(chance * 100) + "% chance)";
    playerTurnLocked = true;
    setTimeout(monsterTurn, 600);
}

function startBattle() {
    resetBattleState();
    gameState = "battle";
}

function restoreFaintedParty() {
    for (var i = 0; i < party.length; i++) {
        if (party[i] && party[i].hp <= 0) {
            party[i].hp = 5;
        }
    }
}

function endBattleAndReturn() {
    restoreFaintedParty();

    gameState = "overworld";
    player.x = overworldSavedX;
    player.y = overworldSavedY;
    player.vx = 0;
    player.vy = 0;
    encounter = false;
    transitionActive = false;
    barsInitialized = false;
    resetGameTriggered = false;
    bars = [];
    battleMenu = "main";
    playerTurnLocked = false;
}

function menuButtons(labels) {
    return [
        { label: labels[0], x1: MENU_LEFT_X(),  x2: MENU_LEFT_X() + MENU_HIT_W,  y1: MENU_TOP() + 20, y2: MENU_ROW_SPLIT() },
        { label: labels[1], x1: MENU_LEFT_X(),  x2: MENU_LEFT_X() + MENU_HIT_W,  y1: MENU_ROW_SPLIT(), y2: canvas.height },
        { label: labels[2], x1: MENU_RIGHT_X(), x2: MENU_RIGHT_X() + MENU_HIT_W, y1: MENU_TOP() + 20, y2: MENU_ROW_SPLIT() },
        { label: labels[3], x1: MENU_RIGHT_X(), x2: MENU_RIGHT_X() + MENU_HIT_W, y1: MENU_ROW_SPLIT(), y2: canvas.height }
    ];
}

function hitMenuButton(mouseX, mouseY, buttons) {
    for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        if (mouseX > b.x1 && mouseX < b.x2 && mouseY > b.y1 && mouseY < b.y2) {
            return b;
        }
    }
    return null;
}

function sendOutFighter(index) {
    if (index >= 1 && party[index] && !party[index].enteredBattle) {
        party[index].hp = party[index].maxHp;
        party[index].enteredBattle = true;
    }
    activePartyIndex = index;
}

function swapToPartySlot(index) {
    if (!party[index]) {
        battleMessage = "That slot is empty.";
        battleMenu = "main";
        return;
    }
    if (index === activePartyIndex) {
        battleMessage = party[index].name + " is already fighting!";
        battleMenu = "main";
        return;
    }
    if (party[index].hp <= 0) {
        battleMessage = party[index].name + " has fainted!";
        battleMenu = "main";
        return;
    }
    sendOutFighter(index);
    battleMessage = "Go, " + party[index].name + "!";
    battleMenu = "main";
    playerTurnLocked = true;
    setTimeout(monsterTurn, 600);
}

// =========================
//   EXP / LEVEL SYSTEM
// =========================

function giveExpToWinner() {
    var fighter = activeFighter();
    if (!fighter) return;

    var expGain = 10 + enemyLevel * 4;
    fighter.exp += expGain;
    battleMessage = fighter.name + " gained " + expGain + " EXP!";

    while (fighter.exp >= fighter.expToNext && fighter.level < 100) {
        fighter.exp -= fighter.expToNext;
        fighter.level++;
        fighter.expToNext = Math.floor(fighter.expToNext * 1.25);

        fighter.maxHp += 3;
        fighter.hp = fighter.maxHp;

        battleMessage = fighter.name + " leveled up to Lv " + fighter.level + "!";
    }
}

// =========================
//   INPUT HANDLING
// =========================

window.addEventListener("mousedown", function (e) {
    var rect = canvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;

    // -------------------------
    // MENU STATE
    // -------------------------
    if (gameState === "menu") {
        if (e.button !== 0) return;

        for (var i = 0; i < menuButtonsData.length; i++) {
            var b = menuButtonsData[i];
            if (pointInCircle(mouseX, mouseY, b.screenX, b.screenY, b.screenR)) {
                if (b.label === "Start") {
                    gameState = "overworld";
                } else if (b.label === "Instructions") {
                    gameState = "instructions";
                }
                return;
            }
        }
        return;
    }

    // -------------------------
    // INSTRUCTIONS STATE
    // -------------------------
    if (gameState === "instructions") {
        if (e.button === 0) {
            gameState = "menu";
        }
        return;
    }

    // -------------------------
    // BATTLE STATE
    // -------------------------
    if (gameState !== "battle" || playerTurnLocked) return;

    if (e.button === 2) {
        clearBattleHelp();
        closeSubMenu();
        return;
    }

    clearBattleHelp();

    if (mouseY <= MENU_TOP()) return;

    if (battleMenu === "fight") {
        var fightBtn = hitMenuButton(mouseX, mouseY, menuButtons(["Strike", "Guard", "Heal", "Poison"]));
        if (fightBtn) {
            playerAttack(fightBtn.label.toLowerCase());
        }
        return;
    }

    if (battleMenu === "item") {
        var itemBtn = hitMenuButton(mouseX, mouseY, itemMenuButtons());
        if (!itemBtn) return;
        if (itemBtn.label === "N/A") {
            battleMessage = "You don't have that item.";
            return;
        }
        tryRecruit(itemBtn.itemIndex);
        return;
    }

    if (battleMenu === "party") {
        var partyBtn = hitMenuButton(mouseX, mouseY, menuButtons(partyMenuLabels()));
        if (!partyBtn) return;
        if (partyBtn.label === "TM1") swapToPartySlot(0);
        else if (partyBtn.label === "TM2") swapToPartySlot(1);
        else if (partyBtn.label === "TM3") swapToPartySlot(2);
        else if (partyBtn.label === "TM4") swapToPartySlot(3);
        else battleMessage = "That slot is empty.";
        return;
    }

    var mainBtn = hitMenuButton(mouseX, mouseY, menuButtons(["Fight", "Item", "Party", "Run"]));
    if (!mainBtn) return;

    if (mainBtn.label === "Fight") {
        battleMenu = "fight";
        battleMessage = "Choose an attack:";
    } else if (mainBtn.label === "Item") {
        if (partyFull()) {
            battleMessage = "party is full for now";
            return;
        }
        battleMenu = "item";
        battleMessage = "Choose a recruit item:";
    } else if (mainBtn.label === "Party") {
        battleMenu = "party";
        battleMessage = "Choose a teammate:";
    } else if (mainBtn.label === "Run") {
        battleMessage = "Got away safely!";
        setTimeout(endBattleAndReturn, 400);
    }
});

window.addEventListener("contextmenu", function (e) { e.preventDefault(); });

// =========================
//   COMBAT
// =========================

function playerAttack(type) {
    battleMenu = "main";
    playerTurnLocked = true;

    var fighter = activeFighter();
    var lvl = fighter ? fighter.level : 1;

    if (type === "strike") {
        var dmg = enemyGuard ? (2 + lvl) : (5 + lvl * 2);
        enemyHP -= dmg;
        enemyGuard = false;
        battleMessage = "Strike dealt " + dmg + " damage!";
    } else if (type === "guard") {
        playerGuard = true;
        battleMessage = "You brace yourself!";
    } else if (type === "heal") {
        var heal = 6 + lvl * 2;
        setPlayerHP(playerHP() + heal);
        battleMessage = "You healed " + heal + " HP!";
    } else if (type === "poison") {
        enemyPoison = 3 + Math.floor(lvl / 5);
        battleMessage = "You poisoned the monster!";
    }

    if (enemyHP <= 0) {
        enemyHP = 0;
        battleMessage = "The monster fainted!";
        setTimeout(function () {
            giveExpToWinner();
            setTimeout(endBattleAndReturn, 1000);
        }, 600);
        return;
    }

    setTimeout(monsterTurn, 600);
}

function monsterTurn() {
    if (gameState !== "battle") return;

    if (enemyPoison > 0) {
        enemyHP -= 2 + Math.floor(enemyLevel / 5);
        enemyPoison--;
        battleMessage = "Poison hurts the monster!";
        if (enemyHP <= 0) {
            enemyHP = 0;
            battleMessage = "The monster fainted!";
            setTimeout(function () {
                giveExpToWinner();
                setTimeout(endBattleAndReturn, 1000);
            }, 600);
            return;
        }
    }

    var moves = ["strike", "guard", "heal", "poison"];
    var choice = moves[Math.floor(Math.random() * moves.length)];

    if (choice === "strike") {
        var dmg = playerGuard ? (1 + enemyLevel) : (4 + enemyLevel * 2);
        setPlayerHP(playerHP() - dmg);
        playerGuard = false;
        battleMessage = "Monster Strike! " + dmg + " damage!";
    } else if (choice === "guard") {
        enemyGuard = true;
        battleMessage = "Monster is guarding!";
    } else if (choice === "heal") {
        enemyHP = Math.min(enemyHP + (4 + enemyLevel * 2), enemyMaxHP());
        battleMessage = "Monster healed!";
    } else if (choice === "poison") {
        playerPoison = 3 + Math.floor(enemyLevel / 5);
        battleMessage = "Monster poisoned you!";
    }

    if (playerPoison > 0) {
        setPlayerHP(playerHP() - (2 + Math.floor(enemyLevel / 5)));
        playerPoison--;
        battleMessage += " Poison hurts you!";
    }

    if (playerHP() <= 0) {
        setPlayerHP(0);

        var backup = livingPartyIndex(activePartyIndex);

        if (backup !== -1) {
            sendOutFighter(backup);
            battleMessage = party[backup].name + " jumped in!";
            playerTurnLocked = false;
            return;
        }

        battleMessage = "Your team fainted!";
        setTimeout(endBattleAndReturn, 1000);
        return;
    }

    playerTurnLocked = false;
}

// =========================
//   DRAWING
// =========================

function drawHPBar(x, y, width, height, current, max) {
    var ratio = Math.max(0, current / max);
    context.fillStyle = "#aa2222";
    context.fillRect(x, y, width, height);
    context.fillStyle = "#22aa22";
    context.fillRect(x, y, width * ratio, height);
}

function drawBattleScreen() {
    var fighter = activeFighter();

    context.fillStyle = "#222";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "white";
    context.font = "24px Arial";
    context.textAlign = "left";
    context.fillText("Monster HP (Lv " + enemyLevel + ")", 50, 50);
    drawHPBar(50, 60, enemyMaxHP() * 5, 20, enemyHP, enemyMaxHP());
    context.fillStyle = enemyColor;
    context.fillRect(canvas.width / 2 + 200, 50, 200, 200);

    if (fighter) {
        context.fillStyle = fighter.color;
        context.fillRect(50, canvas.height - 350, 200, 200);
        context.fillStyle = "white";
        context.fillText(fighter.name + " HP", canvas.width - 250, canvas.height - 350);
        context.fillText("Lv " + fighter.level, canvas.width - 250, canvas.height - 380);
        drawHPBar(canvas.width - 250, canvas.height - 330, fighter.maxHp * 5, 20, fighter.hp, fighter.maxHp);
    }

    context.fillStyle = "white";
    context.fillRect(0, MENU_TOP(), canvas.width, 150);

    context.fillStyle = "black";
    context.font = "22px Arial";

    if (battleHelpText) {
        context.fillText(battleMessage, 30, canvas.height - 125);
        context.font = "18px Arial";
        context.fillText(battleHelpText, 30, canvas.height - 90);
    } else {
        context.fillText(battleMessage, 30, canvas.height - 110);
    }

    context.font = "26px Arial";
    var labels;

    if (battleMenu === "fight") {
        labels = ["Strike", "Guard", "Heal", "Poison"];
    } else if (battleMenu === "item") {
        context.font = "20px Arial";
        labels = itemMenuLabels();
    } else if (battleMenu === "party") {
        labels = partyMenuLabels();
    } else {
        labels = ["Fight", "Item", "Party", "Run"];
        context.font = "28px Arial";
    }

    var positions = [
        { x: MENU_LEFT_X() + 20,  y: canvas.height - 110 },
        { x: MENU_LEFT_X() + 20,  y: canvas.height - 50 },
        { x: MENU_RIGHT_X() + 20, y: canvas.height - 110 },
        { x: MENU_RIGHT_X() + 20, y: canvas.height - 50 }
    ];

    for (var i = 0; i < labels.length; i++) {
        context.fillText(labels[i], positions[i].x, positions[i].y);
    }
}

// =========================
//   MAIN LOOP
// =========================

interval = 1000 / 60;
timer = setInterval(animate, interval);

function animate() {

    // -------------------------
    // MENU STATE
    // -------------------------
    if (gameState === "menu") {
        drawMainMenu();
        return;
    }

    // -------------------------
    // INSTRUCTIONS STATE
    // -------------------------
    if (gameState === "instructions") {
        drawInstructionsScreen();
        return;
    }

    // -------------------------
    // BATTLE STATE
    // -------------------------
    if (gameState === "battle") {
        drawBattleScreen();
        return;
    }

    // -------------------------
    // OVERWORLD STATE
    // -------------------------
    context.clearRect(0, 0, canvas.width, canvas.height);

    fX = 0.85;
    fY = 0.85;
    inGrass = false;

    if (!encounter) {
        if (w) player.vy += -player.ay * player.force;
        if (s) player.vy += player.ay * player.force;
        if (a) player.vx += -player.ax * player.force;
        if (d) player.vx += player.ax * player.force;
    }

    var checkBottom = true, checkLeft = true, checkRight = true, checkTop = true;
    while (platform5.hitTestPoint(player.bottom()) && checkBottom) { inGrass = true; checkBottom = false; }
    while (platform5.hitTestPoint(player.left()) && checkLeft) { inGrass = true; checkLeft = false; }
    while (platform5.hitTestPoint(player.right()) && checkRight) { inGrass = true; checkRight = false; }
    while (platform5.hitTestPoint(player.top()) && checkTop) { inGrass = true; checkTop = false; }

    if (inGrass && !encounter && !transitionActive) {
        if ((w || s || a || d) && Math.random() < 0.05) {
            encounter = true;
            transitionActive = true;
        }
    }

    if (encounter) {
        fX = 0;
        fY = 0;
        player.vx = 0;
        player.vy = 0;
    }

    player.vx *= fX;
    player.vy *= fY;
    player.vy += gravity;
    player.x += Math.round(player.vx);
    player.y += Math.round(player.vy);

    while (platform0.hitTestPoint(player.bottom()) && player.vy >= 0) { player.y--; player.vy = 0; player.canJump = true; }
    while (platform0.hitTestPoint(player.left()) && player.vx <= 0) { player.x++; player.vx = 0; }
    while (platform0.hitTestPoint(player.right()) && player.vx >= 0) { player.x--; player.vx = 0; }
    while (platform0.hitTestPoint(player.top()) && player.vy <= 0) { player.y++; player.vy = 0; }

    while (platform1.hitTestPoint(player.bottom()) && player.vy >= 0) { player.y--; player.vy = 0; player.canJump = true; }
    while (platform1.hitTestPoint(player.left()) && player.vx <= 0) { player.x++; player.vx = 0; }
    while (platform1.hitTestPoint(player.right()) && player.vx >= 0) { player.x--; player.vx = 0; }
    while (platform1.hitTestPoint(player.top()) && player.vy <= 0) { player.y++; player.vy = 0; }

    while (platform2.hitTestPoint(player.bottom()) && player.vy >= 0) { player.y--; player.vy = 0; player.canJump = true; }
    while (platform2.hitTestPoint(player.left()) && player.vx <= 0) { player.x++; player.vx = 0; }
    while (platform2.hitTestPoint(player.right()) && player.vx >= 0) { player.x--; player.vx = 0; }
    while (platform2.hitTestPoint(player.top()) && player.vy <= 0) { player.y++; player.vy = 0; }

    while (platform3.hitTestPoint(player.bottom()) && player.vy >= 0) { player.y--; player.vy = 0; player.canJump = true; }
    while (platform3.hitTestPoint(player.left()) && player.vx <= 0) { player.x++; player.vx = 0; }
    while (platform3.hitTestPoint(player.right()) && player.vx >= 0) { player.x--; player.vx = 0; }
    while (platform3.hitTestPoint(player.top()) && player.vy <= 0) { player.y++; player.vy = 0; }

    while (platform4.hitTestPoint(player.bottom()) && player.vy >= 0) { player.y--; player.vy = 0; player.canJump = true; }

    if (player.hitTestObject(goal)) {
        goal.y = 10000;
        masterRecruterUnlocked = true;
        recruitItems[3].count = 1;
        context.textAlign = "center";
        context.fillStyle = "white";
        context.font = "48px Arial";
        context.fillText("You Win!!!", canvas.width / 2, canvas.height / 2 - 30);
        context.font = "28px Arial";
        context.fillText("Obtained master recruter!", canvas.width / 2, canvas.height / 2 + 30);
    }

    platform0.drawRect();
    platform1.drawRect();
    platform2.drawRect();
    platform3.drawRect();
    platform4.drawRect();
    platform5.drawRect();
    player.drawRect();
    goal.drawCircle();

    if (!transitionActive) return;

    var totalBars = 8;
    var barHeight = canvas.height / totalBars;

    if (!barsInitialized) {
        for (var i = 0; i < totalBars; i++) {
            bars.push({
                y: i * barHeight,
                height: barHeight,
                width: 0,
                targetWidth: canvas.width,
                speed: 25,
                fromLeft: i % 2 === 0
            });
        }
        barsInitialized = true;
    }

    var allBarsFinished = true;
    context.fillStyle = "#000000";
    for (var j = 0; j < bars.length; j++) {
        var b = bars[j];
        if (b.width < b.targetWidth) {
            b.width += b.speed;
            if (b.width > b.targetWidth) b.width = b.targetWidth;
            allBarsFinished = false;
        }
        if (b.fromLeft) {
            context.fillRect(0, b.y, b.width, b.height);
        } else {
            context.fillRect(canvas.width - b.width, b.y, b.width, b.height);
        }
    }

    if (allBarsFinished && !resetGameTriggered) {
        resetGameTriggered = true;
        overworldSavedX = player.x;
        overworldSavedY = player.y;
        bars = [];
        barsInitialized = false;
        transitionActive = false;
        startBattle();
    }
}
