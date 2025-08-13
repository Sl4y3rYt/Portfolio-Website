/* ============================================================
   VFX Portfolio — Full App JS
   - Works popup with autoplay video + description
   - If Description is a PDF URL:
       * Try PDF.js text extraction
       * On CORS failure (e.g., Google Drive), embed viewer + button
   - No design changes
   ============================================================ */

/* ========= YOUR GOOGLE SHEET CSV LINKS ========= */
const SHEET_WORKS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRVcLlVMNA4wX8PevFh09fjGRqMZtpt3hdmjLAZo46Y18IM_19musy7Jx1odVjx3SdIY-MEUfTLjb4o/pub?gid=1920935035&single=true&output=csv";
const SHEET_SETTINGS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRVcLlVMNA4wX8PevFh09fjGRqMZtpt3hdmjLAZo46Y18IM_19musy7Jx1odVjx3SdIY-MEUfTLjb4o/pub?gid=352265221&single=true&output=csv";
const SHEET_RESUME_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRVcLlVMNA4wX8PevFh09fjGRqMZtpt3hdmjLAZo46Y18IM_19musy7Jx1odVjx3SdIY-MEUfTLjb4o/pub?gid=699763124&single=true&output=csv";
const SHEET_CONTACT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRVcLlVMNA4wX8PevFh09fjGRqMZtpt3hdmjLAZo46Y18IM_19musy7Jx1odVjx3SdIY-MEUfTLjb4o/pub?gid=838679064&single=true&output=csv";
/* ================================================ */

const CATEGORY_ORDER = ["ALL","WIP","FX","COMPOSITING","LIGHTING","MODELLING","3D ENVIRONMENTS"];

/* -------------------- Global State -------------------- */
const state = {
  works: [],
  filter: "ALL",
  presentCategories: new Set(["ALL"]),
  settings: {
    Name: "Varun Kumar Korikana",
    Title: "FX Artist / CG Generalist",
    Subtitle: "Houdini FX • Procedural Tools • Fluid / Pyro • Comp & Lookdev • Maya • Nuke • Unreal",
    ReelURL: "",
    LogoURL: "",
    ResumePDF: "",
    AccentColor: "",
    ContactBlurb: ""
  },
  resume: { summary:"", experience:[], education:[], skills:[], tools:[], certs:[], resumeLink:"" },
  contact: [],
  contactBlurb: ""
};
const loaders = { settings:{}, resume:{}, contact:{}, works:{} };

