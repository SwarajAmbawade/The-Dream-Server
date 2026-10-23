(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const MOODS = {Lucid:'#5bd8f4',Peaceful:'#61e7b4',Surreal:'#ff579c',Recurring:'#ffdb68',Nightmare:'#ff8b66'};
  const state = { token: localStorage.getItem('dreamserver_token') || '', user:null, tab:'feed', profileSection:'created', authMode:'login', dreams:[], mine:[], transactions:[], profileStatus:{spunToday:false,todayReward:null,events:[]} };
  let toastTimer;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
  async function api(path, options={}) {
    const headers={'Content-Type':'application/json',...(options.headers||{})}; if(state.token) headers.Authorization=`Bearer ${state.token}`;
    const response=await fetch('/api'+path,{...options,headers}); let data={};try{data=await response.json()}catch{}
    if(!response.ok){if(response.status===401&&state.token){state.token='';state.user=null;localStorage.removeItem('dreamserver_token');showAuth();}throw new Error(data.error||'Request failed.');}
    return data;
  }
  function showAuth(){ $('#auth-view').classList.remove('hidden');$('#app-view').classList.add('hidden');$('#user-chip').classList.add('hidden'); }
  function showApp(){ $('#auth-view').classList.add('hidden');$('#app-view').classList.remove('hidden');$('#user-chip').classList.remove('hidden');$('#user-chip').textContent=`✦ ${state.user.username} ▾`; $('#user-chip').setAttribute('aria-label', `Open ${state.user.username}'s profile`);$('#credits').textContent=`${state.user.credits} ◈`; $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab)); }
  function empty(title, text){return `<div class="empty"><b>${esc(title)}</b>${esc(text)}</div>`;}
  function card(d, mode='feed') {
    const mood=MOODS[d.mood]||'#aa91ff';
    const canMarket=mode==='market'&&d.forSale;
    let actions=`<button class="btn watch" data-watch="${d.id}">▶ Watch dream</button><button class="btn like ${d.resonated?'liked':''}" data-like="${d.id}">${d.resonated?'♥ Resonated':'♡ Resonate'} · ${d.likes}</button>`;
    if(canMarket){
      actions += `<button class="btn buy" data-buy="${d.id}" ${d.owned||d.authorId===state.user.id?'disabled':''}>${d.owned?'Owned':d.authorId===state.user.id?'Yours':`Buy ${d.price} ◈`}</button>`;
      actions += `<button class="btn rent" data-rent="${d.id}" ${d.owned||d.rented||d.authorId===state.user.id?'disabled':''}>${d.rented?'Rented':`Rent ${d.rent}/wk`}</button>`;
    } else if(d.forSale) actions += `<span class="price">${d.price} ◈ / ${d.rent} ◈ weekly</span>`;
    if(mode==='created' && d.authorId===state.user.id) actions += `<button class="btn delete-dream" data-delete-dream="${d.id}">Delete dream</button>`;
    if(mode==='mine' && d.owned) actions += '<span class="pill">OWNED</span>';
    if(mode==='mine' && d.rented) actions += '<span class="pill" style="background:var(--green)">RENTED</span>';
    const image=d.imageUrl||'';
    return `<article class="dream-card"><img class="dream-image" src="${image}" alt="Artwork for ${esc(d.title)}" loading="lazy" data-image="${d.id}"><div class="dream-content"><div class="meta"><span class="pill" style="background:${mood}">${esc(d.mood)}</span>${d.ai?'<span class="pill ai">AI-ORIGIN</span>':''}<span class="pill author">by ${esc(d.author)}</span></div><h3>${esc(d.title)}</h3><p class="story">${esc(d.story)}</p>${d.imageCredit?`<p class="image-credit">Artwork: <a href="${esc(d.imageSourceUrl||'#')}" target="_blank" rel="noopener noreferrer">${esc(d.imageCredit)}</a>${d.imageLicense?` · ${esc(d.imageLicense)}`:''}</p>`:''}<div class="card-bottom"><div class="actions">${actions}</div></div></div></article>`;
  }
  function sectionHead(title, desc, count=''){return `<div class="section-head"><div><h2>${title}</h2><p>${desc}</p></div>${count?`<span class="count">${count}</span>`:''}</div>`;}
  function render() {
    showApp();const view=$('#view');const all=state.dreams;
    if(state.tab==='feed'){
      view.innerHTML=sectionHead('Latest dreams','A collection of minds, moods and impossible places.',`${all.length} DREAMS`)+(all.length?`<div class="grid">${all.map(d=>card(d)).join('')}</div>`:empty('A quiet server','Be the first to share a dream.'));
    } else if(state.tab==='market'){
      const top=all.filter(d=>d.forSale).sort((a,b)=>b.likes-a.likes).slice(0,6);
      view.innerHTML=sectionHead('The dream marketplace','The most resonant dreams, ranked by the community.',`${top.length} LISTED`) + '<div class="note">Credits are a project currency, not real money. Buying records ownership in your account; rentals last seven days. Your own dreams cannot be purchased or rented by you.</div>'+(top.length?`<div class="grid">${top.map(d=>card(d,'market')).join('')}</div>`:empty('No listings yet','Share a dream and list it for sale or rent.'));
    } else if(state.tab==='mine'){
      const posted=all.filter(d=>d.authorId===state.user.id);const acquired=state.mine.filter(d=>d.owned||d.rented);
      view.innerHTML=sectionHead('Your dream archive','Dreams you have created, collected or rented.')+`<h3>Dreams I posted</h3>${posted.length?`<div class="grid">${posted.map(d=>card(d,'created')).join('')}</div>`:empty('Nothing created yet','Your first dream starts with a story.')}<h3 style="margin-top:30px">Dreams I own or rent</h3>${acquired.length?`<div class="grid">${acquired.map(d=>card(d,'mine')).join('')}</div>`:empty('Your collection is empty','Visit the marketplace to collect a dream.')}`;
    } else if(state.tab==='ai'){
      const dreams=all.filter(d=>d.ai);
      view.innerHTML=sectionHead('Unclaimed dreams','Dreams nobody remembers creating. Their origin is the mystery.',`${dreams.length} UNKNOWN`) + '<div class="note">The server can create a new fictional dream. If image generation is configured, it attempts to paint it using the image API; otherwise, procedural dream art is used.</div><p style="margin:0 0 18px"><button class="btn primary" id="generate-ai">☾ Let the server dream</button></p>'+(dreams.length?`<div class="grid">${dreams.map(d=>card(d,'market')).join('')}</div>`:empty('The server is quiet','Ask it to dream.'));
    } else if(state.tab==='profile'){
      const posted=state.mine.filter(d=>d.authorId===state.user.id);
      const collected=state.mine.filter(d=>d.owned && d.authorId!==state.user.id);
      const rented=state.mine.filter(d=>d.rented && !d.owned && d.authorId!==state.user.id);
      const sections={created:{label:'Created',items:posted,emptyTitle:'No dreams created yet',emptyText:'Share your first dream and it will live here.'},collected:{label:'Collected',items:collected,emptyTitle:'Nothing collected yet',emptyText:'Dreams you buy from the marketplace will appear here.'},rented:{label:'Rented',items:rented,emptyTitle:'No active rentals',emptyText:'Rent a dream to revisit it here for seven days.'}};
      const active=sections[state.profileSection]||sections.created;
      const ps=state.profileStatus||{spunToday:false,events:[]};
      view.innerHTML=`<div class="profile-hero panel"><div class="profile-avatar">${esc((state.user.username||'?').slice(0,1).toUpperCase())}</div><div class="profile-copy"><p class="eyebrow">YOUR DREAMER PROFILE</p><h2>${esc(state.user.username)}</h2><p>Every dream you create, collect, or borrow — gathered in one place.</p></div><div class="profile-stats"><div><strong>${posted.length}</strong><span>Created</span></div><div><strong>${collected.length}</strong><span>Collected</span></div><div><strong>${rented.length}</strong><span>Active rentals</span></div></div></div>
      <div class="profile-economy"><section class="panel economy-panel"><p class="eyebrow">DREAM TOKENS · DEMO CHECKOUT</p><h2>Top up your credits</h2><p class="hint">Choose a fictional token pack. Each checkout adds at most 2,000 credits. No real payment is collected.</p><div class="credit-packs">${[[250,'Pocket'],[500,'Dreamer'],[1000,'Voyager'],[2000,'Astral']].map(([amount,label])=>`<button class="credit-pack" data-topup="${amount}"><strong>${amount.toLocaleString()} ◈</strong><span>${label} pack</span><small>DEMO ONLY</small></button>`).join('')}</div><p class="economy-note">For a college demonstration only — do not enter card details anywhere.</p></section><section class="panel economy-panel wheel-panel"><p class="eyebrow">ONE SPIN · EVERY UTC DAY</p><h2>Lucky dream wheel</h2><div class="wheel-stage"><div class="wheel-pointer" aria-hidden="true"></div><div class="prize-wheel" id="prize-wheel" aria-label="Lucky wheel with credit prizes"><span class="wheel-label label-0">0 ◈</span><span class="wheel-label label-5">5 ◈</span><span class="wheel-label label-10">10 ◈</span><span class="wheel-label label-25">25 ◈</span><span class="wheel-label label-50">50 ◈</span><span class="wheel-label label-100">100 ◈</span><div class="wheel-hub">✦</div></div></div><p class="hint">Try your luck for free credits. The odds are intentionally weighted toward small or zero rewards.</p><div class="wheel-odds"><span>0 ◈ <b>45%</b></span><span>5 ◈ <b>30%</b></span><span>10 ◈ <b>15%</b></span><span>25 ◈ <b>7%</b></span><span>50 ◈ <b>2%</b></span><span>100 ◈ <b>1%</b></span></div><button class="btn primary full" id="spin-wheel" ${ps.spunToday?'disabled':''}>${ps.spunToday?`Already spun today${ps.todayReward!==null?` · ${ps.todayReward} ◈` :''}`:'Spin today’s wheel ↻'}</button><p class="economy-note" id="wheel-result">${ps.spunToday?'Your next spin becomes available tomorrow (UTC).':'No purchase is required.'}</p></section></div>
      <div class="profile-tabs">${Object.entries(sections).map(([key,section])=>`<button class="profile-tab ${state.profileSection===key?'active':''}" data-profile-section="${key}">${section.label} <span>${section.items.length}</span></button>`).join('')}</div>${active.items.length?`<div class="grid">${active.items.map(d=>card(d,'mine')).join('')}</div>`:empty(active.emptyTitle,active.emptyText)}
      <section class="panel credit-history"><h2>Recent credit activity</h2>${ps.events?.length?`<div class="credit-events">${ps.events.map(e=>`<div class="credit-event"><span><strong>${esc(e.details)}</strong><small>${esc(e.created_at)}</small></span><b class="${e.amount>0?'positive':''}">${e.amount>0?'+':''}${e.amount} ◈</b></div>`).join('')}</div>`:'<p class="hint">Your demo top-ups and daily spins will appear here.</p>'}</section>`;
      $$('[data-profile-section]').forEach(b=>b.onclick=()=>{state.profileSection=b.dataset.profileSection;render();});
      $$('[data-topup]').forEach(b=>b.onclick=()=>openDemoCheckout(Number(b.dataset.topup)));
      $('#spin-wheel')?.addEventListener('click',async()=>{const b=$('#spin-wheel');const wheel=$('#prize-wheel');if(!wheel)return;b.disabled=true;b.textContent='The wheel is spinning…';try{const r=await api('/profile/spin',{method:'POST',body:'{}'});const segments=[0,5,10,25,50,100];const index=segments.indexOf(Number(r.reward));const center=index*60;const jitter=8;const finalRotation=360*6+(360-center)+(Math.random()*jitter-jitter/2);wheel.style.transform=`rotate(${finalRotation}deg)`;wheel.classList.add('spinning');await new Promise(resolve=>setTimeout(resolve,4300));state.user=r.user;state.profileStatus={spunToday:r.spunToday,todayReward:r.todayReward,events:r.events};toast(r.message);await refresh();}catch(e){toast(e.message);await refresh();}});
    } else if(state.tab==='share'){
      view.innerHTML=`${sectionHead('Give your dream a life','Describe it. Choose its mood. Let the server paint it.')}<div class="share-layout"><section class="panel"><h2>Dream details</h2><p class="hint">The stranger the details, the more personal the image becomes.</p><form id="dream-form"><label>Dream title<input name="title" required minlength="3" maxlength="80" placeholder="The door at the end of the sea" autocomplete="off"></label><div class="story-suggestion hidden" id="story-suggestion" aria-live="polite"><div><strong>Story idea</strong><p id="story-suggestion-text"></p></div><button class="btn" type="button" id="use-story-suggestion">Use this story</button></div><label>What happened?<textarea name="story" required minlength="10" maxlength="3000" placeholder="I walked through a door and found a city floating beneath the ocean..."></textarea></label><div class="two"><label>Mood<select name="mood"><option>Lucid</option><option>Peaceful</option><option selected>Surreal</option><option>Recurring</option><option>Nightmare</option></select></label><label>Visibility<select name="listing"><option value="0">Share with everyone</option><option value="1">List for sale and rent</option></select></label></div><div class="two"><label>Sale price (credits)<input name="price" type="number" min="0" max="100000" value="50"></label><label>Rent per week (credits)<input name="rent" type="number" min="0" max="100000" value="10"></label></div><button class="btn primary" type="submit">Paint & publish dream ↗</button><p class="error" id="dream-error"></p></form></section><aside class="panel"><p class="eyebrow">YOUR CANVAS</p><h2>Before it exists</h2><p class="hint">A live preview of your title and mood. The server creates the final artwork when you publish.</p><div id="preview" class="preview-empty"><div><div style="font-size:42px;margin-bottom:12px">✧ ☾ ✧</div><span>Your dream is waiting to be imagined.</span></div></div><h3 class="preview-title" id="preview-title">Untitled dream</h3><p class="preview-story" id="preview-story">Your story will appear here.</p></aside></div>`;
      const form=$('#dream-form');const titleInput=$('input[name="title"]',form);let currentStorySuggestion='';const suggestionBox=$('#story-suggestion');const suggestStory=()=>{const title=titleInput.value.trim();currentStorySuggestion=makeStorySuggestion(title);if(title.length>=4&&currentStorySuggestion){$('#story-suggestion-text').textContent=currentStorySuggestion;suggestionBox.classList.remove('hidden');}else suggestionBox.classList.add('hidden');};titleInput.addEventListener('input',suggestStory);$('#use-story-suggestion').addEventListener('click',()=>{if(currentStorySuggestion){form.elements.story.value=currentStorySuggestion;preview();toast('Story suggestion added. You can edit it before publishing.');}});const preview=()=>{const data=new FormData(form);const title=data.get('title')||'Untitled dream';const story=data.get('story')||'Your story will appear here.';const mood=data.get('mood');$('#preview-title').textContent=title;$('#preview-story').textContent=story;$('#preview').style.background=`linear-gradient(145deg,${MOODS[mood]}35,#ff9b4820,#5bd8f420)`;$('#preview').innerHTML=`<div style="padding:22px;text-align:center;color:#fff"><div style="font-size:46px;margin-bottom:12px">${mood==='Nightmare'?'☾':mood==='Peaceful'?'✿':mood==='Lucid'?'✧':mood==='Recurring'?'∞':'◈'}</div><strong>${esc(title.slice(0,44))}</strong><p style="color:#ddd">${esc(story.slice(0,120))}</p></div>`;};form.addEventListener('input',preview);form.addEventListener('change',preview);form.addEventListener('submit',submitDream);
    }
    bindCards();
  }
  const CREDIT_PACKS = {250:{name:'Pocket',price:19},500:{name:'Dreamer',price:35},1000:{name:'Voyager',price:59},2000:{name:'Astral',price:99}};
  function openDemoCheckout(amount){
    const pack=CREDIT_PACKS[amount]; if(!pack)return;
    $('#modal-content').innerHTML=`<section class="checkout-modal"><div class="checkout-brand"><span class="checkout-icon">✦</span><div><p class="eyebrow">DREAM TOKENS</p><h2>Complete your checkout</h2></div></div><div class="checkout-steps"><span class="current">01 · Order</span><span>02 · Payment</span><span>03 · Receipt</span></div><div class="checkout-order"><div><span class="checkout-label">Selected pack</span><h3>${pack.name} pack</h3><p>${amount.toLocaleString()} Dream Credits</p></div><strong>₹${pack.price}.00</strong></div><div class="checkout-summary"><div><span>Dream credits</span><b>${amount.toLocaleString()} ◈</b></div><div><span>Demo processing fee</span><b>₹0.00</b></div><div class="checkout-total"><span>Total (simulated)</span><strong>₹${pack.price}.00</strong></div></div><div class="demo-payment-method"><div class="demo-pay-logo">D</div><div><strong>DreamPay Demo</strong><small>Simulated payment · no real money</small></div><span class="demo-check">✓</span></div><p class="checkout-disclaimer">This is a fictional checkout for the college project. No card number, UPI PIN, or real payment information is requested or processed.</p><div class="checkout-actions"><button class="btn" id="checkout-cancel">Cancel</button><button class="btn primary" id="checkout-pay">Pay ₹${pack.price}.00 · Demo</button></div><p class="checkout-error" id="checkout-error" role="alert"></p></section>`;
    $('#modal').classList.remove('hidden');
    $('#checkout-cancel').onclick=()=>$('#modal').classList.add('hidden');
    $('#checkout-pay').onclick=async()=>{
      const pay=$('#checkout-pay');pay.disabled=true;pay.textContent='Verifying demo payment…';
      await new Promise(resolve=>setTimeout(resolve,1100));
      try{
        const r=await api('/profile/demo-topup',{method:'POST',body:JSON.stringify({amount})});
        state.user=r.user;state.profileStatus={spunToday:r.spunToday,todayReward:r.todayReward,events:r.events};
        $('#modal-content').innerHTML=`<section class="checkout-modal checkout-success"><div class="success-mark">✓</div><p class="eyebrow">PAYMENT SIMULATED SUCCESSFULLY</p><h2>Your dream wallet is topped up!</h2><p class="checkout-success-amount">+${amount.toLocaleString()} <span>◈ credits</span></p><div class="receipt-line"><span>Demo receipt</span><strong>DS-${Date.now().toString().slice(-8)}</strong></div><div class="receipt-line"><span>Payment method</span><strong>DreamPay Demo</strong></div><div class="receipt-line"><span>Amount</span><strong>₹${pack.price}.00 (simulated)</strong></div><p class="checkout-disclaimer">No real payment was made. Your demo credits have been added to your account.</p><button class="btn primary full" id="checkout-done">Back to my profile</button></section>`;
        $('#checkout-done').onclick=async()=>{ $('#modal').classList.add('hidden');state.tab='profile';await refresh();toast(`${amount.toLocaleString()} credits added to your wallet.`);};
      }catch(e){$('#checkout-error').textContent=e.message;pay.disabled=false;pay.textContent=`Pay ₹${pack.price}.00 · Demo`;}
    };
  }
  async function refresh(){const data=await api('/dreams');state.dreams=data.dreams;const mine=await api('/dreams/mine');state.mine=mine.dreams;const me=await api('/auth/me');state.user=me.user;try{state.profileStatus=await api('/profile/status')}catch{}render();}
  async function submitAuth(e){e.preventDefault();const form=e.currentTarget;const submit=$('#auth-submit');$('#auth-error').textContent='';submit.disabled=true;submit.textContent=state.authMode==='login'?'Entering…':'Creating account…';try{const data=await api(`/auth/${state.authMode}`,{method:'POST',body:JSON.stringify({username:form.username.value,password:form.password.value})});state.token=data.token;state.user=data.user;localStorage.setItem('dreamserver_token',state.token);state.tab='feed';await refresh();toast(state.authMode==='register'?'Welcome to the server. 500 credits added.':'Welcome back.');}catch(err){$('#auth-error').textContent=err.message;}finally{submit.disabled=false;submit.innerHTML='Enter the server <span>↗</span>';}}
  // Lightweight local writing aid: no LLM, no API request, and no external quota used.
  function makeStorySuggestion(rawTitle){
    const fixes={"ocen":"ocean","ocian":"ocean","staircae":"staircase","staircas":"staircase","libary":"library","libray":"library","forrest":"forest","forst":"forest","moutain":"mountain","mountan":"mountain","flyng":"flying","floting":"floating","underwter":"underwater","memmory":"memory","memorie":"memory","dorr":"door","dooor":"door","citty":"city","glas":"glass","desertt":"desert","nigth":"night","nite":"night","dreamm":"dream"};
    let title=rawTitle.replace(/\s+/g,' ').replace(/\b[\w']+\b/g,w=>fixes[w.toLowerCase()]||w);
    title=title.charAt(0).toUpperCase()+title.slice(1);
    const t=title.toLowerCase();
    let setting='a place that feels familiar, though you cannot remember ever visiting it';
    let event='As I explored, small details began to change whenever I looked away. I followed the strange feeling deeper, hoping to understand why this place seemed to know me.';
    if(/ocean|sea|underwater|water|jellyfish/.test(t)){setting='a silent city beneath a vast, moonlit ocean';event='I discovered a doorway beneath the waves and stepped into a city glowing under the sea. Fish drifted between the towers, and the water shimmered like a sky full of stars.';}
    else if(/door|portal|gate|entrance/.test(t)){setting='an impossible doorway standing where no doorway should exist';event='I found a door in a place I knew well, but it opened onto a world I had never seen. The air on the other side felt strangely familiar, and something beyond the threshold seemed to be waiting for me.';}
    else if(/city|glass|skyscraper|tower/.test(t)){setting='a dreamlike city of impossible towers and reflective streets';event='I wandered through a city whose glass towers reflected a sky that did not belong to this world. As the light changed, the streets rearranged themselves and a distant building began to glow.';}
    else if(/stair|stairs|sump|corridor|hallway/.test(t)){setting='a seemingly endless staircase hidden inside a silent building';event='I followed a staircase that spiralled far below the ground. Every landing looked almost familiar, but the lights flickered and the steps seemed to rearrange themselves behind me.';}
    else if(/library|book|page|letter/.test(t)){setting='a vast library filled with books that seemed to remember their readers';event='I entered a library where the shelves stretched beyond sight. A book opened by itself, revealing a story about a moment I had forgotten, and the room shifted as I began to read.';}
    else if(/train|station|railway/.test(t)){setting='a deserted train station suspended between moments in time';event='I boarded a train that had no destination on its display. Outside the window, scenes from different memories passed by, and at every stop I recognised something I could not quite name.';}
    else if(/forest|tree|woods|garden|flower/.test(t)){setting='a quiet, otherworldly garden beneath an unfamiliar sky';event='I walked through a garden where the plants glowed softly and the trees whispered in a language I almost understood. A narrow path appeared between the leaves, leading toward a light in the distance.';}
    else if(/fly|flying|sky|cloud|float/.test(t)){setting='a sky filled with drifting clouds and floating landscapes';event='I rose above the ground and drifted over a world of clouds and impossible architecture. There was no fear of falling; only the feeling that I was finally seeing a place from the right perspective.';}
    else if(/clock|time|memory|remember/.test(t)){setting='a strange place where time and memory seem to overlap';event='I noticed that the clocks were moving in different directions. Each sound brought back a half-remembered scene, until I realised the place was changing around the memories I chose to follow.';}
    else if(/nightmare|shadow|chase|dark|monster/.test(t)){setting='a dim, unfamiliar place where every shadow seems to move on its own';event='I felt something following me through the silent corridors. When I finally turned around, the shadows stopped moving, and I noticed a small light that had not been there before.';}
    else if(/moon|star|space|planet|galaxy/.test(t)){setting='a quiet landscape beneath an enormous sky filled with unfamiliar stars';event='I looked up and saw constellations rearranging themselves above me. A path of pale light appeared across the ground, leading toward a distant world that felt like a place I had dreamed of before.';}
    return `${event} The dream felt like ${setting}, and I woke with the sense that its meaning was just beyond reach.`;
  }
  async function submitDream(e){e.preventDefault();const form=e.currentTarget;const err=$('#dream-error');err.textContent='';const button=$('button[type="submit"]',form);button.disabled=true;button.textContent='Painting your dream…';try{const data=new FormData(form);const result=await api('/dreams',{method:'POST',body:JSON.stringify({title:data.get('title'),story:data.get('story'),mood:data.get('mood'),forSale:data.get('listing')==='1',price:Number(data.get('price')),rent:Number(data.get('rent'))})});await refresh();state.tab='mine';render();toast('Your dream has been painted and published.');}catch(error){err.textContent=error.message;}finally{button.disabled=false;button.textContent='Paint & publish dream ↗';}}
  const DEFAULT_VIDEO_MAP = {
    'flying over a glass city':'flying-over-glass-city.mp4',
    'the endless staircase':'endless-staircase.mp4',
    'tea in a lavender garden':'tea-in-lavender-garden.mp4',
    'underwater library':'underwater-library.mp4',
    'chased by a clock':'chased-by-a-clock.mp4',
    'the door nobody opened':'the-door-nobody-opened.mp4',
    'a train that stops in a memory':'train-in-a-memory.mp4',
    'the static sump':'the-static-sump.mp4',
    'the library of fallen leaves':'library-of-fallen-leaves.mp4',
    'the door at the end of the sea':'door-at-the-end-of-the-sea.mp4',
    'the city beneath the ocean':'city-beneath-the-ocean.mp4'
  };
  const normalizeDreamTitle = title => String(title || '').normalize('NFKC').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const DEFAULT_VIDEO_BY_TITLE = Object.fromEntries(Object.entries(DEFAULT_VIDEO_MAP).map(([title, file]) => [normalizeDreamTitle(title), file]));
  function isBuiltInDream(d){ return d.authorId == null && Boolean(DEFAULT_VIDEO_BY_TITLE[normalizeDreamTitle(d.title)]); }
  function openDreamViewer(d){
    const title=String(d.title||'Untitled dream');
    const story=String(d.story||'').trim();
    const titleKey=normalizeDreamTitle(title);
    const videoFile=isBuiltInDream(d) ? DEFAULT_VIDEO_BY_TITLE[titleKey] : null;
    if(videoFile){ openDefaultVideoViewer(d, videoFile); return; }
    openInteractiveDream(d);
  }
  const BUILT_IN_STORIES = {
    'flying over a glass city': [
      'I floated above a city made entirely of glass. Towers rose through the clouds like frozen waterfalls, and every surface caught the last gold light of sunset. Below me, streets shone with reflections of a sky that seemed deeper than the real one.',
      'I could not remember how I had started flying. There was no wind beneath me and no fear of falling; the city simply allowed me to drift between its buildings. In each tower, tiny scenes played behind the glass: a family at dinner, a child chasing paper birds, strangers waiting for a train that never arrived.',
      'As the sun slipped inside the tallest tower, the whole city glowed from within. I understood that I was not looking at buildings, but at memories people had tried to preserve. I followed one bright reflection toward the horizon, hoping to find the memory that belonged to me.'
    ],
    'the endless staircase': [
      'I found a staircase descending through a building with no visible outside. The steps were damp and worn in the middle, as if countless people had walked them before me. A pale light followed several floors below, always just out of reach.',
      'Every landing held a familiar object: a cup from my childhood kitchen, a schoolbag I had lost, a photograph with one face blurred away. The deeper I went, the more the building felt like a place assembled from forgotten moments. Behind me, the stairs vanished into darkness instead of leading back up.',
      'At last, the staircase opened onto a quiet room beneath a violet sky. There was no door, only a window looking out over the place where I had begun. I realised the descent had not taken me away from home; it had carried me through the memories I had left there.'
    ],
    'tea in a lavender garden': [
      'A small table waited in a lavender garden just after rain. Two cups of tea steamed beside a vase of flowers, though I was certain I had arrived alone. Bees drifted through the purple rows, and the air smelled like summer evenings I could almost remember.',
      'Across from me sat someone whose face changed whenever I tried to focus on it. We spoke without moving our mouths. Each time I lifted the cup, a memory surfaced: a goodbye at a station, laughter from an old kitchen, a promise I had made and never learned whether I kept.',
      'When the tea was gone, the stranger left a tiny lavender sprig on the table. I tucked it into my pocket, and the garden slowly dissolved into morning mist. After waking, I could still recall the warmth of the cup and the strange comfort of having been understood.'
    ],
    'underwater library': [
      'I entered a library beneath the sea through a round window in the ocean floor. Books floated in tall glass chambers, their pages turning in the current without becoming wet. Fish moved quietly between the shelves, flashing silver whenever they passed through a beam of blue light.',
      'A book drifted toward me and opened to a page describing a day I had forgotten. The words shifted as I read, revealing the sound of rain on a childhood window and the exact colour of a room I had not seen for years. Around me, the library seemed to be collecting memories that had slipped out of the waking world.',
      'At the deepest shelf, I found a book with my name on its spine. Its final page was blank. I understood that the library could return what I had lost, but it could not decide what I would remember next. I closed the book and watched a trail of bubbles lead toward the surface.'
    ],
    'chased by a clock': [
      'The clock appeared at the end of the street, taller than the buildings around it. Its hands spun in opposite directions, and every tick made the pavement tremble. I ran through alleys that rearranged themselves behind me while the sound of the clock grew louder.',
      'Whenever I stopped, time seemed to split into several versions of the same moment. A door opened onto a rainy afternoon; a bus carried the same passengers again and again; a stranger passed me and aged several decades before reaching the corner. The clock was not trying to catch me. It was gathering every moment I had hurried through without noticing.',
      'I finally turned and faced it. The ticking softened when I stood still, and a single second stretched into a quiet, endless room. For the first time, I had nowhere else to be. The street brightened, and the clock became small enough to fit in my palm.'
    ],
    'the door nobody opened': [
      'At the edge of a forest stood a narrow door with no wall around it. Its paint was cracked, and a warm line of light escaped from beneath it. I had passed this place many times in the dream, always telling myself I would return when I felt ready.',
      'This time, the handle turned easily. Beyond the door was not another room but a landscape that changed each time I blinked: a field beneath two moons, a hallway filled with rain, a shoreline where stars washed up like shells. The door seemed to open onto whatever I had been avoiding naming.',
      'I stepped back through and found the forest quieter than before. Nothing had forced me to enter, and nothing demanded that I stay. I left the door standing open behind me, no longer a mystery I had to solve, but a possibility I could choose to revisit.'
    ],
    'a train that stops in a memory': [
      'I boarded a nearly empty train just before dawn. Outside the windows, the landscape shifted between fields, apartment blocks and places I recognised without knowing from where. The destination display showed a date instead of a station name.',
      'When the train stopped, I stepped onto a platform from a day long ago. The air carried the smell of wet pavement, and someone I missed stood at the far end, unchanged by the years. We did not explain anything to one another. We simply walked together while the station lights flickered above us.',
      'A soft bell rang, and I knew the train could not wait forever. I returned to my seat carrying no object from the platform, only the feeling that the memory had finally been allowed to rest. When the doors closed, the date on the display faded into the pale light of morning.'
    ],
    'the static sump': [
      'A concrete stairwell spiralled down into a building that seemed to have no foundations. Fluorescent tubes buzzed overhead, flickering with the rhythm of distant voices. The walls were damp, and every landing looked almost exactly like the one above it.',
      'I searched for an exit, but the doors were only painted outlines. Somewhere below, water dripped into a deep pool, and the sound repeated with impossible precision. As I descended, the buzzing began to resemble a conversation I could nearly understand, as if the building were trying to tell me why I had come.',
      'At the bottom, the stairs ended at a shallow pool reflecting a bright open sky. I looked up and saw no ceiling, only clouds moving above the concrete. The noise stopped. For one still moment, the place that had felt like a trap became a passage, and I woke before choosing whether to climb back.'
    ],
    'the library of fallen leaves': [
      'I discovered a cathedral-sized library beneath a twilight sky. Its shelves were living trees, and every book was bound in leaves that rustled softly when I passed. Golden pages drifted down from branches and settled at my feet like autumn snow.',
      'Each leaf held a story in delicate veins: a conversation never finished, a journey taken by someone I would never meet, a small kindness forgotten by the person who gave it. The library had no librarian, but the trees leaned toward me as if they were waiting for me to choose one story to carry away.',
      'I selected a copper-coloured leaf and watched its words glow in my hand. It contained no grand revelation, only a quiet reminder of a day when I had helped someone without expecting anything back. When I left, the library continued shedding stories, certain that someone else would find them.'
    ],
    'the door at the end of the sea': [
      'I walked across the ocean floor as easily as if it were a quiet street. Above me, waves moved like glass ceilings, and distant whales passed through the blue darkness. Ahead stood a wooden door surrounded by pale coral, its frame untouched by the water.',
      'When I opened it, I found a city beneath the sea. Towers glimmered inside enormous air-filled domes, and windows shone with the warm light of homes. Strange fish drifted between the buildings like lanterns. The city felt familiar, though I had never seen it before.',
      'At the centre of the city, a fountain sent streams of water upward into a sky that did not exist. I realised the door was not an entrance to a hidden place but a threshold between what I knew and what I could imagine. I left it open as I walked deeper into the glowing streets.'
    ],
    'the city beneath the ocean': [
      'Far below the surface, an abandoned city stood beneath a deep blue ocean. Ancient towers rose through the mist, and tiny lights glimmered behind windows that should have been dark. A giant golden moon shone through the water, illuminating streets covered in pale sand.',
      'I followed a boulevard lined with statues whose faces had been worn smooth by the current. At the end of it, a vast plaza opened around a silent fountain. The water rose instead of falling, carrying bright fragments that looked like pieces of the night sky.',
      'A distant bell rang through the city, and every window lit at once. For a moment, I felt the presence of everyone who had ever lived there, not as ghosts but as warmth held in the stones. Then the lights dimmed one by one, leaving a single glowing doorway to guide me home.'
    ]
  };
  function openDefaultVideoViewer(d, videoFile){
    const access=d.authorId===state.user.id?'Created by you':d.owned?'In your collection':d.rented?'Rental active':'Shared dream';
    const videoSrc=`/assets/dream-videos/${encodeURIComponent(videoFile)}`;
    const titleKey=String(d.title||'').toLowerCase().replace(/\s+/g,' ').trim();
    const storyParagraphs=BUILT_IN_STORIES[titleKey]||[String(d.story||'').trim()||'The dream waits quietly for you to discover its meaning.'];
    const sentences=storyParagraphs.join(' ').match(/[^.!?]+[.!?]+|[^.!?]+$/g)||storyParagraphs;
    const chapterNames=['The arrival','Something shifts','The discovery','The way back'];
    const chapters=Array.from({length:4},(_,i)=>{
      const start=Math.floor(i*sentences.length/4), end=Math.floor((i+1)*sentences.length/4);
      const text=sentences.slice(start,end).join(' ').trim();
      return {name:chapterNames[i],text:text||storyParagraphs[Math.min(i,storyParagraphs.length-1)]||'The dream continues beyond what can be remembered.'};
    });
    let chapterIndex=0;
    const renderChapter=()=>{
      const chapter=chapters[chapterIndex];
      const isLast=chapterIndex===chapters.length-1;
      const panel=$('.viewer-story-panel');
      if(!panel)return;
      panel.innerHTML=`<p class="eyebrow">DREAM EXPERIENCE · ${esc(access.toUpperCase())}</p><h2>${esc(d.title)}</h2><p class="viewer-byline">A dream by ${esc(d.author||'Unknown dreamer')}</p><div class="viewer-story" aria-label="Interactive four-part written dream story"><h3>The story · ${String(chapterIndex+1).padStart(2,'0')} / 04</h3><div class="scene-progress" aria-label="Story progress">${chapters.map((_,i)=>`<span class="${i<=chapterIndex?'done':''}"></span>`).join('')}</div><section class="story-chapter active-chapter"><div class="story-chapter-heading"><span>${String(chapterIndex+1).padStart(2,'0')}</span><h4>${esc(chapter.name)}</h4></div><p>${esc(chapter.text)}</p></section></div><div class="viewer-controls"><button class="btn primary" id="story-next">${isLast?'↻ Read story again':'Continue deeper ↗'}</button><button class="btn" id="viewer-close">Return to the server</button></div><p class="viewer-note">The video loops quietly while you move through the story.</p>`;
      $('#story-next').onclick=()=>{chapterIndex=isLast?0:chapterIndex+1;renderChapter();};
      $('#viewer-close').onclick=()=>{const video=$('#dream-video');if(video)video.pause();$('#modal').classList.add('hidden');};
    };
    $('#modal-content').innerHTML=`<div class="dream-viewer video-dream-viewer"><div class="viewer-video-wrap"><video id="dream-video" class="viewer-video" src="${videoSrc}" autoplay muted loop playsinline disablepictureinpicture controlslist="nodownload noplaybackrate nofullscreen" preload="metadata" aria-label="Looping dream video: ${esc(d.title)}"></video><div class="viewer-video-overlay"><span class="viewer-mood">${esc(d.mood||'Dream')}</span><p>STEP INTO THE DREAM</p></div></div><div class="viewer-copy viewer-story-panel"></div></div>`;
    $('#modal').classList.remove('hidden');
    const video=$('#dream-video');
    video.removeAttribute('controls');
    video.dataset.dreamTitle = normalizeDreamTitle(d.title);
    video.pause();
    video.removeAttribute('src');
    video.src = videoSrc;
    video.load();
    video.addEventListener('error',()=>{
      const wrap=$('.viewer-video-wrap');
      if(wrap&&!wrap.querySelector('.video-missing-note')){
        const note=document.createElement('p');note.className='video-missing-note';note.textContent=`Video file not found: ${videoFile}. Add it to public/assets/dream-videos/. The written story is still available.`;wrap.appendChild(note);
      }
    },{once:true});
    renderChapter();
    video.play().catch(()=>{});
  }
  function buildDreamScenes(d){
    const t=String(d.title||'this dream').toLowerCase();
    const s=String(d.story||'').trim();
    let scene2='A quiet detail begins to move. The place seems to recognise you, as if you have been here before.';
    let options=[
      {label:'Follow the strange light',text:'You follow the light. It grows warmer, and the world rearranges itself around a path you had not noticed before.'},
      {label:'Stay still and listen',text:'You stop moving. Beneath the silence, you hear a small sound that gives the place a new meaning.'}
    ];
    if(/ocean|sea|underwater|water|jellyfish/.test(t+' '+s)){
      scene2='The water shimmers around you. Far below, a trail of lights flickers between silent towers.';
      options=[{label:'Dive toward the lights',text:'You descend through a curtain of bubbles. A submerged street opens beneath you, and every window glows like a remembered star.'},{label:'Touch the floating doorway',text:'The doorway ripples beneath your hand. Beyond it, the sea becomes a sky full of slow-moving constellations.'}];
    } else if(/stair|stairs|sump|door|library|book|leaves/.test(t+' '+s)){
      scene2='The architecture shifts while you watch. A doorway appears where there was only shadow a moment ago.';
      options=[{label:'Step through the doorway',text:'You cross the threshold. The air changes, and a new landscape unfolds as though the dream has been waiting for you to choose.'},{label:'Keep exploring the old passage',text:'You follow the passage deeper. Small details from the opening scene return, but each one now seems to hold a hidden message.'}];
    } else if(/train|memory|city|glass|clock/.test(t+' '+s)){
      scene2='The horizon bends. Familiar shapes drift past, but one detail stays perfectly still: a path leading away from everything you know.';
      options=[{label:'Follow the impossible path',text:'You leave the familiar scene behind. The path carries you into a place stitched together from light, memory and impossible geometry.'},{label:'Return to the moment you remember',text:'You look back and notice a small change. The memory has softened; now there is room for something new to happen.'}];
    }
    return [
      {kicker:'SCENE 01 · ARRIVAL',heading:'The dream begins',text:s||'You arrive somewhere between memory and imagination. The air is still, and the world is waiting.'},
      {kicker:'SCENE 02 · THE SHIFT',heading:'Something changes',text:scene2},
      {kicker:'SCENE 03 · YOUR CHOICE',heading:'Where will you go?',text:'The dream pauses at the edge of possibility. There is no wrong answer; choose the path you want to remember.',choices:options},
      {kicker:'SCENE 04 · REVEAL',heading:'The dream remembers you',text:''}
    ];
  }
  function openInteractiveDream(d){
    const scenes=buildDreamScenes(d);let index=0;let ending='';
    const access=d.authorId===state.user.id?'Created by you':d.owned?'In your collection':d.rented?'Rental active':'Shared dream';
    const renderScene=()=>{
      const scene=scenes[index];
      const isEnding=index===3;
      const body=isEnding?ending:scene.text;
      const controls=index===0?'<button class="btn primary" id="scene-next">Enter the dream ↗</button>':index===1?'<button class="btn primary" id="scene-next">Continue deeper ↗</button>':index===2?scene.choices.map((c,i)=>`<button class="btn primary choice-btn" data-choice="${i}">${esc(c.label)}</button>`).join(''): '<button class="btn primary" id="scene-restart">↻ Dream again</button>';
      $('#modal-content').innerHTML=`<div class="interactive-dream"><div class="interactive-art" style="--scene-index:${index}"><img src="${esc(d.imageUrl||'')}" alt="Dream artwork for ${esc(d.title)}"><div class="interactive-art-shade"></div><span class="viewer-mood">${esc(d.mood||'Dream')}</span><span class="scene-counter">${String(index+1).padStart(2,'0')} / 04</span><div class="art-caption"><p class="eyebrow">${esc(scene.kicker)}</p><h2>${esc(scene.heading)}</h2></div></div><div class="interactive-copy"><p class="eyebrow">DREAM EXPERIENCE · ${esc(access.toUpperCase())}</p><h2>${esc(d.title)}</h2><div class="scene-progress">${scenes.map((_,i)=>`<span class="${i<=index?'done':''}"></span>`).join('')}</div><p class="scene-narration">${esc(body)}</p><div class="viewer-controls">${controls}<button class="btn" id="viewer-close">Return to the server</button></div><p class="viewer-note">A small interactive dream made from this story. Your choices change the scene and ending; no extra API is needed.</p>${d.imageCredit?`<p class="image-credit">Artwork: <a href="${esc(d.imageSourceUrl||'#')}" target="_blank" rel="noopener noreferrer">${esc(d.imageCredit)}</a>${d.imageLicense?` · ${esc(d.imageLicense)}`:''}</p>`:''}</div></div>`;
      $('#viewer-close').onclick=()=>$('#modal').classList.add('hidden');
      const next=$('#scene-next');if(next)next.onclick=()=>{index=Math.min(index+1,3);renderScene();};
      $$('[data-choice]').forEach(b=>b.onclick=()=>{const chosen=scenes[2].choices[Number(b.dataset.choice)];ending=chosen?chosen.text:'The dream fades into a quiet, golden light.';index=3;renderScene();});
      const restart=$('#scene-restart');if(restart)restart.onclick=()=>{index=0;ending='';renderScene();};
    };
    $('#modal').classList.remove('hidden');renderScene();
  }
  function bindCards(){
    $$('[data-delete-dream]').forEach(b=>b.onclick=async()=>{
      const id=Number(b.dataset.deleteDream);
      const dream=state.dreams.find(d=>d.id===id);
      if(!confirm(`Delete "${dream?.title || 'this dream'}"? This cannot be undone.`))return;
      b.disabled=true;
      try{
        const result=await api(`/dreams/${id}`,{method:'DELETE'});
        await refresh();
        state.tab='mine';
        render();
        toast(result.message||'Dream deleted.');
      }catch(e){toast(e.message);b.disabled=false;}
    });
    $$('[data-like]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api(`/dreams/${b.dataset.like}/resonate`,{method:'POST',body:'{}'});await refresh();}catch(e){toast(e.message);}finally{b.disabled=false;}});
    $$('[data-buy]').forEach(b=>b.onclick=async()=>{if(!confirm('Buy this dream with credits?'))return;b.disabled=true;try{const r=await api(`/dreams/${b.dataset.buy}/buy`,{method:'POST',body:'{}'});await refresh();toast(`${r.message} Remaining credits: ${r.credits}.`);}catch(e){toast(e.message);b.disabled=false;}});
    $$('[data-rent]').forEach(b=>b.onclick=async()=>{if(!confirm('Rent this dream for seven days?'))return;b.disabled=true;try{const r=await api(`/dreams/${b.dataset.rent}/rent`,{method:'POST',body:'{}'});await refresh();toast(`${r.message} Remaining credits: ${r.credits}.`);}catch(e){toast(e.message);b.disabled=false;}});
    $$('[data-watch]').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.watch);const d=state.dreams.find(x=>x.id===id)||state.mine.find(x=>x.id===id);if(d)openDreamViewer(d);});
    $$('[data-image]').forEach(img=>img.onclick=()=>{const d=state.dreams.find(x=>x.id===Number(img.dataset.image))||state.mine.find(x=>x.id===Number(img.dataset.image));if(!d)return;$('#modal-content').innerHTML=`<img src="${esc(d.imageUrl)}" alt="${esc(d.title)}"><h2>${esc(d.title)}</h2><p>${esc(d.story)}</p>${d.imageCredit?`<p class="image-credit">Artwork: <a href="${esc(d.imageSourceUrl||'#')}" target="_blank" rel="noopener noreferrer">${esc(d.imageCredit)}</a>${d.imageLicense?` · ${esc(d.imageLicense)}`:''}</p>`:''}`;$('#modal').classList.remove('hidden');});
    const gen=$('#generate-ai');if(gen)gen.onclick=async()=>{gen.disabled=true;gen.textContent='The server is dreaming…';try{await api('/dreams/ai',{method:'POST',body:'{}'});await refresh();state.tab='ai';render();toast('A new unclaimed dream has appeared.');}catch(e){toast(e.message);gen.disabled=false;gen.textContent='☾ Let the server dream';}};
  }
  $$('.auth-tab').forEach(b=>b.addEventListener('click',()=>{state.authMode=b.dataset.auth;$$('.auth-tab').forEach(x=>x.classList.toggle('active',x===b));$('#auth-submit').innerHTML=state.authMode==='login'?'Enter the server <span>↗</span>':'Create account <span>↗</span>';$('#auth-form input[name="password"]').autocomplete=state.authMode==='login'?'current-password':'new-password';$('#auth-error').textContent='';}));
  $('#auth-form').addEventListener('submit',submitAuth);$('#user-chip').addEventListener('click',()=>{state.profileSection='created';state.tab='profile';render();});$$('.tab').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;render();}));
  $('#logout').addEventListener('click',()=>{state.token='';state.user=null;localStorage.removeItem('dreamserver_token');showAuth();toast('You have logged out.');});
  const closeModal=()=>{const video=$('#dream-video');if(video)video.pause();$('#modal').classList.add('hidden');};$('#modal-close').addEventListener('click',closeModal);$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  async function start(){if(!state.token){showAuth();return;}try{await refresh();}catch{showAuth();}}
  start();
})();
