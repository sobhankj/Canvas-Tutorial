const IDENTITY_KERNEL = [0, 0, 0, 0, 1, 0, 0, 0, 0];
const SHARPEN_KERNEL = [0, -1, 0, -1, 5, -1, 0, -1, 0];
const CANVAS_FX_IDS = new Set(['posterize', 'threshold', 'thresholdEnabled', 'pixelate', 'aberration']);
const GRAIN_MAX_OPACITY = 0.4;
const CANVAS_FX_DEBOUNCE = 200;
const CANVAS_FX_AVAILABLE = Boolean(document.createElement('canvas').getContext('2d'));

const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const landing = document.getElementById('landing');
const workspace = document.getElementById('workspace');
const canvasStage = document.getElementById('canvasStage');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const duotoneCanvas = document.getElementById('duotoneCanvas');
const duotoneCtx = duotoneCanvas.getContext('2d');
const imageStack = document.getElementById('imageStack');
const vignetteOverlay = document.getElementById('vignetteOverlay');
const grainOverlay = document.getElementById('grainOverlay');
const dropError = document.getElementById('dropError');
const sheet = document.getElementById('sheet');
const sheetHeader = document.getElementById('sheetHeader');
const sheetHandle = document.getElementById('sheetHandle');
const sheetScrim = document.getElementById('sheetScrim');
const tabImage = document.getElementById('tabImage');
const tabFilters = document.getElementById('tabFilters');
const panelImage = document.getElementById('panelImage');
const filtersPanel = document.getElementById('filtersPanel');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const filtersHeader = document.getElementById('filtersHeader');
const categoryGrid = document.getElementById('categoryGrid');
const categoryDetail = document.getElementById('categoryDetail');
const categorySubHeader = document.getElementById('categorySubHeader');
const categoryBackBtn = document.getElementById('categoryBackBtn');
const categoryResetBtn = document.getElementById('categoryResetBtn');
const categoryTitle = document.getElementById('categoryTitle');
const categoryGroups = document.querySelectorAll('[data-category]');

const FILTER_CATEGORIES = {
    light: { label: 'Light', controlCount: 3 },
    color: { label: 'Color', controlCount: 5 },
    blur: { label: 'Blur & sharpen', controlCount: 3 },
    tone: { label: 'Tone & style', controlCount: 6 },
    shadow: { label: 'Drop shadow', controlCount: 5 },
    advanced: { label: 'Advanced', controlCount: 4 }
};

let activeCategoryId = null;
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
let isBusy = false;

const progressOverlay = document.getElementById('progressOverlay');
const progressLabel = document.getElementById('progressLabel');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const progressValue = document.getElementById('progressValue');

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
    note.textContent = 'Live canvas preview is not available. These effects are applied when you download.';
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

function waitFrame() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
}

function waitMs(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function setProgress(percent) {
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    progressFill.style.width = `${value}%`;
    progressValue.textContent = `${value}%`;
    progressBar.setAttribute('aria-valuenow', String(value));
}

function showProgress(label) {
    isBusy = true;
    progressLabel.textContent = label;
    setProgress(0);
    progressOverlay.hidden = false;
    progressOverlay.setAttribute('aria-busy', 'true');
}

function hideProgress() {
    isBusy = false;
    progressOverlay.hidden = true;
    progressOverlay.setAttribute('aria-busy', 'false');
    setProgress(0);
}

function readFileWithProgress(file, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) {
                onProgress((event.loaded / event.total) * 55);
            }
        };

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
        reader.readAsArrayBuffer(file);
    });
}

function decodeImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode the image.'));
        img.src = url;
    });
}

