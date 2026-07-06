from faster_whisper import WhisperModel
import time

# model = WhisperModel(
#     "small.en",
#     device="cuda",
#     compute_type="float16"
# )
model = WhisperModel(
    "small.en",
    device="cpu",
    compute_type="int8"
)

start = time.time()

segments, info = model.transcribe(
    "day 15 audio 5th july 2026.wav",
    beam_size=5,
    language="en"
)

print(f"Language: {info.language}")
print(f"Confidence: {info.language_probability:.2f}")

print("\nTranscription:")
for segment in segments:
    print(segment.text)

print(f"\nTime: {time.time()-start:.2f}s")