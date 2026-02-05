
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

const HEADERS = [
    'scan_date', 'symbol', 'close',
    'rsi', 'state', 'near_flag', 'slope_5', 'distance_to_30', 'distance_to_70',
    'ema200', 'distance_to_ema200_pct', 'macd', 'macd_signal', 'macd_hist', 'macd_cross', 'ema200_macd_state',
    'bb_mid', 'bb_upper', 'bb_lower', 'bb_bandwidth_pct', 'vol', 'vol_ma20', 'vol_ratio', 'adx14', 'plus_di14', 'minus_di14', 'bb_state',
    'updated_at'
];

function setupSheet() {
    let ss = getSpreadsheet();
    if (!ss) {
        ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    }

    let sheet = ss.getSheetByName(SHEET_SCAN);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_SCAN);
        sheet.appendRow(HEADERS);
        sheet.setFrozenRows(1);
    } else {
        // Update headers to ensure all columns are present
        sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }

    // Optional: Alerts log
    let alertSheet = ss.getSheetByName(SHEET_ALERTS);
    if (!alertSheet) {
        alertSheet = ss.insertSheet(SHEET_ALERTS);
        alertSheet.appendRow(['created_at', 'symbol', 'message']);
    }
}

function getSpreadsheet() {
    try {
        const active = SpreadsheetApp.getActiveSpreadsheet();
        if (active) return active;
    } catch (e) {
        // Not bound
    }
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
    let validKey = scriptProperties.getProperty('API_KEY');
    if (validKey) validKey = validKey.trim();

    let reqKey = e.parameter.key;

    if (!reqKey && e.postData && e.postData.contents) {
        try {
            const body = JSON.parse(e.postData.contents);
            reqKey = body.key;
        } catch (err) {
            // Not JSON
        }
    }

    if (reqKey) reqKey = reqKey.trim();

    return reqKey === validKey;
}

function writeScanSnapshot(data) {
    const ss = getSpreadsheet();
    if (!ss) return responseJSON({ error: 'Spreadsheet not found' }, 404);
    const sheet = ss.getSheetByName(SHEET_SCAN);

    const scanDate = data.scan_date;
    const rows = data.rows;

    if (!rows || rows.length === 0) return responseJSON({ status: 'No rows' });

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
        r.ema200,
        r.distance_to_ema200_pct,
        r.macd,
        r.macd_signal,
        r.macd_hist,
        r.macd_cross,
        r.ema200_macd_state,
        r.bb_mid,
        r.bb_upper,
        r.bb_lower,
        r.bb_bandwidth_pct,
        r.vol,
        r.vol_ma20,
        r.vol_ratio,
        r.adx14,
        r.plus_di14,
        r.minus_di14,
        r.bb_state,
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
    const results = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowDate = formatDate(row[0]);
        if (rowDate === date) {
            results.push({
                scan_date: rowDate,
                symbol: row[1],
                close: row[2],
                rsi: row[3],
                state: row[4],
                near_flag: row[5],
                slope_5: row[6],
                distance_to_30: row[7],
                distance_to_70: row[8],
                ema200: row[9],
                distance_to_ema200_pct: row[10],
                macd: row[11],
                macd_signal: row[12],
                macd_hist: row[13],
                macd_cross: row[14],
                ema200_macd_state: row[15],
                bb_mid: row[16],
                bb_upper: row[17],
                bb_lower: row[18],
                bb_bandwidth_pct: row[19],
                vol: row[20],
                vol_ma20: row[21],
                vol_ratio: row[22],
                adx14: row[23],
                plus_di14: row[24],
                minus_di14: row[25],
                bb_state: row[26],
                updated_at: row[27]
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
