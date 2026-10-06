import { Cache } from './Cache.js';
import { Loader } from './Loader.js';

const loading = {};

class HttpError extends Error {
	constructor(message, response) { super(message); this.response = response; }
}

class FileLoader extends Loader {
	constructor(manager) { super(manager); }
	load(url, onLoad, onProgress, onError) {
		if (url === undefined) url = '';
		if (this.path !== undefined) url = this.path + url;
		url = this.manager.resolveURL(url);
		const cached = Cache.get(`file:${url}`);
		if (cached !== undefined) {
			this.manager.itemStart(url);
			setTimeout(() => { if (onLoad) onLoad(cached); this.manager.itemEnd(url); }, 0);
			return cached;
		}
		if (loading[url] !== undefined) {
			loading[url].push({ onLoad, onProgress, onError });
			return;
		}
		loading[url] = [];
		loading[url].push({ onLoad, onProgress, onError });
		const req = new Request(url, { headers: new Headers(this.requestHeader), credentials: this.withCredentials ? 'include' : 'same-origin' });
		const mimeType = this.mimeType, responseType = this.responseType;
		fetch(req).then(response => {
			if (response.status === 200 || response.status === 0) {
				if (response.status === 0) console.warn('FileLoader: HTTP Status 0 received.');
				if (typeof ReadableStream === 'undefined' || response.body === undefined || response.body.getReader === undefined) return response;
				const callbacks = loading[url];
				const reader = response.body.getReader();
				const contentLength = response.headers.get('X-File-Size') || response.headers.get('Content-Length');
				const total = contentLength ? parseInt(contentLength) : 0;
				const lengthComputable = total !== 0;
				let loaded = 0;
				const stream = new ReadableStream({
					start(controller) {
						readData();
						function readData() {
							reader.read().then(({ done, value }) => {
								if (done) controller.close();
								else {
									loaded += value.byteLength;
									const event = new ProgressEvent('progress', { lengthComputable, loaded, total });
									for (let i = 0, il = callbacks.length; i < il; i++) { const callback = callbacks[i]; if (callback.onProgress) callback.onProgress(event); }
									controller.enqueue(value);
									readData();
								}
							}, (e) => { controller.error(e); });
						}
					}
				});
				return new Response(stream);
			} else {
				throw new HttpError(`fetch for "${response.url}" responded with ${response.status}: ${response.statusText}`, response);
			}
		}).then(response => {
			switch (responseType) {
				case 'arraybuffer': return response.arrayBuffer();
				case 'blob': return response.blob();
				case 'document': return response.text().then(text => { const parser = new DOMParser(); return parser.parseFromString(text, mimeType); });
				case 'json': return response.json();
				default:
					if (mimeType === undefined) return response.text();
					const re = /charset="?([^;"\s]*)"?/i;
					const exec = re.exec(mimeType);
					const label = exec && exec[1] ? exec[1].toLowerCase() : undefined;
					const decoder = new TextDecoder(label);
					return response.arrayBuffer().then(ab => decoder.decode(ab));
			}
		}).then(data => {
			Cache.add(`file:${url}`, data);
			const callbacks = loading[url];
			delete loading[url];
			for (let i = 0, il = callbacks.length; i < il; i++) { const callback = callbacks[i]; if (callback.onLoad) callback.onLoad(data); }
		}).catch(err => {
			const callbacks = loading[url];
			if (callbacks === undefined) { this.manager.itemError(url); throw err; }
			delete loading[url];
			for (let i = 0, il = callbacks.length; i < il; i++) { const callback = callbacks[i]; if (callback.onError) callback.onError(err); }
			this.manager.itemError(url);
		}).finally(() => { this.manager.itemEnd(url); });
		this.manager.itemStart(url);
	}
	setResponseType(value) { this.responseType = value; return this; }
	setMimeType(value) { this.mimeType = value; return this; }
}

export { FileLoader };
