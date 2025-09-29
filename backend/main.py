from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import paho.mqtt.client as mqtt

app = FastAPI()

# Allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MQTT_BROKER = "localhost"
MQTT_PORT = 1883
client = mqtt.Client()
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

@app.get("/")
def read_root():
    return {"message": "Hello Master, fetch your orders"}

@app.post("/send/{message}")
def send_message(message: str):
    client.publish("megatronai/test", message)
    return {"sent": message}

@app.post("/device/{category}/{device}/{command}")
def control_device(category: str, device: str, command: str):
    """
    Send a command (ON/OFF/anything) to a device via MQTT.
    Topic: megatronai/{category}/{device}/set
    """
    topic = f"megatronai/{category}/{device}/set"
    client.publish(topic, command)
    return {"sent": command, "to": topic}
