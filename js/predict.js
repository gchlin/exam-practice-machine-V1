// predict.js - 預測難度頁面邏輯

import { dataManager } from './dataManager.js';
import { stateManager } from './stateManager.js';
import { showDialog, showConfirm, difficultyToText } from './utils.js';

let currentIndex = 0;
let questions = [];
let predictions = {};

// 初始化
async function init() {
  try {
    // 取得會話中的題目
    questions = stateManager.getSessionQuestions();
    
    if (questions.length === 0) {
      await showDialog('錯誤', '沒有需要預測的題目');
      window.location.href = 'list.html';
      return;
    }
    
    // 篩選出未預測的題目
    questions = questions.filter(q => !q.predictedDifficulty);
    
    if (questions.length === 0) {
      // 所有題目都已預測，直接開始練習
      window.location.href = 'practice.html';
      return;
    }
    
    console.log(`需要預測 ${questions.length} 題`);
    
    // 顯示第一題
    showQuestion(0);
    
    // 綁定事件
    bindEvents();
    
    // 更新時間
    updateTime();
    setInterval(updateTime, 1000);
    
  } catch (error) {
    console.error('初始化失敗:', error);
    await showDialog('錯誤', '初始化失敗，請重新載入');
    window.location.href = 'list.html';
  }
}

// 顯示題目
function showQuestion(index) {
  if (index < 0 || index >= questions.length) return;
  
  currentIndex = index;
  const question = questions[index];
  
  // 更新題號
  document.getElementById('currentNumber').textContent = index + 1;
  
  // 更新題目資訊
  document.getElementById('qYear').textContent = question.Year || '-';
  document.getElementById('qSchool').textContent = question.School || '-';
  document.getElementById('qChapter').textContent = question.Chapter || '-';
  
  // 更新題目圖片
  const img = document.getElementById('questionImage');
  img.src = question['Problem Image'] || '';
  img.alt = '題目圖片';
  
  // 更新進度
  updateProgress();
  
  // 重置星星評分
  const currentRating = predictions[question.Q_ID];
  updateStarRating(currentRating || 0);
  
  // 更新按鈕狀態
  document.getElementById('prevBtn').disabled = index === 0;
  document.getElementById('confirmBtn').disabled = !currentRating;
  
  // 更新狀態
  document.getElementById('statusText').textContent = `正在預測第 ${index + 1} 題`;
}

// 更新進度
function updateProgress() {
  const predicted = Object.keys(predictions).length;
  const total = questions.length;
  const percentage = total > 0 ? Math.round((predicted / total) * 100) : 0;
  
  document.getElementById('progressText').textContent = `${predicted} / ${total}`;
  document.getElementById('progressFill').style.width = `${percentage}%`;
}

// 更新星星評分顯示
function updateStarRating(rating) {
  const stars = document.querySelectorAll('.star');
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('filled');
    } else {
      star.classList.remove('filled');
    }
  });
  
  const ratingText = document.getElementById('ratingText');
  if (rating > 0) {
    ratingText.textContent = `已選擇: ${rating} 星 (${difficultyToText(rating)})`;
    ratingText.style.color = 'var(--win98-blue)';
  } else {
    ratingText.textContent = '請選擇難度';
    ratingText.style.color = 'var(--win98-black)';
  }
  
  // 更新確認按鈕
  document.getElementById('confirmBtn').disabled = rating === 0;
}

// 綁定事件
function bindEvents() {
  // 星星評分
  const stars = document.querySelectorAll('.star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const rating = parseInt(star.dataset.value);
      const question = questions[currentIndex];
      predictions[question.Q_ID] = rating;
      updateStarRating(rating);
      updateProgress();
    });
    
    star.addEventListener('mouseenter', () => {
      const hoverRating = parseInt(star.dataset.value);
      stars.forEach((s, index) => {
        if (index < hoverRating) {
          s.classList.add('hover');
        } else {
          s.classList.remove('hover');
        }
      });
    });
    
    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('hover'));
    });
  });
  
  // 確認並繼續
  document.getElementById('confirmBtn').addEventListener('click', () => {
    if (currentIndex < questions.length - 1) {
      showQuestion(currentIndex + 1);
    } else {
      finishPrediction();
    }
  });
  
  // 上一題
  document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentIndex > 0) {
      showQuestion(currentIndex - 1);
    }
  });
  
  // 跳過
  document.getElementById('skipBtn').addEventListener('click', () => {
    const question = questions[currentIndex];
    predictions[question.Q_ID] = 3; // 預設3星
    updateStarRating(3);
    updateProgress();
    
    if (currentIndex < questions.length - 1) {
      showQuestion(currentIndex + 1);
    } else {
      finishPrediction();
    }
  });
  
  // 自動填入
  document.getElementById('autoFillBtn').addEventListener('click', async () => {
    const confirm = await showConfirm('確認', '是否將所有未評分的題目自動填入 3 星 (中等難度)?');
    if (confirm) {
      questions.forEach(q => {
        if (!predictions[q.Q_ID]) {
          predictions[q.Q_ID] = 3;
        }
      });
      updateProgress();
      updateStarRating(predictions[questions[currentIndex].Q_ID] || 0);
    }
  });
  
  // 完成預測
  document.getElementById('finishBtn').addEventListener('click', finishPrediction);
  
  // 圖片點擊放大
  document.getElementById('questionImage').addEventListener('click', (e) => {
    e.target.classList.toggle('zoomed');
  });
}

// 完成預測
async function finishPrediction() {
  // 檢查是否所有題目都已預測
  const unpredicted = questions.filter(q => !predictions[q.Q_ID]);
  
  if (unpredicted.length > 0) {
    const confirm = await showConfirm(
      '未完成', 
      `還有 ${unpredicted.length} 題未預測，是否直接完成? (未預測的題目將自動填入 3 星)`
    );
    
    if (confirm) {
      // 自動填入3星
      unpredicted.forEach(q => {
        predictions[q.Q_ID] = 3;
      });
    } else {
      return;
    }
  }
  
  // 儲存預測結果
  const sessionId = stateManager.currentSession.id;
  Object.entries(predictions).forEach(([qId, rating]) => {
    dataManager.setPredictedDifficulty(qId, rating, sessionId);
  });
  
  await dataManager.savePredictLog(sessionId);
  
  await showDialog('完成', `已完成 ${Object.keys(predictions).length} 題的難度預測！`);
  
  // 前往練習頁面
  window.location.href = 'practice.html';
}

// 更新時間
function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false });
  document.getElementById('statusTime').textContent = timeStr;
}

// 鍵盤快捷鍵
document.addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '5') {
    const rating = parseInt(e.key);
    const question = questions[currentIndex];
    predictions[question.Q_ID] = rating;
    updateStarRating(rating);
    updateProgress();
  } else if (e.key === 'ArrowLeft') {
    document.getElementById('prevBtn').click();
  } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
    if (!document.getElementById('confirmBtn').disabled) {
      document.getElementById('confirmBtn').click();
    }
  } else if (e.key === 's' || e.key === 'S') {
    document.getElementById('skipBtn').click();
  }
});

// 啟動
init();
