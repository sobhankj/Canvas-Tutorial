let canvas = document.querySelector('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let cnx = canvas.getContext('2d');
let radius = 20;

function createCircle() {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 300 + 10;

    return {
        x: Math.random() * (canvas.width - radius * 2) + radius,
        y: Math.random() * (canvas.height - radius * 2) + radius,
        speed,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: `rgb(${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)}, ${Math.round(Math.random() * 255)})`
    };
}

const circles = [];
for (let i = 0; i < 80; i++) {
    circles.push(createCircle());
}

function bounce(circle) {
    if (circle.x - radius <= 0) {
        circle.x = radius;
        circle.vx *= -1;
    } else if (circle.x + radius >= canvas.width) {
        circle.x = canvas.width - radius;
        circle.vx *= -1;
    }

    if (circle.y - radius <= 0) {
        circle.y = radius;
        circle.vy *= -1;
    } else if (circle.y + radius >= canvas.height) {
        circle.y = canvas.height - radius;
        circle.vy *= -1;
    }
}

function drawCircle(circle) {
    cnx.strokeStyle = circle.color;
    cnx.fillStyle = circle.color;
    cnx.lineWidth = 2;
    cnx.beginPath();
    cnx.arc(circle.x, circle.y, radius, 0, Math.PI * 2, false);
    cnx.stroke();
    cnx.fill();
}

let lastTime = performance.now();

function animate(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    cnx.clearRect(0, 0, canvas.width, canvas.height);

    circles.forEach((circle) => {
        circle.x += circle.vx * dt;
        circle.y += circle.vy * dt;
        bounce(circle);
        drawCircle(circle);
    });

    requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    circles.forEach((circle) => {
        circle.x = Math.min(Math.max(circle.x, radius), canvas.width - radius);
        circle.y = Math.min(Math.max(circle.y, radius), canvas.height - radius);
    });
});

requestAnimationFrame(animate);
