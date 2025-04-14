// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra'); // Use fs-extra for ensureFileSync and appendFile
const axios = require('axios');

console.log('[Main] App starting...'); // Log start

// Disable GPU to avoid hardware acceleration issues
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.disableHardwareAcceleration();

// Ensure that the request.log file exists
const logFilePath = path.join(__dirname, 'request.log');
try {
    fs.ensureFileSync(logFilePath); // Create the log file if it doesn't exist
    fs.appendFileSync(logFilePath, `\n[${new Date().toISOString()}] ====== APP STARTING ======\n`); // Log app start
    console.log(`[Main] Log file ensured at: ${logFilePath}`);
} catch (err) {
    console.error('[Main] CRITICAL: Failed to ensure log file exists!', err);
    // Optionally, terminate the app if logging is critical
    // app.quit();
}

// Function to append log entries consistently
async function writeToLog(logEntry) {
    try {
        await fs.appendFile(logFilePath, logEntry + '\n'); // Add newline automatically
        console.log(logEntry); // Also log to console
    } catch (err) {
        console.error(`[Main] FAILED TO WRITE TO LOG FILE: ${err.message}`);
        console.error(`[Main] Original log message was: ${logEntry}`);
    }
}

function createWindow() {
    writeToLog(`[${new Date().toISOString()}] [Main] Creating browser window...`);
    const win = new BrowserWindow({
        width: 1000,
        height: 650,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true // Explicitly enable DevTools
        }
    });

    win.loadFile('index.html')
        .then(() => writeToLog(`[${new Date().toISOString()}] [Main] index.html loaded successfully.`))
        .catch(err => writeToLog(`[${new Date().toISOString()}] [Main] ERROR loading index.html: ${err.message}`));

    // Open DevTools automatically - VERY helpful for debugging renderer issues
    win.webContents.openDevTools();
    writeToLog(`[${new Date().toISOString()}] [Main] DevTools opened.`);
}

app.whenReady().then(() => {
    writeToLog(`[${new Date().toISOString()}] [Main] App is ready.`);
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        writeToLog(`[${new Date().toISOString()}] [Main] All windows closed, quitting app.`);
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        writeToLog(`[${new Date().toISOString()}] [Main] App activated, creating window.`);
        createWindow();
    }
});

// *** Listener for log messages from renderer/preload ***
ipcMain.on('log-message', (_, logPayload) => {
  const { level, message } = logPayload;
  const logEntry = `[${new Date().toISOString()}] [Renderer][${level.toUpperCase()}] ${message}`;
  // No need to await here as it's a one-way message, just write to log
  writeToLog(logEntry);
});


// Handle requests and log them
ipcMain.handle('send-request', async (_, payload) => {
    const { method, url, headers, body } = payload;
    const timestamp = new Date().toISOString();

    await writeToLog(`[${timestamp}] [Main][Request] === Start ===`);
    await writeToLog(`[${timestamp}] [Main][Request] METHOD: ${method}, URL: ${url}`);
    await writeToLog(`[${timestamp}] [Main][Request] HEADERS: ${JSON.stringify(headers)}`);
    await writeToLog(`[${timestamp}] [Main][Request] BODY: ${method !== "GET" ? JSON.stringify(body) : '<Not Applicable>'}`);

    try {
        const response = await axios({
            method,
            url,
            headers,
            data: method !== "GET" && method !== "DELETE" ? body : undefined,
             timeout: 10000 // Add a timeout (e.g., 10 seconds)
        });

        const responseTimestamp = new Date().toISOString();
        await writeToLog(`[${responseTimestamp}] [Main][Response] STATUS: ${response.status}`);
        // Log only a snippet of large data to prevent log bloating
        const responseDataString = JSON.stringify(response.data);
        const snippet = responseDataString.length > 500 ? responseDataString.substring(0, 500) + '...' : responseDataString;
        await writeToLog(`[${responseTimestamp}] [Main][Response] DATA: ${snippet}`);
        await writeToLog(`[${responseTimestamp}] [Main][Request] === Success End ===`);
        return { data: response.data };

    } catch (err) {
        const errorTimestamp = new Date().toISOString();
        let errorDetails = '';
        if (err.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
             errorDetails = `Status: ${err.response.status}, Data: ${JSON.stringify(err.response.data)}`;
        } else if (err.request) {
            // The request was made but no response was received
             errorDetails = 'No response received from server.';
        } else {
            // Something happened in setting up the request that triggered an Error
             errorDetails = `Error setting up request: ${err.message}`;
        }
        await writeToLog(`[${errorTimestamp}] [Main][Error] ${errorDetails}`);
        await writeToLog(`[${errorTimestamp}] [Main][Error] Full Error: ${err.toString()}`); // Log full error string
        await writeToLog(`[${errorTimestamp}] [Main][Request] === Error End ===`);
        return { error: err.toString() };
    }
});

// Handle unhandled promise rejections globally
process.on('unhandledRejection', (reason, promise) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [Main][Unhandled Rejection] Reason: ${reason instanceof Error ? reason.stack : reason}`;
    writeToLog(logEntry);
    // It's often good to also log the promise details if available, though it can be complex
    // writeToLog(`[${timestamp}] [Main][Unhandled Rejection] Promise: ${promise}`);
});

// Handle uncaught exceptions globally
process.on('uncaughtException', (error) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [Main][Uncaught Exception] ${error.stack || error.message}`;
    writeToLog(logEntry);
    // Consider exiting the app after an uncaught exception, as the state might be corrupted
    // process.exit(1);
});