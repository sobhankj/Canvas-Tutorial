const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function paintRect(x, y, w, h, color, step = 1) {
    if (w <= 0 || h <= 0) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = step;

    const half = step / 2;
    const maxInset = Math.min(w, h) / 2;

    for (let i = half; i < maxInset; i += step) {
        ctx.strokeRect(x + i, y + i, w - 2 * i, h - 2 * i);
    }
}

function outlineRect(x, y, w, h, color, lineWidth = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, w, h);
}

function drawSky() {
    const bands = [
        ['#1b3a4b', 70],
        ['#24556e', 60],
        ['#2e6b86', 55],
        ['#3d7ea3', 50],
        ['#5b93b5', 50],
        ['#7aa9c4', 45],
        ['#c98b6a', 50],
        ['#e0a070', 50],
        ['#f0c38a', 50]
    ];

    let y = 0;
    bands.forEach(([color, height]) => {
        paintRect(0, y, canvas.width, height, color);
        y += height;
    });
}

function drawSun() {
    const x = 780;
    const y = 70;
    const layers = [
        [130, '#f4d2a0'],
        [108, '#f0c27a'],
        [86, '#f0b429'],
        [64, '#f6e27a'],
        [42, '#fff4c2']
    ];

    layers.forEach(([size, color]) => {
        paintRect(x + (130 - size) / 2, y + (130 - size) / 2, size, size, color);
    });

    outlineRect(x, y, 130, 130, '#d9923b', 3);
}

function drawCloud(x, y, scale, color) {
    paintRect(x, y + 18 * scale, 90 * scale, 28 * scale, color);
    paintRect(x + 22 * scale, y, 50 * scale, 30 * scale, color);
    paintRect(x + 48 * scale, y + 10 * scale, 55 * scale, 26 * scale, color);
    paintRect(x + 8 * scale, y + 8 * scale, 34 * scale, 22 * scale, color);
}

function drawHills() {
    paintRect(0, 430, 420, 90, '#2f6b4f');
    paintRect(280, 450, 480, 70, '#3c7d58');
    paintRect(680, 440, 320, 80, '#2c6448');
    paintRect(140, 455, 180, 40, '#4a8a63');
}

function drawGround() {
    paintRect(0, 500, canvas.width, 140, '#3d7a3a');
    paintRect(0, 560, canvas.width, 80, '#2f6a32');
    paintRect(0, 620, canvas.width, 80, '#25562a');

    for (let i = 0; i < 28; i++) {
        const x = 20 + i * 36;
        paintRect(x, 508, 18, 8, '#4f9250');
        paintRect(x + 10, 528, 12, 6, '#5aa45c');
    }
}

function drawPath() {
    const steps = [
        [430, 538, 140, 28],
        [410, 566, 180, 28],
        [385, 594, 230, 28],
        [350, 622, 300, 40]
    ];

    steps.forEach(([x, y, w, h]) => {
        paintRect(x, y, w, h, '#c9a06a');
        outlineRect(x, y, w, h, '#a07b48', 2);
    });

    for (let y = 544; y < 660; y += 18) {
        outlineRect(460, y, 80, 10, '#b08955', 1);
    }
}

function drawTree(x, y, trunkW, trunkH) {
    paintRect(x, y, trunkW, trunkH, '#6b3e26');
    outlineRect(x, y, trunkW, trunkH, '#4a2a18', 2);

    const crown = [
        [x - 42, y - 38, 110, 44, '#1f6b3a'],
        [x - 32, y - 82, 90, 42, '#268046'],
        [x - 18, y - 120, 62, 36, '#2f9452']
    ];

    crown.forEach(([cx, cy, w, h, color]) => {
        paintRect(cx, cy, w, h, color);
        outlineRect(cx, cy, w, h, '#164d2a', 2);
    });
}

function drawRoof() {
    const layers = [
        [470, 168, 60, 26],
        [445, 194, 110, 26],
        [415, 220, 170, 26],
        [385, 246, 230, 26],
        [350, 272, 300, 28],
        [318, 298, 364, 22]
    ];

    layers.forEach(([x, y, w, h], index) => {
        const color = index % 2 === 0 ? '#b03a2e' : '#922b21';
        paintRect(x, y, w, h, color);
        outlineRect(x, y, w, h, '#6e1f18', 2);

        for (let tileX = x + 8; tileX < x + w - 12; tileX += 18) {
            outlineRect(tileX, y + 4, 14, h - 8, '#7b241c', 1);
        }
    });
}

