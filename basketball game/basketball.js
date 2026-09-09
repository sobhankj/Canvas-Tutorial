let canvas = document.getElementById('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const ctx = canvas.getContext('2d');

const GRAVITY = 1800;
const BOUNCE_RATIO = 0.8;
const MIN_BOUNCE_HEIGHT = 4;
const GROUND_THICKNESS = 56;
const WALL_BOUNCE = 0.8;
const GROUND_FRICTION = 0.88;
const GROUND_DRAG = 3.2;
const THROW_WINDOW_MS = 90;
const MAX_THROW_SPEED = 2600;
const RIM_BOUNCE = 0.58;
const BOARD_BOUNCE = 0.42;

const ball = {
    x: 0,
    y: 0,
    radius: 42,
    vx: 0,
    vy: 0,
    rotation: 0,
    peakFromGround: 0
};

const drag = {
    active: false,
    offsetX: 0,
    offsetY: 0,
    samples: []
};

const game = {
    score: 0,
    armed: true,
    netPulse: 0,
    popups: []
};

function groundY() {
    return canvas.height - GROUND_THICKNESS;
}

function ballGroundY() {
    return groundY() - ball.radius;
}

function hoopLayout() {
    const rimRadius = Math.max(3, ball.radius * 0.075);
    const innerWidth = ball.radius * 2 + Math.max(26, ball.radius * 0.75);
    const boardW = Math.max(64, Math.min(92, canvas.width * 0.08));
    const boardH = Math.max(118, Math.min(170, canvas.height * 0.24));
    const boardRight = canvas.width - 18;
    const boardLeft = boardRight - boardW;
    const rimY = Math.max(boardH * 0.4, groundY() - canvas.height * 0.5);
    const boardTop = rimY - boardH * 0.7;
    const innerRight = boardLeft + 2;
    const innerLeft = innerRight - innerWidth;
    const netHeight = ball.radius * 2.4;

    return {
        rimRadius,
        boardW,
        boardH,
        boardLeft,
        boardRight,
        boardTop,
        rimY,
        innerLeft,
        innerRight,
        netHeight,
        poleX: boardRight - 16,
        poleW: 12
    };
}

function clampBall() {
    ball.x = Math.min(Math.max(ball.x, ball.radius), canvas.width - ball.radius);
    ball.y = Math.min(Math.max(ball.y, ball.radius), ballGroundY());
}

function resetBall() {
    ball.radius = Math.max(28, Math.min(48, canvas.width * 0.035));
    const hoop = hoopLayout();
    ball.x = Math.min(canvas.width * 0.22, hoop.innerLeft - ball.radius * 3);
    ball.x = Math.max(ball.x, ball.radius + 20);
    ball.y = ballGroundY();
    ball.vx = 0;
    ball.vy = 0;
    ball.rotation = 0;
    ball.peakFromGround = 0;
}

function hitsBall(px, py) {
    const dx = px - ball.x;
    const dy = py - ball.y;
    const grabR = ball.radius * 1.15;
    return dx * dx + dy * dy <= grabR * grabR;
}

function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function recordSample(x, y, t) {
    drag.samples.push({ x, y, t });
    const cutoff = t - THROW_WINDOW_MS;
    while (drag.samples.length > 1 && drag.samples[0].t < cutoff) {
        drag.samples.shift();
    }
}

function throwVelocity() {
    if (drag.samples.length < 2) {
        return { vx: 0, vy: 0 };
    }

    const first = drag.samples[0];
    const last = drag.samples[drag.samples.length - 1];
    const dt = (last.t - first.t) / 1000;

    if (dt < 0.012) {
        return { vx: 0, vy: 0 };
    }

    let vx = (last.x - first.x) / dt;
    let vy = (last.y - first.y) / dt;
    const speed = Math.hypot(vx, vy);

    if (speed > MAX_THROW_SPEED) {
        const scale = MAX_THROW_SPEED / speed;
        vx *= scale;
        vy *= scale;
    }

    return { vx, vy };
}

function collideCircle(cx, cy, cr, bounce) {
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    const minDist = ball.radius + cr;

    if (dist >= minDist) {
        return;
    }

    if (dist === 0) {
        ball.y -= minDist;
        if (ball.vy > 0) {
            ball.vy *= -bounce;
        }
        return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
        ball.vx -= (1 + bounce) * vn * nx;
        ball.vy -= (1 + bounce) * vn * ny;
    }
}

function collideAabb(x, y, w, h, bounce) {
    const left = x;
    const right = x + w;
    const top = y;
    const bottom = y + h;
    const r = ball.radius;
    const inside = ball.x >= left && ball.x <= right && ball.y >= top && ball.y <= bottom;

    if (inside) {
        const overlapLeft = ball.x - left;
        const overlapRight = right - ball.x;
        const overlapTop = ball.y - top;
        const overlapBottom = bottom - ball.y;
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapLeft) {
            ball.x = left - r;
            if (ball.vx > 0) {
                ball.vx *= -bounce;
            }
        } else if (minOverlap === overlapRight) {
            ball.x = right + r;
            if (ball.vx < 0) {
                ball.vx *= -bounce;
            }
        } else if (minOverlap === overlapTop) {
            ball.y = top - r;
            if (ball.vy > 0) {
                ball.vy *= -bounce;
            }
        } else {
            ball.y = bottom + r;
            if (ball.vy < 0) {
                ball.vy *= -bounce;
            }
        }
        return;
    }

    const closestX = Math.min(Math.max(ball.x, left), right);
    const closestY = Math.min(Math.max(ball.y, top), bottom);
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq === 0 || distSq >= r * r) {
        return;
    }

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = r - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
        ball.vx -= (1 + bounce) * vn * nx;
        ball.vy -= (1 + bounce) * vn * ny;
    }
}

