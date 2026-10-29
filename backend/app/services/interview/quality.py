import re
from difflib import SequenceMatcher

STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "because", "but", "by", "can", "did",
    "do", "for", "from", "how", "i", "if", "in", "is", "it", "of", "on", "or", "that",
    "the", "this", "to", "was", "what", "when", "where", "which", "with", "would", "you",
    "your",
}
GENERIC_PRAISE = ("great answer", "excellent", "amazing", "perfect answer", "that's interesting")


def tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", value.lower())
        if token not in STOP_WORDS and len(token) > 2
    }


def assess_follow_up(answer: str, question: str, prior_questions: list[str] | None = None) -> dict:
    """Deterministic, auditable signals; relevance remains a human-reviewed heuristic."""
    answer_tokens, question_tokens = tokens(answer), tokens(question)
    overlap = answer_tokens & question_tokens
    repetitions = [
        SequenceMatcher(None, question.lower(), previous.lower()).ratio()
        for previous in (prior_questions or [])
    ]
    word_count = len(question.split())
    failures = []
    if question.count("?") > 1:
        failures.append("multiple_questions")
    if word_count > 35:
        failures.append("not_speech_concise")
    if any(phrase in question.lower() for phrase in GENERIC_PRAISE):
        failures.append("generic_praise")
    if repetitions and max(repetitions) >= 0.82:
        failures.append("near_duplicate_question")
    return {
        "word_count": word_count,
        "answer_keyword_overlap": sorted(overlap),
        "lexically_grounded": bool(overlap),
        "maximum_prior_similarity": round(max(repetitions), 3) if repetitions else 0.0,
        "failures": failures,
    }
