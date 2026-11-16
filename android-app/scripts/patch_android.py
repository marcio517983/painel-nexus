#!/usr/bin/env python3
"""Harden the Capacitor Android pilot and apply NexusMaster launcher assets."""
from pathlib import Path
import shutil
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
manifest = root / "android/app/src/main/AndroidManifest.xml"
ET.register_namespace("android", "http://schemas.android.com/apk/res/android")
namespace = "{http://schemas.android.com/apk/res/android}"
tree = ET.parse(manifest)
node = tree.getroot()
permissions = {p.get(namespace+"name") for p in node.findall("uses-permission")}
for name in ("android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS", "android.permission.POST_NOTIFICATIONS", "android.permission.USE_FULL_SCREEN_INTENT", "android.permission.VIBRATE"):
    if name not in permissions:
        el = ET.Element("uses-permission")
        el.set(namespace+"name", name)
        node.insert(0,el)
app = node.find("application")
if app is None:
    raise SystemExit("Invalid Android manifest: missing <application>")
app.set(namespace+"allowBackup", "false")
app.set(namespace+"usesCleartextTraffic", "false")
# A call surface belongs to this app only; browsers and external apps cannot launch it.
activity=ET.Element("activity")
activity.set(namespace+"name",".IncomingCallActivity")
activity.set(namespace+"exported","false")
activity.set(namespace+"excludeFromRecents","true")
activity.set(namespace+"showWhenLocked","true")
activity.set(namespace+"turnScreenOn","true")
app.append(activity)
# Background FCM data messages are handled natively, with no Android WebView running.
service=ET.Element("service")
service.set(namespace+"name",".NexusFirebaseMessagingService")
service.set(namespace+"exported","false")
filter_=ET.SubElement(service,"intent-filter")
action=ET.SubElement(filter_,"action")
action.set(namespace+"name","com.google.firebase.MESSAGING_EVENT")
app.append(service)
tree.write(manifest, encoding="utf-8", xml_declaration=True)

javaDir=root / "android/app/src/main/java/com/nexusmaster/interfone/piloto"
javaDir.mkdir(parents=True,exist_ok=True)
for java in (root / "native").glob("*.java"):
    shutil.copy2(java,javaDir / java.name)
drawDir=root / "android/app/src/main/res/drawable"
drawDir.mkdir(parents=True,exist_ok=True)
shutil.copy2(root / "native/ic_call_notification.xml",drawDir / "ic_call_notification.xml")

gradle=root / "android/app/build.gradle"
data=gradle.read_text()
if "androidx.core:core:1.15.0" not in data:
    data=data.replace("dependencies {","dependencies {\n    implementation 'androidx.core:core:1.15.0'",1)
if "com.google.firebase:firebase-bom" not in data:
    data=data.replace("dependencies {","dependencies {\n    implementation platform('com.google.firebase:firebase-bom:35.2.0')\n    implementation 'com.google.firebase:firebase-messaging'",1)
if "com.google.gms.google-services" not in data:
    data+="\napply plugin: 'com.google.gms.google-services'\n"
gradle.write_text(data)

# Firebase Messaging 26.x requires at least Android API 24.
variablesGradle=root / "android/variables.gradle"
variables=variablesGradle.read_text()
if "minSdkVersion = 23" in variables:
    variablesGradle.write_text(variables.replace("minSdkVersion = 23","minSdkVersion = 24"))
elif "minSdkVersion = 24" not in variables:
    raise SystemExit("Unsupported Android minimum SDK setting for Firebase Messaging.")

projectGradle=root / "android/build.gradle"
data=projectGradle.read_text()
if "com.google.gms:google-services" not in data:
    data=data.replace("dependencies {","dependencies {\n        classpath 'com.google.gms:google-services:4.6.0'",1)
projectGradle.write_text(data)

# google-services.json contains Android client identifiers, NOT server credentials.
config=root / "firebase/google-services.json"
import json
appInfo=json.loads(config.read_text())
registered=[client.get("client_info",{}).get("android_client_info",{}).get("package_name")
            for client in appInfo.get("client",[])]
if appInfo.get("project_info",{}).get("project_id") != "controws" or "com.nexusmaster.interfone.piloto" not in registered:
    raise SystemExit("Firebase configuration does not match the NexusMaster pilot Android app.")
shutil.copy2(config,root / "android/app/google-services.json")

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
