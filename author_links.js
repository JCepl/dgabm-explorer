// Conservative surname + initials matching. Ambiguous author strings are skipped.
(function(root){
  const key=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
  function parse(text){
    const authors=new Map();let unresolved=0;
    for(const chunk of String(text||'').split(/;|\s+(?:&|and)\s+/i)){
      const tokens=[...chunk.trim().matchAll(/(?:^|,\s*)([^,]+),\s*([A-Za-z.\s-]+?)(?=,\s*[^,]+,|$)/g)];
      if(!tokens.length&&chunk.trim())unresolved++;
      for(const m of tokens){if(key(m[2]).length>6){unresolved++;continue;}const surname=key(m[1]),initials=key(m[2]);if(surname&&initials)authors.set(surname+':'+initials,m[1].trim()+', '+m[2].replace(/[.\s-]/g,''));}

    }
    return{authors,unresolved};
  }
  function links(articles){const parsed=articles.map(a=>parse(a.authors)),edges=[];for(let i=0;i<articles.length;i++)for(let j=i+1;j<articles.length;j++){const shared=[...parsed[i].authors].filter(([k])=>parsed[j].authors.has(k)).map(([,label])=>label);if(shared.length)edges.push({a:i,b:j,authors:shared});}return{edges,unresolved:parsed.reduce((s,r)=>s+r.unresolved,0)};}
  root.DGABMAuthors={parse,links};if(typeof module!=='undefined')module.exports=root.DGABMAuthors;
})(typeof window!=='undefined'?window:globalThis);
