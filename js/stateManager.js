// stateManager.js - 狀態管理模組

import { generateUUID } from './utils.js';

class StateManager {
  constructor() {
    this.currentSession = {
      id: null,
      mode: null, // 'normal', 'same-chapter', 'same-school', 'same-difficulty'
      questions: [],
      currentIndex: 0,
      startTime: null,
      results: []
    };
    
    this.filters = {
      year: '',
      school: '',
      chapter: '',
      difficulty: '',
      status: '', // 'all', 'practiced', 'unpracticed'
      searchText: ''
    };
    
    this.sorting = {
      field: 'Order',
      direction: 'asc'
    };
  }

  /**
   * 開始新的練習會話
   */
  startSession(mode, questions) {
    this.currentSession = {
      id: generateUUID(),
      mode: mode,
      questions: questions,
      currentIndex: 0,
      startTime: Date.now(),
      results: []
    };
    
    console.log(`開始新會話: ${mode}, ${questions.length} 題`);
    return this.currentSession;
  }

  /**
   * 取得當前題目
   */
  getCurrentQuestion() {
    if (this.currentSession.currentIndex >= this.currentSession.questions.length) {
      return null;
    }
    return this.currentSession.questions[this.currentSession.currentIndex];
  }

  /**
   * 移到下一題
   */
  nextQuestion() {
    this.currentSession.currentIndex++;
    return this.getCurrentQuestion();
  }

  /**
   * 移到上一題
   */
  previousQuestion() {
    if (this.currentSession.currentIndex > 0) {
      this.currentSession.currentIndex--;
    }
    return this.getCurrentQuestion();
  }

  /**
   * 記錄當前題目的結果
   */
  recordResult(result, timeSeconds, difficulty, note) {
    const question = this.getCurrentQuestion();
    if (!question) return;
    
    this.currentSession.results.push({
      Q_ID: question.Q_ID,
      Result: result,
      TimeSeconds: timeSeconds,
      Difficulty: difficulty,
      Note: note
    });
  }

  /**
   * 檢查會話是否完成
   */
  isSessionComplete() {
    return this.currentSession.currentIndex >= this.currentSession.questions.length;
  }

  /**
   * 取得會話摘要
   */
  getSessionSummary() {
    const results = this.currentSession.results;
    const totalTime = results.reduce((sum, r) => sum + r.TimeSeconds, 0);
    const correctCount = results.filter(r => r.Result === 'Correct').length;
    const incorrectCount = results.filter(r => r.Result === 'Incorrect').length;
    const skippedCount = results.filter(r => r.Result === 'Skipped').length;
    
    return {
      sessionId: this.currentSession.id,
      mode: this.currentSession.mode,
      totalQuestions: this.currentSession.questions.length,
      completedQuestions: results.length,
      correctCount,
      incorrectCount,
      skippedCount,
      totalTime,
      avgTime: results.length > 0 ? Math.round(totalTime / results.length) : 0,
      accuracy: correctCount + incorrectCount > 0 
        ? Math.round((correctCount / (correctCount + incorrectCount)) * 100) 
        : 0
    };
  }

