(() => {
  const $ = id => document.getElementById(id);
  const root = $("view-root");
  const state = {subjects:[], view:"dashboard", activeSubjectId:null, deadlineFilter:"all", backgroundDataUrl:""};
  const colours = window.StudySubjects.colours;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = value => {
    if (!value) return "No date added";
    const d = new Date(value + "T12:00:00");
    return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(d);
  };
  const shortDate = value => {
    if (!value) return {month:"—",day:"–"};
    const d = new Date(value+"T12:00:00");
    return {month:new Intl.DateTimeFormat("en-GB",{month:"short"}).format(d).toUpperCase(),day:d.getDate()};
  };
  const allItems = () => state.subjects.flatMap(s => [
    ...s.assignments.map(i=>({...i,subjectId:s.id,subjectName:s.name,kind:"assignment"})),
    ...(s.examDate ? [{id:"exam-"+s.id,title:"Exam: "+s.name,date:s.examDate,type:"exam",done:false,subjectId:s.id,subjectName:s.name,kind:"exam"}] : [])
  ]).sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));
  const upcoming = () => allItems().filter(i=>!i.done && i.date);
  const activeSubject = () => state.subjects.find(s=>s.id===state.activeSubjectId);
  async function persist() { await StudyStorage.save({subjects:state.subjects,backgroundDataUrl:state.backgroundDataUrl}); }
  function navigate(view) {
    state.view=view;
    document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    render();
  }
  function subjectCard(s) {
    const c=colours[s.colour]||colours.rose, total=s.assignments.length, done=s.assignments.filter(i=>i.done).length, prog=StudySubjects.progress(s);
    return `<article class="subject-card" data-open-subject="${s.id}" style="--accent:${c.accent};--accent-bg:${c.bg}">
      <div class="subject-top"><span class="subject-symbol">${c.icon}</span><button class="subject-menu" data-edit-subject="${s.id}" title="Edit subject" aria-label="Edit ${esc(s.name)}">···</button></div>
      <h3>${esc(s.name)}</h3><div class="subject-meta">${esc(s.semester||"My semester")}<br>${total} assignment${total===1?"":"s"} · ${done} completed</div>
      <div class="progress-row"><span>Topics learned</span><strong>${prog}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${prog}%"></div></div>
    </article>`;
  }
  function empty(title, desc, buttonText, action) {
    return `<div class="empty-state"><div class="empty-icon">✿</div><h3>${title}</h3><p>${desc}</p>${buttonText?`<button class="button primary" data-action="${action}">${buttonText}</button>`:""}</div>`;
  }
  function deadlineRow(i) {
    const d=shortDate(i.date), status=i.done?'<span class="status-pill done">Done</span>':new Date(i.date+"T23:59:59")<new Date()?'<span class="status-pill overdue">Overdue</span>':'<span class="status-pill">To do</span>';
    return `<div class="deadline-row"><div class="date-tile"><small>${d.month}</small><strong>${d.day}</strong></div><div class="deadline-info"><strong>${esc(i.title)}</strong><small>${esc(i.subjectName)} · ${esc(i.type||"Assignment")}</small></div>${status}<button class="tiny-action" data-open-subject="${i.subjectId}" title="Open subject">↗</button></div>`;
  }
  function dashboard() {
    const items=upcoming(), all=allItems(), soon=items.slice(0,5);
    root.innerHTML=`<section class="hero"><div><div class="eyebrow">A SOFTER WAY TO STUDY</div><h1>Welcome to your study space <span style="color:#bd8098">♡</span></h1><p>One little step at a time. Your semester, all in one place.</p></div><div class="hero-actions"><button class="button secondary" id="customize-bg">✿ Customize</button><button class="button primary" data-action="add-subject">＋ Add subject</button></div></section>
      <section class="stats-grid">
        <div class="stat-card"><div class="stat-icon">▤</div><div><div class="stat-label">My subjects</div><div class="stat-value">${state.subjects.length}</div></div></div>
        <div class="stat-card"><div class="stat-icon">▦</div><div><div class="stat-label">Upcoming deadlines</div><div class="stat-value">${items.length}</div></div></div>
        <div class="stat-card"><div class="stat-icon">♡</div><div><div class="stat-label">Assignments completed</div><div class="stat-value">${state.subjects.reduce((n,s)=>n+s.assignments.filter(i=>i.done).length,0)}</div></div></div>
        <div class="stat-card"><div class="stat-icon">✧</div><div><div class="stat-label">Topics learned</div><div class="stat-value">${state.subjects.reduce((n,s)=>n+s.topics.filter(t=>t.done).length,0)}</div></div></div>
      </section>
      <section class="content-grid"><div class="section-card"><div class="section-heading"><div><h2>My subjects</h2><p>Your semester at a glance</p></div><button class="text-button" data-view="subjects">View all ↗</button></div>
      ${state.subjects.length?`<div class="subject-grid">${state.subjects.map(subjectCard).join("")}</div>`:empty("Your semester starts here","Add your first subject to create a home for assignments, exams, topics and notes.","＋ Add your first subject","add-subject")}</div>
      <div><div class="section-card"><div class="section-heading"><div><h2>Coming up</h2><p>Deadlines to keep in mind</p></div><button class="text-button" data-view="deadlines">All ↗</button></div>${soon.length?`<div class="deadline-list">${soon.map(deadlineRow).join("")}</div>`:empty("Nothing due just yet","Add assignment dates to see your upcoming deadlines here.","Add an assignment","add-item")}</div>
      </div></section>`;
    if(state.backgroundDataUrl) document.body.style.backgroundImage=`linear-gradient(#fbf7f5d9,#fbf7f5d9),url("${state.backgroundDataUrl}")`;
    $("customize-bg")?.addEventListener("click",()=> $("background-upload").click());
  }
  function subjectsPage() {
    root.innerHTML=`<section class="page-header"><div><div class="eyebrow">YOUR SEMESTER</div><h1>My subjects</h1><p>Every subject has its own little space to grow.</p></div><button class="button primary" data-action="add-subject">＋ Add subject</button></section>
      ${state.subjects.length?`<div class="subject-grid">${state.subjects.map(subjectCard).join("")}</div>`:empty("No subjects yet","Create a subject and add its exam date, assignments, topics and notes.","＋ Add subject","add-subject")}`;
  }
  function assignmentHtml(s,i) {
    return `<div class="assignment-row"><input type="checkbox" data-toggle-item="${i.id}" ${i.done?"checked":""} aria-label="Mark ${esc(i.title)} complete"><div class="item-copy ${i.done?"completed":""}"><strong>${esc(i.title)}</strong><small>${i.date?`Due ${fmtDate(i.date)}`:"No due date"} · ${esc(i.type)}</small></div><div class="row-actions"><button class="tiny-action" data-edit-item="${i.id}" data-subject-id="${s.id}" title="Edit">✎</button><button class="tiny-action" data-delete-item="${i.id}" data-subject-id="${s.id}" title="Delete">×</button></div></div>`;
  }
  function topicHtml(s,t) {
    return `<div class="topic-row"><input type="checkbox" data-toggle-topic="${t.id}" ${t.done?"checked":""} aria-label="Mark ${esc(t.name)} learned"><div class="item-copy ${t.done?"completed":""}"><strong>${esc(t.name)}</strong></div><button class="tiny-action" data-delete-topic="${t.id}" data-subject-id="${s.id}" title="Delete topic">×</button></div>`;
  }
  function subjectPage(s) {
    const c=colours[s.colour]||colours.rose, prog=StudySubjects.progress(s);
    root.innerHTML=`<button class="back-link" data-view="subjects">← Back to all subjects</button>
      <section class="page-header"><div><div class="eyebrow">${esc(s.semester||"MY SEMESTER").toUpperCase()}</div><h1>${esc(s.name)} <span style="color:${c.accent}">♡</span></h1><p>Your own space for learning, planning and notes.</p></div><button class="button secondary" data-edit-subject="${s.id}">Edit subject</button></section>
      <section class="exam-banner"><div><small>EXAM DATE</small><strong>${s.examDate?fmtDate(s.examDate):"Not added yet"}</strong><p>${s.examDate?daysUntil(s.examDate):"Add your exam date when you know it."}</p></div><span class="exam-icon">▦</span></section>
      <div class="subject-detail-grid"><div>
        <section class="section-card"><div class="section-heading"><div><h2>Assignments</h2><p>${s.assignments.filter(i=>i.done).length} of ${s.assignments.length} completed</p></div><button class="text-button" data-action="add-item" data-subject-id="${s.id}">＋ Add</button></div>
        ${s.assignments.length?s.assignments.map(i=>assignmentHtml(s,i)).join(""):empty("A fresh start","Add your first assignment or deadline.","＋ Add assignment","add-item")}</section>
        <section class="section-card"><div class="section-heading"><div><h2>My notes</h2><p>Ideas, summaries and questions for this subject</p></div><span style="color:${c.accent};font-size:21px">✎</span></div><textarea class="notes-editor" id="subject-notes" placeholder="Start writing your notes here...&#10;&#10;You can add summaries, key concepts, questions to revisit, or anything you want to remember.">${esc(s.notes||"")}</textarea><div class="save-hint" id="notes-save-hint">♡ Notes are saved automatically on this device.</div></section>
      </div><div>
        <section class="section-card"><div class="section-heading"><div><h2>Course topics</h2><p>Track what you have learned</p></div><button class="text-button" data-action="add-topic" data-subject-id="${s.id}">＋ Add</button></div>
        <div class="topic-progress"><div class="progress-row"><span>Learning progress</span><strong>${prog}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${prog}%;--accent:${c.accent}"></div></div></div>
        ${s.topics.length?s.topics.map(t=>topicHtml(s,t)).join(""):empty("Your learning journey","Add topics from your syllabus, then check them off as you learn.","＋ Add a topic","add-topic")}</section>
        <section class="section-card"><div class="section-heading"><div><h2>Study reminder</h2><p>Keep it manageable</p></div><span style="font-size:22px;color:${c.accent}">✿</span></div><p style="font-family:'Playfair Display',serif;font-size:17px;line-height:1.5;margin:0">“Progress, not perfection.”</p><p style="font-size:11px;color:var(--muted);line-height:1.6">Small study sessions add up. You do not need to learn everything in one day.</p><button class="button primary" id="subject-timer">Start focus session</button></section>
      </div></div>`;
    $("subject-timer")?.addEventListener("click",Pomodoro.open);
    $("subject-notes")?.addEventListener("input", async e=>{s.notes=e.target.value;await persist();$("notes-save-hint").textContent="Saved ♡";});
  }
  function daysUntil(date) {
    const today=new Date();today.setHours(0,0,0,0);const d=new Date(date+"T00:00:00");const days=Math.ceil((d-today)/86400000);
    return days<0?`Exam date passed ${Math.abs(days)} day${Math.abs(days)===1?"":"s"} ago`:days===0?"Your exam is today ♡":`${days} day${days===1?"":"s"} to go — you’ve got this ♡`;
  }
  function deadlinesPage() {
    const items=allItems();
    const filtered=state.deadlineFilter==="all"?items:state.deadlineFilter==="todo"?items.filter(i=>!i.done):items.filter(i=>i.done);
    root.innerHTML=`<section class="page-header"><div><div class="eyebrow">DATES & LITTLE MILESTONES</div><h1>Deadlines</h1><p>All assignments and exam dates across your semester.</p></div></section>
      <section class="section-card"><div class="filter-row"><button class="filter-chip ${state.deadlineFilter==="all"?"active":""}" data-filter="all">Everything (${items.length})</button><button class="filter-chip ${state.deadlineFilter==="todo"?"active":""}" data-filter="todo">To do (${items.filter(i=>!i.done).length})</button><button class="filter-chip ${state.deadlineFilter==="done"?"active":""}" data-filter="done">Completed (${items.filter(i=>i.done).length})</button></div>
      ${filtered.length?`<div class="all-deadlines">${filtered.map(deadlineRow).join("")}</div>`:empty("Nothing here yet","Add assignment deadlines inside your subjects and they will appear here.")}</section>`;
  }
  function notesPage() {
    const notes=state.subjects.filter(s=>s.notes?.trim());
    root.innerHTML=`<section class="page-header"><div><div class="eyebrow">THOUGHTS, IDEAS & SUMMARIES</div><h1>My notes</h1><p>Your notes, organised by subject.</p></div></section>
      ${notes.length?`<div class="subject-grid">${notes.map(s=>`<article class="note-card"><strong>${esc(s.name)}</strong><small>${esc(s.semester||"My semester")}</small><p>${esc(s.notes)}</p><button class="button secondary" data-open-subject="${s.id}">Open notes ↗</button></article>`).join("")}</div>`:empty("Your notes live here","Open any subject to write and automatically save notes there.")}`;
  }
  function render() {
    const s=activeSubject();
    $("breadcrumb").textContent=state.view==="subject"&&s?`MY SUBJECTS / ${s.name.toUpperCase()}`:`MY SPACE / ${({dashboard:"OVERVIEW",subjects:"MY SUBJECTS",deadlines:"DEADLINES",notes:"NOTES"}[state.view]||"OVERVIEW")}`;
    if(state.view==="dashboard")dashboard();
    else if(state.view==="subjects")subjectsPage();
    else if(state.view==="deadlines")deadlinesPage();
    else if(state.view==="notes")notesPage();
    else if(state.view==="subject"&&s)subjectPage(s);
    else {state.view="dashboard";dashboard();}
    document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view||(state.view==="subject"&&b.dataset.view==="subjects")));
  }
  function openSubjectDialog(subject=null) {
    $("subject-dialog-title").textContent=subject?"Edit subject":"Add a subject";
    $("subject-id").value=subject?.id||"";$("subject-name").value=subject?.name||"";
    $("subject-semester").value=subject?.semester||"Autumn 2026";$("subject-exam").value=subject?.examDate||"";
    $("subject-colour").value=subject?.colour||"rose";$("subject-dialog").showModal();$("subject-name").focus();
  }
  function openItemDialog(subjectId, item=null) {
    $("item-dialog-title").textContent=item?"Edit assignment":"Add an assignment";
    $("item-eyebrow").textContent=(state.subjects.find(s=>s.id===subjectId)?.name||"YOUR SUBJECT").toUpperCase();
    $("item-id").value=item?.id||"";$("item-kind").value="assignment";$("item-subject-id").value=subjectId||"";
    $("item-title").value=item?.title||"";$("item-date").value=item?.date||"";$("item-type").value=item?.type||"assignment";$("item-done").checked=!!item?.done;
    $("item-dialog").showModal();$("item-title").focus();
  }
  function openTopicDialog(subjectId) {$("topic-subject-id").value=subjectId||state.activeSubjectId;$("topic-name").value="";$("topic-dialog").showModal();$("topic-name").focus();}
  async function handleSubmit(e) {
    e.preventDefault();
    if(e.target.id==="subject-form"){
      const id=$("subject-id").value, input={name:$("subject-name").value,semester:$("subject-semester").value,examDate:$("subject-exam").value,colour:$("subject-colour").value};
      if(id){Object.assign(state.subjects.find(s=>s.id===id),input);Pomodoro.toast("Subject updated ♡");}
      else {const s=StudySubjects.createSubject(input);state.subjects.push(s);state.activeSubjectId=s.id;state.view="subject";Pomodoro.toast("Your new subject is ready ♡");}
      $("subject-dialog").close();await persist();render();
    } else if(e.target.id==="item-form"){
      const sid=$("item-subject-id").value,s=state.subjects.find(s=>s.id===sid),id=$("item-id").value;
      if(!s)return;
      const input={title:$("item-title").value,date:$("item-date").value,type:$("item-type").value,done:$("item-done").checked};
      if(id)Object.assign(s.assignments.find(i=>i.id===id),input);else s.assignments.push(StudySubjects.createItem(input));
      $("item-dialog").close();await persist();render();Pomodoro.toast("Assignment saved ♡");
    } else if(e.target.id==="topic-form"){
      const s=state.subjects.find(s=>s.id===$("topic-subject-id").value);if(!s)return;
      s.topics.push({id:StudySubjects.uid(),name:$("topic-name").value.trim(),done:false});$("topic-dialog").close();await persist();render();Pomodoro.toast("Topic added ♡");
    }
  }
  async function handleClick(e) {
    const close=e.target.closest("[data-close]");if(close){$(close.dataset.close).close();return;}
    const view=e.target.closest("[data-view]");if(view){if(view.dataset.view==="dashboard"||view.dataset.view==="subjects"||view.dataset.view==="deadlines"||view.dataset.view==="notes")navigate(view.dataset.view);return;}
    const action=e.target.closest("[data-action]");
    if(action){
      const act=action.dataset.action,sid=action.dataset.subjectId||state.activeSubjectId;
      if(act==="add-subject")openSubjectDialog();
      if(act==="add-item"){if(!sid){Pomodoro.toast("Open a subject first to add an assignment ♡");return;}openItemDialog(sid);}
      if(act==="add-topic"){if(!sid){Pomodoro.toast("Open a subject first to add a topic ♡");return;}openTopicDialog(sid);}
      return;
    }
    const editSubject=e.target.closest("[data-edit-subject]");if(editSubject){e.stopPropagation();const s=state.subjects.find(s=>s.id===editSubject.dataset.editSubject);if(s)openSubjectDialog(s);return;}
    const open=e.target.closest("[data-open-subject]");if(open){state.activeSubjectId=open.dataset.openSubject;state.view="subject";render();return;}
    const filter=e.target.closest("[data-filter]");if(filter){state.deadlineFilter=filter.dataset.filter;render();return;}
    const editItem=e.target.closest("[data-edit-item]");if(editItem){const s=state.subjects.find(s=>s.id===editItem.dataset.subjectId),i=s?.assignments.find(i=>i.id===editItem.dataset.editItem);if(i)openItemDialog(s.id,i);return;}
    const delItem=e.target.closest("[data-delete-item]");if(delItem){const s=state.subjects.find(s=>s.id===delItem.dataset.subjectId);if(s&&confirm("Delete this assignment?")){s.assignments=s.assignments.filter(i=>i.id!==delItem.dataset.deleteItem);await persist();render();}return;}
    const delTopic=e.target.closest("[data-delete-topic]");if(delTopic){const s=state.subjects.find(s=>s.id===delTopic.dataset.subjectId);if(s&&confirm("Delete this topic?")){s.topics=s.topics.filter(t=>t.id!==delTopic.dataset.deleteTopic);await persist();render();}return;}
  }
  async function handleChange(e) {
    if(e.target.matches("[data-toggle-item]")) {
      const id=e.target.dataset.toggleItem;
      for(const s of state.subjects){const i=s.assignments.find(i=>i.id===id);if(i)i.done=e.target.checked;}
      await persist();render();
    } else if(e.target.matches("[data-toggle-topic]")) {
      const s=activeSubject(),t=s?.topics.find(t=>t.id===e.target.dataset.toggleTopic);if(t)t.done=e.target.checked;
      await persist();render();
    } else if(e.target.id==="import-data"&&e.target.files[0]) {
      try {
        const parsed=JSON.parse(await e.target.files[0].text());
        if(!Array.isArray(parsed.subjects))throw new Error("Invalid backup");
        if(confirm("Replace the current subjects with the imported backup?")){state.subjects=parsed.subjects;state.backgroundDataUrl=parsed.backgroundDataUrl||"";await persist();navigate("dashboard");Pomodoro.toast("Backup imported ♡");}
      } catch { alert("This backup file could not be read. Please choose a Pink Study Space JSON backup."); }
      e.target.value="";
    } else if(e.target.id==="background-upload"&&e.target.files[0]) {
      const file=e.target.files[0];if(file.size>2*1024*1024){alert("Please choose an image smaller than 2 MB for this first version.");e.target.value="";return;}
      const reader=new FileReader();reader.onload=async()=>{state.backgroundDataUrl=reader.result;await persist();document.body.style.backgroundImage=`linear-gradient(#fbf7f5d9,#fbf7f5d9),url("${state.backgroundDataUrl}")`;Pomodoro.toast("Your background is saved ♡");};reader.readAsDataURL(file);e.target.value="";
    }
  }
  function init() {
    document.addEventListener("click",handleClick);document.addEventListener("change",handleChange);
    $("subject-form").addEventListener("submit",handleSubmit);$("item-form").addEventListener("submit",handleSubmit);$("topic-form").addEventListener("submit",handleSubmit);
    $("open-timer").addEventListener("click",Pomodoro.open);$("open-timer-top").addEventListener("click",Pomodoro.open);
    $("quick-note").addEventListener("click",()=>{const s=activeSubject()||state.subjects[0];if(s){state.activeSubjectId=s.id;state.view="subject";render();$("subject-notes").focus();}else{Pomodoro.toast("Add a subject first to keep your notes organised ♡");openSubjectDialog();}});
    $("export-data").addEventListener("click",()=>{const data={app:"Pink Study Space",version:1,exportedAt:new Date().toISOString(),subjects:state.subjects,backgroundDataUrl:state.backgroundDataUrl};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="pink-study-space-backup.json";a.click();URL.revokeObjectURL(url);});
    $("import-data").addEventListener("change",handleChange);$("background-upload").addEventListener("change",handleChange);
    $("today-label").textContent=new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short"}).format(new Date());
    Pomodoro.init();
    StudyStorage.load().then(saved=>{if(saved&&Array.isArray(saved.subjects)){state.subjects=saved.subjects;state.backgroundDataUrl=saved.backgroundDataUrl||"";if(state.backgroundDataUrl)document.body.style.backgroundImage=`linear-gradient(#fbf7f5d9,#fbf7f5d9),url("${state.backgroundDataUrl}")`;}render();}).catch(()=>render());
  }
  init();
})();