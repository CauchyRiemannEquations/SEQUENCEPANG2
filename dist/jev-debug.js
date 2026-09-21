const labels = {NONE:'지켜보기',GLOW:'첫 숫자 반짝임',GESTURE:'첫 연결 시범'};
const errors = {missing_key:'Preview의 TYPESAFE_API_KEY 설정을 확인해 주세요.',preview_only:'Preview 배포에서만 사용할 수 있어요.',upstream_auth:'TypeSafe 키의 인증·권한을 확인해 주세요.',upstream_limit:'TypeSafe 호출 한도에 도달했어요.',rate_limit:'호출 간격 또는 실험 한도에 도달했어요. 잠시 후 다시 시도해 주세요.',timeout:'응답 시간이 초과됐어요. 기존 힌트는 정상 동작해요.'};
export async function mountJevDebug({snapshot,pause,resume,jump,automatic=false,autoState=()=>({})}) {
  const button=document.createElement('button');
  button.className='jev-toggle'; button.textContent=automatic?'Jev · 자동 힌트':'Jev · 실험';
  button.type='button'; document.body.append(button);
  const dialog=document.createElement('dialog'); dialog.className='jev-dialog';
  dialog.setAttribute('aria-labelledby','jev-title');
  dialog.innerHTML=`<div class="jev-heading"><h2 id="jev-title">Jev 추천 비교</h2><button id="jev-close" aria-label="실험 창 닫기">×</button></div>
    <p class="jev-note">추천만 비교해요. 실제 망고 힌트는 기존 규칙을 따릅니다.</p>
    <p id="jev-status" role="status">연결 설정 확인 중…</p>
    <form id="jev-stage-form" class="jev-stage-form"><label for="jev-stage">테스트 스테이지</label><input id="jev-stage" type="number" min="11" max="50" value="18" required><button type="submit">이동</button></form>
    <p class="jev-note">비교 버튼을 누를 때 플레이 요약 수치를 TypeSafe에 보내요. 이름·기기 식별자는 보내지 않아요.</p>
    <button id="jev-evaluate" class="primary" disabled>현재 플레이로 추천 비교</button>
    <div id="jev-result" aria-live="polite"></div>
    <details><summary>전송한 플레이 요약</summary><pre id="jev-state">아직 보내지 않았어요.</pre></details>
    <p class="jev-note">확률은 모델 추정치이며 실제 정답률이 아닙니다. 전체 정답 공개는 실험하지 않아요.</p>`;
  document.body.append(dialog);
  if (automatic) {
    dialog.querySelector('#jev-title').textContent='Jev 자동 힌트';
    const notes=dialog.querySelectorAll('.jev-note');
    notes[0].textContent='플레이 중 Jev 판단으로 망고가 익어요. 열린 힌트는 직접 눌러 확인하세요.';
    notes[1].textContent='실패·반복 시도 때 플레이 요약 수치를 TypeSafe에 보내요. 연결 실패 시 기본 힌트를 사용해요.';
  }
  const get=id=>dialog.querySelector('#'+id);
  let enabled=false, pending=false, nextCall=0;
  function refresh() {
    const s=snapshot();
    get('jev-evaluate').disabled=!enabled||pending||!s||s.stage<11;
    if (s && !pending) get('jev-stage').value=s.stage<11?11:s.stage;
  }
  button.onclick=()=>{
    pause();refresh();
    if(automatic) {
      const info=autoState();
      get('jev-status').textContent=info.status;
      get('jev-result').replaceChildren();
      if(info.last) {const p=document.createElement('p');p.textContent='최근 자동 판단 · STAGE '+info.last.stage+' · '+labels[info.last.recommendation];get('jev-result').append(p);}
    }
    dialog.showModal();
  };
  get('jev-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',resume);
  get('jev-stage-form').onsubmit=e=>{
    e.preventDefault(); if (pending) return;
    const stage=Number(get('jev-stage').value);
    if (!Number.isInteger(stage)||stage<11||stage>50) return;
    dialog.close();jump(stage-1);get('jev-result').replaceChildren();
  };
  try {
    const response=await fetch('/api/jev',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    const data=await response.json();
    enabled=response.ok&&data.enabled===true;
    get('jev-status').textContent=enabled?'설정 확인 완료 · 비교 버튼으로 실제 API를 호출합니다.':errors[data.error]||'실험 API에 연결할 수 없어요.';
  } catch {get('jev-status').textContent='실험 API에 연결할 수 없어요. 온라인 Preview에서 열어 주세요.';}
  refresh();
  get('jev-evaluate').onclick=async()=>{
    const state=snapshot();
    if (!enabled||pending||!state||state.stage<11) return;
    if (Date.now()<nextCall) {get('jev-status').textContent='5초 간격으로 비교할 수 있어요.';return;}
    pending=true;nextCall=Date.now()+5000;refresh();
    get('jev-state').textContent=JSON.stringify(state,null,2);
    get('jev-result').replaceChildren();get('jev-status').textContent='Jev 판단 중…';
    try {
      const response=await fetch('/api/jev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state),signal:AbortSignal.timeout(12000)});
      const data=await response.json();
      if (!response.ok) throw Error(errors[data.error]||'추천을 받지 못했어요. 기존 힌트는 정상 동작해요.');
      const percent=n=>`${Math.round(n*100)}%`;
      const row=(name,value)=>{const p=document.createElement('p'),b=document.createElement('b');b.textContent=value;p.append(name+' ',b);get('jev-result').append(p);};
      row(`STAGE ${state.stage} · 기존 규칙`,labels[data.baseline]);
      row('Jev 추천',labels[data.recommendation]);
      row('막힘 추정',percent(data.stuck));row('도움 필요 추정',percent(data.needsHint));
      for (const k of ['NONE','GLOW','GESTURE']) row(labels[k],percent(data.probabilities[k]));
      row('모델 확신도',percent(data.confidence));
      get('jev-status').textContent=`비교 완료 · ${data.model} · 게임에는 적용하지 않았어요.`;
    } catch(e) {get('jev-status').textContent=e.name==='TimeoutError'?'응답 시간이 초과됐어요.':e.message;}
    finally {pending=false;refresh();}
  };
}
