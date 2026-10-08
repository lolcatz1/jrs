/**
 * Vertex array object cache.
 *
 * Attribute locations are fixed per attribute name across all programs
 * (see WebGLProgram), so one VAO per geometry serves every program and the
 * cache key is just (geometry, instanced-variant). The VAO is rebuilt only
 * when the geometry's layout version changes or an attribute's buffer is
 * recreated.
 */

import { attributeEpoch } from '../../core/attributeEpoch.js';

const LOC_POSITION = 0, LOC_NORMAL = 1, LOC_UV = 2, LOC_COLOR = 3, LOC_UV1 = 4, LOC_INSTANCE_COLOR = 5, LOC_SKIN_INDEX = 6, LOC_SKIN_WEIGHT = 7, LOC_INSTANCE_MATRIX = 8, LOC_LINE_DISTANCE = 12;
const ATTRIBUTE_LOCATIONS = { position: LOC_POSITION, normal: LOC_NORMAL, uv: LOC_UV, color: LOC_COLOR, uv1: LOC_UV1, skinIndex: LOC_SKIN_INDEX, skinWeight: LOC_SKIN_WEIGHT, lineDistance: LOC_LINE_DISTANCE };

class WebGLBindingStates {
	constructor(gl, state, attributes, info = null) {
		this.gl = gl;
		this.state = state;
		this.attributes = attributes;
		this.info = info;
		this.cache = new WeakMap(); // geometry -> { plain, instanced, batched }
		this._onGeometryDispose = this._onGeometryDispose.bind(this);
	}

	_onGeometryDispose(event) {
		const geometry = event.target;
		geometry.removeEventListener('dispose', this._onGeometryDispose);
		const entry = this.cache.get(geometry);
		if (entry !== undefined) {
			for (const key in entry.vaos) { const v = entry.vaos[key]; if (v) this.gl.deleteVertexArray(v.vao); }
			if (entry.custom !== null) for (const r of entry.custom.values()) this.gl.deleteVertexArray(r.vao);
			this.cache.delete(geometry);
			if (this.info !== null) this.info.memory.geometries--;
		}
		for (const name in geometry.attributes) this.attributes.remove(geometry.attributes[name]);
		if (geometry.index !== null) this.attributes.remove(geometry.index);
	}

