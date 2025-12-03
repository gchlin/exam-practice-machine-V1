/**
 * @typedef {Object} Question
 * @property {string} Q_ID
 * @property {string} Year
 * @property {string} School
 * @property {string} Chapter
 * @property {string} Difficulty
 * @property {string} ProblemImagePath
 * @property {string} AnswerImagePath
 * @property {string} ExtractedText
 */

let questions = [];

/** @type {{Q_ID:string, SolutionPath:string, Date:string, TimeSeconds:number, Difficulty:number, Note:string, Result:string}[]} */
let practiceLog = [];

/** @type {{Q_ID:string, PredictedDifficulty:number, PredictedAt:string, SessionID:string}[]} */
let predictLog = [];

/** @type {{Date:string, TotalPracticeTime:number, TotalSolved:number, TotalSkipped:number, Note:string}[]} */
let hobbitLog = [];

let currentSessionId = "";
/** @type {string[]} */
let currentSessionQuestionIds = [];
let currentIndex = 0;

let timerInterval = null;
let timerSeconds = 0;

// ===== 共用 =====
function setStatusLeft(text) {
  document.getElementById("status-left").textContent = text;
}
function setStatusRight(text) {
  document.getElementById("status-right").textContent = text;
}
function switchPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(pageId);
  if (page) page.classList.add("active");
}
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return m + ":" + s;
}
function downloadCsv(filename, rows) {
  const content = rows.map(r => r.join(",")).join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function generateSessionId() {
  return "S" + Date.now().toString(36);
}
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
// 很簡單的 CSV parser（假設沒有逗號在引號裡）
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => line.split(","));
  return { headers, rows };
}

// ===== 載入 CSV =====
document.getElementById("btn-load-csv").addEventListener("click", () => {
  const input = document.getElementById("file-input");
  const file = input.files && input.files[0];
  if (!file) {
    alert("請先選擇 data.csv");
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const text = String(e.target.result);
    const { headers, rows } = parseCsv(text);

    const idx = {
      Q_ID: headers.indexOf("Q_ID"),
      Year: headers.indexOf("Year"),
      School: headers.indexOf("School"),
      Chapter: headers.indexOf("Chapter"),
      Difficulty: headers.indexOf("Difficulty"),
      ProblemImagePath: headers.indexOf("ProblemImagePath"),
      AnswerImagePath: headers.indexOf("AnswerImagePath"),
      ExtractedText: headers.indexOf("ExtractedText")
    };

    questions = rows.map(cols => ({
      Q_ID: cols[idx.Q_ID] || "",
      Year: cols[idx.Year] || "",
      School: cols[idx.School] || "",
      Chapter: cols[idx.Chapter] || "",
      Difficulty: cols[idx.Difficulty] || "",
      ProblemImagePath: cols[idx.ProblemImagePath] || "",
      AnswerImagePath: cols[idx.AnswerImagePath] || "",
      ExtractedText: cols[idx.ExtractedText] || ""
    }));

    document.getElementById("load-status").textContent =
      `已載入題庫，共 ${questions.length} 題。`;
    setStatusLeft("題庫載入完成");
    setStatusRight(`題目數：${questions.length}`);

    initListFilters();
    renderQuestionsTable();
    recomputeHobbitLog();
    renderHeatmap();
    switchPage("page-list");
  };
  reader.readAsText(file, "utf-8");
});

// ===== 題目列表 =====
function initListFilters() {
  const years = new Set();
  const schools = new Set();
  const chapters = new Set();
  questions.forEach(q => {
    if (q.Year) years.add(q.Year);
    if (q.School) schools.add(q.School);
    if (q.Chapter) chapters.add(q.Chapter);
  });

  const yearSel = document.getElementById("filter-year");
  const schoolSel = document.getElementById("filter-school");
  const chapterSel = document.getElementById("filter-chapter");

  function fillSelect(sel, values) {
    sel.innerHTML = '<option value="">全部</option>';
    Array.from(values)
      .sort()
      .forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
  }

  fillSelect(yearSel, years);
  fillSelect(schoolSel, schools);
  fillSelect(chapterSel, chapters);
}

