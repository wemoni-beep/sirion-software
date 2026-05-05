const B={claude:{name:"Claude",color:"#A78BFA",short:"Cla"},openai:{name:"ChatGPT",color:"#22c55e",short:"Cha"},gemini:{name:"Gemini",color:"#38BDF8",short:"Gem"},perplexity:{name:"Perplexity",color:"#06b6d4",short:"Ppl"}};function l(p){return(p||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function L(p){return isNaN(p)?0:Math.round(p)}function U(p){return p>=70?"success":p>=40?"warning":"danger"}function K(p){return p<=1?"var(--success)":p<=3?"var(--info)":p<=5?"var(--warning)":"var(--danger)"}function at(p){const c=(p?.contentGaps||[]).filter(n=>n?.schemaVersion===2);if(!c.length)return"";const h={},C={critical:0,high:0,medium:0,low:0};c.forEach(n=>{h[n.type]=(h[n.type]||0)+1,C[n.severityLabel]!=null&&C[n.severityLabel]++});const o=[...c].sort((n,t)=>(t.severityScore||0)-(n.severityScore||0)).slice(0,10),d=Object.entries(h).sort((n,t)=>t[1]-n[1]).map(([n,t])=>`<span class="badge">${l(n)} · ${t}</span>`).join(" "),f=Object.entries(C).filter(([,n])=>n>0).map(([n,t])=>`<span class="badge badge-${n==="critical"?"danger":n==="high"?"warning":n==="medium"?"info":"muted"}">${l(n)} · ${t}</span>`).join(" "),y=o.map((n,t)=>`
    <tr>
      <td>${t+1}</td>
      <td class="mono">${l(n.type)}</td>
      <td class="right" style="font-weight:700">${n.severityScore}</td>
      <td>${l(n.severityLabel)}</td>
      <td title="${l(n.query||"")}">${l((n.query||"").slice(0,90))}${(n.query||"").length>90?"…":""}</td>
      <td>${l(n.model||"—")}</td>
      <td class="small">${l((n.auditTrail?.rationale||"").slice(0,140))}</td>
    </tr>`).join("");return`
    <section class="report-section">
      <div class="section-header">
        <span class="section-title">Content Gaps (classifier output)</span>
        <span class="section-subtitle">${c.length} actionable · ${f||""}</span>
      </div>
      <div style="margin-bottom:10px">${d}</div>
      <table class="report-table">
        <thead><tr><th>#</th><th>Type</th><th class="right">Score</th><th>Label</th><th>Query</th><th>Model</th><th>Rationale</th></tr></thead>
        <tbody>${y}</tbody>
      </table>
    </section>`}function nt(p){const c=Array.isArray(p?.results)?p.results:[];if(!c.length)return"";const h=c.slice(0,200).map((o,d)=>{const f=(p.llms||[]).map(n=>{const t=o.analyses?.[n];if(!t||t._error)return'<td class="small muted">—</td>';const v=t.mentioned?"✓":"·",i=t.rank!=null?`#${t.rank}`:"—",e=t.sentiment||"—";return`<td class="small">${v} ${i} · ${l(e)}</td>`}).join(""),y=[...new Set(Object.values(o.analyses||{}).flatMap(n=>(n?.cited_sources||[]).map(t=>t?.domain).filter(Boolean)))].slice(0,3).join(", ");return`<tr>
      <td>${d+1}</td>
      <td class="small mono">${l(o.qid||"")}</td>
      <td title="${l(o.query||"")}">${l((o.query||"").slice(0,100))}${(o.query||"").length>100?"…":""}</td>
      <td class="small">${l(o.persona||"")}</td>
      <td class="small">${l(o.stage||"")}</td>
      ${f}
      <td class="small muted">${l(y||"—")}</td>
    </tr>`}).join(""),C=(p.llms||[]).map(o=>`<th class="small">${l(B[o]?.name||o)}</th>`).join("");return`
    <section class="report-section">
      <div class="section-header">
        <span class="section-title">Raw Data Appendix</span>
        <span class="section-subtitle">Per-query per-model snapshot · ${c.length} queries ${c.length>200?"(showing first 200)":""}</span>
      </div>
      <div style="overflow-x:auto">
        <table class="report-table">
          <thead><tr>
            <th>#</th><th>QID</th><th>Query</th><th class="small">Persona</th><th class="small">Stage</th>
            ${C}
            <th class="small">Top cited domains</th>
          </tr></thead>
          <tbody>${h}</tbody>
        </table>
      </div>
    </section>`}function it(p){const{company:c,scanDate:h,queryCount:C,llmCount:o,llms:d,visibility:f,avgRank:y,sentiment:n,perLlmVis:t,scores:v,verifiability:i,fiveMetrics:e,personaBk:s,stageBk:m,compMentions:g}=p,a=n.positive+n.neutral+n.negative||1,u=L(n.positive/a*100),$=L(n.neutral/a*100),r=L(n.negative/a*100);let w="";f>=80?w=`Strong AI visibility at ${f}% — ${c} is well-positioned across AI platforms.`:f>=50?w=`Moderate visibility at ${f}% — room to improve AI presence for ${c}.`:w=`Critical visibility gap at ${f}% — ${c} needs urgent AI presence optimization.`;const k=S=>S==null?"var(--muted)":S>=50?"var(--success)":S>=25?"var(--warning)":"var(--danger)",P=S=>S==null?"var(--muted)":S>=75?"var(--success)":S>=50?"var(--warning)":"var(--danger)",b=(S,E="")=>S==null?"—":`${S}${E}`,A=v||{},x=i||{},R=A.overall??null,I=A.mention??f??null,_=A.position??null,q=A.sentiment??null,j=A.accuracy??null,T=A.shareOfVoice??e?.shareOfVoice?.value??null,G=x.avgCitationsPerQuery??null,D=x.uniqueDomains??null,N=x.truthfulnessRate??(x.hallucinationRate!=null?100-x.hallucinationRate:null),z=x.consistencyRate??null,Y=[{label:"Overall",val:b(R),color:k(R),sub:"mention × 0.35 + position × 0.40 + sentiment × 0.25"},{label:"Mention %",val:b(I,"%"),color:k(I),sub:"% of (q × LLM) analyses naming "+c},{label:"Position",val:b(_),color:k(_),sub:"avg score when ranked · rank 1 = 100"},{label:"Sentiment",val:b(q),color:k(q),sub:`${u}% pos · ${$}% neu · ${r}% neg`},{label:"Accuracy",val:b(j),color:k(j),sub:"Stage 2 Haiku 1-10 × 10"},{label:"Share of Voice",val:b(T,"%"),color:k(T),sub:c+" ÷ total vendor mentions"},{label:"Avg citations / Q",val:b(G),color:"var(--accent)",sub:"pooled across models × N"},{label:"Unique domains",val:b(D),color:"var(--accent)",sub:"distinct hostnames cited"},{label:"Truthfulness %",val:b(N,"%"),color:P(N),sub:x.vendorsChecked!=null?`${x.vendorsChecked-(x.unsupportedClaims||0)}/${x.vendorsChecked} vendors backed`:"vendor names backed by source content"},{label:"Consistency %",val:z==null?"—":b(z,"%"),color:P(z),sub:z==null?"Quick scans have no comparison":`across ${x.consistencyAnalysesCounted||0} N≥2 analyses`}].map(S=>`
    <div class="stat-card">
      <div class="stat-value" style="color:${S.color}">${S.val}</div>
      <div class="stat-label">${l(S.label)}</div>
      <div class="stat-sub">${l(S.sub)}</div>
    </div>`).join(""),J=(d||[]).map(S=>{const E=B[S]||{name:S,color:"#888"},M=t[S]||0;return`<div class="bar-item">
      <span class="bar-label" style="color:${E.color}">${l(E.name)}</span>
      <div class="bar-track"><div class="bar-fill ${U(M)}" style="width:${Math.max(M,2)}%"><span class="bar-fill-text">${M}%</span></div></div>
    </div>`}).join(""),O=[];x.analysesCounted!=null&&O.push(`${x.analysesCounted} analyses`),G!=null&&O.push(`avg ${G} citations per answer`),D!=null&&O.push(`${D} unique domains`);const X=O.length?`<div class="stat-sub" style="margin-top:12px;text-align:left">${O.join(" · ")}.${N!=null&&x.vendorsChecked>0?` <strong style="color:${P(N)}">${N}%</strong> of competitor names backed by a matching cited source (${x.vendorsChecked-(x.unsupportedClaims||0)}/${x.vendorsChecked} vendors verified).`:""}${z!=null?` <strong style="color:${P(z)}">${z}%</strong> response consistency across ${x.consistencyAnalysesCounted||0} N≥2 analyses.`:""}</div>`:"",H=(S,E)=>(S||[]).map(M=>{const V=M.rate??0,F=E?E(V):"var(--accent)";return`<div class="seg-row">
      <span class="seg-label">${l(M.label||M.id)}</span>
      <div class="seg-track"><div class="seg-fill" style="width:${Math.max(V,2)}%;background:${F}"><span class="seg-fill-text">${V}%</span></div></div>
      <span class="seg-value" style="color:${F}">${V}% · ${M.count||0} Qs</span>
    </div>`}).join(""),Q=S=>S>=70?"var(--success)":S>=40?"var(--warning)":"var(--danger)",Z=(d||[]).map(S=>({label:B[S]?.name||S,rate:t?.[S]??0,count:C})),tt=`
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:24px">
      <div><div class="card-title">By Persona</div>${H(s,Q)||'<div class="stat-sub">No persona data.</div>'}</div>
      <div><div class="card-title">By Stage</div>${H(m,Q)||'<div class="stat-sub">No stage data.</div>'}</div>
      <div><div class="card-title">By Model</div>${H(Z,Q)}</div>
    </div>`,W=(g||[]).slice(0,10).map((S,E)=>`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem">
      <span><span style="color:var(--muted);margin-right:6px">${E+1}.</span>${l(S.name||"—")}</span>
      <span style="color:var(--muted);font-variant-numeric:tabular-nums">${S.count||0}×</span>
    </div>`).join(""),et=W?`
    <div style="margin-top:24px">
      <div class="card-title">Top Competitors</div>
      ${W}
    </div>`:"";return`
    <div class="hero">
      <div class="hero-badge">AI Perception Audit Report</div>
      <div class="hero-title">${l(c)} AI Visibility</div>
      <div class="hero-accent">${w}</div>
      <div class="hero-meta">
        <div class="hero-meta-item"><span class="hero-meta-dot"></span> ${l(h)}</div>
        <div class="hero-meta-item"><span class="hero-meta-dot"></span> ${C} Queries Analyzed</div>
        <div class="hero-meta-item"><span class="hero-meta-dot"></span> ${o} AI Platforms</div>
      </div>
      <div class="stat-grid" style="margin-top:24px">${Y}</div>
      ${X}
      <div class="card-title" style="margin-top:20px">Per-Platform Visibility</div>
      <div class="bar-chart">${J}</div>
      ${tt}
      ${et}
    </div>`}function ot(p){const{company:c,llms:h,results:C,sentiment:o,perLlmVis:d}=p,f=(c||"").toLowerCase(),y=o.positive+o.neutral+o.negative||1,n=L(o.positive/y*100),t=L(o.neutral/y*100),v=L(o.negative/y*100),i={},e={};(C||[]).forEach(a=>{const u=a._cluster||a.cw||a.lifecycle||"General";(h||[]).forEach($=>{const r=a.analyses?.[$];!r||r._error||(i[u]||(i[u]={}),e[u]||(e[u]={positive:0,neutral:0,negative:0,total:0}),e[u].total++,r.sentiment&&(e[u][r.sentiment]=(e[u][r.sentiment]||0)+1),(r.vendors_mentioned||[]).forEach(w=>{i[u][w.name]=(i[u][w.name]||0)+1}))})});const s=Object.entries(i).map(([a,u])=>{const $=Object.entries(u).sort((R,I)=>I[1]-R[1]),r=$[0]||["—",0],w=Object.entries(u).find(([R])=>R.toLowerCase().includes(f))?.[1]||0,k=r[0].toLowerCase().includes(f),P=$.reduce((R,[,I])=>R+I,0),b=e[a]||{positive:0,total:1},A=L(b.positive/b.total*100);let x="Attack";return k?x="Defend":w>0&&w>=r[1]*.6?x="Compete":P<=2&&(x="Ignore"),{theme:a,owner:r[0],ownerCount:r[1],companyCount:w,ownerIsCompany:k,totalMentions:P,sentPct:A,strategy:x,total:b.total}}).sort((a,u)=>u.total-a.total),m=s.map(a=>{a.sentPct>=70||a.sentPct>=40;const u=a.ownerIsCompany?`<span class="badge badge-success">${l(c)} (${a.ownerCount}x)</span>`:`<span class="badge badge-danger">${l(a.owner)} (${a.ownerCount}x)</span>`,$=a.strategy==="Defend"?"var(--success)":a.strategy==="Compete"?"var(--info)":a.strategy==="Attack"?"var(--warning)":"var(--text-muted)",r=`<span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;background:${$}15;color:${$};text-transform:uppercase;letter-spacing:0.03em">${a.strategy}</span>`;return`<tr>
      <td style="font-weight:600;text-transform:capitalize">${l(a.theme.replace(/_/g," "))}</td>
      <td class="center">${u}</td>
      <td class="center" style="font-weight:700;color:${a.companyCount>0?"var(--accent)":"var(--text-muted)"}">${a.companyCount}x</td>
      <td class="center">${a.totalMentions}</td>
      <td class="center">${r}</td>
    </tr>`}).join(""),g=`<div style="display:flex;height:28px;border-radius:6px;overflow:hidden;margin:12px 0">
    ${n>0?`<div style="flex:${n};background:var(--success);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff">${n}%</div>`:""}
    ${t>0?`<div style="flex:${t};background:var(--warning);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff">${t}%</div>`:""}
    ${v>0?`<div style="flex:${v};background:var(--danger);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff">${v}%</div>`:""}
  </div>
  <div style="display:flex;gap:16px;font-size:0.78rem;color:var(--text-secondary)">
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--success);margin-right:4px"></span>Positive ${n}%</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--warning);margin-right:4px"></span>Neutral ${t}%</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--danger);margin-right:4px"></span>Negative ${v}%</span>
  </div>`;return`
    <div class="section">
      <div class="section-header">
        <span class="section-number">2</span>
        <span class="section-title">AI Perception</span>
        <div class="section-subtitle">How AI perceives ${l(c)} — sentiment when mentioned and who owns each narrative theme</div>
      </div>
      <div class="card">
        <div class="card-title">Overall Sentiment When ${l(c)} Is Mentioned</div>
        ${g}
      </div>
      ${s.length>0?`
        <div class="card">
          <div class="card-title">Narrative Ownership by Theme</div>
          <div class="section-subtitle" style="margin-bottom:12px;font-size:0.78rem">
            <strong>Sentiment</strong> = how AI describes ${l(c)} in that theme. <strong>Owner</strong> = which vendor AI mentions most. High sentiment + low ownership = AI likes you but doesn't talk about you enough.
          </div>
          <table class="data-table">
            <thead><tr>
              <th>Theme</th><th class="center">Owner</th><th class="center">${l(c)}</th><th class="center">Weight</th><th class="center">Action</th>
            </tr></thead>
            <tbody>${m}</tbody>
          </table>
        </div>
      `:""}
    </div>`}function lt(p){const{llms:c,results:h,perLlmVis:C,perLlmRank:o,sentPerLlm:d,company:f}=p,y=(c||[]).map(t=>{const v=B[t]||{name:t,color:"#888"},i=C[t]||0,e=o[t]||0,s=d[t]||{positive:0,neutral:0,negative:0},m=s.positive+s.neutral+s.negative||1,g=L(s.positive/m*100);let a=0,u=0;return(h||[]).forEach($=>{const r=$.analyses?.[t];r&&!r._error&&(u++,r.mentioned&&a++)}),`<tr>
      <td style="font-weight:700;color:${v.color}">${l(v.name)}</td>
      <td class="center"><span class="badge badge-${U(i)}">${i}%</span></td>
      <td class="center" style="font-weight:700;color:${K(e)}">${e>0?"#"+e.toFixed(1):"—"}</td>
      <td class="center">${g}%</td>
      <td class="center" style="font-weight:700">${a}/${u}</td>
    </tr>`}).join(""),n=(c||[]).map(t=>{const v=B[t]||{name:t,color:"#888"},i=C[t]||0;let e=0,s=0;(h||[]).forEach(g=>{const a=g.analyses?.[t];a&&!a._error&&(s++,a.mentioned&&e++)});const m=p.perLlmRank[t]||0;return`<div class="plat-card" style="border-top:3px solid ${v.color}">
      <div class="plat-name" style="color:${v.color}">${l(v.name)}</div>
      <div class="plat-score" style="color:${i>=70?"var(--success)":i>=40?"var(--warning)":"var(--danger)"}">${i}%</div>
      <div class="plat-detail">${e}/${s} queries cited${m>0?` · Avg rank #${m.toFixed(1)}`:""}</div>
    </div>`}).join("");return`
    <div class="section">
      <div class="section-header">
        <span class="section-number">3</span>
        <span class="section-title">Platform Scorecard</span>
        <div class="section-subtitle">How ${l(f)} performs on each AI platform</div>
      </div>
      <div class="plat-grid">${n}</div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">Platform Comparison</div>
        <table class="data-table">
          <thead><tr>
            <th>Platform</th><th class="center">Visibility</th><th class="center">Avg Rank</th><th class="center">Positive %</th><th class="center">Cited</th>
          </tr></thead>
          <tbody>${y}</tbody>
        </table>
      </div>
    </div>`}function rt(p){const{compMentions:c,llms:h,results:C,company:o,shareOfVoice:d}=p,f=(o||"").toLowerCase(),y={};(C||[]).forEach(i=>{(h||[]).forEach(e=>{const s=i.analyses?.[e];!s||s._error||(s.vendors_mentioned||[]).forEach(m=>{y[m.name]||(y[m.name]={}),y[m.name][e]=(y[m.name][e]||0)+1})})});const t=(c||[]).slice(0,10).map(i=>{const e=i.name.toLowerCase().includes(f),s=y[i.name]||{},m=(h||[]).map(a=>{const u=s[a]||0,$=B[a]||{color:"#888"};return`<td class="center" style="font-weight:700;${u>0?"color:"+$.color:"color:var(--text-muted)"}">${u||"—"}</td>`}).join(""),g=(h||[]).map(a=>{const u=s[a]||0,$=B[a]||{color:"#888"};return u>0?`<div class="stacked-seg" style="flex:${u};background:${$.color}">${u}</div>`:""}).join("");return`<tr class="${e?"highlight":""}">
      <td style="${e?"font-weight:800":""}">${l(i.name)}</td>
      ${m}
      <td class="center" style="font-weight:800">${i.m}</td>
      <td style="width:25%"><div class="stacked-bar">${g}</div></td>
    </tr>`}).join(""),v=(h||[]).map(i=>{const e=B[i]||{name:i};return`<th class="center" style="color:${e.color}">${l(e.name)}</th>`}).join("");return`
    <div class="section">
      <div class="section-header">
        <span class="section-number">4</span>
        <span class="section-title">AI Visibility Leaderboard</span>
        <div class="section-subtitle">Who owns the AI conversation — total citations across all platforms${d?` · ${l(o)} share of voice: ${L(d)}%`:""}</div>
      </div>
      <div class="card">
        <table class="data-table">
          <thead><tr>
            <th>Vendor</th>${v}<th class="center">Total</th><th>Distribution</th>
          </tr></thead>
          <tbody>${t}</tbody>
        </table>
      </div>
    </div>`}function ct(p){const{results:c,llms:h,company:C}=p,o=(h||[]).map(s=>{const m=B[s]||{name:s,color:"#888"};return`<th class="center" style="min-width:80px"><span style="color:${m.color};font-weight:700">${l(m.name)}</span></th>`}).join("");let d=0,f=0,y=0;const n=(c||[]).map((s,m)=>{let g=0;const a=(h||[]).map(r=>{const w=s.analyses?.[r];if(!w||w._error)return'<td class="center" style="color:var(--text-muted)">—</td>';if(w.mentioned){g++;const k=w.rank?`#${w.rank}`:"✓",P=w.sentiment==="positive"?"P":w.sentiment==="negative"?"N":"A",b=w.sentiment==="positive"?"var(--success)":w.sentiment==="negative"?"var(--danger)":"var(--warning)";return`<td class="center"><span style="color:${w.rank<=1?"var(--success)":w.rank<=3?"var(--info)":w.rank<=5?"var(--warning)":"var(--danger)"};font-weight:700">${k}</span> <span style="font-size:0.7rem;color:${b};font-weight:600">${P}</span></td>`}return'<td class="center"><span style="color:var(--danger);font-weight:700">✗</span></td>'}).join(""),u=(h||[]).length;let $;return g===u?($='<span class="badge badge-success" style="font-size:0.7rem">● Strong</span>',d++):g>0?($='<span class="badge badge-warning" style="font-size:0.7rem">⚠ Weak</span>',f++):($='<span class="badge badge-danger" style="font-size:0.7rem">✗ Lost</span>',y++),`<tr>
      <td style="font-size:0.78rem;max-width:320px">${l(s.query)}</td>
      ${a}
      <td class="center">${$}</td>
    </tr>`}).join(""),t=(c||[]).length,v=t?Math.round(d/t*100):0,i=t?Math.round(f/t*100):0,e=t?Math.round(y/t*100):0;return`
    <div class="section">
      <div style="display:flex;align-items:center;gap:10px;padding-bottom:16px;border-bottom:2px solid var(--bg-tertiary);margin-bottom:20px">
        <span class="section-number">5</span>
        <span class="section-title">Query Summary</span>
      </div>
      <div class="section-subtitle" style="margin-bottom:16px">How ${l(C)} appears across ${t} queries on each AI platform. ✓ = mentioned, ✗ = absent, rank shown when available. Sentiment: P = Positive, N = Negative, A = Neutral/Absent.</div>

      <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--success);display:inline-block"></span>
          <span style="font-size:0.82rem;font-weight:600">Strong: ${d}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">(${v}%)</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--warning);display:inline-block"></span>
          <span style="font-size:0.82rem;font-weight:600">Weak: ${f}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">(${i}%)</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--danger);display:inline-block"></span>
          <span style="font-size:0.82rem;font-weight:600">Lost: ${y}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">(${e}%)</span>
        </div>
      </div>

      <div class="card" style="overflow-x:auto">
        <table class="data-table">
          <thead><tr>
            <th>Query</th>
            ${o}
            <th class="center">Status</th>
          </tr></thead>
          <tbody>${n}</tbody>
        </table>
      </div>
    </div>`}function dt(p){const{results:c,llms:h,company:C}=p,o={};let d=0;(c||[]).forEach(i=>{(h||[]).forEach(e=>{const s=i.analyses?.[e],m=B[e]||{name:e};(s?.cited_sources||s?.sources_cited||[]).forEach(a=>{if(!a)return;const u=typeof a=="string"?a:typeof a.url=="string"?a.url:"";if(!u||u==="training_knowledge")return;d++;const r=(typeof a=="object"&&typeof a.domain=="string"?a.domain:"")||u.replace(/^https?:\/\/(www\.)?/,"").replace(/\/.*/,"");o[r]||(o[r]={domain:r,count:0,urls:new Set,types:new Set,llms:new Set,snippets:[]}),o[r].count++,o[r].urls.add(u),typeof a=="object"&&a.type&&o[r].types.add(a.type),o[r].llms.add(m.name);const w=typeof a=="object"?a.excerpt||a.context||a.snippet:null;w&&o[r].snippets.length<3&&o[r].snippets.push(w)})})});const f=Object.values(o).sort((i,e)=>e.count-i.count);if(f.length===0)return`
      <div class="section">
        <div class="section-header">
          <span class="section-number">6</span>
          <span class="section-title">Source Intelligence</span>
          <div class="section-subtitle">No source citations were captured in this scan. Re-run with updated prompts to capture sources.</div>
        </div>
      </div>`;const y=f[0]?.count||1,n=f.slice(0,15).map((i,e)=>{const s=L(i.count/y*100),m=[...i.types].map(a=>`<span class="badge badge-muted" style="font-size:0.55rem;margin-right:2px">${l(a)}</span>`).join(""),g=[...i.llms].map(a=>{const u=Object.entries(B).find(([,r])=>r.name===a);return`<span style="font-size:0.65rem;font-weight:700;color:${u?u[1].color:"#888"}">${l(a)}</span>`}).join(", ");return`<tr>
      <td style="font-weight:700;font-size:0.82rem">${e+1}. ${l(i.domain)}</td>
      <td style="width:30%"><div class="bar-track" style="height:20px"><div class="bar-fill accent" style="width:${s}%"><span class="bar-fill-text">${i.count}</span></div></div></td>
      <td style="font-size:0.75rem">${m}</td>
      <td style="font-size:0.75rem">${g}</td>
    </tr>`}).join(""),t={};f.forEach(i=>{[...i.types].forEach(e=>{t[e]=(t[e]||0)+i.count})});const v=Object.entries(t).sort((i,e)=>e[1]-i[1]).map(([i,e])=>`<div class="seg-row">
      <span class="seg-label">${l(i)}</span>
      <div class="seg-track"><div class="seg-fill" style="width:${L(e/d*100)}%;background:var(--info)"><span class="seg-fill-text">${e}</span></div></div>
      <span class="seg-value" style="color:var(--info)">${L(e/d*100)}%</span>
    </div>`).join("");return`
    <div class="section">
      <div class="section-header">
        <span class="section-number">6</span>
        <span class="section-title">Source Intelligence</span>
        <div class="section-subtitle">Which websites and publications are shaping AI perception — ${d} source citations across ${f.length} domains</div>
      </div>
      <div class="callout" style="margin-bottom:16px">
        <div class="callout-title">Why This Matters</div>
        <div class="callout-text">These are the websites AI platforms reference when answering buyer queries about ${l(C)} and competitors. To shift AI perception, create and optimize content on these domains.</div>
      </div>
      <div class="card">
        <div class="card-title">Most Cited Domains</div>
        <table class="data-table">
          <thead><tr><th>Domain</th><th>Citations</th><th>Type</th><th>Platforms</th></tr></thead>
          <tbody>${n}</tbody>
        </table>
      </div>
      ${v?`<div class="card"><div class="card-title">Source Type Breakdown</div>${v}</div>`:""}
    </div>`}function pt(p){const{personaBk:c,stageBk:h,clmStageBk:C}=p;function o(d,f,y){return d.map(n=>{const t=n[y]||0,v=t>=70?"var(--success)":t>=40?"var(--warning)":"var(--danger)";return`<div class="seg-row">
        <span class="seg-label">${l(n[f])}</span>
        <div class="seg-track"><div class="seg-fill" style="width:${Math.max(t,2)}%;background:${v}"><span class="seg-fill-text">${t}%</span></div></div>
        <span class="seg-value" style="color:${v}">${t}%</span>
      </div>`}).join("")}return`
    <div class="section">
      <div class="section-header">
        <span class="section-number">7</span>
        <span class="section-title">Segment Breakdown</span>
        <div class="section-subtitle">Visibility by persona, buying stage, and CLM lifecycle</div>
      </div>
      <div class="card">
        <div class="card-title">By Buyer Persona</div>
        ${o(c||[],"persona","rate")}
      </div>
      <div class="card">
        <div class="card-title">By Buying Stage</div>
        ${o(h||[],"stage","rate")}
      </div>
      <div class="card">
        <div class="card-title">By CLM Lifecycle</div>
        ${o(C||[],"label","rate")}
      </div>
    </div>`}function vt(p){const{clmStageBk:c,results:h,llms:C,company:o,fiveMetrics:d}=p;let f,y,n,t,v;if(d?.narrative&&(d.narrative.preSigPct!=null||d.narrative.postSigPct!=null||d.narrative.fullStackPct!=null))f=L(d.narrative.preSigPct||0),y=L(d.narrative.postSigPct||0),n=L(d.narrative.fullStackPct||0),t=0,(h||[]).forEach(s=>{(C||[]).forEach(m=>{const g=s.analyses?.[m];g&&!g._error&&g.mentioned&&t++})}),t=t||1,v="fiveMetrics.narrative (scanEngine.classifyNarrative)";else{const s={"pre-signature":0,"post-signature":0,"full-stack":0,total:0},m=["pre-signature","pre-deal","evaluation","authoring","drafting","negotiation","redlining","intake","request"],g=["post-signature","obligation","compliance","renewal","performance","spend","implementation","adoption"];(h||[]).forEach(a=>{(C||[]).forEach(u=>{const $=a.analyses?.[u];if(!$||$._error||!$.mentioned)return;const r=($.rawText||$.summary||$.narrative||"").toLowerCase(),w=m.some(P=>r.includes(P)),k=g.some(P=>r.includes(P));s.total++,w&&k?s["full-stack"]++:w?s["pre-signature"]++:k?s["post-signature"]++:s["full-stack"]++})}),t=s.total||1,f=L(s["pre-signature"]/t*100),y=L(s["post-signature"]/t*100),n=L(s["full-stack"]/t*100),v="legacy keyword-match fallback"}const i=y>40?`<div class="callout" style="border-left:3px solid var(--danger);margin-top:12px;padding:10px 14px"><strong style="color:var(--danger)">Post-Signature Bias Detected.</strong> ${y}% of AI responses frame ${l(o)} in post-signature context. Content strategy should prioritize pre-signature topics to shift this.</div>`:"",e=[{label:"Pre-Signature",pct:f,color:"#3b82f6"},{label:"Post-Signature",pct:y,color:"#10b981"},{label:"Full-Stack",pct:n,color:"#a78bfa"}].map(s=>`<div class="seg-row">
    <span class="seg-label">${s.label}</span>
    <div class="seg-track"><div class="seg-fill" style="width:${Math.max(s.pct,2)}%;background:${s.color}"><span class="seg-fill-text">${s.pct}%</span></div></div>
    <span class="seg-value" style="color:${s.color};font-weight:800">${s.pct}%</span>
  </div>`).join("");return(c||[]).map(s=>{const m=s.id==="pre-signature"?"#3b82f6":s.id==="post-signature"?"#10b981":"#a78bfa";return`<div class="seg-row">
      <span class="seg-label">${l(s.label)} (${s.count} queries)</span>
      <div class="seg-track"><div class="seg-fill" style="width:${Math.max(s.rate,2)}%;background:${m}"><span class="seg-fill-text">${s.rate}%</span></div></div>
      <span class="seg-value" style="color:${m}">${s.rate}%</span>
    </div>`}).join(""),`
    <div class="section">
      <div class="section-header">
        <span class="section-number">7A</span>
        <span class="section-title">Lifecycle Bias</span>
        <div class="section-subtitle">How AI distributes ${l(o)} across the contract lifecycle — the perception Content Strategy needs to shift</div>
      </div>
      <div class="card">
        <div class="card-title">AI Narrative Distribution</div>
        <div class="section-subtitle" style="margin-bottom:12px;font-size:0.78rem">Based on how AI describes ${l(o)} in ${t} mentioned responses. Source: ${v}.</div>
        ${e}
        ${i}
      </div>
      <!-- Visibility by Lifecycle Category removed — already shown in Perception section -->
    </div>`}function ut(p){const{llms:c,results:h,company:C}=p,o=(C||"").toLowerCase(),d={};(c||[]).forEach(v=>{let i=0,e=0;(h||[]).forEach(s=>{const m=s.analyses?.[v];if(!m||m._error)return;e++;const g=m.citations||[],a=m.sources||[],u=m.cited_sources||m.sources_cited||[];(g.some(r=>(r||"").toLowerCase().includes(o))||a.some(r=>(r||"").toLowerCase().includes(o))||u.some(r=>((r?.url||"")+" "+(r?.domain||"")+" "+(r?.title||"")+" "+(r?.excerpt||r?.context||r?.snippet||"")).toLowerCase().includes(o)))&&i++}),d[v]={cited:i,total:e,rate:e>0?L(i/e*100):0}});const f=Object.values(d).reduce((v,i)=>v+i.cited,0),y=Object.values(d).reduce((v,i)=>v+i.total,0),n=y>0?L(f/y*100):0,t=(c||[]).map(v=>{const i=B[v]||{name:v,color:"#888"},e=d[v]||{cited:0,total:0,rate:0};return`<div class="seg-row">
      <span class="seg-label" style="color:${i.color};font-weight:600">${l(i.name)}</span>
      <div class="seg-track"><div class="seg-fill" style="width:${Math.max(e.rate,2)}%;background:${i.color}"><span class="seg-fill-text">${e.rate}%</span></div></div>
      <span class="seg-value" style="color:${i.color}">${e.cited}/${e.total} (${e.rate}%)</span>
    </div>`}).join("");return`
    <div class="section">
      <div class="section-header">
        <span class="section-number">7B</span>
        <span class="section-title">Citation Visibility</span>
        <div class="section-subtitle">How often AI platforms cite ${l(C)} as a source — distinct from whether they mention the brand</div>
      </div>
      <div class="card">
        <div class="card-title">Source Citation Rate</div>
        <div class="stat-grid" style="margin-bottom:16px">
          <div class="stat-card"><div class="stat-value" style="color:${n>=20?"var(--success)":n>5?"var(--warning)":"var(--danger)"}">${n}%</div><div class="stat-label">Overall Citation Rate</div></div>
          <div class="stat-card"><div class="stat-value" style="color:var(--info)">${f}</div><div class="stat-label">Total Citations</div></div>
        </div>
        ${t}
        <div style="margin-top:12px;font-size:0.78rem;color:var(--text-muted)">Citation = AI links to ${l(C)} content as a source URL. Higher citation rate = stronger authority signal in AI training data.</div>
      </div>
    </div>`}function mt(p){const{results:c,llms:h,company:C,clmStageBk:o,sentiment:d,visibility:f,avgRank:y,perLlmVis:n,fiveMetrics:t,scores:v,verifiability:i}=p,e=(C||"").toLowerCase(),s=(d?.positive||0)+(d?.neutral||0)+(d?.negative||0)||1,m={positive:L((d?.positive||0)/s*100),neutral:L((d?.neutral||0)/s*100),negative:L((d?.negative||0)/s*100),total:s};let g,a;if(t?.narrative&&(t.narrative.preSigPct!=null||t.narrative.postSigPct!=null||t.narrative.fullStackPct!=null)){let k=0;(c||[]).forEach(P=>{(h||[]).forEach(b=>{const A=P.analyses?.[b];A&&!A._error&&A.mentioned&&k++})}),g={preSig:L(t.narrative.preSigPct||0),postSig:L(t.narrative.postSigPct||0),fullStack:L(t.narrative.fullStackPct||0),total:k,dominant:null,biasDetected:!1},a="fiveMetrics.narrative (scanEngine.classifyNarrative)"}else{const k=["pre-signature","pre-deal","evaluation","authoring","drafting","negotiation","redlining","intake","request"],P=["post-signature","obligation","compliance","renewal","performance","spend","implementation","adoption"],b={"pre-signature":0,"post-signature":0,"full-stack":0,total:0};(c||[]).forEach(x=>{(h||[]).forEach(R=>{const I=x.analyses?.[R];if(!I||I._error||!I.mentioned)return;const _=(I.rawText||I.summary||I.narrative||"").toLowerCase(),q=k.some(T=>_.includes(T)),j=P.some(T=>_.includes(T));b.total++,q&&j?b["full-stack"]++:q?b["pre-signature"]++:j?b["post-signature"]++:b["full-stack"]++})});const A=b.total||1;g={preSig:L(b["pre-signature"]/A*100),postSig:L(b["post-signature"]/A*100),fullStack:L(b["full-stack"]/A*100),total:b.total,dominant:null,biasDetected:!1},a="legacy keyword-match fallback"}g.postSig>g.preSig&&g.postSig>g.fullStack?(g.dominant="post-signature",g.biasDetected=g.postSig>40):g.fullStack>=g.preSig?g.dominant="full-stack":g.dominant="pre-signature",g.source=a;const u={};let $=0,r=0;(h||[]).forEach(k=>{let P=0,b=0;(c||[]).forEach(A=>{const x=A.analyses?.[k];if(!x||x._error)return;b++;const R=x.citations||[],I=x.sources||[],_=x.cited_sources||x.sources_cited||[];(R.some(j=>(j||"").toLowerCase().includes(e))||I.some(j=>(j||"").toLowerCase().includes(e))||_.some(j=>((j?.url||"")+" "+(j?.domain||"")+" "+(j?.title||"")+" "+(j?.excerpt||j?.context||j?.snippet||"")).toLowerCase().includes(e)))&&P++}),u[k]={cited:P,total:b,rate:b>0?L(P/b*100):0},$+=P,r+=b});const w=[];return(c||[]).forEach(k=>{(h||[]).forEach(P=>{const b=k.analyses?.[P];b?.content_gaps&&b.content_gaps.forEach(A=>{A&&A.length>5&&!w.some(x=>x.gap.toLowerCase().includes(A.toLowerCase().substring(0,30)))&&w.push({query:k.query,gap:A,lifecycle:k.lifecycle||"full-stack",persona:k.persona||"Unknown",scanId:k.scanId})})})}),{sentiment:m,lifecycleBias:g,citations:{perLlm:u,total:$,totalResponses:r,overallRate:r>0?L($/r*100):0},visibility:{overall:f,perLlm:n,avgRank:y},lifecycleVisibility:(o||[]).map(k=>({id:k.id,label:k.label,rate:k.rate,count:k.count})),contentGaps:w,scores:v||null,verifiability:i||null,fiveMetrics:t||null}}function gt(p){const{competitorInsights:c,benchmark:h,company:C,visibility:o,avgRank:d}=p,f=[];(p.results||[]).forEach(e=>{(p.llms||[]).forEach(s=>{const m=e.analyses?.[s];m?.content_gaps&&m.content_gaps.forEach(g=>{g&&g.length>5&&f.push({query:e.query,gap:g})})})});const y=[];f.forEach(e=>{y.some(s=>s.gap.toLowerCase().includes(e.gap.toLowerCase().substring(0,30)))||y.push(e)});const n=y.slice(0,8).map((e,s)=>`
    <div class="action-item" style="border-left:3px solid var(--warning)">
      <div class="action-num" style="background:var(--warning)">${s+1}</div>
      <div style="flex:1">
        <div style="font-size:0.82rem;font-weight:600;margin-bottom:2px">${l(e.gap)}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">Query: ${l(e.query)}</div>
      </div>
    </div>`).join(""),t=c?(c.topActions||[]).map(([e,s],m)=>`
    <div class="action-item">
      <div class="action-num">${m+1}</div>
      <div class="action-text">${l(e)}</div>
      <div class="action-severity badge badge-${s>=3?"danger":s>=2?"warning":"info"}">${s}x</div>
    </div>`).join(""):"",v=c?(c.losing||[]).map(e=>`
    <div class="action-item" style="border-left:3px solid var(--danger)">
      <div style="flex:1">
        <div style="font-size:0.82rem;font-weight:600;margin-bottom:2px">${l(e.query)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">
          <span class="badge badge-accent">${l(e.persona||"")}</span>
          ${e.sirionAbsent?'<span class="badge badge-danger" style="margin-left:4px">Absent</span>':""}
          vs ${e.winners.map(s=>`<strong>${l(s)}</strong>`).join(", ")}
        </div>
      </div>
    </div>`).join(""):"",i=h&&h.count>0?`<div class="callout-stat"><div class="callout-stat-value" style="color:${h.hitRate>=70?"var(--success)":h.hitRate>=40?"var(--warning)":"var(--danger)"}">${h.hitRate}%</div><div class="callout-stat-label">Benchmark Hit Rate</div></div>`:"";return`
    <div class="section">
      <div class="section-header">
        <span class="section-number">8</span>
        <span class="section-title">Key Takeaways & Actions</span>
        <div class="section-subtitle">What to fix next based on gap and competitive analysis</div>
      </div>
      ${n.length>0?`<div class="card"><div class="card-title">Content Gaps Identified</div>${n}</div>`:""}
      ${t.length>0?`<div class="card"><div class="card-title">Recommended Actions</div>${t}</div>`:""}
      ${v.length>0?`<div class="card"><div class="card-title">Competitive Losses</div>${v}</div>`:""}
      <div class="callout">
        <div class="callout-title">Bottom Line</div>
        <div class="callout-text">${l(C)} has ${o}% overall AI visibility with an average rank of #${d.toFixed(1)} across ${p.llmCount} AI platforms. ${o>=70?"The foundation is solid — focus on closing remaining gaps and defending strong positions.":o>=40?"Moderate presence detected — prioritize closing content gaps and improving underperforming platforms.":"Critical gaps in AI visibility — immediate action needed to establish presence across AI platforms."}</div>
        <div class="callout-stats">
          <div class="callout-stat"><div class="callout-stat-value" style="color:${o>=70?"var(--success)":"var(--warning)"}">${o}%</div><div class="callout-stat-label">Visibility</div></div>
          <div class="callout-stat"><div class="callout-stat-value" style="color:${K(d)}">#${d.toFixed(1)}</div><div class="callout-stat-label">Avg Rank</div></div>
          ${i}
          <div class="callout-stat"><div class="callout-stat-value text-info">${p.llmCount}</div><div class="callout-stat-label">Platforms</div></div>
        </div>
      </div>
    </div>`}export{at as a,it as b,ot as c,lt as d,rt as e,ct as f,dt as g,pt as h,gt as i,nt as j,vt as k,ut as l,mt as m};
