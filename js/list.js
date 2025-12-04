// list.js - 題目列表頁面邏輯

import { dataManager } from './dataManager.js';
import { stateManager } from './stateManager.js';
import { showDialog, getStarIcon, shuffle } from './utils.js';

let allQuestions = [];
let filteredQuestions = [];

// 初始化
async function init() {
  try {
    // 檢查是否已載入題庫
    if (!dataManager.questions || dataManager.questions.length === 0) {
      await showDialog('錯誤', '請先載入題庫檔案');
      window.location.href = 'index.html';
      return;
    }

    // 取得增強的題目資料
    allQuestions = dataManager.getEnhancedQuestions();
    
    // 初始化篩選選項
    initFilterOptions();
    
    // 顯示題目列表
    filterAndDisplay();
    
    // 綁定事件
    bindEvents();
    
    // 更新狀態列
    updateStatus();
    
  } catch (error) {
    console.error('初始化失敗:', error);
    await showDialog('錯誤', '初始化失敗，請重新載入');
  }
}

// 初始化篩選選項
function initFilterOptions() {
  const years = stateManager.getAvailableYears(allQuestions);
  const schools = stateManager.getAvailableSchools(allQuestions);
  const chapters = stateManager.getAvailableChapters(allQuestions);
  
  // 年份
  const yearSelect = document.getElementById('filterYear');
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });
  
  // 學校
  const schoolSelect = document.getElementById('filterSchool');
  schools.forEach(school => {
    const option = document.createElement('option');
    option.value = school;
    option.textContent = school;
    schoolSelect.appendChild(option);
  });
  
  // 章節
  const chapterSelect = document.getElementById('filterChapter');
  chapters.forEach(chapter => {
    const option = document.createElement('option');
    option.value = chapter;
    option.textContent = chapter;
    chapterSelect.appendChild(option);
  });
}

// 篩選並顯示
function filterAndDisplay() {
  // 取得篩選條件
  const filters = {
    year: document.getElementById('filterYear').value,
    school: document.getElementById('filterSchool').value,
    chapter: document.getElementById('filterChapter').value,
    difficulty: document.getElementById('filterDifficulty').value,
    status: document.getElementById('filterStatus').value,
    searchText: document.getElementById('searchText').value
  };
  
  // 更新 state manager
  Object.keys(filters).forEach(key => {
    stateManager.setFilter(key, filters[key]);
  });
  
  // 應用篩選和排序
  filteredQuestions = stateManager.applyFiltersAndSorting(allQuestions);
  
  // 顯示題目列表
  displayQuestions(filteredQuestions);
  
  // 更新題目計數
  document.getElementById('questionCount').textContent = filteredQuestions.length;
  
  // 更新篩選資訊
  updateFilterInfo(filters);
}

