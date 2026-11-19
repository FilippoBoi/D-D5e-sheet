#!/usr/bin/env python3
"""
generate_dice.py - set di dadi poliedrici "honest" (isoedrici) per stampa 3D in resina.

Dadi: d4, d6, d8, d10, d% (d00), d12, d20.
Ogni dado e' orientato con UN VERTICE rivolto verso il basso (punto piu' basso
unico, a z = 0): niente base piana ne' spigolo che appoggia sul piatto.

Output (cartella --out): STL, OBJ, 3MF, AMF, STEP/STP per ogni dado + set completo.
Unita': millimetri.

Uso:  python3 generate_dice.py --out output [--blank] [--preview]
"""
import argparse
import json
import math
import os
import zipfile

import numpy as np
import shapely
import trimesh
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from scipy.spatial import ConvexHull
from shapely import affinity
from shapely.geometry import Point, Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import polylabel, unary_union

PHI = (1 + 5 ** 0.5) / 2
COS36 = math.cos(math.radians(36))

# ----------------------------------------------------------------------------
# Parametri dei dadi (mm).  hcap = altezza massima dei numeri.
# ----------------------------------------------------------------------------
SPECS = {
    "d4":  dict(kind="tetra", size=25.0, hcap=6.0),    # lato
    "d6":  dict(kind="cube",  size=16.0, hcap=7.5),    # lato
    "d8":  dict(kind="octa",  size=17.0, hcap=6.5),    # lato
    "d10": dict(kind="trap",  size=9.5,  hcap=6.5, apex=11.2),  # raggio anello, quota apice
    "d00": dict(kind="trap",  size=9.5,  hcap=6.5, apex=11.2),
    "d12": dict(kind="dodeca", size=8.2, hcap=7.5),    # lato
    "d20": dict(kind="icosa", size=14.5, hcap=6.0),    # lato
}
ORDER = ["d4", "d6", "d8", "d10", "d00", "d12", "d20"]
NUMBERS = {
    "d6": list(range(1, 7)), "d8": list(range(1, 9)),
    "d10": list(range(0, 10)), "d00": list(range(0, 100, 10)),
    "d12": list(range(1, 13)), "d20": list(range(1, 21)),
}


# ----------------------------------------------------------------------------
# Geometria dei solidi (centrati nell'origine)
# ----------------------------------------------------------------------------
def base_vertices(spec):
    k, s = spec["kind"], spec["size"]
    if k == "tetra":
        v = np.array([(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1)], float)
        return v * (s / (2 * math.sqrt(2)))
    if k == "cube":
        v = np.array([(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)], float)
        return v * (s / 2)
    if k == "octa":
        v = np.array([(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)], float)
        return v * (s / math.sqrt(2))
    if k == "dodeca":
        p = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        for a in (-1, 1):
            for b in (-1, 1):
                p += [(0, a / PHI, b * PHI), (a / PHI, b * PHI, 0), (a * PHI, 0, b / PHI)]
        return np.array(p, float) * (s / (2 / PHI))
    if k == "icosa":
        p = []
        for a in (-1, 1):
            for b in (-1, 1):
                p += [(0, a, b * PHI), (a, b * PHI, 0), (b * PHI, 0, a)]
        return np.array(p, float) * (s / 2)
    if k == "trap":
        # trapezoedro pentagonale: anello a zig-zag a quota +-a, apici a +-c.
        # I 10 aquiloni sono piani se  c = a (1+cos36)/(1-cos36).
        r, c = s, spec["apex"]
        a = c * (1 - COS36) / (1 + COS36)
        pts = [(0, 0, c), (0, 0, -c)]
        for i in range(5):
            t = math.radians(72 * i)
            pts.append((r * math.cos(t), r * math.sin(t), a))
            t = math.radians(72 * i + 36)
            pts.append((r * math.cos(t), r * math.sin(t), -a))
        return np.array(pts, float)
    raise ValueError(k)


