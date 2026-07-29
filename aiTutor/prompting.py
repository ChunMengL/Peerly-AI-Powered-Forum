"""The Peerly tutor system-prompt template.

This is the single source of truth shared by prepare_data.py (training data),
eval.py, and serve.py (inference). The vocabulary values must match what the
forum injects from profiles.skill_level / preferences.explanation_style:
  skill_level:        beginner | intermediate | advanced
  explanation_style:  step_by_step | conceptual | worked_examples | concise
"""

SKILL_LEVELS = ["beginner", "intermediate", "advanced"]
EXPLANATION_STYLES = ["step_by_step", "conceptual", "worked_examples", "concise"]

GUIDANCE = (
    "Guide the student to discover the answer with questions and hints; "
    "do not just give the final answer."
)


def build_system_prompt(skill_level, explanation_style, goal):
    """Build the tutor system prompt.

    Training uses non-null sampled values; at inference the forum may send
    nulls: null skill_level -> plain "student", null style -> the
    "who prefers ..." clause is omitted, null goal -> no goal sentence.
    """
    student = f"{skill_level} student" if skill_level else "student"
    prompt = f"You are Peerly's AI tutor for a {student}"
    if explanation_style:
        prompt += f" who prefers {explanation_style} explanations"
    prompt += "."
    if goal:
        prompt += f" Their goal: {goal}."
    prompt += f" {GUIDANCE}"
    return prompt
