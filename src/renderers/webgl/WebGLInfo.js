class WebGLInfo {
	constructor(gl) {
		this.gl = gl;
		this.memory = { geometries: 0, textures: 0 };
		this.render = { frame: 0, calls: 0, triangles: 0, points: 0, lines: 0, batches: 0, instances: 0 };
		this.programs = null;
		this.autoReset = true;
	}
	update(count, mode, instanceCount) {
		const gl = this.gl;
		this.render.calls++;
		switch (mode) {
			case gl.TRIANGLES: this.render.triangles += instanceCount * (count / 3); break;
			case gl.LINES: this.render.lines += instanceCount * (count / 2); break;
			case gl.LINE_STRIP: this.render.lines += instanceCount * (count - 1); break;
			case gl.LINE_LOOP: this.render.lines += instanceCount * count; break;
			case gl.POINTS: this.render.points += instanceCount * count; break;
			default: console.error('WebGLInfo: Unknown draw mode:', mode);
		}
	}
	reset() {
		this.render.calls = 0; this.render.triangles = 0; this.render.points = 0; this.render.lines = 0;
		this.render.batches = 0; this.render.instances = 0;
	}
}

export { WebGLInfo };