def polyhedron_faces(V):
    """Facce poligonali convesse (indici ordinati CCW visti da fuori) dall'involucro convesso."""
    hull = ConvexHull(V)
    groups = []  # [equazione, set(indici)]
    for simplex, eq in zip(hull.simplices, hull.equations):
        for g in groups:
            if np.allclose(g[0], eq, atol=1e-7):
                g[1].update(simplex)
                break
        else:
            groups.append([eq, set(simplex)])
    faces = []
    for eq, idx in groups:
        idx = sorted(idx)
        n = eq[:3] / np.linalg.norm(eq[:3])
        c = V[idx].mean(0)
        e1 = V[idx[0]] - c
        e1 /= np.linalg.norm(e1)
        e2 = np.cross(n, e1)
        ang = [math.atan2(np.dot(V[i] - c, e2), np.dot(V[i] - c, e1)) for i in idx]
        faces.append([i for _, i in sorted(zip(ang, idx))])
    return faces


def face_normal(V, f):
    p = V[f]
    n = np.cross(p[1] - p[0], p[2] - p[0])
    return n / np.linalg.norm(n)


def triangulate(faces):
    return np.array([[f[0], f[i], f[i + 1]] for f in faces for i in range(1, len(f) - 1)])


def orient_vertex_down(V, vidx):
    """Ruota in modo che il vertice vidx punti verso -Z e sia a z = 0 (punto piu' basso)."""
    d = V[vidx] / np.linalg.norm(V[vidx])
    R = trimesh.geometry.align_vectors(d, [0, 0, -1])[:3, :3]
    V2 = V @ R.T
    V2[:, 2] -= V2[:, 2].min()
    return V2


def bottom_vertex(name, V):
    """Vertice che diventa il punto di appoggio (apice per il d10, uno qualsiasi negli altri)."""
    if SPECS[name]["kind"] == "trap":
        return 1  # apice inferiore
    return 0


# ----------------------------------------------------------------------------
# Testo: contorni vettoriali dei numeri (font TrueType -> poligoni shapely)
# ----------------------------------------------------------------------------
class _FlattenPen(BasePen):
    def __init__(self, gs, steps=4):
        super().__init__(gs)
        self.contours, self.cur, self.steps = [], None, steps

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            m = 1 - t
            self.cur.append((m ** 3 * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t ** 3 * p3[0],
                             m ** 3 * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t ** 3 * p3[1]))

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            m = 1 - t
            self.cur.append((m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0],
                             m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1]))

    def _closePath(self):
        if self.cur and len(self.cur) >= 3:
            self.contours.append(self.cur)
        self.cur = None

    _endPath = _closePath


def find_font(user_font=None):
    cands = [user_font] if user_font else []
    try:
        import matplotlib
        cands.append(os.path.join(matplotlib.get_data_path(), "fonts/ttf/DejaVuSans-Bold.ttf"))
    except Exception:
        pass
    cands += ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/Library/Fonts/Arial Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"]
    for c in cands:
        if c and os.path.exists(c):
            return c
    raise SystemExit("Nessun font TrueType trovato: usa --font /percorso/font.ttf")


class TextMaker:
    """Poligoni dei numeri, altezza cifre = 1, bbox centrata nell'origine."""

    def __init__(self, font_path):
        self.font = TTFont(font_path)
        self.gs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.hmtx = self.font["hmtx"]
        self.cache = {}
        self.unit = self._glyph("1").bounds[3]  # altezza della cifra '1'

    def _glyph(self, ch):
        pen = _FlattenPen(self.gs)
        self.gs[self.cmap[ord(ch)]].draw(pen)
        g = None
        for c in pen.contours:
            p = Polygon(c).buffer(0)
            g = p if g is None else g.symmetric_difference(p)
        return g

    def get(self, text):
        if text in self.cache:
            return self.cache[text]
        x, geoms = 0.0, []
        for ch in text:
            g = self._glyph(ch)
            geoms.append(affinity.translate(g, x, 0))
            x += self.hmtx[self.cmap[ord(ch)]][0] * 0.90
        poly = unary_union(geoms)
        poly = affinity.scale(poly, 1 / self.unit, 1 / self.unit, origin=(0, 0))
        if text in ("6", "9"):  # barretta sotto: distingue 6 da 9
            x0, _, x1, _ = poly.bounds
            poly = unary_union([poly, box(x0, -0.24, x1, -0.13)])
        x0, y0, x1, y1 = poly.bounds
        poly = affinity.translate(poly, -(x0 + x1) / 2, -(y0 + y1) / 2)
        poly = poly.simplify(0.005)
        self.cache[text] = poly
        return poly


