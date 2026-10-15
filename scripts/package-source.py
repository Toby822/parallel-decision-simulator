"""Build a portable source bundle, without Site IDs or repository metadata."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT=Path(__file__).resolve().parent.parent
TARGET=ROOT/'dist'/'Parallel-Prototype.zip'
skip={'.git','.openai','node_modules','__pycache__','.venv'}
with ZipFile(TARGET,'w',ZIP_DEFLATED) as archive:
    for path in sorted(ROOT.rglob('*')):
        relative=path.relative_to(ROOT)
        if not path.is_file() or path==TARGET or any(p in skip for p in relative.parts) or path.suffix in {'.pyc','.gz','.zip'}:
            continue
        archive.write(path,Path('Parallel-Prototype')/relative)
print(TARGET)
