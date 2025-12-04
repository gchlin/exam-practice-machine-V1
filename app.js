// ============================================
// 刷題機 V1 - SPA 版本
// app.js - 主程式邏輯
// ============================================

// ==================== 全域變數 ====================

// 資料
let allQuestions = [];          // 所有題目
let filteredQuestions = [];     // 篩選後的題目
let selectedQuestions = [];     // 選中的題目
let practiceLog = [];           // 練習紀錄
let predictLog = [];            // 預測紀錄
let hobbitLog = [];             // 每日練習紀錄

// 練習狀態
let isPracticing = false;       // 是否正在練習
let currentQuestionIndex = 0;   // 當前題目索引
let practiceQuestions = [];     // 本次練習的題目
let practiceResults = [];       // 本次練習的結果
let sessionStartTime = null;    // 本次練習開始時間
let questionStartTime = null;   // 當前題目開始時間
let timerInterval = null;       // 計時器
let isPaused = false;           // 是否暫停
let pausedTime = 0;             // 暫停累計時間

// UI 狀態
let showingAnswer = false;      // 是否顯示解答

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  console.log('刷題機 V1 啟動...');
  
  // 檢查 localStorage 是否有資料
  loadFromLocalStorage();
  
  // 如果有題庫，顯示列表
  if (allQuestions.length > 0) {
    initMainPage();
  } else {
    // 沒有題庫，顯示載入對話框
    setTimeout(() => {
      showDialog('歡迎', '請先載入題庫檔案才能開始使用！', () => {
        showLoadModal();
      });
    }, 500);
  }
  
  // 綁定鍵盤快捷鍵
  document.addEventListener('keydown', handleKeyboard);
  
  // 綁定載入模式切換
  document.querySelectorAll('input[name="load-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const localFileRow = document.getElementById('local-file-row');
      localFileRow.style.display = e.target.value === 'local' ? 'block' : 'none';
    });
  });
  
  // 啟動時鐘
  updateStatusClock();
  setInterval(updateStatusClock, 1000);
  
  console.log('初始化完成');
});

// ==================== LocalStorage 管理 ====================

function saveToLocalStorage() {
  try {
    localStorage.setItem('questions', JSON.stringify(allQuestions));
    localStorage.setItem('practiceLog', JSON.stringify(practiceLog));
    localStorage.setItem('predictLog', JSON.stringify(predictLog));
    localStorage.setItem('hobbitLog', JSON.stringify(hobbitLog));
    console.log('資料已儲存到 localStorage');
  } catch (e) {
    console.error('儲存失敗:', e);
    showDialog('錯誤', '資料儲存失敗，可能是儲存空間不足。');
  }
}

function loadFromLocalStorage() {
  try {
    const questions = localStorage.getItem('questions');
    const practice = localStorage.getItem('practiceLog');
    const predict = localStorage.getItem('predictLog');
    const hobbit = localStorage.getItem('hobbitLog');
    
    if (questions) allQuestions = JSON.parse(questions);
    if (practice) practiceLog = JSON.parse(practice);
    if (predict) predictLog = JSON.parse(predict);
    if (hobbit) hobbitLog = JSON.parse(hobbit);
    
    console.log(`從 localStorage 載入: ${allQuestions.length} 題`);
  } catch (e) {
    console.error('載入失敗:', e);
  }
}

// ==================== CSV 載入與解析 ====================

function showLoadModal() {
  document.getElementById('load-modal').style.display = 'flex';
}

function closeLoadModal() {
  document.getElementById('load-modal').style.display = 'none';
}