function getQuestionStats(qid) {
  let lastDate = "";
  let lastTime = 0;
  let skippedCount = 0;
  practiceLog.forEach(entry => {
    if (entry.Q_ID === qid) {
      if (!lastDate || entry.Date > lastDate) {
        lastDate = entry.Date;
        lastTime = entry.TimeSeconds;
      }
      if (entry.Result === "skipped") skippedCount++;
    }
  });
  return { lastDate, lastTime, skippedCount };
}

function getPredictedDiff(qid) {
  let latest = null;
  predictLog.forEach(p => {
    if (p.Q_ID === qid) {
      if (!latest || p.PredictedAt > latest.PredictedAt) {
        latest = p;
      }
    }
  });
  return latest ? latest.PredictedDifficulty : null;
}

function renderQuestionsTable() {
  const tbody = document.querySelector("#questions-table tbody");
  tbody.innerHTML = "";

  const fy = document.getElementById("filter-year").value;
  const fs = document.getElementById("filter-school").value;
  const fc = document.getElementById("filter-chapter").value;
  const sortKey = document.getElementById("sort-key").value;

  let filtered = questions.filter(q => {
    if (fy && q.Year !== fy) return false;
    if (fs && q.School !== fs) return false;
    if (fc && q.Chapter !== fc) return false;
    return true;
  });

  if (sortKey === "Year") {
    filtered.sort((a, b) => (a.Year || "").localeCompare(b.Year || ""));
  } else if (sortKey === "LastDate") {
    filtered.sort((a, b) => {
      const sa = getQuestionStats(a.Q_ID).lastDate || "";
      const sb = getQuestionStats(b.Q_ID).lastDate || "";
      return (sb || "").localeCompare(sa || "");
    });
  }

  filtered.forEach(q => {
    const tr = document.createElement("tr");

    const tdCheck = document.createElement("td");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.dataset.qid = q.Q_ID;
    tdCheck.appendChild(chk);
    tr.appendChild(tdCheck);

    const stats = getQuestionStats(q.Q_ID);
    const pred = getPredictedDiff(q.Q_ID);

    [
      q.Q_ID,
      q.Year,
      q.School,
      q.Chapter,
      q.Difficulty,
      pred != null ? String(pred) : "",
      stats.lastDate,
      stats.lastTime ? formatTime(stats.lastTime) : "",
      stats.skippedCount ? String(stats.skippedCount) : ""
    ].forEach((text, idx) => {
      const td = document.createElement("td");
      if (idx === 5 && text === "") {
        td.textContent = "-";
      } else {
        td.textContent = text;
      }
      tr.appendChild(td);
    });

    const tdImg = document.createElement("td");
    if (q.ProblemImagePath) {
      const img = document.createElement("img");
      img.src = q.ProblemImagePath;
      img.className = "thumbnail";
      img.alt = q.Q_ID;
      tdImg.appendChild(img);
    }
    tr.appendChild(tdImg);

    const tdNotes = document.createElement("td");
    const icon = document.createElement("span");
    icon.className = "notes-icon empty";
    tdNotes.appendChild(icon);
    tr.appendChild(tdNotes);

    tbody.appendChild(tr);
  });
}

document.getElementById("filter-year").addEventListener("change", renderQuestionsTable);
document.getElementById("filter-school").addEventListener("change", renderQuestionsTable);
document.getElementById("filter-chapter").addEventListener("change", renderQuestionsTable);
document.getElementById("sort-key").addEventListener("change", renderQuestionsTable);

document.getElementById("chk-all").addEventListener("change", e => {
  const checked = e.target.checked;
  document
    .querySelectorAll("#questions-table tbody input[type='checkbox']")
    .forEach(chk => {
      chk.checked = checked;
    });
});

// ===== 預測難度 =====
document.getElementById("btn-start-predict").addEventListener("click", () => {
  const checked = Array.from(
    document.querySelectorAll("#questions-table tbody input[type='checkbox']")
  ).filter(chk => chk.checked);

  if (checked.length === 0) {
    alert("請先在列表勾選至少一題。");
    return;
  }

  currentSessionQuestionIds = checked.map(chk => chk.dataset.qid);
  currentSessionId = generateSessionId();
  predictLog = predictLog.filter(p => p.SessionID !== currentSessionId);

  renderPredictPage();
  switchPage("page-predict");
  setStatusLeft(`預測難度 - 題數：${currentSessionQuestionIds.length}`);
});

