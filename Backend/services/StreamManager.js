import Stream from 'node-rtsp-stream';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';


// Prepend ffmpeg-static directory to PATH so node-rtsp-stream finds it
process.env.PATH = path.dirname(ffmpegPath) + path.delimiter + process.env.PATH;

const activeStreams = new Map(); // key: streamId, value: { wsPort, stream, clientsCount, timeoutId }
let nextWsPort = 9000; // Start WebSocket ports from 9000

/**
 * Starts or retrieves an existing RTSP stream for a camera.
 * Implementing auto-shutdown when no clients are connected to save CPU.
 */
export const startCameraStream = async (cameraId, rtspUrl) => {
  if (activeStreams.has(cameraId)) {
    const streamInfo = activeStreams.get(cameraId);
    
    // Clear any pending shutdown timeouts since a client requested it
    if (streamInfo.timeoutId) {
      clearTimeout(streamInfo.timeoutId);
      streamInfo.timeoutId = null;
    }
    
    return { wsPort: streamInfo.wsPort, status: 'active' };
  }

  try {
    const wsPort = nextWsPort++;
    
    const stream = new Stream({
      name: `cam-${cameraId}`,
      streamUrl: rtspUrl,
      wsPort: wsPort,
      ffmpegOptions: {
        '-stats': '', 
        '-r': 24, // Limit framerate to save CPU
        '-q:v': 5, // Video quality
        '-s': '800x600', // Scale to save bandwidth
      }
    });

    const streamInfo = {
      wsPort,
      stream,
      clientsCount: 1, // Assume 1 client initially
      timeoutId: null,
    };
    
    // Listen for WebSocket connections on the stream to manage auto-shutdown
    if (stream.wsServer) {
      stream.wsServer.on('connection', (socket) => {
        streamInfo.clientsCount++;
        if (streamInfo.timeoutId) {
          clearTimeout(streamInfo.timeoutId);
          streamInfo.timeoutId = null;
        }
        
        socket.on('close', () => {
          streamInfo.clientsCount--;
          if (streamInfo.clientsCount <= 0) {
            // Auto-shutdown after 30 seconds of inactivity
            streamInfo.timeoutId = setTimeout(() => {
              stopCameraStream(cameraId);
            }, 30000);
          }
        });
      });
    }

    activeStreams.set(cameraId, streamInfo);
    console.log(`[StreamManager] Started RTSP stream for camera ${cameraId} on WS port ${wsPort}`);
    return { wsPort, status: 'started' };
  } catch (error) {
    console.error(`[StreamManager] Failed to start stream for camera ${cameraId}:`, error);
    throw error;
  }
};

export const stopCameraStream = (cameraId) => {
  if (activeStreams.has(cameraId)) {
    const streamInfo = activeStreams.get(cameraId);
    if (streamInfo.timeoutId) clearTimeout(streamInfo.timeoutId);
    
    try {
      // node-rtsp-stream provides stop() which kills ffmpeg and closes wsServer
      if (typeof streamInfo.stream.stop === 'function') {
        streamInfo.stream.stop();
      }
    } catch (e) {
      console.error(`[StreamManager] Error stopping stream ${cameraId}:`, e);
    }
    
    activeStreams.delete(cameraId);
    console.log(`[StreamManager] Stopped RTSP stream for camera ${cameraId}`);
    return true;
  }
  return false;
};
