import { existsSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

// Use a Chromium that is already on the machine instead of downloading one.
// Set REMOTION_BROWSER to point at another build.
const browser = process.env['REMOTION_BROWSER'] ?? '/opt/pw-browsers/chromium';
if (existsSync(browser)) Config.setBrowserExecutable(browser);

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);
