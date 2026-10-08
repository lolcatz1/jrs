/**
 * What a render list was built from, so the renderer can prove the next frame would build the same list.
 *
 * A list is reusable while
 *   - the global structure / world epochs (core/epochs.js) are unchanged,
 *   - the camera's view and view-projection matrices (and layers, coordinate system) are unchanged,
 *   - every geometry, material and instanced mesh the build consulted still has the values it had
 *     (bounding sphere, layout version, `visible` / `transparent` / `wireframe` / `vertexColors`, ...),
 *   - every (material, variant) pair still resolves to the same program.
 * If only the camera moved, the cull result of every candidate is re-tested; when none flips, the opaque list
 * is kept and only the transparent depth keys are recomputed.
 *
 * Dependency data is recorded only on a build that follows an unchanged frame, so scenes that change every
 * frame (animation) pay for a signature copy and nothing else.
 */
class RenderListCache {
	constructor() {
		this.hasSig = false;
		this.ready = false;          // dependencies recorded and the list can be reused
		this.structure = -1; this.world = -1;
		this.sortObjects = true; this.override = null;
		this.layers = 0; this.coordinateSystem = 0; this.reversedDepth = false;
		this.view = new Float32Array(16); this.pv = new Float32Array(16);
		this.itemZ = null;           // Float64Array: depth of each item index as of the last build / re-cull
		this.resort = false;         // set by a camera-only reuse when a transparent depth changed

		this.resetDeps();
		this.cmdOpaque = new CommandCache();
		this.cmdTransparent = new CommandCache();
	}
	resetDeps() {
		this.reusable = true;
		this.lights = [];
		this.cand = []; this.candIn = []; this.candItem = [];
		this.geomSet = new Set(); this.geoms = []; this.gLayout = []; this.gBS = []; this.gR = []; this.gCx = []; this.gCy = []; this.gCz = []; this.gIdx = []; this.gRid = [];
		this.matSet = new Set(); this.mats = []; this.mFlags = [];
		this.instSet = new Set(); this.inst = []; this.iBS = []; this.iR = []; this.iCx = []; this.iCy = []; this.iCz = []; this.iColor = [];
		this.pairSet = new Set(); this.pMat = []; this.pVariant = []; this.pObject = []; this.pProgram = []; this.pMatRid = []; this.pProgRid = [];
		this.renderOrders = [];
		this.materialCounter = 0; this.geometryCounter = 0; this.programCounter = 0;
		this.lastGeom = null; this.lastMat = null;
	}

	// ---- recording (during a build) -------------------------------------------------------------------------

	addCandidate(object, inside, itemIndex) { this.cand.push(object); this.candIn.push(inside ? 1 : 0); this.candItem.push(itemIndex); }
	regGeometry(geometry) {
		if (geometry === this.lastGeom) return;
		this.lastGeom = geometry;
		if (!this.geomSet.has(geometry)) { this.geomSet.add(geometry); this.geoms.push(geometry); }
	}
	regMaterial(material) {
		if (material === this.lastMat) return;
		this.lastMat = material;
		if (!this.matSet.has(material)) { this.matSet.add(material); this.mats.push(material); }
	}
	regInstanced(object) { if (!this.instSet.has(object)) { this.instSet.add(object); this.inst.push(object); } }
	regPair(material, variant, object) {
		const key = material.id * 1024 + variant;
		if (!this.pairSet.has(key)) { this.pairSet.add(key); this.pMat.push(material); this.pVariant.push(variant); this.pObject.push(object); }
	}

