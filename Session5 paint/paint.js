const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let isDrawing = false;

ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.strokeStyle = '#000000';
ctx.lineWidth = 4;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;

    isDrawing = true;
    const pos = getMousePos(event);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
});

canvas.addEventListener('mousemove', (event) => {
    if (!isDrawing) return;

    const pos = getMousePos(event);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
});

canvas.addEventListener('mouseup', (event) => {
    if (event.button !== 0) return;

    isDrawing = false;
});
