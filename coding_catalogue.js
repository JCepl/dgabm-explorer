// The coding expressions are exported from the R functions that create the data.
(function(){
  const K=G.catalogue={};
  K.table=(s,D=G.D)=>{
    const columns=['source_column','source_column_name','feature','variable_label','type','coding_rule','missing_policy','ticked','effective_weight','used_in_PCA'];
    const records=D.features.map(f=>({f,source:D.dict.find(d=>d.feeds.includes(f.key))})).filter(r=>r.source).sort((a,b)=>a.source.col-b.source.col);
    const rows=records.map(({f,source})=>[source.col,source.name,f.key,f.label,f.binary?'0/1':'Numeric',f.coding_rule||'',f.missing_policy||'',s.ticked_features.includes(f.key),s.feature_weights[f.key]*s.category_weights[f.group],s.features_used.includes(f.key)]);
    return{title:'How source columns feed PCA',columns,rows};
  };
  K.matrix=(s,D=G.D)=>{
    const cols=s.features_used.map(f=>D.columns.indexOf(f)),weights=s.features_used.map(f=>s.effective_weights[f]);
    const Z=G.C.standardize(D.X,cols,weights).Z;
    return{title:'Standardized weighted PCA input',columns:['article_id',...s.features_used],rows:Z.map((row,i)=>[D.articles[i].id,...row])};
  };
  K.settings=()=>({features_used:G.cur()?.R.feats||[],ticked_features:[...G.st.ticks],feature_weights:G.st.w,category_weights:G.st.cw,effective_weights:Object.fromEntries(G.D.columns.map(f=>[f,G.ew(f)]))});
  function examples(feature,source){
    const j=G.col.get(feature),sourceIndex=G.D.dict.indexOf(source),seen=new Set(),rows=[];
    for(let i=0;i<G.n&&rows.length<3;i++){
      const value=G.D.X[i][j];if(seen.has(value))continue;seen.add(value);
      const raw=String(G.D.raw[i][sourceIndex]||'(blank)'),shown=raw.length>70?raw.slice(0,67)+'…':raw;
      rows.push(`<div class="coding-example" title="${G.esc(raw)}"><span>#${G.D.articles[i].id}: ${G.esc(shown)}</span> → <b>${Number(value.toPrecision(6))}</b></div>`);
    }
    return rows.join('');
  }
  K.render=()=>{
    const s=K.settings(),table=K.table(s),q=G.$('coding-search').value.toLowerCase(),shown=table.rows.filter(row=>row.slice(0,7).join(' ').toLowerCase().includes(q));
    G.$('coding-count').textContent=`${shown.length} of ${table.rows.length} derived variables · ${s.features_used.length} currently used in PCA`;
    G.$('coding-table').innerHTML='<table class="t coding-table"><thead><tr><th>Source sheet column</th><th>Derived PCA variable</th><th>Representation and exact R rule</th><th>Missing / unparsed values</th><th>Raw cell → coded value</th><th>Current PCA</th></tr></thead><tbody>'+shown.map(row=>{
      const source=G.D.dict.find(d=>d.col===row[0]);
      return `<tr><td title="${G.esc(source.full)}"><b>${row[0]}. ${G.esc(row[1])}</b><details><summary>Full sheet header</summary>${G.esc(source.full)}</details></td><td><b>${G.esc(row[3])}</b><code>${G.esc(row[2])}</code></td><td><b>${row[4]}</b><code>${G.esc(row[5])}</code></td><td>${G.esc(row[6])}</td><td>${examples(row[2],source)}</td><td>${row[9]?'<b>Included</b>':row[7]?'Not used (constant or zero weight)':'Not selected'}<br>Effective weight: ${Number(row[8].toFixed(3))}</td></tr>`;
    }).join('')+'</tbody></table>';
    if(G.$('coding-matrix-details').open)K.renderMatrix();
  };
  K.renderMatrix=()=>{
    const s=K.settings();if(!s.features_used.length){G.$('coding-matrix').textContent='Select at least three varying variables with positive weights to form a PCA input matrix.';return;}
    const table=K.matrix(s),coded=G.$('coding-matrix-scale').value==='coded';
    const rows=coded?G.D.X.map((r,i)=>[G.D.articles[i].id,...s.features_used.map(f=>r[G.col.get(f)])]):table.rows;
    G.$('coding-matrix').innerHTML='<table class="mat"><thead><tr>'+table.columns.map(c=>'<th>'+G.esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,j)=>j===0?'<th>'+v+'</th>':`<td title="${v}">${coded?v:Number(v.toFixed(3))}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
  };
  K.setup=()=>{
    G.$('coding-search').oninput=K.render;
    G.$('coding-matrix-details').addEventListener('toggle',()=>{if(G.$('coding-matrix-details').open)K.renderMatrix();});
    G.$('coding-matrix-scale').onchange=K.renderMatrix;
    G.$('coding-download').onclick=()=>{const t=K.table(K.settings());G.csv([t.columns,...t.rows],'pca_coding_catalogue.csv');};
    G.$('coding-matrix-download').onclick=()=>{const s=K.settings();if(!s.features_used.length)return;const t=K.matrix(s);G.csv([t.columns,...t.rows],'pca_input_standardized_weighted.csv');};
  };
})();
