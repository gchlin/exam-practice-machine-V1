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
let currentLogDate = null;

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
let isBrowseMode = false;        // 瀏覽模式旗標
let isMobileBrowse = false;      // 手機瀏覽模式
let mobileBrowseQuestions = [];
let mobileBrowseIndex = 0;
let mobileBrowseTimes = {};
let mobileQuestionStartTime = null;

// 快取：每題狀態與每日統計
let statusMap = {};
let dailyStats = {};

// 未完成會話
let unfinishedSession = null;
let questionBankMeta = { version: 'unknown', hash: 'unknown' };
let lastQuestionCount = 0;

const APP_VERSION = '2.0';
const DATA_VERSION = '1.0';

// ==================== Supabase Auth 設定 ====================
const SUPABASE_URL = window.SUPABASE_URL || 'https://hnnpdkzanxxsoyvarcrk.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_qM_ImDglw0twPIXJiRcExg_M4zrsSpm';
let supabaseClient = null;
let currentUser = null;
let authInitFailed = false;
let isSyncing = false;
let enableBackgroundSync = window.DEFAULT_ENABLE_BACKGROUND_SYNC === true;
let pendingBackgroundSync = false;
let syncRetryCount = 0;
const SYNC_RETRY_DELAYS = [60 * 1000, 5 * 60 * 1000, 5 * 60 * 1000]; // 1m,5m,5m

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  console.log('刷題機 V2.0 啟動...');
  
  // 初始化登入/註冊（Supabase Auth）
  initAuth();
  getDeviceId(); // 確保每個裝置有唯一 ID
  
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
  const btnToggleAdvanced = document.getElementById('btn-toggle-advanced');
  if (btnToggleAdvanced) {
    btnToggleAdvanced.addEventListener('click', toggleAdvancedFilters);
  }
  
  // 全選
  document.getElementById('chk-all').addEventListener('change', toggleSelectAll);
  
  // 隨機模式切換
  const randomModeSelect = document.getElementById('random-mode');
  if (randomModeSelect) randomModeSelect.addEventListener('change', updateRandomOptions);
  
  // 隨機3題
  document.getElementById('btn-random-3').addEventListener('click', startRandom3);
  
  // 開始練習選中題目
  document.getElementById('btn-start-selected').addEventListener('click', startSelectedPractice);
  // 瀏覽模式
  document.getElementById('btn-start-browse').addEventListener('click', startBrowseMode);
  // 手機瀏覽模式
  document.getElementById('btn-start-mobile-browse').addEventListener('click', startMobileBrowseMode);
  // 檢視練習紀錄
  document.getElementById('btn-view-log').addEventListener('click', () => {
    renderLogPage();
    showPage('log');
  });
  
  // 顯示/隱藏欄位
  document.getElementById('show-image').addEventListener('change', toggleImageColumn);
  document.getElementById('show-text').addEventListener('change', toggleTextColumn);
  const showSchoolCheckbox = document.getElementById('show-school');
  if (showSchoolCheckbox) showSchoolCheckbox.addEventListener('change', renderQuestionList);
  
  // 雲端同步
  document.getElementById('btn-sync-cloud').addEventListener('click', () => syncToSupabase(true));
  
  // 重新載入題庫
  document.getElementById('btn-reload-questions').addEventListener('click', reloadQuestions);
  
  // 匯出/匯入紀錄
  document.getElementById('btn-export-logs').addEventListener('click', exportLogs);
  document.getElementById('btn-import-logs').addEventListener('click', importLogs);
  const btnShowStats = document.getElementById('btn-show-stats');
  if (btnShowStats) btnShowStats.addEventListener('click', showStatsAnalysis);
  
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
  const btnExportPdf = document.getElementById('btn-export-pdf');
  if (btnExportPdf) btnExportPdf.addEventListener('click', () => {
    if (typeof openExportModal === 'function') {
      openExportModal();
    } else {
      showMessage('錯誤', '匯出模組未載入，請重新整理或檢查 export.js 載入順序。');
    }
  });
  const btnExportConfirm = document.getElementById('btn-export-confirm');
  if (btnExportConfirm) btnExportConfirm.addEventListener('click', () => {
    if (typeof startExportPDF === 'function') {
      startExportPDF();
    } else {
      showMessage('錯誤', '匯出模組未載入，請重新整理或檢查 export.js 載入順序。');
    }
  });
  // 手機瀏覽頁
  const mbPrevBtn = document.getElementById('mb-prev');
  const mbNextBtn = document.getElementById('mb-next');
  if (mbPrevBtn) mbPrevBtn.addEventListener('click', mbPrev);
  if (mbNextBtn) mbNextBtn.addEventListener('click', mbNext);
  document.querySelectorAll('.mb-star').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = parseInt(btn.dataset.value, 10);
      logMobileBrowseRating(v);
    });
  });
  
  // Summary
  document.getElementById('btn-summary-back').addEventListener('click', () => {
    showPage('list');
    initListPage();
  });
  const btnLogBack = document.getElementById('btn-log-back');
  if (btnLogBack) {
    btnLogBack.addEventListener('click', () => showPage('list'));
  }
  const btnLogReplay = document.getElementById('btn-log-replay');
  if (btnLogReplay) {
    btnLogReplay.addEventListener('click', redoLogQuestions);
  }
  
  // 鍵盤快捷鍵
  document.addEventListener('keydown', handleKeyboard);

  // 手機模式初始化
  initMobileMode();
}

// ==================== 登入 / 註冊 (Supabase Auth) ====================

function initAuth() {
  const emailInput = document.getElementById('auth-email');
  const pwdInput = document.getElementById('auth-password');
  const signUpBtn = document.getElementById('btn-signup');
  const signInBtn = document.getElementById('btn-signin');
  const signOutBtn = document.getElementById('btn-signout');
  const bgSyncToggle = document.getElementById('toggle-bg-sync');

  // 若畫面沒有 auth 元件則略過
  if (!emailInput || !pwdInput || !signUpBtn || !signInBtn || !signOutBtn) {
    console.warn('Auth UI not found, skipping initAuth');
    return;
  }

  // 未設定 Supabase 時提醒，但不阻斷其他功能
  if (!window.supabase) {
    setAuthStatus('Supabase SDK 未載入', true);
    authInitFailed = true;
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR-PROJECT') || SUPABASE_ANON_KEY === 'YOUR_ANON_KEY') {
    setAuthStatus('請填 Supabase URL / Anon Key', true);
    authInitFailed = true;
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  setAuthStatus('未登入', false);
  updateAuthUI(null);

  signUpBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = pwdInput.value.trim();
    if (!email || !password) {
      setAuthStatus('請輸入 Email / 密碼', true);
      return;
    }
    setAuthBusy(true);
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      setAuthStatus(error.message, true);
    } else {
      setAuthStatus('註冊成功，請查收驗證信或直接登入', false);
    }
    setAuthBusy(false);
  });

  signInBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = pwdInput.value.trim();
    if (!email || !password) {
      setAuthStatus('請輸入 Email / 密碼', true);
      return;
    }
    setAuthBusy(true);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthStatus(error.message, true);
    } else {
      setAuthStatus('登入成功', false);
    }
    setAuthBusy(false);
  });

  signOutBtn.addEventListener('click', async () => {
    setAuthBusy(true);
    await supabaseClient.auth.signOut();
    setAuthBusy(false);
  });

  if (bgSyncToggle) {
    bgSyncToggle.checked = enableBackgroundSync;
    bgSyncToggle.addEventListener('change', () => {
      enableBackgroundSync = bgSyncToggle.checked;
      saveToLocalStorage();
    });
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateAuthUI(currentUser);
    if (!currentUser) {
      setAuthStatus('未登入', false);
      return;
    }
    setAuthStatus(`已登入：${currentUser.email || ''}`, false);
    // 靜默觸發雲端同步
    syncToSupabase(false);
  });
}