/* ---------------- CSV (robust) ---------------- */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const header = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = splitCSVLine(line);
    const obj = {};
    header.forEach((h, i) => (obj[h] = (cells[i] ?? "").trim()));
    return obj;
  });
}
function splitCSVLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i], next = line[i + 1];
    if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur); cur=""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.replace(/^"|"$/g,""));
}
function withCacheBuster(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${Date.now()}&r=${Math.random().toString(36).slice(2)}`;
}
async function fetchCSV(url, key) {
  if (loaders[key]?.controller) loaders[key].controller.abort();
  const controller = new AbortController();
  const token = Symbol();
  loaders[key] = { controller, token };
  const res = await fetch(withCacheBuster(url), { cache: "no-store", signal: controller.signal });
  if (!res.ok) throw new Error(`CSV fetch failed: ${key}`);
  const text = await res.text();
  if (loaders[key].token !== token) throw new Error("Stale response discarded");
  return parseCSV(text);
}
function escapeHtml(s) {
  return (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function titleize(s){ return (s||"").replace(/\s+/g,' ').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

/* ---------------- Settings / Resume / Contact (unchanged renderers) ---------------- */
async function loadSettings() { try {
  const rows = await fetchCSV(SHEET_SETTINGS_CSV_URL, "settings");
  const kv = rows.reduce((acc,row)=>{ const k=(row.Key||row.key||row.Section||"").trim(); const v=(row.Value||row.value||row.Details||"").trim(); if(k) acc[k]=v; return acc; },{});
  state.settings = { ...state.settings, ...kv };
} catch(e){ console.warn("Settings load failed", e); } }
function applySettingsToUI(){
  const s=state.settings;
  if (s.AccentColor) document.documentElement.style.setProperty('--accent', s.AccentColor);
  const logoImg=document.getElementById("logoImg"), logoText=document.getElementById("logoText");
  if (s.LogoURL && logoImg){ logoImg.src=s.LogoURL; logoImg.style.display="block"; logoImg.referrerPolicy="no-referrer"; if (logoText) logoText.style.display="none"; logoImg.onerror=()=>{ logoImg.style.display="none"; if (logoText) logoText.style.display="inline-block"; }; }
  const heroName=document.getElementById("heroName"), heroTitle=document.getElementById("heroTitle"), heroSubtitle=document.getElementById("heroSubtitle");
  if (heroName && s.Name) heroName.textContent=s.Name; if (heroTitle && s.Title) heroTitle.textContent=s.Title; if (heroSubtitle && s.Subtitle) heroSubtitle.textContent=s.Subtitle;
  const footerName=document.getElementById("footerName"); if (footerName && s.Name) footerName.textContent=s.Name;
  const reel=document.getElementById("openReel"); if (reel){ const url=s.ReelURL||""; reel.href=url||"#"; reel.addEventListener("click",e=>{ if(!url){ e.preventDefault(); alert("Add ReelURL in SiteSettings to enable this link."); } }); }
  const resumeBtn=document.getElementById("downloadResume"); if (resumeBtn) resumeBtn.href=s.ResumePDF||"#";
}
async function loadResume(){ try {
  const rows=await fetchCSV(SHEET_RESUME_CSV_URL,"resume");
  const sum=[],exp=[],edu=[],skills=[],tools=[],certs=[]; let resumeLink="";
  rows.forEach(r=>{ const section=(r.Section||"").trim().toLowerCase(); const title=(r.Title||"").trim(); const details=(r.Details||"").trim();
    if (section==="summary"&&details) sum.push(details);
    else if (section==="experience"&&(title||details)) exp.push({ title, details: escapeHtml(details).replace(/\r?\n/g,"<br>") });
    else if (section==="education"&&(title||details)) edu.push({ title, details });
    else if (section==="skills"&&details) details.split(/\s*[,|;]\s*/).forEach(x=>x&&skills.push(x));
    else if (section==="tools"&&details)  details.split(/\s*[,|;]\s*/).forEach(x=>x&&tools.push(x));
    else if ((section==="certifications"||section==="certification")&&details) certs.push(details);
    else if (section==="resumelink"&&details) resumeLink=details;
  });
  state.resume={ summary:sum.join(" "), experience:exp, education:edu, skills, tools, certs, resumeLink };
} catch(e){ console.warn("Resume load failed",e); } }
function renderResume(){
  const r=state.resume, aboutSummary=document.getElementById("aboutSummary");
  if (aboutSummary&&r.summary) aboutSummary.innerHTML=r.summary.replace(/\r?\n/g,"<br>");
  const expUl=document.getElementById("experienceList"); if (expUl){ expUl.innerHTML=""; r.experience.forEach(it=>{ const li=document.createElement("li"); li.className="experience-item"; li.innerHTML=`<strong>${escapeHtml(it.title||"Experience")}</strong><div class="exp-details">${it.details||""}</div>`; expUl.appendChild(li); }); }
  const eduUl=document.getElementById("educationList"); if (eduUl){ eduUl.innerHTML=""; r.education.forEach(it=>{ const li=document.createElement("li"); li.innerHTML=`<strong>${escapeHtml(it.title||"Education")}</strong>${it.details?" — "+escapeHtml(it.details):""}`; eduUl.appendChild(li); }); }
  const resumeBtn=document.getElementById("downloadResume"); const finalResume=r.resumeLink||state.settings.ResumePDF||""; if (resumeBtn) resumeBtn.href=finalResume||"#";
  const skillsUl=document.getElementById("skillsList"); if (skillsUl){ skillsUl.innerHTML=""; r.skills.forEach(s=>{ const li=document.createElement("li"); li.textContent=s; skillsUl.appendChild(li); }); }
  const toolsUl=document.getElementById("toolsList"); if (toolsUl){ toolsUl.innerHTML=""; r.tools.forEach(s=>{ const li=document.createElement("li"); li.textContent=s; toolsUl.appendChild(li); }); }
  const certUl=document.getElementById("certList"); if (certUl){ certUl.innerHTML=""; r.certs.forEach(s=>{ const li=document.createElement("li"); li.textContent=s; certUl.appendChild(li); }); }
}
async function loadContact(){ try {
  const rows=await fetchCSV(SHEET_CONTACT_CSV_URL,"contact");
  let blurb=""; const items=[]; rows.forEach(row=>{ const type=(row.Type||row.Section||"").trim(); const value=(row.Value||row.Details||"").trim(); const iconUrl=(row.IconURL||row.Icon||"").trim(); if(!type||!value) return; if (type.toLowerCase()==="blurb") blurb=value; else items.push({ type:type.toLowerCase(), value, iconUrl }); });
  state.contact=items; state.contactBlurb=blurb;
} catch(e){ console.warn("Contact load failed",e); } }
function renderContact(){
  const blurbEl=document.getElementById("contactBlurb"); if (blurbEl){ const s1=(state.contactBlurb||"").trim(); const s2=(state.settings.ContactBlurb||"").trim(); blurbEl.textContent= s1 || s2 || blurbEl.textContent; }
  const ul=document.getElementById("contactList"); if (!ul) return; ul.innerHTML="";
  state.contact.forEach(row=>{
    const li=document.createElement("li");
    if (row.iconUrl){ const img=document.createElement("img"); img.className="contact-icon"; img.src=row.iconUrl; img.alt=row.type||"icon"; img.referrerPolicy="no-referrer"; img.onerror=()=>{ li.insertBefore(iconFor(row.type), li.firstChild); img.remove(); }; li.appendChild(img); }
    else li.appendChild(iconFor(row.type));
    const a=document.createElement("a"); const type=row.type, value=row.value;
    if (type==="email"){ a.href=`mailto:${value}`; a.textContent=value; }
    else if (type==="phone"||type==="mobile"||type==="whatsapp"){ a.href=`tel:${value.replace(/[^\d+]/g,"")}`; a.textContent=value; }
    else { a.href=value; a.target="_blank"; a.rel="noopener"; a.textContent=titleize(type)||"Link"; }
    li.appendChild(a); ul.appendChild(li);
  });
}
function iconFor(type){
  const svgNS="http://www.w3.org/2000/svg"; const svg=document.createElementNS(svgNS,"svg"); svg.setAttribute("viewBox","0 0 24 24"); const p=document.createElementNS(svgNS,"path");
  if (type==="email"){ p.setAttribute("d","M20 4H4a2 2 0 0 0-2 2v.4l10 6.25L22 6.4V6a2 2 0 0 0-2-2Zm0 4.133-8 5-8-5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.133Z"); }
  else if (type==="phone"||type==="mobile"||type==="whatsapp"){ p.setAttribute("d","M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.05-.24c1.15.38 2.4.58 3.54.58a1 1 0  0 1 1 1v3.48a1 1 0 0 1-1 1C10.85 21.99 2 13.14 2 2.99a1 1 0 0 1 1-1H6.5a1 1 0 0 1 1 1c0 1.15.2 2.4.58 3.55a1 1 0 0 1-.24 1.05l-2.22 2.2Z"); }
  else if (type==="linkedin"){ p.setAttribute("d","M6.94 6.5A2.5 2.5 0 1 1 6.93 1.5a2.5 2.5 0  0 1 .01 5Zm10.56 15h-3.5v-7.2c0-1.72-.62-2.9-2.18-2.9-1.19 0-1.9.8-2.22 1.58-.11.26-.14.62-.14.99V21.5H5.96s.05-12.38 0-13.67h3.5V9.6c.46-.71 1.28-1.72 3.11-1.72 2.27 0 3.93 1.48 3.93 4.66v8.96ZM3 7.83h3.5V21.5H3V7.83Z"); }
  else if (type==="instagram"){ p.setAttribute("d","M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm6-1a1 1 0 1 0 1 1 1 1 0 0 0-1-1z"); }
  else if (type==="twitter"||type==="x"){ p.setAttribute("d","M19.633 7.997c.013.18.013.36.013.54 0 5.492-4.183 11.816-11.816 11.816-2.35 0-4.532-.687-6.368-1.867.328.039.643.052.984.052A8.354 8.354 0 0 0 6.4 17.7a4.178 4.178 0 0 1-3.9-2.89c.26.04.52.065.793.065.38 0 .76-.052 1.114-.143a4.17 4.17 0 0 1-3.345-4.096v-.052c.547.304 1.18.495 1.853.52A4.162 4.162 0 0 1 1.6 6.43c0-.78.208-1.5.572-2.13a11.86 11.86 0 0 0 8.61 4.366 4.705 4.705 0 0 1-.104-.955 4.166 4.166 0 0 1 7.21-2.846 8.19 8.19 0 0 0 2.637-1.001 4.176 4.176 0  0 1-1.832 2.3 8.29 8.29 0 0 0 2.4-.65 8.966 8.966 0  0 1-2.421 2.491z"); }
  else { p.setAttribute("d","M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Z"); }
  svg.appendChild(p); return svg;
}

/* ---------------- Works / Projects ---------------- */
function deriveCategories(tags, status){
  const map = {"fx":"FX","compositing":"COMPOSITING","lighting":"LIGHTING","modelling":"MODELLING","modeling":"MODELLING","3d environments":"3D ENVIRONMENTS","3d env":"3D ENVIRONMENTS","environment":"3D ENVIRONMENTS","environments":"3D ENVIRONMENTS","env":"3D ENVIRONMENTS","wip":"WIP"};
  const set=new Set(); if ((status||"").toUpperCase()==="WIP") set.add("WIP");
  (tags||[]).forEach(t=>{ const k=(t||"").trim().toLowerCase(); if(!k) return; set.add(map[k]||titleize(k)); });
  return Array.from(set);
}
function buildEmbed(url){
  try{
    const u=new URL(url);
    if (/youtube\.com|youtu\.be/.test(u.host)){ let id=u.searchParams.get("v"); if(!id && u.host.includes("youtu.be")) id=u.pathname.slice(1); const base=`https://www.youtube.com/embed/${id}`; return {type:"youtube", iframe:`${base}?rel=0&modestbranding=1&autoplay=1`, ytId:id}; }
    if (/vimeo\.com/.test(u.host)){ const id=u.pathname.split("/").filter(Boolean).pop(); return {type:"vimeo", iframe:`https://player.vimeo.com/video/${id}?autoplay=1`, vimeoId:id}; }
    if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return {type:"file", src:url, autoplay:true};
    return {type:"iframe", iframe:url};
  }catch{ return {type:"iframe", iframe:url}; }
}