async function executeLoad() {
  const mode = document.querySelector('input[name="load-mode"]:checked').value;
  const progressContainer = document.getElementById('load-progress');
  const progressFill = document.getElementById('load-progress-fill');
  const progressText = document.getElementById('load-progress-text');
  
  progressContainer.style.display = 'block';
  progressFill.style.width = '0%';
  
  try {
    let csvText;
    
    if (mode === 'online') {
      // 線上載入
      progressText.textContent = '正在下載題庫...';
      progressFill.style.width = '25%';
      
      const response = await fetch('./data.csv');
      if (!response.ok) throw new Error('無法載入 data.csv');
      csvText = await response.text();
      
    } else {
      // 本地檔案
      const fileInput = document.getElementById('csv-file-input');
      if (!fileInput.files.length) {
        showDialog('錯誤', '請選擇 CSV 檔案');
        progressContainer.style.display = 'none';
        return;
      }
      
      progressText.textContent = '正在讀取檔案...';
      progressFill.style.width = '25%';
      
      const file = fileInput.files[0];
      csvText = await file.text();
    }
    
    // 解析 CSV
    progressText.textContent = '正在解析題庫...';
    progressFill.style.width = '50%';
    
    allQuestions = parseCSV(csvText);
    
    // 儲存到 localStorage
    progressText.textContent = '正在儲存資料...';
    progressFill.style.width = '75%';
    
    saveToLocalStorage();
    
    // 完成
    progressText.textContent = '載入完成！';
    progressFill.style.width = '100%';
    
    setTimeout(() => {
      closeLoadModal();
      initMainPage();
      showDialog('成功', `成功載入 ${allQuestions.length} 題！`);
    }, 500);
    
  } catch (error) {
    console.error('載入失敗:', error);
    progressContainer.style.display = 'none';
    showDialog('錯誤', `載入失敗: ${error.message}`);
  }
}

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];
  
  // 解析標題行
  const headers = parseCSVLine(lines[0]);
  const questions = [];
  
  // 解析資料行
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;
    
    const question = {};
    headers.forEach((header, index) => {
      question[header.trim()] = values[index] ? values[index].trim() : '';
    });
    
    // 確保有必要的欄位
    if (question.ExamID) {
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

// ==================== 主頁面初始化 ====================

function initMainPage() {
  // 顯示主頁
  showPage('main');
  
  // 初始化篩選器
  initFilters();
  
  // 載入熱圖
  loadHobbitLog();
  
  // 應用篩選
  applyFilters();
  
  // 更新統計
  updateMainPageStats();
}

function initFilters() {
  // 提取唯一值
  const years = [...new Set(allQuestions.map(q => q.Year).filter(Boolean))].sort();
  const schools = [...new Set(allQuestions.map(q => q.School).filter(Boolean))].sort();
  const chapters = [...new Set(allQuestions.map(q => q.Chapter).filter(Boolean))].sort();
  
  // 填充篩選器
  populateSelect('filter-year', years);
  populateSelect('filter-school', schools);
  populateSelect('filter-chapter', chapters);
}

function populateSelect(id, options) {
  const select = document.getElementById(id);
  // 保留第一個"全部"選項
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  options.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option;
    select.appendChild(opt);
  });
}

function updateMainPageStats() {
  const totalQuestions = allQuestions.length;
  const practicedCount = getPracticedQuestions().length;
  
  document.getElementById('total-questions').textContent = totalQuestions;
  document.getElementById('practiced-count').textContent = practicedCount;
}

// ==================== 篩選功能 ====================

function applyFilters() {
  const year = document.getElementById('filter-year').value;
  const school = document.getElementById('filter-school').value;
  const chapter = document.getElementById('filter-chapter').value;
  const difficulty = document.getElementById('filter-difficulty').value;
  const status = document.getElementById('filter-status').value;
  const search = document.getElementById('filter-search').value.toLowerCase();
  
  filteredQuestions = allQuestions.filter(q => {
    // 年份
    if (year && q.Year !== year) return false;
    
    // 學校
    if (school && q.School !== school) return false;
    
    // 章節
    if (chapter && q.Chapter !== chapter) return false;
    
    // 難度
    if (difficulty && q.Difficulty !== difficulty) return false;
    
    // 狀態
    if (status === 'practiced' && !isPracticed(q.ExamID)) return false;
    if (status === 'unpracticed' && isPracticed(q.ExamID)) return false;
    
    // 搜尋
    if (search) {
      const searchableText = [
        q.ExamID,
        q['Display Name'],
        q.Year,
        q.School,
        q.Chapter
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(search)) return false;
    }
    
    return true;
  });
  
  renderQuestionList();
}

function resetFilters() {
  document.getElementById('filter-year').value = '';
  document.getElementById('filter-school').value = '';
  document.getElementById('filter-chapter').value = '';
  document.getElementById('filter-difficulty').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-search').value = '';
  
  applyFilters();
}

