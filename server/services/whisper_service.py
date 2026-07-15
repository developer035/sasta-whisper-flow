from faster_whisper import WhisperModel


class WhisperService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)

            cls._instance.model = WhisperModel(
                "small.en",
                device="cuda",
                compute_type="float16",
            )

        return cls._instance

    def transcribe(self, audio_path):

        custom_prompt = "This audio can be in Hindi and English both, so transcribe accordingly."

        segments, info = self.model.transcribe(
            audio_path,
            beam_size=5,
            language="hi",
            initial_prompt = custom_prompt,
        )

        text = " ".join(segment.text.strip() for segment in segments)

        return {
            "text": text,
            "language": info.language,
            "confidence": info.language_probability,
        }