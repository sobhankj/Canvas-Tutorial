let canvas = document.querySelector('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let cnx = canvas.getContext('2d');

const theme = getComputedStyle(document.documentElement);
const circleColors = [
    theme.getPropertyValue('--color-primary').trim(),
    theme.getPropertyValue('--color-secondary').trim(),
    theme.getPropertyValue('--color-accent').trim(),
    theme.getPropertyValue('--color-text').trim()
];

function randomCircleColor() {
    return circleColors[Math.floor(Math.random() * circleColors.length)];
}

function createCircle() {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 300 + 10;
    const radius = Math.random() * 5 + 5;

    return {
        x: Math.random() * (canvas.width - radius * 2) + radius,
        y: Math.random() * (canvas.height - radius * 2) + radius,
        radius,
        speed,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: randomCircleColor()
    };
}

const circles = [];
for (let i = 0; i < 90; i++) {
    circles.push(createCircle());
}

function bounce(circle) {
    const r = circle.radius;

    if (circle.x - r <= 0) {
        circle.x = r;
        circle.vx *= -1;
    } else if (circle.x + r >= canvas.width) {
        circle.x = canvas.width - r;
        circle.vx *= -1;
    }

    if (circle.y - r <= 0) {
        circle.y = r;
        circle.vy *= -1;
    } else if (circle.y + r >= canvas.height) {
        circle.y = canvas.height - r;
        circle.vy *= -1;
    }
}

function drawCircle(circle) {
    cnx.strokeStyle = circle.color;
    cnx.fillStyle = circle.color;
    cnx.lineWidth = 2;
    cnx.beginPath();
    cnx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2, false);
    cnx.stroke();
    cnx.fill();
}

const BOX_SIZE = 150;
const MAX_MOUSE_CIRCLES_IN_BOX = 15;
const MOUSE_RADIUS = 35;
const MOUSE_MAX_RADIUS = 50;
const GROW_SPEED = 24;
const LIFE_SECONDS = 3;
const SHRINK_SECONDS = 0.35;
const FADE_SECONDS = 0.4;
const SPAWN_INTERVAL = 0.07;
const IDLE_MS = 120;
const TAIL_SHRINK_SPEED = 36;
const TAIL_FADE_SPEED = 1.8;

const mouse = {
    x: canvas.width / 2,
    y: canvas.height / 2
};

const mouseCircles = [];
let mouseReady = false;
let lastMoveTime = 0;
let mouseMoving = false;
let spawnTimer = 0;

function createMouseCircle() {
    const half = BOX_SIZE / 2;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 180 + 40;

    return {
        x: mouse.x + (Math.random() * 2 - 1) * (half - MOUSE_RADIUS),
        y: mouse.y + (Math.random() * 2 - 1) * (half - MOUSE_RADIUS),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: MOUSE_RADIUS,
        color: randomCircleColor(),
        age: 0,
        opacity: 1,
        inTail: false,
        deathRadius: null
    };
}

function isInsideMouseBox(circle) {
    const half = BOX_SIZE / 2;
    return Math.abs(circle.x - mouse.x) <= half && Math.abs(circle.y - mouse.y) <= half;
}

function countMouseCirclesInBox() {
    let count = 0;
    for (let i = 0; i < mouseCircles.length; i++) {
        if (!mouseCircles[i].inTail && isInsideMouseBox(mouseCircles[i])) {
            count++;
        }
    }
    return count;
}

function bounceInMouseBox(circle) {
    const half = BOX_SIZE / 2;
    const r = circle.radius;
    const left = mouse.x - half;
    const right = mouse.x + half;
    const top = mouse.y - half;
    const bottom = mouse.y + half;

    if (circle.x - r <= left) {
        circle.x = left + r;
        circle.vx *= -1;
    } else if (circle.x + r >= right) {
        circle.x = right - r;
        circle.vx *= -1;
    }

    if (circle.y - r <= top) {
        circle.y = top + r;
        circle.vy *= -1;
    } else if (circle.y + r >= bottom) {
        circle.y = bottom - r;
        circle.vy *= -1;
    }
}

function startDying(circle) {
    if (circle.deathRadius == null) {
        circle.deathRadius = circle.radius;
        circle.dyingAge = 0;
    }
}

function updateDying(circle, dt) {
    circle.dyingAge += dt;

    if (circle.dyingAge < SHRINK_SECONDS) {
        const t = circle.dyingAge / SHRINK_SECONDS;
        circle.radius = circle.deathRadius * (1 - t);
        circle.opacity = 1;
    } else {
        const fadeT = (circle.dyingAge - SHRINK_SECONDS) / FADE_SECONDS;
        circle.radius = 0.01;
        circle.opacity = 1 - fadeT;
    }
}

function updateMouseCircle(circle, dt) {
    circle.age += dt;
    circle.x += circle.vx * dt;
    circle.y += circle.vy * dt;

    if (!circle.inTail && !isInsideMouseBox(circle)) {
        circle.inTail = true;
    }

    if (circle.inTail) {
        circle.radius = Math.max(0, circle.radius - TAIL_SHRINK_SPEED * dt);
        circle.opacity -= TAIL_FADE_SPEED * dt;
        return;
    }

    if (mouseMoving) {
        return;
    }

    bounceInMouseBox(circle);

    if (circle.age < LIFE_SECONDS) {
        const maxR = Math.min(MOUSE_MAX_RADIUS, BOX_SIZE / 2 - 2);
        circle.radius = Math.min(circle.radius + GROW_SPEED * dt, maxR);
        return;
    }

    startDying(circle);
    updateDying(circle, dt);
}

function drawMouseCircle(circle) {
    cnx.save();
    cnx.globalAlpha = Math.max(0, circle.opacity);
    cnx.fillStyle = circle.color;
    cnx.strokeStyle = circle.color;
    cnx.lineWidth = 2;
    cnx.beginPath();
    cnx.arc(circle.x, circle.y, Math.max(circle.radius, 0.01), 0, Math.PI * 2, false);
    cnx.fill();
    cnx.stroke();
    cnx.restore();
}

function isMouseCircleDead(circle) {
    return circle.opacity <= 0 || circle.radius <= 0.2;
}

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    lastMoveTime = performance.now();
    mouseReady = true;
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    circles.forEach((circle) => {
        circle.x = Math.min(Math.max(circle.x, circle.radius), canvas.width - circle.radius);
        circle.y = Math.min(Math.max(circle.y, circle.radius), canvas.height - circle.radius);
    });
});

let lastTime = performance.now();

function animate(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    mouseMoving = now - lastMoveTime < IDLE_MS;

    cnx.clearRect(0, 0, canvas.width, canvas.height);

    circles.forEach((circle) => {
        circle.x += circle.vx * dt;
        circle.y += circle.vy * dt;
        bounce(circle);
        drawCircle(circle);
    });

    if (mouseReady) {
        spawnTimer += dt;
        while (spawnTimer >= SPAWN_INTERVAL) {
            spawnTimer -= SPAWN_INTERVAL;
            if (countMouseCirclesInBox() < MAX_MOUSE_CIRCLES_IN_BOX) {
                mouseCircles.push(createMouseCircle());
            }
        }

        for (let i = mouseCircles.length - 1; i >= 0; i--) {
            const circle = mouseCircles[i];
            updateMouseCircle(circle, dt);

            if (isMouseCircleDead(circle)) {
                mouseCircles.splice(i, 1);
                continue;
            }

            drawMouseCircle(circle);
        }
    }

    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
