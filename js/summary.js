// summary.js - 統計摘要頁面邏輯

import { dataManager } from './dataManager.js';
import { stateManager } from './stateManager.js';
import { formatTime, getStarIcon } from './utils.js';

// 初始化
async function init() {
  try {
    // 載入資料
    await dataManager.loadFromLocalStorage();
    
    // 顯示整體統計
    displayOverallStats();
    
    // 顯示最近練習記錄
    displayRecentPractices();
    
    // 顯示難度分析
    displayDifficultyAnalysis();
    
    // 顯示預測分析
    displayPredictionAnalysis();
    
    // 綁定事件
    bindEvents();
    
    // 更新時間
    updateTime();
    setInterval(updateTime, 1000);
    
  } catch (error) {
    console.error('初始化失敗:', error);
  }
}

// 顯示整體統計
function displayOverallStats() {
  const stats = dataManager.getStats();
  
  document.getElementById('totalQuestions').textContent = stats.totalQuestions;
  document.getElementById('practicedQuestions').textContent = stats.practicedQuestions;
  document.getElementById('totalPracticeCount').textContent = stats.totalPracticeCount;
  document.getElementById('accuracy').textContent = stats.accuracy;
  
  document.getElementById('correctCount').textContent = stats.correctCount;
  document.getElementById('incorrectCount').textContent = stats.incorrectCount;
  document.getElementById('skippedCount').textContent = stats.skippedCount;
  
  // 總時間 (格式化為 HH:MM:SS)
  const hours = Math.floor(stats.totalTime / 3600);
  const minutes = Math.floor((stats.totalTime % 3600) / 60);
  const seconds = stats.totalTime % 60;
  document.getElementById('totalTime').textContent = 
    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // 平均時間
  document.getElementById('avgTime').textContent = formatTime(stats.avgTime);
}

// 顯示最近練習記錄
function displayRecentPractices() {
  const practices = dataManager.practiceLog
    .slice(-20)
    .reverse(); // 最新的在前
  
  const tbody = document.getElementById('recentPractices');
  tbody.innerHTML = '';
  
  if (practices.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="8" style="text-align: center; color: var(--win98-darkgray);">尚無練習記錄</td>';
    tbody.appendChild(row);
    return;
  }
  
  practices.forEach(practice => {
    const question = dataManager.questions.find(q => q.Q_ID === practice.Q_ID);
    
    const row = document.createElement('tr');
    
    // 日期
    const dateCell = document.createElement('td');
    const date = new Date(practice.Date);
    dateCell.textContent = date.toLocaleDateString('zh-TW');
    row.appendChild(dateCell);
    
    // 時間
    const timeCell = document.createElement('td');
    timeCell.textContent = date.toLocaleTimeString('zh-TW', { hour12: false });
    row.appendChild(timeCell);
    
    // 題目來源
    const sourceCell = document.createElement('td');
    if (question) {
      sourceCell.textContent = `${question.Year} ${question.School}`;
      sourceCell.style.maxWidth = '150px';
      sourceCell.style.overflow = 'hidden';
      sourceCell.style.textOverflow = 'ellipsis';
    } else {
      sourceCell.textContent = practice.Q_ID;
    }
    row.appendChild(sourceCell);
    
    // 章節
    const chapterCell = document.createElement('td');
    chapterCell.textContent = question ? (question.Chapter || '-') : '-';
    row.appendChild(chapterCell);
    
    // 結果
    const resultCell = document.createElement('td');
    const resultMap = {
      'Correct': '✓',
      'Incorrect': '✗',
      'Skipped': '⊘'
    };
    resultCell.textContent = resultMap[practice.Result] || practice.Result;
    resultCell.style.fontWeight = 'bold';
    if (practice.Result === 'Correct') resultCell.style.color = 'green';
    if (practice.Result === 'Incorrect') resultCell.style.color = 'red';
    if (practice.Result === 'Skipped') resultCell.style.color = 'orange';
    row.appendChild(resultCell);
    
    // 時間(秒)
    const timeSecondsCell = document.createElement('td');
    timeSecondsCell.textContent = practice.TimeSeconds || 0;
    row.appendChild(timeSecondsCell);
    
    // 難度
    const difficultyCell = document.createElement('td');
    const difficulty = parseInt(practice.Difficulty);
    if (difficulty) {
      difficultyCell.innerHTML = getStarIcon(true).repeat(difficulty) + 
                                  getStarIcon(false).repeat(5 - difficulty);
      difficultyCell.style.color = '#ffcc00';
    } else {
      difficultyCell.textContent = '-';
    }
    row.appendChild(difficultyCell);
    
    // 筆記
    const noteCell = document.createElement('td');
    noteCell.textContent = practice.Note && practice.Note.trim() ? '📝' : '-';
    noteCell.style.textAlign = 'center';
    noteCell.title = practice.Note || '';
    row.appendChild(noteCell);
    
    tbody.appendChild(row);
  });
}

