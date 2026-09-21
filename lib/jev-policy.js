export const actions = ['NONE', 'GLOW', 'GESTURE'];
const int = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
export function validateState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const limits = {stage:[11,50], size:[4,5], moveLimit:[1,10], movesLeft:[0,10],
    starsTotal:[1,25], starsLeft:[0,25], failures:[0,5], attempts:[1,10000],
    activeSeconds:[0,10000], secondsSinceAction:[0,10000],
    invalidSequences:[0,10000], repeatedSequences:[0,10000], validSequences:[0,10000]};
  if (Object.keys(value).some(k => !(k in limits) && !['status','hintSeen'].includes(k))) return null;
  for (const [k,[min,max]] of Object.entries(limits)) if (!int(value[k],min,max)) return null;
  if (!['playing','failed','cleared'].includes(value.status) || !actions.includes(value.hintSeen)) return null;
  if (value.movesLeft > value.moveLimit || value.starsLeft > value.starsTotal ||
      value.starsTotal > value.size ** 2 || value.secondsSinceAction > value.activeSeconds ||
      value.repeatedSequences > value.invalidSequences + value.validSequences) return null;
  return Object.fromEntries([...Object.keys(limits),'status','hintSeen'].map(k => [k,value[k]]));
}
export const baseline = state => state.failures >= 5 ? 'GESTURE' : state.failures >= 3 ? 'GLOW' : 'NONE';
export function requestFor(state) {
  return {
    model: 'jev-latest',
    state: {
      game: 'SequencePang2: connect at least three adjacent arithmetic/geometric sequence tiles, including diagonals. Collect every star within the move limit. Gravity after removal; no refill. No time limit.',
      observationScope: 'Current page visit and current stage only. Attempts include manual restarts; failures are completed losses saved locally and capped at 5. Times count only visible gameplay, excluding dialogs and background tabs. Time alone does not establish frustration; thoughtful exploration is normal. These metrics cannot prove the player understands a rule or wants help.',
      player: state,
    },
    questions: {
      stuck: { type:'noul', instructions:'Does the observed behavior suggest repeated unproductive attempts on this stage? Use repetition, invalid sequences, failure history and current progress. Slow thinking alone is not sufficient. This is an uncertain behavioral estimate, not a diagnosis or a solvability judgment.' },
      needs_hint: { type:'noul', instructions:'Would offering optional assistance now likely help this player continue? Balance observed difficulty against recent progress and preserving independent discovery. A cleared stage needs no assistance. Do not infer distress from time alone.' },
      recommendation: { type:'choice', instructions:'Choose the least intrusive optional assistance worth offering, based on the observed behavior. Never solve the puzzle. Hints are for the initial board, so after any move they require an optional restart. A cleared stage needs NONE. Do not simply copy the failure-count policy; evaluate the other available evidence too.',
        criteria: {
          NONE:'Continue independently; adequate progress, little evidence of difficulty, or stage cleared.',
          GLOW:'Offer a subtle glow on the verified first tile when the player appears to need a starting point.',
          GESTURE:'Offer the verified first connection as a drag demonstration when repeated difficulty or continued trouble after GLOW suggests a starting point alone is insufficient. This is one connection, not a full solution.',
        } },
    },
  };
}
const probability = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
export function parseDecision(data) {
  const a = data?.answers, r = a?.recommendation;
  if (a?.stuck?.type !== 'noul' || a?.needs_hint?.type !== 'noul' || r?.type !== 'choice' ||
      !probability(a.stuck.noul) || !probability(a.needs_hint.noul) ||
      !actions.includes(r.choice) || !probability(r.confidence)) throw Error('Invalid Jev response');
  const probabilities = Object.fromEntries(actions.map(k => [k,r.probabilities?.[k]]));
  if (Object.keys(r.probabilities || {}).length !== actions.length || !Object.values(probabilities).every(probability) ||
      Math.abs(Object.values(probabilities).reduce((x,y)=>x+y,0)-1) > .02 ||
      probabilities[r.choice] + .0001 < Math.max(...Object.values(probabilities))) throw Error('Invalid Jev probabilities');
  return {stuck:a.stuck.noul, needsHint:a.needs_hint.noul, recommendation:r.choice,
    probabilities, confidence:r.confidence,
    model:typeof data.model === 'string' ? data.model.slice(0,80) : 'unknown'};
}
