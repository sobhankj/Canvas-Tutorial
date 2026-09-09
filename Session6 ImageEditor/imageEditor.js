const IDENTITY_KERNEL = [0, 0, 0, 0, 1, 0, 0, 0, 0];
const SHARPEN_KERNEL = [0, -1, 0, -1, 5, -1, 0, -1, 0];
const CANVAS_FX_IDS = new Set(['posterize', 'threshold', 'thresholdEnabled', 'pixelate', 'aberration']);
const GRAIN_MAX_OPACITY = 0.4;
const CANVAS_FX_DEBOUNCE = 200;
const CANVAS_FX_AVAILABLE = Boolean(document.createElement('canvas').getContext('2d'));

const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const workspace = document.getElementById('workspace');
const canvasStage = document.getElementById('canvasStage');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const duotoneCanvas = document.getElementById('duotoneCanvas');
const duotoneCtx = duotoneCanvas.getContext('2d');
const imageStack = document.getElementById('imageStack');
const vignetteOverlay = document.getElementById('vignetteOverlay');
const grainOverlay = document.getElementById('grainOverlay');
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
const vignetteInput = document.getElementById('vignette');
const grainInput = document.getElementById('grain');
const duotoneShadows = document.getElementById('duotoneShadows');
const duotoneHighlights = document.getElementById('duotoneHighlights');
const duotoneMix = document.getElementById('duotoneMix');
const sharpenInput = document.getElementById('sharpen');
const midtonesInput = document.getElementById('midtones');
const motionBlurInput = document.getElementById('motionBlur');
const angleButtons = document.querySelectorAll('#motionAngle .angle-btn');
const grayscaleInput = document.getElementById('grayscale');
const grayscaleControl = document.getElementById('grayscaleControl');
const thresholdEnabled = document.getElementById('thresholdEnabled');
const thresholdInput = document.getElementById('threshold');
const thresholdControl = document.getElementById('thresholdControl');
const posterizeInput = document.getElementById('posterize');
const pixelateInput = document.getElementById('pixelate');
const aberrationInput = document.getElementById('aberration');
const advancedGroup = document.getElementById('advancedGroup');
const filterInputs = document.querySelectorAll('#filtersPanel input');
const fxBlur = document.getElementById('fxBlur');
const fxSharpen = document.getElementById('fxSharpen');
const fxGammaR = document.getElementById('fxGammaR');
const fxGammaG = document.getElementById('fxGammaG');
const fxGammaB = document.getElementById('fxGammaB');
const duotoneMatrix = document.getElementById('duotoneMatrix');

let sourceImage = null;
let objectUrl = null;
let sourceFileName = 'image';
let motionAngle = 0;
let canvasFxTimer = null;

const grainDataUri = createGrainDataUri();
const grainImage = new Image();
grainImage.src = grainDataUri;
grainOverlay.style.backgroundImage = `url("${grainDataUri}")`;

if (!CANVAS_FX_AVAILABLE) {
    advancedGroup.querySelectorAll('input, button').forEach((el) => {
        el.disabled = true;
    });
    advancedGroup.querySelectorAll('.filter-control, .toggle-row').forEach((el) => {
        el.classList.add('is-disabled');
    });
    const note = document.createElement('p');
    note.className = 'panel-note';
    note.textContent = 'Canvas processing is not available in this browser.';
    advancedGroup.append(note);
}

