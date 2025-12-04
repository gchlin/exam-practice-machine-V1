// hobbit.js - 每日熱力圖頁面邏輯

import { dataManager } from './dataManager.js';
import { formatTime } from './utils.js';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1; // 1-12

// 初始化
async function init() {
  try {
    // 載入資料
    await dataManager.loadFromLocalStorage();
    
    // 初始化月份選擇器
    initMonthSelect();
    
    // 顯示當前月份的熱力圖
    displayHeatmap(currentYear, currentMonth);
    
    // 顯示本月統計
    displayMonthStats(currentYear, currentMonth);
    
    // 綁定事件
    bindEvents();
    
    // 更新時間
    updateTime();
    setInterval(updateTime, 1000);
    
  } catch (error) {
    console.error('初始化失敗:', error);
  }
}

// 初始化月份選擇器
function initMonthSelect() {
  const select = document.getElementById('monthSelect');
  select.innerHTML = '';
  
  // 取得所有有資料的月份
  const months = new Set();
  
  dataManager.hobbitLog.forEach(log => {
    const date = new Date(log.Date);
    const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    months.add(key);
  });
  
  // 如果沒有資料，至少顯示當前月份
  if (months.size === 0) {
    months.add(`${currentYear}-${currentMonth.toString().padStart(2, '0')}`);
  }
  
  // 排序並建立選項
  Array.from(months).sort().reverse().forEach(key => {
    const [year, month] = key.split('-');
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${year}年 ${month}月`;
    if (parseInt(year) === currentYear && parseInt(month) === currentMonth) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// 顯示熱力圖
function displayHeatmap(year, month) {
  const container = document.getElementById('heatmapContainer');
  container.innerHTML = '';
  
  // 建立月份標題
  const monthTitle = document.createElement('div');
  monthTitle.className = 'month-title';
  monthTitle.textContent = `${year}年 ${month}月`;
  container.appendChild(monthTitle);
  
  // 建立星期標題
  const calendarHeader = document.createElement('div');
  calendarHeader.className = 'calendar-header';
  ['日', '一', '二', '三', '四', '五', '六'].forEach(day => {
    const dayHeader = document.createElement('div');
    dayHeader.textContent = day;
    calendarHeader.appendChild(dayHeader);
  });
  container.appendChild(calendarHeader);
  
  // 取得該月份的資料
  const monthData = {};
  dataManager.hobbitLog.forEach(log => {
    const date = new Date(log.Date);
    if (date.getFullYear() === year && date.getMonth() + 1 === month) {
      monthData[log.Date] = log;
    }
  });
  
  // 計算該月的第一天是星期幾
  const firstDay = new Date(year, month - 1, 1);
  const firstDayOfWeek = firstDay.getDay();
  
  // 計算該月有幾天
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // 建立熱力圖格子
  const heatmap = document.createElement('div');
  heatmap.className = 'heatmap';
  
  // 填充第一週的空白
  for (let i = 0; i < firstDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'heatmap-cell level-0';
    emptyCell.style.visibility = 'hidden';
    heatmap.appendChild(emptyCell);
  }
  
  // 計算所有時間的最大值(用於計算顏色深淺)
  const times = Object.values(monthData).map(d => parseInt(d.TotalPracticeTime) || 0);
  const maxTime = Math.max(...times, 1);
  
  // 填充每一天
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const data = monthData[dateStr];
    
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.dataset.date = dateStr;
    
    if (data) {
      const time = parseInt(data.TotalPracticeTime) || 0;
      const level = getHeatLevel(time, maxTime);
      cell.classList.add(`level-${level}`);
      
      const minutes = Math.floor(time / 60);
      cell.dataset.time = `${data.TotalSolved}題 ${minutes}分鐘`;
      
      // 點擊事件
      cell.addEventListener('click', () => showDayDetail(dateStr, data));
    } else {
      cell.classList.add('level-0');
    }
    
    // 顯示日期數字
    const dayNum = document.createElement('div');
    dayNum.textContent = day;
    dayNum.style.fontSize = '8px';
    dayNum.style.textAlign = 'center';
    dayNum.style.paddingTop = '2px';
    cell.appendChild(dayNum);
    
    // 標記今天
    const today = new Date();
    if (year === today.getFullYear() && 
        month === today.getMonth() + 1 && 
        day === today.getDate()) {
      cell.style.border = '2px solid red';
    }
    
    heatmap.appendChild(cell);
  }
  
  container.appendChild(heatmap);
}

// 計算熱力等級 (0-4)
function getHeatLevel(time, maxTime) {
  if (time === 0) return 0;
  const percentage = time / maxTime;
  if (percentage >= 0.8) return 4;
  if (percentage >= 0.6) return 3;
  if (percentage >= 0.4) return 2;
  if (percentage >= 0.2) return 1;
  return 0;
}

// 顯示日期詳情
function showDayDetail(dateStr, data) {
  const container = document.getElementById('dayDetail');
  
  if (!data) {
    container.innerHTML = `
      <p style="text-align: center; color: var(--win98-darkgray);">
        ${dateStr} 沒有練習記錄
      </p>
    `;
    return;
  }
  
  const minutes = Math.floor(parseInt(data.TotalPracticeTime) / 60);
  const seconds = parseInt(data.TotalPracticeTime) % 60;
  
  container.innerHTML = `
    <div style="font-size: 11px;">
      <h3 style="margin: 0 0 12px 0; color: var(--win98-blue);">${dateStr}</h3>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <div><strong>練習時間:</strong> ${minutes} 分 ${seconds} 秒</div>
          <div><strong>完成題數:</strong> ${data.TotalSolved} 題</div>
        </div>
        <div>
          <div><strong>跳過題數:</strong> ${data.TotalSkipped} 題</div>
          <div><strong>總題數:</strong> ${parseInt(data.TotalSolved) + parseInt(data.TotalSkipped)} 題</div>
        </div>
      </div>
      
      ${data.Note ? `
        <hr style="margin: 12px 0;">
        <div>
          <strong>筆記:</strong>
          <div style="background: #ffffcc; padding: 8px; margin-top: 4px; font-size: 10px;">
            ${data.Note}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// 顯示本月統計
function displayMonthStats(year, month) {
  // 篩選該月的資料
  const monthLogs = dataManager.hobbitLog.filter(log => {
    const date = new Date(log.Date);
    return date.getFullYear() === year && date.getMonth() + 1 === month;
  });
  
  if (monthLogs.length === 0) {
    document.getElementById('monthDays').textContent = '0';
    document.getElementById('monthTotal').textContent = '0';
    document.getElementById('monthTime').textContent = '0';
    document.getElementById('monthAvg').textContent = '0';
    document.getElementById('monthStreak').textContent = '0';
    return;
  }
  
  // 練習天數
  const days = monthLogs.length;
  
  // 總題數
  const totalSolved = monthLogs.reduce((sum, log) => sum + parseInt(log.TotalSolved || 0), 0);
  const totalSkipped = monthLogs.reduce((sum, log) => sum + parseInt(log.TotalSkipped || 0), 0);
  const total = totalSolved + totalSkipped;
  
  // 總時間(分鐘)
  const totalTime = monthLogs.reduce((sum, log) => sum + parseInt(log.TotalPracticeTime || 0), 0);
  const totalMinutes = Math.floor(totalTime / 60);
  
  // 日均題數
  const avgPerDay = days > 0 ? Math.round(total / days) : 0;
  
  // 最長連續天數
  const streak = calculateLongestStreak(monthLogs, year, month);
  
  document.getElementById('monthDays').textContent = days;
  document.getElementById('monthTotal').textContent = total;
  document.getElementById('monthTime').textContent = totalMinutes;
  document.getElementById('monthAvg').textContent = avgPerDay;
  document.getElementById('monthStreak').textContent = streak;
}

// 計算最長連續天數
function calculateLongestStreak(logs, year, month) {
  if (logs.length === 0) return 0;
  
  // 排序日期
  const dates = logs.map(log => new Date(log.Date)).sort((a, b) => a - b);
  
  let maxStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < dates.length; i++) {
    const diffDays = Math.floor((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  return maxStreak;
}

// 綁定事件
function bindEvents() {
  // 月份選擇
  document.getElementById('monthSelect').addEventListener('change', (e) => {
    const [year, month] = e.target.value.split('-');
    currentYear = parseInt(year);
    currentMonth = parseInt(month);
    displayHeatmap(currentYear, currentMonth);
    displayMonthStats(currentYear, currentMonth);
  });
  
  // 上個月
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    updateMonthSelect();
    displayHeatmap(currentYear, currentMonth);
    displayMonthStats(currentYear, currentMonth);
  });
  
  // 下個月
  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    updateMonthSelect();
    displayHeatmap(currentYear, currentMonth);
    displayMonthStats(currentYear, currentMonth);
  });
  
  // 今天
  document.getElementById('todayBtn').addEventListener('click', () => {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth() + 1;
    updateMonthSelect();
    displayHeatmap(currentYear, currentMonth);
    displayMonthStats(currentYear, currentMonth);
  });
  
  // 返回
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'list.html';
  });
  
  // 統計
  document.getElementById('statsBtn').addEventListener('click', () => {
    window.location.href = 'summary.html';
  });
  
  // 匯出
  document.getElementById('exportBtn').addEventListener('click', () => {
    const csv = localStorage.getItem('hobbit_log') || '';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hobbit_log_${currentYear}_${currentMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// 更新月份選擇器
function updateMonthSelect() {
  const select = document.getElementById('monthSelect');
  const value = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
  
  // 如果選項不存在，添加它
  if (!Array.from(select.options).some(opt => opt.value === value)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `${currentYear}年 ${currentMonth}月`;
    
    // 插入到正確的位置(按時間倒序)
    const options = Array.from(select.options);
    let inserted = false;
    for (let i = 0; i < options.length; i++) {
      if (value > options[i].value) {
        select.insertBefore(option, options[i]);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      select.appendChild(option);
    }
  }
  
  select.value = value;
}

// 更新時間
function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false });
  document.getElementById('statusTime').textContent = timeStr;
}

// 啟動
init();
