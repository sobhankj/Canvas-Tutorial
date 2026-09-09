const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const workspace = document.getElementById('workspace');
const canvasStage = document.getElementById('canvasStage');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const imageMeta = document.getElementById('imageMeta');
const fileNameEl = document.getElementById('fileName');
const imageSizeEl = document.getElementById('imageSize');
const topbarActions = document.getElementById('topbarActions');
const changeBtn = document.getElementById('changeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const dropError = document.getElementById('dropError');
const filtersPanel = document.getElementById('filtersPanel');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const namedFilterInputs = document.querySelectorAll('[data-filter]');
const shadowEnabled = document.getElementById('shadowEnabled');
const shadowSettings = document.getElementById('shadowSettings');
const shadowX = document.getElementById('shadowX');
const shadowY = document.getElementById('shadowY');
const shadowBlur = document.getElementById('shadowBlur');
const shadowColor = document.getElementById('shadowColor');
const filterInputs = document.querySelectorAll('#filtersPanel input');

let sourceImage = null;
let objectUrl = null;
let sourceFileName = 'image';

function isImageFile(file) {
    return Boolean(file && file.type.startsWith('image/'));
}

function setDragging(isDragging) {
    dropzone.classList.toggle('is-dragging', isDragging);
}

function showError(visible) {
    dropError.hidden = !visible;
}

function showEditor(file, img) {
    dropzone.hidden = true;
    dropError.hidden = true;
    canvasStage.hidden = false;
    filtersPanel.hidden = false;
    imageMeta.hidden = false;
    topbarActions.hidden = false;
    workspace.classList.add('is-editing');
    sourceFileName = file.name || 'image';
    fileNameEl.textContent = sourceFileName === 'image' ? 'Pasted image' : sourceFileName;
    imageSizeEl.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
    applyFilters();
}

function formatInputValue(input) {
    if (input.type === 'color') {
        return input.value;
    }

    const unit = input.dataset.unit || '';
    const decimals = String(input.step).includes('.') ? String(input.step).split('.')[1].length : 0;
    return `${Number(input.value).toFixed(decimals)}${unit}`;
}

function updateValueLabel(input) {
    const label = document.querySelector(`[data-value-for="${input.id}"]`);
    if (label) {
        label.textContent = formatInputValue(input);
    }
}

function getNamedFilterString() {
    return [...namedFilterInputs]
        .map((input) => `${input.dataset.filter}(${input.value}${input.dataset.unit || ''})`)
        .join(' ');
}

function getDropShadowString() {
    if (!shadowEnabled.checked) {
        return '';
    }

    return `drop-shadow(${shadowX.value}px ${shadowY.value}px ${shadowBlur.value}px ${shadowColor.value})`;
}

function getFilterString() {
    const namedFilters = getNamedFilterString();
    const dropShadow = getDropShadowString();
    return dropShadow ? `${namedFilters} ${dropShadow}` : namedFilters;
}

function applyFilters() {
    canvas.style.filter = getFilterString();
}

function updateShadowSettings() {
    shadowSettings.hidden = !shadowEnabled.checked;
}

function resetFilters() {
    filterInputs.forEach((input) => {
        if (input.type === 'checkbox') {
            input.checked = input.defaultChecked;
        } else {
            input.value = input.defaultValue;
            updateValueLabel(input);
        }
    });
    updateShadowSettings();
    applyFilters();
}

function getExportPadding() {
    const imageBlur = Number(document.getElementById('blur').value);
    const blurPad = Math.ceil(imageBlur * 3);
    let left = blurPad;
    let right = blurPad;
    let top = blurPad;
    let bottom = blurPad;

    if (shadowEnabled.checked) {
        const offsetX = Number(shadowX.value);
        const offsetY = Number(shadowY.value);
        const spread = Math.ceil(Number(shadowBlur.value) * 2);

        left = Math.max(left, Math.ceil(Math.max(0, -offsetX) + spread));
        right = Math.max(right, Math.ceil(Math.max(0, offsetX) + spread));
        top = Math.max(top, Math.ceil(Math.max(0, -offsetY) + spread));
        bottom = Math.max(bottom, Math.ceil(Math.max(0, offsetY) + spread));
    }

    return { left, right, top, bottom };
}

function renderFilteredImage() {
    const { left, right, top, bottom } = getExportPadding();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = sourceImage.naturalWidth + left + right;
    exportCanvas.height = sourceImage.naturalHeight + top + bottom;

    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.filter = getFilterString();
    exportCtx.drawImage(sourceImage, left, top);

    return exportCanvas;
}

function getDownloadName() {
    const baseName = sourceFileName.replace(/\.[^.]+$/, '') || 'image';
    return `${baseName}-edited.png`;
}

function downloadImage() {
    if (!sourceImage) {
        return;
    }

    renderFilteredImage().toBlob((blob) => {
        if (!blob) {
            return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getDownloadName();
        link.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

function drawImageToCanvas(img) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
}

function loadImageFile(file) {
    if (!isImageFile(file)) {
        showError(!dropzone.hidden);
        return;
    }

    showError(false);

    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
    }

    objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
        sourceImage = img;
        drawImageToCanvas(img);
        showEditor(file, img);
    };

    img.onerror = () => {
        showError(true);
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
    };

    img.src = objectUrl;
}

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
        loadImageFile(file);
    }
});

['dragenter', 'dragover'].forEach((eventName) => {
    workspace.addEventListener(eventName, (event) => {
        event.preventDefault();
        if (!dropzone.hidden) {
            setDragging(true);
        }
    });
});

['dragleave', 'dragend'].forEach((eventName) => {
    workspace.addEventListener(eventName, (event) => {
        event.preventDefault();
        setDragging(false);
    });
});

workspace.addEventListener('drop', (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
        loadImageFile(file);
    }
});

window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());

window.addEventListener('paste', (event) => {
    const items = event.clipboardData?.items;
    if (!items) {
        return;
    }

    for (const item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                loadImageFile(file);
            }
            break;
        }
    }
});

changeBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
});

filterInputs.forEach((input) => {
    input.addEventListener('input', () => {
        if (input.type !== 'checkbox') {
            updateValueLabel(input);
        }
        applyFilters();
    });
});

resetFiltersBtn.addEventListener('click', resetFilters);
shadowEnabled.addEventListener('change', () => {
    updateShadowSettings();
    applyFilters();
});
downloadBtn.addEventListener('click', downloadImage);
