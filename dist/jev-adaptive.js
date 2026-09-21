// Preview opt-in. Model judgments unlock optional hints; never execute moves.
export function hintOffer(data) {
  const p=data?.probabilities, action=data?.recommendation;
  const unit=x=>typeof x==='number' && Number.isFinite(x) && x>=0 && x<=1;
  if (!['NONE','GLOW','GESTURE'].includes(action) || !unit(data.confidence) ||
      !unit(data.needsHint) || !unit(data.stuck) || !p ||
      !['NONE','GLOW','GESTURE'].every(k=>unit(p[k])) ||
      Math.abs(p.NONE+p.GLOW+p.GESTURE-1)>.02 ||
      p[action]+.0001<Math.max(p.NONE,p.GLOW,p.GESTURE)) return {tier:0,ripeness:0};
  // Initial experiment thresholds, not validated accuracy estimates.
  if (action==='GESTURE' && data.confidence>=.65 && p.GESTURE>=.75 && data.needsHint>=.6) return {tier:2,ripeness:3};
  if (action!=='NONE' && data.confidence>=.5 && p[action]>=.65 && data.needsHint>=.55) return {tier:1,ripeness:3};
  return {tier:0,ripeness:action!=='NONE' && data.needsHint>=.5 ? 2 : data.stuck>=.5 ? 1 : 0};
}
export class AdaptiveHints {
  constructor({capture,isCurrent,grant,onChange=()=>{},fetcher=(...a)=>fetch(...a),online=()=>navigator.onLine,now=Date.now}) {
    Object.assign(this,{capture,isCurrent,grant,onChange,fetcher,online,now});
    this.ready=false;this.busy=false;this.lastCall=-Infinity;this.calls=0;this.byStage=new Map();
    this.status='연결 확인 중';this.last=null;this.epoch=0;
  }
  async connect() {
    if (!this.online()) {this.status='오프라인 · 기본 힌트';return;}
    try {
      const r=await this.fetcher('/api/jev',{cache:'no-store',signal:AbortSignal.timeout(10000)});
      const data=await r.json();
      this.ready=r.ok && data.enabled===true;
      this.status=this.ready?'자동 힌트 켜짐':data.error==='missing_key'?'Preview API 키 확인 필요 · 기본 힌트':'연결 불가 · 기본 힌트';
    } catch {this.ready=false;this.status='연결 불가 · 기본 힌트';}
    this.onChange();
  }
  reset() {this.epoch++;this.last=null;this.onChange();}
  async consider(reason) {
    const snap=this.capture();
    if (!this.ready || this.busy || !this.online() || !snap || snap.state.stage<11 ||
        !['playing','failed'].includes(snap.state.status) || snap.tier>=2) return;
    const s=snap.state;
    const eligible=reason==='failed' || (reason==='invalid' && s.invalidSequences>0 && s.invalidSequences%3===0) ||
      (reason==='repeat' && s.repeatedSequences>0 && s.repeatedSequences%2===0) ||
      (reason==='retry' && s.attempts>=3) ||
      (reason==='thinking' && s.activeSeconds>=45 && s.secondsSinceAction>=30 && s.invalidSequences>=1);
    if (!eligible || this.now()-this.lastCall<45000 || this.calls>=20 || (this.byStage.get(snap.key)||0)>=4) return;
    this.busy=true;this.lastCall=this.now();this.calls++;const epoch=this.epoch;
    this.byStage.set(snap.key,(this.byStage.get(snap.key)||0)+1);
    this.status='플레이를 보고 있어요';this.onChange();
    try {
      const r=await this.fetcher('/api/jev',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(s),signal:AbortSignal.timeout(10000)});
      const data=await r.json();
      if (!r.ok) throw Error(data.error==='rate_limit' || data.error==='upstream_limit'?'호출 한도 · 기본 힌트':'응답 실패 · 기본 힌트');
      if (epoch!==this.epoch || !this.isCurrent(snap)) {this.status='판이 바뀌어 이전 판단을 적용하지 않았어요';return;}
      const offer=hintOffer(data);
      this.last={stage:s.stage,...data,offer};
      this.grant(snap.level,offer);
      this.status=offer.tier?'망고 힌트가 열렸어요':offer.ripeness?'망고가 조금 익었어요':'조금 더 지켜볼게요';
    } catch(e) {this.status=e.name==='TimeoutError'?'응답 지연 · 기본 힌트':e.message;}
    finally {this.busy=false;this.onChange();}
  }
}
