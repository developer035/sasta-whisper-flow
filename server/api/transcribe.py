from fastapi import APIRouter, UploadFile, File
import shutil
import tempfile
import os

from services.dependencies import whisper_service

router = APIRouter()

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):

    suffix = os.path.splitext(file.filename)[1]

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        shutil.copyfileobj(file.file, temp)
        temp_path = temp.name

    try:
        result = whisper_service.transcribe(temp_path)
        return result

    finally:
        os.remove(temp_path)

@router.get("/")
def root():
    return {"message": "Hello this is the server for our Sasta Whisper Flow"}

@router.get("/health")
def health():
    return {"status" : "ok"}