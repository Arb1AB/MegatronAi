import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import "./App.css";
import megatronLogo from "./assets/megatron.png";

const CATEGORIES = {
  Environment: {
    "Temperature & Humidity": ["DHT11", "DHT22", "BME280"],
    "Air Quality": ["MQ135", "PMS5003", "SDS011"],
    "Barometric Pressure": ["BMP180", "BMP280", "BME680"],
    "Light Sensor": ["BH1750", "TSL2561", "LDR"]
  },
  "Motion & Presence": {
    "Motion": ["PIR Sensor", "RCWL-0516"],
    "Presence": ["Ultrasonic HC-SR04", "Radar Sensor"]
  },
  "Contact & Position": {
    "Contact": ["Reed Switch", "Door Sensor"],
    "Position": ["Accelerometer MPU6050", "Gyroscope MPU9250"],
    "Vibration": ["SW-420", "Piezo Sensor"]
  },
  "Water & Safety": {
    "Water Leak": ["Water Sensor", "YL-69"],
    "Gas & Smoke": ["MQ2", "MQ9", "MQ7"]
  },
  "Energy & Power": {
    "Power": ["Smart Plug", "Current Sensor"]
  },
  "Sound & Misc": {
    "Sound": ["Microphone"],
    "RFID/NFC": ["RC522"],
    "Button/Switch": ["Push Button", "Toggle Switch"]
  }
};

export default function App() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState({});
  const [expandedGroup, setExpandedGroup] = useState({});
  const [selectedSensors, setSelectedSensors] = useState([]);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioChunks = useRef([]);
  const [aiReply, setAiReply] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("selectedSensors");
    if (saved) setSelectedSensors(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedSensors", JSON.stringify(selectedSensors));
  }, [selectedSensors]);

  const toggleCategory = (cat) =>
    setExpandedCat((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const toggleGroup = (group) =>
    setExpandedGroup((prev) => ({ ...prev, [group]: !prev[group] }));

  const addSensor = (category, group, sensor) => {
    if (!selectedSensors.find((s) => s.sensor === sensor && s.group === group)) {
      setSelectedSensors([...selectedSensors, { category, group, sensor, state: null }]);
    }
  };

  const removeSensor = (sensor) => {
    setSelectedSensors((prev) => prev.filter((s) => s.sensor !== sensor));
  };

  const setDeviceState = (sensor, newState) => {
    setSelectedSensors((prev) =>
      prev.map((s) => (s.sensor === sensor ? { ...s, state: newState } : s))
    );
  };

  const sendCommand = async (category, device, command) => {
    try {
      await fetch(
        `http://127.0.0.1:8000/device/${encodeURIComponent(category)}/${encodeURIComponent(
          device
        )}/${encodeURIComponent(command)}`,
        { method: "POST" }
      );
      setDeviceState(device, command);
    } catch (err) {
      console.error("Error sending command:", err);
    }
  };

  // ---- Voice recording ----
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      recorder.onstop = handleStopRecording;
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  const handleStopRecording = async () => {
    const blob = new Blob(audioChunks.current, { type: "audio/webm" });
    const formData = new FormData();
    formData.append("file", blob, "voice.webm");

    try {
      const res = await fetch("http://127.0.0.1:8000/voice", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      setAiReply(`${data.text} → ${data.reply}`);

      if (data.audio) {
        const audio = new Audio(`http://127.0.0.1:8000/${data.audio}`);
        audio.play();
      }
    } catch (err) {
      console.error("Voice send error:", err);
    }
  };

  return (
    <div className="bg">
      {/* --- Top Bar --- */}
      <div className="top-bar">
        <h1 className="title">MegatronAi</h1>
        <button className="menu-dots" onClick={() => setPanelOpen(true)}>
          •••
        </button>
      </div>

      {/* --- Orders Section --- */}
      <div className="orders-bar">
        <p className="subtitle">Hello Master, fetch your orders</p>
        <button
          className={`logo-btn ${recording ? "recording" : ""}`}
          onClick={recording ? stopRecording : startRecording}
          title="Press to talk"
        >
          <img src={megatronLogo} alt="Megatron" className="megatron-logo" />
        </button>
      </div>

      {/* --- AI Response --- */}
      {aiReply && (
        <div style={{ margin: "10px", textAlign: "center" }}>🤖 {aiReply}</div>
      )}

      <div className="status-grid">
        {selectedSensors.length === 0 && (
          <div className="empty">No sensors added yet</div>
        )}
        {selectedSensors.map((s, i) => (
          <motion.div
            key={i}
            className="card"
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <h3>{s.sensor}</h3>
            <p>{s.category}</p>
            <div className="control-buttons">
              <motion.button
                className={`control-btn ${s.state === "ON" ? "on-active" : ""}`}
                whileTap={{ scale: 0.9 }}
                onClick={() => sendCommand(s.category, s.sensor, "ON")}
              >
                ON
              </motion.button>
              <motion.button
                className={`control-btn ${s.state === "OFF" ? "off-active" : ""}`}
                whileTap={{ scale: 0.9 }}
                onClick={() => sendCommand(s.category, s.sensor, "OFF")}
              >
                OFF
              </motion.button>
            </div>
            <button className="remove-btn" onClick={() => removeSensor(s.sensor)}>
              Remove
            </button>
          </motion.div>
        ))}
      </div>

      {panelOpen && (
        <motion.div
          className="panel"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="panel-header">
            <h2>Add Devices</h2>
            <button className="close-btn" onClick={() => setPanelOpen(false)}>
              ✖
            </button>
          </div>

          <div className="tree">
            {Object.keys(CATEGORIES).map((cat) => (
              <div key={cat}>
                <div
                  className="tree-section"
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </div>
                {expandedCat[cat] && (
                  <div>
                    {Object.keys(CATEGORIES[cat]).map((group) => (
                      <div key={group}>
                        <div
                          className="tree-group"
                          onClick={() => toggleGroup(group)}
                        >
                          {group}
                        </div>
                        {expandedGroup[group] && (
                          <div className="tree-sensors">
                            {CATEGORIES[cat][group].map((sensor) => (
                              <div className="sensor-row" key={sensor}>
                                <span>{sensor}</span>
                                <button
                                  onClick={() => addSensor(cat, group, sensor)}
                                >
                                  Add
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
