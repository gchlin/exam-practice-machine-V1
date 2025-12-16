// Export/Print utilities (PDF/JSON/CSV are triggered from app.js)

// PDF font state（使用內建 Helvetica）
let pdfFontReady = false;

// Minimum scale to avoid over-shrinking when space is tight (used only for legacy check; current logic prefers page break)
const MIN_RENDER_RATIO = 0.75;
const FRAME_PADDING = 6;
const FRAME_LABEL_HEIGHT = 12;
const FRAME_GAP = 10;
const COLUMN_GUTTER = 16;

function openExportModal() {
  const selected = getSelectedQuestions();
  if (selected.length === 0) {
    showMessage('提示', '請先勾選要匯出的題目！');
    return;
  }
  const hint = document.getElementById('export-selection-hint');
  if (hint) hint.textContent = `已選 ${selected.length} 題`;
  const modal = document.getElementById('export-modal');
  if (modal) modal.style.display = 'flex';
}

function closeExportModal() {
  const modal = document.getElementById('export-modal');
  if (modal) modal.style.display = 'none';
}

function getExportOrderMode() {
  const radio = document.querySelector('input[name="export-order"]:checked');
  return radio ? radio.value : 'original';
}

function getExportLayout() {
  const radio = document.querySelector('input[name="export-layout"]:checked');
  return radio ? radio.value : 'single';
}

function shouldUseCalcArea() {
  const cb = document.getElementById('export-calc-area');
  return cb ? cb.checked : false;
}

function showExportOverlay(text = '正在匯出，請稍候…') {
  const overlay = document.getElementById('export-progress-overlay');
  const label = document.getElementById('export-progress-text');
  if (label) label.textContent = text;
  if (overlay) overlay.style.display = 'flex';
}

function hideExportOverlay() {
  const overlay = document.getElementById('export-progress-overlay');
  if (overlay) overlay.style.display = 'none';
}

function updateExportStatus(text) {
  const label = document.getElementById('export-progress-text');
  if (label) label.textContent = text;
  const statusLeft = document.getElementById('status-left');
  if (statusLeft) statusLeft.textContent = text;
}

async function startExportPDF() {
  const selected = getSelectedQuestions();
  if (selected.length === 0) {
    closeExportModal();
    showMessage('提示', '請先勾選要匯出的題目！');
    return;
  }
  closeExportModal();
  const statusLeft = document.getElementById('status-left');
  const prevStatus = statusLeft ? statusLeft.textContent : '';
  updateExportStatus('匯出 PDF 中...');
  showExportOverlay('正在匯出 PDF，請稍候…');
  try {
    await exportSelectedPDF(selected);
    updateExportStatus('匯出完成');
    showMessage('完成', `PDF 已匯出並下載（${selected.length} 題）。`);
  } catch (error) {
    console.error('匯出 PDF 失敗:', error);
    showMessage('錯誤', '匯出 PDF 失敗，請稍後再試或檢查圖片來源。');
  } finally {
    hideExportOverlay();
    if (statusLeft) statusLeft.textContent = prevStatus || '就緒';
  }
}

function estimateQuestionBlockHeight(meta, layout) {
  const { maxWidth, pageHeight, margin } = layout;
  const padding = FRAME_PADDING;
  const labelHeight = FRAME_LABEL_HEIGHT;
  const gap = FRAME_GAP;

  if (!meta) {
    return pageHeight - margin * 2;
  }

  const ratio = Math.min(1, maxWidth / meta.width);
  const renderHeight = meta.height * ratio;
  const frameHeight = renderHeight + padding * 2 + labelHeight;
  return frameHeight + gap;
}

function computeFrameHeight(meta, maxWidth) {
  const padding = FRAME_PADDING;
  const labelHeight = FRAME_LABEL_HEIGHT;
  const gap = FRAME_GAP;

  if (!meta) return Number.MAX_SAFE_INTEGER;

  const ratio = Math.min(1, maxWidth / meta.width);
  const renderHeight = meta.height * ratio;
  const frameHeight = renderHeight + padding * 2 + labelHeight;
  return frameHeight + gap;
}

