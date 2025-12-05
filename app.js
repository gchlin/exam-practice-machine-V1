// ============================================
// 刷題機 V1 - Windows 98 風格
// app.js - 主程式邏輯
// ============================================

// ==================== 全域變數 ====================

// 資料
let allQuestions = [];
let filteredQuestions = [];
let selectedQuestions = [];
let practiceQuestions = [];
let currentIndex = 0;

// 紀錄
let practiceLog = [];
let predictLog = [];
let hobbitLog = [];

// 練習狀態
let sessionStartTime = null;
let sessionTotalSeconds = 0;  // 總時間（秒）
let questionTimes = {};  // 每題的累積時間 {qid: seconds}
let currentQuestionStartTime = null;
let timerInterval = null;
let isPaused = false;
let currentResult = null;
let currentDifficulty = 0;
let currentNote = '';
let predictedDifficulties = {};  // 儲存預測難度

// 未完成會話
let unfinishedSession = null;

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  console.log('刷題機 V2.0 啟動...');
  
  // 載入主題
  loadTheme();
  
  // 載入 localStorage 資料
  loadFromLocalStorage();
  
  // 檢查是否有未完成的會話
  checkUnfinishedSession();
  
  // 綁定事件
  bindEvents();
  
  // 如果有題庫，直接進入列表
  if (allQuestions.length > 0) {
    showPage('list');
    initListPage();
  }
  
  console.log('初始化完成');
});

// ==================== 事件綁定 ====================

function bindEvents() {
  // 載入模式切換
  document.querySelectorAll('input[name="load-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const localFileRow = document.getElementById('local-file-row');
      localFileRow.style.display = e.target.value === 'local' ? 'flex' : 'none';
    });
  });
  
  // 載入題庫
  document.getElementById('btn-load-csv').addEventListener('click', loadQuestionBank);
  
  // 篩選
  document.getElementById('btn-apply-filter').addEventListener('click', applyFilters);
  document.getElementById('btn-reset-filter').addEventListener('click', resetFilters);
  
  // 全選
  document.getElementById('chk-all').addEventListener('change', toggleSelectAll);
  
  // 隨機模式切換
  document.getElementById('random-mode').addEventListener('change', updateRandomOptions);
  
  // 隨機3題
  document.getElementById('btn-random-3').addEventListener('click', startRandom3);
  
  // 開始練習選中題目
  document.getElementById('btn-start-selected').addEventListener('click', startSelectedPractice);
  
  // 顯示/隱藏欄位
  document.getElementById('show-image').addEventListener('change', toggleImageColumn);
  document.getElementById('show-text').addEventListener('change', toggleTextColumn);
  
  // 雲端同步
  document.getElementById('btn-sync-cloud').addEventListener('click', syncToCloud);
  
  // 重新載入題庫
  document.getElementById('btn-reload-questions').addEventListener('click', reloadQuestions);
  
  // 匯出/匯入紀錄
  document.getElementById('btn-export-logs').addEventListener('click', exportLogs);
  document.getElementById('btn-import-logs').addEventListener('click', importLogs);
  
  // 預測頁面
  document.getElementById('btn-back-to-list').addEventListener('click', () => showPage('list'));
  document.getElementById('btn-start-practice').addEventListener('click', startPracticeFromPredict);
  
  // 練習頁面
  document.getElementById('btn-timer-toggle').addEventListener('click', toggleTimer);
  document.getElementById('btn-timer-reset').addEventListener('click', resetTimer);
  document.getElementById('btn-toggle-answer').addEventListener('click', toggleAnswer);
  document.getElementById('btn-correct').addEventListener('click', () => recordResult('Correct'));
  document.getElementById('btn-wrong').addEventListener('click', () => recordResult('Incorrect'));
  document.getElementById('btn-skip').addEventListener('click', () => recordResult('Skipped'));
  document.getElementById('btn-prev').addEventListener('click', prevQuestion);
  document.getElementById('btn-next').addEventListener('click', nextQuestion);
  document.getElementById('btn-save-note').addEventListener('click', saveCurrentNote);
  document.getElementById('btn-save-later').addEventListener('click', saveForLater);
  document.getElementById('btn-end-session').addEventListener('click', endSession);
  
  // Summary
  document.getElementById('btn-summary-back').addEventListener('click', () => {
    showPage('list');
    initListPage();
  });
  
  // 鍵盤快捷鍵
  document.addEventListener('keydown', handleKeyboard);

  // 手機模式初始化
  initMobileMode();
}

// ==================== 手機模式 ====================

function initMobileMode() {
  // 自動偵測手機裝置
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

  if (isMobile) {
    document.body.classList.add('mobile-mode');
    console.log('手機模式已啟用');
  }

  // 綁定手機操作列事件
  bindMobileEvents();

  // 監聽視窗大小變化
  window.addEventListener('resize', () => {
    const shouldBeMobile = window.innerWidth < 768;
    if (shouldBeMobile && !document.body.classList.contains('mobile-mode')) {
      document.body.classList.add('mobile-mode');
    } else if (!shouldBeMobile && document.body.classList.contains('mobile-mode') && !(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))) {
      document.body.classList.remove('mobile-mode');
    }
    updateMobileBarVisibility();
  });
}

function bindMobileEvents() {
  // 快速操作
  const mobilePrev = document.getElementById('mobile-prev');
  const mobileNext = document.getElementById('mobile-next');
  const mobileToggleAnswer = document.getElementById('mobile-toggle-answer');

  if (mobilePrev) mobilePrev.addEventListener('click', prevQuestion);
  if (mobileNext) mobileNext.addEventListener('click', nextQuestion);
  if (mobileToggleAnswer) mobileToggleAnswer.addEventListener('click', toggleAnswer);

  // 主要作答按鈕
  const mobileCorrect = document.getElementById('mobile-correct');
  const mobileWrong = document.getElementById('mobile-wrong');
  const mobileSkip = document.getElementById('mobile-skip');

  if (mobileCorrect) mobileCorrect.addEventListener('click', () => recordResult('Correct'));
  if (mobileWrong) mobileWrong.addEventListener('click', () => recordResult('Incorrect'));
  if (mobileSkip) mobileSkip.addEventListener('click', () => recordResult('Skipped'));

  // 難度評分星星
  const mobileStars = document.querySelectorAll('.mobile-star');
  mobileStars.forEach(star => {
    star.addEventListener('click', () => {
      const value = parseInt(star.getAttribute('data-value'));
      setDifficulty(value);
      // 更新手機星星狀態
      updateMobileStars(value);
    });
  });

  // 手勢操作 - 左右滑動切換題目
  let touchStartX = 0;
  let touchEndX = 0;

  const practiceLayout = document.querySelector('.practice-layout');
  if (practiceLayout) {
    practiceLayout.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    practiceLayout.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
  }

  function handleSwipe() {
    const swipeThreshold = 50; // 最小滑動距離
    if (currentPage !== 'practice') return;

    if (touchEndX < touchStartX - swipeThreshold) {
      // 向左滑 = 下一題
      nextQuestion();
    }

    if (touchEndX > touchStartX + swipeThreshold) {
      // 向右滑 = 上一題
      prevQuestion();
    }
  }
}