function showEditor(file, img) {
    dropzone.hidden = true;
    dropError.hidden = true;
    landing.hidden = true;
    canvasStage.hidden = false;
    sheet.hidden = false;
    document.querySelectorAll('[data-image-meta], [data-editor-actions]').forEach((el) => {
        el.hidden = false;
    });
    workspace.classList.add('is-editing');
    document.querySelector('.editor').classList.add('is-editing');
    sourceFileName = file.name || 'image';
    const displayName = sourceFileName === 'image' ? 'Pasted image' : sourceFileName;
    document.querySelectorAll('[data-file-name]').forEach((el) => {
        el.textContent = displayName;
    });
    document.querySelectorAll('[data-image-size]').forEach((el) => {
        el.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
    });
    applyFilters();
    if (!isDesktopLayout()) {
        selectTab('filters');
        setSheetSnap('peek', false);
        waitFrame().then(() => {
            setSheetSnap('half', true);
        });
    }
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

function isInputDefault(input) {
    if (input.type === 'checkbox') {
        return input.checked === input.defaultChecked;
    }

    if (input.type === 'color') {
        return input.value.toLowerCase() === input.defaultValue.toLowerCase();
    }

    return input.value === input.defaultValue;
}

function getCategoryInputs(id) {
    const group = document.querySelector(`[data-category="${id}"]`);
    return group ? [...group.querySelectorAll('input')] : [];
}

function getAdjustedCount(id) {
    return getCategoryInputs(id).reduce((count, input) => (
        count + (isInputDefault(input) ? 0 : 1)
    ), 0);
}

function getDirtyCategoryCount() {
    return Object.keys(FILTER_CATEGORIES).filter((id) => getAdjustedCount(id) > 0).length;
}

function updateCategoryIndicators() {
    Object.keys(FILTER_CATEGORIES).forEach((id) => {
        const count = getAdjustedCount(id);
        const caption = document.querySelector(`[data-category-caption="${id}"]`);
        const dot = document.querySelector(`[data-category-dot="${id}"]`);
        if (caption) {
            caption.hidden = count === 0;
            caption.textContent = count === 1 ? '1 adjusted' : `${count} adjusted`;
        }
        if (dot) {
            dot.hidden = count === 0;
        }
    });
}

function resetInput(input) {
    if (input.type === 'checkbox') {
        input.checked = input.defaultChecked;
        input.disabled = false;
    } else {
        input.value = input.defaultValue;
        input.disabled = input.id === 'threshold';
        updateValueLabel(input);
    }
}

function commitFilterReset() {
    updateShadowSettings();
    updateThresholdGrayscaleLock();
    applyFilters();
    scheduleCanvasEffects(true);
    updateCategoryIndicators();
}

function resetFilters() {
    filterInputs.forEach(resetInput);
    setMotionAngle(0);
    commitFilterReset();
}

function resetCategory(id) {
    getCategoryInputs(id).forEach(resetInput);
    if (id === 'blur') {
        setMotionAngle(0);
    }
    commitFilterReset();
}

function showCategoryGrid() {
    activeCategoryId = null;
    filtersPanel.classList.remove('is-category-open');
    filtersHeader.hidden = false;
    categoryGrid.hidden = false;
    categoryDetail.hidden = true;
    categoryGroups.forEach((group) => {
        group.hidden = true;
    });
}

function openCategory(id) {
    const meta = FILTER_CATEGORIES[id];
    if (!meta) {
        return;
    }

    activeCategoryId = id;
    filtersPanel.classList.add('is-category-open');
    filtersHeader.hidden = true;
    categoryGrid.hidden = true;
    categoryDetail.hidden = false;
    categoryTitle.textContent = meta.label;
    categoryBackBtn.setAttribute('aria-label', 'Back to categories');
    categoryGroups.forEach((group) => {
        group.hidden = group.dataset.category !== id;
    });

    if (!isDesktopLayout() && meta.controlCount <= 3 && sheetSnap === 'full') {
        setSheetSnap('half', true);
    }
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

function canvasToBlob(sourceCanvas) {
    return new Promise((resolve, reject) => {
        sourceCanvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }

            reject(new Error('Could not create the image file.'));
        }, 'image/png');
    });
}

function getDownloadName() {
    const baseName = sourceFileName.replace(/\.[^.]+$/, '') || 'image';
    return `${baseName}-edited.png`;
}