# ----------------------------------------------------------------------------
# Posizionamento dei numeri sulle facce
# ----------------------------------------------------------------------------
class Placement:
    def __init__(self, face, text, o, r, u, n, slides, poly_local):
        self.face, self.text = face, text
        self.o, self.r, self.u, self.n = o, r, u, n
        self.slides = slides        # offset candidati lungo u (mm)
        self.poly = poly_local      # faccia nel riferimento locale (x=r, y=u), origine in o
        self.slide = 0.0


def _frame(V, f, target_pt):
    n = face_normal(V, f)
    o = V[f].mean(0)
    d = target_pt - o
    d -= np.dot(d, n) * n
    u = d / np.linalg.norm(d)
    r = np.cross(u, n)
    loc = Polygon([(np.dot(V[i] - o, r), np.dot(V[i] - o, u)) for i in f])
    return n, o, r, u, loc


def build_placements(name, V, faces, assignment, up_mode):
    """Una Placement per ogni numero. d4: 3 numeri per faccia (uno per vertice)."""
    out = []
    kind = SPECS[name]["kind"]
    if kind == "tetra":
        for fi, f in enumerate(faces):
            n = face_normal(V, f)
            cen = V[f].mean(0)
            for vi in f:
                n_, o, r, u, loc = _frame(V, f, V[vi])
                Rf = np.linalg.norm(V[vi] - cen)
                slides = list(np.linspace(0.25 * Rf, 0.9 * Rf, 40))
                out.append(Placement(fi, str(vi + 1), o, r, u, n_, slides, loc))
        return out
    for fi, f in enumerate(faces):
        pts = V[f]
        if kind == "trap":
            tgt = V[f][int(np.argmax(np.abs(V[f][:, 2] - V[:, 2].mean())))]  # apice del polo
        elif up_mode == "edge":
            tgt = (V[f[0]] + V[f[1]]) / 2
        else:
            tgt = V[f[0]]
        n, o, r, u, loc = _frame(V, f, tgt)
        rho = polylabel(loc, 0.01).distance(loc.exterior)
        slides = list(np.linspace(-0.7 * rho, 0.7 * rho, 57))
        out.append(Placement(fi, str(assignment[fi]), o, r, u, n, slides, loc))
    return out


def _fits(inner, T0, s, y0):
    return inner.covers(affinity.translate(affinity.scale(T0, s, s, origin=(0, 0)), 0, y0))


def best_scale(pl, T0, margin, smax):
    """Massima scala del testo che sta nella faccia (margine incluso) con la miglior posizione."""
    inner = pl.poly.buffer(-margin)
    if inner.is_empty:
        return 0.0
    best = 0.0
    for y0 in pl.slides:
        if not inner.contains(Point(0, y0)):
            continue
        if _fits(inner, T0, smax, y0):
            return smax
        lo, hi = 0.0, smax
        for _ in range(16):
            mid = (lo + hi) / 2
            if _fits(inner, T0, mid, y0):
                lo = mid
            else:
                hi = mid
        best = max(best, lo)
    return best