// 顯示難度分析
function displayDifficultyAnalysis() {
  const difficultyStats = {
    1: { count: 0, correct: 0 },
    2: { count: 0, correct: 0 },
    3: { count: 0, correct: 0 },
    4: { count: 0, correct: 0 },
    5: { count: 0, correct: 0 }
  };
  
  dataManager.practiceLog.forEach(practice => {
    const difficulty = parseInt(practice.Difficulty);
    if (difficulty >= 1 && difficulty <= 5) {
      difficultyStats[difficulty].count++;
      if (practice.Result === 'Correct') {
        difficultyStats[difficulty].correct++;
      }
    }
  });
  
  const container = document.getElementById('difficultyAnalysis');
  container.innerHTML = '';
  
  // 建立長條圖
  for (let i = 1; i <= 5; i++) {
    const stat = difficultyStats[i];
    const accuracy = stat.count > 0 ? Math.round((stat.correct / stat.count) * 100) : 0;
    
    const bar = document.createElement('div');
    bar.style.marginBottom = '12px';
    
    bar.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 4px;">
        <span style="min-width: 80px; font-size: 11px;">
          ${getStarIcon(true).repeat(i)} ${getStarIcon(false).repeat(5 - i)}
        </span>
        <span style="font-size: 10px; color: var(--win98-darkgray);">
          ${stat.count} 題 | 正確率 ${accuracy}%
        </span>
      </div>
      <div class="progress-bar" style="height: 16px;">
        <div class="progress-fill" style="width: ${accuracy}%; background: ${getBarColor(accuracy)};"></div>
      </div>
    `;
    
    container.appendChild(bar);
  }
}

// 顯示預測分析
function displayPredictionAnalysis() {
  const container = document.getElementById('predictionAnalysis');
  container.innerHTML = '';
  
  // 收集預測與實際的對比資料
  const comparison = [];
  
  dataManager.practiceLog.forEach(practice => {
    const predicted = dataManager.getQuestionPredictedDifficulty(practice.Q_ID);
    const actual = parseInt(practice.Difficulty);
    
    if (predicted && actual) {
      comparison.push({
        qId: practice.Q_ID,
        predicted: predicted,
        actual: actual,
        diff: Math.abs(predicted - actual)
      });
    }
  });
  
  if (comparison.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--win98-darkgray); padding: 20px;">尚無預測資料</p>';
    return;
  }
  
  // 計算統計
  const avgDiff = comparison.reduce((sum, c) => sum + c.diff, 0) / comparison.length;
  const exactMatches = comparison.filter(c => c.diff === 0).length;
  const withinOne = comparison.filter(c => c.diff <= 1).length;
  
  const stats = document.createElement('div');
  stats.style.padding = '12px';
  stats.style.background = '#ffffcc';
  stats.style.border = '1px solid var(--win98-darkgray)';
  stats.style.marginTop = '12px';
  
  stats.innerHTML = `
    <div style="font-size: 11px;">
      <div><strong>總比較筆數:</strong> ${comparison.length}</div>
      <div><strong>完全一致:</strong> ${exactMatches} (${Math.round(exactMatches / comparison.length * 100)}%)</div>
      <div><strong>誤差 ≤ 1星:</strong> ${withinOne} (${Math.round(withinOne / comparison.length * 100)}%)</div>
      <div><strong>平均誤差:</strong> ${avgDiff.toFixed(2)} 星</div>
    </div>
  `;
  
  container.appendChild(stats);
  
  // 顯示分布圖
  const distribution = {};
  for (let pred = 1; pred <= 5; pred++) {
    for (let act = 1; act <= 5; act++) {
      const key = `${pred}-${act}`;
      distribution[key] = comparison.filter(c => c.predicted === pred && c.actual === act).length;
    }
  }
  
  const table = document.createElement('table');
  table.style.marginTop = '12px';
  table.style.fontSize = '10px';
  
  let tableHTML = '<thead><tr><th>預測 \\ 實際</th>';
  for (let i = 1; i <= 5; i++) {
    tableHTML += `<th>${getStarIcon(true).repeat(i)}</th>`;
  }
  tableHTML += '</tr></thead><tbody>';
  
  for (let pred = 1; pred <= 5; pred++) {
    tableHTML += `<tr><td><strong>${getStarIcon(true).repeat(pred)}</strong></td>`;
    for (let act = 1; act <= 5; act++) {
      const count = distribution[`${pred}-${act}`] || 0;
      const color = pred === act ? '#90EE90' : (Math.abs(pred - act) === 1 ? '#FFFFCC' : '#FFB6C1');
      tableHTML += `<td style="background: ${color}; text-align: center;">${count}</td>`;
    }
    tableHTML += '</tr>';
  }
  
  tableHTML += '</tbody>';
  table.innerHTML = tableHTML;
  
  container.appendChild(table);
}

// 取得長條顏色
function getBarColor(percentage) {
  if (percentage >= 80) return 'green';
  if (percentage >= 60) return '#90EE90';
  if (percentage >= 40) return 'orange';
  return 'red';
}

// 綁定事件
function bindEvents() {
  document.getElementById('backToListBtn').addEventListener('click', () => {
    window.location.href = 'list.html';
  });
  
  document.getElementById('viewHobbitBtn').addEventListener('click', () => {
    window.location.href = 'hobbit.html';
  });
  
  document.getElementById('continueBtn').addEventListener('click', () => {
    window.location.href = 'list.html';
  });
}

// 更新時間
function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false });
  document.getElementById('statusTime').textContent = timeStr;
}

// 啟動
init();
