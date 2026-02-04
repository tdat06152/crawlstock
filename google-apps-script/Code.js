
/**
 * GOOGLE APPS SCRIPT CODE
 * 
 * Instructions:
 * 1. Go to https://script.google.com/
 * 2. New Project
 * 3. Copy this code into Code.gs
 * 4. Deploy -> New Deployment -> Type: Web App
 * 5. Execute as: Me
 * 6. Who has access: Anyone
 * 7. Copy the Deployment URL (WEB_APP_URL)
 * 8. Set properties in File -> Project Properties -> Script Properties (New Editor: Project Settings -> Script Properties)
 *    Key: API_KEY, Value: <Pick a random complex string>
 * 
 * NOTE: You must manually run the setupSheet() function once to initialize the spreadsheet.
 */

const SPREADSHEET_NAME = 'VN_RSI_STORAGE';
const SHEET_SCAN = 'scan_results';
const SHEET_ALERTS = 'alerts_log';

function setupSheet() {
    let ss = getSpreadsheet();
    if (!ss) {
        ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    }

    let sheet = ss.getSheetByName(SHEET_SCAN);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_SCAN);
        sheet.appendRow(['scan_date', 'symbol', 'close', 'rsi', 'state', 'near_flag', 'slope_5', 'distance_to_30', 'distance_to_70', 'updated_at']);
        // Freeze header
        sheet.setFrozenRows(1);
    }

    // Optional: Alerts log
    let alertSheet = ss.getSheetByName(SHEET_ALERTS);
    if (!alertSheet) {
        alertSheet = ss.insertSheet(SHEET_ALERTS);
        alertSheet.appendRow(['created_at', 'symbol', 'message']);
    }
}

function getSpreadsheet() {
    const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
    if (files.hasNext()) {
        return SpreadsheetApp.open(files.next());
    }
    return null;
}

function doPost(e) {
    const lock = LockService.getScriptLock();
    lock.tryLock(10000); // 10s wait

    try {
        if (!verifyAuth(e)) {
            return responseJSON({ error: 'Unauthorized' }, 401);
        }

        const body = JSON.parse(e.postData.contents);
        const action = e.parameter.action || body.action;

        if (action === 'writeScanSnapshot') {
            return writeScanSnapshot(body);
        } else if (action === 'cleanupOldSnapshots') {
            return cleanupOldSnapshots();
        }

        return responseJSON({ error: 'Unknown action' }, 400);

    } catch (err) {
        return responseJSON({ error: err.toString() }, 500);
    } finally {
        lock.releaseLock();
    }
}

function doGet(e) {
    try {
        if (!verifyAuth(e)) {
            return responseJSON({ error: 'Unauthorized' }, 401);
        }

        const action = e.parameter.action;

        if (action === 'getScanSnapshot') {
            const date = e.parameter.date;
            return getScanSnapshot(date);
        }

        return responseJSON({ error: 'Unknown action' }, 400);

    } catch (err) {
        return responseJSON({ error: err.toString() }, 500);
    }
}

function verifyAuth(e) {
    const scriptProperties = PropertiesService.getScriptProperties();
    const validKey = scriptProperties.getProperty('API_KEY');

    // Header check (Apps Script headers are sometimes tricky, check parameter as well)
    // Attempt to read from header X-API-KEY. Caveat: CORS might strip custom headers in simple requests.
    // Safer to pass via query param or body for simple implementations, but let's try strict first.

    // Note: e.parameter is mostly for query params. PostData for body. header is in e.postData usually not accessible easily as map?
    // Actually, Web Apps don't always expose headers cleanly.
    // Best practice for Apps Script Web App: Use a query parameter 'key' or body field 'key'.

    const reqKey = e.parameter.key || (e.postData && e.postData.contents && JSON.parse(e.postData.contents).key);

    // If user wants header, it's safer to rely on payload/query for GAS.
    // Let's support 'key' param.

    return reqKey === validKey;
}