def center_placement(pl, T0, h, margin, far=False):
    """Con altezza finale h sceglie l'offset: massima distanza dai bordi, oppure
    (far=True, d4) il piu' vicino al vertice."""
    inner = pl.poly.buffer(-margin)
    best, by = -1, None
    for y0 in np.linspace(pl.slides[0], pl.slides[-1], 161):
        T = affinity.translate(affinity.scale(T0, h, h, origin=(0, 0)), 0, y0)
        if not inner.covers(T):
            continue
        clr = y0 if far else pl.poly.exterior.distance(T)
        if clr > best:
            best, by = clr, y0
    pl.slide = by
    return by is not None


def placed_polygon(pl, tm, h, ref=None):
    """Poligono del numero nel riferimento locale di pl, o in quello di `ref` (stessa faccia)."""
    poly = affinity.translate(affinity.scale(tm.get(pl.text), h, h, origin=(0, 0)), 0, pl.slide)
    if ref is None or ref is pl:
        return poly

    def conv(xy):
        d = pl.o + xy[:, :1] * pl.r + xy[:, 1:] * pl.u - ref.o
        return np.column_stack([d @ ref.r, d @ ref.u])
    return shapely.transform(poly, conv)


# ----------------------------------------------------------------------------
# Assegnazione dei numeri (facce opposte con somma costante) con bilanciamento
# ----------------------------------------------------------------------------
def assign_numbers(name, V, faces, tm, h, seed=7):
    vals = NUMBERS[name]
    nF = len(faces)
    normals = np.array([face_normal(V, f) for f in faces])
    partner = [int(np.argmin(np.linalg.norm(normals + normals[i], axis=1))) for i in range(nF)]
    assert all(partner[partner[i]] == i and partner[i] != i for i in range(nF)), "solido non centrosimmetrico"
    pairs = sorted({tuple(sorted((i, partner[i]))) for i in range(nF)})
    adj = [(i, j) for i in range(nF) for j in range(i + 1, nF) if len(set(faces[i]) & set(faces[j])) == 2]
    vf = {}
    for fi, f in enumerate(faces):
        for v in f:
            vf.setdefault(v, []).append(fi)
    rank = {v: k + 1 for k, v in enumerate(vals)}       # 1..N (per i costi)
    area = {v: tm.get(str(v)).area * h * h for v in vals}
    vpairs = [(vals[k], vals[-1 - k]) for k in range(nF // 2)]
    rng = np.random.default_rng(seed)

    def labels(state):
        order, flip = state
        lab = [None] * nF
        for k, (fa, fb) in enumerate(pairs):
            a, b = vpairs[order[k]]
            if flip[k]:
                a, b = b, a
            lab[fa], lab[fb] = a, b
        return lab

    def cost(state):
        lab = labels(state)
        d = [abs(rank[lab[a]] - rank[lab[b]]) for a, b in adj]
        vs = np.array([sum(rank[lab[f]] for f in vf[v]) for v in vf], float)
        imb = np.linalg.norm(sum(area[lab[i]] * normals[i] for i in range(nF))) / sum(area.values())
        return -(2 * min(d) + 0.5 * np.mean(d)) * 20 / nF + 30 * vs.std() / vs.mean() + 150 * imb

    best_state, best_cost = None, 1e9
    for _ in range(6):
        st = (list(rng.permutation(nF // 2)), list(rng.integers(0, 2, nF // 2)))
        c = cost(st)
        T = 1.0
        for it in range(6000):
            order, flip = list(st[0]), list(st[1])
            if rng.random() < 0.7:
                i, j = rng.choice(nF // 2, 2, replace=False)
                order[i], order[j] = order[j], order[i]
            else:
                i = rng.integers(nF // 2)
                flip[i] ^= 1
            ns = (order, flip)
            nc = cost(ns)
            if nc < c or rng.random() < math.exp((c - nc) / max(T, 1e-6)):
                st, c = ns, nc
            T *= 0.999
            if c < best_cost:
                best_state, best_cost = st, c
    lab = labels(best_state)
    d = [abs(rank[lab[a]] - rank[lab[b]]) for a, b in adj]
    info = dict(min_adjacent_rank_diff=int(min(d)), mean_adjacent_rank_diff=float(np.mean(d)))
    return lab, info


# ----------------------------------------------------------------------------
# Costruzione del dado
# ----------------------------------------------------------------------------
MARGIN = 0.6


class Die:
    pass


def build_die(name, tm, depth, numbers=True, seed=7):
    spec = SPECS[name]
    V0 = base_vertices(spec)
    faces = polyhedron_faces(V0)
    V = orient_vertex_down(V0, bottom_vertex(name, V0))
    die = Die()
    die.name, die.V, die.faces, die.depth = name, V, faces, depth
    die.blank = trimesh.Trimesh(V, triangulate(faces), process=False)
    die.placements, die.labels, die.info, die.h = [], None, {}, 0.0
    if not numbers:
        die.mesh = die.blank
        return die
    up_mode = "edge" if spec["kind"] == "cube" else "vertex"

    if spec["kind"] == "tetra":
        pls = build_placements(name, V, faces, None, up_mode)
        h = min(best_scale(p, tm.get(p.text), MARGIN, spec["hcap"]) for p in pls)
        die.labels = {fi: [p.text for p in pls if p.face == fi] for fi in range(len(faces))}
    else:
        nums = NUMBERS[name]
        dummy = [nums[0]] * len(faces)
        pls = build_placements(name, V, faces, dummy, up_mode)
        # altezza comune: il caso peggiore su una faccia rappresentativa (facce equivalenti)
        h = spec["hcap"]
        for v in nums:
            pl = pls[0]
            h = min(h, best_scale(pl, tm.get(str(v)), MARGIN, spec["hcap"]))
        h *= 0.97
        while True:
            lab, info = assign_numbers(name, V, faces, tm, h, seed)
            pls = build_placements(name, V, faces, lab, up_mode)
            if all(center_placement(p, tm.get(p.text), h, MARGIN) for p in pls):
                break
            h *= 0.97
        die.labels = {fi: [str(lab[fi])] for fi in range(len(faces))}
        die.info = info
    if spec["kind"] == "tetra":
        # un numero per vertice: vicino al vertice, senza toccare gli altri due della faccia
        while True:
            h *= 0.97
            if not all(center_placement(p, tm.get(p.text), h, MARGIN, far=True) for p in pls):
                continue
            ok = True
            for fi in range(len(faces)):
                fp = [p for p in pls if p.face == fi]
                polys = [placed_polygon(p, tm, h, fp[0]) for p in fp]
                ok &= all(polys[i].distance(polys[j]) > 1.0
                          for i in range(3) for j in range(i + 1, 3))
            if ok:
                break
    die.h, die.placements = h, pls
    die.mesh = engrave(die, tm)
    return die


def engrave(die, tm):
    pieces = []
    for pl in die.placements:
        poly = affinity.scale(tm.get(pl.text), die.h, die.h, origin=(0, 0))
        geoms = list(poly.geoms) if hasattr(poly, "geoms") else [poly]
        solid = trimesh.util.concatenate(
            [trimesh.creation.extrude_polygon(g, die.depth + 0.6) for g in geoms])
        M = np.eye(4)
        M[:3, 0], M[:3, 1], M[:3, 2] = pl.r, pl.u, pl.n
        M[:3, 3] = pl.o + pl.u * pl.slide - pl.n * die.depth
        solid.apply_transform(M)
        pieces.append(solid)
    tools = trimesh.util.concatenate(pieces)
    res = trimesh.boolean.difference([die.blank, tools], engine="manifold")
    res.merge_vertices()
    res.remove_unreferenced_vertices()
    return res


# ----------------------------------------------------------------------------
# Esportazione mesh
# ----------------------------------------------------------------------------
def write_stl(items, path):
    m = trimesh.util.concatenate([it[1] for it in items])
    m.export(path)


def write_obj(items, path):
    lines = ["# Dadi honest - unita': millimetri"]
    base = 1
    for name, m in items:
        lines.append(f"o {name}")
        lines += [f"v {x:.6f} {y:.6f} {z:.6f}" for x, y, z in m.vertices]
        lines += [f"f {a + base} {b + base} {c + base}" for a, b, c in m.faces]
        base += len(m.vertices)
    open(path, "w").write("\n".join(lines) + "\n")


def write_3mf(items, path):
    res = []
    for i, (name, m) in enumerate(items, 1):
        v = "".join(f'<vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}"/>' for x, y, z in m.vertices)
        t = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in m.faces)
        res.append(f'<object id="{i}" type="model" name="{name}"><mesh><vertices>{v}</vertices>'
                   f'<triangles>{t}</triangles></mesh></object>')
    build = "".join(f'<item objectid="{i}"/>' for i in range(1, len(items) + 1))
    model = ('<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" '
             'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
             '<metadata name="Title">Honest dice</metadata>'
             f'<resources>{"".join(res)}</resources><build>{build}</build></model>')
    ct = ('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
            'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ct)
        z.writestr("_rels/.rels", rels)
        z.writestr("3D/3dmodel.model", model)


def write_amf(items, path):
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<amf unit="millimeter" version="1.1">',
           '<metadata type="name">Honest dice</metadata>']
    for i, (name, m) in enumerate(items):
        out.append(f'<object id="{i}"><metadata type="name">{name}</metadata><mesh><vertices>')
        out += [f"<vertex><coordinates><x>{x:.6f}</x><y>{y:.6f}</y><z>{z:.6f}</z></coordinates></vertex>"
                for x, y, z in m.vertices]
        out.append("</vertices><volume>")
        out += [f"<triangle><v1>{a}</v1><v2>{b}</v2><v3>{c}</v3></triangle>" for a, b, c in m.faces]
        out.append("</volume></mesh></object>")
    out.append("</amf>")
    open(path, "w").write("\n".join(out) + "\n")


# ----------------------------------------------------------------------------
# STEP (B-rep vero con OpenCascade: facce piane, numeri incisi con tagli prismatici)
# ----------------------------------------------------------------------------
def step_shape(die, tm, offset=(0, 0, 0)):
    from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut
    from OCP.BRepBuilderAPI import (BRepBuilderAPI_MakeFace, BRepBuilderAPI_MakePolygon,
                                    BRepBuilderAPI_MakeSolid, BRepBuilderAPI_Sewing)
    from OCP.BRepPrimAPI import BRepPrimAPI_MakePrism
    from OCP.ShapeFix import ShapeFix_Face, ShapeFix_Solid
    from OCP.TopAbs import TopAbs_SHELL
    from OCP.TopExp import TopExp_Explorer
    from OCP.TopoDS import TopoDS
    from OCP.collections import List_TopoDS_Shape as ShapeList
    from OCP.gp import gp_Pnt, gp_Vec

    off = np.array(offset, float)

    def wire(pts):
        mp = BRepBuilderAPI_MakePolygon()
        for p in pts:
            mp.Add(gp_Pnt(*(p + off)))
        mp.Close()
        return mp.Wire()

    sew = BRepBuilderAPI_Sewing(1e-5)
    for f in die.faces:
        sew.Add(BRepBuilderAPI_MakeFace(wire(die.V[f]), True).Face())
    sew.Perform()
    sewed = sew.SewedShape()
    shell = TopoDS.Shell(sewed if sewed.ShapeType() == TopAbs_SHELL
                           else TopExp_Explorer(sewed, TopAbs_SHELL).Current())
    solid = BRepBuilderAPI_MakeSolid(shell).Solid()
    fx = ShapeFix_Solid(solid)
    fx.Perform()
    solid = fx.Solid()
    if not die.placements:
        return solid

    tools = ShapeList()
    for pl in die.placements:
        poly = orient(affinity.scale(tm.get(pl.text), die.h, die.h, origin=(0, 0)), 1.0)
        for g in (poly.geoms if hasattr(poly, "geoms") else [poly]):
            g = orient(g, 1.0)
            base = pl.o + pl.u * pl.slide - pl.n * die.depth

            def to3d(coords):
                return [base + x * pl.r + y * pl.u for x, y in list(coords)[:-1]]
            mf = BRepBuilderAPI_MakeFace(wire(to3d(g.exterior.coords)), True)
            for ring in g.interiors:
                mf.Add(wire(to3d(ring.coords)))
            sf = ShapeFix_Face(mf.Face())
            sf.FixOrientation()
            sf.Perform()
            prism = BRepPrimAPI_MakePrism(sf.Face(), gp_Vec(*(pl.n * (die.depth + 0.6)))).Shape()
            tools.Append(prism)
    cut = BRepAlgoAPI_Cut()
    args = ShapeList()
    args.Append(solid)
    cut.SetArguments(args)
    cut.SetTools(tools)
    cut.Build()
    if not cut.IsDone():
        raise RuntimeError("taglio OpenCascade fallito")
    return cut.Shape()


def write_step(shapes, path):
    from OCP.BRep import BRep_Builder
    from OCP.Interface import Interface_Static
    from OCP.STEPControl import STEPControl_AsIs, STEPControl_Writer
    from OCP.TopoDS import TopoDS_Compound
    Interface_Static.SetCVal_s("write.step.unit", "MM")
    comp = TopoDS_Compound()
    b = BRep_Builder()
    b.MakeCompound(comp)
    for s in shapes:
        b.Add(comp, s)
    w = STEPControl_Writer()
    w.Transfer(comp, STEPControl_AsIs)
    if w.Write(path) != 1:  # IFSelect_RetDone
        raise RuntimeError("scrittura STEP fallita")


# ----------------------------------------------------------------------------
# Anteprima
# ----------------------------------------------------------------------------
def render_preview(dice, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.collections import PolyCollection
    fig, axes = plt.subplots(2, len(dice), figsize=(3.2 * len(dice), 6.6), dpi=110)
    light = np.array([0.3, -0.5, 0.8])
    light /= np.linalg.norm(light)
    for k, die in enumerate(dice):
        m = die.mesh
        # riporta il dado con una faccia numerata verso l'osservatore e (riga 2) in assetto di stampa
        views = []
        n0 = die.placements[0].n if die.placements else face_normal(die.V, die.faces[0])
        zax = n0 / np.linalg.norm(n0)
        ax_ = np.cross([0, 0, 1], zax)
        ax_ = ax_ / np.linalg.norm(ax_) if np.linalg.norm(ax_) > 1e-6 else np.array([1, 0, 0])
        ay_ = np.cross(zax, ax_)
        views.append(np.array([ax_, ay_, zax]))
        # vista di stampa: z in alto, leggera inclinazione
        el, az = math.radians(15), math.radians(-30)
        Rz = np.array([[math.cos(az), -math.sin(az), 0], [math.sin(az), math.cos(az), 0], [0, 0, 1]])
        Rx = np.array([[1, 0, 0], [0, math.cos(el - math.pi / 2), -math.sin(el - math.pi / 2)],
                       [0, math.sin(el - math.pi / 2), math.cos(el - math.pi / 2)]])
        views.append(Rx @ Rz)
        # triangoli "incisi": piano piu' profondo del piano esterno con la stessa normale
        fn = m.face_normals
        off = np.einsum("ij,ij->i", fn, m.triangles_center)
        key = np.round(fn, 3)
        sunk = np.zeros(len(fn), bool)
        for kk in np.unique(key, axis=0):
            sel = np.all(key == kk, axis=1)
            sunk[sel] = off[sel] < off[sel].max() - 0.05
        for row, Rv in enumerate(views):
            ax = axes[row, k]
            P = (m.vertices - m.vertices.mean(0)) @ Rv.T
            tri = m.faces
            nrm = m.face_normals @ Rv.T
            vis = nrm[:, 2] > 0
            depth = P[tri][:, :, 2].mean(1)
            idx = [i for i in np.argsort(depth) if vis[i]]
            shade = np.clip(nrm[idx] @ light, 0, 1) * 0.65 + 0.3
            cols = [(0.35 * s + 0.1, 0.55 * s + 0.1, 0.9 * s) if not sunk[i] else (0.95, 0.55, 0.15)
                    for s, i in zip(shade, idx)]
            ax.add_collection(PolyCollection(P[tri[idx]][:, :, :2], facecolors=cols, edgecolors=cols, linewidths=0.2))
            ax.set_xlim(-16, 16)
            ax.set_ylim(-16, 16)
            ax.set_aspect("equal")
            ax.axis("off")
            ax.set_title(("d%" if die.name == "d00" else die.name) + (" - facce" if row == 0 else " - assetto di stampa"), fontsize=9)
    fig.tight_layout()
    fig.savefig(path)


# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="output")
    ap.add_argument("--dice", default=",".join(ORDER))
    ap.add_argument("--depth", type=float, default=0.4, help="profondita' incisione numeri (mm)")
    ap.add_argument("--blank", action="store_true", help="dadi senza numeri")
    ap.add_argument("--no-step", action="store_true")
    ap.add_argument("--font")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()

    tm = TextMaker(find_font(a.font))
    names = [n.strip() for n in a.dice.split(",")]
    out = a.out
    for sub in ("", "singoli", "blank"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)

    dice, report = [], {}
    for n in names:
        print(f"[{n}] costruzione...", flush=True)
        d = build_die(n, tm, a.depth, numbers=not a.blank, seed=a.seed)
        dice.append(d)
        report[n] = dict(labels=d.labels, text_height_mm=round(d.h, 3), **d.info,
                         normals=[np.round(face_normal(d.V, f), 5).tolist() for f in d.faces])
        label = "d10_percentile" if n == "d00" else n
        items = [(label, d.mesh)]
        write_stl(items, os.path.join(out, "singoli", f"{label}.stl"))
        write_obj(items, os.path.join(out, "singoli", f"{label}.obj"))
        write_3mf(items, os.path.join(out, "singoli", f"{label}.3mf"))
        write_amf(items, os.path.join(out, "singoli", f"{label}.amf"))
        d.blank.export(os.path.join(out, "blank", f"{label}_blank.stl"))
        if not a.no_step:
            write_step([step_shape(d, tm)], os.path.join(out, "singoli", f"{label}.step"))

    # set completo su una piastra: 4 + 3 dadi, passo 30 mm
    items, shapes = [], []
    for i, d in enumerate(dice):
        dx, dy = (i % 4) * 30.0, -(i // 4) * 30.0
        m = d.mesh.copy()
        m.apply_translation([dx, dy, 0])
        label = "d10_percentile" if d.name == "d00" else d.name
        items.append((label, m))
        if not a.no_step:
            shapes.append(step_shape(d, tm, offset=(dx, dy, 0)))
    write_stl(items, os.path.join(out, "set_completo.stl"))
    write_obj(items, os.path.join(out, "set_completo.obj"))
    write_3mf(items, os.path.join(out, "set_completo.3mf"))
    write_amf(items, os.path.join(out, "set_completo.amf"))
    if not a.no_step:
        write_step(shapes, os.path.join(out, "set_completo.step"))
    json.dump(report, open(os.path.join(out, "numeri.json"), "w"), indent=1, ensure_ascii=False)
    if a.preview:
        render_preview(dice, os.path.join(out, "anteprima.png"))
    print("fatto ->", out)


if __name__ == "__main__":
    main()
