/**
 * GOOGLE APPS SCRIPT - PHIÊN BẢN CỰC KỲ ỔN ĐỊNH
 * Tự động sửa lỗi lệch cột, hỗ trợ cả định dạng số VN/EN.
 */

const SPREADSHEET_NAME = 'VN_RSI_STORAGE';
const SHEET_SCAN = 'scan_results';

// Cấu trúc cột BẮT BUỘC. Nếu thiếu cột hệ thống sẽ tự chèn.
const HEADERS = [
    'scan_date', 'symbol', 'close', 'rsi', 'state', 'near_flag', 'slope_5',
    'distance_to_30', 'distance_to_70', 'ema200', 'distance_to_ema200_pct',
    'macd', 'macd_signal', 'macd_hist', 'macd_cross', 'ema200_macd_state',
    'bb_mid', 'bb_upper', 'bb_lower', 'bb_bandwidth_pct', 'vol', 'vol_ma20',
    'vol_ratio', 'adx14', 'plus_di14', 'minus_di14', 'bb_state', 'updated_at'
];

/**
 * HÀM QUAN TRỌNG: Chạy hàm này khi headers bị sai.
 * Nó sẽ làm mới hàng tiêu đề và xóa trắng dữ liệu để bắt đầu lại (nếu muốn).
 */
function forceSetup() {
    const ss = getSpreadsheet() || SpreadsheetApp.create(SPREADSHEET_NAME);
    let sheet = ss.getSheetByName(SHEET_SCAN) || ss.insertSheet(SHEET_SCAN);

    sheet.clear(); // Xóa sạch để tránh lệch dữ liệu cũ
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return "Đã làm mới Sheet và Headers thành công!";
}

function setupSheet() {
    const ss = getSpreadsheet() || SpreadsheetApp.create(SPREADSHEET_NAME);
    let sheet = ss.getSheetByName(SHEET_SCAN) || ss.insertSheet(SHEET_SCAN);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
}

function getSpreadsheet() {
    try { return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.open(DriveApp.getFilesByName(SPREADSHEET_NAME).next()); } catch (e) { return null; }
}

function doPost(e) {
    const body = JSON.parse(e.postData.contents);
    if (body.key !== PropertiesService.getScriptProperties().getProperty('API_KEY')) return responseJSON({ error: 'Unauthorized' }, 401);

    if (body.action === 'writeScanSnapshot') return writeScanSnapshot(body);
    if (body.action === 'cleanupOldSnapshots') return cleanupOldSnapshots();
    return responseJSON({ error: 'Unknown action' }, 400);
}

function doGet(e) {
    if (e.parameter.key !== PropertiesService.getScriptProperties().getProperty('API_KEY')) return responseJSON({ error: 'Unauthorized' }, 401);
    if (e.parameter.action === 'getScanSnapshot') return getScanSnapshot(e.parameter.date);
    return responseJSON({ error: 'Unknown action' }, 400);
}

function writeScanSnapshot(data) {
    const sheet = getSpreadsheet().getSheetByName(SHEET_SCAN);
    const rows = data.rows || [];
    const snapshotDate = data.scan_date;

    // Ánh xạ dữ liệu theo đúng tên Header để chống lệch cột
    const values = rows.map(r => {
        return HEADERS.map(h => {
            if (h === 'scan_date') return snapshotDate;
            if (h === 'updated_at') return new Date().toISOString();
            let val = r[h];
            return (val === null || val === undefined) ? '' : val;
        });
    });

    if (values.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, values.length, HEADERS.length).setValues(values);
    }
    return responseJSON({ status: 'OK', count: values.length });
}

function getScanSnapshot(date) {
    const sheet = getSpreadsheet().getSheetByName(SHEET_SCAN);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return responseJSON({ items: [] });

    const headers = data[0];
    const idx = {};
    headers.forEach((h, i) => idx[h] = i);

    const results = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (formatDate(row[idx['scan_date']]) !== date) continue;

        const obj = {};
        HEADERS.forEach(h => {
            let val = row[idx[h]];
            if (val === undefined) val = null;

            // Xử lý số học: Chuyển đổi dấu phẩy (VN locale) sang dấu chấm
            if (typeof val === 'string' && /^-?\d+,\d+$/.test(val.trim())) {
                val = parseFloat(val.trim().replace(',', '.'));
            }

            obj[h] = val;
        });
        results.push(obj);
    }

    // Lấy bản ghi mới nhất cho mỗi mã
    const unique = {};
    results.forEach(r => {
        if (!unique[r.symbol] || new Date(r.updated_at) > new Date(unique[r.symbol].updated_at)) {
            unique[r.symbol] = r;
        }
    });

    return responseJSON({ items: Object.values(unique) });
}

function cleanupOldSnapshots() {
    const sheet = getSpreadsheet().getSheetByName(SHEET_SCAN);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 200);
    const data = sheet.getDataRange().getValues();
    const keep = [data[0]].concat(data.slice(1).filter(r => new Date(r[0]) >= cutoff));

    sheet.clearContents();
    if (keep.length > 0) sheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
    return responseJSON({ status: 'OK', deleted: data.length - keep.length });
}

function formatDate(d) {
    try {
        if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (typeof d === 'string' && d.includes('T')) return d.split('T')[0];
        return String(d);
    } catch (e) { return String(d); }
}

function responseJSON(d, c = 200) {
    return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON);
}
