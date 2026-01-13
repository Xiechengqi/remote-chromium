#!/usr/bin/env bash

source /app/supervisor/start.d/common.sh
export PATH="$HOME/.local/bin:$PATH"

if [ "${IF_SHERPA_ONNX_ON}" = "true" ]
then

INFO "ls /root/.local/bin/uv" && ls /root/.local/bin/uv
INFO "uv -V" && ! uv -V && SLEEP_INFITY $0

EXEC "cd /app/sherpa-onnx/"
EXEC "uv venv"
EXEC "source .venv/bin/activate"
EXEC "uv pip install numpy websockets sherpa-onnx"
INFO "uv run python python-api-examples/streaming_server.py --encoder sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/encoder-epoch-99-avg-1.onnx --decoder sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/decoder-epoch-99-avg-1.onnx --joiner sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/joiner-epoch-99-avg-1.onnx --tokens sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/tokens.txt"
uv run python python-api-examples/streaming_server.py --encoder sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/encoder-epoch-99-avg-1.onnx --decoder sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/decoder-epoch-99-avg-1.onnx --joiner sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/joiner-epoch-99-avg-1.onnx --tokens sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/tokens.txt

SLEEP_INFITY $0
else
SLEEP_INFITY $0
fi
