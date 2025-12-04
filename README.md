# 刷題機 V1 - Windows 98 復古風格

一個功能完整的物理題庫練習系統,採用經典的 Windows 98 介面風格。

## 功能特色

### 📚 題庫管理
- CSV 格式題庫載入
- 支援題目圖片、答案圖片、手寫詳解
- 多維度篩選(年份、學校、章節、難度、練習狀態)
- 全文搜尋功能
- 可排序的題目列表

### 🎯 刷題模式
- **一般模式**: 練習所有篩選後的題目
- **同章節模式**: 隨機選取同章節的3題
- **同學校模式**: 隨機選取同學校的3題
- **同難度模式**: 隨機選取同難度的3題

### ⭐ 難度預測
- 練習前預測題目難度(1-5星)
- 比對預測難度與實際難度
- 幫助了解自我評估能力

### 📝 練習功能
- 即時計時器
- 記錄答題結果(正確/錯誤/跳過)
- 設定實際難度
- 添加練習筆記
- 顯示答案與詳解
- 自動儲存進度
- 支援鍵盤快捷鍵

### 📊 統計分析
- 整體練習統計
- 正確率分析
- 難度分布分析
- 預測準確度分析
- 最近練習記錄

### 🔥 每日熱力圖
- GitHub 風格的熱力圖
- 按月份顯示練習狀況
- 練習時間視覺化
- 連續練習天數統計
- 月度統計數據

## 檔案結構

```
shuatiji/
├── index.html          # 主頁面 - 載入題庫
├── list.html           # 題目列表頁
├── predict.html        # 難度預測頁
├── practice.html       # 練習頁面
├── summary.html        # 統計摘要頁
├── hobbit.html         # 每日熱力圖
├── data.csv            # 範例題庫檔案
├── css/
│   └── win98.css       # Windows 98 風格樣式
├── js/
│   ├── utils.js        # 工具函數
│   ├── dataManager.js  # 資料管理
│   ├── stateManager.js # 狀態管理
│   ├── list.js         # 列表頁邏輯
│   ├── predict.js      # 預測頁邏輯
│   ├── practice.js     # 練習頁邏輯
│   ├── summary.js      # 摘要頁邏輯
│   └── hobbit.js       # 熱力圖邏輯
├── images/             # 題目圖片資料夾(需自行準備)
└── data/               # 自動生成的紀錄檔案
    ├── practice_log.csv
    ├── predict_log.csv
    ├── hobbit_log.csv
    └── session_state.json
```

## 使用方式

### 1. 準備題庫

題庫檔案 `data.csv` 應包含以下欄位:
- ExamID, Display Name, Version, Year, School, Filename
- Q_ID, Order, Chapter, Difficulty, Time(s), Status
- Problem Image, Answer Image, Solution Image, Notes, Extracted Text

題目圖片應放在 `images/` 資料夾中。

### 2. 啟動系統

1. 用瀏覽器開啟 `index.html`
2. 選擇題庫檔案 (data.csv) 或使用範例資料
3. 系統會自動載入之前的練習紀錄

### 3. 開始刷題

1. 在列表頁設定篩選條件
2. 選擇刷題模式
3. 決定是否需要預測難度
4. 點擊「開始刷題」
5. 完成練習後查看統計與熱力圖

## 鍵盤快捷鍵

### 預測頁面
- `1-5`: 設定難度星級
- `S`: 跳過此題
- `Enter` 或 `→`: 確認並下一題
- `←`: 上一題

### 練習頁面
- `C`: 標記為正確
- `X`: 標記為錯誤
- `S`: 跳過此題
- `A`: 顯示/隱藏答案
- `1-5`: 設定難度星級
- `Space`: 暫停/繼續
- `→`: 下一題
- `←`: 上一題

## 資料儲存

所有資料都儲存在瀏覽器的 localStorage 中:
- `practice_log`: 練習紀錄
- `predict_log`: 預測紀錄
- `hobbit_log`: 每日統計
- `current_session`: 當前會話狀態

**注意**: 清除瀏覽器資料會導致紀錄遺失,建議定期匯出備份。

## 資料匯出

在統計頁面或列表頁點擊「匯出資料」按鈕,可以將所有紀錄匯出為 CSV 格式。

## 瀏覽器相容性

建議使用現代瀏覽器:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

需要支援:
- ES6 Modules
- localStorage API
- FileReader API

## 系統需求

- 瀏覽器支援 JavaScript ES6+
- 支援 localStorage (至少 5MB 空間)
- 題目圖片需放在可存取的路徑

## 注意事項

1. 本系統完全在瀏覽器端運行,不需要伺服器
2. 資料儲存在瀏覽器 localStorage,清除瀏覽器資料會遺失紀錄
3. 圖片路徑需正確設定,否則無法顯示題目
4. 建議定期匯出資料備份
5. 手寫詳解檔案命名格式: `Q_ID.webp`

## 版本資訊

- 版本: V1.0.0
- 建立日期: 2024年12月
- 風格: Windows 98 Retro
- 授權: MIT License

## 技術架構

- 前端: 純 HTML/CSS/JavaScript (ES6 Modules)
- 樣式: 手工打造的 Windows 98 復古風格
- 資料: CSV + JSON 格式
- 儲存: Browser localStorage API

## 未來功能 (V2)

- 列印功能
- 錯題本
- 複習提醒
- 資料同步
- 多使用者支援

---

**享受復古的刷題體驗! 🎮📚**
