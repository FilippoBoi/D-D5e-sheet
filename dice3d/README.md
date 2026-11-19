# Set di dadi "honest" per stampa in resina (appoggio a vertice)

Dadi: **d4, d6, d8, d10, d% (d00), d12, d20**. Unità: mm.

## Perché sono honest
Ogni dado è un solido **isoedrico** (tutte le facce equivalenti per simmetria):
tetraedro, cubo, ottaedro, dodecaedro, icosaedro e **trapezoedro pentagonale** (d10/d%,
aquiloni piani per costruzione: `apice = a·(1+cos36°)/(1−cos36°)`).
Le facce opposte sommano a costante (d6=7, d8=9, d10=9, d%=90, d12=13, d20=21).
La disposizione dei numeri è ottimizzata (vicini molto diversi, somme ai vertici omogenee,
incisioni che non spostano il baricentro): scarto baricentro ≤ 0,02 mm.

## Orientamento di stampa
Ogni dado ha **un solo vertice a z = 0** (punto più basso, verso il piatto), nessuna base o spigolo
piano. Superfici rivolte in basso inclinate ≥ 37° (d20/d12), 52° (d10), 55° (d6/d8), 70° (d4).
In slicer: alza il modello di 4–6 mm e metti il supporto più robusto sul vertice.

## File (`output/`)
- `singoli/dN.{stl,obj,3mf,amf,step}` e `set_completo.*` (7 dadi su una piastra ~120×60 mm)
- `.step` = `.stp` (basta rinominare). STEP è un vero B-rep con facce piane.
- `blank/*.stl` dadi senza numeri; `numeri.json` assegnazione numeri; `anteprima.png`.

## Rigenerare
```bash
pip install numpy scipy shapely trimesh manifold3d fonttools mapbox_earcut matplotlib cadquery-ocp
python3 generate_dice.py --out output --preview     # --blank, --depth 0.4, --dice d20,d12
python3 verify_dice.py output                       # exit 1 se qualcosa non torna
```
Dimensioni e altezza numeri sono in `SPECS` (in cima a `generate_dice.py`).

## Con che programma verificarli
1. **PrusaSlicer** (gratis): apre STL/OBJ/3MF/AMF/STEP, segnala mesh da riparare, mostra l'orientamento.
2. **Lychee Slicer** o **ChiTuBox** (resina): vista cross-section, isole, supporti, ventose.
3. **Blender + add-on 3D-Print Toolbox**: non-manifold, intersezioni, sovrapposizioni, spessori.
4. **MeshLab** (*Filters → Quality Measure → Compute Geometric Measures*): volume, baricentro, inerzia.
5. **FreeCAD** (*Part → Check geometry*) per il file STEP.