function createGrainDataUri() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
        <filter id="grainFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#grainFilter)"/>
    </svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function hexToRgb(hex) {
    const value = hex.replace('#', '');
    return {
        r: parseInt(value.slice(0, 2), 16) / 255,
        g: parseInt(value.slice(2, 4), 16) / 255,
        b: parseInt(value.slice(4, 6), 16) / 255
    };
}

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

    if (input.id === 'posterize') {
        return Number(input.value) < 2 ? 'Off' : String(Number(input.value));
    }

    if (input.id === 'pixelate') {
        return Number(input.value) <= 1 ? 'Off' : `${Number(input.value)}px`;
    }

    if (input.id === 'midtones') {
        const value = Number(input.value);
        return value > 0 ? `+${value}` : String(value);
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

function needsSvgChain() {
    return Number(sharpenInput.value) > 0
        || Number(midtonesInput.value) !== 0
        || Number(motionBlurInput.value) > 0;
}

function getCssAndSvgFilter() {
    const css = getNamedFilterString();
    return needsSvgChain() ? `${css} url(#fxChain)` : css;
}

function setMotionAngle(angle) {
    motionAngle = Number(angle);
    angleButtons.forEach((button) => {
        button.classList.toggle('active', Number(button.dataset.angle) === motionAngle);
    });
}

function updateSvgFilters() {
    const t = Number(sharpenInput.value) / 100;
    const kernel = IDENTITY_KERNEL.map((value, index) => value * (1 - t) + SHARPEN_KERNEL[index] * t);
    fxSharpen.setAttribute('kernelMatrix', kernel.join(' '));

    const exponent = Math.pow(2, -Number(midtonesInput.value) / 100);
    fxGammaR.setAttribute('exponent', String(exponent));
    fxGammaG.setAttribute('exponent', String(exponent));
    fxGammaB.setAttribute('exponent', String(exponent));

    const strength = Number(motionBlurInput.value);
    let stdX = 0;
    let stdY = 0;
    if (strength > 0) {
        if (motionAngle === 0) {
            stdX = strength;
        } else if (motionAngle === 90) {
            stdY = strength;
        } else {
            stdX = strength;
            stdY = strength;
        }
    }
    fxBlur.setAttribute('stdDeviation', `${stdX} ${stdY}`);

    const shadow = hexToRgb(duotoneShadows.value);
    const highlight = hexToRgb(duotoneHighlights.value);
    const deltaR = highlight.r - shadow.r;
    const deltaG = highlight.g - shadow.g;
    const deltaB = highlight.b - shadow.b;
    duotoneMatrix.setAttribute('values', [
        0.2126 * deltaR, 0.7152 * deltaR, 0.0722 * deltaR, 0, shadow.r,
        0.2126 * deltaG, 0.7152 * deltaG, 0.0722 * deltaG, 0, shadow.g,
        0.2126 * deltaB, 0.7152 * deltaB, 0.0722 * deltaB, 0, shadow.b,
        0, 0, 0, 1, 0
    ].join(' '));
}

function updateVignette() {
    const strength = Number(vignetteInput.value) / 100;
    vignetteOverlay.style.setProperty('--vignette-strength', String(strength));
    vignetteOverlay.style.setProperty('--vignette-inner', `${50 - strength * 20}%`);
}

function updateGrain() {
    grainOverlay.style.opacity = String((Number(grainInput.value) / 100) * GRAIN_MAX_OPACITY);
}

function updateDuotoneLayer() {
    const mix = Number(duotoneMix.value) / 100;
    const cssSvg = getCssAndSvgFilter();
    duotoneCanvas.style.filter = mix > 0 ? `${cssSvg} url(#duotone)` : 'none';
    duotoneCanvas.style.opacity = String(mix);
}

function setControlDisabled(control, input, disabled) {
    control.classList.toggle('is-disabled', disabled);
    if (input.type !== 'checkbox') {
        input.disabled = disabled;
    }
}

function updateThresholdGrayscaleLock() {
    if (thresholdEnabled.checked && Number(grayscaleInput.value) > 0) {
        grayscaleInput.value = 0;
        updateValueLabel(grayscaleInput);
    }

    const grayActive = Number(grayscaleInput.value) > 0;
    setControlDisabled(grayscaleControl, grayscaleInput, thresholdEnabled.checked);

    const thresholdToggleRow = thresholdEnabled.closest('.toggle-row');
    thresholdEnabled.disabled = grayActive;
    thresholdToggleRow.classList.toggle('is-disabled', grayActive);

    if (grayActive) {
        thresholdEnabled.checked = false;
    }

    setControlDisabled(thresholdControl, thresholdInput, !thresholdEnabled.checked);
}

function applyFilters() {
    updateSvgFilters();
    canvas.style.filter = getCssAndSvgFilter();
    updateDuotoneLayer();
    imageStack.style.filter = getDropShadowString() || 'none';
    updateVignette();
    updateGrain();
}

function updateShadowSettings() {
    shadowSettings.hidden = !shadowEnabled.checked;
}

function resetFilters() {
    filterInputs.forEach((input) => {
        if (input.type === 'checkbox') {
            input.checked = input.defaultChecked;
            input.disabled = false;
        } else {
            input.value = input.defaultValue;
            input.disabled = input.id === 'threshold';
            updateValueLabel(input);
        }
    });
    setMotionAngle(0);
    updateShadowSettings();
    updateThresholdGrayscaleLock();
    applyFilters();
    scheduleCanvasEffects(true);
}

function hasCanvasEffects() {
    return Number(pixelateInput.value) > 1
        || Number(aberrationInput.value) > 0
        || Number(posterizeInput.value) >= 2
        || thresholdEnabled.checked;
}

function pixelateCanvas(source, blockSize) {
    if (blockSize <= 1) {
        return source;
    }

    const smallW = Math.max(1, Math.floor(source.width / blockSize));
    const smallH = Math.max(1, Math.floor(source.height / blockSize));
    const small = document.createElement('canvas');
    small.width = smallW;
    small.height = smallH;
    const smallCtx = small.getContext('2d');
    smallCtx.imageSmoothingEnabled = false;
    smallCtx.drawImage(source, 0, 0, smallW, smallH);

    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    const outputCtx = output.getContext('2d');
    outputCtx.imageSmoothingEnabled = false;
    outputCtx.drawImage(small, 0, 0, source.width, source.height);
    return output;
}

function chromaticAberration(source, offset) {
    if (offset <= 0) {
        return source;
    }

    const width = source.width;
    const height = source.height;
    const sourceData = source.getContext('2d').getImageData(0, 0, width, height);
    const red = source.getContext('2d').createImageData(width, height);
    const green = source.getContext('2d').createImageData(width, height);
    const blue = source.getContext('2d').createImageData(width, height);
    const pixels = sourceData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        red.data[i] = pixels[i];
        red.data[i + 3] = pixels[i + 3];
        green.data[i + 1] = pixels[i + 1];
        green.data[i + 3] = pixels[i + 3];
        blue.data[i + 2] = pixels[i + 2];
        blue.data[i + 3] = pixels[i + 3];
    }

    const drawChannel = (imageData) => {
        const channel = document.createElement('canvas');
        channel.width = width;
        channel.height = height;
        channel.getContext('2d').putImageData(imageData, 0, 0);
        return channel;
    };

    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const outputCtx = output.getContext('2d');
    outputCtx.globalCompositeOperation = 'lighter';
    outputCtx.drawImage(drawChannel(red), -offset, 0);
    outputCtx.drawImage(drawChannel(green), 0, 0);
    outputCtx.drawImage(drawChannel(blue), offset, 0);
    return output;
}

