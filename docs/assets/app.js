(() => {
  const cfg = window.AGUA_CONFIG || {};
  const demo = !!cfg.demoMode || !cfg.supabaseUrl || cfg.supabaseUrl.includes('COLE_AQUI') || !cfg.supabaseKey || cfg.supabaseKey.includes('COLE_AQUI');
  const sb = demo ? null : window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cfg.currency || 'BRL' });
  const state = { products: [], cart: new Map(), payment: 'pix', profile: {}, order: null, screen: 1, trackingTimer: null };
  const DEMO_PRODUCTS = [
    {id:1,name:'Água 20 Litros',description:'Garrafão retornável',price:6,image_url:null},
    {id:2,name:'Água 10 Litros',description:'Galão retornável',price:4,image_url:null},
    {id:3,name:'Fardo 500ml',description:'Pacote com 12 unidades',price:8,image_url:null}
  ];
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const toast = (m) => { const el=$('#toast'); el.textContent=m; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600); };
  const normalizePhone = s => String(s||'').replace(/\D/g,'');
  const moneyInput = s => Number(String(s||'').replace(/\./g,'').replace(',','.').replace(/[^0-9.]/g,'')) || null;
  const paymentLabel = p => ({pix:'PIX',dinheiro:'Dinheiro',cartao_entrega:'Cartão na entrega'})[p] || p;

  function setScreen(n){
    state.screen=n; $$('.screen').forEach(x=>x.classList.toggle('active',Number(x.dataset.screen)===n));
    $$('.step').forEach((x,i)=>{const k=i+1;x.classList.toggle('active',k===n);x.classList.toggle('done',k<n)});
    window.scrollTo({top:0,behavior:'smooth'});
    if(n===3) renderReview();
  }
  function totals(){ let count=0,total=0; for(const [id,q] of state.cart){const p=state.products.find(x=>Number(x.id)===Number(id));if(p){count+=q;total+=Number(p.price)*q}} return {count,total}; }
  function renderProducts(){
    const host=$('#products');host.innerHTML='';
    state.products.forEach(p=>{const q=state.cart.get(Number(p.id))||0;const card=document.createElement('article');card.className='product-card';card.innerHTML=`<div class="product-art">💧</div><div><h3>${esc(p.name)}</h3><p>${esc(p.description||'')}</p><strong class="price">${fmt.format(Number(p.price))}</strong></div><div class="qty"><button aria-label="Diminuir">−</button><strong>${q}</strong><button aria-label="Aumentar">+</button></div>`; const [minus,plus]=card.querySelectorAll('button'); minus.onclick=()=>changeQty(Number(p.id),-1);plus.onclick=()=>changeQty(Number(p.id),1);host.appendChild(card)});
    renderCart();
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  function changeQty(id,d){const q=Math.max(0,Math.min(99,(state.cart.get(id)||0)+d));if(q)state.cart.set(id,q);else state.cart.delete(id);renderProducts();}
  function renderCart(){const t=totals();$('#cartCount').textContent=`${t.count} ${t.count===1?'item':'itens'}`;$('#cartTotal').textContent=fmt.format(t.total);$('#goDelivery').disabled=t.count===0;}
  function renderReview(){const host=$('#reviewItems');host.innerHTML='';for(const [id,q] of state.cart){const p=state.products.find(x=>Number(x.id)===Number(id));if(!p)continue;const row=document.createElement('div');row.className='review-item';row.innerHTML=`<div><strong>${q}x ${esc(p.name)}</strong><br><span>${fmt.format(Number(p.price))} cada</span></div><strong>${fmt.format(Number(p.price)*q)}</strong>`;host.appendChild(row)} const t=totals();$('#reviewTotal').textContent=fmt.format(t.total);const a=state.profile;$('#reviewAddress').textContent=`${a.street}, ${a.number} — ${a.neighborhood}${a.complement?', '+a.complement:''}`;}
  async function loadProducts(){
    if(demo){state.products=DEMO_PRODUCTS;renderProducts();return;}
    const {data,error}=await sb.from('web_products').select('id,name,description,price,image_url,sort_order').eq('active',true).order('sort_order').order('id');
    if(error){toast('Não foi possível carregar os produtos.');console.error(error);return} state.products=data||[];renderProducts();
  }
  async function loadProfile(){
    const token=localStorage.getItem('agua_client_token');if(!token||demo)return;
    const {data,error}=await sb.rpc('get_web_profile',{p_client_token:token}); if(error||!data)return;
    for(const [k,id] of Object.entries({name:'#name',whatsapp:'#whatsapp',street:'#street',number:'#number',neighborhood:'#neighborhood',complement:'#complement',reference:'#reference'})){if(data[k])$(id).value=data[k]}
  }
  function captureProfile(){return {name:$('#name').value.trim(),whatsapp:normalizePhone($('#whatsapp').value),street:$('#street').value.trim(),number:$('#number').value.trim(),neighborhood:$('#neighborhood').value.trim(),complement:$('#complement').value.trim(),reference:$('#reference').value.trim()};}
  function validProfile(p){if(p.name.length<2)return 'Informe seu nome.';if(p.whatsapp.length<10)return 'Informe um WhatsApp válido.';if(!p.street||!p.number||!p.neighborhood)return 'Preencha rua, número e bairro.';return null;}
  async function placeOrder(){
    const btn=$('#placeOrder');btn.disabled=true;btn.textContent='Enviando…';
    try{
      const t=totals(); if(!t.count)throw new Error('Seu carrinho está vazio.');
      const items=[...state.cart].map(([product_id,quantity])=>({product_id,quantity}));
      let result;
      if(demo){result={order_id:1053,public_token:crypto.randomUUID(),client_token:localStorage.getItem('agua_client_token')||crypto.randomUUID(),total:t.total,status:'recebido',created_at:new Date().toISOString()};}
      else{
        const args={p_client_token:localStorage.getItem('agua_client_token')||null,p_name:state.profile.name,p_whatsapp:state.profile.whatsapp,p_street:state.profile.street,p_number:state.profile.number,p_neighborhood:state.profile.neighborhood,p_complement:state.profile.complement||null,p_reference:state.profile.reference||null,p_payment_method:state.payment,p_change_for:state.payment==='dinheiro'?moneyInput($('#changeFor').value):null,p_items:items};
        const {data,error}=await sb.rpc('place_web_order',args);if(error)throw error;result=data;
      }
      localStorage.setItem('agua_client_token',result.client_token);localStorage.setItem('agua_last_order_token',result.public_token);state.order={...result,name:state.profile.name,payment_method:state.payment,total:Number(result.total)};showSuccess();setScreen(4);startTracking();
    }catch(e){console.error(e);toast(e.message||'Não foi possível enviar o pedido.');}finally{btn.disabled=false;btn.textContent='Confirmar pedido';}
  }
  function showSuccess(){const o=state.order;$('#orderNumber').textContent=`Pedido #${o.order_id}`;$('#successTotal').textContent=fmt.format(Number(o.total));$('#successPayment').textContent=paymentLabel(o.payment_method);$('#successName').textContent=o.name||state.profile.name;renderTimeline(o.status||'recebido');}
  const statuses=[['recebido','Pedido recebido'],['aceito','Aceito pelo depósito'],['preparando','Preparando'],['saiu_entrega','Saiu para entrega'],['entregue','Entregue']];
  function renderTimeline(status){let current=statuses.findIndex(x=>x[0]===status);if(current<0)current=0;const host=$('#timeline');host.innerHTML='';statuses.forEach((s,i)=>{const el=document.createElement('div');el.className='timeline-step '+(i<current?'done':i===current?'active':'');el.innerHTML=`<div class="timeline-dot">${i<current?'✓':i+1}</div><div><strong>${s[1]}</strong><small>${i<current?'Concluído':i===current?'Status atual':'Aguardando'}</small></div>`;host.appendChild(el)});}
  async function refreshTracking(){if(!state.order||demo)return;const {data,error}=await sb.rpc('track_web_order',{p_public_token:state.order.public_token});if(error||!data)return;state.order.status=data.status;state.order.total=Number(data.total);renderTimeline(data.status);$('#trackingUpdated').textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
  function startTracking(){clearInterval(state.trackingTimer);refreshTracking();state.trackingTimer=setInterval(refreshTracking,Number(cfg.trackingRefreshMs)||8000);}

  $('#storeName').textContent=(cfg.storeName||'Águas de Maria').toUpperCase();
  $('#connectionBanner').textContent=demo?'Modo demonstração — conecte o Supabase quando quiser.':'Conectado ao sistema de pedidos.';$('#connectionBanner').classList.toggle('demo',demo);
  $('#goDelivery').onclick=()=>setScreen(2);
  $$('[data-back]').forEach(b=>b.onclick=()=>setScreen(Number(b.dataset.back)));
  $('#deliveryForm').onsubmit=e=>{e.preventDefault();const p=captureProfile();const er=validProfile(p);if(er)return toast(er);state.profile=p;setScreen(3)};
  $$('.pay-option').forEach(b=>b.onclick=()=>{$$('.pay-option').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.payment=b.dataset.payment;$('#changeBox').classList.toggle('hidden',state.payment!=='dinheiro')});
  $('#placeOrder').onclick=placeOrder;
  $('#newOrder').onclick=()=>{state.cart.clear();state.order=null;clearInterval(state.trackingTimer);renderProducts();setScreen(1)};
  $('#whatsapp').addEventListener('input',e=>{let d=e.target.value.replace(/\D/g,'').slice(0,11);if(d.length>2)d=`(${d.slice(0,2)}) ${d.slice(2)}`;if(d.replace(/\D/g,'').length>7){const raw=d.replace(/\D/g,'');d=`(${raw.slice(0,2)}) ${raw.slice(2,raw.length-4)}-${raw.slice(-4)}`}e.target.value=d});
  loadProducts();loadProfile();
})();
