// practice.js - 練習頁面邏輯

import { dataManager } from './dataManager.js';
import { stateManager } from './stateManager.js';
import { showDialog, showConfirm, formatTime, getCurrentDate, getStarIcon } from './utils.js';

let currentQuestion = null;
let questionStartTime = 0;
let timerInterval = null;
let isPaused = false;
let currentDifficulty = 0;
let currentNote = '';
let hasAnswered = false;

// 初始化
async function init() {
  try {
    // 檢查會話
    if (!stateManager.currentSession.id) {
      await showDialog('錯誤', '沒有進行中的練習會話');
      window.location.href = 'list.html';
      return;
    }
    
    // 載入當前題目
    currentQuestion = stateManager.getCurrentQuestion();
    
    if (!currentQuestion) {
      // 已完成所有題目
      await showDialog('完成', '所有題目已完成！');
      window.location.href = 'summary.html';
      return;
    }
    
    // 顯示題目
    showQuestion();
    
    // 啟動計時器
    startTimer();
    
    // 綁定事件
    bindEvents();
    
    // 更新時間
    updateTime();
    setInterval(updateTime, 1000);
    
    // 自動儲存會話狀態
    setInterval(() => {
      stateManager.saveSession();
    }, 30000); // 每30秒儲存一次
    
  } catch (error) {
    console.error('初始化失敗:', error);
    await showDialog('錯誤', '初始化失敗，請重新載入');
    window.location.href = 'list.html';
  }
}

// 顯示題目
function showQuestion() {
  if (!currentQuestion) return;
  
  hasAnswered = false;
  currentDifficulty = 0;
  currentNote = '';
  
  // 重置計時器
  resetTimer();
  
  // 更新題號
  const progress = stateManager.getProgress();
  document.getElementById('questionNumber').textContent = `${progress.current} / ${progress.total}`;
  
  // 更新來源
  document.getElementById('questionSource').textContent = 
    `${currentQuestion.Year} ${currentQuestion.School}`;
  
  // 更新題目資訊
  document.getElementById('questionChapter').textContent = currentQuestion.Chapter || '-';
  document.getElementById('questionDifficulty').textContent = currentQuestion.Difficulty || '-';
  
  const predicted = currentQuestion.predictedDifficulty;
  if (predicted) {
    document.getElementById('questionPredicted').innerHTML = 
      getStarIcon(true).repeat(predicted) + getStarIcon(false).repeat(5 - predicted);
  } else {
    document.getElementById('questionPredicted').textContent = '未預測';
  }
  
  // 更新題目圖片
  const questionImg = document.getElementById('questionImage');
  questionImg.src = currentQuestion['Problem Image'] || '';
  
  // 更新答案圖片
  const answerImg = document.getElementById('answerImage');
  answerImg.src = currentQuestion['Answer Image'] || '';
  
  // 更新詳解圖片和按鈕狀態
  const solutionPath = currentQuestion['Solution Image'];
  const showSolutionBtn = document.getElementById('showSolutionBtn');
  
  if (solutionPath) {
    document.getElementById('solutionImage').src = solutionPath;
    showSolutionBtn.disabled = false;
  } else {
    showSolutionBtn.disabled = true;
  }
  
  // 隱藏答案和詳解
  document.getElementById('answerSection').classList.add('hidden');
  document.getElementById('solutionSection').classList.add('hidden');
  document.getElementById('notesFieldset').classList.add('hidden');
  
  // 重置難度評分
  updateDifficultyRating(0);
  
  // 更新按鈕狀態
  const currentIndex = stateManager.getCurrentIndex();
  document.getElementById('prevQuestionBtn').disabled = currentIndex === 0;
  
  // 更新完成計數
  updateCompletedCount();
  
  // 更新狀態
  document.getElementById('statusText').textContent = 
    `正在練習第 ${progress.current} 題`;
  
  // 檢查是否暫停
  if (isPaused) {
    togglePause();
  }
}