/* ---------- PDF Description Helpers ---------- */
function isProbablyPdfLink(s=""){
  const u=s.trim(); if (!/^https?:\/\//i.test(u)) return false;
  return /\.pdf(\?|#|$)/i.test(u) || /drive\.google\.com\/(file\/d\/|open\?id=)/i.test(u) || /dropbox\.com\/s\//i.test(u);
}
function normalizePdfUrl(raw){
  try{
    const u=new URL(raw);
    // Google Drive
    if (u.hostname.includes("drive.google.com")){
      const m=u.pathname.match(/\/file\/d\/([^/]+)/); const id=m?m[1]: (u.searchParams.get("id")||"");
      if (id) return { direct:`https://drive.google.com/uc?export=download&id=${id}`, view:`https://drive.google.com/file/d/${id}/preview` };
    }
    // Dropbox: ?dl=1 for direct
    if (u.hostname.includes("dropbox.com")){
      u.searchParams.set("dl","1");
      return { direct:u.toString(), view:`https://www.dropbox.com/preview${u.pathname}` };
    }
    // Plain .pdf
    if (/\.pdf(\?|#|$)/i.test(u.pathname)) {
      return { direct:u.toString(), view:u.toString() };
    }
  }catch{}
  return { direct:raw, view:raw };
}
async function extractPdfText(pdfUrl){
  if (!window.pdfjsLib) throw new Error("PDF.js not loaded");
  const { direct } = normalizePdfUrl(pdfUrl);
  const loadingTask = pdfjsLib.getDocument({ url: direct, useSystemFonts:true });
  const pdf = await loadingTask.promise;
  const maxPages=Math.min(pdf.numPages, 30);
  let out="";
  for (let p=1; p<=maxPages; p++){
    const page=await pdf.getPage(p);
    const content=await page.getTextContent();
    out += (p>1 ? "\n\n" : "") + content.items.map(it=>it.str).join(" ");
    if (out.length>50000) break;
  }
  return out.trim();
}

/* ---------- Data load & render ---------- */
async function fetchVideos(){
  const grid=document.getElementById("videoGrid");
  if (grid) grid.innerHTML=`<div class="muted">Loading…</div>`;

  const rows=await fetchCSV(SHEET_WORKS_CSV_URL,"works");
  state.works=rows.filter(r=>r.URL||r.Link||r.Video||r.VideoURL).map(r=>{
    const title=r.Title||r.NAME||r.Project||"Untitled";
    const url=r.URL||r.Link||r.Video||r.VideoURL||"";
    const status=(r.Status||r.State||r.Type||"").trim();
    const tagsStr=(r["Tags/Categories"]||r.Tags||r.Categories||"").toString();
    const tags=tagsStr.split(/[,|]/).map(t=>t.trim()).filter(Boolean);
    const thumb=r.Thumbnail||r.Thumb||"";
    const cats=deriveCategories(tags,status);
    const rawDesc=(r.Description||r.Details||"").trim();
    const descIsPdf=isProbablyPdfLink(rawDesc);
    const description=rawDesc;
    const galleryStr=(r.Gallery||r.Images||r.ImageGallery||"").trim();
    const gallery=galleryStr ? galleryStr.split("|").map(s=>s.trim()).filter(Boolean) : [];
    return { title, url, status, tags, thumb, cats, embed:buildEmbed(url), description, descIsPdf, gallery };
  });

  computePresentCategories(); renderFilters(); renderGrid();
}
function computePresentCategories(){
  const set=new Set(["ALL"]); state.works.forEach(r=>(r.cats||[]).forEach(c=>set.add(c)));
  const preferred=CATEGORY_ORDER.filter(c=>set.has(c));
  const extras=[...set].filter(c=>!CATEGORY_ORDER.includes(c)&&c!=="ALL").sort();
  state.presentCategories=new Set([...preferred,...extras]);
  if (!set.has(state.filter)) state.filter="ALL";
}
function renderFilters(){
  const wrap=document.getElementById("filters"); if (!wrap) return;
  wrap.innerHTML="";
  const cats=["ALL", ...[...state.presentCategories].filter(c=>c!=="ALL")];
  cats.forEach(cat=>{
    const btn=document.createElement("button");
    btn.className="chip"+(state.filter===cat?" active":"");
    btn.dataset.filter=cat; btn.textContent=cat;
    wrap.appendChild(btn);
  });
}
function renderGrid(){
  const grid=document.getElementById("videoGrid"); if (!grid) return;
  grid.innerHTML=""; const tpl=document.getElementById("videoCardTpl");
  const items=state.works.filter(r=> state.filter==="ALL" || (r.cats && r.cats.includes(state.filter)));
  if (!items.length){ grid.innerHTML=`<div class="muted">No items</div>`; return; }

  items.forEach(r=>{
    const node=tpl.content.cloneNode(true);
    node.querySelector(".card-title").textContent=r.title;
    const tags=node.querySelector(".tags"); tags.innerHTML="";
    (r.cats||[]).forEach(c=>{ const el=document.createElement("span"); el.className="tag"; el.textContent=c; tags.appendChild(el); });

    const img=node.querySelector(".thumb");
    if (r.thumb){ img.src=r.thumb; img.alt=r.title; img.referrerPolicy="no-referrer"; }
    else if (r.embed.type==="youtube" && r.embed.ytId) img.src=`https://i.ytimg.com/vi/${r.embed.ytId}/hqdefault.jpg`;
    else if (r.embed.type==="vimeo" && r.embed.vimeoId) img.src=`https://vumbnail.com/${r.embed.vimeoId}.jpg`;
    else img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%' height='100%' fill='#0e131f'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#8a93a7' font-family='Oxanium' font-size='20'>${escapeHtml(r.title)}</text></svg>`);
    img.onerror=()=>{ if (r.embed?.type==="youtube" && r.embed.ytId) img.src=`https://i.ytimg.com/vi/${r.embed.ytId}/hqdefault.jpg`; else if (r.embed?.type==="vimeo" && r.embed.vimeoId) img.src=`https://vumbnail.com/${r.embed.vimeoId}.jpg`; };

    node.querySelector(".play").addEventListener("click", ()=> openProjectPopup(r));
    grid.appendChild(node);
  });
  observeFadeIns();
}

/* -------- Popup with description (PDF-aware) -------- */
async function openProjectPopup(row){
  const modal=document.getElementById("playerModal");
  const wrap=document.getElementById("playerWrap");
  if (!modal || !wrap) return;
  wrap.innerHTML="";

  // Video area
  if (row.embed.type==="youtube"||row.embed.type==="vimeo"||row.embed.type==="iframe"){
    const ifr=document.createElement("iframe");
    ifr.src=row.embed.iframe; ifr.allow="autoplay; encrypted-media; picture-in-picture"; ifr.frameBorder="0"; ifr.allowFullscreen=true;
    wrap.appendChild(ifr);
  } else if (row.embed.type==="file"){
    const vid=document.createElement("video");
    vid.src=row.embed.src; vid.controls=true; vid.autoplay=true; vid.playsInline=true; wrap.appendChild(vid);
  }

  // Description block
  const info=document.createElement("div"); info.style.padding="12px 14px 16px";
  const h=document.createElement("h3"); h.textContent=row.title; h.style.margin="8px 0 6px";
  const p=document.createElement("p"); p.textContent=" ";
  info.appendChild(h); info.appendChild(p);
  wrap.parentElement.appendChild(info);

  // Try PDF text extraction if needed
  try{
    let finalText=row.description||"";
    if (row.descIsPdf){
      p.textContent="Loading description from PDF…";
      finalText = await extractPdfText(row.description);
    }
    p.innerHTML = escapeHtml(finalText).replace(/\r?\n/g,"<br>");
  }catch(err){
    // Fallback: embed a viewer + button for PDFs blocked by CORS (e.g., Google Drive)
    if (row.descIsPdf){
      const { view, direct } = normalizePdfUrl(row.description);
      p.innerHTML = `Could not load description text from PDF (blocked by host).<br>
        <a href="${direct}" target="_blank" rel="noopener">Open full PDF</a>`;

      // Inline viewer below text
      const viewer = document.createElement("iframe");
      // Use Google Drive preview if present; otherwise Google Docs viewer to embed any URL
      const viewerUrl = view.includes("drive.google.com")
        ? view
        : `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(direct)}`;
      viewer.src = viewerUrl;
      viewer.style.width = "100%";
      viewer.style.height = "60vh";
      viewer.style.border = "1px solid #1c2230";
      viewer.style.borderRadius = "10px";
      viewer.style.marginTop = "10px";
      info.appendChild(viewer);
    } else {
      p.textContent = "No description available.";
    }
    console.warn("PDF extraction failed:", err);
  }

  modal.showModal();
}
function closePlayer(){
  const modal=document.getElementById("playerModal");
  const wrap=document.getElementById("playerWrap");
  if (!modal || !wrap) return;
  wrap.innerHTML="";
  const info=wrap.parentElement.querySelector("h3")?.parentElement;
  if (info) info.remove();
  if (modal.open) modal.close();
}

/* ---------------- UI / Nav / FX ---------------- */
function showView(hash){
  const id=(hash||"#home").replace("#","");
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active", v.id===id));
  document.querySelectorAll("nav a").forEach(a=>a.classList.toggle("active", a.getAttribute("href")==="#"+id));
  if (id==="works") { fetchVideos().catch(()=>{ const grid=document.getElementById("videoGrid"); if (grid) grid.innerHTML=`<div class="muted">Loading…</div>`; }); }
  window.scrollTo({ top:0, behavior:"smooth" });
}
function setupUI(){
  const year=document.getElementById("year"); if (year) year.textContent=new Date().getFullYear();
  const goWorks=document.getElementById("goWorks"); if (goWorks) goWorks.addEventListener("click", ()=>navigateTo("#works"));
  document.querySelectorAll("[data-link]").forEach(a=>a.addEventListener("click", e=>{ const href=a.getAttribute("href"); if (href && href.startsWith("#")){ e.preventDefault(); navigateTo(href); } }));
  const filters=document.getElementById("filters");
  if (filters){ filters.addEventListener("click", e=>{ const btn=e.target.closest("button.chip"); if(!btn) return; state.filter=btn.dataset.filter||btn.textContent.trim(); renderFilters(); renderGrid(); }); }
  window.addEventListener("DOMContentLoaded", ()=>{ const modal=document.getElementById("playerModal"); const closeBtn=document.getElementById("closeModal"); if (closeBtn) closeBtn.addEventListener("click", closePlayer); if (modal){ modal.addEventListener("click", e=>{ if(e.target===modal) closePlayer(); }); document.addEventListener("keydown", e=>{ if(e.key==="Escape" && modal.open) closePlayer(); }); } });
}
function navigateTo(hash){ history.pushState(null,"",hash); showView(hash); }
function observeFadeIns(){ const els=document.querySelectorAll(".card.fade-in"); const io=new IntersectionObserver(entries=>{ entries.forEach(e=>{ if(e.isIntersecting){ e.target.style.animationPlayState="running"; io.unobserve(e.target);} }); },{ threshold:.15 }); els.forEach(el=>io.observe(el)); }
function startFX(){ const canvas=document.getElementById("fxbg"); if (!canvas) return; const ctx=canvas.getContext("2d"); let w=0,h=0,particles=[], lastT=0, lastArea=0, resizeTimer=0;
  function setSize(){ const dpr=Math.max(1, Math.min(2, window.devicePixelRatio||1)); const rectW=canvas.clientWidth, rectH=canvas.clientHeight; canvas.width=Math.floor(rectW*dpr); canvas.height=Math.floor(rectH*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); w=rectW; h=rectH; }
  function initParticles(n){ if (!particles.length){ particles=new Array(n).fill(0).map(()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-0.5)*0.25,vy:(Math.random()-0.5)*0.25,r:1.2+Math.random()*2.2,a:0.15+Math.random()*0.35})); return; } const diff=n-particles.length; if (diff>0){ for(let i=0;i<diff;i++){ particles.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-0.5)*0.25,vy:(Math.random()-0.5)*0.25,r:1.2+Math.random()*2.2,a:0.15+Math.random()*0.35}); } } else if (diff<0) particles.splice(diff); }
  function doResize(){ setSize(); const area=w*h; const target=Math.max(28, Math.min(68, Math.round(area/50000))); initParticles(target); lastArea=area; }
  function scheduleResize(){ const area=window.innerWidth*window.innerHeight; if (lastArea && Math.abs(area-lastArea) < lastArea*0.30) return; clearTimeout(resizeTimer); resizeTimer=setTimeout(doResize,120); }
  const ro=new ResizeObserver(scheduleResize); ro.observe(document.documentElement); doResize();
  function tick(t){ const dt=Math.min(32, t-lastT||16); lastT=t; ctx.clearRect(0,0,w,h); ctx.globalCompositeOperation="lighter";
    const g=ctx.createRadialGradient(w*.5,h*.45,0,w*.5,h*.45,Math.max(w,h)*.7); g.addColorStop(0,"rgba(98,208,255,0.06)"); g.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    particles.forEach(p=>{ p.x+=p.vx*dt; p.y+=p.vy*dt; if (p.x<-20) p.x=w+20; if (p.x>w+20) p.x=-20; if (p.y<-20) p.y=h+20; if (p.y>h+20) p.y=-20; const grad=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*12); grad.addColorStop(0,`rgba(120,200,255,${p.a})`); grad.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*10,0,Math.PI*2); ctx.fill(); });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------------- Boot ---------------- */
(async function init(){
  setupUI(); startFX();
  try { await loadSettings(); applySettingsToUI(); } catch {}
  try { await loadResume();   renderResume();       } catch {}
  try { await loadContact();  renderContact();      } catch {}
  showView(location.hash || "#home");
  window.addEventListener("hashchange", ()=> showView(location.hash));
})();
