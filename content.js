let text = ""
const pageTitle = document.title.toLowerCase()
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const {type, dest, data} = request;

    if (type === "STOP") {
        window.close();
    } else if (type === "transcript") {
        if (dest !== pageTitle) {
            return
        }

        const printText = text + data.text
        if (data.isFinal) {
            text += data.text
        }

        document.body.innerHTML = printText
        window.scrollTo(0, document.body.scrollHeight);
    }
});
