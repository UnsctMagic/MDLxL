"""Art-scope exceptions are reviewed evidence, independent of MDX version."""
import json
from pathlib import Path
SCOPE_REVIEW=json.loads((Path(__file__).resolve().parents[2]/'docs/SD-RESEARCH/data/base-namespace-art-exceptions.json').read_text('utf-8-sig'))
EXCLUDED_BASE_IDS={m['id']for m in SCOPE_REVIEW['models']if m['activeSdStudy']is False}
def is_active_sd(model):
 return (model.get('tier')or 'sd')=='sd'and model['id']not in EXCLUDED_BASE_IDS
