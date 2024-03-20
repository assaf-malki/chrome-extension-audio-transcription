import {RealtimeSession} from 'speechmatics';

/**
 * Captures audio from the active tab in Google Chrome.
 * @returns {Promise<MediaStream>} A promise that resolves with the captured audio stream.
 */
function captureTabAudio() {
    return new Promise((resolve) => {
        chrome.tabCapture.capture(
            {
                audio: true,
                video: false,
            },
            (stream) => {
                resolve(stream);
            }
        );
    });
}

async function getKey(option) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", `Bearer ${option.app_config.SPEECHMATICS_API_KEY}`);

    const raw = JSON.stringify({
        "ttl": 3600
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };

    try {
        const response = await fetch("https://mp.speechmatics.com/v1/api_keys?type=rt", requestOptions);
        return await response.json();
    } catch (error) {
        console.error(error);
    }
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
 * Resamples the audio data to a target sample rate of 16kHz.
 * @param {Array|ArrayBuffer|TypedArray} audioData - The input audio data.
 * @param {number} [origSampleRate=44100] - The original sample rate of the audio data.
 * @returns {Float32Array} The resampled audio data at 16kHz.
 */
function resampleTo16kHZ(audioData, origSampleRate = 44100) {
    // Convert the audio data to a Float32Array
    const data = new Float32Array(audioData);

    // Calculate the desired length of the resampled data
    const targetLength = Math.round(data.length * (16000 / origSampleRate));

    // Create a new Float32Array for the resampled data
    const resampledData = new Float32Array(targetLength);

    // Calculate the spring factor and initialize the first and last values
    const springFactor = (data.length - 1) / (targetLength - 1);
    resampledData[0] = data[0];
    resampledData[targetLength - 1] = data[data.length - 1];

    // Resample the audio data
    for (let i = 1; i < targetLength - 1; i++) {
        const index = i * springFactor;
        const leftIndex = Math.floor(index).toFixed();
        const rightIndex = Math.ceil(index).toFixed();
        const fraction = index - leftIndex;
        resampledData[i] = data[leftIndex] + (data[rightIndex] - data[leftIndex]) * fraction;
    }

    // Return the resampled data
    return resampledData;
}

function deepgramTranscript(stream, option) {
    const context = new AudioContext();
    const dest = context.createMediaStreamDestination()
    const mediaStream = context.createMediaStreamSource(stream);
    mediaStream.connect(dest)

    const recorder = new MediaRecorder(dest.stream, {mimeType: 'audio/webm'})

    const queryParams = new URLSearchParams(option.app_config.deepgram_config).toString()
    const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${queryParams}`, ['token', option.app_config.DEEPGRAM_API_KEY])

    recorder.addEventListener('dataavailable', evt => {
        if (evt.data.size > 0 && socket.readyState === 1) socket.send(evt.data)
    })

    socket.onopen = () => {
        recorder.start(250)
    }

    let sentence = ""
    let speakers = new Set()
    const speaker_words = new Array(10)
    for (let i = 0; i < speaker_words.length; i++) {
        speaker_words[i] = [];
    }
    socket.onmessage = msg => {
        const data = JSON.parse(msg.data)
        const isFinal = data.is_final
        let {transcript} = data.channel.alternatives[0]
        if (transcript) {
            if (option.app_config.deepgram_config.diarize) {
                data.channel.alternatives[0].words.forEach((word_info) => {
                    if (word_info.punctuated_word) {
                        speakers.add(word_info.speaker)
                        speaker_words[word_info.speaker].push(word_info.punctuated_word)
                    }
                })
                speakers.forEach((speaker) => {
                    sentence += `S${speaker}: ${speaker_words[speaker].join(" ").trim()} `
                    speaker_words[speaker] = []
                })
                speakers = new Set()
            } else {
                sentence = transcript
            }
            if (isFinal) sentence += " ";
            sendExtensionMessage({
                type: "transcript",
                dest: "deepgram",
                data: {text: sentence, isFinal},
            })
            sentence = ""
        }
    }
}

async function speechmaticsTranscript(stream, option) {
    const sessionKey = await getKey(option)
    const session = new RealtimeSession(sessionKey.key_value);

    //add listeners
    session.addListener('RecognitionStarted', () => {
        console.log('RecognitionStarted');
    });

    session.addListener('Error', (error) => {
        console.log('session error', error);
    });

    session.addListener('AddPartialTranscript', (message) => {
        sendExtensionMessage({
            type: "transcript",
            dest: "speechmatics",
            data: {text: message.metadata.transcript, isFinal: false},
        })
    });

    session.addListener('AddTranscript', (message) => {
        sendExtensionMessage({
            type: "transcript",
            dest: "speechmatics",
            data: {text: message.metadata.transcript, isFinal: true},
        })
    });

    session.addListener('EndOfTranscript', () => {
        console.log('EndOfTranscript');
    });

    let isServerReady = false;

    //start session which is an async method
    await session.start({
        audio_format: {
            type: "raw",
            encoding: "pcm_f32le",
            sample_rate: 16000
        },
        transcription_config: option.app_config.speechmatics_config
    })
    isServerReady = true;

    const context = new AudioContext();
    const mediaStream = context.createMediaStreamSource(stream);
    const recorder = context.createScriptProcessor(4096, 1, 1);

    recorder.onaudioprocess = async (event) => {
        if (!context || !isServerReady) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const audioData16kHz = resampleTo16kHZ(inputData, context.sampleRate);

        session.sendAudio(audioData16kHz)
    };

    // Prevent page mute
    mediaStream.connect(recorder);
    recorder.connect(context.destination);
}

async function sonioxTranscript(stream, option) {
    const socket = new WebSocket('wss://api.soniox.com/transcribe-websocket')

    const context = new AudioContext();
    const mediaStream = context.createMediaStreamSource(stream);
    const recorder = context.createScriptProcessor(4096, 1, 1);

    let isServerReady = false
    recorder.onaudioprocess = async (event) => {
        if (!context || !isServerReady) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const audioData16kHz = resampleTo16kHZ(inputData, context.sampleRate);

        socket.send(audioData16kHz)
    };

    socket.onopen = () => {
        let request = {
            api_key: option.app_config.SONIOX_API_KEY,
            ...option.app_config.soniox_config
        };
        socket.send(JSON.stringify(request));
        isServerReady = true
    }

    let sentence = ""
    let speakers = new Set()
    const speaker_words = new Array(10)
    for (let i = 0; i < speaker_words.length; i++) {
        speaker_words[i] = [];
    }

    let previousNotFinalSentence = ""
    socket.onmessage = msg => {
        let finalSentence = "";
        let notFinalSentence = "";
        const response = JSON.parse(msg.data);

        if (option.app_config.soniox_config.enable_streaming_speaker_diarization) {
            response.fw.forEach(function (jsWord) {
                speakers.add(jsWord.spk)
                speaker_words[jsWord.spk].push(jsWord.t)
            });
            speakers.forEach((speaker) => {
                finalSentence += `S${speaker}: ${speaker_words[speaker].join("").trim()} `
                speaker_words[speaker] = []
            })
            speakers = new Set()

            // response.nfw.forEach(function (jsWord) {
            //     speakers.add(jsWord.spk)
            //     speaker_words[jsWord.spk].push(jsWord.t)
            // });
            // speakers.forEach((speaker) => {
            //     notFinalSentence += `S${speaker}: ${speaker_words[speaker].join("").trim()} `
            //     speaker_words[speaker] = []
            // })
            // speakers = new Set()
        } else {
            response.fw.forEach(function (jsWord) {
                finalSentence += jsWord.t
            });
            response.nfw.forEach(function (jsWord) {
                notFinalSentence += jsWord.t
            });
        }

        if (finalSentence) {
            sendExtensionMessage({
                type: "transcript",
                dest: "soniox",
                data: {text: finalSentence, isFinal: true},
            }).then(() => {
                if (notFinalSentence && previousNotFinalSentence !== notFinalSentence) {
                    previousNotFinalSentence = notFinalSentence
                    sendExtensionMessage({
                        type: "transcript",
                        dest: "soniox",
                        data: {text: notFinalSentence, isFinal: false},
                    })
                }
            })
        } else if (notFinalSentence && previousNotFinalSentence !== notFinalSentence) {
            previousNotFinalSentence = notFinalSentence
            sendExtensionMessage({
                type: "transcript",
                dest: "soniox",
                data: {text: notFinalSentence, isFinal: false},
            })
        }
    }

    // Prevent page mute
    mediaStream.connect(recorder);
    recorder.connect(context.destination);
    mediaStream.connect(context.destination);
}

/**
 * Starts recording audio from the captured tab.
 * @param {Object} option - The options object containing the currentTabId.
 */
async function startRecord(option) {
    const stream = await captureTabAudio();

    if (stream) {
        // call when the stream inactive
        stream.oninactive = () => {
            window.close();
        };

        speechmaticsTranscript(stream, option)
        deepgramTranscript(stream, option)
        sonioxTranscript(stream, option)
    } else {
        window.close();
    }
}

/**
 * Listener for incoming messages from the extension's background script.
 * @param {Object} request - The message request object.
 * @param {Object} sender - The sender object containing information about the message sender.
 * @param {Function} sendResponse - The function to send a response back to the message sender.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const {type, data} = request;

    switch (type) {
        case "start_capture":
            startRecord(data);
            break;
        default:
            break;
    }
});
