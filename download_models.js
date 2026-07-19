const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const modelsDir = path.join(__dirname, 'Frontend', 'public', 'models');

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const filesToDownload = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

const downloadFile = (fileName) => {
  return new Promise((resolve, reject) => {
    const dest = path.join(modelsDir, fileName);
    if (fs.existsSync(dest)) {
      console.log(`Already exists: ${fileName}`);
      return resolve();
    }
    const file = fs.createWriteStream(dest);
    https.get(modelsUrl + fileName, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${fileName}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
};

Promise.all(filesToDownload.map(downloadFile))
  .then(() => console.log('All models downloaded successfully'))
  .catch(err => console.error('Error downloading models', err));
