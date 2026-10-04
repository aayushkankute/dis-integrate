import "./App.css";
import Waves from "./components/Waves";
import TextPressure from "./components/textpre";
import { useState } from "react";
import AudioWaveform from "./components/AudioWaveform.jsx";

import FlexCarousel from "./components/FlexCarousel";

function createFrequencyWave(frequency) {
  const width = 800;
  const height = 400;

  const cycles = Math.max(1, Math.min(12, frequency / 80));
  const points = [];

  for (let x = 0; x <= width; x += 4) {
    const y =
      height / 2 +
      Math.sin((x / width) * cycles * Math.PI * 2) * 100;

    points.push(`${x},${y}`);
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}"
         height="${height}"
         viewBox="0 0 ${width} ${height}">

      <rect
        width="100%"
        height="100%"
        fill="#8b6b75"
      />

      <polyline
        points="${points.join(" ")}"
        fill="none"
        stroke="#f9f9f9ff"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function App() {
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [harmonicGroups, setHarmonicGroups] = useState([]);
  const [status, setStatus] = useState("");
  const [previewAudio, setPreviewAudio] = useState(null);

  const harmonicItems = harmonicGroups.map((group) => ({
  src: createFrequencyWave(group.fundamental),
  alt: "Harmonic group",
  title: "Harmonic Group",
}));

  const handleAudioUpload = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setAudioFile(file);
    setSelectedGroups([]);

    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    setHarmonicGroups([]);
    setStatus("Analyzing audio...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/analyze",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();

      console.log("HARMONIC GROUPS:", data.groups);

      setHarmonicGroups(data.groups);

      setStatus(
        `${data.groups.length} harmonic groups detected`
      );
    } catch (error) {
      console.error("BACKEND ERROR:", error);
      setStatus("Error analyzing audio");
    }
  };

  const handleGroupSelect = async (index) => {
    const group = harmonicGroups[index];

    if (!group) return;

    const isSelected = selectedGroups.includes(index);

    setSelectedGroups((previous) =>
      isSelected
        ? previous.filter((i) => i !== index)
        : [...previous, index]
    );

    console.log(
      isSelected ? "DESELECTED:" : "SELECTED:",
      group.fundamental,
      group.harmonics
    );

    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }

    const frequencies = group.harmonics
      .map((harmonic) => harmonic.frequency)
      .join(",");

    const formData = new FormData();

    formData.append("file", audioFile);
    formData.append("frequencies", frequencies);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/reconstruct",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Preview failed: ${response.status}`
        );
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);

      setPreviewAudio(audio);

      await audio.play();

      setStatus(
        `${group.fundamental.toFixed(2)} Hz harmonic`
      );
    } catch (error) {
      console.error("PREVIEW ERROR:", error);
    }
  };

  const handleStopPreview = () => {
    if (!previewAudio) return;

    previewAudio.pause();
    previewAudio.currentTime = 0;

    setPreviewAudio(null);
  };

  const handleReconstruct = async () => {
    if (!audioFile || selectedGroups.length === 0) {
      return;
    }

    const frequencies = selectedGroups
      .flatMap(
        (index) =>
          harmonicGroups[index].harmonics
      )
      .map((harmonic) => harmonic.frequency);

    console.log(
      "FINAL SELECTED FREQUENCIES:",
      frequencies
    );

    setStatus("Reconstructing...");

    try {
      const formData = new FormData();

      formData.append("file", audioFile);

      formData.append(
        "frequencies",
        frequencies.join(",")
      );

      const response = await fetch(
        "http://127.0.0.1:8000/reconstruct",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Reconstruction failed: ${response.status}`
        );
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);

      await audio.play();

      setStatus(
        `Playing ${selectedGroups.length} selected harmonics`
      );
    } catch (error) {
      console.error("FINAL IFFT ERROR:", error);
      setStatus("Error reconstructing audio");
    }
  };

  return (
    <div className="app">

      {/* BACKGROUND */}

      <Waves
        lineColor="#e17e7cff"
        backgroundColor="#0b162fff"
        waveSpeedX={0.0125}
        waveSpeedY={0.01}
        waveAmpX={40}
        waveAmpY={20}
        friction={0.9}
        tension={0.01}
        maxCursorMove={120}
        xGap={12}
        yGap={36}
      />

      {/* TITLE */}

      <div
        className="text-layer"
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <TextPressure
          text="dis/integrate"
          flex
          alpha={false}
          stroke={false}
          width={10}
          weight={1}
          italic={true}
          textColor="#fef1b2"
          strokeColor="#5227FF"
          minFontSize={30}
        />
      </div>

      {/* STATUS */}

      {status && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            color: "#fef1b2",
            fontSize: "16px",
            fontFamily: "sans-serif",
          }}
        >
          {status}
        </div>
      )}

      {/* UPLOAD */}

      {harmonicGroups.length === 0 && (
        <div className="upload-area">
          <label
            htmlFor="audio-upload"
            className="upload-button"
          >
            Upload Audio
          </label>

          <input
            id="audio-upload"
            type="file"
            accept="audio/*"
            hidden
            onChange={handleAudioUpload}
          />
        </div>
      )}

      {/* ORIGINAL AUDIO */}

      {audioUrl && harmonicGroups.length === 0 && (
        <AudioWaveform audioUrl={audioUrl} />
      )}

      {/* HARMONIC CARDS */}

      {harmonicGroups.length > 0 && (
        <>
          <div className="frequency-carousel">

            <FlexCarousel
              items={harmonicItems}
              preset="vortex"
              intro="deal"
              cardHeight={0.3}
              gap={12}
              squeeze={0.2}
              focusOnClick
              captions
              fit="natural"
              radius={20}
              lensWidth={0.74}
              lensHeight={1.18}
              tilt={62}
              roundness={1}
              bend={0.34}
              reach={0.38}
              curl="twist"
              dispersion={0.1}
              liquid={0}
              followCursor={false}
              autoplay={false}
              captureWheel
              onSelect={handleGroupSelect}
            />

          </div>

          {/* SELECTED HARMONICS */}

          <div
            style={{
              position: "fixed",
              bottom: "110px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 300,
              color: "#fef1b2",
              textAlign: "center",
              fontFamily: "sans-serif",
              width: "90vw",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                marginBottom: "8px",
                opacity: 0.7,
              }}
            >
              Selected harmonics
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {selectedGroups.length === 0 ? (
                <span style={{ opacity: 0.5 }}>
                  None
                </span>
              ) : (
                selectedGroups.map((index) => (
                  <span
                    key={index}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "20px",
                      background: "#8b6b75",
                      border: "1px solid #fef1b2",
                      fontSize: "14px",
                    }}
                  >
                    ✓{" "}
                    {harmonicGroups[
                      index
                    ].fundamental.toFixed(2)}{" "}
                    Hz
                  </span>
                ))
              )}
            </div>
          </div>

          {/* RECONSTRUCT + STOP */}

<div
  className="upload-area"
  style={{
    position: "fixed",
    bottom: "40px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 300,
    display: "flex",
    gap: "20px",
  }}
>
  <button
    className="upload-button"
    onClick={handleStopPreview}
    disabled={!previewAudio}
  >
    Stop Preview
  </button>

  <button
    className="upload-button"
    onClick={handleReconstruct}
    disabled={selectedGroups.length === 0}
  >
    Reconstruct
  </button>
        </div>
      </>
    )}
  </div>
);
}

export default App;