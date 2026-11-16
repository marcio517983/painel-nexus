#!/usr/bin/env python3
"""Harden the Capacitor Android pilot and apply NexusMaster launcher assets."""
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
manifest = root / "android/app/src/main/AndroidManifest.xml"
ET.register_namespace("android", "http://schemas.android.com/apk/res/android")
namespace = "{http://schemas.android.com/apk/res/android}"
tree = ET.parse(manifest)
node = tree.getroot()
permissions = {p.get(namespace+"name") for p in node.findall("uses-permission")}
for name in ("android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS"):
    if name not in permissions:
        el = ET.Element("uses-permission")
        el.set(namespace+"name", name)
        node.insert(0,el)
app = node.find("application")
if app is None:
    raise SystemExit("Invalid Android manifest: missing <application>")
app.set(namespace+"allowBackup", "false")
app.set(namespace+"usesCleartextTraffic", "false")
tree.write(manifest, encoding="utf-8", xml_declaration=True)

from PIL import Image
src = root.parent / "public/icons/nexusmaster-512.png"
if not src.exists():
    raise SystemExit(f"NexusMaster icon not found: {src}")
image = Image.open(src).convert("RGBA")
sizes = {"mdpi":48, "hdpi":72, "xhdpi":96, "xxhdpi":144, "xxxhdpi":192}
resources = root / "android/app/src/main/res"
for density, size in sizes.items():
    dest = resources / ("mipmap-"+density)
    dest.mkdir(parents=True, exist_ok=True)
    for icon in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
        dimension = size * 2 if icon == "ic_launcher_foreground.png" else size
        image.resize((dimension, dimension), Image.Resampling.LANCZOS).save(dest / icon)
print("NexusMaster pilot: Android permissions, cleartext policy and launcher icons configured.")