async function downloadImage() {
    if (!sourceImage || isBusy) {
        return;
    }

    showProgress('Downloading image');

    try {
        setProgress(10);
        await waitFrame();

        const exportCanvas = renderFilteredImage();
        setProgress(72);
        await waitFrame();

        const blob = await canvasToBlob(exportCanvas);
        setProgress(90);

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getDownloadName();
        link.click();
        URL.revokeObjectURL(url);

        setProgress(100);
        await waitMs(220);
    } catch (error) {
        console.error(error);
    } finally {
        hideProgress();
    }
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

async function loadImageFile(file) {
    if (!isImageFile(file)) {
        showError(!dropzone.hidden);
        return;
    }

    if (isBusy) {
        return;
    }

    showError(false);
    showProgress('Uploading image');

    try {
        setProgress(4);
        await waitFrame();

        const buffer = await readFileWithProgress(file, setProgress);
        setProgress(58);
        await waitFrame();

        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }

        const blob = new Blob([buffer], { type: file.type || 'image/*' });
        objectUrl = URL.createObjectURL(blob);

        const img = await decodeImage(objectUrl);
        setProgress(82);
        await waitFrame();

        sourceImage = img;
        drawImageToCanvas(img);
        showEditor(file, img);
        scheduleCanvasEffects(true);
        setProgress(100);
        await waitMs(200);
    } catch (error) {
        showError(true);
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
        }
        console.error(error);
    } finally {
        hideProgress();
    }
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

document.querySelectorAll('.js-change-image').forEach((button) => {
    button.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
    });
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
        updateCategoryIndicators();

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

resetFiltersBtn.addEventListener('click', () => {
    if (getDirtyCategoryCount() > 1 && !window.confirm('Reset all filter categories to their default values?')) {
        return;
    }

    resetFilters();
});
shadowEnabled.addEventListener('change', () => {
    updateShadowSettings();
    applyFilters();
    updateCategoryIndicators();
});
document.querySelectorAll('.js-download').forEach((button) => {
    button.addEventListener('click', downloadImage);
});
updateThresholdGrayscaleLock();

const DESKTOP_QUERY = window.matchMedia('(min-width: 768px)');
const SNAP_NAMES = ['peek', 'half', 'full'];
const FLING_VELOCITY = 0.45;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let sheetSnap = 'peek';
let sheetVisible = 64;
let sheetDragging = false;
let dragStartY = 0;
let dragStartVisible = 0;
let dragStartSnap = 'peek';
let lastDragY = 0;
let lastDragTime = 0;
let dragVelocity = 0;
let dragMoved = false;
let sliderPeeking = false;
let sliderPeekSnap = null;
let sliderPeekTimer = null;
let dragFromCategoryHeader = false;

function isDesktopLayout() {
    return DESKTOP_QUERY.matches;
}

function snapHeights() {
    const minImage = Math.round(window.innerHeight * 0.26);
    const available = workspace.clientHeight || window.innerHeight;
    const maxSheet = Math.max(64, available - minImage);
    return {
        peek: 64,
        half: Math.min(Math.round(window.innerHeight * 0.55), maxSheet),
        full: Math.min(Math.round(window.innerHeight * 0.9), maxSheet)
    };
}

function updateSheetScrim() {
    sheetScrim.hidden = true;
    sheetScrim.classList.remove('is-visible');
}

function applySheetVisible(visible, animate) {
    const maxHeight = snapHeights().full;
    sheetVisible = Math.max(snapHeights().peek, Math.min(maxHeight, visible));
    sheet.classList.toggle('is-animating', Boolean(animate) && !prefersReducedMotion.matches);
    if (animate && prefersReducedMotion.matches) {
        sheet.classList.add('is-animating');
    }
    sheet.style.setProperty('--sheet-visible', `${sheetVisible}px`);
    sheetHandle.setAttribute('aria-expanded', sheetSnap !== 'peek' ? 'true' : 'false');
    updateSheetScrim();
}