// 啟動計時器
function startTimer() {
  questionStartTime = Date.now();
  
  timerInterval = setInterval(() => {
    if (!isPaused) {
      const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
      document.getElementById('timer').textContent = formatTime(elapsed);
    }
  }, 1000);
}

// 重置計時器
function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  questionStartTime = Date.now();
  document.getElementById('timer').textContent = '00:00';
  startTimer();
}

// 暫停/繼續
function togglePause() {
  isPaused = !isPaused;
  const pauseBtn = document.getElementById('pauseBtn');
  
  if (isPaused) {
    pauseBtn.innerHTML = '<span>▶</span> 繼續';
    document.getElementById('statusText').textContent = '已暫停';
  } else {
    pauseBtn.innerHTML = '<span>⏸</span> 暫停';
    document.getElementById('statusText').textContent = '練習中';
    // 重新計算開始時間
    const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
    questionStartTime = Date.now() - (elapsed * 1000);
  }
}

// 更新難度評分
function updateDifficultyRating(rating) {
  currentDifficulty = rating;
  
  const stars = document.querySelectorAll('#difficultyRating .star');
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('filled');
    } else {
      star.classList.remove('filled');
    }
  });
  
  const difficultyText = document.getElementById('difficultyText');
  if (rating > 0) {
    const labels = ['', '非常簡單', '簡單', '中等', '困難', '非常困難'];
    difficultyText.textContent = labels[rating];
  } else {
    difficultyText.textContent = '未評分';
  }
}

// 記錄答題結果
async function recordAnswer(result) {
  if (hasAnswered) {
    const confirm = await showConfirm('提示', '此題已作答，是否要修改答案?');
    if (!confirm) return;
  }
  
  const timeSeconds = Math.floor((Date.now() - questionStartTime) / 1000);
  const difficulty = currentDifficulty || 3; // 如果未評分，預設3星
  
  // 記錄到會話
  stateManager.recordResult(result, timeSeconds, difficulty, currentNote);
  
  // 儲存到資料庫
  const record = {
    Q_ID: currentQuestion.Q_ID,
    SolutionPath: currentQuestion['Solution Image'] || '',
    Date: getCurrentDate(),
    TimeSeconds: timeSeconds,
    Difficulty: difficulty,
    Note: currentNote,
    Result: result
  };
  
  await dataManager.savePracticeLog(record);
  
  hasAnswered = true;
  
  // 提示
  const resultText = {
    'Correct': '正確 ✓',
    'Incorrect': '錯誤 ✗',
    'Skipped': '已跳過 ⊘'
  };
  
  document.getElementById('statusText').textContent = resultText[result];
  
  // 自動前往下一題 (延遲1秒)
  setTimeout(() => {
    nextQuestion();
  }, 1000);
}

// 下一題
function nextQuestion() {
  const next = stateManager.nextQuestion();
  
  if (next) {
    currentQuestion = next;
    showQuestion();
  } else {
    // 完成所有題目
    finishPractice();
  }
}

// 上一題
function previousQuestion() {
  const prev = stateManager.previousQuestion();
  
  if (prev) {
    currentQuestion = prev;
    showQuestion();
  }
}

// 完成練習
async function finishPractice() {
  const confirm = await showConfirm('完成練習', '確定要完成本次練習嗎?');
  
  if (confirm) {
    // 更新每日統計
    const summary = stateManager.getSessionSummary();
    await dataManager.updateHobbitLog(
      summary.correctCount + summary.incorrectCount,
      summary.skippedCount,
      summary.totalTime
    );
    
    // 清除會話
    stateManager.clearSession();
    
    // 前往統計頁面
    window.location.href = 'summary.html';
  }
}

// 更新完成計數
function updateCompletedCount() {
  const summary = stateManager.getSessionSummary();
  document.getElementById('completedCount').textContent = summary.completedQuestions;
}