function drawChimney() {
    paintRect(600, 178, 52, 98, '#7f4b2c');
    outlineRect(600, 178, 52, 98, '#5a321c', 3);
    paintRect(592, 168, 68, 18, '#6e3b22');
    outlineRect(592, 168, 68, 18, '#4a2716', 2);

    paintRect(612, 128, 14, 14, '#d7d7d7');
    paintRect(628, 108, 18, 18, '#ececec');
    paintRect(646, 92, 22, 16, '#f7f7f7');
}

function drawWalls() {
    paintRect(330, 318, 340, 222, '#f3d2b3');
    outlineRect(330, 318, 340, 222, '#c48a62', 4);

    for (let row = 0; row < 8; row++) {
        const offset = row % 2 === 0 ? 0 : 14;
        for (let col = 0; col < 11; col++) {
            outlineRect(342 + offset + col * 28, 332 + row * 24, 24, 18, '#e0b48f', 1);
        }
    }

    paintRect(330, 528, 340, 18, '#d7b08a');
    outlineRect(330, 528, 340, 18, '#b88860', 2);
}

function drawWindow(x, y, w, h, withBox = true) {
    paintRect(x - 10, y - 8, w + 20, h + 16, '#8b3a2a');
    outlineRect(x - 10, y - 8, w + 20, h + 16, '#5d2418', 2);

    paintRect(x, y, w, h, '#7ec8e3');
    paintRect(x + 6, y + 6, w / 2 - 10, h / 2 - 10, '#d6f3ff');
    outlineRect(x, y, w, h, '#5d4037', 4);
    paintRect(x + w / 2 - 2, y, 4, h, '#5d4037');
    paintRect(x, y + h / 2 - 2, w, 4, '#5d4037');

    if (!withBox) return;

    paintRect(x + 6, y + h + 8, w - 12, 12, '#6d4c41');
    paintRect(x + 10, y + h + 4, 10, 10, '#e74c7a');
    paintRect(x + w / 2 - 6, y + h + 2, 10, 12, '#f4d03f');
    paintRect(x + w - 24, y + h + 4, 10, 10, '#9b59b6');
}

function drawDoor() {
    const x = 455;
    const y = 400;
    const w = 90;
    const h = 146;

    paintRect(x - 8, y - 8, w + 16, h + 8, '#7b3f1d');
    paintRect(x, y, w, h, '#8d4a24');
    outlineRect(x, y, w, h, '#5a2e14', 4);

    outlineRect(x + 10, y + 14, w - 20, 50, '#6b3718', 3);
    outlineRect(x + 10, y + 76, w - 20, 50, '#6b3718', 3);

    paintRect(x + w - 22, y + 84, 12, 12, '#f7d774');
    outlineRect(x + w - 22, y + 84, 12, 12, '#c9a227', 2);
}

function drawFenceSection(startX, count) {
    for (let i = 0; i < count; i++) {
        const x = startX + i * 26;
        paintRect(x, 500, 10, 55, '#efe6d0');
        outlineRect(x, 500, 10, 55, '#cbb98d', 1);
        paintRect(x - 2, 494, 14, 10, '#f4ecd8');
    }

    const railW = (count - 1) * 26 + 14;
    paintRect(startX - 2, 518, railW, 8, '#efe6d0');
    paintRect(startX - 2, 538, railW, 8, '#efe6d0');
}

function drawFence() {
    drawFenceSection(40, 11);
    drawFenceSection(690, 11);
}

function drawFlowers() {
    const flowers = [
        [70, 575, '#e74c3c'],
        [96, 582, '#f4d03f'],
        [124, 572, '#af7ac5'],
        [150, 586, '#5dade2'],
        [820, 570, '#e74c3c'],
        [848, 578, '#58d68d'],
        [876, 568, '#f5b041'],
        [904, 584, '#ec7063']
    ];

    flowers.forEach(([x, y, color]) => {
        paintRect(x + 6, y + 10, 6, 16, '#1e8449');
        paintRect(x, y, 10, 10, color);
        paintRect(x + 8, y, 10, 10, color);
        paintRect(x + 4, y - 8, 10, 10, '#fdfefe');
    });
}

function drawHouse() {
    drawChimney();
    drawRoof();
    drawWalls();
    drawWindow(360, 348, 70, 70);
    drawWindow(570, 348, 70, 70);
    drawWindow(470, 228, 58, 42, false);
    drawDoor();
}

drawSky();
drawSun();
drawCloud(90, 70, 1.15, '#f7f4ee');
drawCloud(250, 110, 0.85, '#fffaf3');
drawCloud(520, 60, 1, '#f8f1e7');
drawHills();
drawGround();
drawPath();
drawTree(120, 430, 26, 90);
drawTree(860, 420, 28, 100);
drawFence();
drawHouse();
drawFlowers();
drawTree(240, 470, 22, 70);