function collideHoop(hoop) {
    collideAabb(hoop.boardLeft, hoop.boardTop, hoop.boardW, hoop.boardH, BOARD_BOUNCE);
    collideCircle(hoop.innerLeft, hoop.rimY, hoop.rimRadius, RIM_BOUNCE);
    collideCircle(hoop.innerRight, hoop.rimY, hoop.rimRadius, RIM_BOUNCE);
}

function inNet(hoop) {
    return (
        ball.x > hoop.innerLeft &&
        ball.x < hoop.innerRight &&
        ball.y > hoop.rimY &&
        ball.y < hoop.rimY + hoop.netHeight + ball.radius
    );
}

function checkScore(prevX, prevY, hoop) {
    if (drag.active) {
        game.armed = true;
        return;
    }

    if (!game.armed) {
        const leftHoop = ball.y > hoop.rimY + hoop.netHeight + ball.radius;
        const away = ball.x < hoop.innerLeft - 50 || ball.x > hoop.innerRight + 50;
        if (leftHoop || away) {
            game.armed = true;
        }
        return;
    }

    if (ball.vy <= 40 || prevY > hoop.rimY || ball.y < hoop.rimY) {
        return;
    }

    const dy = ball.y - prevY;
    const t = dy === 0 ? 1 : (hoop.rimY - prevY) / dy;
    if (t < 0 || t > 1) {
        return;
    }

    const xAtRim = prevX + (ball.x - prevX) * t;
    const margin = hoop.rimRadius + 4;

    if (xAtRim > hoop.innerLeft + margin && xAtRim < hoop.innerRight - margin) {
        game.score += 2;
        game.armed = false;
        game.netPulse = 1;
        game.popups.push({
            text: '+2',
            x: (hoop.innerLeft + hoop.innerRight) / 2,
            y: hoop.rimY - 18,
            age: 0
        });
    }
}

function updatePopups(dt) {
    for (let i = game.popups.length - 1; i >= 0; i--) {
        const popup = game.popups[i];
        popup.age += dt;
        popup.y -= 70 * dt;
        if (popup.age > 0.85) {
            game.popups.splice(i, 1);
        }
    }
}