function updateMobileBarVisibility() {
  const mobileBar = document.getElementById('mobile-action-bar');
  if (!mobileBar) return;

  const isMobileMode = document.body.classList.contains('mobile-mode');
  const isPracticePage = currentPage === 'practice';

  if (isMobileMode && isPracticePage) {
    mobileBar.style.display = 'flex';
  } else {
    mobileBar.style.display = 'none';
  }
}

function updateMobileStars(difficulty) {
  const mobileStars = document.querySelectorAll('.mobile-star');
  mobileStars.forEach(star => {
    const value = parseInt(star.getAttribute('data-value'));
    if (value <= difficulty) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

// ==================== LocalStorage 管理 ====================

function saveToLocalStorage() {
  try {
    localStorage.setItem('questions', JSON.stringify(allQuestions));
    localStorage.setItem('practiceLog', JSON.stringify(practiceLog));
    localStorage.setItem('predictLog', JSON.stringify(predictLog));
    localStorage.setItem('hobbitLog', JSON.stringify(hobbitLog));
    localStorage.setItem('unfinishedSession', JSON.stringify(unfinishedSession));
    console.log('資料已儲存');
  } catch (e) {
    console.error('儲存失敗:', e);
    showMessage('錯誤', '資料儲存失敗，可能是儲存空間不足。');
  }
}

function loadFromLocalStorage() {
  try {
    const q = localStorage.getItem('questions');
    const p = localStorage.getItem('practiceLog');
    const pr = localStorage.getItem('predictLog');
    const h = localStorage.getItem('hobbitLog');
    const u = localStorage.getItem('unfinishedSession');
    
    if (q) allQuestions = JSON.parse(q);
    if (p) practiceLog = JSON.parse(p);
    if (pr) predictLog = JSON.parse(pr);
    if (h) hobbitLog = JSON.parse(h);
    if (u) unfinishedSession = JSON.parse(u);
    
    console.log(`載入 ${allQuestions.length} 題`);
  } catch (e) {
    console.error('載入失敗:', e);
  }
}

// ==================== 載入題庫 ====================

async function loadQuestionBank() {
  const mode = document.querySelector('input[name="load-mode"]:checked').value;
  const progressContainer = document.getElementById('load-progress');
  const progressFill = document.getElementById('load-progress-fill');
  const progressText = document.getElementById('load-progress-text');
  
  progressContainer.style.display = 'block';
  progressFill.style.width = '0%';
  
  try {
    let csvText;
    
    if (mode === 'online') {
      progressText.textContent = '正在下載題庫...';
      progressFill.style.width = '25%';
      
      // 加上時間戳記避免快取
      const timestamp = new Date().getTime();
      const response = await fetch(`./data.csv?t=${timestamp}`, {
        cache: 'no-store',  // 不使用快取
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('無法載入 data.csv');
      csvText = await response.text();
    } else {
      const fileInput = document.getElementById('file-input');
      if (!fileInput.files.length) {
        showMessage('錯誤', '請選擇 CSV 檔案');
        progressContainer.style.display = 'none';
        return;
      }
      
      progressText.textContent = '正在讀取檔案...';
      progressFill.style.width = '25%';
      
      csvText = await fileInput.files[0].text();
    }
    
    progressText.textContent = '正在解析題庫...';
    progressFill.style.width = '50%';
    
    allQuestions = parseCSV(csvText);
    
    progressText.textContent = '正在儲存資料...';
    progressFill.style.width = '75%';
    
    saveToLocalStorage();
    
    progressText.textContent = '載入完成！';
    progressFill.style.width = '100%';
    
    setTimeout(() => {
      showPage('list');
      initListPage();
      showMessage('成功', `成功載入 ${allQuestions.length} 題！`);
    }, 500);
    
  } catch (error) {
    console.error('載入失敗:', error);
    progressContainer.style.display = 'none';
    showMessage('錯誤', `載入失敗: ${error.message}`);
  }
}

async function reloadQuestions() {
  if (!confirm('確定要重新下載題庫嗎？\n\n這會清除快取並強制下載最新版本。\n（答題記錄不會被清除）')) {
    return;
  }
  
  try {
    // 加上時間戳記強制重新下載
    const timestamp = new Date().getTime();
    const response = await fetch(`./data.csv?t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) throw new Error('無法載入 data.csv');
    
    const csvText = await response.text();
    allQuestions = parseCSV(csvText);
    
    // 儲存到 localStorage
    saveToLocalStorage();
    
    // 重新初始化列表
    initListPage();
    
    showMessage('成功', `題庫已更新！\n共載入 ${allQuestions.length} 題`);
    
  } catch (error) {
    console.error('更新失敗:', error);
    showMessage('錯誤', `更新失敗: ${error.message}\n\n請檢查：\n1. data.csv 是否存在\n2. 網路連線是否正常\n3. GitHub Pages 是否已部署`);
  }
}

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const questions = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;
    
    const question = {};
    headers.forEach((header, index) => {
      question[header.trim()] = values[index] ? values[index].trim() : '';
    });
    
    if (question.ExamID || question.Q_ID) {
      questions.push(question);
    }
  }
  
  return questions;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}


// ==================== 列表頁面初始化 ====================

function initListPage() {
  // 初始化篩選器
  initFilters();
  
  // 載入 Hobbit Log
  renderHobbitLog();
  
  // 應用篩選
  applyFilters();
  
  // 更新統計
  updateStatistics();
}

function initFilters() {
  const years = [...new Set(allQuestions.map(q => q.Year).filter(Boolean))].sort();
  const schools = [...new Set(allQuestions.map(q => q.School).filter(Boolean))].sort();
  const chapters = [...new Set(allQuestions.map(q => q.Chapter).filter(Boolean))].sort();
  
  populateSelect('filter-year', years);
  populateSelect('filter-school', schools);
  populateSelect('filter-chapter', chapters);
  populateSelect('random-chapter', chapters);
}

function populateSelect(id, options) {
  const select = document.getElementById(id);
  const firstOption = select.querySelector('option');
  select.innerHTML = '';
  if (firstOption) select.appendChild(firstOption);
  
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    select.appendChild(option);
  });
}

// ==================== 篩選功能 ====================

function applyFilters() {
  const year = document.getElementById('filter-year').value;
  const school = document.getElementById('filter-school').value;
  const chapter = document.getElementById('filter-chapter').value;
  const status = document.getElementById('filter-status').value;
  const search = document.getElementById('filter-search').value.toLowerCase();
  
  filteredQuestions = allQuestions.filter(q => {
    if (year && q.Year !== year) return false;
    if (school && q.School !== school) return false;
    if (chapter && q.Chapter !== chapter) return false;
    
    if (status === 'practiced' && !isPracticed(getQID(q))) return false;
    if (status === 'unpracticed' && isPracticed(getQID(q))) return false;
    
    // 搜尋 Extracted Text
    if (search) {
      const extractedText = (q['Extracted Text'] || '').toLowerCase();
      if (!extractedText.includes(search)) return false;
    }
    
    return true;
  });
  
  renderQuestionList();
}

function resetFilters() {
  document.getElementById('filter-year').value = '';
  document.getElementById('filter-school').value = '';
  document.getElementById('filter-chapter').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-search').value = '';
  
  applyFilters();
}

function renderQuestionList() {
  const tbody = document.getElementById('questions-tbody');
  tbody.innerHTML = '';
  
  const showImage = document.getElementById('show-image').checked;
  const showText = document.getElementById('show-text').checked;
  
  filteredQuestions.forEach((q, index) => {
    const row = document.createElement('tr');
    const qid = getQID(q);
    
    const practiceCount = getPracticeCount(qid);
    const lastDate = getLastDate(qid);
    const skipCount = getSkipCount(qid);
    
    // 從使用者資料讀取難度（最近一次的實際難度）
    const userDifficulty = getUserDifficulty(qid);
    
    let html = `
      <td class="col-check"><input type="checkbox" class="question-checkbox" data-qid="${qid}"></td>
      <td class="col-num">${index + 1}</td>
      <td class="col-year">${q.Year || '-'}</td>
      <td class="col-school" title="${q.School || '-'}">${(q.School || '-').substring(0, 4)}</td>
      <td class="col-chapter" title="${q.Chapter || '-'}">${q.Chapter || '-'}</td>
      <td class="col-diff">${userDifficulty > 0 ? renderStars(userDifficulty) : '-'}</td>
    `;
    
    if (showImage) {
      const imageSrc = q['Problem Image'] || q['題目圖片'] || '';
      html += `<td class="col-image">
        ${imageSrc ? `<img src="${imageSrc}" class="thumbnail" onclick="enlargeImage('${imageSrc}')" alt="題目">` : '-'}
      </td>`;
    }
    
    if (showText) {
      const text = q['Extracted Text'] || '-';
      html += `<td class="col-text"><div class="question-text" title="${text}">${text}</div></td>`;
    }
    
    html += `
      <td class="col-count">${practiceCount}</td>
      <td class="col-date">${lastDate}</td>
      <td class="col-skip">${skipCount}</td>
    `;
    
    row.innerHTML = html;
    tbody.appendChild(row);
  });
  
  updateColumnVisibility();
  updateStatistics();
}

function updateColumnVisibility() {
  const showImage = document.getElementById('show-image').checked;
  const showText = document.getElementById('show-text').checked;
  
  const table = document.getElementById('questions-table');
  const imageHeaders = table.querySelectorAll('th.col-image');
  const textHeaders = table.querySelectorAll('th.col-text');
  
  imageHeaders.forEach(th => th.classList.toggle('hidden', !showImage));
  textHeaders.forEach(th => th.classList.toggle('hidden', !showText));
}

function toggleImageColumn() {
  renderQuestionList();
}

function toggleTextColumn() {
  renderQuestionList();
}

function toggleSelectAll() {
  const checked = document.getElementById('chk-all').checked;
  document.querySelectorAll('.question-checkbox').forEach(cb => {
    cb.checked = checked;
  });
  updateStatistics();
}

function updateStatistics() {
  document.getElementById('total-count').textContent = allQuestions.length;
  document.getElementById('filtered-count').textContent = filteredQuestions.length;
  
  const selectedCount = document.querySelectorAll('.question-checkbox:checked').length;
  document.getElementById('selected-count').textContent = selectedCount;
}

// ==================== 隨機模式 ====================

function updateRandomOptions() {
  const mode = document.getElementById('random-mode').value;
  
  document.getElementById('random-chapter-group').style.display = 
    mode === 'chapter' ? 'flex' : 'none';
  document.getElementById('random-difficulty-group').style.display = 
    mode === 'difficulty' ? 'flex' : 'none';
}

function startRandom3() {
  const mode = document.getElementById('random-mode').value;
  let candidates = [];
  
  if (mode === 'all') {
    // 總題庫隨機
    candidates = [...allQuestions];
  } else if (mode === 'chapter') {
    // 指定章節隨機
    const chapter = document.getElementById('random-chapter').value;
    if (!chapter) {
      showMessage('提示', '請選擇章節！');
      return;
    }
    candidates = allQuestions.filter(q => q.Chapter === chapter);
  } else if (mode === 'difficulty') {
    // 指定難度隨機
    const diff = document.getElementById('random-difficulty').value;
    candidates = allQuestions.filter(q => q.Difficulty === diff);
  } else if (mode === 'unpracticed') {
    // 未練習隨機
    candidates = allQuestions.filter(q => !isPracticed(getQID(q)));
  }
  
  if (candidates.length === 0) {
    showMessage('提示', '沒有符合條件的題目！');
    return;
  }
  
  // 隨機選3題
  const selected = [];
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(3, shuffled.length); i++) {
    selected.push(shuffled[i]);
  }
  
  startPracticeWithQuestions(selected);
}

function startSelectedPractice() {
  const checkboxes = document.querySelectorAll('.question-checkbox:checked');
  if (checkboxes.length === 0) {
    showMessage('提示', '請先勾選要練習的題目！');
    return;
  }
  
  const selected = [];
  checkboxes.forEach(cb => {
    const qid = cb.dataset.qid;
    const q = allQuestions.find(q => getQID(q) === qid);
    if (q) selected.push(q);
  });
  
  startPracticeWithQuestions(selected);
}

function startPracticeWithQuestions(questions) {
  practiceQuestions = questions;
  
  // 重置預測難度
  predictedDifficulties = {};
  
  // 進入預測頁面
  showPage('predict');
  renderPredictPage();
}


// ==================== 預測頁面 ====================

let predictCurrentIndex = 0;

function renderPredictPage() {
  predictCurrentIndex = 0;
  displayPredictQuestion(0);
}

function displayPredictQuestion(index) {
  if (index < 0 || index >= practiceQuestions.length) return;
  
  predictCurrentIndex = index;
  const q = practiceQuestions[index];
  const qid = getQID(q);
  
  // 更新進度
  document.getElementById('predict-current').textContent = index + 1;
  document.getElementById('predict-total').textContent = practiceQuestions.length;
  
  // 更新資訊
  document.getElementById('predict-qid').textContent = qid;
  document.getElementById('predict-meta').textContent = 
    `${q.Year || '-'} ${q.School || '-'} [${q.Chapter || '-'}]`;
  
  // 顯示圖片
  const imageSrc = q['Problem Image'] || q['題目圖片'] || '';
  document.getElementById('predict-image').src = imageSrc;
  
  // 顯示已評分的星星
  const predicted = predictedDifficulties[qid] || 0;
  updatePredictStars(predicted);
}

function predictSetDiff(value) {
  const q = practiceQuestions[predictCurrentIndex];
  const qid = getQID(q);
  
  predictedDifficulties[qid] = value;
  updatePredictStars(value);
  
  // 自動跳下一題
  setTimeout(() => {
    if (predictCurrentIndex < practiceQuestions.length - 1) {
      displayPredictQuestion(predictCurrentIndex + 1);
    }
  }, 300);
}

function updatePredictStars(value) {
  const stars = document.querySelectorAll('#predict-stars .star');
  stars.forEach((star, index) => {
    if (index < value) {
      star.textContent = '★';
      star.classList.add('active');
    } else {
      star.textContent = '☆';
      star.classList.remove('active');
    }
  });
}

function predictPrevQuestion() {
  if (predictCurrentIndex > 0) {
    displayPredictQuestion(predictCurrentIndex - 1);
  }
}

function predictNextQuestion() {
  if (predictCurrentIndex < practiceQuestions.length - 1) {
    displayPredictQuestion(predictCurrentIndex + 1);
  }
}

function startPracticeFromPredict() {
  // 檢查是否所有題目都預測了
  const unpredicted = practiceQuestions.filter(q => !predictedDifficulties[getQID(q)]);
  
  if (unpredicted.length > 0) {
    showMessage('提示', `還有 ${unpredicted.length} 題尚未預測難度！\n\n可以直接開始練習，未預測的題目不會記錄預測難度。`, () => {
      startPracticePage();
    });
  } else {
    startPracticePage();
  }
}

// ==================== 練習頁面 ====================

function startPracticePage() {
  currentIndex = 0;
  sessionStartTime = Date.now();
  sessionTotalSeconds = 0;
  questionTimes = {};
  
  // 初始化每題的時間為0
  practiceQuestions.forEach(q => {
    questionTimes[getQID(q)] = 0;
  });
  
  // 儲存未完成會話
  unfinishedSession = {
    questions: practiceQuestions.map(q => getQID(q)),
    currentIndex: 0,
    startTime: sessionStartTime,
    predictions: {...predictedDifficulties},
    questionTimes: {...questionTimes},
    totalSeconds: 0
  };
  saveToLocalStorage();
  
  showPage('practice');
  displayQuestion(0);
  startTimer();
}

function displayQuestion(index) {
  if (index < 0 || index >= practiceQuestions.length) return;
  
  currentIndex = index;
  const q = practiceQuestions[index];
  const qid = getQID(q);
  
  // 更新標題資訊
  document.getElementById('current-num').textContent = index + 1;
  document.getElementById('total-num').textContent = practiceQuestions.length;
  document.getElementById('current-qid').textContent = qid;
  document.getElementById('current-meta').textContent = `${q.Year || '-'} ${q.School || '-'} [${q.Chapter || '-'}]`;
  
  // 顯示題目圖片
  const problemImg = document.getElementById('practice-problem-img');
  problemImg.src = q['Problem Image'] || q['題目圖片'] || '';
  
  // 載入解答和詳解（但先隱藏）
  document.getElementById('practice-answer-img').src = q['Answer Image'] || q['解答圖片'] || '';
  document.getElementById('practice-solution-img').src = q['Solution Image'] || q['詳解圖片'] || '';
  document.getElementById('answer-container').style.display = 'none';
  document.getElementById('answer-placeholder').style.display = 'block';
  document.getElementById('btn-toggle-answer').textContent = '顯示解答/詳解 (A)';
  
  // 顯示預測難度
  const predicted = predictedDifficulties[qid] || 0;
  document.getElementById('predicted-diff').textContent = predicted > 0 ? predicted : '未預測';
  
  // 載入筆記
  const previousNote = getPreviousNote(qid);
  document.getElementById('practice-notes').value = previousNote;
  currentNote = previousNote;
  
  // 重設難度和結果
  currentDifficulty = 0;
  currentResult = null;
  updateDifficultyStars(0);
  
  // 按鈕狀態
  document.getElementById('btn-prev').disabled = index === 0;
  document.getElementById('btn-next').disabled = false;
  
  // 開始這題的計時
  currentQuestionStartTime = Date.now();
  
  // 更新單題計時器顯示
  updateSingleTimerDisplay();

  // 更新手機操作列
  updateMobileBarVisibility();
  updateMobileStars(0);

  // 更新手機解答按鈕文字
  const mobileToggleBtn = document.getElementById('mobile-toggle-answer');
  if (mobileToggleBtn) {
    mobileToggleBtn.textContent = '顯示解答';
  }
}

function toggleAnswer() {
  const container = document.getElementById('answer-container');
  const placeholder = document.getElementById('answer-placeholder');
  const btn = document.getElementById('btn-toggle-answer');
  const mobileBtn = document.getElementById('mobile-toggle-answer');

  if (container.style.display === 'none') {
    container.style.display = 'block';
    placeholder.style.display = 'none';
    btn.textContent = '隱藏解答/詳解 (A)';
    if (mobileBtn) mobileBtn.textContent = '隱藏解答';
  } else {
    container.style.display = 'none';
    placeholder.style.display = 'block';
    btn.textContent = '顯示解答/詳解 (A)';
    if (mobileBtn) mobileBtn.textContent = '顯示解答';
  }
}

function recordResult(result) {
  currentResult = result;
  
  // 記錄這題花費的時間
  const q = practiceQuestions[currentIndex];
  const qid = getQID(q);
  const thisQuestionTime = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
  questionTimes[qid] += thisQuestionTime;
  
  const today = new Date().toISOString().split('T')[0];
  
  const log = {
    Q_ID: qid,
    Date: today,
    TimeSeconds: questionTimes[qid],  // 使用累積時間
    PredictedDifficulty: predictedDifficulties[qid] || 0,
    ActualDifficulty: currentDifficulty,
    Note: currentNote,
    Result: result
  };
  
  practiceLog.push(log);
  
  // 更新 Hobbit Log（使用這次花費的時間）
  updateHobbitLog(today, thisQuestionTime);
  
  // 儲存
  saveToLocalStorage();
  
  // 更新狀態
  document.getElementById('status-left').textContent = 
    `已記錄：${result === 'Correct' ? '✓ 正確' : result === 'Incorrect' ? '✗ 錯誤' : '⊘ 跳過'}`;
  
  // 自動跳下一題
  if (currentIndex < practiceQuestions.length - 1) {
    setTimeout(() => nextQuestion(), 500);
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    // 累積當前題目的時間
    const qid = getQID(practiceQuestions[currentIndex]);
    const elapsed = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
    questionTimes[qid] += elapsed;
    
    displayQuestion(currentIndex - 1);
  }
}

function nextQuestion() {
  if (currentIndex < practiceQuestions.length - 1) {
    // 累積當前題目的時間
    const qid = getQID(practiceQuestions[currentIndex]);
    const elapsed = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
    questionTimes[qid] += elapsed;
    
    displayQuestion(currentIndex + 1);
  } else {
    showMessage('提示', '已經是最後一題了！');
  }
}

function setDifficulty(value) {
  currentDifficulty = value;
  updateDifficultyStars(value);
  updateMobileStars(value);
}

function updateDifficultyStars(value) {
  const stars = document.querySelectorAll('#difficulty-stars .star');
  stars.forEach((star, index) => {
    if (index < value) {
      star.textContent = '★';
      star.classList.add('active');
    } else {
      star.textContent = '☆';
      star.classList.remove('active');
    }
  });
}

function saveCurrentNote() {
  currentNote = document.getElementById('practice-notes').value;
  
  // 更新 practiceLog 中這題的筆記
  const q = practiceQuestions[currentIndex];
  const qid = getQID(q);
  
  const logs = practiceLog.filter(log => log.Q_ID === qid);
  if (logs.length > 0) {
    logs[logs.length - 1].Note = currentNote;
    saveToLocalStorage();
    showMessage('提示', '筆記已儲存！');
  } else {
    showMessage('提示', '請先作答（正確/錯誤/跳過）後，筆記才會儲存。');
  }
}

function saveForLater() {
  // 累積當前題目的時間
  const qid = getQID(practiceQuestions[currentIndex]);
  const elapsed = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
  questionTimes[qid] += elapsed;
  
  // 更新未完成會話
  unfinishedSession = {
    questions: practiceQuestions.map(q => getQID(q)),
    currentIndex: currentIndex,
    startTime: sessionStartTime,
    predictions: {...predictedDifficulties},
    questionTimes: {...questionTimes},
    totalSeconds: sessionTotalSeconds + Math.floor((Date.now() - sessionStartTime) / 1000)
  };
  saveToLocalStorage();
  
  stopTimer();
  showMessage('提示', '進度已儲存！下次開啟會詢問是否繼續。', () => {
    showPage('list');
    initListPage();
  });
}

function endSession() {
  stopTimer();
  
  // 累積當前題目的時間
  const qid = getQID(practiceQuestions[currentIndex]);
  const elapsed = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
  questionTimes[qid] += elapsed;
  
  // 清除未完成會話
  unfinishedSession = null;
  saveToLocalStorage();
  
  // 顯示 Summary
  showPage('summary');
  renderSummary();
}


// ==================== Summary 頁面 ====================

function renderSummary() {
  const container = document.getElementById('summary-content');
  
  const qids = practiceQuestions.map(q => getQID(q));
  const sessionLogs = practiceLog.filter(log => qids.includes(log.Q_ID));
  
  const correct = sessionLogs.filter(l => l.Result === 'Correct').length;
  const incorrect = sessionLogs.filter(l => l.Result === 'Incorrect').length;
  const skipped = sessionLogs.filter(l => l.Result === 'Skipped').length;
  const total = sessionLogs.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  
  let html = `
    <h3>本輪統計</h3>
    <p>總題數：${practiceQuestions.length}</p>
    <p>已作答：${total}</p>
    <p>答對：${correct} | 答錯：${incorrect} | 跳過：${skipped}</p>
    <p>正確率：${accuracy}%</p>
    
    <h3 class="mt-8">詳細記錄</h3>
    <table>
      <thead>
        <tr>
          <th>Q_ID</th>
          <th>結果</th>
          <th>時間(秒)</th>
          <th>預測難度</th>
          <th>實際難度</th>
          <th>筆記</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  sessionLogs.forEach(log => {
    const resultText = log.Result === 'Correct' ? '✓ 正確' : 
                       log.Result === 'Incorrect' ? '✗ 錯誤' : '⊘ 跳過';
    html += `
      <tr>
        <td>${log.Q_ID}</td>
        <td>${resultText}</td>
        <td>${log.TimeSeconds}</td>
        <td>${log.PredictedDifficulty > 0 ? renderStars(log.PredictedDifficulty) : '-'}</td>
        <td>${log.ActualDifficulty > 0 ? renderStars(log.ActualDifficulty) : '-'}</td>
        <td class="small">${log.Note || '-'}</td>
      </tr>
    `;
  });
  
  html += `</tbody></table>`;
  container.innerHTML = html;
}

// ==================== Hobbit Log ====================

function updateHobbitLog(date, seconds) {
  let log = hobbitLog.find(l => l.Date === date);
  
  if (!log) {
    log = {
      Date: date,
      TotalSeconds: 0,
      QuestionCount: 0
    };
    hobbitLog.push(log);
  }
  
  log.TotalSeconds += seconds;
  log.QuestionCount += 1;
  
  saveToLocalStorage();
}

function renderHobbitLog() {
  const container = document.getElementById('heatmap');
  container.innerHTML = '';
  container.className = 'heatmap-inline';
  
  // 生成最近90天的熱圖
  const today = new Date();
  const days = [];
  
  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push(date);
  }
  
  days.forEach(date => {
    const dateStr = date.toISOString().split('T')[0];
    const log = hobbitLog.find(l => l.Date === dateStr);
    const minutes = log ? Math.floor(log.TotalSeconds / 60) : 0;
    const level = getHeatLevel(minutes);
    
    const cell = document.createElement('div');
    cell.className = `heat-cell heat-${level}`;
    cell.title = `${dateStr}: ${minutes} 分鐘, ${log ? log.QuestionCount : 0} 題`;
    cell.onclick = () => showDayDetail(dateStr);
    
    container.appendChild(cell);
  });
  
  // 更新本月統計
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();
  const monthLogs = hobbitLog.filter(l => {
    const d = new Date(l.Date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  
  const monthDays = monthLogs.length;
  const monthMinutes = monthLogs.reduce((sum, l) => sum + Math.floor(l.TotalSeconds / 60), 0);
  const monthQuestions = monthLogs.reduce((sum, l) => sum + l.QuestionCount, 0);
  
  const monthStats = document.getElementById('month-stats-text');
  if (monthStats) {
    monthStats.textContent = `本月：${monthDays}天 / ${monthQuestions}題 / ${monthMinutes}分鐘`;
  }
}

function getHeatLevel(minutes) {
  if (minutes === 0) return 0;
  if (minutes <= 10) return 1;
  if (minutes <= 30) return 2;
  if (minutes <= 60) return 3;
  return 4;
}

function showDayDetail(date) {
  const log = hobbitLog.find(l => l.Date === date);
  if (!log) {
    showMessage('詳情', `${date}\n尚無練習紀錄`);
    return;
  }
  
  const minutes = Math.floor(log.TotalSeconds / 60);
  
  // 找出當天的所有答題記錄
  const dayLogs = practiceLog.filter(l => l.Date === date);
  
  let details = `${date}\n\n`;
  details += `練習時間：${minutes} 分鐘\n`;
  details += `完成題數：${log.QuestionCount} 題\n\n`;
  
  if (dayLogs.length > 0) {
    details += `答題記錄：\n`;
    details += `────────────────────\n`;
    
    dayLogs.forEach(l => {
      const resultEmoji = l.Result === 'Correct' ? '✓' : l.Result === 'Incorrect' ? '✗' : '⊘';
      const time = Math.floor(l.TimeSeconds / 60);
      details += `${resultEmoji} ${l.Q_ID} (${time}分)\n`;
    });
  }
  
  showMessage('練習詳情', details);
}

// ==================== 計時器 ====================

function toggleTimer() {
  const btn = document.getElementById('btn-timer-toggle');
  
  if (timerInterval) {
    stopTimer();
    btn.textContent = '開始';
  } else {
    startTimer();
    btn.textContent = '暫停';
  }
}

function startTimer() {
  if (timerInterval) return;
  
  const sessionStart = Date.now();
  const questionStart = Date.now();
  
  timerInterval = setInterval(() => {
    // 更新總時間
    const totalElapsed = sessionTotalSeconds + Math.floor((Date.now() - sessionStart) / 1000);
    updateTotalTimerDisplay(totalElapsed);
    
    // 更新單題時間
    const qid = getQID(practiceQuestions[currentIndex]);
    const baseTime = questionTimes[qid] || 0;
    const currentElapsed = Math.floor((Date.now() - questionStart) / 1000);
    updateSingleTimerDisplay(baseTime + currentElapsed);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    
    // 儲存當前的總時間
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    sessionTotalSeconds = elapsed;
  }
}

function resetTimer() {
  stopTimer();
  sessionTotalSeconds = 0;
  updateTotalTimerDisplay(0);
  updateSingleTimerDisplay();
  document.getElementById('btn-timer-toggle').textContent = '開始';
}

function updateTotalTimerDisplay(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  document.getElementById('timer-total').textContent = 
    `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateSingleTimerDisplay(seconds = null) {
  if (seconds === null) {
    const qid = getQID(practiceQuestions[currentIndex]);
    seconds = questionTimes[qid] || 0;
  }
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  document.getElementById('timer-single').textContent = 
    `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ==================== 未完成會話 ====================

function checkUnfinishedSession() {
  if (!unfinishedSession) return;
  
  // 詢問是否繼續
  const modal = document.getElementById('continue-modal');
  document.getElementById('continue-count').textContent = unfinishedSession.questions.length;
  document.getElementById('continue-done').textContent = unfinishedSession.currentIndex;
  
  modal.style.display = 'flex';
  
  document.getElementById('btn-continue-yes').onclick = () => {
    modal.style.display = 'none';
    continuePractice();
  };
  
  document.getElementById('btn-continue-no').onclick = () => {
    modal.style.display = 'none';
    unfinishedSession = null;
    saveToLocalStorage();
  };
}

function continuePractice() {
  // 恢復練習狀態
  practiceQuestions = unfinishedSession.questions.map(qid => 
    allQuestions.find(q => getQID(q) === qid)
  ).filter(Boolean);
  
  predictedDifficulties = {...unfinishedSession.predictions};
  questionTimes = {...unfinishedSession.questionTimes} || {};
  sessionStartTime = unfinishedSession.startTime;
  sessionTotalSeconds = unfinishedSession.totalSeconds || 0;
  
  showPage('practice');
  displayQuestion(unfinishedSession.currentIndex);
  startTimer();
}

// ==================== 工具函數 ====================

function showPage(pageName) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  const page = document.getElementById(`page-${pageName}`);
  if (page) {
    page.classList.add('active');
  }
}

function getQID(question) {
  return question.Q_ID || question.ExamID || question['題目ID'] || '';
}

function isPracticed(qid) {
  return practiceLog.some(log => log.Q_ID === qid);
}

function getPracticeCount(qid) {
  return practiceLog.filter(log => log.Q_ID === qid).length;
}

function getLastDate(qid) {
  const logs = practiceLog.filter(log => log.Q_ID === qid);
  if (logs.length === 0) return '-';
  
  const latest = logs.sort((a, b) => new Date(b.Date) - new Date(a.Date))[0];
  const date = new Date(latest.Date);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getSkipCount(qid) {
  return practiceLog.filter(log => log.Q_ID === qid && log.Result === 'Skipped').length;
}

function getUserDifficulty(qid) {
  // 從使用者資料讀取難度（最近一次的實際難度）
  const logs = practiceLog.filter(log => log.Q_ID === qid && log.ActualDifficulty > 0);
  if (logs.length === 0) return 0;
  
  // 取最近一次的難度
  const latest = logs.sort((a, b) => new Date(b.Date) - new Date(a.Date))[0];
  return latest.ActualDifficulty;
}

function getPreviousNote(qid) {
  const logs = practiceLog.filter(log => log.Q_ID === qid && log.Note);
  if (logs.length === 0) return '';
  return logs[logs.length - 1].Note;
}

function renderStars(difficulty) {
  const rating = parseInt(difficulty) || 0;
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= rating ? '★' : '☆';
  }
  return stars;
}

// ==================== Modal 對話框 ====================

function showMessage(title, message, callback = null) {
  const modal = document.getElementById('message-modal');
  document.getElementById('message-title').textContent = title;
  document.getElementById('message-text').textContent = message;
  
  modal.style.display = 'flex';
  
  const okBtn = document.getElementById('message-ok');
  okBtn.onclick = () => {
    closeMessageModal();
    if (callback) callback();
  };
}

function closeMessageModal() {
  document.getElementById('message-modal').style.display = 'none';
}

function enlargeImage(src) {
  const modal = document.getElementById('image-modal');
  document.getElementById('modal-image').src = src;
  modal.style.display = 'flex';
}

function closeImageModal() {
  document.getElementById('image-modal').style.display = 'none';
}

// ==================== 匯出資料 ====================

function exportLogs() {
  // 顯示匯出選項
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">📤 匯出紀錄</div>
      <div class="modal-body">
        <p>選擇匯出格式：</p>
        <button class="win98-button" style="width:100%; margin:8px 0;" onclick="this.closest('.modal').dataset.format='json'">
          📄 JSON 格式<br>
          <small>可以匯入到其他裝置（推薦）</small>
        </button>
        <button class="win98-button" style="width:100%; margin:8px 0;" onclick="this.closest('.modal').dataset.format='csv'">
          📊 CSV 格式<br>
          <small>可以用 Excel 開啟</small>
        </button>
      </div>
      <div class="modal-footer">
        <button class="win98-button" onclick="this.closest('.modal').remove()">取消</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelectorAll('.win98-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = modal.dataset.format;
      if (format === 'json') {
        exportJSON();
      } else if (format === 'csv') {
        exportCSV();
      }
      modal.remove();
    });
  });
}

function exportJSON() {
  const data = {
    practiceLog: practiceLog,
    predictLog: predictLog,
    hobbitLog: hobbitLog,
    exportDate: new Date().toISOString(),
    version: '2.0'
  };
  
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `shuatiji-logs-${formatDateForFilename(new Date())}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showMessage('匯出成功', '已匯出 JSON 檔案\n\n可以傳到其他裝置並匯入');
}

function exportCSV() {
  if (practiceLog.length === 0) {
    showMessage('提示', '尚無練習記錄');
    return;
  }
  
  // CSV 標題
  let csv = 'Date,Q_ID,Result,TimeSeconds,ActualDifficulty,Notes\n';
  
  // 資料行
  practiceLog.forEach(log => {
    csv += `${log.Date},${log.Q_ID},${log.Result},${log.TimeSeconds},${log.ActualDifficulty},"${(log.Notes || '').replace(/"/g, '""')}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `shuatiji-logs-${formatDateForFilename(new Date())}.csv`;
  a.click();
  
  URL.revokeObjectURL(url);
  showMessage('匯出成功', '已匯出 CSV 檔案\n\n可以用 Excel 開啟分析');
}

function importLogs() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // 驗證資料格式
      if (!data.practiceLog || !Array.isArray(data.practiceLog)) {
        throw new Error('檔案格式不正確');
      }
      
      // 詢問是否覆蓋
      const count = data.practiceLog.length;
      if (practiceLog.length > 0) {
        if (!confirm(`本地有 ${practiceLog.length} 筆記錄\n檔案有 ${count} 筆記錄\n\n確定要匯入並合併嗎？`)) {
          return;
        }
      }
      
      // 合併資料（避免重複）
      const existingKeys = new Set(practiceLog.map(log => `${log.Date}-${log.Q_ID}-${log.TimeSeconds}`));
      let addedCount = 0;
      
      data.practiceLog.forEach(log => {
        const key = `${log.Date}-${log.Q_ID}-${log.TimeSeconds}`;
        if (!existingKeys.has(key)) {
          practiceLog.push(log);
          addedCount++;
        }
      });
      
      // 儲存
      saveToLocalStorage();
      
      // 重新渲染
      if (currentPage === 'list') {
        renderQuestionList();
        renderHobbitLog();
      }
      
      showMessage('匯入成功', `已匯入 ${addedCount} 筆新記錄\n（跳過 ${count - addedCount} 筆重複記錄）`);
      
    } catch (error) {
      console.error('匯入失敗:', error);
      showMessage('匯入失敗', error.message);
    }
  };
  
  input.click();
}

function formatDateForFilename(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

// ==================== 鍵盤快捷鍵 ====================

function handleKeyboard(e) {
  // Esc 關閉圖片預覽
  if (e.key === 'Escape') {
    const imageModal = document.getElementById('image-modal');
    if (imageModal && imageModal.style.display === 'flex') {
      closeImageModal();
      return;
    }
  }
  
  // 空白鍵確認訊息框
  if (e.key === ' ' || e.key === 'Spacebar') {
    const messageModal = document.getElementById('message-modal');
    if (messageModal && messageModal.style.display === 'flex') {
      e.preventDefault();
      closeMessageModal();
      return;
    }
  }
  
  const page = document.querySelector('.page.active');
  if (!page) return;
  
  // 在輸入框中不觸發（除了Ctrl+S）
  if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') 
      && !(e.ctrlKey && e.key.toLowerCase() === 's')) {
    return;
  }
  
  // 預測頁面
  if (page.id === 'page-predict') {
    switch(e.key.toLowerCase()) {
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
        e.preventDefault();
        predictSetDiff(parseInt(e.key));
        break;
      case 'arrowleft':
        e.preventDefault();
        predictPrevQuestion();
        break;
      case 'arrowright':
        e.preventDefault();
        predictNextQuestion();
        break;
      case 'enter':
        e.preventDefault();
        document.getElementById('btn-start-practice').click();
        break;
    }
  }
  
  // 練習頁面
  if (page.id === 'page-practice') {
    // Ctrl+S 存檔
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveCurrentNote();
      return;
    }
    
    switch(e.key.toLowerCase()) {
      case 'a':
        e.preventDefault();
        toggleAnswer();
        break;
      case 'c':
        e.preventDefault();
        recordResult('Correct');
        break;
      case 'x':
        e.preventDefault();
        recordResult('Incorrect');
        break;
      case 's':
        e.preventDefault();
        recordResult('Skipped');
        break;
      case 'arrowleft':
        e.preventDefault();
        prevQuestion();
        break;
      case 'arrowright':
        e.preventDefault();
        nextQuestion();
        break;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
        e.preventDefault();
        setDifficulty(parseInt(e.key));
        break;
      case 'enter':
        e.preventDefault();
        document.getElementById('btn-end-session').click();
        break;
    }
  }
}

// ==================== 主題切換 ====================

function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'win98';
  switchTheme(savedTheme);
  
  // 載入簡潔模式設定
  const compactMode = localStorage.getItem('compactMode') === 'true';
  if (compactMode) {
    document.body.classList.add('compact-mode');
    document.getElementById('theme-compact')?.classList.add('active');
  }
}