  /**
   * 儲存會話狀態
   */
  saveSession() {
    const state = {
      session: this.currentSession,
      savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('current_session', JSON.stringify(state));
    console.log('會話狀態已儲存');
  }

  /**
   * 載入會話狀態
   */
  loadSession() {
    const stateJson = localStorage.getItem('current_session');
    if (!stateJson) return null;
    
    try {
      const state = JSON.parse(stateJson);
      this.currentSession = state.session;
      console.log('會話狀態已載入');
      return this.currentSession;
    } catch (error) {
      console.error('載入會話狀態失敗:', error);
      return null;
    }
  }

  /**
   * 清除會話狀態
   */
  clearSession() {
    this.currentSession = {
      id: null,
      mode: null,
      questions: [],
      currentIndex: 0,
      startTime: null,
      results: []
    };
    
    localStorage.removeItem('current_session');
    console.log('會話狀態已清除');
  }

  /**
   * 檢查是否有未完成的會話
   */
  hasUnfinishedSession() {
    const session = this.loadSession();
    if (!session) return false;
    
    return session.currentIndex < session.questions.length;
  }

  /**
   * 設定篩選條件
   */
  setFilter(key, value) {
    this.filters[key] = value;
    console.log('篩選條件已更新:', this.filters);
  }

  /**
   * 重置篩選條件
   */
  resetFilters() {
    this.filters = {
      year: '',
      school: '',
      chapter: '',
      difficulty: '',
      status: '',
      searchText: ''
    };
  }

  /**
   * 取得篩選條件
   */
  getFilters() {
    return { ...this.filters };
  }

  /**
   * 設定排序
   */
  setSorting(field, direction) {
    this.sorting = { field, direction };
    console.log('排序已更新:', this.sorting);
  }

  /**
   * 取得排序
   */
  getSorting() {
    return { ...this.sorting };
  }

  /**
   * 應用篩選和排序
   */
  applyFiltersAndSorting(questions) {
    let filtered = [...questions];
    
    // 應用篩選
    if (this.filters.year) {
      filtered = filtered.filter(q => q.Year === this.filters.year);
    }
    
    if (this.filters.school) {
      filtered = filtered.filter(q => q.School === this.filters.school);
    }
    
    if (this.filters.chapter) {
      filtered = filtered.filter(q => q.Chapter === this.filters.chapter);
    }
    
    if (this.filters.difficulty) {
      filtered = filtered.filter(q => q.Difficulty === this.filters.difficulty);
    }
    
    if (this.filters.status === 'practiced') {
      filtered = filtered.filter(q => q.practiceCount > 0);
    } else if (this.filters.status === 'unpracticed') {
      filtered = filtered.filter(q => q.practiceCount === 0);
    }
    
    if (this.filters.searchText) {
      const search = this.filters.searchText.toLowerCase();
      filtered = filtered.filter(q => 
        q['Extracted Text']?.toLowerCase().includes(search) ||
        q.Chapter?.toLowerCase().includes(search) ||
        q.School?.toLowerCase().includes(search)
      );
    }
    
    // 應用排序
    filtered.sort((a, b) => {
      let aVal = a[this.sorting.field];
      let bVal = b[this.sorting.field];
      
      // 處理數字
      if (!isNaN(aVal) && !isNaN(bVal)) {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      }
      
      // 處理日期
      if (this.sorting.field.includes('Date')) {
        aVal = new Date(aVal || 0);
        bVal = new Date(bVal || 0);
      }
      
      if (aVal < bVal) return this.sorting.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sorting.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }

  /**
   * 取得可用的年份列表
   */
  getAvailableYears(questions) {
    return [...new Set(questions.map(q => q.Year))].sort();
  }

  /**
   * 取得可用的學校列表
   */
  getAvailableSchools(questions) {
    return [...new Set(questions.map(q => q.School))].sort();
  }

  /**
   * 取得可用的章節列表
   */
  getAvailableChapters(questions) {
    return [...new Set(questions.map(q => q.Chapter))].filter(c => c).sort();
  }

  /**
   * 取得可用的難度列表
   */
  getAvailableDifficulties(questions) {
    return [...new Set(questions.map(q => q.Difficulty))].filter(d => d).sort();
  }

  /**
   * 取得會話進度
   */
  getProgress() {
    return {
      current: this.currentSession.currentIndex + 1,
      total: this.currentSession.questions.length,
      percentage: this.currentSession.questions.length > 0
        ? Math.round(((this.currentSession.currentIndex + 1) / this.currentSession.questions.length) * 100)
        : 0
    };
  }

  /**
   * 取得當前題目的索引
   */
  getCurrentIndex() {
    return this.currentSession.currentIndex;
  }

  /**
   * 設定當前題目的索引
   */
  setCurrentIndex(index) {
    if (index >= 0 && index < this.currentSession.questions.length) {
      this.currentSession.currentIndex = index;
    }
  }

  /**
   * 取得會話中的所有題目
   */
  getSessionQuestions() {
    return this.currentSession.questions;
  }
}

// 建立全域實例
export const stateManager = new StateManager();
