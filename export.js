// Export/Print utilities (PDF/JSON/CSV are triggered from app.js)

// PDF font state（使用內建 Helvetica）
let pdfFontReady = false;

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
  if (statusLeft) statusLeft.textContent = '匯出 PDF 中...';
  try {
    await exportSelectedPDF(selected);
    showMessage('完成', `PDF 已匯出並下載（${selected.length} 題）。`);
  } catch (error) {
    console.error('匯出 PDF 失敗:', error);
    showMessage('錯誤', '匯出 PDF 失敗，請稍後再試或檢查圖片來源。');
  } finally {
    if (statusLeft) statusLeft.textContent = prevStatus || '就緒';
  }
}

async function exportSelectedPDF(questions) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    showMessage('錯誤', '未載入 jsPDF，請確認網路連線或稍後再試。');
    return;
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const maxWidth = pageWidth - margin * 2;

  // 第一部分：只輸出題目圖片（不輸出文字）
  setPdfFont(pdf);
  let y = margin;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const code = `A${String(i + 1).padStart(3, '0')}`;
    y = await renderQuestionFrame(pdf, getProblemImage(q), code, y, margin, maxWidth, { pageHeight, margin });
  }

  // 第二部分：答案以 5x5 格呈現（不放大，只縮小以塞入格子）
  pdf.addPage();
  setPdfFont(pdf);
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const cellsPerRow = 5;
  const cellWidth = usableWidth / cellsPerRow;
  const cellHeight = usableHeight / 5; // 5 列
  let row = 0;
  let col = 0;

  for (let i = 0; i < questions.length; i++) {
    if (row * cellHeight + margin + cellHeight > pageHeight - margin) {
      pdf.addPage();
      setPdfFont(pdf);
      row = 0;
      col = 0;
    }

    const q = questions[i];
    const answerSrc = getAnswerImage(q) || getSolutionImage(q);
    const code = `A${String(i + 1).padStart(3, '0')}`;
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

  pdf.save(`shuatiji-selected-${formatDateForFilename(new Date())}.pdf`);
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


async function renderQuestionFrame(pdf, src, code, y, margin, maxWidth, dims) {
  const { pageHeight } = dims;
  if (!src) return y;
  const imgMeta = await loadImageMeta(src);
  if (!imgMeta) return y;

  const padding = 6;
  const labelHeight = 12;
  let ratio = Math.min(
    maxWidth / imgMeta.width,
    (pageHeight - margin - y - padding * 2 - labelHeight) / imgMeta.height
  );
  if (ratio <= 0) ratio = 1;

  let renderWidth = imgMeta.width * ratio;
  let renderHeight = imgMeta.height * ratio;
  let frameWidth = renderWidth + padding * 2;
  let frameHeight = renderHeight + padding * 2 + labelHeight;

  if (y + frameHeight > pageHeight - margin) {
    pdf.addPage();
    setPdfFont(pdf);
    y = margin;
    ratio = Math.min(
      maxWidth / imgMeta.width,
      (pageHeight - margin - y - padding * 2 - labelHeight) / imgMeta.height
    );
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

  return y + frameHeight + 10;
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
