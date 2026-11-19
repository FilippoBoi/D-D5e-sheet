#!/usr/bin/env python3
"""
verify_dice.py - verifica indipendente dei modelli generati (rilegge i file, non il codice).

Per ogni dado controlla:
  * tutti i formati (STL, OBJ, 3MF, AMF, STEP) si aprono e danno lo stesso solido (volume, ingombro)
  * mesh chiusa (watertight), orientata, volume > 0, un solo corpo, nessun triangolo degenere
  * assetto: UN SOLO vertice a z = 0 (appoggio a vertice), nessuna faccia/spigolo sul piano
  * inclinazione minima delle superfici rivolte verso il basso (indica quanto serve supportare)
  * "honest": sul dado vuoto, facce tutte uguali (area, distanza dal centro, lati), baricentro al centro
  * numeri: somma costante sulle facce opposte; spostamento del baricentro dovuto all'incisione

Uso:  python3 verify_dice.py [cartella_output]      (exit code 1 se qualcosa fallisce)
"""
import json
import math
import os
import sys
import xml.etree.ElementTree as ET
import zipfile

import numpy as np
import trimesh

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "output")
LABEL = {"d4": "d4", "d6": "d6", "d8": "d8", "d10": "d10", "d00": "d10_percentile", "d12": "d12", "d20": "d20"}
SUM = {"d6": 7, "d8": 9, "d10": 9, "d00": 90, "d12": 13, "d20": 21}
fails = []


def check(ok, msg):
    if not ok:
        fails.append(msg)
    return "OK " if ok else "KO "


# --- lettori indipendenti dai writer --------------------------------------------------
def read_3mf(path):
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read("3D/3dmodel.model"))
    ns = {"m": root.tag.split("}")[0][1:]}
    assert root.get("unit") == "millimeter"
    meshes = []
    for obj in root.findall(".//m:object", ns):
        v = np.array([[float(e.get(k)) for k in "xyz"] for e in obj.findall(".//m:vertex", ns)])
        t = np.array([[int(e.get(k)) for k in ("v1", "v2", "v3")] for e in obj.findall(".//m:triangle", ns)])
        meshes.append(trimesh.Trimesh(v, t, process=False))
    return meshes


def read_amf(path):
    root = ET.parse(path).getroot()
    assert root.get("unit") == "millimeter"
    meshes = []
    for obj in root.findall("object"):
        v = np.array([[float(c.text) for c in e.find("coordinates")] for e in obj.iter("vertex")])
        t = np.array([[int(c.text) for c in e] for e in obj.iter("triangle")])
        meshes.append(trimesh.Trimesh(v, t, process=False))
    return meshes


def step_volume(path):
    try:
        from OCP.BRepGProp import BRepGProp
        from OCP.GProp import GProp_GProps
        from OCP.IFSelect import IFSelect_RetDone
        from OCP.STEPControl import STEPControl_Reader
        from OCP.BRepCheck import BRepCheck_Analyzer
    except ImportError:
        return None
    r = STEPControl_Reader()
    if r.ReadFile(path) != IFSelect_RetDone:
        return -1, False
    r.TransferRoots()
    shp = r.OneShape()
    g = GProp_GProps()
    BRepGProp.VolumeProperties_s(shp, g)
    com = g.CentreOfMass()
    return g.Mass(), BRepCheck_Analyzer(shp).IsValid(), (com.X(), com.Y(), com.Z())


# --- analisi geometriche -------------------------------------------------------------
def plane_clusters(m):
    """Raggruppa i triangoli in piani (normale, offset): per il dado vuoto = le facce."""
    n = np.round(m.face_normals, 4)
    off = np.round(np.einsum("ij,ij->i", m.face_normals, m.triangles_center), 3)
    key = np.column_stack([n, off])
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    return uniq, inv


def honest_report(blank):
    uniq, inv = plane_clusters(blank)
    inv = inv.ravel()
    a = blank.area_faces
    c = blank.center_mass
    n_f = blank.face_normals
    # normale e distanza dal baricentro di ciascuna faccia, con valori esatti (non arrotondati)
    area = np.bincount(inv, weights=a)
    nrm = np.stack([np.bincount(inv, weights=a * n_f[:, k]) for k in range(3)], axis=1)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
    dist_tri = np.einsum("ij,ij->i", n_f, blank.triangles_center - c)
    inr = np.bincount(inv, weights=a * dist_tri) / area
    sigs = []
    for k in range(len(uniq)):
        tri = np.where(inv == k)[0]
        edges = blank.edges_sorted[np.concatenate([[3 * t, 3 * t + 1, 3 * t + 2] for t in tri])]
        e, cnt = np.unique(edges, axis=0, return_counts=True)
        bd = e[cnt == 1]  # spigoli di bordo della faccia
        L = np.linalg.norm(blank.vertices[bd[:, 0]] - blank.vertices[bd[:, 1]], axis=1)
        sigs.append(np.round(np.sort(L), 3))
    same_sig = all(len(s) == len(sigs[0]) and np.allclose(s, sigs[0], atol=2e-3) for s in sigs)
    return dict(faces=len(uniq), area_spread=(area.max() - area.min()) / area.mean(),
                dist_spread=(inr.max() - inr.min()) / inr.mean(), same_edges=same_sig,
                inradius=inr.mean(), com=c)


def overhang(m, thresh=1e-3):
    """Angolo (da orizzontale) minimo delle facce rivolte verso il basso."""
    nz = m.face_normals[:, 2]
    down = nz < -thresh
    if not down.any():
        return 90.0
    ang = np.degrees(np.arccos(np.clip(-nz[down], -1, 1)))  # 0 = piatta orizzontale
    return float(ang.min())


