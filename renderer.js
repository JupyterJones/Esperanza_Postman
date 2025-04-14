// renderer.js

// --- Helper function for logging ---
function logRenderer(level, message) {
    console[level](`[Renderer] ${message}`); // Log to DevTools console
    if (window.electronAPI && window.electronAPI.logMessage) {
        window.electronAPI.logMessage(level, message); // Send to main process log file
    } else {
        console.warn('[Renderer] electronAPI.logMessage not available. Cannot log to file.');
    }
}
// --- End Helper ---


logRenderer('info', 'Script starting.');

// Check if the electronAPI is exposed by the preload script
if (window.electronAPI && window.electronAPI.sendRequest && window.electronAPI.logMessage) {
    logRenderer('info', 'electronAPI and required functions found.');

    document.addEventListener('DOMContentLoaded', () => {
        logRenderer('info', 'DOMContentLoaded event fired.');
        try { // Wrap DOMContentLoaded logic
            // Select the specific button by its ID
            const sendButton = document.getElementById('send-button');
            // Select the other elements
            const methodSelect = document.getElementById("method");
            const urlInput = document.getElementById("url");
            const headersTextarea = document.getElementById("headers");
            const bodyTextarea = document.getElementById("body");
            const responseBox = document.getElementById("response");

            if (sendButton && methodSelect && urlInput && headersTextarea && bodyTextarea && responseBox) {
                logRenderer('info', 'All required UI elements found.');

                sendButton.addEventListener('click', async () => {
                    logRenderer('info', 'Send Button clicked.'); // Log click immediately
                    try { // Wrap button click logic
                        // Add visual feedback
                        sendButton.classList.add('clicked');
                        sendButton.textContent = "Sending...";
                        responseBox.textContent = "📡 Processing request..."; // Update status

                        const method = methodSelect.value;
                        const url = urlInput.value;
                        const headers = headersTextarea.value;
                        const body = bodyTextarea.value;

                        logRenderer('info', `Method: ${method}, URL: ${url}`);

                        let parsedHeaders = {};
                        try {
                            parsedHeaders = JSON.parse(headers || '{}');
                            logRenderer('info', 'Headers JSON parsed successfully.');
                        } catch (e) {
                            logRenderer('warn', `Could not parse Headers JSON: ${e.message}. Using empty object.`);
                            // Don't throw, just use default empty object
                        }

                        let parsedBody = {};
                        // Only parse body if it's not empty and method likely requires it
                        if (body.trim() && method !== 'GET' && method !== 'DELETE') {
                            try {
                                parsedBody = JSON.parse(body);
                                logRenderer('info', 'Body JSON parsed successfully.');
                            } catch (e) {
                                logRenderer('error', `Invalid Body JSON: ${e.message}`);
                                responseBox.textContent = `❌ Invalid Body JSON: ${e.message}`;
                                // Reset button state early on JSON error
                                setTimeout(() => {
                                    sendButton.classList.remove('clicked');
                                    sendButton.textContent = "Send";
                                }, 500);
                                return; // Stop processing if body JSON is invalid
                            }
                        } else {
                             logRenderer('info', 'Body is empty or method is GET/DELETE, skipping body parsing.');
                        }

                        const payload = {
                            method,
                            url,
                            headers: parsedHeaders,
                            body: (method !== 'GET' && method !== 'DELETE' && body.trim()) ? parsedBody : undefined
                        };

                        logRenderer('info', 'Invoking electronAPI.sendRequest...');
                        const result = await window.electronAPI.sendRequest(payload);
                        logRenderer('info', 'Received result from electronAPI.sendRequest.');

                        if (result.error) {
                            responseBox.textContent = "❌ Error: " + result.error;
                            logRenderer('error', `Request failed: ${result.error}`);
                        } else {
                            responseBox.textContent = JSON.stringify(result.data, null, 2);
                            logRenderer('info', 'Request succeeded.');
                        }
                    } catch (e) {
                        // Catch errors within the click handler logic
                        logRenderer('error', `Error during button click processing: ${e.stack || e.message}`);
                        responseBox.textContent = `❌ Client-side Error: ${e.message}`;
                    } finally {
                         // Remove visual feedback after a delay, regardless of success/error
                        setTimeout(() => {
                            if (sendButton) { // Check if button still exists
                               sendButton.classList.remove('clicked');
                               sendButton.textContent = "Send";
                               logRenderer('info', 'Button visual state reset.');
                            }
                        }, 1500);
                    }
                }); // End of event listener

                logRenderer('info', 'Click event listener attached to send button.');

            } else {
                logRenderer('error', "Could not find one or more required UI elements!");
                if(responseBox) responseBox.textContent = "Error: Critical UI elements missing.";
            }
        } catch(e) {
             logRenderer('error', `Critical error during DOMContentLoaded setup: ${e.stack || e.message}`);
             const responseBox = document.getElementById("response");
             if(responseBox) responseBox.textContent = `FATAL ERROR during page setup: ${e.message}`;
        }
    }); // End of DOMContentLoaded listener

} else {
    logRenderer('error', 'Electron API or required functions not found! Preload script likely failed or did not expose functions correctly.');
    // Optionally display an error to the user in the UI early
    const responseBox = document.getElementById("response");
     if(responseBox) {
       responseBox.textContent = "FATAL ERROR: Could not connect to main process. Preload script failed.";
     } else {
        // Fallback if even responseBox isn't ready
        alert("FATAL ERROR: Could not initialize communication bridge. Preload script failed.");
     }
}