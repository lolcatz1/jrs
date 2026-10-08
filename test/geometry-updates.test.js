import test from 'node:test';
import assert from 'node:assert/strict';
import { RangeAllocator } from '../src/renderers/webgl/WebGLMegaBuffers.js';
import { mergeUpdateRanges } from '../src/renderers/webgl/WebGLAttributes.js';
import { BufferAttribute, InterleavedBuffer } from '../src/index.js';

test('RangeAllocator: first fit, split, coalesce on release', () => {
	const a = new RangeAllocator(100);
	assert.equal(a.alloc(30), 0);
	assert.equal(a.alloc(30), 30);
	assert.equal(a.alloc(30), 60);
	assert.equal(a.alloc(30), -1);
	a.release(30, 30);
	assert.equal(a.alloc(10), 30); // hole reused
	a.release(0, 30); a.release(60, 30); // [60,90) joins the free [40,60) and [90,100)
	assert.deepEqual(a.starts, [0, 40]);
	assert.deepEqual(a.sizes, [30, 60]);
	a.release(30, 10); // bridges both neighbours
	assert.deepEqual(a.starts, [0]);
	assert.deepEqual(a.sizes, [100]);
	assert.equal(a.alloc(100), 0);
	assert.equal(a.alloc(0), -1);
});

test('mergeUpdateRanges merges adjacent and overlapping ranges in place (three.js algorithm)', () => {
	const ranges = [{ start: 20, count: 5 }, { start: 0, count: 6 }, { start: 5, count: 6 }, { start: 40, count: 2 }];
	mergeUpdateRanges(ranges);
	assert.deepEqual(ranges, [{ start: 0, count: 11 }, { start: 20, count: 5 }, { start: 40, count: 2 }]);
});

test('BufferAttribute / InterleavedBuffer update bookkeeping', () => {
	const a = new BufferAttribute(new Float32Array(9), 3);
	assert.equal(a.version, 0);
	a.needsUpdate = true; a.needsUpdate = false;
	assert.equal(a.version, 1);
	a.addUpdateRange(0, 3); a.addUpdateRange(6, 3);
	assert.equal(a.updateRanges.length, 2);
	a.clearUpdateRanges();
	assert.equal(a.updateRanges.length, 0);
	const ib = new InterleavedBuffer(new Float32Array(10), 5);
	ib.addUpdateRange(0, 5); ib.needsUpdate = true;
	assert.equal(ib.version, 1); assert.equal(ib.updateRanges.length, 1);
});
