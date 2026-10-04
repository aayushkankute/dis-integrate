
# dis/integrate

an audio experiment where you can break a sound down into its frequencies and then put it back together again.

basically:

audio → fft → frequencies → select what you want → reconstruct

## What it does

upload an audio file and dis/integrate analyzes it using an FFT.

it finds the strongest frequencies in the audio and groups related frequencies into harmonics.

you can then:

- upload an audio file
- see the frequencies detected from it
- select harmonic groups
- preview selected groups
- reconstruct the audio using only the frequencies you selected

the idea is basically being able to take a sound apart and see what actually makes it up.

## Stack

### Frontend
- React
- Vite
- CSS
- React Bits

### Backend
- Python
- FastAPI
- NumPy
- Librosa
- SciPy

## How it works

the audio gets sent to the FastAPI backend.

the backend:

1. loads the audio
2. runs an FFT
3. finds the strongest frequency peaks
4. checks for related harmonics
5. sends the frequency data back to the frontend

when you select something, the selected frequencies are sent back to the backend and the audio gets reconstructed from them.

## running it locally

clone the repo:

```bash
git clone https://github.com/aayushkankute/dis-integrate.git
cd dis-integrate
install frontend dependencies:

npm install

start the frontend:

npm run dev

for the backend:

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

then open the local Vite URL.

Why i made this
i've been messing around with audio, FFTs and frequency analysis for a while and wanted to actually make something interactive with it instead of just looking at plots in python.

so yeah this is basically me turning that into a little web app.

status
it works lol

still gonna keep adding stuff to it.
```


