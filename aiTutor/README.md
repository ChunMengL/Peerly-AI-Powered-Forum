# aiTutor — the fine-tuned model behind Peerly's AI answers

Falcon3-3B-Instruct + the `Falcon3_v2_full` LoRA adapter, served over HTTP. The forum calls it
server-side from `lib/tutor.ts`; if it is unreachable the forum silently falls back to a
deterministic mock reply, so the site never breaks.

## Contents

| File | What it is |
|---|---|
| `Falcon3_v2_full/` | the trained LoRA adapter (48 MB) — the actual output of the fine-tuning |
| `serve.py` | FastAPI server exposing `GET /health` and `POST /tutor` |
| `inference.py` | loads base + adapter, generates replies |
| `prompting.py` | builds the system prompt from the student profile (same one used in training) |
| `chat.py` | terminal chat client — run the model with no web app involved |
| `requirements.txt` | Python deps (PyTorch installed separately, see the file's header) |
| `sample_request.json` | example `/tutor` request body |

The base model is **not** included — it is a 6.4 GB public download from Hugging Face
(`tiiuae/Falcon3-3B-Instruct`) and is fetched automatically on first run.

## Running it

```bash
python serve.py --adapter Falcon3_v2_full
```

Wait for `ready: tiiuae/Falcon3-3B-Instruct + Falcon3_v2_full` (~15–30 s). Needs a CUDA GPU.

On the development machine the base model is already downloaded, so point at it directly to skip
the Hugging Face lookup:

```bash
python serve.py --adapter Falcon3_v2_full --base-model ../../models/Falcon3-3B-Instruct
```

Check it is alive:

```bash
curl -s http://localhost:8000/health
```

## Connecting it to the deployed forum

`serve.py` binds `127.0.0.1`, so Vercel cannot reach it directly. A Cloudflare tunnel exposes it:

```bash
cloudflared tunnel --url http://localhost:8000
```

Set the printed `https://<...>.trycloudflare.com` URL as `MODEL_SERVER_URL` in Vercel (no trailing
slash, no `/tutor`) and redeploy — env changes need a redeploy.

**The tunnel URL changes every restart**, and a dead tunnel is invisible in the UI: the forum just
serves mock replies. Always verify with a real generation, not just `/health`:

```bash
curl -s -X POST http://localhost:8000/tutor -H "Content-Type: application/json" -d @sample_request.json
```

## API contract (must match `lib/tutor.types.ts` — do not rename fields)

`GET /health` → `{"status": "ok", "model": "<base model name>"}`

`POST /tutor`

```json
{
  "question": "string",
  "history": [{"role": "user", "content": "string"}],
  "profile": {"skill_level": "beginner", "explanation_style": "step_by_step", "goal": null}
}
```

→ `{"reply": "string"}`

The system prompt is built server-side from `profile`, never sent by the client — this keeps it
identical to the prompt used during training.

## Known limitations

Documented in the report, not inference bugs — both are training-data coverage gaps:

- **Sycophancy** — accepts a wrong student answer and praises it. Not prompt-fixable; an explicit
  corrective system prompt made it worse.
- **Non-termination** — repeated "I don't know" replies loop into encouragement without advancing.

The forum compensates by marking AI answers unverified until a verified lecturer accepts or
disputes them.