	/**
	 * Make sure the geometry's GPU buffers are current and bind the right VAO.
	 * mode: 0 plain, 1 InstancedMesh (its own instance attributes), 2 batched (renderer's instance buffer).
	 * Returns the binding record {vao, indexType, indexBytes}.
	 */
	/**
	 * `program` is only needed for programs with custom (non-fixed-name) attributes; those get a
	 * VAO per (geometry, program) instead of the shared one.
	 */
	bind(geometry, mode, instancedObject, batchBuffer, program = null) {
		const gl = this.gl, attributes = this.attributes;
		let entry = this.cache.get(geometry);
		if (entry === undefined) {
			entry = { vaos: [null, null, null], layoutVersion: -1, instancedFor: null, hadInstanceColor: false, custom: null, attrList: null, versionSum: -1, epoch: -1, epochMode: -1 };
			this.cache.set(geometry, entry);
			geometry.addEventListener('dispose', this._onGeometryDispose);
			if (this.info !== null) this.info.memory.geometries++;
		}
		const useCustom = program !== null && program.hasCustomAttributes === true;
		// Fast path: layout unchanged and no attribute version changed since the VAO was last validated.
		if (entry.layoutVersion === geometry._layoutVersion && entry.attrList !== null && (mode !== 1 || entry.instancedFor === instancedObject)) {
			// No BufferAttribute.needsUpdate anywhere since the last validation: the version sum cannot have changed.
			let valid = entry.epoch === attributeEpoch.value && entry.epochMode === mode; // the sum is mode-specific (mode 1 adds the instance attributes)
			if (!valid) {
				const list = entry.attrList;
				let sum = 0;
				for (let i = 0, l = list.length; i < l; i++) sum += list[i].version;
				if (geometry.index !== null) sum += geometry.index.version;
				if (mode === 1) { sum += instancedObject.instanceMatrix.version; if (instancedObject.instanceColor !== null) sum += instancedObject.instanceColor.version + 1000003; }
				valid = sum === entry.versionSum;
				if (valid) { entry.epoch = attributeEpoch.value; entry.epochMode = mode; }
			}
			if (valid) {
				let record;
				if (useCustom) { if (entry.custom !== null) { record = entry.custom.get(program.id * 4 + mode); if (record === undefined) record = null; } else record = null; }
				else record = entry.vaos[mode];
				if (record !== null) { this.state.bindVertexArray(record.vao); return record; }
			}
		}
		// Array buffers are not VAO state: update them freely. Detect buffer recreation (forces a VAO rebuild).
		let rebuild = entry.layoutVersion !== geometry._layoutVersion;
		const geometryAttributes = geometry.attributes;
		for (const name in geometryAttributes) {
			const attribute = geometryAttributes[name];
			const before = attributes.get(attribute);
			const beforeBuffer = before !== undefined ? before.buffer : null;
			if (attributes.update(attribute, gl.ARRAY_BUFFER).buffer !== beforeBuffer) rebuild = true;
		}
		if (mode === 1) {
			const im = instancedObject.instanceMatrix;
			const before = attributes.get(im);
			const beforeBuffer = before !== undefined ? before.buffer : null;
			if (attributes.update(im, gl.ARRAY_BUFFER).buffer !== beforeBuffer) rebuild = true;
			if (instancedObject.instanceColor !== null) {
				const ic = instancedObject.instanceColor;
				const b2 = attributes.get(ic);
				const b2b = b2 !== undefined ? b2.buffer : null;
				if (attributes.update(ic, gl.ARRAY_BUFFER).buffer !== b2b) rebuild = true;
				if (entry.hadInstanceColor !== true) { entry.hadInstanceColor = true; rebuild = true; }
			}
			if (entry.instancedFor !== instancedObject) { entry.instancedFor = instancedObject; rebuild = true; }
		}
		if (this.state.currentArrayBuffer !== null) this.state.currentArrayBuffer = null; // buffer updates bypass the cache
		if (rebuild) {
			for (let i = 0; i < 3; i++) { if (entry.vaos[i] !== null) { gl.deleteVertexArray(entry.vaos[i].vao); entry.vaos[i] = null; } }
			if (entry.custom !== null) { for (const r of entry.custom.values()) gl.deleteVertexArray(r.vao); entry.custom.clear(); }
			entry.layoutVersion = geometry._layoutVersion;
			if (this.state.currentVAO !== null) { gl.bindVertexArray(null); this.state.currentVAO = null; }
		}
		let record;
		if (useCustom) {
			if (entry.custom === null) entry.custom = new Map();
			const key = program.id * 4 + mode;
			record = entry.custom.get(key);
			if (record === undefined) record = null;
		} else {
			record = entry.vaos[mode];
		}
		if (record === null) {
			record = this._createVAO(geometry, mode, instancedObject, batchBuffer, useCustom ? program : null);
			if (useCustom) entry.custom.set(program.id * 4 + mode, record); else entry.vaos[mode] = record;
			this.state.currentVAO = record.vao; // _createVAO leaves it bound
		} else {
			this.state.bindVertexArray(record.vao);
			// The element buffer IS VAO state: update it only while this geometry's own VAO is bound.
			const index = geometry.index;
			if (index !== null) {
				const before = attributes.get(index);
				if (before === undefined || before.version < index.version) {
					const data = attributes.update(index, gl.ELEMENT_ARRAY_BUFFER);
					record.indexType = data.type; record.indexBytes = data.bytesPerElement;
				}
			}
		}
		// remember the validated state for the fast path
		const list = entry.attrList !== null ? entry.attrList : [];
		list.length = 0;
		for (const name in geometryAttributes) { const a = geometryAttributes[name]; list.push(a.isInterleavedBufferAttribute === true ? a.data : a); } // owners of `version`
		let sum = 0;
		for (let i = 0; i < list.length; i++) sum += list[i].version;
		if (geometry.index !== null) sum += geometry.index.version;
		if (mode === 1) { sum += instancedObject.instanceMatrix.version; if (instancedObject.instanceColor !== null) sum += instancedObject.instanceColor.version + 1000003; }
		entry.attrList = list; entry.versionSum = sum; entry.epoch = attributeEpoch.value; entry.epochMode = mode;
		return record;
	}