function renderPredictPage() {
  const container = document.getElementById("predict-list");
  container.innerHTML = "";
  const now = new Date().toISOString();

  currentSessionQuestionIds.forEach(qid => {
    const q = questions.find(x => x.Q_ID === qid);
    if (!q) return;
    const row = document.createElement("div");
    row.className = "panel mt-4";

    const top = document.createElement("div");
    top.className = "field-row";
    const info = document.createElement("div");
    info.className = "small";
    info.textContent = `${q.Q_ID} - ${q.Year} ${q.School} [${q.Chapter}]`;

    const starsDiv = document.createElement("div");
    starsDiv.className = "stars";
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("div");
      star.className = "star";
      star.textContent = i;
      star.dataset.value = String(i);
      star.addEventListener("click", () => {
        const val = Number(star.dataset.value);
        starsDiv.querySelectorAll(".star").forEach(s => {
          s.classList.toggle("active", Number(s.dataset.value) <= val);
        });
        predictLog = predictLog.filter(
          p => !(p.Q_ID === qid && p.SessionID === currentSessionId)
        );
        predictLog.push({
          Q_ID: qid,
          PredictedDifficulty: val,
          PredictedAt: now,
          SessionID: currentSessionId
        });
      });
      starsDiv.appendChild(star);
    }

    top.appendChild(info);
    top.appendChild(starsDiv);

    const imgDiv = document.createElement("div");
    imgDiv.className = "mt-4";
    const img = document.createElement("img");
    img.src = q.ProblemImagePath;
    img.className = "thumbnail";
    img.alt = q.Q_ID;
    imgDiv.appendChild(img);

    row.appendChild(top);
    row.appendChild(imgDiv);

    container.appendChild(row);
  });
}

document
  .getElementById("btn-back-to-list-from-predict")
  .addEventListener("click", () => {
    switchPage("page-list");
  });

document.getElementById("btn-start-practice").addEventListener("click", () => {
  if (currentSessionQuestionIds.length === 0) {
    alert("沒有選取題目。");
    return;
  }
  currentIndex = 0;
  timerSeconds = 0;
  updateTimerDisplay();
  updatePracticeView();
  switchPage("page-practice");
});

// ===== 正式刷題 =====
function updatePracticeView() {
  if (currentIndex < 0) currentIndex = 0;
  if (currentIndex >= currentSessionQuestionIds.length)
    currentIndex = currentSessionQuestionIds.length - 1;

  const qid = currentSessionQuestionIds[currentIndex];
  const q = questions.find(x => x.Q_ID === qid);
  if (!q) return;

  document.getElementById("practice-info").textContent =
    `第 ${currentIndex + 1} / ${currentSessionQuestionIds.length} 題 | Q_ID: ${q.Q_ID} | ${q.Year} ${q.School} [${q.Chapter}]`;

  const imgProblem = document.getElementById("practice-problem-img");
  imgProblem.src = q.ProblemImagePath || "";
  imgProblem.style.display = q.ProblemImagePath ? "block" : "none";

  const imgAnswer = document.getElementById("practice-answer-img");
  imgAnswer.src = q.AnswerImagePath || "";
  imgAnswer.style.display = q.AnswerImagePath ? "none" : "none";

  document.getElementById("answer-status").textContent = q.AnswerImagePath
    ? "按下按鈕可顯示 / 隱藏解答。"
    : "無解答圖片。";

  document.getElementById("practice-notes").value = "";
  timerSeconds = 0;
  updateTimerDisplay();
  stopTimer();
  document.getElementById("btn-timer-toggle").textContent = "開始";
}

document.getElementById("btn-prev").addEventListener("click", () => {
  if (currentIndex > 0) {
    currentIndex--;
    updatePracticeView();
  }
});

