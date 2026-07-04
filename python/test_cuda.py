import sys
from faster_whisper import WhisperModel

try:
    print("Attempting to initialize faster-whisper on CUDA GPU...")
    
    # Force device="cuda". 
    # Use compute_type="float16" for GPUs, or "int8_float16" to save VRAM.
    model = WhisperModel(
        "turbo", 
        device="cuda", 
        compute_type="float16"
    )
    
    print("✅ Success! faster-whisper is running locally on CUDA GPU.")

except Exception as e:
    print("\n❌ CRITICAL ERROR: Could not run faster-whisper on CUDA.", file=sys.stderr)
    print("---------------------------------------------------------", file=sys.stderr)
    print(f"Error Message: {e}", file=sys.stderr)
    print("---------------------------------------------------------", file=sys.stderr)
    print("\n💡 Common Troubleshooting Steps:", file=sys.stderr)
    print("1. Run 'nvidia-smi' in your terminal to check if your GPU is recognized.", file=sys.stderr)
    print("2. Ensure you installed PyTorch with CUDA support, not the CPU-only version.", file=sys.stderr)
    print("3. CTranslate2 (faster-whisper's engine) requires specific NVIDIA libraries.", file=sys.stderr)
    print("   For Windows: You often need 'cublas64_11.dll' or 'cudnn64_8.dll' in your System32 or PATH.", file=sys.stderr)