	_createVAO(geometry, mode, instancedObject, batchBuffer, program) {
		const gl = this.gl, attributes = this.attributes;
		const vao = gl.createVertexArray();
		gl.bindVertexArray(vao);
		this.state.currentArrayBuffer = null;
		const geometryAttributes = geometry.attributes;
		let maxInstancedCount = Infinity;
		for (const name in geometryAttributes) {
			const attribute = geometryAttributes[name];
			let location = ATTRIBUTE_LOCATIONS[name];
			if (location === undefined && program !== null) {
				const custom = program.attributes[name];
				if (custom !== undefined && custom.location >= 0) location = custom.location;
			}
			if (location === undefined) continue;
			const data = attributes.get(attribute);
			this._setupAttribute(location, attribute, data);
			if (attribute.isInstancedBufferAttribute) {
				gl.vertexAttribDivisor(location, attribute.meshPerAttribute);
				maxInstancedCount = Math.min(maxInstancedCount, attribute.count * attribute.meshPerAttribute);
			}
		}
		const index = geometry.index;
		let indexType = 0, indexBytes = 0;
		if (index !== null) {
			const data = attributes.update(index, gl.ELEMENT_ARRAY_BUFFER); // binds while our VAO is current
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, data.buffer);
			indexType = data.type; indexBytes = data.bytesPerElement;
		}
		if (mode === 1) {
			const im = instancedObject.instanceMatrix;
			const data = attributes.get(im);
			gl.bindBuffer(gl.ARRAY_BUFFER, data.buffer);
			for (let i = 0; i < 4; i++) {
				gl.enableVertexAttribArray(LOC_INSTANCE_MATRIX + i);
				gl.vertexAttribPointer(LOC_INSTANCE_MATRIX + i, 4, gl.FLOAT, false, 64, i * 16);
				gl.vertexAttribDivisor(LOC_INSTANCE_MATRIX + i, im.meshPerAttribute);
			}
			if (instancedObject.instanceColor !== null) {
				const ic = instancedObject.instanceColor;
				const cdata = attributes.get(ic);
				gl.bindBuffer(gl.ARRAY_BUFFER, cdata.buffer);
				gl.enableVertexAttribArray(LOC_INSTANCE_COLOR);
				gl.vertexAttribPointer(LOC_INSTANCE_COLOR, 3, cdata.type, ic.normalized, 0, 0);
				gl.vertexAttribDivisor(LOC_INSTANCE_COLOR, ic.meshPerAttribute);
			}
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		return { vao, indexType, indexBytes, maxInstancedCount };
	}

	_setupAttribute(location, attribute, data) {
		const gl = this.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, data.buffer);
		gl.enableVertexAttribArray(location);
		const integer = data.type === gl.INT || data.type === gl.UNSIGNED_INT || attribute.gpuType === 1013;
		let stride = 0, offset = 0;
		if (attribute.isInterleavedBufferAttribute === true) { stride = attribute.data.stride * data.bytesPerElement; offset = attribute.offset * data.bytesPerElement; }
		if (integer && data.type !== gl.FLOAT && !attribute.normalized) {
			gl.vertexAttribIPointer(location, attribute.itemSize, data.type, stride, offset);
		} else {
			gl.vertexAttribPointer(location, attribute.itemSize, data.type, attribute.normalized, stride, offset);
		}
	}

	reset() { this.state.bindVertexArray(null); }
}

export { WebGLBindingStates, ATTRIBUTE_LOCATIONS, LOC_INSTANCE_MATRIX };