function switchTheme(theme) {
  const themeLink = document.getElementById('theme-style');
  themeLink.href = `style-${theme}.css`;
  
  // 更新按鈕狀態
  document.querySelectorAll('.theme-btn').forEach(btn => {
    if (btn.id === 'theme-compact') return; // 不影響簡潔模式按鈕
    btn.classList.remove('active');
  });
  document.getElementById(`theme-${theme}`).classList.add('active');
  
  // 儲存選擇
  localStorage.setItem('theme', theme);
}

function toggleCompactMode() {
  const isCompact = document.body.classList.toggle('compact-mode');
  const btn = document.getElementById('theme-compact');
  
  if (isCompact) {
    btn.classList.add('active');
    showMessage('簡潔模式', '已開啟手機簡潔模式\n\n隱藏：\n- 選單列\n- 篩選工具\n- 熱力圖\n- 次要欄位');
  } else {
    btn.classList.remove('active');
    showMessage('完整模式', '已關閉簡潔模式\n恢復完整功能');
  }
  
  // 儲存設定
  localStorage.setItem('compactMode', isCompact);
  
  // 重新渲染表格
  if (currentPage === 'list') {
    renderQuestionList();
  }
}

// ==================== 雲端同步 ====================

let gistId = null;
let githubToken = null;

