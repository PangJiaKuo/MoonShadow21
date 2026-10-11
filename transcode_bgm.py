import subprocess, json, sys

args = [
    'mediakit-cli', 'audio', 'transcode-audio',
    '--audio-url', r'D:\AI_work_test\MoonShadow21\client\public\audio\bgm.wav',
    '--audio', json.dumps({'bitrate_kbps': 128, 'bitrate_mode': 'cbr', 'sample_rate': 44100}),
    '--container-format', 'MP3',
]
r = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace')
print(r.stdout)
if r.stderr:
    print('STDERR:', r.stderr[:2000])
sys.exit(r.returncode)
