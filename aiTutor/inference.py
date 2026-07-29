"""Load base model + LoRA adapter and generate tutor replies.

Shared by serve.py and eval.py. Generation parameters are the frozen serving
defaults from the handover.
"""

import json
import time
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

GENERATION = dict(
    max_new_tokens=400,
    do_sample=True,
    temperature=0.7,
    top_p=0.9,
    repetition_penalty=1.1,
)


class TutorModel:
    def __init__(self, adapter_dir, base_model=None, load_4bit=True, gen_overrides=None):
        # gen_overrides lets callers swap the sampling defaults, e.g.
        # {"do_sample": False} for greedy or {"temperature": 0.2} for Granite,
        # whose logits_scaling=8 makes temp 0.7 sample near-randomly.
        self.gen = {**GENERATION, **(gen_overrides or {})}
        adapter_dir = Path(adapter_dir)
        if base_model is None:
            meta = json.loads((adapter_dir / "training_meta.json").read_text())
            base_model = meta["base_model"]
        self.base_model_name = base_model

        use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
        dtype = torch.bfloat16 if use_bf16 else torch.float16

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(adapter_dir)
        except Exception:
            # Adapters saved by a NEWER transformers than this eval env stamp the
            # tokenizer config in ways older versions can't parse (tokenizer_class
            # "TokenizersBackend" -> ValueError; extra_special_tokens as a list ->
            # AttributeError). The base tokenizer is equivalent (chat templates
            # verified identical), so fall back to it on any load failure.
            self.tokenizer = AutoTokenizer.from_pretrained(base_model)
        kwargs = {"torch_dtype": dtype, "device_map": {"": 0}}
        if load_4bit:
            kwargs["quantization_config"] = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
                bnb_4bit_compute_dtype=dtype,
            )
        base = AutoModelForCausalLM.from_pretrained(base_model, **kwargs)
        self.model = PeftModel.from_pretrained(base, adapter_dir)
        self.model.eval()

    @torch.inference_mode()
    def reply(self, messages):
        """messages: [{role, content}, ...] ending with a user turn.

        Returns (reply_text, stats) where stats has token counts and tok/s.
        """
        # enable_thinking=False keeps reasoning-capable models (SmolLM3) in
        # /no_think mode so replies match training and the other four models —
        # plain tutor text, no <think> blocks. Ignored by models without a
        # thinking mode, so it's safe for every adapter.
        input_ids = self.tokenizer.apply_chat_template(
            messages, add_generation_prompt=True, return_tensors="pt",
            enable_thinking=False,
        ).to(self.model.device)

        gen = dict(self.gen)
        if not gen.get("do_sample", True):
            # transformers warns if temperature/top_p are set under greedy.
            gen.pop("temperature", None)
            gen.pop("top_p", None)

        start = time.perf_counter()
        output = self.model.generate(
            input_ids,
            pad_token_id=self.tokenizer.pad_token_id
            or self.tokenizer.eos_token_id,
            **gen,
        )
        elapsed = time.perf_counter() - start

        new_tokens = output[0][input_ids.shape[1]:]
        text = self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
        stats = {
            "prompt_tokens": int(input_ids.shape[1]),
            "completion_tokens": int(new_tokens.shape[0]),
            "seconds": round(elapsed, 2),
            "tokens_per_second": round(new_tokens.shape[0] / elapsed, 1),
        }
        return text, stats