async function syncToCloud() {
  // 檢查是否已設定 GitHub Token
  githubToken = localStorage.getItem('githubToken');
  
  if (!githubToken) {
    // 第一次使用，需要設定
    await showSyncSetup();
    return;
  }
  
  try {
    // 顯示同步選項
    const action = await showSyncOptions();
    
    if (action === 'upload') {
      await uploadToGist();
    } else if (action === 'download') {
      await downloadFromGist();
    } else if (action === 'settings') {
      await showSyncSetup();
    }
    
  } catch (error) {
    console.error('同步失敗:', error);
    showMessage('同步失敗', error.message);
  }
}

function showSyncOptions() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">☁️ 雲端同步</div>
        <div class="modal-body">
          <p>選擇同步方向：</p>
          <button class="win98-button" style="width:100%; margin:8px 0;" onclick="this.closest('.modal').dataset.action='upload'">
            ⬆️ 上傳到雲端<br>
            <small>將本地資料上傳到 GitHub Gist</small>
          </button>
          <button class="win98-button" style="width:100%; margin:8px 0;" onclick="this.closest('.modal').dataset.action='download'">
            ⬇️ 從雲端下載<br>
            <small>從 GitHub Gist 下載到本地</small>
          </button>
          <hr style="margin: 12px 0;">
          <button class="win98-button small" style="width:100%; margin:4px 0;" onclick="this.closest('.modal').dataset.action='settings'">
            ⚙️ 同步設定
          </button>
        </div>
        <div class="modal-footer">
          <button class="win98-button" onclick="this.closest('.modal').remove()">取消</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.textContent === '取消') {
        const action = modal.dataset.action || 'cancel';
        modal.remove();
        resolve(action);
      }
    });
    
    modal.querySelectorAll('.win98-button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = modal.dataset.action;
        if (action) {
          modal.remove();
          resolve(action);
        }
      });
    });
  });
}

