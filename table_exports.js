// Table snapshots use full source values, including cells shortened on screen.
(function () {
  const T = G.tableExports = {};
  T.names = {
    all:'All tables', trait_correlations:'Trait correlations', variable_correlations:'Variable correlations', cluster_summary:'Cluster summary', splits:'Hierarchy splits', cluster_profiles:'Cluster feature profiles', screening:'Feature screening',
    scores:'PCA scores and memberships', loadings:'PCA loadings', variance:'Explained variance',
    feature_matrix:'Binary feature matrix', feature_statistics:'Feature frequencies and variance',
    cooccurrence:'Co-occurrence counts', clustered_cooccurrence:'Clustered co-occurrence counts',
    row_share:'Co-occurrence row shares', phi:'Feature phi correlations', lift:'Feature log2 lift',
    cross_counts:'Selected feature cross-table', cross_statistics:'Cross-table statistics', cross_articles:'Articles with both features',
    citation_edges:'Visible citation edges', citation_all_edges:'All citation edges', citation_nodes:'Citation node statistics',
    citation_counts:'Cluster citation counts', citation_share:'Cluster citation row shares',
    workbook_filtered:'Workbook search results', workbook:'Complete workbook table', dictionary:'Data dictionary'
  };
  T.controls = () => {
    const value = id => G.$(id)?.value || '', radio = name => document.querySelector(`input[name="${name}"]:checked`)?.value;
    return {search:value('dsearch'),feature_a:value('fa'),feature_b:value('fb'),rescaling:radio('resc'),
      citation_focus:+value('cfocus'),citation_depth:+value('cdepth'),citation_scope:radio('cscope'),citation_measure:radio('cmeas'),
      correlation_groups:[...document.querySelectorAll('#corr-groups input:checked')].map(i=>i.value),correlation_order:radio('corder'),correlation_distance:radio('cdist'),component:+value('pcsel'),prevalence_min:+value('sg1'),correlation_max:+value('sg2'),communality_min:+value('sg3')};
  };
  T.build = (settings, current, controls) => {
    const D=G.D,n=G.n,C=G.C,tables={},orders={},labels=f=>G.F[f].label;
    const add=(key,columns,rows)=>tables[key]={title:T.names[key]||key,columns,rows};
    const matrix=(key,keys,values)=>add(key,['feature',...keys],values.map((row,i)=>[keys[i],...row]));
    const keys=G.binKeys,values=D.X.map(row=>keys.map(f=>row[G.col.get(f)]));
    const counts=keys.map((_,a)=>keys.map((_,b)=>values.reduce((sum,row)=>sum+row[a]*row[b],0))),own=counts.map((r,i)=>r[i]);
    add('feature_matrix',['article_id',...keys],values.map((r,i)=>[D.articles[i].id,...r]));
    add('feature_statistics',['feature','label','n_present','prevalence','population_variance','ticked','used_in_PCA'],keys.map((f,i)=>[f,labels(f),own[i],own[i]/n,own[i]/n*(1-own[i]/n),settings.ticked_features.includes(f),settings.features_used.includes(f)]));
    matrix('cooccurrence',keys,counts);
    const traits=keys.filter(f=>G.F[f].group==='traits'),ti=traits.map(f=>keys.indexOf(f));
    matrix('trait_correlations',traits,ti.map(i=>ti.map(j=>{const p=own[i]/n,q=own[j]/n,den=Math.sqrt(p*(1-p)*q*(1-q));return den?(counts[i][j]/n-p*q)/den:null;})));
    const cf=D.features.filter(f=>controls.correlation_groups.includes(f.group)).filter(f=>new Set(D.X.map(r=>r[G.col.get(f.key)])).size>1).map(f=>f.key);
    if(cf.length) {
      const z=cf.map(f=>{const v=D.X.map(r=>r[G.col.get(f)]),mean=G.mean(v),sd=Math.sqrt(v.reduce((s,x)=>s+(x-mean)**2,0)/(n-1));return v.map(x=>(x-mean)/sd);});
      const r=z.map(a=>z.map(b=>a.reduce((s,v,i)=>s+v*b[i],0)/(n-1)));
      let order=cf.map((_,i)=>i);
      if(controls.correlation_order==='cluster'&&cf.length>1){const m=cf.length,d=new Float64Array(m*m);r.forEach((row,i)=>row.forEach((v,j)=>d[i*m+j]=i===j?0:Math.max(0,1-(controls.correlation_distance==='abs'?Math.abs(v):v))));order=C.leafOrder(C.upgma(d,m),m);}
      orders.variable_correlations=order;matrix('variable_correlations',order.map(i=>cf[i]),order.map(i=>order.map(j=>r[i][j])));
    }
    const share=counts.map((r,i)=>r.map(v=>own[i]?v/own[i]:0));
    const phi=counts.map((r,i)=>r.map((v,j)=>{const p=own[i]/n,q=own[j]/n,den=Math.sqrt(p*(1-p)*q*(1-q));return den?(v/n-p*q)/den:0;}));
    const lift=counts.map((r,i)=>r.map((v,j)=>i===j?0:Math.log2((v+.5)/(own[i]*own[j]/n+.5))));
    function ordered(key,mat,kind) {
      const m=keys.length,d=new Float64Array(m*m);
      for(let i=0;i<m;i++)for(let j=0;j<m;j++)if(i!==j){
        d[i*m+j]=kind==='jaccard'?(own[i]+own[j]-counts[i][j]?1-counts[i][j]/(own[i]+own[j]-counts[i][j]):1):kind==='phi'?1-phi[i][j]:Math.sqrt(mat[i].reduce((s,v,k)=>s+((k===i?0:v)-(k===j?0:mat[j][k]))**2,0));
      }
      const order=C.leafOrder(C.upgma(d,m),m);orders[key]=order;
      matrix(key,order.map(i=>keys[i]),order.map(i=>order.map(j=>((key==='phi'||key==='lift')&&i===j)?null:mat[i][j])));
    }
    ordered('clustered_cooccurrence',counts,'jaccard');ordered('row_share',share,'euclidean');ordered('phi',phi,'phi');ordered('lift',lift,'euclidean');
    const a=G.col.get(controls.feature_a),b=G.col.get(controls.feature_b),cross=[[0,0],[0,0]];
    if(a!==undefined&&b!==undefined){
      D.X.forEach(r=>cross[r[a]][r[b]]++);const r0=cross[0][0]+cross[0][1],r1=n-r0,c0=cross[0][0]+cross[1][0],c1=n-c0,den=r0*r1*c0*c1;
      const chi=den?n*Math.max(Math.abs(cross[0][0]*cross[1][1]-cross[0][1]*cross[1][0])-n/2,0)**2/den:0;
      add('cross_counts',['feature_a_value','feature_b_0','feature_b_1','total'],[[0,...cross[0],r0],[1,...cross[1],r1],['total',c0,c1,n]]);
      add('cross_statistics',['statistic','value'],[['n',n],['chi_square_yates',den?chi:null],['p_value',den?G.chi1p(chi):null],['phi',den?(cross[0][0]*cross[1][1]-cross[0][1]*cross[1][0])/Math.sqrt(den):null],...cross.flatMap((row,i)=>row.map((_,j)=>['expected_'+i+j,[r0,r1][i]*[c0,c1][j]/n]))]);
      add('cross_articles',['article_id','authors','title','year'],D.articles.filter((_,i)=>D.X[i][a]&&D.X[i][b]).map(r=>[r.id,r.authors,r.title,r.year]));
    }
    const E=D.edges.map(([a,b])=>[a-1,b-1]).filter(([a,b])=>a>=0&&b>=0&&a<n&&b<n),adj=Array.from({length:n},()=>new Set()),incoming=Array(n).fill(0),outgoing=Array(n).fill(0);
    E.forEach(([a,b])=>{adj[a].add(b);adj[b].add(a);outgoing[a]++;incoming[b]++;});
    let seen=new Set(adj.flatMap((s,i)=>s.size?[i]:[]));
    if(controls.citation_scope==='focus'){seen=new Set([controls.citation_focus]);let front=[controls.citation_focus];for(let d=0;d<controls.citation_depth;d++){const next=[];front.forEach(i=>adj[i]?.forEach(j=>{if(!seen.has(j)){seen.add(j);next.push(j);}}));front=next;}}
    const edgeRows=edges=>edges.map(([a,b])=>[D.articles[a].id,D.articles[b].id,D.articles[a].title,D.articles[b].title]);
    add('citation_all_edges',['citing_id','cited_id','citing_title','cited_title'],edgeRows(E));
    add('citation_edges',['citing_id','cited_id','citing_title','cited_title'],edgeRows(E.filter(([a,b])=>seen.has(a)&&seen.has(b))));
    add('citation_nodes',['article_id','incoming','outgoing','degree','visible','cluster'],D.articles.map((r,i)=>[r.id,incoming[i],outgoing[i],incoming[i]+outgoing[i],seen.has(i),current?current.lab[i]:1]));
    const lab=current?current.lab:Array(n).fill(1),k=current?settings.k:1,cm=Array.from({length:k},()=>Array(k).fill(0));E.forEach(([a,b])=>cm[lab[a]-1][lab[b]-1]++);
    matrix('citation_counts',cm.map((_,i)=>'C'+(i+1)),cm);matrix('citation_share',cm.map((_,i)=>'C'+(i+1)),cm.map(r=>r.map(v=>v/(r.reduce((a,b)=>a+b,0)||1))));
    const rawcols=['article_id',...D.dict.map(d=>'column_'+d.col)];
    const rawrows=D.raw.map((row,i)=>[D.articles[i].id,...row]);add('workbook',rawcols,rawrows);
    const q=controls.search.toLowerCase();add('workbook_filtered',rawcols,rawrows.filter(row=>row.slice(1).some(v=>String(v??'').toLowerCase().includes(q))));
    add('dictionary',['column','name','full','roles','feeds'],D.dict.map(d=>[d.col,d.name,d.full,JSON.stringify(d.roles),JSON.stringify(d.feeds)]));
    const suggest=G.ext.suggest(controls.prevalence_min,controls.correlation_max,controls.communality_min),scols=['feature','label','category','type','prevalence','maxr','similar','comm','decision','reason'];
    add('screening',[...scols,'ticked'],suggest.map(r=>[...scols.map(k=>r[k]),settings.ticked_features.includes(r.feature)]));
    if(current){
      const {R,lab}=current,P=R.P,pc=P.loadings.map((_,i)=>'PC'+(i+1));
      add('scores',['article_id','cluster',...pc],P.scores.map((row,i)=>[D.articles[i].id,lab[i],...row]));
      add('loadings',['feature',...pc],R.feats.map((f,i)=>[f,...P.loadings.map(row=>row[i])]));
      add('variance',['component','explained_percent','cumulative_percent','retained'],P.explained.map((v,i)=>[i+1,v,P.cumulative[i],i<P.nPc]));
      const bin=R.feats.filter(f=>G.F[f].binary),prev=(f,ids)=>ids.reduce((s,i)=>s+D.X[i][G.col.get(f)],0)/ids.length;
      const contrast=(ids,rest)=>bin.map(f=>({f,d:100*(prev(f,ids)-prev(f,rest))})).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));
      const fmt=arr=>arr.map(v=>labels(v.f)+' '+(v.d>=0?'+':'')+Math.round(v.d)+' pp').join(', ');
      const sil=C.silhouette(lab,R.D,n).perArticle,all=Array.from({length:n},(_,i)=>i),summary=[],profiles=[];
      for(let c=1;c<=settings.k;c++){
        const ids=all.filter(i=>lab[i]===c),rest=all.filter(i=>lab[i]!==c),top=bin.map(f=>({f,v:prev(f,ids)})).sort((a,b)=>b.v-a.v);
        summary.push([c,ids.length,100*ids.length/n,G.mean(ids.map(i=>sil[i])),ids.filter(i=>D.articles[i].model).length,top.slice(0,3).map(v=>labels(v.f)+' '+Math.round(100*v.v)+'%').join(', '),fmt(contrast(ids,rest).slice(0,2))]);
        bin.forEach(f=>profiles.push([c,f,prev(f,ids),prev(f,rest),100*(prev(f,ids)-prev(f,rest))]));
      }
      add('cluster_summary',['cluster','papers','share_percent','mean_silhouette','model_papers','most_frequent_features','contrast_vs_rest'],summary);
      add('cluster_profiles',['cluster','feature','prevalence','rest_prevalence','difference_pp'],profiles);
      const byId=new Map(R.merges.map(q=>[q.id,q])),leaves=id=>{if(id<n)return[id];const q=byId.get(id);return[...leaves(q.b),...leaves(q.a)];};
      add('splits',['k','parent_size','child_a','size_a','child_b','size_b','merge_height','separating_features'],R.ks.map(k=>{const q=R.merges[n-k],a=leaves(q.a),b=leaves(q.b),lb=C.cutree(R.merges,n,k);return[k,a.length+b.length,lb[a[0]],a.length,lb[b[0]],b.length,q.height,fmt(contrast(a,b).slice(0,3))];}));
    }
    return {tables,orders};
  };
})();
