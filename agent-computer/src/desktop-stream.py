"""Miles guest desktop, streamed through Kritovas' authenticated control protocol."""
import base64
import io
import json
import os
import signal
import subprocess
import sys
import threading
import time
from PIL import ImageGrab

running = True
held = set()
buttons = set()
keys = {"Control": "Control_L", "Shift": "Shift_L", "Alt": "Alt_L", "Meta": "Super_L",
        "Enter": "Return", "Backspace": "BackSpace", "Escape": "Escape", " ": "space",
        "ArrowLeft": "Left", "ArrowRight": "Right", "ArrowUp": "Up", "ArrowDown": "Down",
        "PageUp": "Prior", "PageDown": "Next"}

def xd(*args):
    subprocess.run(["xdotool", *map(str, args)], check=True, timeout=3, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def stop(*_):
    global running
    running = False

def inputs():
    try:
        for line in sys.stdin:
            if not running: break
            m = json.loads(line)
            kind = m["type"]
            if kind == "mouse":
                xd("mousemove", max(0, int(m["x"])), max(0, int(m["y"])))
                button = {"left": 1, "middle": 2, "right": 3}.get(m.get("button"), 1)
                if m["event"] == "pressed": xd("mousedown", button); buttons.add(button)
                elif m["event"] == "released": xd("mouseup", button); buttons.discard(button)
            elif kind == "wheel":
                delta = m.get("deltaY", 0) or m.get("deltaX", 0)
                if delta: xd("click", "--repeat", min(12, max(1, int(abs(delta)/80))), 5 if delta > 0 else 4)
            elif kind == "key":
                key = keys.get(m["key"], m["key"])
                if m["event"] == "down": xd("keydown", key); held.add(key)
                else: xd("keyup", key); held.discard(key)
            elif kind == "text":
                xd("type", "--clearmodifiers", "--delay", 0, "--", m["text"][:16000])
    finally: stop()

signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
threading.Thread(target=inputs, daemon=True).start()
try:
    while running:
        started = time.monotonic()
        frame = ImageGrab.grab(xdisplay=os.environ.get("DISPLAY", ":1"))
        out = io.BytesIO()
        frame.convert("RGB").save(out, format="JPEG", quality=72)
        print(json.dumps({"type": "frame", "data": base64.b64encode(out.getvalue()).decode(),
                          "width": frame.width, "height": frame.height}), flush=True)
        time.sleep(max(0, 0.15 - (time.monotonic() - started)))
finally:
    for key in tuple(held):
        try: xd("keyup", key)
        except Exception: pass
    for button in tuple(buttons):
        try: xd("mouseup", button)
        except Exception: pass
