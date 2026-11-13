// Downloads are built from a frozen click-time state, not the opening preset.
(function () {
  const E = G.exports = {}, $ = G.$;
  const figureNames = {pca:'PCA map',dend:'Hierarchy',loadplot:'PCA loadings',cooc:'Co-occurrence',clus:'Clustered co-occurrence',resc:'Rescaled clustering',traitcorr:'Trait correlations',cnet:'Citation network',cmat:'Citation matrix'};
  const json = value => JSON.stringify(value, (_,v) => ArrayBuffer.isView(v) ? Array.from(v) : v, 2);
  const clone = value => JSON.parse(json(value));
  const csv = rows => rows.map(row => row.map(value => {
    const text = value == null ? '' : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g,'""') + '"' : text;
  }).join(',')).join('\n') + '\n';
  function save(blob,name) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  async function textFile(name) {const r=await fetch(name);if(!r.ok)throw new Error('Download template unavailable: '+name);return r.text();}
  function dataURL(url) {const comma=url.indexOf(','),body=url.slice(comma+1);return url.slice(0,comma).includes(';base64') ? Uint8Array.from(atob(body),c=>c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(body));}
  async function svgPNG(svg,width,height) {
    const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    try {await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(image,0,0);return dataURL(canvas.toDataURL('image/png'));} finally {URL.revokeObjectURL(url);}
  }
  function refreshFigures() {
    const previous=$('export-figure').value;
    const visible=Object.keys(figureNames).filter(id=>{const el=$(id);return el&&el.getClientRects().length&&(id==='dend'||el.data);});
    const options=[...visible.map(id=>new Option(figureNames[id]+' (figure)',id)),...Object.entries(G.tableExports.names).map(([id,label])=>new Option(label+' (table)', 'table:'+id))];
    $('export-figure').replaceChildren(...options);
    if(options.some(o=>o.value===previous))$('export-figure').value=previous;
    if(!visible.length&&!previous?.startsWith('table:')) {
      const tab=document.querySelector('nav [data-tab].on')?.dataset.tab;
      $('export-figure').value='table:'+({dict:'workbook_filtered',fm:'feature_matrix',cite:'citation_edges'}[tab]||'all');
    }
    $('download-snapshot').disabled=false;
  }
  async function capture(full) {
    const main=document.querySelector('main');main.inert=true;document.body.dataset.exporting='true';
    try {
      // Flush a feature click queued in the previous frame before taking the image.
      await new Promise(requestAnimationFrame);if(G.latestUpdate)await G.latestUpdate;
      if(G.st.d3&&G.p3d)await G.p3d;
      await Promise.all([...G.pendingPlots]);
      await G.extra();
      const current=G.cur(),R=current?.R,lab=current?.lab,st=G.st,id=$('export-figure').value,el=$(id);
      const tableKey=id.startsWith('table:')?id.slice(6):null;
      const settings=clone({schema_version:2,app_version:"2026.11.13.1",include_excluded:st.includeExcluded,paper_count:G.n,exported_at:new Date().toISOString(),scope:st.scope,
        ticked_features:G.D.columns.filter(f=>st.ticks.has(f)&&!G.excluded.has(f)),pca_available:!!current,features_used:R?.feats||[],
        excluded_features:[...G.excluded],feature_weights:st.w,category_weights:st.cw,
        effective_weights:Object.fromEntries((R?.feats||[]).map(f=>[f,G.ew(f)])),k:st.k,auto_k:st.auto,
        variance_target:70,n_pcs:R?.P.nPc||0,renderer_version:Plotly.version,show_loadings:st.load,loading_n:st.topn,
        mark_model_papers:st.mark,is_3d:st.d3,show_article_numbers:$('nums')?.checked,matrix_cell_px:G.cell,figure_id:id||null,figure_name:figureNames[id]||G.tableExports.names[tableKey]||'All tables'});
      const reference=current?clone({features:R.feats,scores:R.P.scores,loadings:R.P.loadings,explained:R.P.explained,clusters:lab,merges:R.merges,merge_heights:R.merges.map(merge=>merge.height)}):{};
      const controls=G.tableExports.controls(),tableSnapshot=clone(G.tableExports.build(settings,current,controls));
      const tableState={controls,orders:tableSnapshot.orders,selected:tableKey};
      const captured={settings,reference,tableState,tables:tableSnapshot.tables,data:clone(G.D)};
      if(!el||!el.getClientRects().length)return{...captured,figure:{kind:tableKey?'table':'none',table:tableKey},svg:null,png:null};
      const width=Math.round(el.clientWidth),height=Math.round(el.clientHeight);
      let figure,svg,png;
      if(id==='dend') {
        const copy=el.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',width);copy.setAttribute('height',height);
        const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent=`svg{font-family:${getComputedStyle(el).fontFamily}} #dend text{fill:#263238;font-size:10px} .fork{fill:#fff;stroke:#8b1a1a;stroke-width:1.2}`;copy.prepend(style);
        svg=new XMLSerializer().serializeToString(copy);png=await svgPNG(svg,width,height);figure={kind:'svg',width,height};
      } else {
        figure=clone({kind:'plotly',data:el.data,layout:el.layout,config:{displaylogo:false,responsive:false,displayModeBar:el._context?.displayModeBar??'hover',scrollZoom:el._context?.scrollZoom??false,modeBarButtonsToRemove:el._context?.modeBarButtonsToRemove||[]}});figure.layout.width=width;figure.layout.height=height;figure.layout.autosize=false;
        if(el.layout.scene?.camera)figure.layout.scene.camera=clone(el.layout.scene.camera);
        svg=new TextDecoder().decode(dataURL(await Plotly.toImage(el,{format:'svg',width,height})));
        png=dataURL(await Plotly.toImage(el,{format:'png',width,height,scale:1}));
      }
      // The numerical state and graphic are now frozen; later UI edits cannot alter them.
      return {...captured,figure,svg,png};
    } finally {main.inert=false;delete document.body.dataset.exporting;}
  }
  async function snapshotFiles(snapshot) {
    const D=snapshot.data,s=snapshot.settings,used=s.features_used.map(f=>G.col.get(f));
    const featureRows=D.columns.map(f=>[f,G.F[f].label,G.F[f].group,s.ticked_features.includes(f),(s.scope==='all'?D.columns:D.scopes[s.scope]).includes(f)&&!s.excluded_features.includes(f),s.features_used.includes(f),s.feature_weights[f],s.category_weights[G.F[f].group],s.feature_weights[f]*s.category_weights[G.F[f].group],s.excluded_features.includes(f)]);
    const files=[
      {name:'settings.json',data:json(s)},
      {name:'analysis_reference.json',data:json(snapshot.reference)},
      {name:'figure.json',data:json(snapshot.figure)},
      {name:'data_used.csv',data:csv([s.features_used,...D.X.map(row=>used.map(j=>row[j]))])},
      {name:'data_all.csv',data:csv([D.columns,...D.X])},
      {name:'feature_settings.csv',data:csv([['feature','label','category','ticked','in_scope','used_in_PCA','feature_weight','category_weight','effective_weight','excluded'],...featureRows])},
      {name:'articles.csv',data:csv([['article_id','authors','title','year','model_paper','retained','exclusion_reason'],...D.articles.map(a=>[a.id,a.authors,a.title,a.year,a.model,a.retained!==false,a.reason||''])])},
      {name:'workbook.csv',data:csv([D.dict.map(d=>d.full),...D.raw])},
      {name:'reproduce.R',data:await textFile(D.downloads?.script||'reproduce.R')},
      {name:'rebuild_tables.R',data:await textFile(D.downloads?.tables_script||'rebuild_tables.R')},
      {name:'table_settings.json',data:json(snapshot.tableState)},
      {name:'tables_reference.json',data:json(snapshot.tables)},
      {name:'tables_input.json',data:json({articles:D.articles,features:D.features,scopes:D.scopes,group_titles:D.group_titles,edges:D.edges,raw:D.raw,dict:D.dict,summary:D.summary})}
    ];
    for(const [key,table] of Object.entries(snapshot.tables))files.push({name:'tables/'+key+'.csv',data:csv([table.columns,...table.rows])});
    const selected=snapshot.tables[snapshot.tableState.selected];
    if(selected)files.push({name:'current_table.csv',data:csv([selected.columns,...selected.rows])});
    const htmlTables=selected?[selected]:Object.values(snapshot.tables);
    files.push({name:'tables.html',data:'<!doctype html><meta charset="utf-8"><title>Captured tables</title><style>body{font:14px system-ui;margin:24px}table{border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:5px;white-space:pre-wrap;min-width:70px}.scroll{overflow:auto;max-height:70vh}h2{margin-top:32px}</style>'+htmlTables.map(t=>'<h2>'+G.esc(t.title)+'</h2><div class="scroll"><table><tr>'+t.columns.map(c=>'<th>'+G.esc(c)+'</th>').join('')+'</tr>'+t.rows.map(r=>'<tr>'+r.map(v=>'<td>'+G.esc(String(v??''))+'</td>').join('')+'</tr>').join('')+'</table></div>').join('')});
    if(snapshot.figure.kind==='plotly') {
      const is3d=snapshot.figure.data.some(trace=>trace.type?.includes('3d'));
      const suffix=is3d?'vendor/plotly.min.js':'vendor/plotly-cartesian.min.js';
      const script=[...document.scripts].find(script=>script.src.includes(suffix));
      files.push({name:'plotly_renderer.min.js',data:await textFile(script?.src||suffix)});
    }
    if(snapshot.svg)files.push({name:'current_figure.svg',data:snapshot.svg});
    if(snapshot.png)files.push({name:'current_figure.png',data:snapshot.png});
    return files;
  }
  function readme(s,full) {
    return `DG-ABM ${full?'full Shiny app':'selected result + R + data'}\n\nAll current tables are in tables/*.csv. Open tables.html to browse the selected table (or all tables). current_table.csv is the selected table when applicable. Run source("reproduce.R") to rebuild all tables in recomputed_tables/, verify them against the browser snapshot, and reproduce the selected figure when present. table_settings.json records search, feature pair, citation filters, screening thresholds and matrix ordering. Full workbook cells are exported without display truncation. tables_input.json contains descriptive source metadata, including the summary-map coding; these descriptors are preserved, not inferred again.\n\nExported ${s.exported_at}\nFigure: ${s.figure_name}\nActual PCA: ${s.features_used.length} variables, k=${s.k}, ${s.n_pcs} PCs, scope=${s.scope}.\nExcluded: ${s.excluded_features.join(', ')}.\n\n${full?'Run source("run_app.R") in this extracted folder to open the complete Shiny interface with the captured variables, individual/category weights, scope, cluster controls and display switches.\n\n':''}Run source("reproduce.R") to recompute PCA and Ward.D2 clustering from data_used.csv, verify against browser scores and memberships, and create reproduced_figure.html. R installs missing CRAN packages once.\n\nIf no figure was visible during a full-app export, the image files are omitted. Otherwise current_figure.png and current_figure.svg are the exact browser image at export time, including zoom and display options. The SVG of a 3D/WebGL view contains a rasterized layer. figure.json stores its Plotly traces and layout. The R figure uses this captured specification after the numerical checks; the exact Plotly renderer is included; fonts on another computer can still render slightly differently, so the included PNG/SVG is the visual reference.\n\nsettings.json and feature_settings.csv record on/off states, scope, exclusions, weights and resolved k (also when Auto k was on). data_all.csv contains every coded candidate; data_used.csv contains exactly the non-constant, positive-weight variables feeding this image. The PCA script applies the captured effective weights; no recoding or re-imputation is performed.\n\nThe raw workbook snapshot contains the ${s.paper_count} selected records (${s.include_excluded ? 'including the 8 reviewer-excluded papers' : 'retained papers only'}). Internal Comments/Notes and Reader values are omitted, as in the hosted app. The full Shiny metadata views reflect this retained-data snapshot, rather than a private workbook containing excluded records. Stored pca_clustering_results/ CSVs in the full app are historical reference tables; the current PCA is computed live from the captured data and settings. No password or hosting credentials are included.\n`;
  }
  async function download(full) {
    const exportStart=performance.now();
    const buttons=[$('download-snapshot'),$('download-shiny')];buttons.forEach(b=>b.disabled=true);$('download-status').textContent='Capturing settings, tables and figure…';
    try {
      const snapshot=await capture(full),files=await snapshotFiles(snapshot);
      if(full){$('download-status').textContent='Preparing full Shiny source…';if(!window.DGABM_GET_ASSETS)throw new Error('Full Shiny source is available on the hosted encrypted version.');const assets=await window.DGABM_GET_ASSETS();for(const file of assets.files)files.push({name:file.name,data:file.text});}
      files.push({name:'README.txt',data:readme(snapshot.settings,full)});
      const prefix=full?'DGABM_full_shiny':'DGABM_current_view';
      const blob=DGABMZip.zipFiles(files.map(f=>({...f,name:prefix+'/'+f.name})));
      save(blob,prefix+'.zip');$('download-status').dataset.elapsedMs=(performance.now()-exportStart).toFixed(1);$('download-status').textContent=`Downloaded: ${Object.keys(snapshot.tables).length} tables and captured settings.`;
    } catch(error){console.error(error);$('download-status').textContent=error.message;} finally {buttons.forEach(b=>b.disabled=false);refreshFigures();}
  }
  E.setup=()=>{
    $('download-menu').addEventListener('toggle',()=>{if($('download-menu').open)refreshFigures();});
    $('download-snapshot').onclick=()=>download(false);$('download-shiny').onclick=()=>download(true);
  };
})();
