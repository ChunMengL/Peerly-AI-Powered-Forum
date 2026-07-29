"""FastAPI server exposing the fine-tuned Peerly tutor.

The request/response shapes are the frozen contract from the forum's
lib/tutor.types.ts — do not rename fields.

Run:
    python serve.py --adapter adapters/mathdial
    # or: uvicorn is invoked internally; binds 127.0.0.1:8000
"""

import argparse
from contextlib import asynccontextmanager
from typing import Literal, Optional

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel

from inference import TutorModel
from prompting import build_system_prompt

cli = argparse.ArgumentParser()
cli.add_argument("--adapter", default="adapters/mathdial")
cli.add_argument("--base-model", default=None,
                 help="override; defaults to training_meta.json in the adapter dir")
cli.add_argument("--host", default="127.0.0.1")
cli.add_argument("--port", type=int, default=8000)
args = cli.parse_args()

state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"loading base + adapter from {args.adapter} ...")
    state["model"] = TutorModel(args.adapter, base_model=args.base_model)
    print(f"ready: {state['model'].base_model_name} + {args.adapter}")
    yield


app = FastAPI(lifespan=lifespan)


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class Profile(BaseModel):
    skill_level: Optional[str] = None
    explanation_style: Optional[str] = None
    goal: Optional[str] = None


class TutorRequest(BaseModel):
    question: str
    history: list[HistoryMessage]
    profile: Profile


class TutorResponse(BaseModel):
    reply: str


@app.get("/health")
def health():
    return {"status": "ok", "model": state["model"].base_model_name}


@app.post("/tutor", response_model=TutorResponse)
def tutor(req: TutorRequest):
    messages = [{
        "role": "system",
        "content": build_system_prompt(
            req.profile.skill_level, req.profile.explanation_style, req.profile.goal
        ),
    }]
    messages += [{"role": m.role, "content": m.content} for m in req.history]
    messages.append({"role": "user", "content": req.question})

    reply, stats = state["model"].reply(messages)
    print(f"/tutor {stats}")
    return {"reply": reply}


if __name__ == "__main__":
    uvicorn.run(app, host=args.host, port=args.port)
