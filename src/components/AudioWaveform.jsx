import WavesurferPlayer from "@wavesurfer/react";
import "./AudioWaveform.css";

// Colours come from the tokens in App.css (:root)
const cssVar = (name) =>
  getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

function AudioWaveform({ audioUrl }) {
  return (
    <div className="audio-waveform">
      <WavesurferPlayer
        height={100}
        waveColor={cssVar("--audio-wave")}
        progressColor={cssVar("--audio-progress")}
        cursorColor={cssVar("--audio-wave")}
        url={audioUrl}
      />
    </div>
  );
}

export default AudioWaveform;