function posterizeCanvas(source, levels) {
    if (levels < 2) {
        return source;
    }

    const context = source.getContext('2d');
    const imageData = context.getImageData(0, 0, source.width, source.height);
    const data = imageData.data;
    const step = 255 / (levels - 1);

    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(data[i] / step) * step;
        data[i + 1] = Math.round(data[i + 1] / step) * step;
        data[i + 2] = Math.round(data[i + 2] / step) * step;
    }

    context.putImageData(imageData, 0, 0);
    return source;
}

function thresholdCanvas(source, cutoff) {
    const context = source.getContext('2d');
    const imageData = context.getImageData(0, 0, source.width, source.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const luminance = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        const value = luminance >= cutoff ? 255 : 0;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
    }

    context.putImageData(imageData, 0, 0);
    return source;
}

function applyCanvasEffects(img) {
    const work = document.createElement('canvas');
    work.width = img.naturalWidth || img.width;
    work.height = img.naturalHeight || img.height;
    work.getContext('2d').drawImage(img, 0, 0);

    let current = work;
    current = pixelateCanvas(current, Number(pixelateInput.value));
    current = chromaticAberration(current, Number(aberrationInput.value));
    if (Number(posterizeInput.value) >= 2) {
        current = posterizeCanvas(current, Number(posterizeInput.value));
    }
    if (thresholdEnabled.checked) {
        current = thresholdCanvas(current, Number(thresholdInput.value));
    }
    return current;
}

function scheduleCanvasEffects(immediate = false) {
    clearTimeout(canvasFxTimer);

    const run = () => {
        if (!sourceImage) {
            return;
        }

        const processed = hasCanvasEffects() ? applyCanvasEffects(sourceImage) : sourceImage;
        drawImageToCanvas(processed);
    };

    if (immediate || !hasCanvasEffects()) {
        run();
        return;
    }

    canvasFxTimer = setTimeout(run, CANVAS_FX_DEBOUNCE);
}

