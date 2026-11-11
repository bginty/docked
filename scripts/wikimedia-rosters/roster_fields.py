"""Explicit field aliases only; conflicting upstream values require review."""
def explicit_current_club(fields, decode, normalise):
    old = decode(fields.get('currentclub', ''))
    new = decode(fields.get('current_club', ''))
    conflict = bool(old and new and normalise(old) != normalise(new))
    return old or new, conflict
