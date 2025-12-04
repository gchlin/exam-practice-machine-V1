// utils.js - 通用工具函數

/**
 * 格式化時間 (秒 -> MM:SS)
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 取得當前日期字串 (YYYY-MM-DD)
 */
export function getCurrentDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * 取得當前時間戳
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * 生成 UUID (簡易版)
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * CSV 轉 JSON
 */
export function csvToJson(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^﻿/, '')); // 移除 BOM
  
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

/**
 * 解析 CSV 行 (處理引號內的逗號)
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * JSON 轉 CSV
 */
export function jsonToCsv(data, headers) {
  if (!data || data.length === 0) {
    return headers.join(',') + '\n';
  }
  
  const csvHeaders = headers || Object.keys(data[0]);
  const csvRows = data.map(row => {
    return csvHeaders.map(header => {
      const value = row[header] || '';
      // 如果包含逗號或引號，需要用引號包起來
      if (value.toString().includes(',') || value.toString().includes('"')) {
        return `"${value.toString().replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });
  
  return [csvHeaders.join(','), ...csvRows].join('\n');
}

/**
 * 下載文字檔案
 */
export function downloadFile(content, filename, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 顯示 Windows 98 風格對話框
 */
export function showDialog(title, message, buttons = ['OK']) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    
    dialog.innerHTML = `
      <div class="title-bar">
        <div class="title-bar-text">${title}</div>
      </div>
      <div class="dialog-body">
        <div class="dialog-icon">ℹ️</div>
        <div>${message}</div>
      </div>
      <div class="dialog-buttons">
        ${buttons.map(btn => `<button class="dialog-btn" data-value="${btn}">${btn}</button>`).join('')}
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 按鈕事件
    dialog.querySelectorAll('.dialog-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(btn.dataset.value);
      });
    });
  });
}

/**
 * 顯示確認對話框
 */
export function showConfirm(title, message) {
  return showDialog(title, message, ['是', '否']).then(result => result === '是');
}

/**
 * 洗牌演算法
 */
export function shuffle(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * 深拷貝
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 節流函數
 */
export function throttle(func, wait) {
  let timeout;
  let previous = 0;
  
  return function(...args) {
    const now = Date.now();
    const remaining = wait - (now - previous);
    
    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(this, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * 防抖函數
 */
export function debounce(func, wait) {
  let timeout;
  
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * 取得圖片檔名 (從路徑中提取)
 */
export function getImageFilename(path) {
  if (!path) return '';
  return path.split('/').pop();
}

/**
 * 檢查檔案是否存在 (透過嘗試載入)
 */
export async function checkFileExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 計算平均值
 */
export function average(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * 計算中位數
 */
export function median(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * 格式化大數字 (加入千分位逗號)
 */
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 安全的 localStorage 操作
 */
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  
  clear() {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * 星星圖示 (pixel style)
 */
export function getStarIcon(filled = false) {
  return filled ? '★' : '☆';
}

/**
 * 難度轉文字
 */
export function difficultyToText(level) {
  const map = {
    1: '非常簡單',
    2: '簡單',
    3: '中等',
    4: '困難',
    5: '非常困難'
  };
  return map[level] || '未評分';
}

/**
 * 計算兩個日期之間的天數差
 */
export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
