# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

刷題機 (Exam Practice Machine) V2.0 is a Windows 98-styled web application for practicing exam questions. Built with vanilla JavaScript, it's a single-page application (SPA) that runs entirely in the browser with localStorage for data persistence.

**Key Features:**
- Question bank management with CSV import
- Multiple practice modes (random selection, chapter-based, difficulty-based)
- Difficulty prediction workflow before practice
- Practice session tracking with timer
- Unfinished session recovery
- GitHub-style heatmap for practice logs (Hobbit Log)
- Two UI themes: Windows 98 retro and Pastel modern

## Running the Application

**Local Server (Required for full functionality):**
```bash
# Start HTTP server
python -m http.server 8000

# Open browser
# http://localhost:8000
```

**Why a local server?** Browser security restrictions prevent loading CSV and images via `file://` protocol. Use HTTP protocol for full functionality.

## File Structure

```
exam-practice-machine-V1/
├── index.html           # Main HTML structure (18KB, ~400 lines)
├── app.js               # Core application logic (55KB, ~1828 lines)
├── style-win98.css      # Windows 98 retro theme (21KB)
├── style-pastel.css     # Modern pastel theme (22KB)
├── data.csv             # Question bank (CSV format)
└── images/              # Question images (webp format)
```

## Architecture Overview

### Application Flow

The app follows a multi-page workflow managed by the `showPage()` function:

1. **Load Page** (`page-load`) - Import question bank from CSV
2. **List Page** (`page-list`) - Browse, filter, and select questions
3. **Predict Page** (`page-predict`) - Preview questions and predict difficulty (1-5 stars)
4. **Practice Page** (`page-practice`) - Solve questions with timer
5. **Summary Page** (`page-summary`) - Review session results

### Core State Management

All state is stored in global variables and persisted to `localStorage`:

**Question Data:**
- `allQuestions[]` - Complete question bank loaded from CSV
- `filteredQuestions[]` - Questions after applying filters
- `practiceQuestions[]` - Current practice session questions
- `currentIndex` - Current question position in practice

**Session Data:**
- `practiceLog[]` - All historical practice records
- `predictLog[]` - Difficulty predictions
- `hobbitLog[]` - Daily practice summary for heatmap
- `unfinishedSession` - Saved incomplete session for recovery

**Timer State:**
- `sessionStartTime` - Session start timestamp
- `sessionTotalSeconds` - Total session time
- `questionTimes{}` - Per-question accumulated time
- `timerInterval` - Timer interval reference

### Data Persistence

LocalStorage structure:
```javascript
{
  questions: [...],           // Question bank
  practiceLog: [              // Practice records
    {
      Q_ID: "q-001",
      Date: "2024-12-04",
      TimeSeconds: 120,
      PredictedDifficulty: 3,
      ActualDifficulty: 4,
      Note: "...",
      Result: "Correct|Incorrect|Skipped"
    }
  ],
  hobbitLog: [...],          // Daily summaries
  unfinishedSession: {...}   // Resume data
}
```

### CSV Format

Required columns in `data.csv`:
```csv
ExamID,Year,School,Chapter,Difficulty,Problem Image,Answer Image,Solution Image,Extracted Text
```

- Images must be in `images/` directory (webp format preferred)
- Paths should be relative: `images/q001.webp`
- `Extracted Text` is searchable even when column is hidden

### Code Organization

The 1828-line `app.js` is organized into logical sections:

1. **Global Variables** (lines ~1-35) - State declarations
2. **Initialization** (lines ~35-60) - DOM ready, load data, bind events
3. **Event Binding** (lines ~61-131) - All UI event listeners
4. **LocalStorage Management** (lines ~132-167) - Save/load/export
5. **CSV Loading** (lines ~168-321) - Parse CSV, load questions
6. **List Page** (lines ~322-490) - Filtering, selection, statistics
7. **Random Modes** (lines ~491-569) - 4 random selection modes
8. **Predict Page** (lines ~570-656) - Difficulty prediction workflow
9. **Practice Page** (lines ~657-890) - Question display, answer recording
10. **Summary Page** (lines ~891-945) - Session results
11. **Hobbit Log** (lines ~946-1050) - Heatmap visualization
12. **Timer** (lines ~1051-1121) - Session and per-question timing
13. **Unfinished Session** (lines ~1122-1161) - Resume functionality
14. **Utility Functions** (lines ~1162-1224) - Helpers (getQID, isPracticed, etc.)
15. **Modal Dialogs** (lines ~1225-1254) - Custom alert/confirm
16. **Export/Import** (lines ~1255-1406) - JSON export for backup
17. **Keyboard Shortcuts** (lines ~1407-1513) - A, arrows, 1-5 keys
18. **Theme Switching** (lines ~1514-1563) - Win98 ↔ Pastel
19. **Cloud Sync** (lines ~1564-1824) - Browser-to-browser sync