function writeScanSnapshot(data) {
    // data: { scan_date: 'YYYY-MM-DD', rows: [...], key: '...' }
    const ss = getSpreadsheet();
    if (!ss) return responseJSON({ error: 'Spreadsheet not found' }, 404);
    const sheet = ss.getSheetByName(SHEET_SCAN);

    const scanDate = data.scan_date;
    const rows = data.rows;

    if (!rows || rows.length === 0) return responseJSON({ status: 'No rows' });

    // Strategy: Delete existing rows for this date? Or Upsert?
    // User asked for "Snapshot daily". 
    // Efficient ways:
    // 1. Read all scan_dates unique. 
    // 2. Identify rows to delete? 
    // SIMPLEST: Append. Filter later.
    // BETTER: Delete old rows for this scan_date first.

    const values = sheet.getDataRange().getValues();
    // Col 0 is scan_date.
    // Find rows with this scan_date
    let rowsToDelete = [];
    // Loop backwards
    for (let i = values.length - 1; i >= 1; i--) { // skip header 0
        // Date comparison. scan_date in sheet might be Date object or string.
        // Ensure format.
        const rowDate = formatDate(values[i][0]);
        if (rowDate === scanDate) {
            rowsToDelete.push(i + 1);
        }
    }

    // Batch delete is hard in GAS (deleteRow is slow).
    // If many rows, it's better to clear filtering or sort and delete chunk.
    // Optimization: If we assume we process sequentially, we can just append.
    // BUT to avoid duplicates if job re-runs, we should probably check.

    // Let's sort by date descending to group them?

    // For high performance: Just Append. Cleanup job can deduplicate or just ignore duplicates in query (take latest updated_at).
    // Let's overwrite? 
    // Actually, let's just Append for speed, provided we query properly.
    // "Upsert theo (scan_date, symbol)" -> Very slow in Sheets for 2000 symbols.
    // COMPROMISE: We delete all for that date if exists (Costly).

    // NEW STRATEGY: 
    // We won't delete. We trust the job runs once. If it runs twice, we have duplicates.
    // Client side handles duplicates (take latest).

    const newRows = rows.map(r => [
        scanDate,
        r.symbol,
        r.close,
        r.rsi,
        r.state,
        r.near_flag,
        r.slope_5,
        r.distance_to_30,
        r.distance_to_70,
        new Date().toISOString()
    ]);

    if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }

    return responseJSON({ status: 'OK', count: newRows.length });
}

function getScanSnapshot(date) {
    const ss = getSpreadsheet();
    if (!ss) return responseJSON({ error: 'Spreadsheet not found' }, 404);
    const sheet = ss.getSheetByName(SHEET_SCAN);

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];

    // Optimize: Maybe utilize Query if data is huge? 
    // For 200 days * 1000 symbols = 200k rows. JS loop is fine (timeout 5s).

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowDate = formatDate(row[0]);
        if (rowDate === date) {
            results.push({
                symbol: row[1],
                close: row[2],
                rsi: row[3],
                state: row[4],
                near_flag: row[5],
                slope_5: row[6],
                distance_to_30: row[7],
                distance_to_70: row[8],
                updated_at: row[9]
            });
        }
    }

    // Deduplicate by symbol taking latest updated_at
    const mapC = {};
    results.forEach(r => {
        if (!mapC[r.symbol] || new Date(r.updated_at) > new Date(mapC[r.symbol].updated_at)) {
            mapC[r.symbol] = r;
        }
    });

    return responseJSON({ items: Object.values(mapC) });
}

function cleanupOldSnapshots() {
    const ss = getSpreadsheet();
    if (!ss) return responseJSON({ error: 'Spreadsheet not found' }, 404);
    const sheet = ss.getSheetByName(SHEET_SCAN);

    const today = new Date();
    const cutoff = new Date(today.setDate(today.getDate() - 200));

    const data = sheet.getDataRange().getValues();
    // Filter in memory for rows to KEEP
    const rowsToKeep = [data[0]]; // Header

    let deletedCount = 0;
    for (let i = 1; i < data.length; i++) {
        const rowDate = new Date(data[i][0]);
        if (rowDate >= cutoff) {
            rowsToKeep.push(data[i]);
        } else {
            deletedCount++;
        }
    }

    if (deletedCount > 0) {
        sheet.clearContents();
        sheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
    }

    return responseJSON({ status: 'OK', deleted: deletedCount });
}

function formatDate(dateObj) {
    if (!dateObj) return '';
    if (typeof dateObj === 'string') return dateObj; // Assume format is ok?
    try {
        return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } catch (e) {
        return String(dateObj);
    }
}

function responseJSON(data, code = 200) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}
