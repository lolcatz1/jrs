// Minimal static file server for the repo root (ESM pages need http://, not file://).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };

export function startServer(port = 0) {
	const server = http.createServer((req, res) => {
		const url = new URL(req.url, 'http://localhost');
		let file = path.join(root, decodeURIComponent(url.pathname));
		if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
		fs.stat(file, (err, st) => {
			if (!err && st.isDirectory()) file = path.join(file, 'index.html');
			fs.readFile(file, (err2, data) => {
				if (err2) { res.writeHead(404); res.end('not found'); return; }
				res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
				res.end(data);
			});
		});
	});
	return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const { port } = await startServer(8765);
	console.log(`serving ${root} at http://127.0.0.1:${port}/`);
}