function renderQuestionList() {
  const tbody = document.getElementById('question-list');
  tbody.innerHTML = '';
  
  document.getElementById('question-count').textContent = filteredQuestions.length;
  
  if (filteredQuestions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">沒有符合條件的題目</td></tr>';
    return;
  }
  
  filteredQuestions.forEach((q, index) => {
    const row = document.createElement('tr');
    
    const practiceCount = getPracticeCount(q.ExamID);
    const lastPractice = getLastPracticeDate(q.ExamID);
    const skipCount = getSkipCount(q.ExamID);
    
    row.innerHTML = `
      <td><input type="checkbox" class="question-checkbox" data-exam-id="${q.ExamID}"></td>
      <td>${index + 1}</td>
      <td>${q.Year || '-'}</td>
      <td>${q.School || '-'}</td>
      <td>${q.Chapter || '-'}</td>
      <td>${renderStars(q.Difficulty || 0)}</td>
      <td>${practiceCount}</td>
      <td>${lastPractice}</td>
      <td>${skipCount}</td>
      <td>
        <button onclick="practiceOne('${q.ExamID}')" class="small">練習</button>
        <button onclick="viewQuestion('${q.ExamID}')" class="small">查看</button>
      </td>
    `;
    
    tbody.appendChild(row);
  });
}

// ==================== 輔助函數 ====================

function isPracticed(examId) {
  return practiceLog.some(log => log.Q_ID === examId);
}

function getPracticeCount(examId) {
  return practiceLog.filter(log => log.Q_ID === examId).length;
}

function getLastPracticeDate(examId) {
  const logs = practiceLog.filter(log => log.Q_ID === examId);
  if (logs.length === 0) return '-';
  
  const latest = logs.sort((a, b) => new Date(b.Date) - new Date(a.Date))[0];
  return formatDate(latest.Date);
}

function getSkipCount(examId) {
  return practiceLog.filter(log => log.Q_ID === examId && log.Result === 'Skipped').length;
}

function getPracticedQuestions() {
  const practicedIds = new Set(practiceLog.map(log => log.Q_ID));
  return allQuestions.filter(q => practicedIds.has(q.ExamID));
}

function renderStars(difficulty) {
  const rating = parseInt(difficulty) || 0;
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= rating ? '★' : '☆';
  }
  return stars;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function updateStatusClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false });
  const elem = document.getElementById('status-time');
  if (elem) elem.textContent = timeStr;
}

// ==================== 頁面切換 ====================

function showPage(pageName) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }
}

// ==================== 通用對話框 ====================

function showDialog(title, message, callback = null) {
  const modal = document.getElementById('dialog-modal');
  const titleElem = document.getElementById('dialog-title');
  const messageElem = document.getElementById('dialog-message');
  const okBtn = document.getElementById('dialog-ok-btn');
  
  titleElem.textContent = title;
  messageElem.textContent = message;
  modal.style.display = 'flex';
  
  if (callback) {
    okBtn.onclick = () => {
      closeDialog();
      callback();
    };
  } else {
    okBtn.onclick = closeDialog;
  }
}

function closeDialog() {
  document.getElementById('dialog-modal').style.display = 'none';
}

// ==================== 載入題庫 ====================

function loadQuestionBank() {
  showLoadModal();
}

// ==================== 匯出資料 ====================

