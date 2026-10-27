# Evaluation

Evaluation uses a prompt separate from the interviewer. Applicable dimensions include correctness, conceptual depth, problem-solving, communication, experience, trade-off awareness, and role relevance. The model returns score, weight, explanation, verbatim evidence, confidence, and improvement.

Pydantic validates ranges and shape. Weights are normalized and the overall score is recomputed rather than trusted. A deterministic post-validator removes every quote that is not a verbatim substring of a candidate answer and lowers confidence when evidence is absent. Protected traits and accent are forbidden criteria.

Malformed output receives one bounded retry. If it still fails, a clearly labeled limited assessment uses answer completeness and never claims technical correctness. Sessions remain preserved and evaluation can be retried. All reports say that scores are AI-generated practice feedback, not hiring decisions.
