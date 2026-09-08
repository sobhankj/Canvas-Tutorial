const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const presets = document.querySelectorAll('.preset');
const toolButtons = document.querySelectorAll('.tool-btn');
const sizeSelect = document.getElementById('sizeSelect');
const sizeToggle = document.getElementById('sizeToggle');
const sizeOptions = document.getElementById('sizeOptions');
const sizePreview = document.getElementById('sizePreview');

let isDrawing = false;
let selectedTool = 'pen';
let activeTool = 'pen';
let lastPos = null;
let lineWidth = 4;
let shapeOrigin = null;
let canvasSnapshot = null;

ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.strokeStyle = colorPicker.value;
ctx.fillStyle = colorPicker.value;
ctx.lineWidth = lineWidth;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
sizePreview.style.height = `${lineWidth}px`;

function isShapeTool(tool) {
    return tool === 'line' || tool === 'rect' || tool === 'fillRect';
}

function setColor(color, activePreset = null) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    colorPicker.value = color;

    presets.forEach((preset) => {
        preset.classList.toggle('active', preset === activePreset);
    });
}

function cancelShape() {
    if (canvasSnapshot) {
        ctx.putImageData(canvasSnapshot, 0, 0);
    }

    shapeOrigin = null;
    canvasSnapshot = null;
}

function setTool(tool) {
    if (tool !== selectedTool) {
        cancelShape();
    }

    selectedTool = tool;
    activeTool = tool;

    toolButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.tool === tool);
    });
}

colorPicker.addEventListener('input', () => {
    setColor(colorPicker.value);
});

presets.forEach((preset) => {
    preset.addEventListener('click', () => {
        setColor(preset.value, preset);
    });

    preset.addEventListener('input', () => {
        setColor(preset.value, preset);
    });
});

toolButtons.forEach((button) => {
    button.addEventListener('click', () => setTool(button.dataset.tool));
});

function eraseAll() {
    cancelShape();
    isDrawing = false;
    lastPos = null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = colorPicker.value;
    ctx.strokeStyle = colorPicker.value;
}

document.getElementById('eraseAllBtn').addEventListener('click', eraseAll);

function setLineWidth(width) {
    lineWidth = width;
    ctx.lineWidth = width;
    sizePreview.style.height = `${width}px`;

    sizeOptions.querySelectorAll('.size-option').forEach((option) => {
        option.classList.toggle('active', Number(option.dataset.size) === width);
    });
}

function closeSizeOptions() {
    sizeOptions.hidden = true;
    sizeToggle.setAttribute('aria-expanded', 'false');
}

sizeToggle.addEventListener('click', () => {
    const isOpen = sizeOptions.hidden;
    sizeOptions.hidden = !isOpen;
    sizeToggle.setAttribute('aria-expanded', String(isOpen));
});

sizeOptions.addEventListener('click', (event) => {
    const option = event.target.closest('.size-option');
    if (!option) return;

    setLineWidth(Number(option.dataset.size));
    closeSizeOptions();
});

document.addEventListener('click', (event) => {
    if (!sizeSelect.contains(event.target)) {
        closeSizeOptions();
    }
});

function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

function drawFreeLine(from, to) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

function drawRectOutline(from, to) {
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const width = Math.abs(to.x - from.x);
    const height = Math.abs(to.y - from.y);
    ctx.strokeRect(x, y, width, height);
}

function drawFilledRect(from, to) {
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const width = Math.abs(to.x - from.x);
    const height = Math.abs(to.y - from.y);
    ctx.fillRect(x, y, width, height);
}

function drawShape(from, to, tool) {
    if (tool === 'rect') {
        drawRectOutline(from, to);
        return;
    }

    if (tool === 'fillRect') {
        drawFilledRect(from, to);
        return;
    }

    drawFreeLine(from, to);
}

function clearAlongLine(from, to) {
    const size = lineWidth;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = from.x + dx * t;
        const y = from.y + dy * t;
        ctx.clearRect(x - size / 2, y - size / 2, size, size);
    }
}

function applyBrush(from, to) {
    if (activeTool === 'eraser') {
        clearAlongLine(from, to);
        return;
    }

    drawFreeLine(from, to);
}

function startShape(pos) {
    shapeOrigin = pos;
    canvasSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function previewShape(pos) {
    ctx.putImageData(canvasSnapshot, 0, 0);
    drawShape(shapeOrigin, pos, selectedTool);
}

function finishShape(pos) {
    ctx.putImageData(canvasSnapshot, 0, 0);
    drawShape(shapeOrigin, pos, selectedTool);
    shapeOrigin = null;
    canvasSnapshot = null;
}

canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

canvas.addEventListener('mousedown', (event) => {
    if (event.button === 2) {
        cancelShape();
        activeTool = 'eraser';
        isDrawing = true;
        lastPos = getMousePos(event);
        applyBrush(lastPos, lastPos);
        return;
    }

    if (event.button !== 0) return;

    const pos = getMousePos(event);

    if (isShapeTool(selectedTool)) {
        if (!shapeOrigin) {
            startShape(pos);
            return;
        }

        finishShape(pos);
        return;
    }

    activeTool = selectedTool;
    isDrawing = true;
    lastPos = pos;
    applyBrush(lastPos, lastPos);
});

canvas.addEventListener('mousemove', (event) => {
    const pos = getMousePos(event);

    if (shapeOrigin && canvasSnapshot) {
        previewShape(pos);
        return;
    }

    if (!isDrawing || !lastPos) return;

    applyBrush(lastPos, pos);
    lastPos = pos;
});

canvas.addEventListener('mouseup', (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    if (isShapeTool(selectedTool) && event.button === 0) return;

    isDrawing = false;
    lastPos = null;
    activeTool = selectedTool;
});
