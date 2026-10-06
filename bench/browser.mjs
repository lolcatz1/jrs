// Launch headless Chromium (pre-installed Playwright build) with software WebGL.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const candidates = [
	'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
	'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
	'/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
];

export async function launchBrowser() {
	const executablePath = process.env.CHROME_PATH || candidates.find((p) => fs.existsSync(p));
	return chromium.launch({
		headless: true,
		executablePath,
		args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl'],
	});
}
