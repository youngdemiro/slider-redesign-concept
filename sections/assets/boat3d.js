/* Slider 210 in 3D, built in code for the configurator pilot (no CAD yet).
   Hull lines follow the yard's side profile (paint-zone outlines of profile-210), the yard's
   photos (closed foredeck with teak pads, wrap-around windshield with a centre walk-through)
   and the published specs: 6210 x 2300 mm, 19° deadrise, 1420 mm depth amidships.
   Coordinates are metres: x along the hull (0 = transom, L = stem), y across (+ = starboard),
   z up from the keel. Three.js is y-up, so V(x, y, z) maps to (x - L/2, z, y).
   The paint shader mixes white gelcoat, the old and the new colour per zone, and washes the
   new colour from stern to bow, same as the 2D teaser. Needs an importmap for "three". */
window.Boat3D = async function (container, opts = {}) {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
  const { RoundedBoxGeometry } = await import("three/addons/geometries/RoundedBoxGeometry.js");

  const L = 6.21, H = L / 2;
  const V = (x, y, z) => new THREE.Vector3(x - H, z, y);

  // monotone cubic through [x, value] pairs (Fritsch–Carlson), so the lines never overshoot
  function curve(pts) {
    const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), d = [], m = [];
    for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return x => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }

  // ---- lines -------------------------------------------------------------------------------
  const keel = curve([[0, .04], [1.2, .02], [3.3, 0], [4.3, .08], [4.9, .24], [5.4, .46], [5.85, .74], [6.21, 1.0]]);
  const rub = curve([[0, .66], [1.2, .74], [2.4, .85], [3.4, .92], [4.4, .95], [5.4, .97], [6, 1], [6.21, 1.03]]);
  const beam = curve([[0, 1.07], [.8, 1.11], [2, 1.15], [3.3, 1.15], [4.2, 1.08], [4.8, .93], [5.3, .72], [5.7, .48], [6.0, .25], [6.21, 0]]);
  const chine = curve([[0, .9], [2, .95], [3.3, .93], [4.3, .78], [5.0, .52], [5.6, .22], [6.21, 0]]);
  const dead = curve([[0, 19], [3.4, 20], [4.5, 27], [5.4, 40], [6.21, 52]]);
  // topside height over the rub rail, from the "above" zone of profile-210 scaled to the 1420 mm
  // depth: low swim-platform corners aft, a step up at the aft bench, highest at the windshield
  const topside = curve([[0, .1], [.3, .17], [.78, .22], [.92, .47], [1.4, .5], [3.95, .5], [4.5, .44], [5.1, .36], [5.6, .25], [6.0, .14], [6.21, .06]]);
  const zs = x => rub(x) + topside(x), zg = x => zs(x) + .012;   // sheer, top of the gunwale
  const tuck = .025;                                          // tumblehome from rub rail to sheer
  const crownH = curve([[3.3, .1], [4.1, .1], [5, .07], [6.21, .03]]);
  const XA = 4.05, BMAX = 1.15, ARC = .7, WT = .27;           // windshield arc in plan, walk-through half width
  const xa = y => XA - ARC * Math.min(1, (y / BMAX) ** 2);
  const SOLE = .6, AFT = .9;                                  // cockpit floor height, aft bench bulkhead

  // one half-section, keel to gunwale; zone 0 = below the rub rail, 1 = above
  function section(x) {
    const zk = keel(x), B = beam(x), zr = rub(x), c = Math.min(chine(x), B * .92), dr = dead(x) * Math.PI / 180;
    const k = Math.min(1, c / .5), tan = Math.tan(dr), P = [];
    const bot = y => zk + y * tan * (1 - .05 * Math.sin(Math.PI * y / Math.max(c, 1e-4)));
    P.push([0, zk, 0]);
    for (const t of [.18, .35, "s", .52, .68, "s", .84]) {
      if (t === "s") { const [y, z] = P[P.length - 1]; P.push([y + .018 * k, z + .002, 0]); continue; }
      const y = c * t + (P.length > 3 ? .018 * k : 0) + (P.length > 6 ? .018 * k : 0);
      P.push([y, bot(c * t), 0]);
    }
    const zc = zk + c * tan;
    P.push([c, zc, 0], [c + .035 * k, zc + .008, 0]);
    const p0 = [c + .035 * k, zc + .008], p2 = [B, zr], p1 = [c + .035 * k + .72 * (B - c - .035 * k), zc + .42 * (zr - zc)];
    for (const s of [.15, .3, .45, .6, .75, .9]) {
      const a = (1 - s) ** 2, b = 2 * (1 - s) * s, e = s * s;
      P.push([a * p0[0] + b * p1[0] + e * p2[0], a * p0[1] + b * p1[1] + e * p2[1], 0]);
    }
    P.push([B, zr, 0], [B, zr, 1]);
    const Bs = Math.max(0, B - tuck), zt = zs(x);
    for (const s of [.25, .5, .75, 1]) P.push([B + (Bs - B) * s + .012 * Math.sin(Math.PI * s) * Math.min(1, B / .3), zr + (zt - zr) * s, 1]);
    P.push([Math.max(0, Bs - .006), zt + .008, 1], [Math.max(0, Bs - .02), zg(x), 1]);
    return P;
  }

  // ---- materials ---------------------------------------------------------------------------
  const U = {
    uOld: { value: new THREE.Color(opts.color || "#2B2C7C") }, uNew: { value: new THREE.Color(opts.color || "#2B2C7C") },
    uMOld: { value: new THREE.Vector2() }, uMNew: { value: new THREE.Vector2() }, uProg: { value: 0 }
  };
  const ZM = { none: [0, 0], below: [1, 0], above: [0, 1], full: [1, 1] };
  U.uMOld.value.set(...ZM[opts.zone || "full"]); U.uMNew.value.copy(U.uMOld.value);

  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf3f2ee, roughness: .22, metalness: 0, clearcoat: 1, clearcoatRoughness: .06, side: THREE.DoubleSide });
  paint.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aZone;\nvarying float vZone;\nvarying float vXn;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvZone = aZone;\nvXn = (position.x + ${H.toFixed(3)}) / ${L.toFixed(3)};`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uOld, uNew;\nuniform vec2 uMOld, uMNew;\nuniform float uProg;\nvarying float vZone;\nvarying float vXn;")
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", `
        float mo = vZone < .5 ? uMOld.x : uMOld.y, mn = vZone < .5 ? uMNew.x : uMNew.y;
        vec3 cOld = mix(diffuse, uOld, mo), cNew = mix(diffuse, uNew, mn);
        float w = .07, front = uProg * (1. + 2. * w) - w;
        float f = 1. - smoothstep(front - w, front + w, vXn);
        vec4 diffuseColor = vec4(mix(cOld, cNew, f) + .06 * (1. - smoothstep(0., w, abs(vXn - front))) * step(.001, uProg) * step(uProg, .999), opacity);`);
  };
  const M = {
    liner: new THREE.MeshPhysicalMaterial({ color: 0xeeede8, roughness: .35, clearcoat: .5, side: THREE.DoubleSide }),
    vinyl: new THREE.MeshPhysicalMaterial({ color: 0xf1efe9, roughness: .55, sheen: .4 }),
    vinylGrey: new THREE.MeshStandardMaterial({ color: 0x80878c, roughness: .6 }),
    piping: new THREE.MeshStandardMaterial({ color: 0xb3262b, roughness: .5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: 1, roughness: .12 }),
    alu: new THREE.MeshStandardMaterial({ color: 0x9ba1a6, metalness: .85, roughness: .3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: .45 }),
    dash: new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: .5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x5cb4e0, roughness: .04, transparent: true, opacity: .5, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
    hatch: new THREE.MeshPhysicalMaterial({ color: 0x0d1216, roughness: .08, clearcoat: 1 }),
    motor: new THREE.MeshPhysicalMaterial({ color: 0x41464b, metalness: .35, roughness: .32, clearcoat: .8, clearcoatRoughness: .15 }),
    shadow: new THREE.ShadowMaterial({ opacity: .32 })
  };
  // vinyl-teak floor, drawn once on a canvas
  // vinyl-teak in the cockpit, grey foam-teak pads on the foredeck (as on the yard's photos)
  for (const [key, base, seam] of [["teak", "#b8996f", "#3b3631"], ["teakGrey", "#9a9c99", "#3a3d3f"]]) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 512; const g = cv.getContext("2d");
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)"; g.fillRect(0, i * 32, 512, 32); g.fillStyle = seam; g.fillRect(0, i * 32 + 28, 512, 4); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); t.anisotropy = 8;
    M[key] = new THREE.MeshStandardMaterial({ map: t, roughness: .8, side: THREE.DoubleSide });
  }

  // ---- geometry helpers --------------------------------------------------------------------
  function grid(rows, zones, uvScale) {   // rows: array of arrays of Vector3 with equal length; uvScale maps plan metres to texture
    const pos = [], zone = [], uv = [], idx = [], nr = rows.length, nc = rows[0].length;
    rows.forEach((r, i) => r.forEach((p, j) => { pos.push(p.x, p.y, p.z); zone.push(zones ? zones[i][j] : 1); if (uvScale) uv.push(p.x * uvScale, p.z * uvScale); }));
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) {
      const a = i * nc + j, b = a + nc; idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aZone", new THREE.Float32BufferAttribute(zone, 1));
    if (uvScale) g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function polygon(pts2, x, zoneVal) { // pts2: [[y, z]...] closed contour in the transom plane
    const tri = THREE.ShapeUtils.triangulateShape(pts2.map(p => new THREE.Vector2(p[0], p[1])), []);
    const pos = [], zone = [];
    pts2.forEach(p => { const v = V(x, p[0], p[1]); pos.push(v.x, v.y, v.z); zone.push(zoneVal); });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aZone", new THREE.Float32BufferAttribute(zone, 1));
    g.setIndex(tri.flat()); g.computeVertexNormals();
    return g;
  }
  const tube = (pts, r, mat, closed = false) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, "centripetal"), Math.max(24, pts.length * 12), r, 10, closed), mat);
  const box = (sx, sy, sz, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(sx, sz, sy, 3, r), mat);   // sizes in boat axes
  const place = (m, x, y, z) => { m.position.copy(V(x, y, z)); return m; };

  const boat = new THREE.Group(), extras = {};
  const add = (m, parent = boat) => { m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

  // ---- hull shell, both sides ---------------------------------------------------------------
  const NS = 140, xsS = Array.from({ length: NS + 1 }, (_, i) => L * i / NS);
  const secs = xsS.map(x => section(Math.min(x, L - 1e-4)));
  for (const side of [1, -1]) {
    const rows = secs.map((s, i) => s.map(p => V(xsS[i], side * p[0], p[1])));
    const zones = secs.map(s => s.map(p => p[2]));
    add(new THREE.Mesh(grid(rows, zones), paint));
  }
  // transom: painted below and above the rub rail
  {
    const s = section(0), ri = s.findIndex(p => p[2] === 1);
    const below = s.slice(0, ri).map(p => [p[0], p[1]]), above = s.slice(ri).map(p => [p[0], p[1]]);
    const mirror = a => a.slice().reverse().map(p => [-p[0], p[1]]);
    add(new THREE.Mesh(polygon([...mirror(below), ...below.slice(1)], 0, 0), paint));
    add(new THREE.Mesh(polygon([...above, ...mirror(above)], 0, 1), paint));
  }
  // rub rails
  for (const side of [1, -1]) {
    const pts = []; for (let x = .01; x <= L - .02; x += .1) pts.push(V(x, side * (beam(x) + .012), rub(x) + .012));
    pts.push(V(L - .005, 0, rub(L) + .01));
    add(tube(pts, .022, M.alu));
  }

  // ---- decks ---------------------------------------------------------------------------------
  const Bo = x => Math.max(beam(x) - tuck - .02, 1e-4);      // outer edge of the gunwale cap
  const deckZ = (x, y) => { const t = Math.min(1, Math.abs(y) / Bo(x)); return zg(x) + crownH(x) * Math.pow(Math.max(0, 1 - Math.pow(t, 4)), .45); };
  const ycut = x => x >= XA ? 0 : BMAX * Math.sqrt(Math.min(1, (XA - x) / ARC));
  // closed foredeck (painted with the "above" zone), from the windshield arc to the stem
  for (const side of [1, -1]) {
    const rows = [], x0 = xa(Bo(3.4));
    for (let i = 0; i <= 80; i++) {
      const x = x0 + (L - .004 - x0) * i / 80, B = Bo(x), y0 = Math.min(ycut(x), B), r = [];
      for (let j = 0; j <= 24; j++) { const y = y0 + (B - y0) * j / 24; r.push(V(x, side * y, deckZ(x, y))); }
      rows.push(r);
    }
    add(new THREE.Mesh(grid(rows), paint));
  }
  // grey foam-teak pad over the foredeck and the hatch on it
  {
    const rows = [];
    for (let i = 0; i <= 30; i++) {
      const x = 4.3 + 1.45 * i / 30, B = Bo(x) - .17, r = [];
      for (let j = 0; j <= 16; j++) { const y = -B + 2 * B * j / 16; r.push(V(x, y, deckZ(x, y) + .006)); }
      rows.push(r);
    }
    add(new THREE.Mesh(grid(rows, null, .6), M.teakGrey));
    const h = box(.56, .5, .03, .015, M.hatch); place(h, 4.95, 0, deckZ(4.95, 0) + .018); h.rotation.z = -.13; add(h);
  }
  // gunwale caps along the cockpit (painted) and inner cockpit walls (white liner)
  for (const side of [1, -1]) {
    const caps = [], walls = [], x1 = xa(Bo(3.4) - .16);
    for (let i = 0; i <= 50; i++) {
      const x = AFT + (x1 - AFT) * i / 50, B = Bo(x);
      caps.push([V(x, side * B, zg(x)), V(x, side * (B - .085), zg(x) + .012), V(x, side * (B - .16), zg(x))]);
      walls.push([V(x, side * (B - .16), zg(x)), V(x, side * (B - .19), zg(x) - .06), V(x, side * (B - .26), SOLE)]);
    }
    add(new THREE.Mesh(grid(caps), paint));
    add(new THREE.Mesh(grid(walls), M.liner));
  }
  // stern: low swim-platform deck around the outboard, aft bench bulkhead, aft cockpit wall, sole
  {
    const XP = .76, rows = [];
    for (let i = 0; i <= 12; i++) { const x = XP * i / 12, B = Bo(x), r = []; for (let j = 0; j <= 10; j++) r.push(V(x, -B + 2 * B * j / 10, zg(x) - .01)); rows.push(r); }
    add(new THREE.Mesh(grid(rows), M.liner));
    // swim platforms either side of the outboard, reaching aft past the transom (stern photo)
    for (const s of [1, -1]) {
      const zt = zg(0) - .03, w = .6;
      add(place(new THREE.Mesh(new RoundedBoxGeometry(.48, zt - .36, w, 3, .05), paint), -.2, s * (Bo(0) - w / 2 - .01), (zt + .36) / 2));
      add(place(box(.4, w - .1, .012, .006, M.teak), -.2, s * (Bo(0) - w / 2 - .01), zt + .006));
    }
    const zb = zg(XP) - .02, zt = zg(AFT);
    add(place(box(AFT - XP + .02, 2 * Bo(XP) - .03, zt - zb, .03, M.liner), (XP + AFT) / 2, 0, (zb + zt) / 2));
    const Bw = Bo(AFT) - .26, wall = [[], []];
    for (let j = 0; j <= 10; j++) { const y = -Bw + 2 * Bw * j / 10; wall[0].push(V(AFT, y, zg(AFT) - .01)); wall[1].push(V(AFT, y, SOLE)); }
    add(new THREE.Mesh(grid(wall), M.liner));
    // sole runs forward to the helm bulkhead, following its arc
    const sole = [], Bs = Bo(AFT) - .27;
    for (let i = 0; i <= 20; i++) {
      const r = [];
      for (let j = 0; j <= 16; j++) { const y = -Bs + 2 * Bs * j / 16, x = AFT + (xa(y) - .01 - AFT) * i / 20; r.push(V(x, y, SOLE + .002)); }
      sole.push(r);
    }
    add(new THREE.Mesh(grid(sole, null, .6), M.teak));
  }
  // helm bulkhead under the windshield arc, steps up to the walk-through, dash and wheel
  {
    const rows = [[], []], Bi = Bo(3.5) - .16;
    for (let j = 0; j <= 40; j++) { const y = -Bi + 2 * Bi * j / 40, x = xa(y); rows[0].push(V(x, y, deckZ(x, y))); rows[1].push(V(x, y, SOLE)); }
    add(new THREE.Mesh(grid(rows), M.liner));
    const xw = xa(0), hs = (deckZ(xw, 0) - SOLE) / 3;
    add(place(box(.5, 2 * WT - .06, hs, .02, M.liner), xw - .25, 0, SOLE + hs / 2));
    add(place(box(.26, 2 * WT - .06, 2 * hs, .02, M.liner), xw - .13, 0, SOLE + hs));
    for (const k of [1, 2]) add(place(box(.24, 2 * WT - .1, .01, .005, M.teakGrey), xw - (k === 1 ? .38 : .13), 0, SOLE + k * hs + .005));
    const dash = box(.34, .62, .3, .05, M.dash); place(dash, xa(.6) - .12, .6, deckZ(xa(.6), .6) - .2); dash.rotation.z = .35; add(dash);
    const glove = box(.3, .55, .26, .05, M.liner); place(glove, xa(-.6) - .1, -.6, deckZ(xa(-.6), -.6) - .2); add(glove);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.18, .014, 12, 48), M.black);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .05, 20), M.steel);
    const wg = new THREE.Group(); wg.add(wheel); hub.rotation.x = Math.PI / 2; wg.add(hub);
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.17, .012, .012), M.steel); sp.rotation.z = k * Math.PI * 2 / 3; sp.position.set(Math.cos(k * Math.PI * 2 / 3) * .085, Math.sin(k * Math.PI * 2 / 3) * .085, 0); wg.add(sp); }
    wg.position.copy(V(xa(.6) - .3, .6, deckZ(xa(.6), .6) - .12)); wg.rotation.y = Math.PI / 2; wg.rotation.x = -.55; add(wg);
  }
  // wrap-around windshield: across the helm on the arc, then aft along each gunwale, tapering
  // to nothing over the helm seats; open in the middle for the walk-through to the foredeck
  for (const side of [1, -1]) {
    const P = [];
    for (let y = WT; y < 1.0; y += .05) { const x = xa(y); P.push(new THREE.Vector3(x, y, deckZ(x, y) + .005)); }
    for (let x = xa(1.0) - .08; x >= 2.0; x -= .1) P.push(new THREE.Vector3(x, Bo(x) - .07, zg(x) + .005));
    const pc = new THREE.CatmullRomCurve3(P, false, "centripetal").getSpacedPoints(80), base = [], top = [];
    pc.forEach((p, i) => {
      // tangent over a wide window, so the rake turns smoothly round the corner
      const q = pc[Math.min(i + 6, pc.length - 1)], o = pc[Math.max(i - 6, 0)];
      let tx = q.x - o.x, ty = q.y - o.y; const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
      const nx = -ty, ny = tx;                       // inward: aft across the bow, towards the centreline on the sides
      const u = Math.min(1, Math.max(0, (p.x - 2.0) / 1.2)), h = .68 * Math.sqrt(u * u * (3 - 2 * u)) + .015;
      const r = (.07 + .26 * Math.max(0, -nx)) * h / .68;
      // top edge ignores the deck crown so the frame runs level across the bow
      base.push(V(p.x, side * p.y, p.z)); top.push(V(p.x + nx * r, side * (p.y + ny * r), zg(p.x) + .04 + h));
    });
    add(new THREE.Mesh(grid([base, top]), M.glass)).castShadow = false;
    add(tube(top, .02, M.black));
    add(tube(base, .012, M.black));
    add(tube([base[0], top[0]], .02, M.black));
  }

  // ---- seating ---------------------------------------------------------------------------------
  // diamond-quilted cream vinyl (helm buckets and aft bench, as on the yard's photos):
  // colour map with darker seams plus a bump map that puffs each diamond
  {
    const N = 256, cc = document.createElement("canvas"), bc = document.createElement("canvas"); cc.width = cc.height = bc.width = bc.height = N;
    const c = cc.getContext("2d"), b = bc.getContext("2d"), ci = c.createImageData(N, N), bi = b.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fu = ((x + y) / N) % 1, fv = ((x - y + N) / N) % 1, d = Math.min(fu, 1 - fu, fv, 1 - fv) * 2;
      const h = Math.pow(Math.min(1, d / .55), .6), k = (y * N + x) * 4, seam = d < .05 ? .82 : 1;
      ci.data[k] = 239 * seam; ci.data[k + 1] = 234 * seam; ci.data[k + 2] = 224 * seam; ci.data[k + 3] = 255;
      bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = 255 * h; bi.data[k + 3] = 255;
    }
    c.putImageData(ci, 0, 0); b.putImageData(bi, 0, 0);
    const map = new THREE.CanvasTexture(cc), bump = new THREE.CanvasTexture(bc); map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    M.quilt = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: .5, sheen: .5, sheenColor: 0xffffff, side: THREE.DoubleSide });
  }
  // quilt with diamonds about 10 cm across, for meshes whose UVs run 0..1 per face (rounded boxes)
  const quiltFor = (u, v) => {
    const m = M.quilt.clone(); m.map = M.quilt.map.clone(); m.bumpMap = M.quilt.bumpMap.clone();
    for (const t of [m.map, m.bumpMap]) { t.repeat.set(u / .1, v / .1); t.needsUpdate = true; }
    return m;
  };
  M.quiltM = quiltFor(1, 1);                     // for meshes with UVs in metres

  // helm bucket seat: a horseshoe shell (high at the back, low arms) around a round cushion,
  // black skirt underneath, swivel pedestal; built in seat space (x forward, z across, y up)
  function seat(x, y, accent) {
    const g = new THREE.Group(), A = 2.3, NA = 48, yb = .3;
    const prof = (r, h) => [[r, yb], [r + .004, yb + h * .55], [r, yb + h - .02], [r - .035, yb + h + .012], [r - .07, yb + h - .02], [r - .072, yb + .12]];
    const rows = [], skirt = [];
    for (let i = 0; i <= NA; i++) {
      const th = -A + 2 * A * i / NA, ca = -Math.cos(th), sa = Math.sin(th);
      const h = .17 + .38 * Math.pow(Math.cos(th * Math.PI / (2 * A)), 1.3);
      rows.push(prof(.27, h).map(([r, z]) => new THREE.Vector3(ca * r - .02, z, sa * r * 1.04)));
      skirt.push([new THREE.Vector3(ca * .24 - .02, yb + .01, sa * .25), new THREE.Vector3(ca * .2 - .02, yb - .1, sa * .2)]);
    }
    // UVs in metres: around the shell and up its profile
    const shell = grid(rows); const uv = [];
    rows.forEach((r, i) => { let acc = 0; r.forEach((p, j) => { if (j) acc += p.distanceTo(r[j - 1]); uv.push((-A + 2 * A * i / NA) * .26, acc); }); });
    shell.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.add(new THREE.Mesh(shell, M.quiltM));
    for (const r of [rows[0], rows[NA]]) g.add(new THREE.Mesh(grid([[r[0], r[1], r[2]], [r[5], r[4], r[3]]]), M.quiltM));
    g.add(new THREE.Mesh(grid(skirt), M.black));
    const cs = new THREE.Shape(); cs.absellipse(0, 0, .21, .22, 0, Math.PI * 2);
    const cg = new THREE.ExtrudeGeometry(cs, { depth: .05, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 4, curveSegments: 40 });
    cg.rotateX(-Math.PI / 2); cg.scale(1, 1, 1);
    const cush = new THREE.Mesh(cg, M.quiltM); cush.position.set(.02, yb + .04, 0); g.add(cush);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.2, .17, .08, 32), M.black); base.position.set(.02, yb, 0); g.add(base);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.035, .04, yb - .04, 20), M.steel); ped.position.y = (yb - .04) / 2; g.add(ped);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.13, .14, .015, 32), M.steel); foot.position.y = .008; g.add(foot);
    if (accent) { const pad = box(.05, .28, .12, .025, M.piping); pad.position.set(-.215, yb + .44, 0); pad.rotation.z = -.25; g.add(pad); }
    g.position.copy(V(x, y, SOLE));
    g.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } }); boat.add(g);
  }
  seat(2.95, .55); seat(2.95, -.55, true);
  {
    const Bw = Bo(AFT) - .26;
    add(place(box(.5, 2 * Bw, .42, .04, M.liner), AFT + .25, 0, SOLE + .21));
    add(place(box(.48, 2 * Bw - .02, .12, .05, quiltFor(2 * Bw, .48)), AFT + .26, 0, SOLE + .47));
    add(place(box(.14, 2 * Bw - .02, .3, .05, quiltFor(2 * Bw, .3)), AFT + .06, 0, SOLE + .58));
    add(place(box(.15, 2 * Bw - .06, .03, .015, M.piping), AFT + .07, 0, SOLE + .48));
    for (const s of [1, -1]) {
      add(place(box(.7, .42, .42, .04, M.liner), AFT + .85, s * (Bw - .21), SOLE + .21));
      add(place(box(.7, .42, .12, .05, quiltFor(.7, .42)), AFT + .85, s * (Bw - .21), SOLE + .47));
    }
  }

  // ---- outboard (Yamaha, 175 hp class) -------------------------------------------------------
  {
    const g = new THREE.Group(), zTop = zg(0);
    const P = (m, x, y, z) => { place(m, x, y, z); g.add(m); return m; };
    P(box(.16, .3, .32, .03, M.black), -.08, 0, zTop - .2);
    P(box(.72, .46, .6, .22, M.motor), -.39, 0, zTop + .28);
    P(box(.58, .46, .14, .05, M.dash), -.35, 0, zTop + .02);
    P(box(.5, .4, .16, .05, M.black), -.33, 0, zTop - .1);
    P(box(.26, .16, zTop - .2, .05, M.motor), -.32, 0, (zTop - .3) / 2 + .05);
    P(box(.44, .3, .02, .01, M.motor), -.34, 0, .02);
    const gc = new THREE.Mesh(new THREE.CapsuleGeometry(.065, .38, 6, 20), M.motor); gc.rotation.z = Math.PI / 2; P(gc, -.34, 0, -.14);
    P(box(.18, .03, .16, .01, M.motor), -.36, 0, -.25);
    for (let k = 0; k < 3; k++) { const b = box(.03, .1, .2, .01, M.steel); b.rotation.x = k * Math.PI * 2 / 3; b.position.copy(V(-.6, 0, -.14)); b.translateY(.09 * Math.cos(k * 2.09)); g.add(b); }
    // decal on both sides of the cowling
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128; const c = cv.getContext("2d");
    c.fillStyle = "#fff"; c.font = "700 64px Arial, sans-serif"; c.textBaseline = "middle"; c.fillText("YAMAHA", 20, 66);
    c.font = "500 34px Arial"; c.fillText("175", 400, 70);
    const dt = new THREE.CanvasTexture(cv); dt.colorSpace = THREE.SRGBColorSpace;
    const dm = new THREE.MeshBasicMaterial({ map: dt, transparent: true, toneMapped: false, opacity: .9 });
    for (const s of [1, -1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(.44, .11), dm); place(d, -.4, s * .233, zTop + .2); d.rotation.y = s > 0 ? 0 : Math.PI; g.add(d); }
    g.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
    boat.add(g);
  }

  // ---- stainless: bow rail (standard / high), wake tower, ski targa, bow ladder --------------
  function bowRail(h) {
    const g = new THREE.Group(), pts = [];
    const at = (x, s) => { const y = Math.max(.02, beam(x) - .09); return V(x, s * y, deckZ(x, y) + h); };
    for (let x = 4.25; x <= 6.0; x += .125) pts.push(at(x, 1));
    pts.push(V(6.08, 0, deckZ(6.08, 0) + h * .9));
    for (let x = 6.0; x >= 4.25; x -= .125) pts.push(at(x, -1));
    g.add(tube(pts, .013, M.steel));
    for (const x of [4.3, 4.9, 5.5]) for (const s of [1, -1]) {
      const y = beam(x) - .09, z0 = deckZ(x, y);
      g.add(tube([V(x, s * y, z0), V(x, s * y, z0 + h)], .011, M.steel));
    }
    g.add(tube([V(6.08, 0, deckZ(6.08, 0)), V(6.08, 0, deckZ(6.08, 0) + h * .9)], .011, M.steel));
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    return g;
  }
  extras.railStd = bowRail(.26); extras.railHigh = bowRail(.52);
  {
    const x = 1.95, y = beam(x) - .1, z = zg(x);
    extras.tower = new THREE.Group();
    // A-frame wake tower: two legs per side meet at the knee, crossbar on top
    extras.tower.add(tube([V(x + .3, y, z), V(x + .12, y * .9, z + .85), V(x - .05, y * .72, z + 1.42), V(x - .08, 0, z + 1.56), V(x - .05, -y * .72, z + 1.42), V(x + .12, -y * .9, z + .85), V(x + .3, -y, z)], .032, M.steel));
    for (const s of [1, -1]) extras.tower.add(tube([V(x - .5, s * y, z), V(x - .3, s * y * .9, z + .75), V(x - .05, s * y * .74, z + 1.4)], .026, M.steel));
    const xt = 1.15, yt = beam(xt) - .12, ztt = zg(xt);
    extras.targa = new THREE.Group();
    extras.targa.add(tube([V(xt, yt, ztt), V(xt - .02, yt * .9, ztt + .55), V(xt - .05, yt * .55, ztt + .85), V(xt - .05, 0, ztt + .9), V(xt - .05, -yt * .55, ztt + .85), V(xt - .02, -yt * .9, ztt + .55), V(xt, -yt, ztt)], .028, M.steel));
    extras.targa.add(tube([V(xt - .05, 0, ztt + .9), V(xt - .05, 0, ztt + 1.15)], .02, M.steel));
    extras.ladder = new THREE.Group();
    for (const s of [1, -1]) extras.ladder.add(tube([V(6.0, s * .08, deckZ(6, .08) + .01), V(6.25, s * .08, deckZ(6.2, 0) + .02), V(6.33, s * .08, .75), V(6.36, s * .08, .45)], .011, M.steel));
    for (const z of [.5, .65, .8]) extras.ladder.add(tube([V(6.34, -.08, z), V(6.34, .08, z)], .009, M.steel));
    [extras.tower, extras.targa, extras.ladder].forEach(g => g.traverse(m => { if (m.isMesh) m.castShadow = true; }));
  }
  for (const k in extras) { extras[k].visible = k === "railStd"; boat.add(extras[k]); }

  // ---- scene -----------------------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.review });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;   // Neutral keeps gelcoat colours saturated
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;outline:none";

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  if ("environmentIntensity" in scene) scene.environmentIntensity = .65;
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2); key.position.set(4, 9, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 }); key.shadow.radius = 6; key.shadow.bias = -.0005;
  scene.add(key, new THREE.HemisphereLight(0xdfe8ec, 0x1a2a30, .5));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), M.shadow); floor.rotation.x = -Math.PI / 2; floor.position.y = -.33; floor.receiveShadow = true;
  scene.add(floor, boat);

  const camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: .08, enablePan: false, minDistance: 6, maxDistance: 18, maxPolarAngle: Math.PI * .49 });
  const VIEWS = {
    three: { p: [7.2, 3.5, 8.6], t: [.25, .75, 0] },
    side: { p: [0, 2.3, 13.4], t: [0, .8, 0] },     // a little above the gunwale, like the yard's profile drawing
    stern: { p: [-8.2, 3.4, 6.4], t: [0, .8, 0] },
    top: { p: [.2, 13.5, 1.6], t: [.1, .3, 0] }
  };
  const start = opts.cam || VIEWS[opts.view || "three"];
  if (opts.cam) controls.minDistance = .5;   // opts.cam = { p, t }: review close-ups
  camera.position.set(...start.p); controls.target.set(...start.t);
  if (opts.orbit) {               // review: fixed azimuth (deg) around the hull for turntable frames
    const a = opts.orbit * Math.PI / 180, r = 11.2; camera.position.set(Math.sin(a) * r, 3.3, Math.cos(a) * r); controls.target.set(0, .75, 0);
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 40 : 28;          // portrait phones need a wider lens to fit the hull
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container); resize();

  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  let camTw = null, paintTw = null;
  function frame(now) {
    if (camTw) {
      const t = Math.min(1, (now - camTw.t0) / camTw.d), e = ease(t);
      camera.position.lerpVectors(camTw.p0, camTw.p1, e); controls.target.lerpVectors(camTw.q0, camTw.q1, e);
      if (t >= 1) camTw = null;
    }
    if (paintTw) {
      const t = Math.min(1, (now - paintTw.t0) / paintTw.d); U.uProg.value = ease(t);
      if (t >= 1) { U.uOld.value.copy(U.uNew.value); U.uMOld.value.copy(U.uMNew.value); U.uProg.value = 0; paintTw = null; }
    }
    controls.update(); renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const state = { zone: opts.zone || "full", color: opts.color || "#2B2C7C" };
  return {
    state,
    set(next) {
      Object.assign(state, next);
      if (paintTw) { U.uOld.value.copy(U.uNew.value); U.uMOld.value.copy(U.uMNew.value); }
      U.uNew.value.set(state.color); U.uMNew.value.set(...ZM[state.zone]); U.uProg.value = 0;
      paintTw = { t0: performance.now(), d: 900 };
    },
    view(name, d = 1100) {
      const v = VIEWS[name]; if (!v) return;
      camTw = { t0: performance.now(), d, p0: camera.position.clone(), q0: controls.target.clone(), p1: new THREE.Vector3(...v.p), q1: new THREE.Vector3(...v.t) };
    },
    equip(on) {           // on: { railHigh, tower, targa, ladder }
      extras.railHigh.visible = !!on.railHigh; extras.railStd.visible = !on.railHigh;
      extras.tower.visible = !!on.tower; extras.targa.visible = !!on.targa; extras.ladder.visible = !!on.ladder;
    },
    freeze(prog) { paintTw = null; U.uProg.value = prog; }   // review mode: a fixed moment of the wash
  };
};
