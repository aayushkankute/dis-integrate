import "./App.css";
import Waves from "./components/Waves";
import TextPressure from "./components/textpre";
import { useRef, useState } from "react";
import AudioWaveform from "./components/AudioWaveform.jsx";

import FlexCarousel from "./components/FlexCarousel";
import AboutMe from "./components/ab.jsx";

// Reads a colour token from App.css (:root). Needed because the cards are
// SVG data-URI images and the Waves canvas, neither of which can use var().
function cssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function createFrequencyWave(frequency) {
  const cardBg = cssVar("--card-bg");
  const waveColor = cssVar("--card-wave");

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
        fill="${cardBg}"
      />

      <polyline
        points="${points.join(" ")}"
        fill="none"
        stroke="${waveColor}"
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
  const [reconstructedAudio, setReconstructedAudio] = useState(null);

  // Bumped every time audio is stopped or a new request starts, so a slow
  // /reconstruct response can't begin playing after the user has hit Stop
  // (or started something else).
  const playRequestRef = useRef(0);

  const readyStatus = `${harmonicGroups.length} harmonic groups detected`;

  // Stops whatever is playing (preview OR reconstruction) and cancels any
  // request that is still loading.
  const stopAllAudio = () => {
    playRequestRef.current += 1;

    [previewAudio, reconstructedAudio].forEach((audio) => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    });

    setPreviewAudio(null);
    setReconstructedAudio(null);
    setStatus(readyStatus);
  };

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
        "https://dis-integrate-backend.onrender.com/analyze",
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

    stopAllAudio();
    const requestId = playRequestRef.current;

    const frequencies = group.harmonics
      .map((harmonic) => harmonic.frequency)
      .join(",");

    const formData = new FormData();

    formData.append("file", audioFile);
    formData.append("frequencies", frequencies);

    try {
      const response = await fetch(
        "https://dis-integrate-backend.onrender.com/reconstruct",
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

      // Stopped, or another sound was requested, while this was loading
      if (requestId !== playRequestRef.current) return;

      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);

      audio.onended = () =>
        setPreviewAudio((current) =>
          current === audio ? null : current
        );

      setPreviewAudio(audio);

      await audio.play();
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("PREVIEW ERROR:", error);
    }
  };

  // Back to the home screen: stops audio, cancels loading requests and
  // clears the uploaded file, detected harmonics and selection.
  const handleReset = () => {
    stopAllAudio();

    if (audioUrl) URL.revokeObjectURL(audioUrl);

    setAudioUrl(null);
    setAudioFile(null);
    setHarmonicGroups([]);
    setSelectedGroups([]);
    setStatus("");
  };

  const handleSelectAll = () => {
    setSelectedGroups(harmonicGroups.map((_, index) => index));
  };

  const handleStopPreview = () => {
    if (!previewAudio && !reconstructedAudio) return;

    stopAllAudio();
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

    // Stop any harmonic preview (or earlier reconstruction) first
    stopAllAudio();
    const requestId = playRequestRef.current;

    setStatus("Reconstructing...");

    try {
      const formData = new FormData();

      formData.append("file", audioFile);

      formData.append(
        "frequencies",
        frequencies.join(",")
      );

      const response = await fetch(
        "https://dis-integrate-backend.onrender.com/reconstruct",
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

      // Stopped, or another sound was requested, while this was loading
      if (requestId !== playRequestRef.current) return;

      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);

      audio.onended = () => {
        setReconstructedAudio((current) =>
          current === audio ? null : current
        );
        setStatus(readyStatus);
      };

      setReconstructedAudio(audio);

      await audio.play();

      setStatus(
        `Playing ${selectedGroups.length} selected harmonics`
      );
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("FINAL IFFT ERROR:", error);
      setStatus("Error reconstructing audio");
    }
  };

  return (
    <div className="app">

      {/* BACKGROUND */}

      <Waves
        lineColor={cssVar("--wave-line")}
        backgroundColor="var(--bg-primary)"
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
          textColor={cssVar("--text-primary")}
          strokeColor={cssVar("--accent")}
          minFontSize={30}
        />
      </div>

      {/* STATUS */}

      {status && (
        <div
          className="status-text"
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
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
            className="selected-harmonics"
            style={{
              position: "fixed",
              bottom: "110px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 300,
              textAlign: "center",
              width: "90vw",
            }}
          >
            <div
              className="selected-harmonics__label"
              style={{
                marginBottom: "8px",
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
                <span className="harmonic-chip harmonic-chip--empty">
                  None
                </span>
              ) : (
                selectedGroups.map((index) => (
                  <span
                    key={index}
                    className="harmonic-chip"
                    title={`${harmonicGroups[
                      index
                    ].fundamental.toFixed(2)} Hz`}
                    data-frequency={harmonicGroups[index].fundamental}
                  >
                    Harmonic {index + 1}
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
    gap: "12px",
    flexWrap: "wrap",
    justifyContent: "center",
    width: "max-content",
    maxWidth: "94vw",
  }}
>
  <button
    className="upload-button"
    onClick={handleReset}
  >
    Reset
  </button>

  <button
    className="upload-button"
    onClick={handleSelectAll}
    disabled={selectedGroups.length === harmonicGroups.length}
  >
    Select All
  </button>

  <button
    className="upload-button"
    onClick={handleStopPreview}
    disabled={!previewAudio && !reconstructedAudio}
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

    {/* ABOUT ME (scroll down to open; home screen only) */}

    <AboutMe enabled={harmonicGroups.length === 0} />
  </div>
);
}

export default App;