async function prepareQuestionsForExport(questions, orderMode, layout) {
  const items = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const src = getProblemImage(q);
    const meta = src ? await loadImageMeta(src) : null;
    const blockHeight = estimateQuestionBlockHeight(meta, layout);
    items.push({
      question: q,
      meta,
      src,
      blockHeight,
      originalIndex: i
    });
  }

  if (orderMode !== 'ffd') {
    return items;
  }

  const capacity = layout.pageHeight - layout.margin * 2;
  const sorted = [...items].sort((a, b) => b.blockHeight - a.blockHeight);
  const bins = [];

  sorted.forEach((item) => {
    let placed = false;
    for (const bin of bins) {
      if (bin.used + item.blockHeight <= capacity) {
        bin.items.push(item);
        bin.used += item.blockHeight;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push({ used: item.blockHeight, items: [item] });
    }
  });

  return bins.flatMap(bin => bin.items);
}

async function exportSelectedPDF(questions) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    showMessage('錯誤', '未載入 jsPDF，請確認網路連線或稍後再試。');
    return;
  }

  const layoutMode = getExportLayout();
  const isDouble = layoutMode === 'double';
  const pdf = new jsPDF({
    unit: 'pt',
    format: isDouble ? 'b4' : 'a4',
    orientation: isDouble ? 'landscape' : 'portrait'
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const maxWidth = pageWidth - margin * 2;
  const contentMaxWidth = isDouble ? (pageWidth - margin * 2 - COLUMN_GUTTER) / 2 : maxWidth;

  const orderMode = getExportOrderMode();
  const ordered = await prepareQuestionsForExport(questions, orderMode, {
    maxWidth: contentMaxWidth,
    pageHeight,
    margin
  });
  const numbered = ordered.map((item, idx) => ({
    ...item,
    code: `A${String(idx + 1).padStart(3, '0')}`
  }));
  const useCalcArea = !isDouble && shouldUseCalcArea();
  const totalCount = numbered.length;
  let renderedCount = 0;
  const tick = () => {
    renderedCount += 1;
    if (renderedCount === 1 || renderedCount === totalCount || renderedCount % 5 === 0) {
      updateExportStatus(`正在渲染題目 ${renderedCount}/${totalCount}`);
    }
  };

  // 第一部分：只輸出題目圖片（不輸出文字）
  setPdfFont(pdf);
  if (isDouble) {
    await renderQuestionsTwoColumns(pdf, numbered, {
      pageWidth,
      pageHeight,
      margin,
      colGutter: COLUMN_GUTTER,
      onRendered: tick
    });
  } else if (useCalcArea) {
    await renderQuestionsWithCalcArea(pdf, numbered, { pageHeight, margin, maxWidth, onRendered: tick });
  } else {
    let y = margin;
    for (let i = 0; i < numbered.length; i++) {
      const item = numbered[i];
      y = await renderQuestionFrame(
        pdf,
        getProblemImage(item.question),
        item.code,
        y,
        margin,
        maxWidth,
        { pageHeight, margin },
        { meta: item.meta }
      );
      tick();
    }
  }

  // 第二部分：答案以 5x5 格呈現（不放大，只縮小以塞入格子）
  updateExportStatus('正在整理答案縮圖...');
  pdf.addPage();
  setPdfFont(pdf);
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const cellsPerRow = 5;
  const cellWidth = usableWidth / cellsPerRow;
  const cellHeight = usableHeight / 5; // 5 列
  let row = 0;
  let col = 0;

  for (let i = 0; i < numbered.length; i++) {
    if (row * cellHeight + margin + cellHeight > pageHeight - margin) {
      pdf.addPage();
      setPdfFont(pdf);
      row = 0;
      col = 0;
    }

    const q = numbered[i].question;
    const answerSrc = getAnswerImage(q) || getSolutionImage(q);
    const code = numbered[i].code;
    const xCell = margin + col * cellWidth;
    const yCellTop = margin + row * cellHeight;
    if (answerSrc) {
      const imgMeta = await loadImageMeta(answerSrc);
      if (imgMeta) {
        const scale = Math.min(1, cellWidth / imgMeta.width, cellHeight / imgMeta.height);
        const renderWidth = imgMeta.width * scale;
        const renderHeight = imgMeta.height * scale;
        const x = margin + col * cellWidth + (cellWidth - renderWidth) / 2;
        const yCell = margin + row * cellHeight + (cellHeight - renderHeight) / 2;
        pdf.addImage(imgMeta.dataUrl, imgMeta.format, x, yCell, renderWidth, renderHeight, undefined, 'FAST');
      }
    }

    // 畫出格線與編號
    pdf.rect(xCell, yCellTop, cellWidth, cellHeight);
    pdf.setFontSize(10);
    pdf.text(code, xCell + 2, yCellTop + 10);

    col += 1;
    if (col >= cellsPerRow) {
      col = 0;
      row += 1;
    }
  }

  addPageNumbers(pdf, margin);
  const filename = `shuatiji-selected-${formatDateForFilename(new Date())}.pdf`;
  const saved = await downloadPdf(pdf, filename);
  if (!saved) {
    throw new Error('PDF download was blocked or failed.');
  }
}

async function renderQuestionsWithCalcArea(pdf, items, layout) {
  const { pageHeight, margin, maxWidth, onRendered } = layout;
  const usableHeight = pageHeight - margin * 2;
  const slotCounts = [5, 4, 3, 2, 1];
  const slotHeightMap = {};
  slotCounts.forEach(count => {
    slotHeightMap[count] = usableHeight / count;
  });

  const pickSlotCount = (frameHeight) => {
    for (const count of slotCounts) {
      if (frameHeight <= slotHeightMap[count]) return count;
    }
    return 1;
  };

  let currentSlotCount = null;
  let slotIndex = 0; // 0-based within current page

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const meta = item.meta || (item.question ? await loadImageMeta(getProblemImage(item.question)) : null);
    const frameHeight = computeFrameHeight(meta, maxWidth);
    const bestSlotCount = pickSlotCount(frameHeight);

    const hasCurrent = currentSlotCount !== null;
    const currentSlotHeight = hasCurrent ? slotHeightMap[currentSlotCount] : 0;
    const fitsCurrent = hasCurrent && slotIndex < currentSlotCount && frameHeight <= currentSlotHeight;

    if (!fitsCurrent) {
      if (hasCurrent) {
        pdf.addPage();
        setPdfFont(pdf);
      }
      currentSlotCount = bestSlotCount;
      slotIndex = 0;
    }

    const slotHeight = slotHeightMap[currentSlotCount];
    const yTop = margin + slotIndex * slotHeight;

    await renderQuestionInSlot(pdf, item, yTop, slotHeight, margin, maxWidth, meta);
    if (onRendered) onRendered();
    if (onRendered) onRendered();

    slotIndex += 1;
    if (slotIndex >= currentSlotCount && i < items.length - 1) {
      pdf.addPage();
      setPdfFont(pdf);
      currentSlotCount = null;
      slotIndex = 0;
    }
  }
}

