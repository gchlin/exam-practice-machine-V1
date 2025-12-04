// dataManager.js - 資料管理模組

import { csvToJson, jsonToCsv, getCurrentDate, getCurrentTimestamp } from './utils.js';

class DataManager {
  constructor() {
    this.questions = [];
    this.practiceLog = [];
    this.predictLog = [];
    this.hobbitLog = [];
    this.sessionState = null;
    
    this.dataPath = './data/';
  }

  /**
   * 載入題庫 CSV
   */
  async loadQuestions(file) {
    try {
      let text;
      if (file instanceof File) {
        // 從檔案選擇器載入
        text = await file.text();
      } else if (typeof file === 'string') {
        // 從路徑載入
        const response = await fetch(file);
        text = await response.text();
      }
      
      this.questions = csvToJson(text);
      console.log(`載入 ${this.questions.length} 題`);
      return this.questions;
    } catch (error) {
      console.error('載入題庫失敗:', error);
      throw error;
    }
  }

  /**
   * 載入練習紀錄
   */
  async loadPracticeLog() {
    try {
      const response = await fetch(`${this.dataPath}practice_log.csv`);
      if (response.ok) {
        const text = await response.text();
        this.practiceLog = text.trim() ? csvToJson(text) : [];
        console.log(`載入 ${this.practiceLog.length} 筆練習紀錄`);
      } else {
        this.practiceLog = [];
        console.log('練習紀錄不存在，建立新的');
      }
    } catch (error) {
      this.practiceLog = [];
      console.log('練習紀錄載入失敗，建立新的');
    }
    return this.practiceLog;
  }

  /**
   * 儲存練習紀錄
   */
  async savePracticeLog(record) {
    this.practiceLog.push(record);
    const headers = ['Q_ID', 'SolutionPath', 'Date', 'TimeSeconds', 'Difficulty', 'Note', 'Result'];
    const csv = jsonToCsv(this.practiceLog, headers);
    
    // 使用 localStorage 模擬儲存 (因為瀏覽器無法直接寫入檔案)
    localStorage.setItem('practice_log', csv);
    console.log('練習紀錄已儲存');
  }

  /**
   * 載入預測紀錄
   */
  async loadPredictLog() {
    try {
      const response = await fetch(`${this.dataPath}predict_log.csv`);
      if (response.ok) {
        const text = await response.text();
        this.predictLog = text.trim() ? csvToJson(text) : [];
        console.log(`載入 ${this.predictLog.length} 筆預測紀錄`);
      } else {
        this.predictLog = [];
      }
    } catch (error) {
      this.predictLog = [];
    }
    return this.predictLog;
  }

  /**
   * 儲存預測紀錄
   */
  async savePredictLog(sessionId) {
    const headers = ['Q_ID', 'PredictedDifficulty', 'PredictedAt', 'SessionID'];
    const csv = jsonToCsv(this.predictLog, headers);
    localStorage.setItem('predict_log', csv);
    console.log('預測紀錄已儲存');
  }

  /**
   * 重置預測紀錄
   */
  resetPredictLog() {
    this.predictLog = [];
    localStorage.removeItem('predict_log');
    console.log('預測紀錄已重置');
  }

  /**
   * 載入每日統計
   */
  async loadHobbitLog() {
    try {
      const response = await fetch(`${this.dataPath}hobbit_log.csv`);
      if (response.ok) {
        const text = await response.text();
        this.hobbitLog = text.trim() ? csvToJson(text) : [];
        console.log(`載入 ${this.hobbitLog.length} 天練習統計`);
      } else {
        this.hobbitLog = [];
      }
    } catch (error) {
      this.hobbitLog = [];
    }
    return this.hobbitLog;
  }

  /**
   * 更新每日統計
   */
  async updateHobbitLog(solved, skipped, timeSeconds, note = '') {
    const today = getCurrentDate();
    const existing = this.hobbitLog.find(log => log.Date === today);
    
    if (existing) {
      existing.TotalPracticeTime = parseInt(existing.TotalPracticeTime) + timeSeconds;
      existing.TotalSolved = parseInt(existing.TotalSolved) + solved;
      existing.TotalSkipped = parseInt(existing.TotalSkipped) + skipped;
      if (note) existing.Note = note;
    } else {
      this.hobbitLog.push({
        Date: today,
        TotalPracticeTime: timeSeconds,
        TotalSolved: solved,
        TotalSkipped: skipped,
        Note: note
      });
    }
    
    const headers = ['Date', 'TotalPracticeTime', 'TotalSolved', 'TotalSkipped', 'Note'];
    const csv = jsonToCsv(this.hobbitLog, headers);
    localStorage.setItem('hobbit_log', csv);
    console.log('每日統計已更新');
  }

  /**
   * 載入會話狀態
   */
  async loadSessionState() {
    try {
      const response = await fetch(`${this.dataPath}session_state.json`);
      if (response.ok) {
        this.sessionState = await response.json();
        console.log('載入會話狀態');
      } else {
        this.sessionState = null;
      }
    } catch (error) {
      this.sessionState = null;
    }
    return this.sessionState;
  }

