import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { execSync } from 'child_process';
import fs from 'fs';

try {
  fs.mkdirSync('media/music', { recursive: true });
  const outputPath = 'media/music/default_inspiring_acoustic.mp3';
  
  console.log('Generating silent MP3 file using FFmpeg...');
  // Use compatible filter syntax: anullsrc without obsolete 'c' option
  execSync(`"${ffmpeg.path}" -y -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t 15 "${outputPath}"`, { stdio: 'inherit' });
  console.log('Silent MP3 file created successfully at:', outputPath);
} catch (err) {
  console.error('Failed to create silent MP3:', err);
  process.exit(1);
}
