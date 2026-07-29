"""Interactive REPL to test a trained adapter with your own questions.

Type questions, get tutor replies, keeps the conversation history so
follow-ups work. Ctrl+C or empty line to quit.

    python chat.py --adapter ../Qwen2.5-model-out
    python chat.py --adapter ../Falcon-3-model-out --base-model ../models/Falcon3-3B-Instruct

Flags --skill-level and --style set the profile (same vocab as the forum):
    skill_level: beginner | intermediate | advanced
    style:       step_by_step | conceptual | worked_examples | concise
"""

import argparse

from inference import TutorModel
from prompting import build_system_prompt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", default="../Qwen2.5-model-out")
    ap.add_argument("--base-model", default=None)
    ap.add_argument("--skill-level", default="beginner")
    ap.add_argument("--style", default="step_by_step")
    ap.add_argument("--greedy", action="store_true", help="deterministic; use for Granite")
    ap.add_argument("--temperature", type=float, default=None)
    args = ap.parse_args()

    overrides = {}
    if args.greedy:
        overrides["do_sample"] = False
    if args.temperature is not None:
        overrides["temperature"] = args.temperature
    model = TutorModel(args.adapter, base_model=args.base_model, gen_overrides=overrides)
    system = build_system_prompt(args.skill_level, args.style, None)
    print(f"\nprofile: {args.skill_level}/{args.style}. Blank line quits.\n")

    history = []  # user/assistant turns, no system (rebuilt each call)
    while True:
        try:
            q = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not q:
            break
        messages = [{"role": "system", "content": system}] + history
        messages.append({"role": "user", "content": q})
        reply, stats = model.reply(messages)
        print(f"\ntutor> {reply}\n[{stats['tokens_per_second']} tok/s]\n")
        history.append({"role": "user", "content": q})
        history.append({"role": "assistant", "content": reply})


if __name__ == "__main__":
    main()