async function renderQuestionsTwoColumns(pdf, items, layout) {
  const { pageWidth, pageHeight, margin, colGutter, onRendered } = layout;
  const colWidth = (pageWidth - margin * 2 - colGutter) / 2;

  let col = 0; // 0 left, 1 right
  let y = margin;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const src = getProblemImage(item.question);
    const imgMeta = item.meta || (src ? await loadImageMeta(src) : null);
    if (!imgMeta) {
      if (onRendered) onRendered();
      continue;
    }

    const ratio = Math.min(1, colWidth / imgMeta.width);
    const renderWidth = imgMeta.width * ratio;
    const renderHeight = imgMeta.height * ratio;
    const frameWidth = renderWidth + FRAME_PADDING * 2;
    const frameHeight = renderHeight + FRAME_PADDING * 2 + FRAME_LABEL_HEIGHT;

    // 如果當前列放不下，換下一列；若兩列都滿則換頁
    const availableBottom = pageHeight - margin;
    if (y + frameHeight > availableBottom) {
      if (col === 0) {
        col = 1;
        y = margin;
      } else {
        pdf.addPage();
        setPdfFont(pdf);
        col = 0;
        y = margin;
      }
    }

    const x = margin + col * (colWidth + colGutter);
    pdf.rect(x, y, frameWidth, frameHeight);
    pdf.setFontSize(10);
    pdf.text(item.code, x + 4, y + FRAME_LABEL_HEIGHT - 2);

    const imgX = x + FRAME_PADDING;
    const imgY = y + FRAME_LABEL_HEIGHT + FRAME_PADDING;
    pdf.addImage(imgMeta.dataUrl, imgMeta.format, imgX, imgY, renderWidth, renderHeight, undefined, 'FAST');

    if (onRendered) onRendered();

    y += frameHeight + FRAME_GAP;
  }
}