// 顯示題目列表
function displayQuestions(questions) {
  const tbody = document.getElementById('questionTableBody');
  tbody.innerHTML = '';
  
  questions.forEach((q, index) => {
    const row = document.createElement('tr');
    row.dataset.qid = q.Q_ID;
    
    // 序號
    const orderCell = document.createElement('td');
    orderCell.textContent = q.Order || (index + 1);
    row.appendChild(orderCell);
    
    // 年份
    const yearCell = document.createElement('td');
    yearCell.textContent = q.Year;
    row.appendChild(yearCell);
    
    // 學校
    const schoolCell = document.createElement('td');
    schoolCell.textContent = q.School;
    schoolCell.style.maxWidth = '150px';
    schoolCell.style.overflow = 'hidden';
    schoolCell.style.textOverflow = 'ellipsis';
    row.appendChild(schoolCell);
    
    // 章節
    const chapterCell = document.createElement('td');
    chapterCell.textContent = q.Chapter || '-';
    row.appendChild(chapterCell);
    
    // 難度
    const difficultyCell = document.createElement('td');
    difficultyCell.textContent = q.Difficulty || '-';
    row.appendChild(difficultyCell);
    
    // 縮圖
    const imageCell = document.createElement('td');
    if (q['Problem Image']) {
      const img = document.createElement('img');
      img.src = q['Problem Image'];
      img.style.maxWidth = '60px';
      img.style.maxHeight = '40px';
      img.style.cursor = 'pointer';
      img.title = '點擊查看大圖';
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        showImagePreview(q['Problem Image']);
      });
      imageCell.appendChild(img);
    } else {
      imageCell.textContent = '-';
    }
    row.appendChild(imageCell);
    
    // 預測難度
    const predictCell = document.createElement('td');
    if (q.predictedDifficulty) {
      predictCell.innerHTML = getStarIcon(true).repeat(q.predictedDifficulty) + 
                               getStarIcon(false).repeat(5 - q.predictedDifficulty);
      predictCell.style.color = '#ffcc00';
    } else {
      predictCell.textContent = '-';
    }
    row.appendChild(predictCell);
    
    // 練習次數
    const countCell = document.createElement('td');
    countCell.textContent = q.practiceCount || 0;
    row.appendChild(countCell);
    
    // 最後結果
    const resultCell = document.createElement('td');
    if (q.lastResult) {
      const resultMap = {
        'Correct': '✓',
        'Incorrect': '✗',
        'Skipped': '⊘'
      };
      resultCell.textContent = resultMap[q.lastResult] || q.lastResult;
      resultCell.style.fontWeight = 'bold';
      if (q.lastResult === 'Correct') resultCell.style.color = 'green';
      if (q.lastResult === 'Incorrect') resultCell.style.color = 'red';
    } else {
      resultCell.textContent = '-';
    }
    row.appendChild(resultCell);
    
    // 最後練習日期
    const dateCell = document.createElement('td');
    if (q.lastPracticeDate) {
      const date = new Date(q.lastPracticeDate);
      dateCell.textContent = date.toLocaleDateString('zh-TW');
    } else {
      dateCell.textContent = '-';
    }
    row.appendChild(dateCell);
    
    // 筆記圖示
    const noteCell = document.createElement('td');
    const history = dataManager.getQuestionPracticeHistory(q.Q_ID);
    const hasNote = history.some(h => h.Note && h.Note.trim());
    noteCell.textContent = hasNote ? '📝' : '-';
    noteCell.style.textAlign = 'center';
    row.appendChild(noteCell);
    
    // 點擊行顯示詳細資訊
    row.addEventListener('click', () => showQuestionDetail(q));
    
    tbody.appendChild(row);
  });
}

// 顯示題目詳細資訊
function showQuestionDetail(question) {
  const history = dataManager.getQuestionPracticeHistory(question.Q_ID);
  
  let historyHtml = '<div><strong>練習歷史:</strong></div>';
  if (history.length > 0) {
    historyHtml += '<ul style="margin: 8px 0; padding-left: 20px;">';
    history.forEach(h => {
      historyHtml += `<li>${h.Date}: ${h.Result} (${h.TimeSeconds}秒, 難度${h.Difficulty}) ${h.Note ? '📝' : ''}</li>`;
    });
    historyHtml += '</ul>';
  } else {
    historyHtml += '<p style="color: var(--win98-darkgray);">尚未練習過此題</p>';
  }
  
  const text = question['Extracted Text'] || '(無文字內容)';
  
  const message = `
    <div style="text-align: left;">
      <div><strong>題目 ID:</strong> ${question.Q_ID}</div>
      <div><strong>年份:</strong> ${question.Year}</div>
      <div><strong>學校:</strong> ${question.School}</div>
      <div><strong>章節:</strong> ${question.Chapter || '-'}</div>
      <div><strong>難度:</strong> ${question.Difficulty || '-'}</div>
      <hr style="margin: 8px 0;">
      <div><strong>題目內容:</strong></div>
      <div style="max-height: 200px; overflow-y: auto; background: white; padding: 8px; margin: 8px 0; font-size: 10px;">
        ${text}
      </div>
      <hr style="margin: 8px 0;">
      ${historyHtml}
    </div>
  `;
  
  showDialog('題目詳細資訊', message);
}

// 顯示圖片預覽
function showImagePreview(imagePath) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.style.cursor = 'pointer';
  
  const img = document.createElement('img');
  img.src = imagePath;
  img.style.maxWidth = '90%';
  img.style.maxHeight = '90%';
  img.style.border = '4px solid white';
  img.style.boxShadow = '0 0 20px rgba(0,0,0,0.8)';
  
  overlay.appendChild(img);
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
}

// 更新篩選資訊
function updateFilterInfo(filters) {
  const active = Object.values(filters).filter(v => v).length;
  const filterInfo = document.getElementById('filterInfo');
  
  if (active > 0) {
    filterInfo.textContent = `篩選: ${active} 個條件`;
  } else {
    filterInfo.textContent = '無篩選';
  }
}

// 更新狀態
function updateStatus() {
  const stats = dataManager.getStats();
  const statusText = document.getElementById('statusText');
  statusText.textContent = `總題數: ${stats.totalQuestions} | 已練習: ${stats.practicedQuestions} | 正確率: ${stats.accuracy}%`;
}

