/**
 * Removes a tab with the specified tab ID in Google Chrome.
 * @param {number} tabId - The ID of the tab to be removed.
 * @returns {Promise<void>} A promise that resolves when the tab is successfully removed or fails to remove.
 */
function removeChromeTab(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.remove(tabId)
            .then(resolve)
            .catch(resolve);
    });
}


/**
 * Executes a script file in a specific tab in Google Chrome.
 * @param {number} tabId - The ID of the tab where the script should be executed.
 * @param {string} file - The file path or URL of the script to be executed.
 * @returns {Promise<void>} A promise that resolves when the script is successfully executed or fails to execute.
 */
function executeScriptInTab(tabId, file) {
    return new Promise((resolve) => {
        chrome.scripting.executeScript(
            {
                target: {tabId},
                files: [file],
            }, () => {
                resolve();
            }
        );
    });
}


/**
 * Opens the options page of the Chrome extension in a new pinned tab.
 * @returns {Promise<chrome.tabs.Tab>} A promise that resolves with the created tab object.
 */
function openExtensionOptions() {
    return new Promise((resolve) => {
        chrome.tabs.create(
            {
                pinned: true,
                active: false,
                url: `chrome-extension://${chrome.runtime.id}/options.html`,
            },
            (tab) => {
                resolve(tab);
            }
        );
    });
}


/**
 * Retrieves the value associated with the specified key from the local storage in Google Chrome.
 * @param {string} key - The key of the value to retrieve from the local storage.
 * @returns {Promise<any>} A promise that resolves with the retrieved value from the local storage.
 */
function getLocalStorageValue(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key]);
        });
    });
}


/**
 * Sends a message to a specific tab in Google Chrome.
 * @param {number} tabId - The ID of the tab to send the message to.
 * @param {any} data - The data to be sent as the message.
 * @returns {Promise<any>} A promise that resolves with the response from the tab.
 */
function sendExtensionMessage(data) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(data, (response) => {
            resolve(response);
        });
    });
}


/**
 * Delays the execution for a specified duration.
 * @param {number} ms - The duration to sleep in milliseconds (default: 0).
 * @returns {Promise<void>} A promise that resolves after the specified duration.
 */
function delayExecution(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


/**
 * Sets a value associated with the specified key in the local storage of Google Chrome.
 * @param {string} key - The key to set in the local storage.
 * @param {any} value - The value to associate with the key in the local storage.
 * @returns {Promise<any>} A promise that resolves with the value that was set in the local storage.
 */
function setLocalStorageValue(key, value) {
    return new Promise((resolve) => {
        chrome.storage.local.set(
            {
                [key]: value,
            }, () => {
                resolve(value);
            }
        );
    });
}


/**
 * Retrieves the tab object with the specified tabId.
 * @param {number} tabId - The ID of the tab to retrieve.
 * @returns {Promise<object>} - A Promise that resolves to the tab object.
 */
async function getTab(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.get(tabId, (tab) => {
            resolve(tab);
        });
    });
}


/**
 * Starts the capture process for the specified tab.
 * @param {number} tabId - The ID of the tab to start capturing.
 * @returns {Promise<void>} - A Promise that resolves when the capture process is started successfully.
 */
async function startCapture(options) {
    const {tabId, app_config} = options;
    const optionTabId = await getLocalStorageValue("optionTabId");
    if (optionTabId) {
        await removeChromeTab(optionTabId);
    }

    try {
        const currentTab = await getTab(tabId);
        if (currentTab.audible) {
            await setLocalStorageValue("currentTabId", currentTab.id);
            await chrome.windows.create({
                type: 'popup',
                url: `chrome-extension://${chrome.runtime.id}/speechmatics.html`,
                height: 400,
                width: 500,
                top: 20,
                left: 20,
                focused: false
            })

            await chrome.windows.create({
                type: 'popup',
                url: `chrome-extension://${chrome.runtime.id}/deepgram.html`,
                height: 400,
                width: 500,
                top: 600,
                left: 20,
                focused: false
            })

            await chrome.windows.create({
                type: 'popup',
                url: `chrome-extension://${chrome.runtime.id}/soniox.html`,
                height: 400,
                width: 500,
                top: 600,
                left: 1000,
                focused: false
            })

            const optionTab = await openExtensionOptions();

            await setLocalStorageValue("optionTabId", optionTab.id);
            await delayExecution(500);

            await sendExtensionMessage({
                type: "start_capture",
                data: {
                    currentTabId: currentTab.id,
                    app_config
                },
            });
        } else {
            console.log("No Audio");
        }
    } catch (error) {
        console.error("Error occurred while starting capture:", error);
    }
}


/**
 * Stops the capture process and performs cleanup.
 * @returns {Promise<void>} - A Promise that resolves when the capture process is stopped successfully.
 */
async function stopCapture() {
    const optionTabId = await getLocalStorageValue("optionTabId");
    const currentTabId = await getLocalStorageValue("currentTabId");

    if (optionTabId) {
        await sendExtensionMessage({
            type: "STOP",
            data: {currentTabId: currentTabId},
        });
        await removeChromeTab(optionTabId);
    }
}


/**
 * Listens for messages from the runtime and performs corresponding actions.
 * @param {Object} message - The message received from the runtime.
 */
chrome.runtime.onMessage.addListener(async (message) => {
    if (message.action === "startCapture") {
        startCapture(message);
    } else if (message.action === "stopCapture") {
        stopCapture();
    }
});


