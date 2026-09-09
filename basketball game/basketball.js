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

function groundY() {
    return canvas.height - GROUND_THICKNESS;
}

function ballGroundY() {
    return groundY() - ball.radius;
}

function clampBall() {
    ball.x = Math.min(Math.max(ball.x, ball.radius), canvas.width - ball.radius);
    ball.y = Math.min(Math.max(ball.y, ball.radius), ballGroundY());
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.radius = Math.max(28, Math.min(48, canvas.width * 0.035));
    ball.peakFromGround = canvas.height * 0.62;
    ball.y = ballGroundY() - ball.peakFromGround;
    ball.vx = 0;
    ball.vy = 0;
    ball.rotation = 0;
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

function updateBall(dt) {
    if (drag.active) {
        return;
    }

    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.rotation += (ball.vx / Math.max(ball.radius, 1)) * dt;

    const heightFromGround = ballGroundY() - ball.y;
    if (heightFromGround > ball.peakFromGround) {
        ball.peakFromGround = heightFromGround;
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

function drawBasketball() {
    const { x, y, radius: r, rotation } = ball;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    const body = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.08, 0, 0, r);
    body.addColorStop(0, '#ffb066');
    body.addColorStop(0.35, '#e67a22');
    body.addColorStop(1, '#9a3b0a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1a120c';
    ctx.lineWidth = Math.max(2.5, r * 0.07);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-r * 0.95, 0, r * 0.95, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(r * 0.95, 0, r * 0.95, Math.PI * 0.58, Math.PI * 1.42);
    ctx.stroke();

    const shine = ctx.createRadialGradient(-r * 0.38, -r * 0.4, 2, -r * 0.2, -r * 0.25, r * 0.55);
    shine.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
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

let lastTime = performance.now();

function animate(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    updateBall(dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCourt();
    drawShadow();
    drawBasketball();

    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