document.getElementById("btn-next").addEventListener("click", () => {
  if (currentIndex < currentSessionQuestionIds.length - 1) {
    currentIndex++;
    updatePracticeView();
  }
});

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  document.getElementById("timer").textContent = formatTime(timerSeconds);
}

document.getElementById("btn-timer-toggle").addEventListener("click", () => {
  if (timerInterval) {
    stopTimer();
    document.getElementById("btn-timer-toggle").textContent = "開始";
  } else {
    startTimer();
    document.getElementById("btn-timer-toggle").textContent = "暫停";
  }
});

document.getElementById("btn-timer-reset").addEventListener("click", () => {
  timerSeconds = 0;
  updateTimerDisplay();
});

document.getElementById("btn-toggle-answer").addEventListener("click", () => {
  const imgAnswer = document.getElementById("practice-answer-img");
  if (!imgAnswer.src) return;
  const visible = imgAnswer.style.display !== "none";
  imgAnswer.style.display = visible ? "none" : "block";
});

function recordResult(result) {
  const qid = currentSessionQuestionIds[currentIndex];
  const q = questions.find(x => x.Q_ID === qid);
  if (!q) return;

  const dateStr = todayStr();
  const difficulty = Number(q.Difficulty) || 0;
  const note = document.getElementById("practice-notes").value || "";

  practiceLog.push({
    Q_ID: qid,
    SolutionPath: q.AnswerImagePath || "",
    Date: dateStr,
    TimeSeconds: timerSeconds,
    Difficulty: difficulty,
    Note: note.replace(/[\r\n]+/g, " "),
    Result: result
  });

  timerSeconds = 0;
  updateTimerDisplay();
  document.getElementById("practice-notes").value = "";

  if (currentIndex < currentSessionQuestionIds.length - 1) {
    currentIndex++;
    updatePracticeView();
  } else {
    alert("本輪題目已全部作答，將顯示 Summary。");
    showSummary();
  }

  recomputeHobbitLog();
  renderHeatmap();
  renderQuestionsTable();
}

document.getElementById("btn-correct").addEventListener("click", () => {
  recordResult("correct");
});
document.getElementById("btn-wrong").addEventListener("click", () => {
  recordResult("wrong");
});
document.getElementById("btn-skip").addEventListener("click", () => {
  recordResult("skipped");
});

document.getElementById("btn-end-session").addEventListener("click", () => {
  showSummary();
});

// ===== Summary & Hobbit Log =====
function showSummary() {
  const entries = practiceLog.filter(e =>
    currentSessionQuestionIds.includes(e.Q_ID)
  );
  const total = entries.length;
  const totalTime = entries.reduce((sum, e) => sum + e.TimeSeconds, 0);
  const skipped = entries.filter(e => e.Result === "skipped").length;
  const solved = entries.filter(e => e.Result === "correct").length;
  const avg = total ? Math.round(totalTime / total) : 0;

  const preMap = {};
  predictLog.forEach(p => {
    preMap[p.Q_ID] = p.PredictedDifficulty;
  });

  const diffSum = entries.reduce((sum, e) => {
    const pre = preMap[e.Q_ID];
    if (!pre) return sum;
    return sum + Math.abs(pre - (e.Difficulty || 0));
  }, 0);
  const diffAvg = entries.length ? (diffSum / entries.length).toFixed(2) : "N/A";

  const div = document.getElementById("summary-content");
  div.innerHTML = `
    <p>本輪題目數：${total}</p>
    <p>總作答時間：${formatTime(totalTime)}</p>
    <p>完成題數：${solved}，跳過題數：${skipped}</p>
    <p>平均每題時間：${avg ? formatTime(avg) : "N/A"}</p>
    <p>預測 vs 實際難度差距（絕對值平均）：${diffAvg}</p>
  `;

  switchPage("page-summary");
  setStatusLeft("Summary 完成");
}

document.getElementById("btn-summary-back").addEventListener("click", () => {
  switchPage("page-list");
});

