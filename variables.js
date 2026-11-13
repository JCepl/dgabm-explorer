// Each source column gets a small table; the tables form a responsive grid.
(function(){
  const V=G.variables={};
  const reviews={
    18:['High','Initial allele frequencies','Code equal / unequal / other only after reviewing the free text; distinguish allele frequencies from continuous allele-value distributions.'],
    25:['High','Trait–fitness mapping','Useful as a descriptive classification of direct vs mechanistic mapping. Missing text is unknown, not absence.'],
    31:['Medium','EEF description','Use to check the existing EEF-type coding; free text is unsuitable as a direct numeric PCA input.'],
    33:['Already available','Species / model','Study-system flags are optional controls. Multi-label coding can reflect both generic and applied systems.'],
    32:['Already available','EEF type','Authors’ classification is available as an optional control; including it in PCA can make the interpretation circular.'],
    27:['Sparse','Mutation rate','Useful for a separate reported/value analysis after separating per-locus, per-trait and per-generation units.'],
    28:['Sparse','Mutation size','Keep descriptive until more comparable values and distribution definitions are available.'],
    20:['Sparse','Emergent heritability','Too little reported information for a defensible main PCA variable.'],
    35:['Context','Year','Use for trends and sensitivity checks, rather than to define model clusters.'],
    36:['Context','Author keywords','Use as a text cross-check; heterogeneous terms need normalization.'],
    37:['Context','Keywords Plus','Use as an independent text cross-check, with missingness recorded.'],
    39:['Outcome','Citation count (WoS)','Compare outcomes by cluster after adjusting for publication age; keep it out of the main PCA.'],
    40:['Outcome','Citation count (all databases)','Alternative outcome; do not count both citation totals as independent predictors.'],
    3:['Context','Journal','Useful for descriptive comparisons; publication venue is not a model mechanism.']
  };
  V.render=()=>{
    if(!G.D.dict)return;
    const q=G.$('variable-search').value.toLowerCase(),D=G.D,box=G.$('chips');box.replaceChildren();
    for(const column of D.dict){
      const feats=D.features.filter(f=>column.feeds.includes(f.key));
      const shown=feats.filter(f=>(column.name+' '+f.label+' '+D.group_titles[f.group]).toLowerCase().includes(q));if(!shown.length)continue;
      const card=document.createElement('section');card.className='variable-card';card.dataset.sourceColumn=column.col;
      card.innerHTML=`<h4 title="${G.esc(column.full)}"><span>Column ${column.col}</span>${G.esc(column.name)}</h4><table><thead><tr><th>Use</th><th>Variable</th><th>Type</th><th>n</th><th>Weight</th></tr></thead><tbody>${shown.map(f=>{
        const excluded=G.excluded.has(f.key),binary=f.binary,count=binary?D.X.reduce((s,r)=>s+r[G.col.get(f.key)],0):'—';
        return `<tr data-feature="${f.key}"><td><input type="checkbox" data-use="${f.key}" aria-label="Use ${G.esc(f.label)}" ${G.st.ticks.has(f.key)&&!excluded?'checked':''} ${excluded?'disabled':''}></td><td title="${G.esc(column.full)}">${G.esc(f.label)}${excluded?'<small>Excluded from PCA</small>':''}</td><td>${binary?'0/1':'Numeric'}</td><td>${count}</td><td><input type="number" min="0" max="5" step="0.05" data-weight="${f.key}" aria-label="Weight ${G.esc(f.label)}" value="${G.st.w[f.key]}" ${excluded?'disabled':''}></td></tr>`;
      }).join('')}</tbody></table>`;
      card.querySelectorAll('[data-use]').forEach(input=>input.onchange=()=>G.toggle(input.dataset.use));
      card.querySelectorAll('[data-weight]').forEach(input=>input.onchange=()=>{const f=input.dataset.weight,value=Math.max(0,Math.min(5,+input.value||0));G.st.w[f]=value;if(value>0)G.st.ticks.add(f);else G.st.ticks.delete(f);G.emit('state');});box.append(card);
    }
    G.$('column-review').innerHTML='<table class="t"><thead><tr><th>Column</th><th>Reported / '+G.n+'</th><th>Usefulness</th><th>Assessment</th></tr></thead><tbody>'+Object.entries(reviews).map(([col,[priority,name,note]])=>{const j=D.dict.findIndex(d=>d.col===+col),count=D.raw.filter(r=>r[j]!=null&&!/^(?:\s*|na|n\/a|not reported|no information|not available)$/i.test(String(r[j]).trim())).length;return `<tr><td>${col} · ${name}</td><td>${count}</td><td>${priority}</td><td>${note}</td></tr>`;}).join('')+'</tbody></table>';
  };
})();