  /**
   * 儲存會話狀態
   */
  async saveSessionState(state) {
    this.sessionState = state;
    localStorage.setItem('session_state', JSON.stringify(state));
    console.log('會話狀態已儲存');
  }

  /**
   * 清除會話狀態
   */
  async clearSessionState() {
    this.sessionState = null;
    localStorage.removeItem('session_state');
    console.log('會話狀態已清除');
  }

  /**
   * 取得題目的練習紀錄
   */
  getQuestionPracticeHistory(qId) {
    return this.practiceLog.filter(log => log.Q_ID === qId);
  }

  /**
   * 取得題目的最後練習時間
   */
  getQuestionLastPracticeTime(qId) {
    const history = this.getQuestionPracticeHistory(qId);
    if (history.length === 0) return null;
    
    const sorted = history.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    return sorted[0].Date;
  }

  /**
   * 取得題目的最後練習結果
   */
  getQuestionLastResult(qId) {
    const history = this.getQuestionPracticeHistory(qId);
    if (history.length === 0) return null;
    
    const sorted = history.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    return sorted[0].Result;
  }

  /**
   * 取得題目的跳過次數
   */
  getQuestionSkipCount(qId) {
    return this.practiceLog.filter(log => log.Q_ID === qId && log.Result === 'Skipped').length;
  }

  /**
   * 取得題目的預測難度
   */
  getQuestionPredictedDifficulty(qId) {
    const predict = this.predictLog.find(log => log.Q_ID === qId);
    return predict ? parseInt(predict.PredictedDifficulty) : null;
  }

  /**
   * 設定題目的預測難度
   */
  setPredictedDifficulty(qId, difficulty, sessionId) {
    const existing = this.predictLog.find(log => log.Q_ID === qId);
    
    if (existing) {
      existing.PredictedDifficulty = difficulty;
      existing.PredictedAt = getCurrentTimestamp();
      existing.SessionID = sessionId;
    } else {
      this.predictLog.push({
        Q_ID: qId,
        PredictedDifficulty: difficulty,
        PredictedAt: getCurrentTimestamp(),
        SessionID: sessionId
      });
    }
  }

  /**
   * 取得增強的題目資料 (合併練習紀錄)
   */
  getEnhancedQuestions() {
    return this.questions.map(q => ({
      ...q,
      lastPracticeDate: this.getQuestionLastPracticeTime(q.Q_ID),
      lastResult: this.getQuestionLastResult(q.Q_ID),
      skipCount: this.getQuestionSkipCount(q.Q_ID),
      predictedDifficulty: this.getQuestionPredictedDifficulty(q.Q_ID),
      practiceCount: this.getQuestionPracticeHistory(q.Q_ID).length
    }));
  }

  /**
   * 匯出所有資料為 ZIP (透過下載多個檔案模擬)
   */
  exportAllData() {
    const data = {
      practice_log: localStorage.getItem('practice_log') || '',
      predict_log: localStorage.getItem('predict_log') || '',
      hobbit_log: localStorage.getItem('hobbit_log') || '',
      session_state: localStorage.getItem('session_state') || '{}'
    };
    
    return data;
  }

  /**
   * 從 localStorage 載入所有資料
   */
  async loadFromLocalStorage() {
    // 載入練習紀錄
    const practiceLogCsv = localStorage.getItem('practice_log');
    if (practiceLogCsv) {
      this.practiceLog = csvToJson(practiceLogCsv);
    }
    
    // 載入預測紀錄
    const predictLogCsv = localStorage.getItem('predict_log');
    if (predictLogCsv) {
      this.predictLog = csvToJson(predictLogCsv);
    }
    
    // 載入每日統計
    const hobbitLogCsv = localStorage.getItem('hobbit_log');
    if (hobbitLogCsv) {
      this.hobbitLog = csvToJson(hobbitLogCsv);
    }
    
    // 載入會話狀態
    const sessionStateJson = localStorage.getItem('session_state');
    if (sessionStateJson) {
      this.sessionState = JSON.parse(sessionStateJson);
    }
    
    console.log('從 localStorage 載入資料完成');
  }

  /**
   * 取得統計資料
   */
  getStats() {
    const totalQuestions = this.questions.length;
    const practicedQuestions = new Set(this.practiceLog.map(log => log.Q_ID)).size;
    const correctCount = this.practiceLog.filter(log => log.Result === 'Correct').length;
    const incorrectCount = this.practiceLog.filter(log => log.Result === 'Incorrect').length;
    const skippedCount = this.practiceLog.filter(log => log.Result === 'Skipped').length;
    const totalTime = this.practiceLog.reduce((sum, log) => sum + parseInt(log.TimeSeconds || 0), 0);
    const avgTime = this.practiceLog.length > 0 ? Math.round(totalTime / this.practiceLog.length) : 0;
    
    return {
      totalQuestions,
      practicedQuestions,
      correctCount,
      incorrectCount,
      skippedCount,
      totalPracticeCount: this.practiceLog.length,
      totalTime,
      avgTime,
      accuracy: correctCount + incorrectCount > 0 
        ? Math.round((correctCount / (correctCount + incorrectCount)) * 100) 
        : 0
    };
  }
}

// 建立全域實例
export const dataManager = new DataManager();
