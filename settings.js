const app_config = {
    /* API Keys */

    SPEECHMATICS_API_KEY: "G3l1PVJiEdMOOdWsvobIWwSpJPuUJiUh",
    DEEPGRAM_API_KEY: "e494bd9e59b648f87ca4e8259b0ea6d8defe2bdf",
    SONIOX_API_KEY: "e0f6c1d2146e84de0d33787654634f10a50fda2732a118560135dfab3d7b7480",

    // https://docs.speechmatics.com/rt-api-ref#transcription-config
    speechmatics_config: {
        language: "en",
        enable_partials: true,
        // additional_vocab: [],
        // diarization: "none",
        // speaker_diarization_config: {
        //     max_speakers: 50
        // },
        // max_delay: 10,
        // max_delay_mode: "flexible",
        // output_locale: "",
        // punctuation_overrides: {
        //     permitted_marks:[ ".", "," ],
        //     sensitivity: 0.4
        // },
        // operating_point: "standard",
        // enable_entities: false
    },

    // https://developers.deepgram.com/reference/listen-live#query-params
    deepgram_config: {
        model: "general-enhanced",
        interim_results: true,
        smart_format: true,
        // callback: "",
        // callback_method: "",
        // channels: "",
        // diarize: "",
        // diarize_version: "",
        // encoding: "",
        // endpointing: "",
        // extra: "",
        // filler_words: "",
        // keywords: "",
        // language: "",
        // multichannel: "",
        // numerals: "",
        // profanity_filter: "",
        // punctuate: "",
        // redact: "",
        // replace: "",
        // sample_rate: "",
        // search: "",
        // tag: "",
        // utterance_end_ms: "",
        // vad_events: "",
        // version: ""
    },

    // https://github.com/soniox/web_voice/blob/master/src/web_voice.js#L397
    soniox_config: {
        model: "en_v2_lowlatency",
        audio_format: "pcm_f32le",
        sample_rate_hertz: 16000,
        num_audio_channels: 1,
        include_nonfinal: true,
        // speech_context: {},
        // enable_endpoint_detection: true,
        // enable_streaming_speaker_diarization: true,
        // enable_global_speaker_diarization: true,
        // min_num_speakers: 0,
        // max_num_speakers: 0,
        // enable_speaker_identification: true,
        // cand_speaker_names: [],
        // enable_profanity_filter: true,
        // content_moderation_phrases: [],
        // enable_dictation: true
    },
}