function exportData() {
  const data = {
    practiceLog: practiceLog,
    predictLog: predictLog,
    hobbitLog: hobbitLog,
    exportDate: new Date().toISOString()
  };
  
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `shuatiji-data-${formatDateForFilename(new Date())}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  
  showDialog('成功', '資料已匯出！');
}

function formatDateForFilename(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

// ==================== 練習功能 ====================

function toggleSelectAll() {
  const selectAll = document.getElementById('select-all');
  const checkboxes = document.querySelectorAll('.question-checkbox');
  
  checkboxes.forEach(cb => {
    cb.checked = selectAll.checked;
  });
}

function getSelectedQuestions() {
  const checkboxes = document.querySelectorAll('.question-checkbox:checked');
  const examIds = Array.from(checkboxes).map(cb => cb.dataset.examId);
  return filteredQuestions.filter(q => examIds.includes(q.ExamID));
}

function startPractice(mode) {
  const selected = getSelectedQuestions();
  const predictMode = document.getElementById('predict-mode').checked;
  
  if (selected.length === 0) {
    showDialog('提示', '請先選擇要練習的題目！');
    return;
  }
  
  // 準備練習題目
  practiceQuestions = [...selected];
  
  if (mode === 'random') {
    // 隨機3題
    shuffleArray(practiceQuestions);
    practiceQuestions = practiceQuestions.slice(0, Math.min(3, practiceQuestions.length));
  }
  
  // 初始化練習狀態
  currentQuestionIndex = 0;
  practiceResults = [];
  sessionStartTime = Date.now();
  isPracticing = true;
  isPaused = false;
  pausedTime = 0;
  
  // 如果是預測模式，先進行預測
  if (predictMode) {
    // TODO: 實作預測介面
    showDialog('提示', '預測模式開發中...');
  }
  
  // 進入練習頁面
  showPage('practice');
  displayQuestion(currentQuestionIndex);
  startTimer();
}

function practiceOne(examId) {
  const question = allQuestions.find(q => q.ExamID === examId);
  if (!question) return;
  
  practiceQuestions = [question];
  currentQuestionIndex = 0;
  practiceResults = [];
  sessionStartTime = Date.now();
  isPracticing = true;
  
  showPage('practice');
  displayQuestion(0);
  startTimer();
}

function viewQuestion(examId) {
  const question = allQuestions.find(q => q.ExamID === examId);
  if (!question) return;
  
  // TODO: 實作查看模式（不計時、不記錄）
  showDialog('提示', `題目 ${examId}\n年份: ${question.Year}\n學校: ${question.School}`);
}

function displayQuestion(index) {
  if (index < 0 || index >= practiceQuestions.length) return;
  
  const question = practiceQuestions[index];
  currentQuestionIndex = index;
  questionStartTime = Date.now();
  showingAnswer = false;
  
  // 更新題目資訊
  document.getElementById('current-source').textContent = `${question.Year} ${question.School}`;
  document.getElementById('current-progress').textContent = `${index + 1} / ${practiceQuestions.length}`;
  
  // 顯示題目圖片
  const questionImg = document.getElementById('question-image');
  questionImg.src = question['Problem Image'] || '';
  questionImg.alt = '題目圖片';
  
  // 載入解答和詳解圖片（但先隱藏）
  document.getElementById('answer-image').src = question['Answer Image'] || '';
  document.getElementById('solution-image').src = question['Solution Image'] || '';
  
  // 隱藏解答區域
  document.querySelector('.answer-solution-container').style.display = 'none';
  document.getElementById('show-answer-text').textContent = '顯示解答/詳解';
  
  // 載入之前的筆記（如果有）
  const previousNote = getPreviousNote(question.ExamID);
  document.getElementById('practice-notes').value = previousNote;
  
  // 載入之前的難度（如果有）
  const previousDifficulty = getPreviousDifficulty(question.ExamID);
  updateDifficultyStars(previousDifficulty);
  
  // 更新按鈕狀態
  document.getElementById('prev-btn').disabled = index === 0;
  document.getElementById('next-btn').disabled = false;
  
  // 清空當前結果
  document.getElementById('status-message').textContent = '練習中...';
}

function prevQuestion() {
  if (currentQuestionIndex > 0) {
    saveCurrentQuestionState();
    displayQuestion(currentQuestionIndex - 1);
  }
}

function nextQuestion() {
  if (currentQuestionIndex < practiceQuestions.length - 1) {
    saveCurrentQuestionState();
    displayQuestion(currentQuestionIndex + 1);
  } else {
    // 已是最後一題
    showDialog('提示', '已經是最後一題了！');
  }
}

function saveCurrentQuestionState() {
  const question = practiceQuestions[currentQuestionIndex];
  const difficulty = getCurrentDifficulty();
  const notes = document.getElementById('practice-notes').value;
  
  // 更新或新增結果
  const existingResult = practiceResults.find(r => r.questionId === question.ExamID);
  if (existingResult) {
    existingResult.difficulty = difficulty;
    existingResult.notes = notes;
  }
}

function toggleAnswerSolution() {
  const container = document.querySelector('.answer-solution-container');
  showingAnswer = !showingAnswer;
  
  container.style.display = showingAnswer ? 'block' : 'none';
  document.getElementById('show-answer-text').textContent = 
    showingAnswer ? '隱藏解答/詳解' : '顯示解答/詳解';
}

function markCorrect() {
  recordResult('Correct');
  showFeedback('✓ 答對');
}

function markIncorrect() {
  recordResult('Incorrect');
  showFeedback('✗ 答錯');
}

function markSkip() {
  recordResult('Skipped');
  showFeedback('⊘ 跳過');
}

function recordResult(result) {
  const question = practiceQuestions[currentQuestionIndex];
  const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
  const difficulty = getCurrentDifficulty();
  const notes = document.getElementById('practice-notes').value;
  
  // 記錄結果
  const record = {
    questionId: question.ExamID,
    result: result,
    timeSpent: timeSpent,
    difficulty: difficulty,
    notes: notes,
    timestamp: Date.now()
  };
  
  // 更新或新增
  const existingIndex = practiceResults.findIndex(r => r.questionId === question.ExamID);
  if (existingIndex >= 0) {
    practiceResults[existingIndex] = record;
  } else {
    practiceResults.push(record);
  }
  
  // 更新統計顯示
  updatePracticeStats();
  
  // 自動跳到下一題
  if (currentQuestionIndex < practiceQuestions.length - 1) {
    setTimeout(() => {
      nextQuestion();
    }, 500);
  }
}

function showFeedback(message) {
  document.getElementById('status-message').textContent = message;
}

function updatePracticeStats() {
  const correct = practiceResults.filter(r => r.result === 'Correct').length;
  const incorrect = practiceResults.filter(r => r.result === 'Incorrect').length;
  const skip = practiceResults.filter(r => r.result === 'Skipped').length;
  
  document.getElementById('correct-count').textContent = correct;
  document.getElementById('incorrect-count').textContent = incorrect;
  document.getElementById('skip-count').textContent = skip;
}

function setDifficulty(value) {
  updateDifficultyStars(value);
}

function updateDifficultyStars(value) {
  const stars = document.querySelectorAll('.difficulty-rating .star');
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

function getCurrentDifficulty() {
  const activeStars = document.querySelectorAll('.difficulty-rating .star.active');
  return activeStars.length;
}

function getPreviousNote(examId) {
  const logs = practiceLog.filter(log => log.Q_ID === examId && log.Note);
  if (logs.length === 0) return '';
  return logs[logs.length - 1].Note;
}

function getPreviousDifficulty(examId) {
  const logs = practiceLog.filter(log => log.Q_ID === examId && log.Difficulty);
  if (logs.length === 0) return 0;
  return parseInt(logs[logs.length - 1].Difficulty) || 0;
}

// ==================== 計時器 ====================

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    if (!isPaused) {
      const elapsed = Date.now() - sessionStartTime - pausedTime;
      updateTimerDisplay(elapsed);
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function togglePause() {
  isPaused = !isPaused;
  
  const pauseBtn = document.getElementById('pause-btn');
  pauseBtn.textContent = isPaused ? '▶️' : '⏸️';
  
  if (isPaused) {
    // 暫停時記錄暫停開始時間
    pauseStartTime = Date.now();
  } else {
    // 恢復時累加暫停時間
    pausedTime += Date.now() - pauseStartTime;
  }
}

function updateTimerDisplay(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  document.getElementById('practice-timer').textContent = timeStr;
}

// ==================== 結束練習 ====================

function saveForLater() {
  showDialog('確認', '確定要儲存並離開嗎？', () => {
    savePracticeSession();
    backToList();
  });
}

function confirmExit() {
  if (!isPracticing) {
    backToList();
    return;
  }
  
  showDialog('確認', '練習尚未完成，確定要離開嗎？', () => {
    savePracticeSession();
    backToList();
  });
}

function finishPractice() {
  // 檢查是否所有題目都已作答
  const unanswered = practiceQuestions.filter((q, i) => 
    !practiceResults.find(r => r.questionId === q.ExamID)
  );
  
  if (unanswered.length > 0) {
    showDialog('提示', `還有 ${unanswered.length} 題未作答，確定要完成嗎？`, () => {
      savePracticeSession();
      showPracticeSummary();
    });
  } else {
    savePracticeSession();
    showPracticeSummary();
  }
}

function savePracticeSession() {
  const totalTime = Math.floor((Date.now() - sessionStartTime - pausedTime) / 1000);
  const today = new Date().toISOString().split('T')[0];
  
  // 儲存每題結果到 practiceLog
  practiceResults.forEach(result => {
    const log = {
      Q_ID: result.questionId,
      Date: today,
      TimeSeconds: result.timeSpent,
      Difficulty: result.difficulty,
      Note: result.notes,
      Result: result.result
    };
    practiceLog.push(log);
  });
  
  // 更新 hobbitLog
  updateHobbitLog(today, practiceResults);
  
  // 儲存到 localStorage
  saveToLocalStorage();
  
  stopTimer();
  isPracticing = false;
}

function showPracticeSummary() {
  const correct = practiceResults.filter(r => r.result === 'Correct').length;
  const incorrect = practiceResults.filter(r => r.result === 'Incorrect').length;
  const skip = practiceResults.filter(r => r.result === 'Skipped').length;
  const total = practiceResults.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  
  const message = `
練習完成！

總題數: ${practiceQuestions.length}
已作答: ${total}
答對: ${correct}
答錯: ${incorrect}
跳過: ${skip}
正確率: ${accuracy}%

資料已自動儲存。
  `;
  
  showDialog('練習統計', message, () => {
    backToList();
  });
}

function backToList() {
  stopTimer();
  isPracticing = false;
  showPage('main');
  applyFilters();
  updateMainPageStats();
  loadHobbitLog();
}

// ==================== Hobbit Log (熱圖) ====================

function updateHobbitLog(date, results) {
  let log = hobbitLog.find(l => l.Date === date);
  
  if (!log) {
    log = {
      Date: date,
      TotalPracticeTime: 0,
      TotalSolved: 0,
      TotalSkipped: 0,
      Note: ''
    };
    hobbitLog.push(log);
  }
  
  // 累加統計
  results.forEach(r => {
    log.TotalPracticeTime += r.timeSpent;
    if (r.result === 'Correct' || r.result === 'Incorrect') {
      log.TotalSolved++;
    } else if (r.result === 'Skipped') {
      log.TotalSkipped++;
    }
  });
}

function loadHobbitLog() {
  const heatmapContainer = document.getElementById('hobbit-heatmap');
  heatmapContainer.innerHTML = '';
  
  // 生成最近3個月的熱圖
  const today = new Date();
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  // 生成日期網格
  const weeks = [];
  let currentDate = new Date(threeMonthsAgo);
  
  while (currentDate <= today) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const log = hobbitLog.find(l => l.Date === dateStr);
    const practiceTime = log ? log.TotalPracticeTime : 0;
    
    weeks.push({
      date: dateStr,
      level: getHeatLevel(practiceTime),
      time: practiceTime
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // 渲染熱圖
  weeks.forEach(day => {
    const cell = document.createElement('div');
    cell.className = `heatmap-cell level-${day.level}`;
    cell.title = `${day.date}: ${Math.floor(day.time / 60)} 分鐘`;
    cell.onclick = () => showDayDetail(day.date);
    heatmapContainer.appendChild(cell);
  });
  
  // 更新本月統計
  updateMonthStats();
}

function getHeatLevel(seconds) {
  // 0: 無練習
  // 1: 1-10分鐘
  // 2: 11-30分鐘
  // 3: 31-60分鐘
  // 4: 60分鐘以上
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return 0;
  if (minutes <= 10) return 1;
  if (minutes <= 30) return 2;
  if (minutes <= 60) return 3;
  return 4;
}

function showDayDetail(date) {
  const log = hobbitLog.find(l => l.Date === date);
  if (!log) {
    showDialog('詳情', `${date}\n尚無練習紀錄`);
    return;
  }
  
  const minutes = Math.floor(log.TotalPracticeTime / 60);
  const message = `
${date}

練習時間: ${minutes} 分鐘
完成題數: ${log.TotalSolved}
跳過題數: ${log.TotalSkipped}
  `;
  
  showDialog('練習詳情', message);
}

function updateMonthStats() {
  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();
  
  const monthLogs = hobbitLog.filter(log => {
    const logDate = new Date(log.Date);
    return logDate.getMonth() === thisMonth && logDate.getFullYear() === thisYear;
  });
  
  const practiceDays = monthLogs.length;
  const totalQuestions = monthLogs.reduce((sum, log) => sum + log.TotalSolved, 0);
  const totalTime = Math.floor(monthLogs.reduce((sum, log) => sum + log.TotalPracticeTime, 0) / 60);
  
  document.getElementById('month-practice-days').textContent = practiceDays;
  document.getElementById('month-total-questions').textContent = totalQuestions;
  document.getElementById('month-total-time').textContent = totalTime;
}

// ==================== 統計分析 ====================

function showStats() {
  const modal = document.getElementById('stats-modal');
  const content = document.getElementById('stats-content');
  
  // 計算統計資料
  const totalQuestions = allQuestions.length;
  const practicedQuestions = getPracticedQuestions();
  const practicedCount = practicedQuestions.length;
  const practiceRate = totalQuestions > 0 ? Math.round((practicedCount / totalQuestions) * 100) : 0;
  
  const totalPracticeTime = practiceLog.reduce((sum, log) => sum + (log.TimeSeconds || 0), 0);
  const avgTime = practiceLog.length > 0 ? Math.floor(totalPracticeTime / practiceLog.length) : 0;
  
  const correctCount = practiceLog.filter(l => l.Result === 'Correct').length;
  const incorrectCount = practiceLog.filter(l => l.Result === 'Incorrect').length;
  const skipCount = practiceLog.filter(l => l.Result === 'Skipped').length;
  const accuracy = (correctCount + incorrectCount) > 0 ? 
    Math.round((correctCount / (correctCount + incorrectCount)) * 100) : 0;
  
  content.innerHTML = `
    <fieldset>
      <legend>📊 總體統計</legend>
      <table class="stats-table">
        <tr><td>題庫總數:</td><td><strong>${totalQuestions}</strong> 題</td></tr>
        <tr><td>已練習:</td><td><strong>${practicedCount}</strong> 題 (${practiceRate}%)</td></tr>
        <tr><td>練習次數:</td><td><strong>${practiceLog.length}</strong> 次</td></tr>
        <tr><td>總練習時間:</td><td><strong>${Math.floor(totalPracticeTime / 60)}</strong> 分鐘</td></tr>
        <tr><td>平均每題:</td><td><strong>${avgTime}</strong> 秒</td></tr>
      </table>
    </fieldset>
    
    <fieldset>
      <legend>✓ 答題結果</legend>
      <table class="stats-table">
        <tr><td>答對:</td><td><strong>${correctCount}</strong> 次</td></tr>
        <tr><td>答錯:</td><td><strong>${incorrectCount}</strong> 次</td></tr>
        <tr><td>跳過:</td><td><strong>${skipCount}</strong> 次</td></tr>
        <tr><td>正確率:</td><td><strong>${accuracy}%</strong></td></tr>
      </table>
    </fieldset>
    
    <fieldset>
      <legend>⭐ 難度分析</legend>
      ${renderDifficultyAnalysis()}
    </fieldset>
  `;
  
  modal.style.display = 'flex';
}

function closeStatsModal() {
  document.getElementById('stats-modal').style.display = 'none';
}

function renderDifficultyAnalysis() {
  const byDifficulty = {};
  
  practiceLog.forEach(log => {
    const diff = log.Difficulty || 0;
    if (!byDifficulty[diff]) {
      byDifficulty[diff] = { correct: 0, incorrect: 0, total: 0 };
    }
    
    byDifficulty[diff].total++;
    if (log.Result === 'Correct') byDifficulty[diff].correct++;
    if (log.Result === 'Incorrect') byDifficulty[diff].incorrect++;
  });
  
  let html = '<table class="stats-table">';
  for (let i = 1; i <= 5; i++) {
    const data = byDifficulty[i] || { correct: 0, incorrect: 0, total: 0 };
    const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    
    html += `
      <tr>
        <td>${renderStars(i)}</td>
        <td>${data.total} 次</td>
        <td>${accuracy}% 正確</td>
      </tr>
    `;
  }
  html += '</table>';
  
  return html;
}

// ==================== 鍵盤快捷鍵 ====================

function handleKeyboard(e) {
  if (!isPracticing) return;
  
  // 防止在輸入框時觸發快捷鍵
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  
  switch(e.key) {
    case 'ArrowLeft':
      prevQuestion();
      break;
    case 'ArrowRight':
    case 'Enter':
      nextQuestion();
      break;
    case ' ':
      e.preventDefault();
      togglePause();
      break;
    case 'c':
    case 'C':
      markCorrect();
      break;
    case 'x':
    case 'X':
      markIncorrect();
      break;
    case 's':
    case 'S':
      markSkip();
      break;
    case 'a':
    case 'A':
      toggleAnswerSolution();
      break;
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
      setDifficulty(parseInt(e.key));
      break;
  }
}

// ==================== 輔助工具 ====================

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// ==================== 初始化完成 ====================

console.log('app.js 載入完成');