function updateBall(dt) {
    const hoop = hoopLayout();
    const prevX = ball.x;
    const prevY = ball.y;

    if (!drag.active) {
        ball.vy += GRAVITY * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.rotation += (ball.vx / Math.max(ball.radius, 1)) * dt;

        const heightFromGround = ballGroundY() - ball.y;
        if (heightFromGround > ball.peakFromGround) {
            ball.peakFromGround = heightFromGround;
        }

        checkScore(prevX, prevY, hoop);
        collideHoop(hoop);

        if (inNet(hoop) && ball.vy > 0) {
            ball.vx *= Math.pow(0.12, dt);
            ball.vy *= Math.pow(0.55, dt);
            game.netPulse = Math.max(game.netPulse, 0.35);
        }

        if (ball.x - ball.radius <= 0) {
            ball.x = ball.radius;
            ball.vx *= -WALL_BOUNCE;
        } else if (ball.x + ball.radius >= canvas.width) {
            ball.x = canvas.width - ball.radius;
            ball.vx *= -WALL_BOUNCE;
        }

        if (ball.y - ball.radius <= 0) {
            ball.y = ball.radius;
            if (ball.vy < 0) {
                ball.vy *= -WALL_BOUNCE;
            }
        }

        const floor = ballGroundY();

        if (ball.y >= floor) {
            ball.y = floor;
            ball.vx *= Math.exp(-GROUND_DRAG * dt);

            if (ball.vy > 0) {
                const nextHeight = ball.peakFromGround * BOUNCE_RATIO;
                ball.vx *= GROUND_FRICTION;

                if (nextHeight < MIN_BOUNCE_HEIGHT) {
                    ball.vy = 0;
                    ball.peakFromGround = 0;
                } else {
                    ball.vy = -Math.sqrt(2 * GRAVITY * nextHeight);
                    ball.peakFromGround = nextHeight;
                }
            } else {
                ball.vy = 0;
            }

            if (Math.abs(ball.vx) < 10) {
                ball.vx = 0;
            }
        }
    }

    game.netPulse *= Math.pow(0.08, dt);
    updatePopups(dt);
}

const BALL_SPRITE_R = 256;
const NET_HOOKS = 12;
let ballSprite = null;