function setSheetSnap(name, animate = true) {
    sheetSnap = name;
    applySheetVisible(snapHeights()[name], animate);
}

function nearestSnap(visible, velocity) {
    const heights = snapHeights();
    const points = SNAP_NAMES.map((name) => ({ name, value: heights[name] }));

    if (velocity > FLING_VELOCITY) {
        const next = points.find((point) => point.value > visible + 12);
        return next ? next.name : 'full';
    }

    if (velocity < -FLING_VELOCITY) {
        const previous = [...points].reverse().find((point) => point.value < visible - 12);
        return previous ? previous.name : 'peek';
    }

    return points.reduce((closest, point) => (
        Math.abs(point.value - visible) < Math.abs(heights[closest] - visible) ? point.name : closest
    ), 'peek');
}

function toggleSheetFromHandle() {
    if (isDesktopLayout()) {
        return;
    }

    if (sheetSnap === 'peek') {
        setSheetSnap('half');
        return;
    }

    setSheetSnap('peek');
}

function selectTab(name) {
    const showImage = name === 'image';
    tabImage.classList.toggle('is-active', showImage);
    tabFilters.classList.toggle('is-active', !showImage);
    tabImage.setAttribute('aria-selected', showImage ? 'true' : 'false');
    tabFilters.setAttribute('aria-selected', showImage ? 'false' : 'true');
    tabImage.tabIndex = showImage ? 0 : -1;
    tabFilters.tabIndex = showImage ? -1 : 0;
    panelImage.hidden = !showImage;
    filtersPanel.hidden = showImage;
}

function syncSheetForViewport() {
    if (isDesktopLayout()) {
        sheetDragging = false;
        sheet.classList.remove('is-animating');
        sheet.style.removeProperty('--sheet-visible');
        sheet.removeAttribute('role');
        panelImage.hidden = true;
        filtersPanel.hidden = false;
        sheetScrim.hidden = true;
        sheetScrim.classList.remove('is-visible');
        return;
    }

    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'false');
    sheet.setAttribute('aria-label', 'Editor tools');
    if (!sheet.hidden) {
        setSheetSnap(sheetSnap, false);
        selectTab(filtersPanel.hidden ? 'image' : 'filters');
    }
}

function startSheetDrag(event, captureTarget) {
    if (isDesktopLayout() || event.button !== 0) {
        return;
    }

    sheetDragging = true;
    dragMoved = false;
    dragStartY = event.clientY;
    dragStartVisible = sheetVisible;
    dragStartSnap = sheetSnap;
    lastDragY = event.clientY;
    lastDragTime = performance.now();
    dragVelocity = 0;
    dragFromCategoryHeader = captureTarget === categorySubHeader;
    sheet.classList.remove('is-animating');
    captureTarget.setPointerCapture(event.pointerId);
}

sheetHeader.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.tab-btn')) {
        return;
    }

    startSheetDrag(event, sheetHeader);
});

function onSheetPointerMove(event) {
    if (!sheetDragging) {
        return;
    }

    const now = performance.now();
    const delta = dragStartY - event.clientY;
    if (Math.abs(event.clientY - dragStartY) > 6) {
        dragMoved = true;
    }

    const dt = Math.max(now - lastDragTime, 1);
    dragVelocity = (lastDragY - event.clientY) / dt;
    lastDragY = event.clientY;
    lastDragTime = now;
    applySheetVisible(dragStartVisible + delta, false);
}

function onSheetPointerUp(event) {
    if (!sheetDragging) {
        return;
    }

    sheetDragging = false;

    if (!dragMoved) {
        if (dragFromCategoryHeader) {
            return;
        }

        toggleSheetFromHandle();
        return;
    }

    const goingDown = event.clientY > dragStartY + 8 || dragVelocity < -0.05;
    if (activeCategoryId && goingDown) {
        showCategoryGrid();
        setSheetSnap(dragStartSnap || sheetSnap, true);
        return;
    }

    setSheetSnap(nearestSnap(sheetVisible, dragVelocity));
}