// 綁定事件
function bindEvents() {
  // 答題按鈕
  document.getElementById('correctBtn').addEventListener('click', () => {
    recordAnswer('Correct');
  });
  
  document.getElementById('incorrectBtn').addEventListener('click', () => {
    recordAnswer('Incorrect');
  });
  
  document.getElementById('skipBtn').addEventListener('click', () => {
    recordAnswer('Skipped');
  });
  
  // 難度評分
  const stars = document.querySelectorAll('#difficultyRating .star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const rating = parseInt(star.dataset.value);
      updateDifficultyRating(rating);
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
  
  // 導航按鈕
  document.getElementById('nextQuestionBtn').addEventListener('click', nextQuestion);
  document.getElementById('prevQuestionBtn').addEventListener('click', previousQuestion);
  document.getElementById('pauseBtn').addEventListener('click', togglePause);
  
  // 顯示答案
  document.getElementById('showAnswerBtn').addEventListener('click', () => {
    const answerSection = document.getElementById('answerSection');
    answerSection.classList.toggle('hidden');
  });
  
  document.getElementById('hideAnswerBtn').addEventListener('click', () => {
    document.getElementById('answerSection').classList.add('hidden');
  });
  
  // 顯示詳解
  document.getElementById('showSolutionBtn').addEventListener('click', () => {
    const solutionSection = document.getElementById('solutionSection');
    solutionSection.classList.toggle('hidden');
  });
  
  document.getElementById('hideSolutionBtn').addEventListener('click', () => {
    document.getElementById('solutionSection').classList.add('hidden');
  });
  
  // 筆記
  document.getElementById('toggleNotesBtn').addEventListener('click', () => {
    const notesFieldset = document.getElementById('notesFieldset');
    notesFieldset.classList.toggle('hidden');
  });
  
  document.getElementById('saveNoteBtn').addEventListener('click', () => {
    currentNote = document.getElementById('notesText').value;
    showDialog('提示', '筆記已儲存（將在答題後一併記錄）');
  });
  
  // 完成按鈕
  document.getElementById('finishBtn').addEventListener('click', finishPractice);
  
  // 關閉按鈕
  document.getElementById('closeBtn').addEventListener('click', async () => {
    const confirm = await showConfirm('確認', '是否要離開練習? (進度將會儲存)');
    if (confirm) {
      stateManager.saveSession();
      window.location.href = 'list.html';
    }
  });
  
  // 圖片點擊放大
  document.getElementById('questionImage').addEventListener('click', (e) => {
    e.target.classList.toggle('zoomed');
  });
  
  document.getElementById('answerImage').addEventListener('click', (e) => {
    e.target.classList.toggle('zoomed');
  });
  
  document.getElementById('solutionImage').addEventListener('click', (e) => {
    e.target.classList.toggle('zoomed');
  });
  
  // 鍵盤快捷鍵
  document.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      document.getElementById('correctBtn').click();
    } else if (e.key === 'x' || e.key === 'X') {
      document.getElementById('incorrectBtn').click();
    } else if (e.key === 's' || e.key === 'S') {
      document.getElementById('skipBtn').click();
    } else if (e.key === 'a' || e.key === 'A') {
      document.getElementById('showAnswerBtn').click();
    } else if (e.key === 'ArrowLeft') {
      if (!document.getElementById('prevQuestionBtn').disabled) {
        previousQuestion();
      }
    } else if (e.key === 'ArrowRight') {
      nextQuestion();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePause();
    } else if (e.key >= '1' && e.key <= '5') {
      updateDifficultyRating(parseInt(e.key));
    }
  });
}

// 更新時間
function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false });
  document.getElementById('statusTime').textContent = timeStr;
}

// 頁面離開前儲存
window.addEventListener('beforeunload', (e) => {
  stateManager.saveSession();
});

// 啟動
init();