async function renderQuestionInSlot(pdf, item, yTop, slotHeight, margin, maxWidth, metaFromPrepare) {
  const src = getProblemImage(item.question);
  const imgMeta = metaFromPrepare || (src ? await loadImageMeta(src) : null);
  if (!imgMeta) return;

  const ratioWidth = Math.min(1, maxWidth / imgMeta.width);
  let renderWidth = imgMeta.width * ratioWidth;
  let renderHeight = imgMeta.height * ratioWidth;

  let frameHeight = renderHeight + FRAME_PADDING * 2 + FRAME_LABEL_HEIGHT;
  const totalHeightWithGap = frameHeight + FRAME_GAP;
  if (totalHeightWithGap > slotHeight) {
    const safeRatio = Math.min(1, (slotHeight - FRAME_GAP) / frameHeight);
    renderWidth *= safeRatio;
    renderHeight *= safeRatio;
    frameHeight = renderHeight + FRAME_PADDING * 2 + FRAME_LABEL_HEIGHT;
  }

  const x = margin;
  const verticalOffset = Math.max(0, (slotHeight - (frameHeight + FRAME_GAP)) / 2);
  const frameY = yTop + verticalOffset;

  pdf.rect(x, frameY, renderWidth + FRAME_PADDING * 2, renderHeight + FRAME_PADDING * 2 + FRAME_LABEL_HEIGHT);
  pdf.setFontSize(10);
  pdf.text(item.code, x + 4, frameY + FRAME_LABEL_HEIGHT - 2);

  const imgX = x + FRAME_PADDING;
  const imgY = frameY + FRAME_LABEL_HEIGHT + FRAME_PADDING;
  pdf.addImage(imgMeta.dataUrl, imgMeta.format, imgX, imgY, renderWidth, renderHeight, undefined, 'FAST');
}