sheetHeader.addEventListener('pointermove', onSheetPointerMove);
sheetHeader.addEventListener('pointerup', onSheetPointerUp);
sheetHeader.addEventListener('pointercancel', onSheetPointerUp);

categorySubHeader.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.category-back-btn') || event.target.closest('.category-reset-link')) {
        return;
    }

    startSheetDrag(event, categorySubHeader);
});
categorySubHeader.addEventListener('pointermove', onSheetPointerMove);
categorySubHeader.addEventListener('pointerup', onSheetPointerUp);
categorySubHeader.addEventListener('pointercancel', onSheetPointerUp);

sheetHandle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleSheetFromHandle();
    }

    if (event.key === 'Escape') {
        if (activeCategoryId) {
            showCategoryGrid();
            return;
        }

        setSheetSnap('peek');
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        const next = SNAP_NAMES[Math.min(SNAP_NAMES.indexOf(sheetSnap) + 1, SNAP_NAMES.length - 1)];
        setSheetSnap(next);
    }

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        const previous = SNAP_NAMES[Math.max(SNAP_NAMES.indexOf(sheetSnap) - 1, 0)];
        setSheetSnap(previous);
    }
});

tabImage.addEventListener('click', () => selectTab('image'));
tabFilters.addEventListener('click', () => selectTab('filters'));

function onTabKeydown(event, current) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
    }

    event.preventDefault();
    const next = current === 'image' ? 'filters' : 'image';
    selectTab(next);
    (next === 'image' ? tabImage : tabFilters).focus();
}

tabImage.addEventListener('keydown', (event) => onTabKeydown(event, 'image'));
tabFilters.addEventListener('keydown', (event) => onTabKeydown(event, 'filters'));

sheetScrim.addEventListener('click', () => {
    if (!isDesktopLayout()) {
        setSheetSnap('peek');
    }
});

DESKTOP_QUERY.addEventListener('change', syncSheetForViewport);
window.addEventListener('resize', () => {
    if (!isDesktopLayout() && !sheet.hidden) {
        setSheetSnap(sheetSnap, false);
    }
});

document.querySelectorAll('[data-open-category]').forEach((tile) => {
    tile.addEventListener('click', () => {
        const id = tile.dataset.openCategory;
        const navigate = () => openCategory(id);

        if (prefersReducedMotion.matches) {
            navigate();
            return;
        }

        tile.classList.add('is-pressed');
        window.setTimeout(() => {
            tile.classList.remove('is-pressed');
            navigate();
        }, 90);
    });
});

categoryBackBtn.addEventListener('click', showCategoryGrid);
categoryResetBtn.addEventListener('click', () => {
    if (activeCategoryId) {
        resetCategory(activeCategoryId);
    }
});

function beginSliderPeek() {
    if (isDesktopLayout() || sliderPeeking || sliderPeekTimer) {
        return;
    }

    sliderPeekTimer = window.setTimeout(() => {
        sliderPeekTimer = null;
        sliderPeeking = true;
        sliderPeekSnap = sheetSnap;
        if (sheetSnap !== 'peek') {
            setSheetSnap('peek', true);
        }
    }, 80);
}

function endSliderPeek() {
    if (sliderPeekTimer) {
        window.clearTimeout(sliderPeekTimer);
        sliderPeekTimer = null;
    }

    if (!sliderPeeking) {
        return;
    }

    const restore = sliderPeekSnap;
    sliderPeeking = false;
    sliderPeekSnap = null;
    if (restore && restore !== 'peek' && !isDesktopLayout()) {
        setSheetSnap(restore, true);
    }
}

filtersPanel.addEventListener('pointerdown', (event) => {
    if (event.target.matches('input[type="range"]:not(:disabled)')) {
        beginSliderPeek();
    }
});
window.addEventListener('pointerup', endSliderPeek);
window.addEventListener('pointercancel', endSliderPeek);

updateCategoryIndicators();
syncSheetForViewport();
