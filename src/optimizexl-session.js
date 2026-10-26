import { openDocument } from './editor-document.js';

/** Copy an approved OptimizeXL result into the open document's model. Keys the
 * MDX round trip does not carry (editor-only data) stay as they are. */
export function adoptOptimizeXLResult(model, bytes) {
  const approved = openDocument(new Uint8Array(bytes), 'optimizexl.mdx').model;
  if (approved.Version !== model.Version) throw Error('The OptimizeXL result has a different model version.');
  for (const key of Object.keys(approved)) model[key] = approved[key];
}

/** Review history is private to OptimizeXL until the user saves it into the file. */
export class OptimizeXLSession {
  constructor(bytes, name = 'model.mdx') {
    this.name = name;
    this.before = new Uint8Array(bytes);
    this.accepted = new Uint8Array(bytes);
    this.steps = [];
    this.revision = 0;
    this.candidate = null;
    this.reviews = new Map();
    this.availability = new Map();
  }
  recordReview(stage, noChanges, exclusions = '') {
    this.reviews.set(stage, { before: this.accepted, noChanges, exclusions });
  }
  recordAvailability(stage, hasChanges, exclusions = '', error = '') {
    this.availability.set(stage, { before: this.accepted, hasChanges, exclusions, error });
  }
  needsReview(stage, exclusions = '') {
    if (this.steps.some(step => step.stage === stage && !step.skipped)) return false;
    const review = this.reviews.get(stage);
    if (review?.before === this.accepted && review.exclusions === exclusions) return !review.noChanges;
    const available = this.availability.get(stage);
    return available?.before === this.accepted && available.exclusions === exclusions && available.hasChanges || false;
  }
  propose(result, revision) {
    if (revision !== this.revision) return false;
    this.candidate = result;
    return true;
  }
  approve(stage, settings) {
    if (!this.candidate) throw Error('Wait for the preview before approving.');
    this.steps.push({ stage, settings: structuredClone(settings), before: this.accepted, skipped: false });
    this.accepted = new Uint8Array(this.candidate.bytes);
    this.candidate = null;
    this.revision++;
  }
  skip(stage) {
    this.steps.push({ stage, before: this.accepted, skipped: true });
    this.candidate = null;
    this.revision++;
  }
  back() {
    const step = this.steps.pop();
    if (!step) return null;
    this.accepted = step.before;
    this.reviews.delete(step.stage);
    this.candidate = null;
    this.revision++;
    return step;
  }
}