### Key Functions

**Data Loading:**
- `loadQuestionBank()` - Load CSV from online or local file
- `parseCSV(csvText)` - Parse CSV into question objects
- `loadFromLocalStorage()` - Restore saved data on init

**Practice Session:**
- `startPracticeWithQuestions(questions)` - Begin new session
- `displayQuestion(index)` - Show question in practice mode
- `recordResult(result)` - Save answer (Correct/Incorrect/Skipped)
- `saveForLater()` - Save unfinished session
- `endSession()` - Complete session, show summary

**Timer Management:**
- `startTimer()` / `stopTimer()` - Control session timer
- Timer tracks both total session time and per-question time
- Updates every 1 second via `setInterval`

**Hobbit Log:**
- `renderHobbitLog()` - Generate 90-day heatmap
- `updateHobbitLog()` - Add today's practice to daily log
- Heat levels: 0 (none) → 1 (≤10m) → 2 (≤30m) → 3 (≤60m) → 4 (>60m)

## Common Development Tasks

### Adding a New Practice Mode

1. Add mode option to `#random-mode` select in [index.html](index.html)
2. Update `startRandom3()` in [app.js:502](app.js#L502) with new filter logic
3. Update `updateRandomOptions()` in [app.js:493](app.js#L493) if mode needs extra inputs

### Modifying CSV Schema

1. Update `parseCSV()` header detection in [app.js:272](app.js#L272)
2. Adjust column mapping logic if column names change
3. Update question object access throughout (e.g., `q['Problem Image']`)
4. Document changes in README.md CSV section

### Adding New Statistics

1. Calculate in `updateStatistics()` in [app.js:483](app.js#L483)
2. Display in `#stats-text` element or add new stat elements
3. Consider adding to Summary page in `renderSummaryPage()` at [app.js:891](app.js#L891)

### Theme Modifications

- Win98 theme: [style-win98.css](style-win98.css)
- Pastel theme: [style-pastel.css](style-pastel.css)
- Theme switching logic: `switchTheme()` at [app.js:1514](app.js#L1514)
- Theme preference saved to `localStorage.getItem('theme')`

## Important Technical Details

### Image Loading
- Images must be served via HTTP (not file://)
- Use relative paths: `images/filename.webp`
- Supports lazy loading in table view
- Click to enlarge in practice mode

### Keyboard Shortcuts
In practice mode:
- `A` - Toggle answer visibility
- `←` / `→` - Previous/Next question
- `1-5` - Quick difficulty rating
- `Space` - Pause/resume timer

### Unfinished Session Recovery
- Auto-saves when clicking "改天再戰" (Save for Later)
- On next load, prompts user to resume
- Saves: questions, current index, timer state, all recorded answers
- Check logic in [app.js:1122-1161](app.js#L1122-L1161)

### Cloud Sync
- Simple browser-to-browser sync via IndexedDB sync key
- Not a real cloud service - data stays in browser
- Logic in [app.js:1564-1824](app.js#L1564-L1824)

## Browser Compatibility

Requires modern browser:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Uses: ES6+, LocalStorage, Fetch API, CSS Grid/Flexbox

## Debugging

**Check localStorage:**
```javascript
// In browser console (F12)
console.log(localStorage.getItem('questions'));
console.log(localStorage.getItem('practiceLog'));

// Clear all data
localStorage.clear();
```

**Common Issues:**
- Images not loading → Check HTTP server is running, not file://
- CSV not loading → Check CORS, verify CSV path is correct
- Data not saving → Check localStorage quota (usually 5-10MB limit)
- Timer stuck → Check `timerInterval` state, may need manual cleanup
