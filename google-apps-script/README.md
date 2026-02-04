
# Google Apps Script Setup

This project uses Google Sheets as a low-cost database for market scan history.

## Steps to Deploy

1.  **Create Sheet**: Go to [Google Sheets](https://sheets.new) and create a new sheet named `VN_RSI_STORAGE`.
2.  **Create Script**:
    *   Click `Extensions` > `Apps Script`.
    *   Delete any existing code in `Code.gs`.
    *   Copy the content of `google-apps-script/Code.js` from this repo and paste it into the editor.
3.  **Configure API Key**:
    *   Go to **Project Settings** (Gear icon on left).
    *   Scroll to **Script Properties**.
    *   Click **Add script property**.
    *   Property: `API_KEY`
    *   Value: `my-super-secret-key-123` (Change this to a secure random string).
4.  **Run Setup**:
    *   In the editor, ensure the function dropdown (top bar) says `setupSheet`.
    *   Click **Run**.
    *   Grant the necessary permissions when prompted.
5.  **Deploy Web App**:
    *   Click **Deploy** (blue button top right) > **New deployment**.
    *   Select type: **Web app**.
    *   Description: `Initial Deploy`.
    *   **Execute as**: `Me` (your email).
    *   **Who has access**: `Anyone`. (IMPORTANT for the backend to access it without OAuth complexity).
    *   Click **Deploy**.
6.  **Copy URL**:
    *   Copy the **Web App URL** (ends in `/exec`).
7.  **Environment Variables**:
    *   Add the following to your `.env.local`:
        ```
        GOOGLE_SHEETS_SCRIPT_URL=https://script.google.com/macros/s/......./exec
        GOOGLE_SHEETS_API_KEY=my-super-secret-key-123
        ```