def main():
    labels = json.load(open(os.path.join(OUT, "numeri.json")))
    rows = []
    for key, lab in LABEL.items():
        if key not in labels:
            continue
        sing = os.path.join(OUT, "singoli", lab)
        ms = {"stl": trimesh.load(sing + ".stl", process=False),
              "obj": trimesh.load(sing + ".obj", process=False, force="mesh"),
              "3mf": read_3mf(sing + ".3mf")[0], "amf": read_amf(sing + ".amf")[0]}
        m = ms["stl"]
        m.merge_vertices()
        vol = m.volume
        r = {"die": lab}
        # formati coerenti
        for fmt, mm in ms.items():
            v = abs(mm.volume)
            ok = abs(v - vol) / vol < 5e-4 and np.allclose(mm.bounds, m.bounds, atol=2e-3)
            check(ok, f"{lab}.{fmt}: volume/ingombro diversi")
        r["formati"] = "stl obj 3mf amf"
        sv = step_volume(sing + ".step")
        if sv:
            ok = sv[0] > 0 and abs(sv[0] - vol) / vol < 2e-3 and sv[1]
            r["step"] = f"{sv[0]:.1f} mm3 valido={sv[1]}"
            check(ok, f"{lab}.step: volume {sv[0]:.2f} vs mesh {vol:.2f} / geometria non valida")
        else:
            r["step"] = "n/d (OCP assente)"
        # stampabilita'
        r["watertight"] = check(m.is_watertight and m.is_winding_consistent and m.is_volume, f"{lab}: mesh non chiusa/orientata")
        r["corpi"] = len(m.split(only_watertight=False))
        check(r["corpi"] == 1, f"{lab}: piu' corpi")
        r["degeneri"] = int((m.area_faces < 1e-9).sum())
        check(r["degeneri"] == 0, f"{lab}: triangoli degeneri")
        zmin = m.vertices[:, 2].min()
        low = np.where(m.vertices[:, 2] < zmin + 1e-4)[0]
        r["vertici_a_z0"] = len(low)
        check(abs(zmin) < 1e-6 and len(low) == 1, f"{lab}: non appoggia su un solo vertice")
        r["sovrapp_min"] = None  # calcolato sul dado vuoto (sotto)
        r["h_mm"] = round(m.bounds[1][2], 2)
        r["vol_mm3"] = round(vol, 1)
        # honest sul dado vuoto
        blank = trimesh.load(os.path.join(OUT, "blank", lab + "_blank.stl"))
        blank.merge_vertices()
        h = honest_report(blank)
        ok = (h["area_spread"] < 1e-4 and h["dist_spread"] < 1e-4 and h["same_edges"])
        r["sovrapp_min"] = round(overhang(blank), 1)
        r["honest"] = f"{h['faces']} facce uguali" if ok else "NO"
        check(ok, f"{lab}: facce non equivalenti ({h})")
        shift = np.linalg.norm(m.center_mass - blank.center_mass)
        r["baricentro_shift_mm"] = round(shift, 3)
        r["shift_%_inraggio"] = round(100 * shift / h["inradius"], 2)
        # numeri
        L = labels[key]["labels"]
        if key in SUM:
            vals = {int(k): int(v[0]) for k, v in L.items()}
            ok = sorted(vals.values()) == sorted(
                int(x) for x in (range(0, 100, 10) if key == "d00" else range(0 if key == "d10" else 1,
                                                                            10 if key == "d10" else len(vals) + 1)))
            N = np.array(L_norm := labels[key]["normals"])
            opp = [int(np.argmin(np.linalg.norm(N + N[i], axis=1))) for i in range(len(N))]
            sums = {vals[i] + vals[opp[i]] for i in range(len(N))}
            ok2 = sums == {SUM[key]} and all(opp[opp[i]] == i for i in range(len(N)))
            r["numeri"] = f"completi, opposte={sorted(sums)[0] if ok2 else 'KO'}" if ok else "KO"
            check(ok, f"{lab}: insieme numeri errato")
            check(ok2, f"{lab}: somma facce opposte non costante {sums}")
        rows.append(r)

    # set completo: stessi solidi
    ms = trimesh.load(os.path.join(OUT, "set_completo.stl"))
    parts = read_3mf(os.path.join(OUT, "set_completo.3mf"))
    parts_amf = read_amf(os.path.join(OUT, "set_completo.amf"))
    check(len(parts) == len(parts_amf) == len(rows), "set_completo: numero oggetti")
    check(all(abs(p.volume) > 0 for p in parts), "set_completo.3mf: volume nullo")
    sv = step_volume(os.path.join(OUT, "set_completo.step"))
    if sv:
        tot = sum(r["vol_mm3"] for r in rows)
        check(abs(sv[0] - tot) / tot < 2e-3, "set_completo.step: volume totale")
    total_stl = abs(ms.volume)

    # tabella
    cols = ["die", "vol_mm3", "h_mm", "vertici_a_z0", "sovrapp_min", "watertight", "honest", "numeri", "baricentro_shift_mm", "shift_%_inraggio", "step"]
    print("\n" + " | ".join(f"{c:>20}" if i else f"{c:<16}" for i, c in enumerate(cols)))
    for r in rows:
        print(" | ".join(f"{str(r.get(c, '')):>20}" if i else f"{str(r.get(c, '')):<16}" for i, c in enumerate(cols)))
    print(f"\nset_completo: {len(parts)} oggetti, volume STL {total_stl:.1f} mm3")
    print("\nESITO:", "TUTTO OK" if not fails else f"{len(fails)} PROBLEMI")
    for f in fails:
        print("  -", f)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
