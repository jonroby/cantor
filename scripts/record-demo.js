/**
 * record-demo.js
 *
 * Playwright script that records a short demo of the Cantor app.
 * Output: videos/demo-<timestamp>.webm
 *
 * Prerequisites:
 *   - bun run dev  (app on localhost:5173)
 *
 * Run: bun run record
 */

import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const VIDEOS_DIR = join(ROOT, 'videos');
const BASE_URL = 'http://localhost:5173';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
	mkdirSync(VIDEOS_DIR, { recursive: true });

	// ── 1. Launch browser ────────────────────────────────────────────────────
	const browser = await chromium.launch({ headless: true });

	// ── 2. Create context with video recording ───────────────────────────────
	const context = await browser.newContext({
		viewport: { width: 1920, height: 1080 },
		deviceScaleFactor: 1,
		recordVideo: { dir: VIDEOS_DIR, size: { width: 1920, height: 1080 } }
	});

	const page = await context.newPage();

	// ── 3. Load the app ───────────────────────────────────────────────────────
	await page.goto(`${BASE_URL}/#/`);
	await page.waitForLoadState('networkidle');
	await wait(1500);

	// ── 4. Click the first chat so the full layout fills the viewport ────────
	await page.locator('.chat-item-button').first().click();
	await wait(1500);

	// ── 5. Pause on the final state ───────────────────────────────────────────
	await wait(2000);

	// ── 6. Close → flush video ───────────────────────────────────────────────
	await context.close();
	await browser.close();

	// Rename uuid file to readable name
	const files = readdirSync(VIDEOS_DIR)
		.filter((f) => f.endsWith('.webm'))
		.map((f) => ({ name: f, mtime: statSync(join(VIDEOS_DIR, f)).mtimeMs }))
		.sort((a, b) => b.mtime - a.mtime);

	if (files.length > 0) {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const raw = join(VIDEOS_DIR, files[0].name);
		const dest = join(VIDEOS_DIR, `demo-${timestamp}.webm`);

		// Re-encode at high bitrate with VP9 for sharp text
		console.log('\nRe-encoding at high bitrate...');
		execSync(
			`ffmpeg -i "${raw}" -c:v libvpx-vp9 -b:v 8M -minrate 4M -maxrate 12M -crf 10 -deadline best -cpu-used 0 "${dest}" -y`,
			{ stdio: 'inherit' }
		);
		unlinkSync(raw);
		console.log(`\nVideo saved: ${dest}`);
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