function setAuthStatus(text, isError = false) {
  const el = document.getElementById('auth-status');
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? 'red' : '#333';
}

function updateAuthUI(user) {
  const signInBtn = document.getElementById('btn-signin');
  const signUpBtn = document.getElementById('btn-signup');
  const signOutBtn = document.getElementById('btn-signout');
  const emailInput = document.getElementById('auth-email');
  const pwdInput = document.getElementById('auth-password');
  const bgSyncToggle = document.getElementById('toggle-bg-sync');
  const loggedIn = !!user;

  if (signInBtn) signInBtn.style.display = loggedIn ? 'none' : 'inline-block';
  if (signUpBtn) signUpBtn.style.display = loggedIn ? 'none' : 'inline-block';
  if (signOutBtn) signOutBtn.style.display = loggedIn ? 'inline-block' : 'none';
  if (emailInput) emailInput.disabled = loggedIn;
  if (pwdInput) pwdInput.disabled = loggedIn;
  if (bgSyncToggle) {
    bgSyncToggle.checked = enableBackgroundSync;
    bgSyncToggle.disabled = false;
  }
}

function setAuthBusy(isBusy) {
  ['btn-signup', 'btn-signin', 'btn-signout', 'auth-email', 'auth-password'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = isBusy;
  });
  if (isBusy) {
    setAuthStatus('處理中...', false);
  }
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
    localStorage.setItem('statusMap', JSON.stringify(statusMap));
    localStorage.setItem('dailyStats', JSON.stringify(dailyStats));
    localStorage.setItem('predictedDifficulties', JSON.stringify(predictedDifficulties));
    localStorage.setItem('questionTimes', JSON.stringify(questionTimes));
    localStorage.setItem('mobileBrowseTimes', JSON.stringify(mobileBrowseTimes));
    localStorage.setItem('questionBankMeta', JSON.stringify(questionBankMeta));
    localStorage.setItem('enableBackgroundSync', JSON.stringify(enableBackgroundSync));
    console.log('localStorage saved');
  } catch (e) {
    console.error('save failed:', e);
    showMessage('Error', 'Save failed, storage may be full or blocked by the browser');
  }
}


function loadFromLocalStorage() {
  try {
    const q = localStorage.getItem('questions');
    const p = localStorage.getItem('practiceLog');
    const pr = localStorage.getItem('predictLog');
    const h = localStorage.getItem('hobbitLog');
    const u = localStorage.getItem('unfinishedSession');
    const s = localStorage.getItem('statusMap');
    const d = localStorage.getItem('dailyStats');
    const pd = localStorage.getItem('predictedDifficulties');
    const qt = localStorage.getItem('questionTimes');
    const mbt = localStorage.getItem('mobileBrowseTimes');
    const qb = localStorage.getItem('questionBankMeta');
    const bs = localStorage.getItem('enableBackgroundSync');

    if (q) allQuestions = JSON.parse(q);
    if (p) practiceLog = JSON.parse(p);
    if (pr) predictLog = JSON.parse(pr);
    if (h) hobbitLog = JSON.parse(h);
    if (u) unfinishedSession = JSON.parse(u);
    if (s) statusMap = JSON.parse(s);
    if (d) dailyStats = JSON.parse(d);
    if (pd) predictedDifficulties = JSON.parse(pd);
    if (qt) questionTimes = JSON.parse(qt);
    if (mbt) mobileBrowseTimes = JSON.parse(mbt);
    if (qb) questionBankMeta = JSON.parse(qb);
    if (bs !== null) enableBackgroundSync = JSON.parse(bs);

    if (!Array.isArray(allQuestions)) allQuestions = [];
    if (!Array.isArray(practiceLog)) practiceLog = [];
    if (!Array.isArray(predictLog)) predictLog = [];
    if (!Array.isArray(hobbitLog)) hobbitLog = [];
    if (!unfinishedSession) unfinishedSession = null;
    if (!statusMap || typeof statusMap !== 'object') statusMap = {};
    if (!dailyStats || typeof dailyStats !== 'object') dailyStats = {};

    // Rebuild caches from practiceLog to stay compatible with old data
    rebuildCachesFromLogs();

    console.log(`Loaded ${allQuestions.length} questions`);
  } catch (e) {
    console.error('load failed:', e);
  }
}

function rebuildCachesFromLogs() {
  statusMap = {};
  dailyStats = {};

  if (!Array.isArray(practiceLog)) {
    practiceLog = [];
    return;
  }

  practiceLog.forEach(log => {
    updateCachesWithLog(log);
  });
}

// ==================== 同步輔助 ====================

function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem('deviceId', id);
  }
  return id;
}

function getQuestionBankMeta() {
  if (!questionBankMeta || !questionBankMeta.hash) {
    questionBankMeta = {
      version: questionBankMeta?.version || 'unknown',
      hash: questionBankMeta?.hash || `count-${allQuestions.length || 0}`,
      count: allQuestions.length || 0
    };
  }
  return questionBankMeta;
}

function setQuestionBankMeta(meta) {
  questionBankMeta = meta || { version: 'unknown', hash: 'unknown', count: allQuestions.length || 0 };
  localStorage.setItem('questionBankMeta', JSON.stringify(questionBankMeta));
}

async function computeQuestionBankHash(text) {
  if (!text) return `count-${allQuestions.length || 0}`;
  try {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.warn('hash failed, fallback to length', e);
    return `len-${text.length}`;
  }
}

function stampLogForSync(log) {
  if (!log) return log;
  const now = Date.now();
  log.client_updated_at = log.client_updated_at || now;
  log.updated_at = log.client_updated_at;
  log.device_id = log.device_id || getDeviceId();
  const meta = getQuestionBankMeta();
  log.question_bank_hash = log.question_bank_hash || meta.hash;
  log.question_bank_version = log.question_bank_version || meta.version;
  log.app_version = log.app_version || APP_VERSION;
  log.data_version = log.data_version || DATA_VERSION;
  return log;
}

function generateUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fallback 簡易 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function chunkArray(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

// ==================== Supabase 同步核心 ====================

async function syncToSupabase(manual = false) {
  if (!supabaseClient || !currentUser) {
    if (manual) showMessage('請先登入', '請先登入後再同步。');
    return;
  }
  if (isSyncing) {
    if (manual) showMessage('同步中', '背景同步進行中，請稍候。');
    return;
  }
  isSyncing = true;
  try {
    await runSupabaseSync();
    if (manual) showMessage('完成', '同步完成（雲端已更新）。');
    pendingBackgroundSync = false;
    syncRetryCount = 0;
  } catch (error) {
    console.error('同步失敗:', error);
    if (manual) showMessage('同步失敗', error.message || '請稍後再試');
    else scheduleSyncRetry();
  } finally {
    isSyncing = false;
  }
}

async function runSupabaseSync() {
  const meta = getQuestionBankMeta();
  const validQIDs = new Set(allQuestions.map(q => getQID(q)));
  const currentCount = allQuestions.length || 0;
  const prevCount = questionBankMeta.lastCount || currentCount;

  const { data: remoteLogs = [], error: logErr } = await supabaseClient
    .from('practice_logs')
    .select('*')
    .eq('user_id', currentUser.id);
  if (logErr) throw logErr;

  const localRows = buildLocalLogRows(meta, validQIDs);

  // 題數驟減檢查
  if (prevCount - currentCount > 50) {
    const missingLocal = localRows.filter(r => !validQIDs.has(r.qid));
    const missingRemote = (remoteLogs || []).filter(r => !validQIDs.has(r.qid));
    const missing = [...missingLocal, ...missingRemote];
    if (missing.length > 0) {
      exportMissingLogs(missing);
      throw new Error(`題庫數量異常，少了 ${prevCount - currentCount} 題，已匯出 ${missing.length} 筆缺失紀錄，請確認後再同步。`);
    } else {
      throw new Error(`題庫數量異常，少了 ${prevCount - currentCount} 題，已停止同步。`);
    }
  }

  const mergedRows = mergeRowsLww(localRows, remoteLogs, validQIDs);

  if (mergedRows.length > 0) {
    const chunks = chunkArray(mergedRows, 100);
    for (const chunk of chunks) {
      const { error: upsertErr } = await supabaseClient
        .from('practice_logs')
        .upsert(chunk, { onConflict: 'id' });
      if (upsertErr) {
        if (String(upsertErr.message || '').includes('practice_logs_pkey')) {
          const { error: delErr } = await supabaseClient.from('practice_logs').delete().eq('user_id', currentUser.id);
          if (delErr) throw delErr;
          const { error: insErr } = await supabaseClient.from('practice_logs').insert(chunk);
          if (insErr) throw insErr;
        } else {
          throw upsertErr;
        }
      }
    }
  }

  const { data: remoteStateArr = [], error: stateErr } = await supabaseClient
    .from('session_state')
    .select('*')
    .eq('user_id', currentUser.id);
  if (stateErr) throw stateErr;
  const remoteState = remoteStateArr[0] || null;
  const localState = buildLocalSessionRow(meta, validQIDs);
  const mergedState = mergeStateLww(localState, remoteState);

  if (mergedState) {
    // upsert 以避免 PK 衝突
    mergedState.user_id = currentUser.id;
    const { error: upsertErr } = await supabaseClient
      .from('session_state')
      .upsert(mergedState, { onConflict: 'user_id' });
    if (upsertErr) throw upsertErr;
  } else {
    // 沒有資料時刪除
    const { error: delStateErr } = await supabaseClient.from('session_state').delete().eq('user_id', currentUser.id);
    if (delStateErr) throw delStateErr;
  }

  practiceLog = mergedRows.map(rowToAppLog);
  rebuildCachesFromLogs();
  unfinishedSession = mergedState ? mergedState.payload : null;
  questionBankMeta.lastCount = currentCount;
  saveToLocalStorage();
}

function buildLocalLogRows(meta, validQIDs) {
  return practiceLog
    .map(log => normalizeLogRow(log, meta, validQIDs))
    .filter(Boolean);
}

function normalizeLogRow(log, meta, validQIDs) {
  const qid = log.Q_ID || log.qid || log.ExamID || log['題目ID'] || '';
  if (!qid) return null;
  if (validQIDs && validQIDs.size > 0 && !validQIDs.has(qid)) return null;

  stampLogForSync(log);
  const updatedMs = log.updated_at || log.client_updated_at || Date.now();

  const row = {
    user_id: currentUser.id,
    qid,
    result: log.Result || log.result || null,
    time_spent: Number(log.TimeSeconds || log.time_spent || 0),
    difficulty: Number(log.ActualDifficulty || log.difficulty || 0),
    predicted_difficulty: Number(log.PredictedDifficulty || log.predicted_difficulty || 0),
    note: log.Note || log.Notes || log.note || null,
    practiced_at: log.EndAt || log.practiced_at || new Date().toISOString(),
    question_bank_version: meta.version,
    question_bank_hash: meta.hash,
    app_version: APP_VERSION,
    data_version: DATA_VERSION,
    updated_at: new Date(updatedMs).toISOString()
  };

  const idVal = log.id || log.uuid || generateUUID();
  row.id = idVal;
  return row;
}

function mergeRowsLww(localRows, remoteRows, validQIDs) {
  const map = new Map();
  const addRow = (row) => {
    if (validQIDs && !validQIDs.has(row.qid)) return;
    const key = `${row.qid}`;
    const curr = map.get(key);
    const updated = row.updated_at ? Date.parse(row.updated_at) : 0;
    if (!curr || updated > curr.updated) {
      if (!row.id) row.id = generateUUID();
      map.set(key, { row, updated });
    }
  };

  (remoteRows || []).forEach(r => addRow(r));
  (localRows || []).forEach(r => addRow(r));

  return Array.from(map.values()).map(v => v.row);
}

function rowToAppLog(row) {
  const updatedMs = row.updated_at ? Date.parse(row.updated_at) : Date.now();
  const practicedDate = row.practiced_at ? new Date(row.practiced_at).toISOString().split('T')[0] : null;
  return {
    id: row.id || generateUUID(),
    Q_ID: row.qid,
    Result: row.result,
    TimeSeconds: row.time_spent || 0,
    PredictedDifficulty: row.predicted_difficulty || 0,
    ActualDifficulty: row.difficulty || 0,
    Note: row.note,
    Date: practicedDate,
    EndAt: row.practiced_at,
    Mode: row.mode || 'Practice',
    question_bank_hash: row.question_bank_hash,
    question_bank_version: row.question_bank_version,
    app_version: row.app_version,
    data_version: row.data_version,
    updated_at: updatedMs
  };
}

function exportMissingLogs(logs) {
  try {
    const data = {
      missing: logs,
      exportDate: new Date().toISOString(),
      version: APP_VERSION
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-logs-${formatDateForFilename(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('匯出缺失紀錄失敗', e);
  }
}

function buildLocalSessionRow(meta, validQIDs) {
  if (!unfinishedSession) return null;
  const payload = { ...unfinishedSession };
  if (Array.isArray(payload.questions) && validQIDs && validQIDs.size > 0) {
    payload.questions = payload.questions.filter(q => validQIDs.has(q));
  }
  const updatedMs = payload.updated_at || Date.now();
  return {
    user_id: currentUser.id,
    payload,
    question_bank_version: meta.version,
    question_bank_hash: meta.hash,
    app_version: APP_VERSION,
    data_version: DATA_VERSION,
    updated_at: new Date(updatedMs).toISOString()
  };
}

function mergeStateLww(localState, remoteState) {
  if (localState && !remoteState) return localState;
  if (!localState && remoteState) return remoteState;
  if (!localState && !remoteState) return null;
  const localMs = localState.updated_at ? Date.parse(localState.updated_at) : 0;
  const remoteMs = remoteState.updated_at ? Date.parse(remoteState.updated_at) : 0;
  return localMs >= remoteMs ? localState : remoteState;
}

// ==================== 背景同步與重試 ====================

function scheduleBackgroundSync() {
  if (!navigator.onLine) {
    pendingBackgroundSync = true;
    saveToLocalStorage();
    return;
  }
  if (isSyncing) return;
  syncRetryCount = 0;
  setTimeout(() => syncToSupabase(false), 30000); // debounce 30s
}

function scheduleSyncRetry() {
  if (syncRetryCount >= SYNC_RETRY_DELAYS.length) {
    pendingBackgroundSync = true;
    saveToLocalStorage();
    showMessage('同步失敗', '背景同步多次失敗，請檢查網路或手動按同步。');
    return;
  }
  const delay = SYNC_RETRY_DELAYS[syncRetryCount];
  syncRetryCount += 1;
  setTimeout(() => {
    if (navigator.onLine) {
      syncToSupabase(false);
    } else {
      pendingBackgroundSync = true;
      saveToLocalStorage();
    }
  }, delay);
}

function updateCachesWithLog(log) {
  if (!log || typeof log !== 'object') return;
  const qid = log.Q_ID || log.ExamID || log['題目ID'] || '';
  if (!qid) return;

  const dateStr = normalizeDate(log.Date);
  const result = log.Result || null;
  const entry = ensureStatusEntry(qid);

  entry.attemptCount += 1;
  entry.isPracticed = entry.attemptCount > 0;
  entry.lastResult = result || entry.lastResult;
  if (dateStr) {
    entry.lastResultDate = pickLatestDate(entry.lastResultDate, dateStr);
    if (result === 'Correct') {
      entry.lastCorrectDate = pickLatestDate(entry.lastCorrectDate, dateStr);
    } else if (result === 'Incorrect') {
      entry.lastWrongDate = pickLatestDate(entry.lastWrongDate, dateStr);
    }
  }
  if (result === 'Skipped') {
    entry.skipCount += 1;
  }
  if (log.Note) entry.lastNote = log.Note;
  if (Number(log.ActualDifficulty) > 0) entry.lastActualDifficulty = Number(log.ActualDifficulty);
  if (Number(log.PredictedDifficulty) > 0) entry.lastPredictedDifficulty = Number(log.PredictedDifficulty);

  if (dateStr) {
    const day = ensureDailyStats(dateStr);
    day.total += 1;
    if (result === 'Correct') day.correct += 1;
    else if (result === 'Incorrect') day.incorrect += 1;
    else if (result === 'Skipped') day.skipped += 1;
    else if (result === 'Browse') day.browse += 1;
    day.seconds += Math.max(0, Number(log.TimeSeconds) || 0);
    day.questionCount += 1;
  }
}

function ensureStatusEntry(qid) {
  if (!statusMap[qid]) {
    statusMap[qid] = {
      attemptCount: 0,
      skipCount: 0,
      lastResult: null,
      lastResultDate: null,
      lastCorrectDate: null,
      lastWrongDate: null,
      lastNote: '',
      lastActualDifficulty: 0,
      lastPredictedDifficulty: 0,
      isPracticed: false
    };
  }
  return statusMap[qid];
}

function ensureDailyStats(dateStr) {
  if (!dailyStats[dateStr]) {
    dailyStats[dateStr] = {
      total: 0,
      correct: 0,
      incorrect: 0,
      skipped: 0,
      browse: 0,
      seconds: 0,
      questionCount: 0
    };
  }
  return dailyStats[dateStr];
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function pickLatestDate(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  return prev.localeCompare(next) < 0 ? next : prev;
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
    let csvText = '';
    if (mode === 'online') {
      progressText.textContent = '正在下載題庫...';
      progressFill.style.width = '25%';
      const timestamp = new Date().getTime();
      const response = await fetch(`./data.csv?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('無法載入 data.csv');
      csvText = await response.text();
    } else {
      const fileInput = document.getElementById('file-input');
      if (!fileInput || !fileInput.files.length) {
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
    const hash = await computeQuestionBankHash(csvText);
    setQuestionBankMeta({
      version: 'data.csv',
      hash,
      count: allQuestions.length
    });
    progressText.textContent = '正在儲存資料...';
    progressFill.style.width = '75%';
    saveToLocalStorage();
    progressText.textContent = '載入完成';
    progressFill.style.width = '100%';
    setTimeout(() => {
      showPage('list');
      initListPage();
      showMessage('完成', `成功載入 ${allQuestions.length} 題。`);
    }, 500);
  } catch (error) {
    console.error('載入失敗:', error);
    progressContainer.style.display = 'none';
    if (location.protocol === 'file:') {
      showMessage('錯誤', '本機 file:// 無法直接抓取 data.csv，請選擇「本地檔案」模式並挑選 CSV，或啟動本地伺服器（如 python -m http.server 8000 後以 http://localhost:8000 開啟）。');
    } else {
      showMessage('錯誤', `載入失敗: ${error.message}`);
    }
  }
}


async function reloadQuestions() {
  if (!confirm('確定要重新載入題庫嗎？\n\n將清除快取並強制下載最新版本。\n（題目選取與狀態可能被清除）')) {
    return;
  }
  try {
    let csvText = '';
    const fileInput = document.getElementById('file-input');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      csvText = await fileInput.files[0].text();
    } else {
      const timestamp = new Date().getTime();
      const response = await fetch(`./data.csv?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('無法載入 data.csv');
      csvText = await response.text();
    }
    allQuestions = parseCSV(csvText);
    const hash = await computeQuestionBankHash(csvText);
    setQuestionBankMeta({
      version: 'data.csv',
      hash,
      count: allQuestions.length
    });
    saveToLocalStorage();
    initListPage();
    showMessage('成功', `題庫已更新。\n目前題數 ${allQuestions.length} 題`);
  } catch (error) {
    console.error('更新失敗:', error);
    if (location.protocol === 'file:') {
      showMessage('錯誤', '更新失敗：本機 file:// 無法直接抓取 data.csv。請改用「本地檔案」模式選擇 data.csv，或啟動本地伺服器（例如 python -m http.server 8000 後以 http://localhost:8000 開啟）。');
    } else {
      showMessage('錯誤', `更新失敗: ${error.message}\n\n請檢查：\n1. data.csv 是否存在\n2. 網路是否正常\n3. GitHub Pages 是否已部署`);
    }
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
  const schools = sortSchools([...new Set(allQuestions.map(q => q.School).filter(Boolean))]);
  const chapters = [...new Set(allQuestions.map(q => q.Chapter).filter(Boolean))].sort();
  const types = [...new Set(allQuestions.map(q => q['Question Type'] || '').filter(Boolean))].sort();
  
  populateSelect('filter-year', years);
  populateSelect('filter-school', schools);
  populateRecruitmentSelect();
  populateSelect('filter-chapter', chapters);
  if (document.getElementById('random-chapter')) {
    populateSelect('random-chapter', chapters);
  }
  populateTypeSelect('filter-type', types);
}

function sortSchools(list) {
  // Prefer stroke-count sorting; fall back to locale comparison if unavailable.
  try {
    const strokeCollator = new Intl.Collator('zh-u-co-stroke');
    return list.sort((a, b) => strokeCollator.compare(a, b));
  } catch (e) {
    return list.sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }
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

function populateTypeSelect(id, options) {
  const select = document.getElementById(id);
  const firstOption = select.querySelector('option');
  select.innerHTML = '';
  if (firstOption) select.appendChild(firstOption);

  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = getTypeLabel(opt);
    select.appendChild(option);
  });
}

function populateRecruitmentSelect() {
  const select = document.getElementById('filter-recruitment');
  if (!select) return;

  const firstOption = select.querySelector('option');
  select.innerHTML = '';
  if (firstOption) select.appendChild(firstOption);

  ['聯招', '獨招'].forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    select.appendChild(option);
  });
}

// ==================== 篩選功能 ====================

function applyFilters() {
  const chapter = document.getElementById('filter-chapter').value;
  const status = document.getElementById('filter-status').value;
  const year = document.getElementById('filter-year').value;
  const school = document.getElementById('filter-school').value;
  const recruitment = document.getElementById('filter-recruitment').value;
  const type = document.getElementById('filter-type').value;
  const lang = document.getElementById('filter-lang').value;
  const rating = document.getElementById('filter-rating').value;
  const search = document.getElementById('filter-search').value.toLowerCase();
  
  filteredQuestions = allQuestions.filter(q => {
    const qid = getQID(q);
    const entry = statusMap[qid];
    const attemptCount = entry ? entry.attemptCount : practiceLog.filter(log => log.Q_ID === qid).length;
    const lastResult = entry ? entry.lastResult : getLastResultFromLogs(qid);
    const statusBucket = attemptCount === 0
      ? 'never'
      : (lastResult === 'Correct' ? 'last-correct' : lastResult === 'Incorrect' ? 'last-wrong' : 'other');
    
    if (chapter && q.Chapter !== chapter) return false;

    if (status === 'last-correct' && statusBucket !== 'last-correct') return false;
    if (status === 'last-wrong' && statusBucket !== 'last-wrong') return false;
    if (status === 'never' && statusBucket !== 'never') return false;
    
    if (year && q.Year !== year) return false;
    if (school && q.School !== school) return false;
    if (recruitment && getRecruitmentType(q.School || '') !== recruitment) return false;
    if (type && (q['Question Type'] || '') !== type) return false;
    if (lang && getLanguage(q) !== lang) return false;
    
    if (rating) {
      const userRating = getUserDifficulty(qid);
      if (String(userRating) !== rating) return false;
    }
    
    // ??????
    if (search) {
      const extractedText = (q['Extracted Text'] || '').toLowerCase();
      const displayName = (q['Display Name'] || '').toLowerCase();
      const note = (getPreviousNote(qid) || '').toLowerCase();
      if (!extractedText.includes(search) && !displayName.includes(search) && !note.includes(search)) return false;
    }
    
    return true;
  });
  
  renderQuestionList();
}

function toggleAdvancedFilters() {
  const panel = document.getElementById('advanced-filters');
  const btn = document.getElementById('btn-toggle-advanced');
  if (!panel) return;
  const shouldShow = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = shouldShow ? '' : 'none';
  if (btn) {
    btn.textContent = shouldShow ? '基本篩選' : '進階篩選';
  }
}


function resetFilters() {
  document.getElementById('filter-year').value = '';
  document.getElementById('filter-school').value = '';
  document.getElementById('filter-recruitment').value = '';
  document.getElementById('filter-chapter').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-lang').value = '';
  document.getElementById('filter-rating').value = '';
  document.getElementById('filter-search').value = '';
  const adv = document.getElementById('advanced-filters');
  if (adv) adv.style.display = 'none';
  const btn = document.getElementById('btn-toggle-advanced');
  if (btn) btn.textContent = '進階篩選';
  
  applyFilters();
}

function renderQuestionList() {
  const tbody = document.getElementById('questions-tbody');
  tbody.innerHTML = '';
  
  const showImage = document.getElementById('show-image').checked;
  const showText = document.getElementById('show-text').checked;
  const showSchool = document.getElementById('show-school') ? document.getElementById('show-school').checked : true;
  
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
      <td class="col-year">${q.Year || '-'}</td>
    `;

    if (showSchool) {
      html += `<td class="col-school" title="${q.School || '-'}">${(q.School || '-').substring(0, 4)}</td>`;
    }

    html += `
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
  const showSchool = document.getElementById('show-school') ? document.getElementById('show-school').checked : true;
  
  const table = document.getElementById('questions-table');
  const imageHeaders = table.querySelectorAll('th.col-image');
  const textHeaders = table.querySelectorAll('th.col-text');
  const schoolHeaders = table.querySelectorAll('th.col-school');
  
  imageHeaders.forEach(th => th.classList.toggle('hidden', !showImage));
  textHeaders.forEach(th => th.classList.toggle('hidden', !showText));
  schoolHeaders.forEach(th => th.classList.toggle('hidden', !showSchool));
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

function showStatsAnalysis() {
  const totalQuestions = allQuestions.length;
  const practicedSet = new Set(practiceLog.map(log => log.Q_ID));
  const practicedCount = practicedSet.size;

  const totalLogs = practiceLog.length;
  const correct = practiceLog.filter(log => log.Result === 'Correct').length;
  const incorrect = practiceLog.filter(log => log.Result === 'Incorrect').length;
  const skipped = practiceLog.filter(log => log.Result === 'Skipped').length;
  const browsed = practiceLog.filter(log => log.Result === 'Browse').length;

  const totalSeconds = practiceLog.reduce((sum, log) => sum + (log.TimeSeconds || 0), 0);
  const avgSeconds = totalLogs > 0 ? Math.round(totalSeconds / Math.max(totalLogs, 1)) : 0;

  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();
  const monthLogs = hobbitLog.filter(l => {
    const d = new Date(l.Date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const monthDays = monthLogs.length;
  const monthMinutes = monthLogs.reduce((sum, l) => sum + Math.floor(l.TotalSeconds / 60), 0);
  const monthQuestions = monthLogs.reduce((sum, l) => sum + l.QuestionCount, 0);

  const message = [
    `題庫：${totalQuestions} 題`,
    `已練過：${practicedCount} 題`,
    `總作答筆數：${totalLogs} 筆（答對 ${correct} / 答錯 ${incorrect} / 跳過 ${skipped} / 瀏覽 ${browsed}）`,
    `平均時間：${avgSeconds} 秒/題`,
    `本月累計：${monthDays} 天 / ${monthQuestions} 題 / ${monthMinutes} 分鐘`
  ].join('\n');

  showMessage('統計分析', message);
}

function getSelectedQuestions() {
  const checkboxes = document.querySelectorAll('.question-checkbox:checked');
  const selected = [];
  checkboxes.forEach(cb => {
    const qid = cb.dataset.qid;
    const q = allQuestions.find(item => getQID(item) === qid);
    if (q) selected.push(q);
  });
  return selected;
}

// ==================== 隨機模式 ====================

function updateRandomOptions() {
  const modeSelect = document.getElementById('random-mode');
  if (!modeSelect) return;
  const mode = modeSelect.value;
  
  const chapterGroup = document.getElementById('random-chapter-group');
  const difficultyGroup = document.getElementById('random-difficulty-group');
  if (chapterGroup) {
    chapterGroup.style.display = mode === 'chapter' ? 'flex' : 'none';
  }
  if (difficultyGroup) {
    difficultyGroup.style.display = mode === 'difficulty' ? 'flex' : 'none';
  }
}

function startRandom3() {
  const candidates = allQuestions.filter(q => {
    const qid = getQID(q);
    const entry = statusMap[qid];
    const attemptCount = entry ? entry.attemptCount : practiceLog.filter(log => log.Q_ID === qid).length;
    return attemptCount === 0;
  });

  if (candidates.length === 0) {
    showMessage('??', '??????????');
    return;
  }

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(3, shuffled.length));

  if (selected.length < 3) {
    showMessage('??', `?? ${selected.length} ?????????`);
  }

  isBrowseMode = false;
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
  
  isBrowseMode = false;
  startPracticeWithQuestions(selected);
}


function startBrowseMode() {
  const checkboxes = document.querySelectorAll('.question-checkbox:checked');
  let selected = [];
  
  if (checkboxes.length > 0) {
    selected = Array.from(checkboxes).map(cb => {
      const qid = cb.dataset.qid;
      return allQuestions.find(q => getQID(q) === qid);
    }).filter(Boolean);
  } else {
    selected = [...filteredQuestions];
  }
  
  if (selected.length === 0) {
    showMessage('??', '??????????????????????');
    return;
  }
  
  isBrowseMode = true;
  isMobileBrowse = false;
  startPracticeWithQuestions(selected);
}

function startMobileBrowseMode() {
  const checkboxes = document.querySelectorAll('.question-checkbox:checked');
  let selected = [];

  if (checkboxes.length > 0) {
    selected = Array.from(checkboxes).map(cb => {
      const qid = cb.dataset.qid;
      return allQuestions.find(q => getQID(q) === qid);
    }).filter(Boolean);
  } else {
    selected = [...filteredQuestions];
  }

  if (selected.length === 0) {
    showMessage('提示', '請先選擇至少一題或套用篩選後再進入手機瀏覽模式。');
    return;
  }

  isBrowseMode = false;
  isMobileBrowse = true;
  mobileBrowseQuestions = selected;
  mobileBrowseIndex = 0;
  mobileBrowseTimes = {};
  selected.forEach(q => mobileBrowseTimes[getQID(q)] = 0);
  showPage('mobile-browse');
  renderMobileBrowseQuestion(0);
}


function startPracticeWithQuestions(questions) {
  practiceQuestions = questions;
  
  // 重置預測難度
  predictedDifficulties = {};
  if (isBrowseMode) {
    startPracticePage();
    showPage('practice');
  } else {
    // 進入預測頁面
    showPage('predict');
    renderPredictPage();
  }
}

// ==================== 匯出 PDF ====================


function getProblemImage(q) {
  return q['Problem Image'] || q['題目圖片'] || q['問題圖片'] || q['ProblemImage'] || '';
}

function getAnswerImage(q) {
  return q['Answer Image'] || q['解答圖片'] || q['AnswerImage'] || '';
}

function getSolutionImage(q) {
  return q['Solution Image'] || q['詳解圖片'] || q['SolutionImage'] || '';
}

function getTypeLabel(typeValue) {
  const v = String(typeValue);
  if (v === '0') return '0無解答';
  if (v === '1') return '1填充題';
  if (v === '2') return '2選擇題';
  return v;
}

// ==================== 手機瀏覽模式 ====================

function renderMobileBrowseQuestion(index) {
  if (index < 0 || index >= mobileBrowseQuestions.length) return;
  mobileBrowseIndex = index;

  const q = mobileBrowseQuestions[index];
  const qid = getQID(q);
  const metaText = `${q.Year || '-'} / ${q.School || '-'} / ${q.Chapter || '-'}`;
  if (!(qid in mobileBrowseTimes)) {
    mobileBrowseTimes[qid] = 0;
  }

  document.getElementById('mb-qid').textContent = `Q_ID: ${qid}`;
  document.getElementById('mb-meta').textContent = metaText;

  const img = document.getElementById('mb-problem-img');
  img.src = q['Problem Image'] || q['題目圖片'] || '';
  img.onclick = () => enlargeImage(img.src, metaText);

  updateMobileBrowseStars(getUserDifficulty(qid));

  // 開始計時
  mobileQuestionStartTime = Date.now();
}

function updateMobileBrowseStars(value) {
  const stars = document.querySelectorAll('.mb-star');
  stars.forEach(star => {
    const v = parseInt(star.dataset.value, 10);
    if (v <= value) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

function accumulateMobileTime() {
  const q = mobileBrowseQuestions[mobileBrowseIndex];
  if (!q) return 0;
  const qid = getQID(q);
  const now = Date.now();
  let elapsed = 0;
  if (mobileQuestionStartTime) {
    elapsed = Math.max(0, Math.floor((now - mobileQuestionStartTime) / 1000));
    mobileBrowseTimes[qid] = (mobileBrowseTimes[qid] || 0) + elapsed;
  }
  mobileQuestionStartTime = now;
  return elapsed;
}

function logMobileBrowseRating(value) {
  accumulateMobileTime();
  const q = mobileBrowseQuestions[mobileBrowseIndex];
  const qid = getQID(q);
  const now = Date.now();

  const today = new Date().toISOString().split('T')[0];
  const log = {
    Q_ID: qid,
    Date: today,
    TimeSeconds: mobileBrowseTimes[qid],
    PredictedDifficulty: predictedDifficulties[qid] || 0,
    ActualDifficulty: value,
    Note: '',
    Result: 'Browse',
    Year: q.Year,
    School: q.School,
    StartAt: new Date(now - (mobileBrowseTimes[qid] || 0) * 1000).toISOString(),
    EndAt: new Date(now).toISOString(),
    Mode: 'Browse-Mobile'
  };

  // 覆寫同日同題的瀏覽紀錄
  const idx = practiceLog.findIndex(l => l.Q_ID === qid && l.Date === today && l.Mode === 'Browse-Mobile');
  stampLogForSync(log);
  if (idx >= 0) {
    practiceLog[idx] = log;
  } else {
    practiceLog.push(log);
  }
  rebuildCachesFromLogs();
  saveToLocalStorage();
  updateMobileBrowseStars(value);
}

function mbPrev() {
  if (mobileBrowseIndex <= 0) return;
  accumulateMobileTime();
  renderMobileBrowseQuestion(mobileBrowseIndex - 1);
}

function mbNext() {
  if (mobileBrowseIndex >= mobileBrowseQuestions.length - 1) return;
  accumulateMobileTime();
  renderMobileBrowseQuestion(mobileBrowseIndex + 1);
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
    totalSeconds: 0,
    updated_at: Date.now()
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
  problemImg.onclick = () => enlargeImage(problemImg.src, `${q.Year || '-'} / ${q.School || '-'}`);
  
  // 載入解答和詳解（但先隱藏）
  document.getElementById('practice-answer-img').src = q['Answer Image'] || q['解答圖片'] || '';
  document.getElementById('practice-solution-img').src = q['Solution Image'] || q['詳解圖片'] || '';
  document.getElementById('practice-answer-img').onclick = () => enlargeImage(document.getElementById('practice-answer-img').src, `${q.Year || '-'} / ${q.School || '-'}`);
  document.getElementById('practice-solution-img').onclick = () => enlargeImage(document.getElementById('practice-solution-img').src, `${q.Year || '-'} / ${q.School || '-'}`);
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
  const resultButtonsDisabled = isBrowseMode;
  ['btn-correct', 'btn-wrong', 'btn-skip'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = resultButtonsDisabled;
  });
  
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
  const endAt = new Date();
  
  const log = {
    Q_ID: qid,
    Date: today,
    TimeSeconds: questionTimes[qid],  // 使用累積時間
    PredictedDifficulty: predictedDifficulties[qid] || 0,
    ActualDifficulty: currentDifficulty,
    Note: currentNote,
    Result: result,
    Year: q.Year,
    School: q.School,
    StartAt: new Date(currentQuestionStartTime).toISOString(),
    EndAt: endAt.toISOString(),
    Mode: isBrowseMode ? 'Browse' : 'Practice'
  };
  
  stampLogForSync(log);
  practiceLog.push(log);
  updateCachesWithLog(log);
  
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

function saveBrowseLog() {
  const q = practiceQuestions[currentIndex];
  const qid = getQID(q);
  const now = Date.now();
  const elapsed = Math.floor((now - currentQuestionStartTime) / 1000);
  questionTimes[qid] += elapsed;
  currentQuestionStartTime = now;
  
  const today = new Date().toISOString().split('T')[0];
  const log = {
    Q_ID: qid,
    Date: today,
    TimeSeconds: questionTimes[qid],
    PredictedDifficulty: predictedDifficulties[qid] || 0,
    ActualDifficulty: currentDifficulty,
    Note: currentNote,
    Result: 'Browse',
    Year: q.Year,
    School: q.School,
    StartAt: new Date(currentQuestionStartTime).toISOString(),
    EndAt: new Date().toISOString(),
    Mode: 'Browse'
  };
  
  const existingIndex = practiceLog.findIndex(l => l.Q_ID === qid && l.Date === today && l.Result === 'Browse');
  stampLogForSync(log);
  if (existingIndex >= 0) {
    practiceLog[existingIndex] = log;
  } else {
    practiceLog.push(log);
  }
  rebuildCachesFromLogs();
  
  updateHobbitLog(today, elapsed);
  saveToLocalStorage();
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
  
  if (isBrowseMode) {
    saveBrowseLog();
  }
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
  
  const q = practiceQuestions[currentIndex];
  const qid = getQID(q);
  
  const logs = practiceLog.filter(log => log.Q_ID === qid);
  if (logs.length > 0) {
    const target = logs[logs.length - 1];
    target.Note = currentNote;
    target.client_updated_at = Date.now();
    stampLogForSync(target);
  } else {
    // 若尚無此題紀錄，新增一筆僅含筆記的紀錄
    const now = new Date();
    const log = {
      Q_ID: qid,
      Date: now.toISOString().split('T')[0],
      TimeSeconds: 0,
      PredictedDifficulty: predictedDifficulties[qid] || 0,
      ActualDifficulty: 0,
      Note: currentNote,
      Result: 'NoteOnly',
      Year: q.Year,
      School: q.School,
      StartAt: now.toISOString(),
      EndAt: now.toISOString(),
      Mode: 'Note'
    };
    stampLogForSync(log);
    practiceLog.push(log);
    updateCachesWithLog(log);
  }

  ensureStatusEntry(qid).lastNote = currentNote;
  saveToLocalStorage();
  showMessage('成功', '筆記已儲存');

  if (enableBackgroundSync) {
    scheduleBackgroundSync();
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
    totalSeconds: sessionTotalSeconds + Math.floor((Date.now() - sessionStartTime) / 1000),
    updated_at: Date.now()
  };
  saveToLocalStorage();
  
  stopTimer();
  showMessage('提示', '進度已儲存！下次開啟會詢問是否繼續。', () => {
    showPage('list');
    initListPage();
  });

  if (enableBackgroundSync) {
    scheduleBackgroundSync();
  }
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

  if (enableBackgroundSync) {
    scheduleBackgroundSync();
  }
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

// ==================== 練習紀錄檢視 ====================

function renderLogPage() {
  const dateList = document.getElementById('log-date-list');
  const items = document.getElementById('log-items');
  if (!dateList || !items) return;

  const dates = [...new Set(practiceLog.map(l => l.Date).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  dateList.innerHTML = '';
  items.innerHTML = '';
  const btnReplay = document.getElementById('btn-log-replay');

  if (dates.length === 0) {
    document.getElementById('log-selected-date').textContent = '尚無紀錄';
    items.innerHTML = '<div class="small">目前沒有練習紀錄。</div>';
    if (btnReplay) btnReplay.disabled = true;
    return;
  }

  dates.forEach(date => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = date;
    btn.className = 'win98-button small';
    btn.addEventListener('click', () => renderLogDate(date));
    li.appendChild(btn);
    dateList.appendChild(li);
  });

  if (btnReplay) btnReplay.disabled = false;
  renderLogDate(dates[0]);
}

function renderLogDate(date) {
  const items = document.getElementById('log-items');
  if (!items) return;

  currentLogDate = date;
  document.getElementById('log-selected-date').textContent = date;
  const logs = practiceLog
    .filter(l => l.Date === date)
    .sort((a, b) => (a.StartAt || '').localeCompare(b.StartAt || ''));

  items.innerHTML = '';

  logs.forEach(log => {
    const q = allQuestions.find(q => getQID(q) === log.Q_ID) || {};
    const starChar = '&#9733;'; // use entity to avoid encoding issues
    const stars = log.ActualDifficulty ? starChar.repeat(log.ActualDifficulty) : '';
    const timeMin = Math.floor((log.TimeSeconds || 0) / 60);
    const imgSrc = getProblemImage(q);
    const div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = `
      <div class="log-item-header">
        <strong>${log.Q_ID || '-'} </strong>
        <span class="small">${q.Year || log.Year || '-'} / ${q.School || log.School || '-'}</span>
      </div>
      <div class="log-item-body">
        <div class="log-thumb">
          ${imgSrc ? `<img src="${imgSrc}" alt="${'\u984c\u76ee'}" />` : '<span class="small">-</span>'}
        </div>
        <span>${log.Result || ''}</span>
        <span>${stars}</span>
        <span>${timeMin} ${'\u5206\u9418'}</span>
        <div class="log-item-actions">
          <button class="win98-button small log-view-btn" data-qid="${log.Q_ID || ''}">${'\u6aa2\u8996'}</button>
          <button class="win98-button small log-redo-btn" data-qid="${log.Q_ID || ''}">${'\u518d\u7df4'}</button>
        </div>
      </div>
      <div class="log-item-note small">${log.Note || log.Notes || ''}</div>
    `;
    const viewBtn = div.querySelector('.log-view-btn');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        const question = allQuestions.find(item => getQID(item) === log.Q_ID);
        const src = question ? getProblemImage(question) : imgSrc;
        if (src) {
          const meta = question ? `${question.Year || '-'} / ${question.School || '-'}` : '';
          enlargeImage(src, meta);
        }
      });
    }
    const thumbImg = div.querySelector('.log-thumb img');
    if (thumbImg) {
      thumbImg.addEventListener('click', () => {
        const meta = `${q.Year || log.Year || '-'} / ${q.School || log.School || '-'}`;
        enlargeImage(thumbImg.src, meta);
      });
    }
    const redoBtn = div.querySelector('.log-redo-btn');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => redoSingleQuestion(log.Q_ID));
    }
    items.appendChild(div);
  });
}

function redoLogQuestions() {
  if (!currentLogDate) {
    showMessage('提示', '請先選擇要重做的日期。');
    return;
  }
  const logs = practiceLog
    .filter(l => l.Date === currentLogDate)
    .sort((a, b) => (a.StartAt || '').localeCompare(b.StartAt || ''));
  const seen = new Set();
  const questions = [];
  logs.forEach(log => {
    const qid = log.Q_ID;
    if (seen.has(qid)) return;
    seen.add(qid);
    const q = allQuestions.find(item => getQID(item) === qid);
    if (q) questions.push(q);
  });

  if (questions.length === 0) {
    showMessage('提示', '找不到該日期的題目，可能題庫已變更。');
    return;
  }
  isBrowseMode = false;
  startPracticeWithQuestions(questions);
  showMessage('開始重做', `已載入 ${questions.length} 題，順序依該日記錄。`);
}

function redoSingleQuestion(qid) {
  const q = allQuestions.find(item => getQID(item) === qid);
  if (!q) {
    showMessage('提示', '題目不存在於目前題庫。');
    return;
  }
  isBrowseMode = false;
  startPracticeWithQuestions([q]);
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

  if (sessionStartTime && sessionTotalSeconds > 0) {
    sessionStartTime = Date.now() - sessionTotalSeconds * 1000;
  } else if (!sessionStartTime) {
    sessionStartTime = Date.now();
  }

  currentQuestionStartTime = Date.now();

  timerInterval = setInterval(() => {
    // 更新總時間
    const totalElapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    updateTotalTimerDisplay(totalElapsed);
    
    // 更新單題時間
    const qid = getQID(practiceQuestions[currentIndex]);
    const baseTime = questionTimes[qid] || 0;
    const currentElapsed = Math.max(0, Math.floor((Date.now() - currentQuestionStartTime) / 1000));
    updateSingleTimerDisplay(baseTime + currentElapsed);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    
    // 儲存當前的總時間
    if (sessionStartTime) {
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      sessionTotalSeconds = elapsed;
    }
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
    if (pageName === 'log') {
      renderLogPage();
    }
  }
}

function getQID(question) {
  return question.Q_ID || question.ExamID || question['題目ID'] || '';
}

function getLanguage(question) {
  if (question.Language) return question.Language;
  const text = (question['Extracted Text'] || question['Display Name'] || '').trim();
  if (!text) return '';
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

function getRecruitmentType(schoolName) {
  if (!schoolName) return '';
  return schoolName.includes('聯招') ? '聯招' : '獨招';
}

function getLastResultFromLogs(qid) {
  const logs = practiceLog.filter(log => log.Q_ID === qid);
  if (logs.length === 0) return null;
  const latest = logs.sort((a, b) => new Date(b.Date) - new Date(a.Date))[0];
  return latest.Result || null;
}


function isPracticed(qid) {
  const entry = statusMap[qid];
  if (entry) return entry.attemptCount > 0;
  return practiceLog.some(log => log.Q_ID === qid);
}


function getPracticeCount(qid) {
  const entry = statusMap[qid];
  if (entry) return entry.attemptCount || 0;
  return practiceLog.filter(log => log.Q_ID === qid).length;
}


function getLastDate(qid) {
  const entry = statusMap[qid];
  const dateStr = entry && entry.lastResultDate;
  if (dateStr) {
    const date = new Date(dateStr);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  }
  const logs = practiceLog.filter(log => log.Q_ID === qid);
  if (logs.length === 0) return '-';

  const latest = logs.sort((a, b) => new Date(b.Date) - new Date(a.Date))[0];
  const date = new Date(latest.Date);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}


function getSkipCount(qid) {
  const entry = statusMap[qid];
  if (entry) return entry.skipCount || 0;
  return practiceLog.filter(log => log.Q_ID === qid && log.Result === 'Skipped').length;
}


function getUserDifficulty(qid) {
  const entry = statusMap[qid];
  if (entry && entry.lastActualDifficulty > 0) return entry.lastActualDifficulty;
  const logs = practiceLog.filter(log => log.Q_ID === qid && log.ActualDifficulty > 0);
  if (logs.length === 0) return 0;
  const latest = logs.sort((a, b) => new Date(b.Date) - new Date(a.Date))[0];
  return latest.ActualDifficulty;
}


function getPreviousNote(qid) {
  const entry = statusMap[qid];
  if (entry && entry.lastNote) return entry.lastNote;
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

function enlargeImage(src, metaText = '') {
  const modal = document.getElementById('image-modal');
  document.getElementById('modal-image').src = src;
  const meta = document.getElementById('modal-meta');
  if (meta) meta.textContent = metaText;
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
  let csv = 'Date,Q_ID,Result,TimeSeconds,PredictedDifficulty,ActualDifficulty,Notes,Year,School,StartAt,EndAt,Mode\n';
  
  // 資料行
  practiceLog.forEach(log => {
    csv += `${log.Date},${log.Q_ID},${log.Result},${log.TimeSeconds || 0},${log.PredictedDifficulty || 0},${log.ActualDifficulty || 0},"${(log.Note || log.Notes || '').replace(/"/g, '""')}",${log.Year || ''},${log.School || ''},${log.StartAt || ''},${log.EndAt || ''},${log.Mode || ''}\n`;
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
          stampLogForSync(log);
          practiceLog.push(log);
          addedCount++;
        }
      });
      
      rebuildCachesFromLogs();
      
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
}

function switchTheme(theme) {
  const themeLink = document.getElementById('theme-style');
  themeLink.href = `style-${theme}.css`;
  
  // 更新按鈕狀態
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`theme-${theme}`).classList.add('active');
  
  // 儲存選擇
  localStorage.setItem('theme', theme);
}

// ==================== 雲端同步 ====================

let gistId = null;
let githubToken = null;

async function syncToCloud() {
  showMessage('暫停', '雲端同步功能已暫停，請改用匯出/匯入備份資料。');
  return;
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