async function downloadPdf(pdf, filename) {
  try {
    const result = pdf.save(filename, { returnPromise: true });
    if (result && typeof result.then === 'function') {
      await result;
    }
    return true;
  } catch (e) {
    console.warn('pdf.save failed, trying fallback', e);
  }

  try {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (e) {
    console.warn('Fallback download failed', e);
    return false;
  }
}

function addHeadingWithPaging(pdf, text, x, y, dims) {
  const { pageHeight, margin } = dims;
  if (y + 18 > pageHeight - margin) {
    pdf.addPage();
    y = margin;
  }
  pdf.setFontSize(11);
  pdf.text(text, x, y);
  return y + 12;
}

function addHeadingInColumn(pdf, text, x, y, width, addPageFn, side, dims) {
  const { pageHeight, margin } = dims;
  if (y + 18 > pageHeight - margin) {
    addPageFn();
    y = margin;
  }
  pdf.setFontSize(11);
  pdf.text(text, x, y);
  return y + 12;
}

function addTextWithPaging(pdf, text, x, y, maxWidth, dims) {
  const { pageHeight, margin } = dims;
  if (!text) return y;
  const lines = pdf.splitTextToSize(text, maxWidth);
  const lineHeight = 14;
  const blockHeight = lines.length * lineHeight;
  if (y + blockHeight > pageHeight - margin) {
    pdf.addPage();
    y = margin;
  }
  pdf.setFontSize(10);
  pdf.text(lines, x, y);
  return y + blockHeight + 10;
}

function addTextInColumn(pdf, text, x, y, maxWidth, addPageFn, side, dims) {
  const { pageHeight, margin } = dims;
  if (!text) return y;
  const lines = pdf.splitTextToSize(text, maxWidth);
  const lineHeight = 14;
  const blockHeight = lines.length * lineHeight;
  if (y + blockHeight > pageHeight - margin) {
    addPageFn();
    y = margin;
  }
  pdf.setFontSize(10);
  pdf.text(lines, x, y);
  return y + blockHeight + 10;
}

async function appendImageWithPaging(pdf, src, x, y, maxWidth, dims) {
  const { pageHeight, margin } = dims;
  if (!src) return y;
  const imgMeta = await loadImageMeta(src);
  if (!imgMeta) return y;

  const ratio = Math.min(
    maxWidth / imgMeta.width,
    (pageHeight - margin - y) / imgMeta.height
  );

  let renderWidth = imgMeta.width * ratio;
  let renderHeight = imgMeta.height * ratio;

  if (renderHeight <= 0 || renderWidth <= 0) return y;

  if (y + renderHeight > pageHeight - margin) {
    pdf.addPage();
    setPdfFont(pdf);
    y = margin;
    const ratioNew = Math.min(
      maxWidth / imgMeta.width,
      (pageHeight - margin - y) / imgMeta.height
    );
    renderWidth = imgMeta.width * ratioNew;
    renderHeight = imgMeta.height * ratioNew;
  }

  pdf.addImage(imgMeta.dataUrl, imgMeta.format, x, y, renderWidth, renderHeight, undefined, 'FAST');
  return y + renderHeight + 10;
}

async function appendImageInColumn(pdf, src, x, y, maxWidth, addPageFn, side, dims) {
  const { pageHeight, margin } = dims;
  if (!src) return y;
  const imgMeta = await loadImageMeta(src);
  if (!imgMeta) return y;

  const ratio = Math.min(
    maxWidth / imgMeta.width,
    (pageHeight - margin - y) / imgMeta.height
  );

  let renderWidth = imgMeta.width * ratio;
  let renderHeight = imgMeta.height * ratio;

  if (renderHeight <= 0 || renderWidth <= 0) return y;

  if (y + renderHeight > pageHeight - margin) {
    addPageFn();
    setPdfFont(pdf);
    y = margin;
    const ratioNew = Math.min(
      maxWidth / imgMeta.width,
      (pageHeight - margin - y) / imgMeta.height
    );
    renderWidth = imgMeta.width * ratioNew;
    renderHeight = imgMeta.height * ratioNew;
  }

  pdf.addImage(imgMeta.dataUrl, imgMeta.format, x, y, renderWidth, renderHeight, undefined, 'FAST');
  return y + renderHeight + 10;
}


async function renderQuestionFrame(pdf, src, code, y, margin, maxWidth, dims, options = {}) {
  const { pageHeight } = dims;
  if (!src) return y;
  const imgMeta = options.meta || await loadImageMeta(src);
  if (!imgMeta) return y;

  const padding = FRAME_PADDING;
  const labelHeight = FRAME_LABEL_HEIGHT;

  const computeRatio = (currentY) => {
    return Math.min(1, maxWidth / imgMeta.width);
  };

  let ratio = computeRatio(y);
  if (ratio <= 0) ratio = 1;

  let renderWidth = imgMeta.width * ratio;
  let renderHeight = imgMeta.height * ratio;
  let frameWidth = renderWidth + padding * 2;
  let frameHeight = renderHeight + padding * 2 + labelHeight;

  if (y + frameHeight > pageHeight - margin) {
    pdf.addPage();
    setPdfFont(pdf);
    y = margin;
    ratio = computeRatio(y);
    if (ratio <= 0) ratio = 1;
    renderWidth = imgMeta.width * ratio;
    renderHeight = imgMeta.height * ratio;
    frameWidth = renderWidth + padding * 2;
    frameHeight = renderHeight + padding * 2 + labelHeight;
  }

  const x = margin;
  pdf.rect(x, y, frameWidth, frameHeight);
  pdf.setFontSize(10);
  pdf.text(code, x + 4, y + labelHeight - 2);

  const imgX = x + padding;
  const imgY = y + labelHeight + padding;
  pdf.addImage(imgMeta.dataUrl, imgMeta.format, imgX, imgY, renderWidth, renderHeight, undefined, 'FAST');

  return y + frameHeight + FRAME_GAP;
}

async function loadImageMeta(url) {
  try {
    const dataUrl = await loadImageAsDataURL(url);
    if (!dataUrl) return null;
    const img = await loadImageElement(dataUrl);
    const format = dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    return {
      dataUrl,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      format
    };
  } catch (e) {
    console.warn('無法載入圖片:', url, e);
    return null;
  }
}

function loadImageAsDataURL(url) {
  return new Promise((resolve) => {
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      })
      .catch(() => resolve(null));
  });
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function setPdfFont(pdf) {
  // 若字型載入成功則用自訂字型，否則使用內建
  try {
    pdf.setFont('Helvetica', '');
  } catch (e) {
    pdf.setFont('Helvetica', '');
  }
}

function addPageNumbers(pdf, margin) {
  const total = pdf.internal.getNumberOfPages();
  const pageSize = pdf.internal.pageSize;
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    setPdfFont(pdf);
    pdf.setFontSize(9);
    const label = `${i} / ${total}`;
    const textWidth = pdf.getTextWidth(label);
    const x = (pageSize.getWidth() - textWidth) / 2;
    const y = pageSize.getHeight() - margin / 2;
    pdf.text(label, x, y);
  }
}

// Expose to global (for safety if module order changes)
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.startExportPDF = startExportPDF;
window.exportSelectedPDF = exportSelectedPDF;
window.setPdfFont = setPdfFont;