async function showSyncSetup() {
  const currentToken = localStorage.getItem('githubToken') || '';
  const currentGistId = localStorage.getItem('gistId') || '';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">⚙️ GitHub Gist 同步設定</div>
      <div class="modal-body">
        <p><strong>如何設定：</strong></p>
        <ol style="font-size: 13px; line-height: 1.6;">
          <li>到 GitHub → Settings → Developer settings → Personal access tokens</li>
          <li>Generate new token (classic)</li>
          <li>勾選 <code>gist</code> 權限</li>
          <li>複製 token 貼到下方</li>
        </ol>
        
        <div style="margin: 16px 0;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold;">GitHub Token:</label>
          <input type="password" id="github-token-input" class="win98-input" 
                 value="${currentToken}" placeholder="ghp_xxxxxxxxxxxxx" 
                 style="width: 100%; font-family: monospace;">
        </div>
        
        <div style="margin: 16px 0;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold;">Gist ID (選填):</label>
          <input type="text" id="gist-id-input" class="win98-input" 
                 value="${currentGistId}" placeholder="留空則自動建立新 Gist" 
                 style="width: 100%; font-family: monospace;">
          <small style="color: #666;">如果已有 Gist，填入 ID 可以繼續使用</small>
        </div>
        
        <div style="background: #fffacd; padding: 8px; border-radius: 4px; margin: 12px 0; font-size: 12px;">
          ⚠️ <strong>注意：</strong>Token 會儲存在瀏覽器本地，請妥善保管。<br>
          建議只在自己的裝置上使用此功能。
        </div>
      </div>
      <div class="modal-footer">
        <button class="win98-button" onclick="document.getElementById('github-token-input').value = ''; document.getElementById('gist-id-input').value = '';">清除</button>
        <button class="win98-button" id="save-sync-settings">儲存</button>
        <button class="win98-button" onclick="this.closest('.modal').remove()">取消</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('save-sync-settings').onclick = () => {
    const token = document.getElementById('github-token-input').value.trim();
    const gist = document.getElementById('gist-id-input').value.trim();
    
    if (!token) {
      alert('請輸入 GitHub Token');
      return;
    }
    
    localStorage.setItem('githubToken', token);
    localStorage.setItem('gistId', gist);
    
    modal.remove();
    showMessage('設定完成', '已儲存 GitHub 同步設定\n\n現在可以使用雲端同步功能了！');
  };
}

