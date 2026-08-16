
(function(){
  "use strict";

  // ---------- state ----------
  let elements = [];
  let selectedId = null;
  let zoom = 1;
  let history = [];
  let historyIndex = -1;
  let idCounter = 1;
  let clipboard = null;
  let dirty = false;
  let gridOn = false;
  const GRID_SIZE = 20;
  const SWATCHES = ['#3d5afe','#c6ff3d','#ff5c72','#ffb74d','#4dd0e1','#ba68c8','#ffffff','#101014','#8c8c98','#00c853'];

  const stage = document.getElementById('stage');
  const canvasarea = document.getElementById('canvasarea');
  const layerlist = document.getElementById('layerlist');
  const propsContent = document.getElementById('props-content');
  const zoomval = document.getElementById('zoomval');
  const selreadout = document.getElementById('selreadout');
  const ctxmenu = document.getElementById('ctxmenu');
  const unsavedDot = document.getElementById('unsaved-dot');

  const FONTS = ['Inter','Space Grotesk','Playfair Display','Poppins','JetBrains Mono','Georgia','Arial'];

  function uid(){ return 'el_' + (idCounter++) + '_' + Math.random().toString(36).slice(2,7); }
  function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>t.classList.remove('show'), 1600);
  }
  function markDirty(){ dirty = true; unsavedDot.classList.add('show'); }
  function markClean(){ dirty = false; unsavedDot.classList.remove('show'); }

  // ---------- history ----------
  function snapshot(){
    const snap = JSON.stringify({elements, selectedId, bg:stage.dataset.bg, cw:stage.dataset.w, ch:stage.dataset.h});
    history = history.slice(0, historyIndex+1);
    history.push(snap);
    historyIndex = history.length-1;
    if(history.length > 120){ history.shift(); historyIndex--; }
    updateHistButtons();
    markDirty();
  }
  function undo(){ if(historyIndex <= 0) return; historyIndex--; restore(history[historyIndex]); }
  function redo(){ if(historyIndex >= history.length-1) return; historyIndex++; restore(history[historyIndex]); }
  function restore(snap){
    const d = JSON.parse(snap);
    elements = d.elements; selectedId = d.selectedId;
    if(d.cw && d.ch){ setCanvasSize(+d.cw, +d.ch, false); }
    stage.style.background = d.bg; stage.dataset.bg = d.bg;
    renderAll(); updateHistButtons();
  }
  function updateHistButtons(){
    document.getElementById('btn-undo').disabled = historyIndex <= 0;
    document.getElementById('btn-redo').disabled = historyIndex >= history.length-1;
  }

  // ---------- element factory ----------
  function addElement(type, opts){
    opts = opts || {};
    const base = {
      id: uid(), type, x: 300, y: 200, w: 160, h: 100, rot: 0,
      fill: type==='text' ? 'transparent' : '#3d5afe',
      stroke: '#000000', strokeW: 0, strokeStyle:'solid', opacity: 1, hidden:false, locked:false, anim:'none',
      radius: 4, shadow:false, shadowColor:'#000000', shadowBlur:16,
      flipH:false, flipV:false,
      fillType:'solid', fillTo:'#c6ff3d', gradientAngle:135,
      name: type.charAt(0).toUpperCase()+type.slice(1)+' '+idCounter
    };
    if(type==='text'){
      Object.assign(base, {w:220,h:50, text:'Double-click to edit', fontSize:22, bold:false, italic:false, color:'#111111', align:'left', fontFamily:'Inter'});
    }
    if(type==='image'){ Object.assign(base, {w:220,h:160, fill:'transparent', grayscale:0, brightness:100, blur:0}); }
    Object.assign(base, opts);
    elements.push(base);
    selectedId = base.id;
    renderAll();
    snapshot();
    return base;
  }

  document.querySelectorAll('.add-btn[data-add]').forEach(b=>{
    b.addEventListener('click', ()=> addElement(b.dataset.add));
  });
  document.getElementById('btn-upload').addEventListener('click', ()=> document.getElementById('fileinput').click());
  document.getElementById('fileinput').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      addElement('image', {src: reader.result, x:300, y:180, w:240, h:180, name:'Image '+idCounter});
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  // ---------- canvas size ----------
  function setCanvasSize(w,h, snap){
    stage.style.width = w+'px';
    stage.style.height = h+'px';
    stage.dataset.w = w; stage.dataset.h = h;
    if(snap!==false) snapshot();
  }
  // ---------- project name ----------
  const projectNameInput = document.getElementById('project-name');
  projectNameInput.addEventListener('change', ()=>{
    document.title = 'Kanvas · ' + (projectNameInput.value || 'Untitled project');
  });
  projectNameInput.addEventListener('input', markDirty);

  // ---------- grid ----------
  const gridOverlay = document.getElementById('grid-overlay');
  function paintGrid(){
    gridOverlay.style.backgroundImage = `linear-gradient(to right, rgba(61,90,254,.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(61,90,254,.35) 1px, transparent 1px)`;
    gridOverlay.style.backgroundSize = `${GRID_SIZE}px ${GRID_SIZE}px`;
  }
  paintGrid();
  document.getElementById('btn-grid').addEventListener('click', (e)=>{
    gridOn = !gridOn;
    stage.classList.toggle('show-grid', gridOn);
    e.currentTarget.classList.toggle('primary', gridOn);
    toast(gridOn ? 'Grid & snap on' : 'Grid & snap off');
  });
  function snapToGridVal(v){ return Math.round(v/GRID_SIZE)*GRID_SIZE; }

  document.getElementById('canvas-preset').addEventListener('change', (e)=>{
    const [w,h] = e.target.value.split('x').map(Number);
    setCanvasSize(w,h);
    toast(`Canvas ${w}×${h}`);
    fitZoom();
  });

  // ---------- rendering ----------
  function clearStageEls(){
    stage.querySelectorAll('.kel').forEach(n=>n.remove());
  }
  function renderAll(){
    clearStageEls();
    elements.forEach(el => stage.appendChild(buildElNode(el)));
    renderLayers();
    renderProps();
    updateSelReadout();
  }

  function transformStr(el){
    let t = `rotate(${el.rot}deg)`;
    if(el.flipH) t += ' scaleX(-1)';
    if(el.flipV) t += ' scaleY(-1)';
    return t;
  }

  function buildElNode(el){
    const node = document.createElement('div');
    node.className = 'kel' + (el.id===selectedId ? ' selected':'');
    node.dataset.id = el.id;
    node.dataset.locked = !!el.locked;
    node.style.left = el.x+'px';
    node.style.top = el.y+'px';
    node.style.width = el.w+'px';
    node.style.height = el.h+'px';
    node.style.transform = transformStr(el);
    node.style.opacity = el.opacity;
    node.style.display = el.hidden ? 'none' : 'block';
    node.style.zIndex = elements.indexOf(el)+1;

    if(el.anim && el.anim !== 'none'){
      node.style.animation = `k-${el.anim} .7s ease both`;
    }

    if(el.type === 'rect' || el.type === 'ellipse'){
      const fillDiv = document.createElement('div');
      fillDiv.className = 'box-fill';
      fillDiv.style.background = el.fillType==='gradient'
        ? `linear-gradient(${el.gradientAngle}deg, ${el.fill}, ${el.fillTo})`
        : el.fill;
      fillDiv.style.border = el.strokeW>0 ? `${el.strokeW}px ${el.strokeStyle||'solid'} ${el.stroke}` : 'none';
      fillDiv.style.borderRadius = el.type==='ellipse' ? '50%' : (el.radius||0)+'px';
      if(el.shadow){ fillDiv.style.boxShadow = `0 6px ${el.shadowBlur}px 0 ${hexToRgba(el.shadowColor,0.55)}`; }
      node.appendChild(fillDiv);
    } else if(el.type === 'text'){
      const t = document.createElement('div');
      t.className = 'kel-text';
      t.contentEditable = false;
      t.style.fontSize = el.fontSize+'px';
      t.style.fontWeight = el.bold ? '700':'400';
      t.style.fontStyle = el.italic ? 'italic':'normal';
      t.style.color = el.color;
      t.style.fontFamily = `'${el.fontFamily||'Inter'}',sans-serif`;
      t.style.textAlign = el.align||'left';
      t.style.justifyContent = el.align==='center'?'center':(el.align==='right'?'flex-end':'flex-start');
      t.style.width = '100%';
      t.textContent = el.text;
      t.addEventListener('dblclick', (e)=>{
        e.stopPropagation();
        t.contentEditable = true;
        t.style.pointerEvents = 'auto';
        t.focus();
        document.execCommand('selectAll', false, null);
      });
      t.addEventListener('blur', ()=>{
        t.contentEditable = false;
        const newText = t.textContent;
        const target = elements.find(e2=>e2.id===el.id);
        if(target && target.text !== newText){ target.text = newText; snapshot(); }
      });
      t.addEventListener('mousedown', (e)=>{ if(t.contentEditable==='true') e.stopPropagation(); });
      node.appendChild(t);
    } else if(el.type === 'image'){
      const img = document.createElement('img');
      img.src = el.src;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = (el.radius||0)+'px';
      img.style.filter = `grayscale(${el.grayscale||0}%) brightness(${el.brightness||100}%) blur(${el.blur||0}px)`;
      img.style.pointerEvents = 'none';
      img.draggable = false;
      node.appendChild(img);
    }

    if(el.id === selectedId && !el.locked){
      ['nw','ne','sw','se'].forEach(pos=>{
        const h = document.createElement('div');
        h.className = 'handle h-'+pos;
        h.dataset.resize = pos;
        node.appendChild(h);
      });
      const rot = document.createElement('div');
      rot.className = 'handle rot';
      rot.dataset.rotate = '1';
      node.appendChild(rot);
    }

    node.addEventListener('mousedown', (e)=> onElMouseDown(e, el.id));
    node.addEventListener('contextmenu', (e)=>{ e.preventDefault(); e.stopPropagation(); selectedId = el.id; renderAll(); openCtxMenu(e.clientX, e.clientY); });
    return node;
  }

  function hexToRgba(hex, a){
    const h = hex.replace('#','');
    const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function updateSelReadout(){
    const el = elements.find(e=>e.id===selectedId);
    selreadout.textContent = el ? `${el.name} · ${Math.round(el.w)}×${Math.round(el.h)}` : 'nothing selected';
  }

  // ---------- layers panel ----------
  function renderLayers(){
    layerlist.innerHTML = '';
    for(let i = elements.length-1; i>=0; i--){
      const el = elements[i];
      const row = document.createElement('div');
      row.className = 'layer-item' + (el.id===selectedId?' active':'') + (el.hidden?' hidden-layer':'');
      row.innerHTML = `
        <span class="lreorder"><span data-up>▲</span><span data-down>▼</span></span>
        <span class="licon eye" title="Show/hide">${el.hidden ? '🚫' : '👁'}</span>
        <span class="lname" title="Double-click to rename">${el.name}</span>
        <span class="licon lock" title="Lock/unlock">${el.locked ? '🔒' : '🔓'}</span>
      `;
      row.addEventListener('click', (e)=>{
        if(e.target.dataset.up !== undefined){ reorder(el.id, 'up'); return; }
        if(e.target.dataset.down !== undefined){ reorder(el.id, 'down'); return; }
        if(e.target.classList.contains('eye')){ el.hidden = !el.hidden; renderAll(); snapshot(); return; }
        if(e.target.classList.contains('lock')){ el.locked = !el.locked; renderAll(); snapshot(); return; }
        selectedId = el.id; renderAll();
      });
      const lname = row.querySelector('.lname');
      lname.addEventListener('dblclick', (e)=>{
        e.stopPropagation();
        lname.contentEditable = true;
        lname.focus();
        document.execCommand('selectAll', false, null);
      });
      lname.addEventListener('blur', ()=>{
        lname.contentEditable = false;
        const newName = lname.textContent.trim() || el.name;
        if(newName !== el.name){ el.name = newName; snapshot(); }
        renderLayers();
      });
      lname.addEventListener('mousedown', (e)=>{ if(lname.contentEditable==='true') e.stopPropagation(); });
      layerlist.appendChild(row);
    }
  }

  function reorder(id, dir){
    const idx = elements.findIndex(e=>e.id===id);
    if(idx<0) return;
    if(dir==='up' && idx < elements.length-1){ [elements[idx],elements[idx+1]] = [elements[idx+1],elements[idx]]; }
    if(dir==='down' && idx > 0){ [elements[idx],elements[idx-1]] = [elements[idx-1],elements[idx]]; }
    if(dir==='front'){ const [e] = elements.splice(idx,1); elements.push(e); }
    if(dir==='back'){ const [e] = elements.splice(idx,1); elements.unshift(e); }
    renderAll();
    snapshot();
  }

  // ---------- properties panel ----------
  function renderProps(){
    const el = elements.find(e=>e.id===selectedId);
    if(!el){
      propsContent.innerHTML = `<div id="empty-props">Select an element on the canvas,<br>or add one from the left panel,<br>to edit its properties.</div>` + bgGroupHTML();
      wireBgGroup();
      return;
    }
    let html = '';

    html += `<div class="prop-group">
      <div class="prop-row"><span class="prop-label">Position</span>
        <input type="number" id="p-x" value="${Math.round(el.x)}" style="width:60px">
        <input type="number" id="p-y" value="${Math.round(el.y)}" style="width:60px">
      </div>
      <div class="prop-row"><span class="prop-label">Size</span>
        <input type="number" id="p-w" value="${Math.round(el.w)}" style="width:60px">
        <input type="number" id="p-h" value="${Math.round(el.h)}" style="width:60px">
      </div>
      <div class="prop-row"><span class="prop-label">Rotation</span>
        <input type="range" id="p-rot" min="0" max="360" value="${el.rot}"><span class="rangeval" id="p-rot-val">${el.rot}°</span>
      </div>
      <div class="prop-row"><span class="prop-label">Opacity</span>
        <input type="range" id="p-opacity" min="0" max="1" step="0.01" value="${el.opacity}"><span class="rangeval" id="p-opacity-val">${Math.round(el.opacity*100)}%</span>
      </div>
      <div class="prop-row"><span class="prop-label">Flip</span>
        <button class="icon-toggle ${el.flipH?'active':''}" id="p-fliph">⇋ H</button>
        <button class="icon-toggle ${el.flipV?'active':''}" id="p-flipv">⇵ V</button>
      </div>
    </div>`;

    html += `<div class="prop-group">
      <div class="panel-title" style="padding:0 0 8px;">Align to canvas</div>
      <div class="align-grid">
        <button data-align-canvas="left" title="Align left">⟸</button>
        <button data-align-canvas="hcenter" title="Center horizontal">↔</button>
        <button data-align-canvas="right" title="Align right">⟹</button>
        <button data-align-canvas="top" title="Align top">⤒</button>
        <button data-align-canvas="vcenter" title="Center vertical">↕</button>
        <button data-align-canvas="bottom" title="Align bottom">⤓</button>
      </div>
    </div>`;

    if(el.type==='rect' || el.type==='ellipse'){
      html += `<div class="prop-group">
        <div class="prop-row"><span class="prop-label">Fill type</span>
          <div class="seg">
            <button id="p-fill-solid" class="${el.fillType!=='gradient'?'active':''}">Solid</button>
            <button id="p-fill-gradient" class="${el.fillType==='gradient'?'active':''}">Gradient</button>
          </div>
        </div>
        <div class="prop-row"><span class="prop-label">Fill</span><input type="color" id="p-fill" value="${toHex(el.fill)}"></div>
        ${el.fillType==='gradient' ? `
        <div class="prop-row"><span class="prop-label">To</span><input type="color" id="p-fillto" value="${toHex(el.fillTo)}"></div>
        <div class="prop-row"><span class="prop-label">Angle</span><input type="range" id="p-gangle" min="0" max="360" value="${el.gradientAngle||135}"><span class="rangeval">${el.gradientAngle||135}°</span></div>
        ` : `<div class="swatch-row" id="fill-swatches"></div>`}
        <div class="prop-row"><span class="prop-label">Stroke</span><input type="color" id="p-stroke" value="${toHex(el.stroke)}"></div>
        <div class="prop-row"><span class="prop-label">Stroke W</span><input type="number" id="p-strokew" value="${el.strokeW}" style="width:60px"></div>
        <div class="prop-row"><span class="prop-label">Line</span>
          <select id="p-strokestyle">
            <option value="solid" ${el.strokeStyle==='solid'?'selected':''}>Solid</option>
            <option value="dashed" ${el.strokeStyle==='dashed'?'selected':''}>Dashed</option>
            <option value="dotted" ${el.strokeStyle==='dotted'?'selected':''}>Dotted</option>
          </select>
        </div>
        ${el.type==='rect' ? `<div class="prop-row"><span class="prop-label">Corner</span><input type="range" id="p-radius" min="0" max="100" value="${el.radius||0}"><span class="rangeval" id="p-radius-val">${el.radius||0}</span></div>` : ''}
        <div class="prop-row"><span class="prop-label">Shadow</span>
          <button class="icon-toggle ${el.shadow?'active':''}" id="p-shadow-toggle">${el.shadow?'On':'Off'}</button>
          <input type="color" id="p-shadow-color" value="${toHex(el.shadowColor)}" ${el.shadow?'':'disabled'}>
        </div>
      </div>`;
    }

    if(el.type==='image'){
      html += `<div class="prop-group">
        <div class="panel-title" style="padding:0 0 8px;">Image adjustments</div>
        <div class="prop-row"><span class="prop-label">Grayscale</span><input type="range" id="p-grayscale" min="0" max="100" value="${el.grayscale||0}"><span class="rangeval">${el.grayscale||0}%</span></div>
        <div class="prop-row"><span class="prop-label">Brightness</span><input type="range" id="p-brightness" min="0" max="200" value="${el.brightness||100}"><span class="rangeval">${el.brightness||100}%</span></div>
        <div class="prop-row"><span class="prop-label">Blur</span><input type="range" id="p-blur" min="0" max="10" value="${el.blur||0}"><span class="rangeval">${el.blur||0}px</span></div>
        <div class="prop-row"><span class="prop-label">Corner</span><input type="range" id="p-radius" min="0" max="100" value="${el.radius||0}"><span class="rangeval" id="p-radius-val">${el.radius||0}</span></div>
      </div>`;
    }

    if(el.type==='text'){
      html += `<div class="prop-group">
        <div class="prop-row"><span class="prop-label">Color</span><input type="color" id="p-color" value="${toHex(el.color)}"></div>
        <div class="swatch-row" id="color-swatches"></div>
        <div class="prop-row"><span class="prop-label">Font</span>
          <select id="p-fontfamily">${FONTS.map(f=>`<option value="${f}" ${el.fontFamily===f?'selected':''}>${f}</option>`).join('')}</select>
        </div>
        <div class="prop-row"><span class="prop-label">Size</span><input type="number" id="p-fontsize" value="${el.fontSize}" style="width:60px"></div>
        <div class="prop-row"><span class="prop-label">Style</span>
          <div class="seg">
            <button id="p-bold" class="${el.bold?'active':''}"><b>B</b></button>
            <button id="p-italic" class="${el.italic?'active':''}"><i>I</i></button>
          </div>
        </div>
        <div class="prop-row"><span class="prop-label">Align</span>
          <div class="seg">
            <button data-align="left" class="${el.align==='left'?'active':''}">⟵</button>
            <button data-align="center" class="${el.align==='center'?'active':''}">↔</button>
            <button data-align="right" class="${el.align==='right'?'active':''}">⟶</button>
          </div>
        </div>
      </div>`;
    }

    html += `<div class="prop-group">
      <div class="panel-title" style="padding:0 0 8px;">Layer order</div>
      <div class="halfrow">
        <button class="fullbtn" id="p-front">⬆ Front</button>
        <button class="fullbtn" id="p-forward">△ Forward</button>
      </div>
      <div class="halfrow">
        <button class="fullbtn" id="p-back">⬇ Back</button>
        <button class="fullbtn" id="p-backward">▽ Backward</button>
      </div>
    </div>`;

    html += `<div class="prop-group">
      <div class="panel-title" style="padding:0 0 8px;">Animation preset</div>
      <div class="anim-grid">
        ${['none','fade','slideup','slideleft','pop','spin'].map(a=>`<div class="anim-chip ${el.anim===a?'active':''}" data-anim="${a}">${a}</div>`).join('')}
      </div>
    </div>`;

    html += `<div class="prop-group">
      <div class="halfrow">
        <button class="fullbtn" id="p-copy">⧉ Copy</button>
        <button class="fullbtn" id="p-duplicate">⎘ Duplicate</button>
      </div>
      <button class="fullbtn danger" id="p-delete">🗑 Delete <span class="kbd">Del</span></button>
    </div>`;

    html += bgGroupHTML();

    propsContent.innerHTML = html;

    const upd = (fn)=>{ fn(); renderAll_softSel(el.id); snapshot(); };

    document.getElementById('p-x').addEventListener('change', e=>upd(()=>el.x=+e.target.value));
    document.getElementById('p-y').addEventListener('change', e=>upd(()=>el.y=+e.target.value));
    document.getElementById('p-w').addEventListener('change', e=>upd(()=>el.w=Math.max(10,+e.target.value)));
    document.getElementById('p-h').addEventListener('change', e=>upd(()=>el.h=Math.max(10,+e.target.value)));
    document.getElementById('p-rot').addEventListener('input', e=>{ el.rot=+e.target.value; document.getElementById('p-rot-val').textContent=el.rot+'°'; renderAll_softSel(el.id); });
    document.getElementById('p-rot').addEventListener('change', ()=>snapshot());
    document.getElementById('p-opacity').addEventListener('input', e=>{ el.opacity=+e.target.value; document.getElementById('p-opacity-val').textContent=Math.round(el.opacity*100)+'%'; renderAll_softSel(el.id); });
    document.getElementById('p-opacity').addEventListener('change', ()=>snapshot());
    document.getElementById('p-fliph').addEventListener('click', ()=>upd(()=>el.flipH=!el.flipH));
    document.getElementById('p-flipv').addEventListener('click', ()=>upd(()=>el.flipV=!el.flipV));

    document.querySelectorAll('[data-align-canvas]').forEach(b=>{
      b.addEventListener('click', ()=>upd(()=>alignToCanvas(el, b.dataset.alignCanvas)));
    });

    if(el.type==='rect'||el.type==='ellipse'){
      document.getElementById('p-fill').addEventListener('input', e=>{ el.fill=e.target.value; renderAll_softSel(el.id); });
      document.getElementById('p-fill').addEventListener('change', ()=>snapshot());
      document.getElementById('p-stroke').addEventListener('input', e=>{ el.stroke=e.target.value; renderAll_softSel(el.id); });
      document.getElementById('p-stroke').addEventListener('change', ()=>snapshot());
      document.getElementById('p-strokew').addEventListener('change', e=>upd(()=>el.strokeW=+e.target.value));
      document.getElementById('p-strokestyle').addEventListener('change', e=>upd(()=>el.strokeStyle=e.target.value));
      document.getElementById('p-fill-solid').addEventListener('click', ()=>upd(()=>el.fillType='solid'));
      document.getElementById('p-fill-gradient').addEventListener('click', ()=>upd(()=>el.fillType='gradient'));
      const fillTo = document.getElementById('p-fillto');
      if(fillTo){
        fillTo.addEventListener('input', e=>{ el.fillTo=e.target.value; renderAll_softSel(el.id); });
        fillTo.addEventListener('change', ()=>snapshot());
      }
      const gAngle = document.getElementById('p-gangle');
      if(gAngle){
        gAngle.addEventListener('input', e=>{ el.gradientAngle=+e.target.value; renderAll_softSel(el.id); });
        gAngle.addEventListener('change', ()=>snapshot());
      }
      if(el.type==='rect'){
        document.getElementById('p-radius').addEventListener('input', e=>{ el.radius=+e.target.value; document.getElementById('p-radius-val').textContent=el.radius; renderAll_softSel(el.id); });
        document.getElementById('p-radius').addEventListener('change', ()=>snapshot());
      }
      document.getElementById('p-shadow-toggle').addEventListener('click', ()=>upd(()=>el.shadow=!el.shadow));
      document.getElementById('p-shadow-color').addEventListener('input', e=>{ el.shadowColor=e.target.value; renderAll_softSel(el.id); });
      document.getElementById('p-shadow-color').addEventListener('change', ()=>snapshot());
      const fillSwatches = document.getElementById('fill-swatches');
      if(fillSwatches) renderSwatches(fillSwatches, c=>upd(()=>el.fill=c));
    }
    if(el.type==='image'){
      document.getElementById('p-grayscale').addEventListener('input', e=>{ el.grayscale=+e.target.value; renderAll_softSel(el.id); });
      document.getElementById('p-grayscale').addEventListener('change', ()=>snapshot());
      document.getElementById('p-brightness').addEventListener('input', e=>{ el.brightness=+e.target.value; renderAll_softSel(el.id); });
      document.getElementById('p-brightness').addEventListener('change', ()=>snapshot());
      document.getElementById('p-blur').addEventListener('input', e=>{ el.blur=+e.target.value; renderAll_softSel(el.id); });
      document.getElementById('p-blur').addEventListener('change', ()=>snapshot());
      document.getElementById('p-radius').addEventListener('input', e=>{ el.radius=+e.target.value; document.getElementById('p-radius-val').textContent=el.radius; renderAll_softSel(el.id); });
      document.getElementById('p-radius').addEventListener('change', ()=>snapshot());
    }
    if(el.type==='text'){
      document.getElementById('p-color').addEventListener('input', e=>{ el.color=e.target.value; renderAll_softSel(el.id); });
      document.getElementById('p-color').addEventListener('change', ()=>snapshot());
      document.getElementById('p-fontfamily').addEventListener('change', e=>upd(()=>el.fontFamily=e.target.value));
      document.getElementById('p-fontsize').addEventListener('change', e=>upd(()=>el.fontSize=+e.target.value));
      document.getElementById('p-bold').addEventListener('click', ()=>upd(()=>el.bold=!el.bold));
      document.getElementById('p-italic').addEventListener('click', ()=>upd(()=>el.italic=!el.italic));
      document.querySelectorAll('[data-align]').forEach(b=>{
        b.addEventListener('click', ()=>upd(()=>el.align=b.dataset.align));
      });
      const colorSwatches = document.getElementById('color-swatches');
      if(colorSwatches) renderSwatches(colorSwatches, c=>upd(()=>el.color=c));
    }

    document.querySelectorAll('.anim-chip').forEach(chip=>{
      chip.addEventListener('click', ()=>upd(()=>el.anim=chip.dataset.anim));
    });

    document.getElementById('p-front').addEventListener('click', ()=>reorder(el.id,'front'));
    document.getElementById('p-back').addEventListener('click', ()=>reorder(el.id,'back'));
    document.getElementById('p-forward').addEventListener('click', ()=>reorder(el.id,'up'));
    document.getElementById('p-backward').addEventListener('click', ()=>reorder(el.id,'down'));

    document.getElementById('p-copy').addEventListener('click', ()=>copySelected());
    document.getElementById('p-duplicate').addEventListener('click', duplicateSelected);
    document.getElementById('p-delete').addEventListener('click', deleteSelected);

    wireBgGroup();
  }

  function bgGroupHTML(){
    return `<div class="prop-group">
      <div class="panel-title" style="padding:0 0 8px;">Canvas background</div>
      <div class="prop-row"><span class="prop-label">Color</span><input type="color" id="p-bg" value="${toHex(stage.dataset.bg||'#ffffff')}"></div>
    </div>`;
  }
  function wireBgGroup(){
    const bg = document.getElementById('p-bg');
    if(bg){
      bg.addEventListener('input', e=>{ stage.style.background = e.target.value; stage.dataset.bg = e.target.value; });
      bg.addEventListener('change', ()=>snapshot());
    }
  }
  function toHex(c){ if(!c || c==='transparent') return '#ffffff'; return c; }

  function alignToCanvas(el, mode){
    const cw = +stage.dataset.w || stage.offsetWidth;
    const ch = +stage.dataset.h || stage.offsetHeight;
    if(mode==='left') el.x = 0;
    if(mode==='right') el.x = cw - el.w;
    if(mode==='hcenter') el.x = (cw - el.w)/2;
    if(mode==='top') el.y = 0;
    if(mode==='bottom') el.y = ch - el.h;
    if(mode==='vcenter') el.y = (ch - el.h)/2;
  }

  function renderSwatches(container, onPick){
    container.innerHTML = SWATCHES.map(c=>`<div class="swatch" style="background:${c}" data-c="${c}"></div>`).join('');
    container.querySelectorAll('.swatch').forEach(s=>{
      s.addEventListener('click', ()=> onPick(s.dataset.c));
    });
  }

  function renderAll_softSel(){
    clearStageEls();
    elements.forEach(el => stage.appendChild(buildElNode(el)));
    updateSelReadout();
  }

  function copySelected(){
    const el = elements.find(e=>e.id===selectedId);
    if(!el) return;
    clipboard = JSON.parse(JSON.stringify(el));
    toast('Copied');
  }
  function pasteClipboard(){
    if(!clipboard) return;
    const copy = JSON.parse(JSON.stringify(clipboard));
    copy.id = uid();
    copy.x += 24; copy.y += 24;
    copy.name = copy.name + ' copy';
    elements.push(copy);
    selectedId = copy.id;
    renderAll();
    snapshot();
    toast('Pasted');
  }
  function duplicateSelected(){
    const el = elements.find(e=>e.id===selectedId);
    if(!el) return;
    const copy = JSON.parse(JSON.stringify(el));
    copy.id = uid();
    copy.x += 20; copy.y += 20;
    copy.name = el.name + ' copy';
    elements.push(copy);
    selectedId = copy.id;
    renderAll();
    snapshot();
    toast('Duplicated');
  }
  function deleteSelected(){
    const idx = elements.findIndex(e=>e.id===selectedId);
    if(idx<0) return;
    elements.splice(idx,1);
    selectedId = null;
    renderAll();
    snapshot();
    toast('Deleted');
  }

  // ---------- context menu ----------
  function openCtxMenu(x,y){
    const el = elements.find(e=>e.id===selectedId);
    if(!el) return;
    ctxmenu.innerHTML = `
      <button data-act="duplicate">Duplicate <span class="kbd">Ctrl+D</span></button>
      <button data-act="copy">Copy <span class="kbd">Ctrl+C</span></button>
      <button data-act="paste">Paste <span class="kbd">Ctrl+V</span></button>
      <hr>
      <button data-act="front">Bring to front</button>
      <button data-act="forward">Bring forward</button>
      <button data-act="backward">Send backward</button>
      <button data-act="back">Send to back</button>
      <hr>
      <button data-act="delete" class="danger">Delete <span class="kbd">Del</span></button>
    `;
    ctxmenu.style.left = x+'px';
    ctxmenu.style.top = y+'px';
    ctxmenu.classList.add('show');
    ctxmenu.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const act = b.dataset.act;
        if(act==='duplicate') duplicateSelected();
        if(act==='copy') copySelected();
        if(act==='paste') pasteClipboard();
        if(act==='delete') deleteSelected();
        if(['front','back'].includes(act)) reorder(el.id, act);
        if(act==='forward') reorder(el.id,'up');
        if(act==='backward') reorder(el.id,'down');
        closeCtxMenu();
      });
    });
  }
  function closeCtxMenu(){ ctxmenu.classList.remove('show'); }
  window.addEventListener('click', closeCtxMenu);
  canvasarea.addEventListener('contextmenu', (e)=>{
    if(e.target===stage || e.target===canvasarea){ e.preventDefault(); }
  });

  // ---------- drag / resize / rotate + smart guides ----------
  let dragState = null;
  let guideEls = [];

  function clearGuides(){ guideEls.forEach(g=>g.remove()); guideEls = []; }
  function showGuideV(x){
    const g = document.createElement('div'); g.className='guide-line guide-v'; g.style.left=x+'px';
    stage.appendChild(g); guideEls.push(g);
  }
  function showGuideH(y){
    const g = document.createElement('div'); g.className='guide-line guide-h'; g.style.top=y+'px';
    stage.appendChild(g); guideEls.push(g);
  }

  function onElMouseDown(e, id){
    let el = elements.find(x=>x.id===id);
    if(!el || el.locked) { selectedId = id; renderAll(); return; }
    const target = e.target;
    e.preventDefault();
    e.stopPropagation();

    // alt+drag on the body (not a handle) duplicates the element and drags the copy
    if(e.altKey && !target.dataset.resize && !target.dataset.rotate){
      const copy = JSON.parse(JSON.stringify(el));
      copy.id = uid();
      copy.name = el.name + ' copy';
      elements.push(copy);
      el = copy;
      id = copy.id;
      toast('Duplicated (Alt+drag)');
    }

    selectedId = id;
    renderAll();

    if(target.dataset.resize){
      dragState = {mode:'resize', id, corner: target.dataset.resize, startX:e.clientX, startY:e.clientY,
        ox:el.x, oy:el.y, ow:el.w, oh:el.h};
    } else if(target.dataset.rotate){
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + (el.x+el.w/2)*zoom;
      const cy = rect.top + (el.y+el.h/2)*zoom;
      dragState = {mode:'rotate', id, cx, cy};
    } else {
      dragState = {mode:'move', id, startX:e.clientX, startY:e.clientY, ox:el.x, oy:el.y};
    }

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  }

  const SNAP_THRESH = 6;
  function onDragMove(e){
    if(!dragState) return;
    const el = elements.find(x=>x.id===dragState.id);
    if(!el) return;

    if(dragState.mode==='move'){
      const dx = (e.clientX - dragState.startX)/zoom;
      const dy = (e.clientY - dragState.startY)/zoom;
      let nx = dragState.ox + dx;
      let ny = dragState.oy + dy;

      clearGuides();
      const cw = +stage.dataset.w || stage.offsetWidth;
      const ch = +stage.dataset.h || stage.offsetHeight;
      const targets = [{x:cw/2},{x:0},{x:cw}];
      const targetsY = [{y:ch/2},{y:0},{y:ch}];
      elements.forEach(o=>{ if(o.id!==el.id && !o.hidden){
        targets.push({x:o.x}, {x:o.x+o.w/2}, {x:o.x+o.w});
        targetsY.push({y:o.y}, {y:o.y+o.h/2}, {y:o.y+o.h});
      }});
      const elCenterX = nx + el.w/2, elLeft = nx, elRight = nx+el.w;
      const elCenterY = ny + el.h/2, elTop = ny, elBottom = ny+el.h;

      let snappedX = false, snappedY = false;
      for(const t of targets){
        if(Math.abs(elCenterX - t.x) < SNAP_THRESH){ nx = t.x - el.w/2; showGuideV(t.x); snappedX=true; break; }
        if(Math.abs(elLeft - t.x) < SNAP_THRESH){ nx = t.x; showGuideV(t.x); snappedX=true; break; }
        if(Math.abs(elRight - t.x) < SNAP_THRESH){ nx = t.x - el.w; showGuideV(t.x); snappedX=true; break; }
      }
      for(const t of targetsY){
        if(Math.abs(elCenterY - t.y) < SNAP_THRESH){ ny = t.y - el.h/2; showGuideH(t.y); snappedY=true; break; }
        if(Math.abs(elTop - t.y) < SNAP_THRESH){ ny = t.y; showGuideH(t.y); snappedY=true; break; }
        if(Math.abs(elBottom - t.y) < SNAP_THRESH){ ny = t.y - el.h; showGuideH(t.y); snappedY=true; break; }
      }
      if(gridOn){
        if(!snappedX) nx = snapToGridVal(nx);
        if(!snappedY) ny = snapToGridVal(ny);
      }
      el.x = nx; el.y = ny;
    } else if(dragState.mode==='resize'){
      const dx = (e.clientX - dragState.startX)/zoom;
      const dy = (e.clientY - dragState.startY)/zoom;
      const c = dragState.corner;
      const lockAspect = e.shiftKey;
      const ratio = dragState.ow / dragState.oh;
      let nw = dragState.ow, nh = dragState.oh, nx2 = dragState.ox, ny2 = dragState.oy;
      if(c.includes('e')) nw = Math.max(20, dragState.ow + dx);
      if(c.includes('s')) nh = Math.max(20, dragState.oh + dy);
      if(c.includes('w')){ nw = Math.max(20, dragState.ow - dx); nx2 = dragState.ox + (dragState.ow - nw); }
      if(c.includes('n')){ nh = Math.max(20, dragState.oh - dy); ny2 = dragState.oy + (dragState.oh - nh); }
      if(lockAspect){
        if(Math.abs(dx) > Math.abs(dy) || c==='se' || c==='nw'){ nh = nw/ratio; }
        else{ nw = nh*ratio; }
        if(c.includes('w')) nx2 = dragState.ox + (dragState.ow - nw);
        if(c.includes('n')) ny2 = dragState.oy + (dragState.oh - nh);
      }
      if(gridOn){ nw = Math.max(20, snapToGridVal(nw)); nh = Math.max(20, snapToGridVal(nh)); }
      el.w = nw; el.h = nh; el.x = nx2; el.y = ny2;
    } else if(dragState.mode==='rotate'){
      const ang = Math.atan2(e.clientY - dragState.cy, e.clientX - dragState.cx);
      let deg = ang*180/Math.PI + 90;
      if(deg<0) deg += 360;
      el.rot = Math.round(deg);
    }
    renderAll_softSel();
  }
  function onDragEnd(){
    if(dragState) snapshot();
    dragState = null;
    clearGuides();
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
  }

  stage.addEventListener('mousedown', (e)=>{
    if(e.target === stage){ selectedId = null; renderAll(); }
  });
  stage.addEventListener('dblclick', (e)=>{
    if(e.target !== stage) return;
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left)/zoom - 100;
    const y = (e.clientY - rect.top)/zoom - 20;
    addElement('text', {x, y, w:220, h:44});
    toast('Text added');
  });

  // ---------- keyboard ----------
  window.addEventListener('keydown', (e)=>{
    const activeTag = document.activeElement.tagName;
    const isEditing = document.activeElement.isContentEditable || activeTag==='INPUT' || activeTag==='SELECT';
    if(e.key === '?' && !isEditing){ e.preventDefault(); toggleShortcuts(true); return; }
    if(isEditing) return;

    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z' && !e.shiftKey){ e.preventDefault(); undo(); return; }
    if((e.ctrlKey||e.metaKey) && (e.key.toLowerCase()==='y' || (e.key.toLowerCase()==='z'&&e.shiftKey))){ e.preventDefault(); redo(); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='d'){ e.preventDefault(); duplicateSelected(); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='c'){ e.preventDefault(); copySelected(); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='v'){ e.preventDefault(); pasteClipboard(); return; }
    if(e.key==='Escape'){ selectedId=null; renderAll(); closeCtxMenu(); toggleShortcuts(false); return; }
    if(e.key==='+' || e.key==='='){ zoom=Math.min(3,zoom+0.1); applyZoom(); return; }
    if(e.key==='-' || e.key==='_'){ zoom=Math.max(0.2,zoom-0.1); applyZoom(); return; }
    if(e.key==='0'){ zoom=1; applyZoom(); return; }

    const el = elements.find(x=>x.id===selectedId);
    if(!el || el.locked) return;

    if(e.key===']'){ e.preventDefault(); reorder(el.id, (e.ctrlKey||e.metaKey)?'front':'up'); return; }
    if(e.key==='['){ e.preventDefault(); reorder(el.id, (e.ctrlKey||e.metaKey)?'back':'down'); return; }
    if(e.key==='Delete' || e.key==='Backspace'){ e.preventDefault(); deleteSelected(); return; }

    const step = e.shiftKey ? 10 : 1;
    let moved = false;
    if(e.key==='ArrowUp'){ el.y -= step; moved=true; }
    if(e.key==='ArrowDown'){ el.y += step; moved=true; }
    if(e.key==='ArrowLeft'){ el.x -= step; moved=true; }
    if(e.key==='ArrowRight'){ el.x += step; moved=true; }
    if(moved){
      e.preventDefault();
      renderAll_softSel();
      clearTimeout(window._moveSnapT);
      window._moveSnapT = setTimeout(snapshot, 260);
    }
  });

  function toggleShortcuts(show){
    document.getElementById('modal-backdrop').classList.toggle('show', show);
  }
  document.getElementById('btn-shortcuts').addEventListener('click', ()=>toggleShortcuts(true));
  document.getElementById('modal-close').addEventListener('click', ()=>toggleShortcuts(false));
  document.getElementById('modal-backdrop').addEventListener('click', (e)=>{ if(e.target.id==='modal-backdrop') toggleShortcuts(false); });

  // ---------- zoom ----------
  function applyZoom(){
    stage.style.transform = `scale(${zoom})`;
    zoomval.textContent = Math.round(zoom*100)+'%';
  }
  function fitZoom(){
    const cw = +stage.dataset.w || stage.offsetWidth;
    const ch = +stage.dataset.h || stage.offsetHeight;
    const availW = canvasarea.clientWidth - 60;
    const availH = canvasarea.clientHeight - 60;
    zoom = Math.min(availW/cw, availH/ch, 1.5);
    zoom = Math.max(0.1, zoom);
    applyZoom();
  }
  document.getElementById('zoom-in').addEventListener('click', ()=>{ zoom = Math.min(3, zoom+0.1); applyZoom(); });
  document.getElementById('zoom-out').addEventListener('click', ()=>{ zoom = Math.max(0.2, zoom-0.1); applyZoom(); });
  document.getElementById('zoom-fit').addEventListener('click', fitZoom);
  document.getElementById('zoom-sel').addEventListener('click', ()=>{
    const el = elements.find(e=>e.id===selectedId);
    if(!el){ toast('Nothing selected'); return; }
    const availW = canvasarea.clientWidth - 120;
    const availH = canvasarea.clientHeight - 120;
    zoom = Math.max(0.15, Math.min(availW/el.w, availH/el.h, 3));
    applyZoom();
    requestAnimationFrame(()=>{
      const node = stage.querySelector(`[data-id="${el.id}"]`);
      if(node) node.scrollIntoView({block:'center', inline:'center', behavior:'smooth'});
    });
  });

  // ---------- undo/redo buttons ----------
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  // ---------- play animations ----------
  document.getElementById('btn-play').addEventListener('click', ()=>{
    const nodes = stage.querySelectorAll('.kel');
    nodes.forEach(n=>{ n.style.animation = 'none'; void n.offsetWidth; });
    elements.forEach(el=>{
      if(el.anim && el.anim!=='none'){
        const node = stage.querySelector(`[data-id="${el.id}"]`);
        if(node && window.gsap){
          const presets = {
            fade: {from:{opacity:0}, to:{opacity:el.opacity, duration:.6}},
            slideup: {from:{y:'+=24', opacity:0}, to:{y:'-=24', opacity:el.opacity, duration:.6, ease:'power2.out'}},
            slideleft: {from:{x:'-=24', opacity:0}, to:{x:'+=24', opacity:el.opacity, duration:.6, ease:'power2.out'}},
            pop: {from:{scale:.7, opacity:0}, to:{scale:1, opacity:el.opacity, duration:.5, ease:'back.out(2)'}},
            spin: {from:{rotation:0}, to:{rotation:360, duration:.8, ease:'power1.inOut'}}
          };
          const p = presets[el.anim];
          if(p) gsap.fromTo(node, p.from, p.to);
        }
      }
    });
    toast('Playing animations');
  });

  // ---------- save (in-memory session save) ----------
  let savedProjects = [];
  document.getElementById('btn-save').addEventListener('click', ()=>{
    savedProjects.push({ at: new Date().toISOString(), elements: JSON.parse(JSON.stringify(elements)), bg: stage.dataset.bg||'#ffffff' });
    markClean();
    toast('Saved to session (' + savedProjects.length + ' snapshot' + (savedProjects.length>1?'s':'') + ')');
  });

  // ---------- export ----------
  const exportBtn = document.getElementById('btn-export');
  const exportMenu = document.getElementById('exportmenu');
  exportBtn.addEventListener('click', (e)=>{ e.stopPropagation(); exportMenu.classList.toggle('show'); });
  exportMenu.addEventListener('click', (e)=>e.stopPropagation());
  window.addEventListener('click', ()=>exportMenu.classList.remove('show'));
  exportMenu.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      exportMenu.classList.remove('show');
      doExport(b.dataset.fmt);
    });
  });
  function doExport(fmt){
    const prevSel = selectedId;
    const wasGrid = gridOn;
    if(wasGrid){ gridOn=false; stage.classList.remove('show-grid'); }
    selectedId = null;
    renderAll();
    toast('Rendering export…');
    const scale = +document.getElementById('exp-scale').value || 2;
    const transparent = document.getElementById('exp-transparent').checked;
    const opts = { backgroundColor: transparent ? null : (stage.dataset.bg||'#ffffff'), scale };
    html2canvas(stage, opts).then(canvas=>{
      const link = document.createElement('a');
      link.download = 'kanvas-export.' + (fmt==='jpg'?'jpg':'png');
      link.href = canvas.toDataURL(fmt==='jpg' ? 'image/jpeg' : 'image/png', 0.92);
      link.click();
      selectedId = prevSel;
      if(wasGrid){ gridOn=true; stage.classList.add('show-grid'); }
      renderAll();
      toast('Exported ' + fmt.toUpperCase());
    }).catch(()=>{
      selectedId = prevSel;
      if(wasGrid){ gridOn=true; stage.classList.add('show-grid'); }
      renderAll();
      toast('Export failed');
    });
  }

  // ---------- Canva-style enhancement pack ----------
  (function enhanceKanvas(){
    const style = document.createElement('style');
    style.textContent = `
      .template-modal{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;width:min(650px,92vw);max-height:78vh;overflow:auto}.template-modal h3{margin:0;font:600 18px 'Space Grotesk',sans-serif}.template-modal p{color:var(--text-dim);font-size:12px}.template-head{display:flex;align-items:center;justify-content:space-between}.template-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}.template-card{height:132px;border:1px solid var(--line);border-radius:8px;color:white;text-align:left;padding:12px;font:600 15px 'Space Grotesk',sans-serif;cursor:pointer;display:flex;align-items:flex-end;background:linear-gradient(135deg,#3d5afe,#ba68c8)}.template-card:nth-child(2){background:linear-gradient(135deg,#101014,#00c853)}.template-card:nth-child(3){background:linear-gradient(135deg,#ff5c72,#ffb74d)}.template-card:nth-child(4){background:linear-gradient(135deg,#4dd0e1,#3d5afe)}.template-card:hover{outline:2px solid var(--lime)}.canva-quick{display:flex;gap:6px;padding:0 12px 11px}.canva-quick .fullbtn{margin:0}.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:700}.modal-backdrop.show{display:flex}`;
    document.head.appendChild(style);
    const left = document.getElementById('leftpanel');
    const quick = document.createElement('div'); quick.className='canva-quick';
    quick.innerHTML='<button class="fullbtn" id="btn-templates">Templates</button><button class="fullbtn" id="btn-load-project">Load saved</button>';
    left.insertBefore(quick, document.getElementById('layerlist').previousElementSibling);
    const modal = document.createElement('div'); modal.id='templates-modal'; modal.className='modal-backdrop';
    modal.innerHTML='<div class="template-modal"><div class="template-head"><h3>Start from a template</h3><button class="tb-btn" id="close-templates">Close</button></div><p>Applying a template replaces the current page. Undo restores your work.</p><div class="template-grid" id="template-grid"></div></div>';
    document.body.appendChild(modal);
    const templates=[
      {name:'Bold announcement',bg:'#f4f0ff',els:[['rect',{x:54,y:56,w:694,h:388,fill:'#3d5afe',radius:28,shadow:true,shadowColor:'#3d5afe'}],['text',{x:95,y:110,w:560,h:100,text:'MAKE IT\nHAPPEN.',fontSize:62,bold:true,color:'#ffffff',fontFamily:'Space Grotesk'}],['text',{x:100,y:334,w:420,h:32,text:'A fresh beginning starts today.',fontSize:20,color:'#c6ff3d'}]]},
      {name:'Minimal studio',bg:'#f7f5ef',els:[['text',{x:78,y:96,w:600,h:76,text:'Studio notes',fontSize:64,bold:true,color:'#101014',fontFamily:'Playfair Display'}],['text',{x:84,y:215,w:420,h:60,text:'Thoughtful objects, good ideas,\nand the space to make them real.',fontSize:20,color:'#3f3f48'}],['ellipse',{x:575,y:210,w:128,h:128,fill:'#c6ff3d',shadow:true,shadowColor:'#c6ff3d'}]]},
      {name:'Big sale',bg:'#ffb74d',els:[['text',{x:70,y:58,w:470,h:178,text:'BIG\nSALE',fontSize:86,bold:true,color:'#ff5c72',fontFamily:'Space Grotesk'}],['rect',{x:78,y:316,w:310,h:58,fill:'#101014',radius:29}],['text',{x:112,y:329,w:270,h:30,text:'UP TO 50% OFF',fontSize:21,bold:true,color:'#ffffff'}]]},
      {name:'Social quote',bg:'#101014',els:[['ellipse',{x:70,y:65,w:92,h:92,fill:'#4dd0e1'}],['text',{x:75,y:165,w:640,h:175,text:'“Design is\nintelligence made visible.”',fontSize:46,bold:true,color:'#ffffff',fontFamily:'Playfair Display'}],['text',{x:78,y:392,w:360,h:24,text:'— ALINA WHEELER',fontSize:14,bold:true,color:'#c6ff3d'}]]}
    ];
    const grid=document.getElementById('template-grid');
    templates.forEach((t,i)=>{const b=document.createElement('button');b.className='template-card';b.textContent=t.name;b.onclick=()=>{elements=[];selectedId=null;stage.style.background=t.bg;stage.dataset.bg=t.bg;t.els.forEach(([type,opts])=>addElement(type,opts));selectedId=null;renderAll();snapshot();modal.classList.remove('show');toast('Template applied');};grid.appendChild(b);});
    document.getElementById('btn-templates').onclick=()=>modal.classList.add('show'); document.getElementById('close-templates').onclick=()=>modal.classList.remove('show'); modal.onclick=e=>{if(e.target===modal)modal.classList.remove('show');};
    const addrow=document.getElementById('addrow');
    [['Line','rect',{w:200,h:6,radius:3}],['Card','rect',{w:260,h:150,fill:'#ffffff',stroke:'#3d5afe',strokeW:2,radius:16,shadow:true}],['Caption','text',{text:'Add a caption',w:240,h:32,fontSize:16,color:'#101014'}]].forEach(([name,type,opts])=>{const b=document.createElement('button');b.className='add-btn';b.innerHTML='<b>+</b><span>'+name+'</span>';b.onclick=()=>addElement(type,opts);addrow.appendChild(b);});
    function storeProject(){const payload={name:projectNameInput.value,elements,bg:stage.dataset.bg,w:stage.dataset.w,h:stage.dataset.h,savedAt:new Date().toISOString()};localStorage.setItem('kanvas-project',JSON.stringify(payload));markClean();toast('Saved in this browser');}
    document.getElementById('btn-save').addEventListener('click',storeProject);
    document.getElementById('btn-load-project').onclick=()=>{try{const p=JSON.parse(localStorage.getItem('kanvas-project'));if(!p){toast('No saved project yet');return;}elements=p.elements||[];selectedId=null;projectNameInput.value=p.name||'Untitled project';setCanvasSize(+p.w||800,+p.h||500,false);stage.dataset.bg=p.bg||'#ffffff';stage.style.background=stage.dataset.bg;renderAll();snapshot();markClean();toast('Saved project loaded');}catch(err){toast('Saved project could not be loaded');}};
  })();
  // ---------- init ----------
  stage.dataset.bg = '#ffffff';
  stage.dataset.w = 800; stage.dataset.h = 500;
  stage.style.background = '#ffffff';
  addElement('rect', {x:80,y:80,w:220,h:140,fill:'#3d5afe',radius:14,shadow:true,shadowColor:'#3d5afe'});
  addElement('text', {x:340,y:100,text:'Kanvas',fontSize:42,bold:true,color:'#101014',fontFamily:'Space Grotesk',w:300});
  selectedId = null;
  applyZoom();
  renderAll();
  history = []; historyIndex = -1;
  snapshot();
  markClean();
  // ---------- AI image studio ----------
  const aiButton = document.createElement('button');
  aiButton.className = 'tb-btn';
  aiButton.id = 'btn-ai-studio';
  aiButton.textContent = 'AI Studio';
  document.getElementById('topbar').insertBefore(aiButton, document.getElementById('exportwrap'));

  const aiPanel = document.createElement('aside');
  aiPanel.id = 'ai-studio-panel';
  aiPanel.innerHTML = `
    <div class="ai-head"><strong>AI Image Studio</strong><button class="tb-btn" id="btn-ai-close">Close</button></div>
    <p>Generate an image directly into your design. Your Gemini key stays on the local server.</p>
    <textarea id="ai-prompt" maxlength="700" placeholder="A futuristic blue sneaker floating above soft clouds, premium editorial product photography"></textarea>
    <label class="ai-label">Style</label>
    <div class="ai-style-row"><button class="ai-style active" data-ai-style="Editorial">Editorial</button><button class="ai-style" data-ai-style="3D">3D</button><button class="ai-style" data-ai-style="Illustration">Illustration</button><button class="ai-style" data-ai-style="Minimal">Minimal</button></div>
    <div class="ai-select-row"><label>Aspect ratio <select id="ai-ratio"><option value="1:1">Square</option><option value="16:9">Landscape</option><option value="9:16">Portrait</option></select></label></div>
    <button class="tb-btn primary" id="btn-ai-generate">Generate image</button><small>Set GEMINI_API_KEY before generating.</small>`;
  document.body.appendChild(aiPanel);

  const aiCss = document.createElement('style');
  aiCss.textContent = `#ai-studio-panel{position:fixed;right:280px;top:64px;width:330px;z-index:400;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;box-shadow:0 18px 45px rgba(0,0,0,.55);display:none}#ai-studio-panel.show{display:block}.ai-head{display:flex;align-items:center;justify-content:space-between;font:600 15px 'Space Grotesk',sans-serif}.ai-head .tb-btn{padding:4px 7px}.ai-head+p{font-size:11.5px;line-height:1.45;color:var(--text-dim)}#ai-prompt{width:100%;height:92px;resize:vertical;background:var(--panel-2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:8px;font:12px Inter}.ai-label{font-size:11px;color:var(--text-dim);display:block;margin:10px 0 5px}.ai-style-row{display:flex;gap:5px;flex-wrap:wrap}.ai-style{background:var(--panel-2);border:1px solid var(--line);color:var(--text-dim);font-size:10px;border-radius:13px;padding:5px 8px;cursor:pointer}.ai-style.active{border-color:var(--lime);color:var(--lime)}.ai-select-row{margin:10px 0;color:var(--text-dim);font-size:11px}.ai-select-row select{float:right;background:var(--panel-2);border:1px solid var(--line);border-radius:5px;color:var(--text);padding:3px}.ai-select-row:after{content:'';display:block;clear:both}#btn-ai-generate{width:100%;justify-content:center}#ai-studio-panel small{display:block;color:var(--text-dim);font-size:10px;margin-top:8px}@media(max-width:900px){#ai-studio-panel{right:8px;top:56px}}`;
  document.head.appendChild(aiCss);

  let selectedAiStyle = 'Editorial';
  aiButton.addEventListener('click', ()=>aiPanel.classList.toggle('show'));
  document.getElementById('btn-ai-close').addEventListener('click', ()=>aiPanel.classList.remove('show'));
  document.querySelectorAll('.ai-style').forEach(button=>button.addEventListener('click', ()=>{
    selectedAiStyle = button.dataset.aiStyle;
    document.querySelectorAll('.ai-style').forEach(item=>item.classList.toggle('active', item===button));
  }));
  document.getElementById('btn-ai-generate').addEventListener('click', async ()=>{
    const prompt = document.getElementById('ai-prompt').value.trim();
    if(!prompt){ toast('Describe the image you want'); return; }
    const button = document.getElementById('btn-ai-generate');
    button.disabled = true; button.textContent = 'Generating...';
    try{
      const response = await fetch('/api/generate-image', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({prompt, style:selectedAiStyle, aspectRatio:document.getElementById('ai-ratio').value})
      });
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || 'Image generation failed');
      addElement('image', {src:data.imageDataUrl, x:Math.max(40,(+stage.dataset.w||800)/2-150), y:Math.max(40,(+stage.dataset.h||500)/2-100), w:300, h:200, name:'AI image · '+prompt.slice(0,22)});
      aiPanel.classList.remove('show'); toast('AI image added');
    }catch(error){ toast(error.message || 'AI service unavailable'); }
    finally{ button.disabled=false; button.textContent='Generate image'; }
  });
})();