	/** Snapshot every recorded dependency (call once the build, including program resolution, is done). */
	snapshot(frameId) {
		const geoms = this.geoms;
		for (let i = 0; i < geoms.length; i++) {
			const g = geoms[i], bs = g.boundingSphere;
			this.gLayout.push(g._layoutVersion); this.gBS.push(bs); this.gIdx.push(g.index !== null);
			if (bs !== null) { this.gR.push(bs.radius); this.gCx.push(bs.center.x); this.gCy.push(bs.center.y); this.gCz.push(bs.center.z); } else { this.gR.push(0); this.gCx.push(0); this.gCy.push(0); this.gCz.push(0); }
			this.gRid.push(g._frameStamp === frameId ? g._frameRid : -1);
		}
		const mats = this.mats;
		for (let i = 0; i < mats.length; i++) this.mFlags.push(materialFlags(mats[i]));
		const inst = this.inst;
		for (let i = 0; i < inst.length; i++) {
			const o = inst[i], bs = o.boundingSphere;
			this.iBS.push(bs); this.iColor.push(o.instanceColor !== null);
			if (bs !== null) { this.iR.push(bs.radius); this.iCx.push(bs.center.x); this.iCy.push(bs.center.y); this.iCz.push(bs.center.z); } else { this.iR.push(0); this.iCx.push(0); this.iCy.push(0); this.iCz.push(0); }
		}
	}

	// ---- validation ---------------------------------------------------------------------------------------

	/** True while every recorded geometry / material / instanced mesh still has the snapshotted values. */
	depsValid() {
		const geoms = this.geoms;
		for (let i = 0; i < geoms.length; i++) {
			const g = geoms[i], bs = g.boundingSphere;
			if (g._layoutVersion !== this.gLayout[i] || bs !== this.gBS[i] || (g.index !== null) !== this.gIdx[i]) return false;
			if (bs !== null) { const c = bs.center; if (bs.radius !== this.gR[i] || c.x !== this.gCx[i] || c.y !== this.gCy[i] || c.z !== this.gCz[i]) return false; }
		}
		const mats = this.mats;
		for (let i = 0; i < mats.length; i++) if (materialFlags(mats[i]) !== this.mFlags[i]) return false;
		const inst = this.inst;
		for (let i = 0; i < inst.length; i++) {
			const o = inst[i], bs = o.boundingSphere;
			if (bs !== this.iBS[i] || (o.instanceColor !== null) !== this.iColor[i]) return false;
			if (bs !== null) { const c = bs.center; if (bs.radius !== this.iR[i] || c.x !== this.iCx[i] || c.y !== this.iCy[i] || c.z !== this.iCz[i]) return false; }
		}
		return true;
	}
	/** Stores the camera the list was built (or re-culled) for. */
	setCamera(camera, view, pv) {
		this.view.set(view); this.pv.set(pv);
		this.layers = camera.layers.mask; this.coordinateSystem = camera.coordinateSystem; this.reversedDepth = camera.reversedDepth === true;
	}
	sameCamera(camera, view, pv) {
		if (this.layers !== camera.layers.mask || this.coordinateSystem !== camera.coordinateSystem || this.reversedDepth !== (camera.reversedDepth === true)) return false;
		const v = this.view, p = this.pv;
		for (let i = 0; i < 16; i++) if (v[i] !== view[i] || p[i] !== pv[i]) return false;
		return true;
	}
	sameCameraLayers(camera) { return this.layers === camera.layers.mask && this.coordinateSystem === camera.coordinateSystem && this.reversedDepth === (camera.reversedDepth === true); }
}

/** Bit set of the material fields the list build and the command builder read. */
function materialFlags(m) {
	return (m.visible ? 1 : 0) | (m.transparent === true ? 2 : 0) | (m.wireframe === true ? 4 : 0) | (m.vertexColors === true ? 8 : 0) | (m.allowOverride === true ? 16 : 0);
}

/** Draw commands (singles, instanced runs, multi-draw runs) built from one sorted key list. */
class CommandCache {
	constructor() {
		this.version = -1;           // list.opaqueVersion / transparentVersion the commands were built for
		this.cmdN = 0; this.mdN = 0;
		this.items = null; this.offset = null; this.count = null; this.kind = null; this.mdStart = null;
		this.mdCounts = null; this.mdOffsets = null;
		this.texCount = 0; this.texHash = 0;
		this.megaGeoms = []; this.megaRecs = []; this.megaPages = [];
		this.autoBatch = false; this.autoMultiDraw = false; this.minimum = 0; this.multi = false;
	}
	invalidate() { this.version = -1; }
}

export { RenderListCache, CommandCache };