function mulberry32(seed) {
    let a = seed | 0;
    return function rand() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function almondPath(g, cx, cy, hw, hh) {
    g.beginPath();
    g.moveTo(cx, cy - hh);
    g.bezierCurveTo(cx + hw, cy - hh * 0.32, cx + hw, cy + hh * 0.32, cx, cy + hh);
    g.bezierCurveTo(cx - hw, cy + hh * 0.32, cx - hw, cy - hh * 0.32, cx, cy - hh);
    g.closePath();
}

function createBallSprite() {
    const r = BALL_SPRITE_R;
    const canvas2 = document.createElement('canvas');
    canvas2.width = r * 2;
    canvas2.height = r * 2;
    const g = canvas2.getContext('2d');

    g.save();
    g.translate(r, r);
    g.beginPath();
    g.arc(0, 0, r - 0.5, 0, Math.PI * 2);
    g.clip();

    const orange = g.createRadialGradient(-r * 0.2, -r * 0.22, r * 0.08, 0, 0, r);
    orange.addColorStop(0, '#c96f2e');
    orange.addColorStop(0.7, '#b35a22');
    orange.addColorStop(1, '#9a4c18');
    g.fillStyle = orange;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();

    const creamTop = g.createRadialGradient(-r * 0.08, -r * 0.62, r * 0.04, 0, -r * 0.4, r * 0.72);
    creamTop.addColorStop(0, '#f2ddb0');
    creamTop.addColorStop(0.55, '#e4c894');
    creamTop.addColorStop(1, '#d8bb84');
    g.fillStyle = creamTop;
    almondPath(g, 0, -r * 0.48, r * 0.52, r * 0.44);
    g.fill();

    const creamBot = g.createRadialGradient(r * 0.06, r * 0.28, r * 0.05, 0, r * 0.48, r * 0.72);
    creamBot.addColorStop(0, '#f2ddb0');
    creamBot.addColorStop(0.55, '#e4c894');
    creamBot.addColorStop(1, '#d8bb84');
    g.fillStyle = creamBot;
    almondPath(g, 0, r * 0.48, r * 0.52, r * 0.44);
    g.fill();

    const rand = mulberry32(8675309);
    for (let y = -r; y <= r; y += 7) {
        for (let x = -r; x <= r; x += 7) {
            const px = x + (rand() - 0.5) * 6;
            const py = y + (rand() - 0.5) * 6;
            if (px * px + py * py > (r - 4) * (r - 4)) {
                continue;
            }
            const pr = 3.2 + rand() * 3.0;
            if (rand() > 0.8) {
                g.fillStyle = `rgba(255, 236, 210, ${0.05 + rand() * 0.07})`;
            } else {
                g.fillStyle = `rgba(42, 19, 5, ${0.11 + rand() * 0.17})`;
            }
            g.beginPath();
            g.arc(px, py, pr, 0, Math.PI * 2);
            g.fill();
        }
    }

    const seamW = 16;
    g.strokeStyle = '#2a1305';
    g.lineWidth = seamW;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    g.beginPath();
    g.moveTo(-r, 0);
    g.lineTo(r, 0);
    g.stroke();

    g.beginPath();
    g.moveTo(0, -r);
    g.lineTo(0, r);
    g.stroke();

    g.beginPath();
    g.ellipse(-r * 0.05, 0, r * 0.8, r, 0, -Math.PI * 0.48, Math.PI * 0.48);
    g.stroke();

    g.beginPath();
    g.ellipse(r * 0.05, 0, r * 0.8, r, 0, Math.PI * 0.52, Math.PI * 1.48);
    g.stroke();

    almondPath(g, 0, -r * 0.48, r * 0.52, r * 0.44);
    g.stroke();
    almondPath(g, 0, r * 0.48, r * 0.52, r * 0.44);
    g.stroke();

    g.restore();
    ballSprite = canvas2;
    return canvas2;
}

function getBallSprite() {
    return ballSprite || createBallSprite();
}

function rimVisual(hoop) {
    const cx = (hoop.innerLeft + hoop.innerRight) / 2;
    const cy = hoop.rimY;
    const rxInner = (hoop.innerRight - hoop.innerLeft) / 2;
    const tube = Math.max(4.2, hoop.rimRadius * 1.55);
    const ryInner = Math.max(7, rxInner * 0.17);
    const hooks = [];

    for (let i = 0; i < NET_HOOKS; i++) {
        const a = -Math.PI + ((i + 0.5) * Math.PI * 2) / NET_HOOKS;
        hooks.push({
            i,
            a,
            x: cx + rxInner * Math.cos(a),
            y: cy + ryInner * Math.sin(a),
            nx: Math.cos(a),
            ny: Math.sin(a)
        });
    }

    return {
        cx,
        cy,
        rxInner,
        ryInner,
        rxOuter: rxInner + tube,
        ryOuter: ryInner + tube * 0.62,
        tube,
        hooks
    };
}

function netPoint(hoop, rim, i, t) {
    const hook = rim.hooks[i];
    const mid = rim.cx;
    const pulse = game.netPulse;
    const tug = inNet(hoop) ? (ball.x - mid) * 0.18 : 0;
    const sag = pulse * 10;
    const taper = 1 - t * 0.7;
    const rScale = 1 + Math.sin(i * 2.31) * 0.03;
    const rx = rim.rxInner * taper * rScale;
    const ry = Math.max(2.2, rim.ryInner * taper * rScale);
    const a = hook.a;

    const endX = mid + Math.cos(a) * rx + tug * t;
    const endY = hoop.rimY + hoop.netHeight + sag + Math.sin(a) * ry;
    const ease = t * t * (3 - 2 * t);

    return {
        x: hook.x * (1 - ease) + endX * ease,
        y: hook.y * (1 - t) + endY * t
    };
}

function drawCourt() {
    const floor = groundY();

    const sky = ctx.createLinearGradient(0, 0, 0, floor);
    sky.addColorStop(0, '#1b2433');
    sky.addColorStop(1, '#2c3a4d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, floor);

    const wood = ctx.createLinearGradient(0, floor, 0, canvas.height);
    wood.addColorStop(0, '#c58a3b');
    wood.addColorStop(0.45, '#a86b24');
    wood.addColorStop(1, '#7a4a16');
    ctx.fillStyle = wood;
    ctx.fillRect(0, floor, canvas.width, GROUND_THICKNESS);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, floor + 1.5);
    ctx.lineTo(canvas.width, floor + 1.5);
    ctx.stroke();
}

function drawShadow() {
    const floor = groundY();
    const heightFromGround = Math.max(0, floor - (ball.y + ball.radius));
    const t = Math.min(heightFromGround / (canvas.height * 0.5), 1);
    const scale = 1 + t * 0.7;
    const alpha = 0.28 * (1 - t * 0.65);

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(ball.x, floor - 6, ball.radius * 0.85 * scale, ball.radius * 0.22 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawBackboard(hoop) {
    const floor = groundY();
    const rim = rimVisual(hoop);

    ctx.save();

    const poleGrad = ctx.createLinearGradient(hoop.poleX, 0, hoop.poleX + hoop.poleW, 0);
    poleGrad.addColorStop(0, '#3f4a58');
    poleGrad.addColorStop(0.35, '#9aa6b4');
    poleGrad.addColorStop(0.7, '#5b6774');
    poleGrad.addColorStop(1, '#2f3844');
    ctx.fillStyle = poleGrad;
    ctx.fillRect(
        hoop.poleX,
        hoop.boardTop + hoop.boardH * 0.45,
        hoop.poleW,
        floor - (hoop.boardTop + hoop.boardH * 0.45)
    );

    const glass = ctx.createLinearGradient(0, hoop.boardTop, 0, hoop.boardTop + hoop.boardH);
    glass.addColorStop(0, '#f5f8fc');
    glass.addColorStop(0.48, '#e7edf4');
    glass.addColorStop(1, '#cfd8e4');
    ctx.fillStyle = '#b7c0cc';
    ctx.fillRect(hoop.boardLeft - 3, hoop.boardTop - 3, hoop.boardW + 6, hoop.boardH + 6);
    ctx.fillStyle = glass;
    ctx.fillRect(hoop.boardLeft, hoop.boardTop, hoop.boardW, hoop.boardH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hoop.boardLeft + 1.5, hoop.boardTop + 1.5, hoop.boardW - 3, hoop.boardH - 3);

    ctx.strokeStyle = 'rgba(120, 132, 148, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hoop.boardLeft + 0.5, hoop.boardTop + 0.5, hoop.boardW - 1, hoop.boardH - 1);

    const boxW = hoop.boardW * 0.62;
    const boxH = hoop.boardH * 0.36;
    const boxX = hoop.boardLeft + (hoop.boardW - boxW) / 2;
    const boxY = hoop.rimY - boxH;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    const bracketShadow = ctx.createRadialGradient(
        hoop.boardLeft + 8,
        hoop.rimY,
        2,
        hoop.boardLeft + 10,
        hoop.rimY + 6,
        28
    );
    bracketShadow.addColorStop(0, 'rgba(0, 0, 0, 0.22)');
    bracketShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bracketShadow;
    ctx.fillRect(hoop.boardLeft, hoop.rimY - 16, 34, 36);

    const bracket = ctx.createLinearGradient(hoop.innerRight - 6, hoop.rimY - 6, hoop.boardLeft + 14, hoop.rimY + 8);
    bracket.addColorStop(0, '#d5dbe3');
    bracket.addColorStop(0.45, '#8b95a2');
    bracket.addColorStop(1, '#4b5563');
    ctx.fillStyle = bracket;
    ctx.fillRect(hoop.innerRight - 4, hoop.rimY - 5, hoop.boardLeft - hoop.innerRight + 16, 10);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(rim.cx + rim.rxInner * 0.55, hoop.rimY + 7, rim.rxInner * 0.42, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawNet(hoop, layer = 'all') {
    const rim = rimVisual(hoop);
    const n = rim.hooks.length;
    const rows = 4;
    const pulse = game.netPulse;

    ctx.save();

    if (layer === 'back') {
        ctx.globalAlpha = 0.55;
    }

    if (layer !== 'front') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.beginPath();
        ctx.ellipse(
            rim.cx,
            hoop.rimY + hoop.netHeight * 0.72 + pulse * 8,
            rim.rxInner * 0.38,
            7 + pulse * 3,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    const isFrontHook = (i) => rim.hooks[i].y >= rim.cy - 0.4;

    const drawStrand = (i) => {
        const front = isFrontHook(i);
        if (layer === 'front' && !front) {
            return;
        }
        if (layer === 'back' && front) {
            return;
        }

        const p0 = netPoint(hoop, rim, i, 0);
        const p1 = netPoint(hoop, rim, i, 0.45);
        const p2 = netPoint(hoop, rim, i, 1);
        const width = 1.5 + (i % 3) * 0.35;

        ctx.strokeStyle = '#f4f4f2';
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
        ctx.stroke();
    };

    for (let i = 0; i < n; i++) {
        drawStrand(i);
    }

    ctx.strokeStyle = '#ecece8';
    ctx.fillStyle = '#f4f4f2';
    ctx.lineCap = 'round';

    for (let row = 0; row < rows; row++) {
        const t0 = (row + 0.7) / (rows + 1.2);
        const t1 = (row + 1.55) / (rows + 1.2);

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const bothFront = isFrontHook(i) && isFrontHook(j);

            if (layer === 'front' && !bothFront) {
                continue;
            }
            if (layer === 'back' && bothFront) {
                continue;
            }

            const a0 = netPoint(hoop, rim, i, t0);
            const b0 = netPoint(hoop, rim, j, t0);
            const a1 = netPoint(hoop, rim, i, t1);
            const b1 = netPoint(hoop, rim, j, t1);
            const wobble = Math.sin(i * 2.3 + row * 1.1) * 1.2;

            ctx.lineWidth = 1.45 + ((i + row) % 3) * 0.2;

            ctx.beginPath();
            ctx.moveTo(a0.x, a0.y);
            ctx.quadraticCurveTo((a0.x + b1.x) * 0.5 + wobble, (a0.y + b1.y) * 0.5, b1.x, b1.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(b0.x, b0.y);
            ctx.quadraticCurveTo((b0.x + a1.x) * 0.5 - wobble, (b0.y + a1.y) * 0.5, a1.x, a1.y);
            ctx.stroke();
        }
    }

    for (let row = 0; row <= rows; row++) {
        const t = (row + 0.7) / (rows + 1.2);
        for (let i = 0; i < n; i++) {
            const front = isFrontHook(i);
            if (layer === 'front' && !front) {
                continue;
            }
            if (layer === 'back' && front) {
                continue;
            }
            const p = netPoint(hoop, rim, i, t);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.25 + (i % 2) * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawRim(hoop) {
    const rim = rimVisual(hoop);
    const { cx, cy, rxInner, ryInner, rxOuter, ryOuter, hooks } = rim;

    ctx.save();

    ctx.fillStyle = 'rgba(20, 8, 8, 0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 5, rxOuter * 0.96, Math.max(3.5, ryOuter * 0.55), 0, 0, Math.PI * 2);
    ctx.fill();

    const steel = ctx.createLinearGradient(cx - rxOuter, cy - ryOuter, cx + rxOuter * 0.35, cy + ryOuter);
    steel.addColorStop(0, '#e85a4a');
    steel.addColorStop(0.28, '#d13a32');
    steel.addColorStop(0.62, '#b42822');
    steel.addColorStop(1, '#8f1f16');

    ctx.fillStyle = steel;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rxOuter, ryOuter, 0, 0, Math.PI * 2);
    ctx.ellipse(cx, cy, rxInner, ryInner, 0, 0, Math.PI * 2);
    ctx.fill('evenodd');

    ctx.strokeStyle = 'rgba(80, 16, 12, 0.55)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rxInner, ryInner, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 170, 150, 0.38)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 0.6, rxOuter - 0.8, ryOuter - 0.5, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rxOuter - 0.4, ryOuter - 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();

    for (const hook of hooks) {
        ctx.save();
        ctx.translate(hook.x, hook.y);
        ctx.rotate(hook.a + Math.PI / 2);
        ctx.fillStyle = '#3a0f0c';
        ctx.fillRect(-1.5, -1.1, 3, 4.2);
        ctx.fillStyle = '#1a0706';
        ctx.fillRect(-1.1, 0.6, 2.2, 1.3);
        ctx.restore();
    }

    ctx.restore();
}

function drawBasketball() {
    const { x, y, radius: r, rotation } = ball;
    const sprite = getBallSprite();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
    ctx.clip();

    const shade = ctx.createRadialGradient(
        x - r * 0.28,
        y - r * 0.32,
        r * 0.18,
        x - r * 0.08,
        y - r * 0.1,
        r * 1.08
    );
    shade.addColorStop(0, 'rgba(255, 248, 235, 0.16)');
    shade.addColorStop(0.42, 'rgba(255, 255, 255, 0)');
    shade.addColorStop(0.78, 'rgba(40, 16, 8, 0.1)');
    shade.addColorStop(1, 'rgba(20, 8, 4, 0.28)');
    ctx.fillStyle = shade;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.28, y - r * 0.34, r * 0.32, r * 0.15, -0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r - 0.4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(42, 18, 8, 0.32)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
}

function drawHud() {
    ctx.save();
    ctx.font = '700 36px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillText(`SCORE  ${game.score}`, 34, 50);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`SCORE  ${game.score}`, 32, 48);

    ctx.font = '600 14px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
    ctx.fillText('Throw the ball through the hoop', 32, 72);

    for (const popup of game.popups) {
        const alpha = 1 - popup.age / 0.85;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.font = '800 40px system-ui, Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fb923c';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}

canvas.addEventListener('pointerdown', (e) => {
    const pos = pointerPos(e);
    if (!hitsBall(pos.x, pos.y)) {
        return;
    }

    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    drag.active = true;
    drag.offsetX = ball.x - pos.x;
    drag.offsetY = ball.y - pos.y;
    drag.samples = [];
    ball.vx = 0;
    ball.vy = 0;
    ball.peakFromGround = 0;
    recordSample(ball.x, ball.y, performance.now());
    canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('pointermove', (e) => {
    const pos = pointerPos(e);

    if (!drag.active) {
        canvas.style.cursor = hitsBall(pos.x, pos.y) ? 'grab' : 'default';
        return;
    }

    ball.x = pos.x + drag.offsetX;
    ball.y = pos.y + drag.offsetY;
    clampBall();
    recordSample(ball.x, ball.y, performance.now());
});

function releaseBall(e) {
    if (!drag.active) {
        return;
    }

    drag.active = false;
    const thrown = throwVelocity();
    ball.vx = thrown.vx;
    ball.vy = thrown.vy;
    ball.peakFromGround = Math.max(0, ballGroundY() - ball.y);
    drag.samples = [];
    canvas.style.cursor = 'grab';

    if (e && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
    }
}

canvas.addEventListener('pointerup', releaseBall);
canvas.addEventListener('pointercancel', releaseBall);

window.addEventListener('resize', () => {
    const heightFromGround = Math.max(0, ballGroundY() - ball.y);
    const xRatio = canvas.width ? ball.x / canvas.width : 0.5;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ball.radius = Math.max(28, Math.min(48, canvas.width * 0.035));
    ball.x = xRatio * canvas.width;
    ball.y = ballGroundY() - heightFromGround;
    clampBall();
});

resetBall();
createBallSprite();

let lastTime = performance.now();

function animate(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const hoop = hoopLayout();

    updateBall(dt);

    const throughHoop =
        ball.y > hoop.rimY - 6 &&
        ball.x > hoop.innerLeft &&
        ball.x < hoop.innerRight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCourt();
    drawBackboard(hoop);
    drawNet(hoop, 'back');
    drawShadow();
    if (!throughHoop) {
        drawRim(hoop);
    }
    drawBasketball();
    drawNet(hoop, 'front');
    if (throughHoop) {
        drawRim(hoop);
    }
    drawHud();

    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