async function uploadToGist() {
  const token = localStorage.getItem('githubToken');
  let gistId = localStorage.getItem('gistId');
  
  // 準備要上傳的資料
  const data = {
    practiceLog: practiceLog,
    lastSync: new Date().toISOString()
  };
  
  const gistContent = {
    description: '刷題機 V2.0 - 答題記錄',
    public: false,
    files: {
      'practice-log.json': {
        content: JSON.stringify(data, null, 2)
      }
    }
  };
  
  try {
    let response;
    
    if (gistId) {
      // 更新現有 Gist
      response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gistContent)
      });
    } else {
      // 建立新 Gist
      response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gistContent)
      });
    }
    
    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.status}`);
    }
    
    const result = await response.json();
    
    // 儲存 Gist ID
    localStorage.setItem('gistId', result.id);
    
    showMessage('上傳成功', `已上傳到 GitHub Gist\n\nGist ID: ${result.id}\n最後同步: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('上傳失敗:', error);
    showMessage('上傳失敗', `${error.message}\n\n請檢查：\n1. Token 是否正確\n2. 是否有 gist 權限\n3. 網路連線是否正常`);
  }
}

async function downloadFromGist() {
  const token = localStorage.getItem('githubToken');
  const gistId = localStorage.getItem('gistId');
  
  if (!gistId) {
    showMessage('錯誤', '尚未設定 Gist ID\n\n請先上傳一次，或在設定中填入 Gist ID');
    return;
  }
  
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.status}`);
    }
    
    const gist = await response.json();
    const content = gist.files['practice-log.json'].content;
    const data = JSON.parse(content);
    
    // 詢問是否覆蓋
    if (practiceLog.length > 0) {
      if (!confirm(`本地有 ${practiceLog.length} 筆記錄\n雲端有 ${data.practiceLog.length} 筆記錄\n\n確定要用雲端資料覆蓋本地嗎？`)) {
        return;
      }
    }
    
    // 更新本地資料
    practiceLog = data.practiceLog;
    saveToLocalStorage();
    
    // 重新渲染
    if (currentPage === 'list') {
      renderQuestionList();
      renderHobbitLog();
    }
    
    showMessage('下載成功', `已從雲端下載資料\n\n記錄數: ${practiceLog.length}\n最後同步: ${new Date(data.lastSync).toLocaleString()}`);
    
  } catch (error) {
    console.error('下載失敗:', error);
    showMessage('下載失敗', `${error.message}\n\n請檢查：\n1. Gist ID 是否正確\n2. Token 是否有效\n3. 網路連線是否正常`);
  }
}

// ==================== 初始化完成 ====================

console.log('app.js 載入完成');

