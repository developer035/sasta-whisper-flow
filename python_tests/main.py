import time
import torch
from faster_whisper import WhisperModel

device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "int8" if device == "cuda" else "int8"

print(f"Using device: {device}")
print("Loading model...")

start = time.time()

model = WhisperModel(
    "small.en",
    device="cuda",
    compute_type="int8_float16",
)

print(f"Model loaded in {time.time() - start:.2f} seconds.")