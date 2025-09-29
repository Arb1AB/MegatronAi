import os
import io
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import paho.mqtt.client as mqtt
from gtts import gTTS
import whisper
import uuid

# ------------------ MQTT SETUP ------------------ #
MQTT_BROKER = "localhost"
MQTT_PORT = 1883

client = mqtt.Client()
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

# ------------------ FASTAPI APP ------------------ #
app = FastAPI()

# CORS so frontend can call
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------- Data models ----------------------- #
class DeviceCommand(BaseModel):
    category: str
    device: str
    command: str

class TextCommand(BaseModel):
    command: str

# ----------------- Simple AI Intent Parser ----------------- #
def parse_intent(text: str):
    """Very simple local rule-based parser for commands."""
    t = text.lower()
    if t.startswith("turn on"):
        # turn on light / turn on DHT11
        parts = t.replace("turn on", "").strip()
        return {"action": "turn_on", "target": parts}
    if t.startswith("turn off"):
        parts = t.replace("turn off", "").strip()
        return {"action": "turn_off", "target": parts}
    if t.startswith("add"):
        # add sensor name
        parts = t.replace("add", "").strip()
        return {"action": "add_sensor", "target": parts}
    return {"action": "unknown", "target": t}

# ------------------- Endpoints ------------------- #
@app.get("/")
async def root():
    return {"message": "MegatronAI Backend running"}

@app.post("/device/{category}/{device}/{command}")
async def control_device(category: str, device: str, command: str):
    topic = f"megatronai/{category}/{device}"
    client.publish(topic, command)
    return {"status": "sent", "topic": topic, "command": command}

@app.post("/ask_ai")
async def ask_ai(cmd: TextCommand):
    intent = parse_intent(cmd.command)
    response = handle_intent(intent)
    return {"reply": response}

@app.post("/voice")
async def voice(file: UploadFile = File(...)):
    # Save temp audio
    audio_bytes = await file.read()
    temp_path = f"temp_{uuid.uuid4()}.wav"
    with open(temp_path, "wb") as f:
        f.write(audio_bytes)

    # Transcribe
    model = whisper.load_model("base")
    result = model.transcribe(temp_path)
    os.remove(temp_path)
    text = result["text"]

    intent = parse_intent(text)
    reply = handle_intent(intent)

    # TTS reply
    tts = gTTS(reply)
    out_path = f"reply_{uuid.uuid4()}.mp3"
    tts.save(out_path)

    # return mp3 file
    return {
        "text": text,
        "reply": reply,
        "audio": out_path
    }

# ------------------ Helper ------------------------ #
def handle_intent(intent):
    action = intent.get("action")
    target = intent.get("target", "")
    if action == "turn_on":
        client.publish(f"megatronai/general/{target}", "ON")
        return f"Turning on {target}"
    if action == "turn_off":
        client.publish(f"megatronai/general/{target}", "OFF")
        return f"Turning off {target}"
    if action == "add_sensor":
        # just acknowledge - real add is on frontend
        return f"Adding sensor {target}"
    return f"I didn't understand the command: {target}"
