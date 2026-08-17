import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const execFilePromise = promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

async function testMotion() {
  console.log('Testing FFmpeg zoompan animation...');
  const duration = 5;
  const framesCount = duration * 25;
  const inc = (1.10 - 1.0) / framesCount;

  // Let's create two 1080x1920 solid color images using ffmpeg
  const testDir = path.resolve('./tmp/test-motion');
  fs.mkdirSync(testDir, { recursive: true });
  
  const bgPath = path.join(testDir, 'bg.png');
  const fgPath = path.join(testDir, 'fg.png');
  const audioPath = path.join(testDir, 'audio.mp3');
  const outPath = path.join(testDir, 'out_motion.mp4');

  // Create test bg and fg images
  await execFilePromise(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'testsrc=size=2160x3840:rate=1', '-vframes', '1', bgPath]);
  await execFilePromise(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'color=c=red@0.0:s=1080x1920:d=1', '-vframes', '1', fgPath]);
  await execFilePromise(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '5', audioPath]);

  // Test zoompan without -loop 1 on [0:v]
  const zoomExpr = `zoompan=z='min(zoom+${inc},1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${framesCount}:s=1080x1920:fps=25`;
  const filter = `[0:v] scale=2160:3840:flags=lanczos, ${zoomExpr} [bg]; [1:v] scale=1080:1920:flags=lanczos [fg]; [bg][fg] overlay=0:0:format=auto, format=yuv420p [outv]`;

  const args = [
    '-y',
    '-i', bgPath, // Note: NO -loop 1 on image entering zoompan!
    '-loop', '1',
    '-t', duration.toString(),
    '-i', fgPath,
    '-i', audioPath,
    '-filter_complex', filter,
    '-map', '[outv]',
    '-map', '2:a',
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    '-r', '25',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    outPath
  ];

  console.log('Running args:', args.join(' '));
  const res = await execFilePromise(ffmpegPath, args);
  console.log('Success! Output file size:', fs.statSync(outPath).size);
}

testMotion().catch(console.error);