function recomputeHobbitLog() {
  const map = {};
  practiceLog.forEach(e => {
    if (!map[e.Date]) {
      map[e.Date] = {
        Date: e.Date,
        TotalPracticeTime: 0,
        TotalSolved: 0,
        TotalSkipped: 0,
        Note: ""
      };
    }
    map[e.Date].TotalPracticeTime += e.TimeSeconds;
    if (e.Result === "correct") map[e.Date].TotalSolved++;
    if (e.Result === "skipped") map[e.Date].TotalSkipped++;
  });
  hobbitLog = Object.values(map).sort((a, b) => a.Date.localeCompare(b.Date));
  const summaryDiv = document.getElementById("hobbit-summary");
  if (hobbitLog.length === 0) {
    summaryDiv.textContent = "目前尚無練習紀錄。";
  } else {
    const totalTime = hobbitLog.reduce((s, d) => s + d.TotalPracticeTime, 0);
    const totalSolved = hobbitLog.reduce((s, d) => s + d.TotalSolved, 0);
    const totalSkipped = hobbitLog.reduce((s, d) => s + d.TotalSkipped, 0);
    summaryDiv.innerHTML = `
      <p>累積練習天數：${hobbitLog.length}</p>
      <p>累積總時間：${formatTime(totalTime)}</p>
      <p>累積完成題數：${totalSolved}、累積跳過：${totalSkipped}</p>
    `;
  }
}

function renderHeatmap() {
  const container = document.getElementById("heatmap");
  container.innerHTML = "";
  if (hobbitLog.length === 0) {
    for (let i = 0; i < 28; i++) {
      const cell = document.createElement("div");
      cell.className = "heat-cell heat-0";
      container.appendChild(cell);
    }
    return;
  }

  const maxTime =
    hobbitLog.reduce((m, d) => Math.max(m, d.TotalPracticeTime), 0) || 1;
  function level(t) {
    const ratio = t / maxTime;
    if (t === 0) return 0;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }

  hobbitLog.forEach(d => {
    const cell = document.createElement("div");
    cell.className = "heat-cell heat-" + level(d.TotalPracticeTime);
    cell.title = `${d.Date}\n時間：${formatTime(
      d.TotalPracticeTime
    )}\n完成：${d.TotalSolved}\n跳過：${d.TotalSkipped}`;
    container.appendChild(cell);
  });

  const remainder = container.children.length % 7;
  if (remainder !== 0) {
    const need = 7 - remainder;
    for (let i = 0; i < need; i++) {
      const cell = document.createElement("div");
      cell.className = "heat-cell heat-0";
      container.appendChild(cell);
    }
  }
}

// ===== 匯出 logs =====
document.getElementById("btn-export-logs").addEventListener("click", () => {
  if (practiceLog.length === 0 && predictLog.length === 0) {
    alert("目前尚無任何 log 可匯出。");
    return;
  }

  if (practiceLog.length > 0) {
    const rows = [
      ["Q_ID", "SolutionPath", "Date", "TimeSeconds", "Difficulty", "Note", "Result"]
    ];
    practiceLog.forEach(e => {
      rows.push([
        e.Q_ID,
        e.SolutionPath,
        e.Date,
        String(e.TimeSeconds),
        String(e.Difficulty),
        `"${e.Note.replace(/"/g, '""')}"`,
        e.Result
      ]);
    });
    downloadCsv("practice_log.csv", rows);
  }

  if (predictLog.length > 0) {
    const rows = [["Q_ID", "PredictedDifficulty", "PredictedAt", "SessionID"]];
    predictLog.forEach(e => {
      rows.push([
        e.Q_ID,
        String(e.PredictedDifficulty),
        e.PredictedAt,
        e.SessionID
      ]);
    });
    downloadCsv("predict_log.csv", rows);
  }

  if (hobbitLog.length > 0) {
    const rows = [["Date", "TotalPracticeTime", "TotalSolved", "TotalSkipped", "Note"]];
    hobbitLog.forEach(d => {
      rows.push([
        d.Date,
        String(d.TotalPracticeTime),
        String(d.TotalSolved),
        String(d.TotalSkipped),
        `"${(d.Note || "").replace(/"/g, '""')}"`
      ]);
    });
    downloadCsv("hobbit_log.csv", rows);
  }

  setStatusLeft("已匯出 logs");
});