// 綁定事件
function bindEvents() {
  // 篩選改變
  ['filterYear', 'filterSchool', 'filterChapter', 'filterDifficulty', 'filterStatus'].forEach(id => {
    document.getElementById(id).addEventListener('change', filterAndDisplay);
  });
  
  // 搜尋
  let searchTimeout;
  document.getElementById('searchText').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterAndDisplay, 300);
  });
  
  // 排序
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      const currentSorting = stateManager.getSorting();
      const direction = currentSorting.field === field && currentSorting.direction === 'asc' ? 'desc' : 'asc';
      
      stateManager.setSorting(field, direction);
      filterAndDisplay();
      
      // 更新排序指示
      document.querySelectorAll('th[data-sort]').forEach(t => t.style.background = '');
      th.style.background = 'var(--win98-highlight)';
      th.style.color = 'white';
    });
  });
  
  // 重置篩選
  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    document.getElementById('filterYear').value = '';
    document.getElementById('filterSchool').value = '';
    document.getElementById('filterChapter').value = '';
    document.getElementById('filterDifficulty').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('searchText').value = '';
    stateManager.resetFilters();
    filterAndDisplay();
  });
  
  // 開始刷題
  document.getElementById('startPracticeBtn').addEventListener('click', startPractice);
  
  // 工具列按鈕
  document.getElementById('refreshBtn').addEventListener('click', () => {
    location.reload();
  });
  
  document.getElementById('statsBtn').addEventListener('click', () => {
    window.location.href = 'summary.html';
  });
  
  document.getElementById('hobbitBtn').addEventListener('click', () => {
    window.location.href = 'hobbit.html';
  });
  
  document.getElementById('exportBtn').addEventListener('click', exportData);
  
  // 時間更新
  updateTime();
  setInterval(updateTime, 1000);
}

// 開始刷題
async function startPractice() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const needPredict = document.getElementById('needPredict').checked;
  
  let questions = [...filteredQuestions];
  
  if (questions.length === 0) {
    await showDialog('提示', '沒有符合條件的題目');
    return;
  }
  
  // 根據模式選擇題目
  if (mode === 'same-chapter') {
    questions = selectByGroup(questions, 'Chapter', 3);
  } else if (mode === 'same-school') {
    questions = selectByGroup(questions, 'School', 3);
  } else if (mode === 'same-difficulty') {
    questions = selectByGroup(questions, 'Difficulty', 3);
  }
  
  // 洗牌
  questions = shuffle(questions);
  
  // 建立會話
  stateManager.startSession(mode, questions);
  
  // 如果需要預測難度
  if (needPredict) {
    // 檢查是否所有題目都已有預測
    const unpredicted = questions.filter(q => !q.predictedDifficulty);
    
    if (unpredicted.length > 0) {
      window.location.href = 'predict.html';
    } else {
      window.location.href = 'practice.html';
    }
  } else {
    window.location.href = 'practice.html';
  }
}

// 依群組選擇題目
function selectByGroup(questions, groupField, count) {
  const groups = {};
  
  // 將題目分組
  questions.forEach(q => {
    const key = q[groupField];
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  });
  
  // 隨機選擇一個群組
  const groupKeys = Object.keys(groups);
  const randomGroup = groupKeys[Math.floor(Math.random() * groupKeys.length)];
  
  // 從該群組中選擇 count 題
  const groupQuestions = groups[randomGroup];
  return shuffle(groupQuestions).slice(0, Math.min(count, groupQuestions.length));
}

// 匯出資料
async function exportData() {
  try {
    const data = dataManager.exportAllData();
    
    // 建立下載連結
    const message = `
      <div style="text-align: left;">
        <p>資料已準備好匯出，請複製以下內容到文字檔保存：</p>
        <hr>
        <div><strong>practice_log.csv:</strong></div>
        <textarea readonly style="width: 100%; height: 100px; margin-bottom: 8px;">${data.practice_log}</textarea>
        <div><strong>predict_log.csv:</strong></div>
        <textarea readonly style="width: 100%; height: 100px; margin-bottom: 8px;">${data.predict_log}</textarea>
        <div><strong>hobbit_log.csv:</strong></div>
        <textarea readonly style="width: 100%; height: 100px;">${data.hobbit_log}</textarea>
      </div>
    `;
    
    await showDialog('匯出資料', message);
  } catch (error) {
    await showDialog('錯誤', '匯出資料失敗');
  }
}

// 更新時間
function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false });
  document.getElementById('statusTime').textContent = timeStr;
}

// 啟動
init();
