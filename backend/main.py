from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import librosa
import numpy as np
import io
import wave

from scipy.signal import find_peaks


app = FastAPI()


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "DIS/INTEGRATE backend is running"
    }


# ============================================================
# FFT ANALYSIS
# ============================================================

@app.post("/analyze")
async def analyze_audio(
    file: UploadFile = File(...)
):

    audio_bytes = await file.read()

    # --------------------------------------------------------
    # LOAD AUDIO
    # --------------------------------------------------------

    audio, sr = librosa.load(
        io.BytesIO(audio_bytes),
        sr=None,
        mono=True
    )

    # --------------------------------------------------------
    # FFT
    # --------------------------------------------------------

    fft = np.fft.fft(audio)

    magnitude = np.abs(fft)

    frequencies = np.fft.fftfreq(
        len(audio),
        1 / sr
    )

    # --------------------------------------------------------
    # ONLY POSITIVE FREQUENCIES
    # 180 Hz -> 15 kHz
    # --------------------------------------------------------

    mask = (
        (frequencies >= 180) &
        (frequencies <= 15000)
    )

    frequencies = frequencies[mask]
    magnitude = magnitude[mask]

    # --------------------------------------------------------
    # FIND SPECTRAL PEAKS
    # --------------------------------------------------------

    # Normalize magnitude for peak detection
    normalized_magnitude = (
        magnitude / np.max(magnitude)
        if np.max(magnitude) > 0
        else magnitude
    )

    # Find local peaks
    peak_indices, properties = find_peaks(
        normalized_magnitude,

        # Peak must be at least 2% of the
        # strongest frequency
        height=0.02,

        # Avoid detecting tiny peaks
        # that are extremely close together
        distance=5
    )

    # --------------------------------------------------------
    # CREATE PEAK LIST
    # --------------------------------------------------------

    peaks = []

    for index in peak_indices:

        peaks.append({
            "frequency": float(
                frequencies[index]
            ),

            "amplitude": float(
                magnitude[index]
            )
        })

    # --------------------------------------------------------
    # SORT BY AMPLITUDE
    # --------------------------------------------------------

    peaks.sort(
        key=lambda x: x["amplitude"],
        reverse=True
    )

    # Keep a reasonable number of peaks
    peaks = peaks[:50]

    # ========================================================
    # HARMONIC GROUPING
    # ========================================================

    harmonic_groups = []

    used_peaks = set()

    # --------------------------------------------------------
    # Try every strong peak as a possible fundamental
    # --------------------------------------------------------

    for i, fundamental_peak in enumerate(peaks):

        if i in used_peaks:
            continue

        fundamental = fundamental_peak["frequency"]

        harmonics = [
            fundamental_peak
        ]

        harmonic_indices = [i]

        # ----------------------------------------------------
        # Look for:
        #
        # 2f
        # 3f
        # 4f
        # 5f
        # ...
        # ----------------------------------------------------

        for harmonic_number in range(2, 10):

            expected_frequency = (
                fundamental * harmonic_number
            )

            # Stop if outside our frequency range
            if expected_frequency > 15000:
                break

            best_index = None
            best_difference = float("inf")

            for j, candidate in enumerate(peaks):

                if j == i:
                    continue

                candidate_frequency = (
                    candidate["frequency"]
                )

                difference = abs(
                    candidate_frequency
                    - expected_frequency
                )

                # ------------------------------------------------
                # Tolerance:
                # allow up to 2% frequency difference
                # ------------------------------------------------

                tolerance = (
                    expected_frequency * 0.02
                )

                if (
                    difference <= tolerance
                    and difference < best_difference
                ):

                    best_difference = difference
                    best_index = j

            if best_index is not None:

                harmonics.append(
                    peaks[best_index]
                )

                harmonic_indices.append(
                    best_index
                )

        # ----------------------------------------------------
        # Only call it a harmonic group if it contains
        # at least 2 related peaks
        # ----------------------------------------------------

        if len(harmonics) >= 2:

            harmonic_groups.append({

                "fundamental": float(
                    fundamental
                ),

                "harmonics": harmonics
            })

            for index in harmonic_indices:
                used_peaks.add(index)

    # ========================================================
    # RETURN
    # ========================================================

    return {

        "sample_rate": sr,

        # Raw detected spectral peaks
        "peaks": peaks,

        # Harmonic groups
        "groups": harmonic_groups
    }


# ============================================================
# IFFT RECONSTRUCTION
# ============================================================

@app.post("/reconstruct")
async def reconstruct_audio(
    file: UploadFile = File(...),
    frequencies: str = Form(...)
):

    # --------------------------------------------------------
    # PARSE SELECTED FREQUENCIES
    # --------------------------------------------------------

    selected_frequencies = [
        float(freq)
        for freq in frequencies.split(",")
        if freq.strip()
    ]

    print(
        "Selected frequencies:",
        selected_frequencies
    )

    # --------------------------------------------------------
    # LOAD ORIGINAL AUDIO
    # --------------------------------------------------------

    audio_bytes = await file.read()

    audio, sr = librosa.load(
        io.BytesIO(audio_bytes),
        sr=None,
        mono=True
    )

    # --------------------------------------------------------
    # ORIGINAL FFT
    # --------------------------------------------------------

    fft = np.fft.fft(audio)

    fft_frequencies = np.fft.fftfreq(
        len(audio),
        1 / sr
    )

    # --------------------------------------------------------
    # EMPTY FFT
    # --------------------------------------------------------

    filtered_fft = np.zeros_like(fft)

    # --------------------------------------------------------
    # FIND ORIGINAL FFT BINS
    # --------------------------------------------------------

    positive_indices = np.where(
        fft_frequencies >= 0
    )[0]

    for selected_frequency in selected_frequencies:

        # Find closest FFT bin
        closest_index = positive_indices[
            np.argmin(
                np.abs(
                    fft_frequencies[
                        positive_indices
                    ]
                    - selected_frequency
                )
            )
        ]

        # Matching negative-frequency bin
        negative_index = (
            -closest_index
        ) % len(fft)

        # Copy ORIGINAL FFT values
        filtered_fft[
            closest_index
        ] = fft[
            closest_index
        ]

        filtered_fft[
            negative_index
        ] = fft[
            negative_index
        ]

    # --------------------------------------------------------
    # IFFT
    # --------------------------------------------------------

    reconstructed = np.fft.ifft(
        filtered_fft
    ).real

    # --------------------------------------------------------
    # NORMALIZE
    # --------------------------------------------------------

    max_value = np.max(
        np.abs(reconstructed)
    )

    if max_value > 0:

        reconstructed = (
            reconstructed / max_value
        )

    # --------------------------------------------------------
    # PCM16
    # --------------------------------------------------------

    pcm_audio = (
        reconstructed * 32767
    ).astype(np.int16)

    # --------------------------------------------------------
    # CREATE WAV
    # --------------------------------------------------------

    output = io.BytesIO()

    with wave.open(
        output,
        "wb"
    ) as wav:

        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sr)

        wav.writeframes(
            pcm_audio.tobytes()
        )

    output.seek(0)

    # --------------------------------------------------------
    # RETURN
    # --------------------------------------------------------

    return StreamingResponse(
        output,
        media_type="audio/wav",

        headers={
            "Content-Disposition":
            "inline; filename=reconstructed.wav"
        }
    )