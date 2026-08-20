import { pipeline, env } from '@xenova/transformers';

// Skip local model check since we are running in the browser
env.allowLocalModels = false;
env.useBrowserCache = true;

// CRITICAL FIX: Disable multithreading to prevent SharedArrayBuffer crashes in Electron's file:// protocol
env.backends.onnx.wasm.numThreads = 1;

class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    // We expect the audio data as a Float32Array (16kHz PCM data)
    const { audio, type } = event.data;

    if (type === 'load') {
        // Pre-load the model
        try {
            await PipelineSingleton.getInstance((x) => {
                // We can send progress updates back to the UI if we want to show a loading bar
                self.postMessage({ status: 'progress', data: x });
            });
            self.postMessage({ status: 'ready' });
        } catch (err) {
            self.postMessage({ status: 'error', data: err.message });
        }
        return;
    }

    if (type === 'transcribe' && audio) {
        try {
            const transcriber = await PipelineSingleton.getInstance();
            
            // Generate transcription
            const output = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                // You can specify language if needed, but whisper-tiny auto-detects by default
            });

            self.postMessage({
                status: 'complete',
                output: output
            });
        } catch (error) {
            self.postMessage({ status: 'error', data: error.message });
        }
    }
});