function getExportPadding() {
    const blurPad = Math.ceil(Math.max(Number(document.getElementById('blur').value), Number(motionBlurInput.value)) * 3);
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

function drawProcessedLayer(targetCtx, image, left, top, filterValue) {
    targetCtx.filter = filterValue || 'none';
    targetCtx.drawImage(image, left, top);
    targetCtx.filter = 'none';
}

function paintVignette(targetCtx, x, y, width, height, strength) {
    if (strength <= 0) {
        return;
    }

    const inner = (50 - strength * 20) / 100;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const outerR = Math.hypot(width / 2, height / 2);
    const gradient = targetCtx.createRadialGradient(cx, cy, outerR * inner, cx, cy, outerR);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${strength})`);
    targetCtx.save();
    targetCtx.globalCompositeOperation = 'multiply';
    targetCtx.fillStyle = gradient;
    targetCtx.fillRect(x, y, width, height);
    targetCtx.restore();
}

function paintGrain(targetCtx, x, y, width, height, amount) {
    if (amount <= 0 || !grainImage.complete || grainImage.naturalWidth === 0) {
        return;
    }

    const pattern = targetCtx.createPattern(grainImage, 'repeat');
    if (!pattern) {
        return;
    }

    targetCtx.save();
    targetCtx.globalAlpha = amount * GRAIN_MAX_OPACITY;
    targetCtx.globalCompositeOperation = 'overlay';
    targetCtx.fillStyle = pattern;
    targetCtx.fillRect(x, y, width, height);
    targetCtx.restore();
}

function renderFilteredImage() {
    updateSvgFilters();
    const processed = hasCanvasEffects() ? applyCanvasEffects(sourceImage) : sourceImage;
    const { left, right, top, bottom } = getExportPadding();
    const width = (processed.naturalWidth || processed.width) + left + right;
    const height = (processed.naturalHeight || processed.height) + top + bottom;
    const imageWidth = processed.naturalWidth || processed.width;
    const imageHeight = processed.naturalHeight || processed.height;
    const cssSvg = getCssAndSvgFilter();
    const mix = Number(duotoneMix.value) / 100;

    const composed = document.createElement('canvas');
    composed.width = width;
    composed.height = height;
    const composedCtx = composed.getContext('2d');
    drawProcessedLayer(composedCtx, processed, left, top, cssSvg);

    if (mix > 0) {
        const duo = document.createElement('canvas');
        duo.width = width;
        duo.height = height;
        drawProcessedLayer(duo.getContext('2d'), processed, left, top, `${cssSvg} url(#duotone)`);
        composedCtx.globalAlpha = mix;
        composedCtx.drawImage(duo, 0, 0);
        composedCtx.globalAlpha = 1;
    }

    paintVignette(composedCtx, left, top, imageWidth, imageHeight, Number(vignetteInput.value) / 100);
    paintGrain(composedCtx, left, top, imageWidth, imageHeight, Number(grainInput.value) / 100);

    const dropShadow = getDropShadowString();
    if (!dropShadow) {
        return composed;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.filter = dropShadow;
    exportCtx.drawImage(composed, 0, 0);
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
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    canvas.width = width;
    canvas.height = height;
    duotoneCanvas.width = width;
    duotoneCanvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    duotoneCtx.clearRect(0, 0, width, height);
    duotoneCtx.drawImage(img, 0, 0, width, height);
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
        scheduleCanvasEffects(true);
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

        if (input.id === 'grayscale' && Number(input.value) > 0 && thresholdEnabled.checked) {
            thresholdEnabled.checked = false;
        }

        if (input.id === 'grayscale' || input.id === 'thresholdEnabled' || input.id === 'threshold') {
            updateThresholdGrayscaleLock();
        }

        applyFilters();

        if (CANVAS_FX_IDS.has(input.id)) {
            scheduleCanvasEffects();
        }
    });
});

angleButtons.forEach((button) => {
    button.addEventListener('click', () => {
        setMotionAngle(button.dataset.angle);
        applyFilters();
    });
});

resetFiltersBtn.addEventListener('click', resetFilters);
shadowEnabled.addEventListener('change', () => {
    updateShadowSettings();
    applyFilters();
});
downloadBtn.addEventListener('click', downloadImage);
updateThresholdGrayscaleLock();
