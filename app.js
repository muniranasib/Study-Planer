(() => {
  "use strict";

  const STORAGE_KEY = "study-space-data-v1";
  const TIMER_KEY = "study-space-timer-v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const formatDate = value => {
    if (!value) return "No date";
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? "Invalid date" : new Intl.DateTimeFormat("no-NO", {day:"numeric", month:"short", year:"numeric"}).format(d);
  };
  const daysUntil = value => {
    if (!value) return null;
    const a = new Date(`${todayISO()}T00:00:00`);
    const b = new Date(`${value}T00:00:00`);
    if (Number.isNaN(b.getTime())) return null;
    return Math.round((b-a)/86400000);
  };
  const defaultData = () => ({ version: 1, subjects: [], tasks: [], topics: [], notes: [], background: null });
  let data = defaultData();
  let currentPage = "overview";
  let currentSubjectId = null;
  let subjectTab = "tasks";
  let deadlineFilter = "all";
  let noteSearch = "";
  let currentNoteId = null;
  let noteSaveTimer = null;
  let toastTimer = null;
  let timer = { mode:"focus", focusMinutes:25, breakMinutes:5, remaining:1500, running:false, endAt:null, completedSessions:0, lastTick:Date.now() };

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.subjects) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.topics) || !Array.isArray(parsed.notes)) {
        throw new Error("Lagringsdataene har et format appen ikke kjenner igjen.");
      }
      return { ...defaultData(), ...parsed };
    } catch (error) {
      setSaveStatus("error", "Could not read saved data");
      showToast("Could not read data: " + error.message);
      return defaultData();
    }
  }
  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaveStatus("ok", "Saved on this device");
      return true;
    } catch (error) {
      setSaveStatus("error", "Saving failed");
      showToast("Could not save data. Export a backup and check your browser storage space.");
      return false;
    }
  }
  function setSaveStatus(state, text) {
    const el = $("#saveStatus");
    if (!el) return;
    el.classList.toggle("error", state === "error");
    el.innerHTML = `<span class="status-dot"></span><span>${escapeHTML(text)}</span>`;
  }
  function showToast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }
  function subjectById(id) { return data.subjects.find(s => s.id === id); }
  function tasksFor(id) { return data.tasks.filter(t => !id || t.subjectId === id); }
  function topicsFor(id) { return data.topics.filter(t => !id || t.subjectId === id); }
  function notesFor(id) { return data.notes.filter(n => !id || n.subjectId === id); }
  function topicProgress(id) {
    const list = topicsFor(id);
    return list.length ? Math.round(list.filter(t => t.done).length / list.length * 100) : 0;
  }
  function subjectName(id) { return subjectById(id)?.name || "Uten fag"; }
  function allDeadlines() {
    const taskItems = data.tasks.filter(t => t.dueDate).map(t => ({ id:t.id, date:t.dueDate, title:t.title, subjectId:t.subjectId, done:t.done, kind:t.type || "Assignment", source:"task" }));
    const examItems = data.subjects.filter(s => s.examDate).map(s => ({ id:s.id, date:s.examDate, title:`Exam: ${s.name}`, subjectId:s.id, done:false, kind:"Exam", source:"exam" }));
    return [...taskItems, ...examItems].sort((a,b) => a.date.localeCompare(b.date));
  }
  function visibleDeadlines(filter = "due") {
    const today = todayISO();
    return allDeadlines().filter(item => {
      if (filter === "due") return !item.done;
      if (filter === "completed") return item.done;
      return true;
    });
  }
  function dateBadge(date) {
    const d = new Date(`${date}T12:00:00`);
    return `<div class="deadline-date"><b>${Number.isNaN(d.getTime()) ? "—" : d.getDate()}</b><small>${Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("no-NO",{month:"short"})}</small></div>`;
  }
  function deadlineHTML(item) {
    const delta = daysUntil(item.date);
    const dateText = delta === null ? formatDate(item.date) : delta < 0 ? `${Math.abs(delta)} days ago` : delta === 0 ? "I dag" : `In ${delta} days`;
    return `<div class="deadline-item">${dateBadge(item.date)}<div class="deadline-info"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(subjectName(item.subjectId))} · ${escapeHTML(item.kind)} · ${escapeHTML(dateText)}</small></div>${item.done ? '<span class="pill success">Complete</span>' : delta !== null && delta >= 0 && delta <= 7 ? '<span class="pill warning">Snart</span>' : ""}</div>`;
  }
  function emptyState(icon, title, body, buttonText, action) {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${body}</p>${buttonText ? `<button class="button button-primary" data-action="${action}">${buttonText}</button>` : ""}</div>`;
  }
  function subjectCard(s) {
    const tasks = tasksFor(s.id);
    const topicCount = topicsFor(s.id).length;
    const doneTasks = tasks.filter(t => t.done).length;
    const progress = topicProgress(s.id);
    return `<article class="subject-card subject-color-${escapeHTML(s.color||"rose")}" data-open-subject="${s.id}" tabindex="0" role="button" aria-label="Åpne ${escapeHTML(s.name)}">
      <div class="subject-card-top"><span class="subject-symbol">♡</span><button class="subject-menu" data-action="subject-menu" data-id="${s.id}" aria-label="Fagvalg">···</button></div>
      <h3>${escapeHTML(s.name)}</h3><div class="subject-meta">${escapeHTML(s.semester || "Semester not set")}<br>${tasks.length} tasks · ${doneTasks} completed</div>
      <div class="progress-row"><span>Topics learned · ${topicCount} topics</span><strong>${progress}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
    </article>`;
  }
  function renderOverview() {
    const upcoming = visibleDeadlines("due").filter(item => item.date >= todayISO()).slice(0,4);
    const completed = data.tasks.filter(t => t.done).length;
    const learned = data.topics.filter(t => t.done).length;
    const dueCount = visibleDeadlines("due").filter(item => item.date >= todayISO()).length;
    return `<section class="hero"><div><p class="eyebrow">A SOFTER WAY TO STUDY</p><h1>Welcome to your study space <span class="heart">♡</span></h1><p class="hero-subtitle">One little step at a time. Your semester, all in one place.</p></div><div class="hero-actions"><button class="button" data-action="customize">✿ Customize</button><button class="button button-primary" data-action="add-subject">＋ Add subject</button></div></section>
      <section class="stats-grid">
        <div class="stat-card"><span class="stat-icon">▤</span><div><div class="stat-label">My subjects</div><div class="stat-value">${data.subjects.length}</div></div></div>
        <div class="stat-card"><span class="stat-icon">▦</span><div><div class="stat-label">Upcoming deadlines</div><div class="stat-value">${dueCount}</div></div></div>
        <div class="stat-card"><span class="stat-icon">♡</span><div><div class="stat-label">Assignments completed</div><div class="stat-value">${completed}</div></div></div>
        <div class="stat-card"><span class="stat-icon">✧</span><div><div class="stat-label">Topics learned</div><div class="stat-value">${learned}</div></div></div>
      </section>
      <section class="dashboard-grid">
        <div class="panel"><div class="panel-header"><div><h2 class="panel-title">My subjects</h2><p class="panel-subtitle">Your semester at a glance</p></div><button class="text-button" data-page="subjects">View all ↗</button></div>
          ${data.subjects.length ? `<div class="subject-grid">${data.subjects.slice(0,4).map(subjectCard).join("")}</div>` : emptyState("♡","Your semester starts here","Add your first subject to bring assignments, exam dates, topics and notes together in one place.","Add your first subject","add-subject")}
        </div>
        <div class="panel"><div class="panel-header"><div><h2 class="panel-title">Coming up</h2><p class="panel-subtitle">Deadlines to keep in mind</p></div><button class="text-button" data-page="deadlines">All ↗</button></div>
          ${upcoming.length ? `<div class="deadline-list">${upcoming.map(deadlineHTML).join("")}</div>` : emptyState("✿","Nothing due just yet","Add assignment dates to see upcoming deadlines here.","Add an assignment","add-task")}
        </div>
      </section>`;
  }
  function renderSubjects() {
    return `<div class="section-heading"><div><p class="eyebrow">YOUR SEMESTER</p><h1>My subjects <span class="heart">♡</span></h1><p>All your courses, gathered in one calm place.</p></div><button class="button button-primary" data-action="add-subject">＋ Add subject</button></div>
    ${data.subjects.length ? `<div class="subject-grid">${data.subjects.map(subjectCard).join("")}</div>` : emptyState("♡","No subjects yet","Create a subject to start planning your semester.","Add subject","add-subject")}`;
  }
  function renderDeadlines() {
    const items = visibleDeadlines(deadlineFilter);
    return `<div class="section-heading"><div><p class="eyebrow">STAY GENTLY ON TRACK</p><h1>Deadlines <span class="heart">♡</span></h1><p>Assignments and exam dates across all your subjects.</p></div><button class="button button-primary" data-action="add-task">＋ Add assignment</button></div>
    <div class="filter-row">${[["all","All"],["due","Due"],["completed","Complete"]].map(([v,l])=>`<button class="filter-chip ${deadlineFilter===v?"active":""}" data-filter="${v}">${l}</button>`).join("")}</div>
    <div class="panel">${items.length ? `<div class="deadline-list">${items.map(item => item.source==="task" ? `<div class="deadline-item">${dateBadge(item.date)}<input class="check-input" type="checkbox" data-toggle-task="${item.id}" ${item.done?"checked":""} aria-label="Marker completed"><div class="deadline-info"><strong class="${item.done?"done-text":""}">${escapeHTML(item.title)}</strong><small>${escapeHTML(subjectName(item.subjectId))} · ${escapeHTML(item.kind)} · ${formatDate(item.date)}</small></div><button class="small-icon" data-action="edit-task" data-id="${item.id}" aria-label="Rediger">✎</button></div>` : deadlineHTML(item)).join("")}</div>` : emptyState("▦","No deadlines here","Add assignment due dates or set an exam date for a subject.", "Add assignment","add-task")}</div>`;
  }
  function renderNotes() {
    const q = noteSearch.trim().toLocaleLowerCase("no");
    const notes = notesFor().filter(n => `${n.title} ${n.content} ${n.topic || ""} ${subjectName(n.subjectId)}`.toLocaleLowerCase("no").includes(q));
    return `<div class="section-heading"><div><p class="eyebrow">YOUR NOTE LIBRARY</p><h1>Notes <span class="heart">♡</span></h1><p>Forelesninger, ideer og pensum – samlet og søkbart.</p></div><button class="button button-primary" data-action="new-note">＋ New note</button></div>
    <div class="field"><input class="search-input" id="noteSearch" type="search" placeholder="Søk i titler, innhold, fag og tema …" value="${escapeHTML(noteSearch)}" aria-label="Søk i notater"></div>
    ${notes.length ? `<div class="note-grid">${notes.map(n=>`<article class="note-card" data-open-note="${n.id}" tabindex="0" role="button"><span class="pill">${escapeHTML(subjectName(n.subjectId))}</span><h3>${escapeHTML(n.title || "Untitled note")}</h3><p>${escapeHTML(n.topic || "No topic added")}<br>${escapeHTML((n.content||"").slice(0,150))}${(n.content||"").length>150?"…":""}</p><small class="muted">${n.updatedAt ? `Oppdatert ${new Date(n.updatedAt).toLocaleDateString("no-NO")}` : ""}</small></article>`).join("")}</div>` : emptyState("✎",q?"No notes found":"Your notes live here","Create notes for your subjects. Your content is saved automatically as you type.", "Create a note","new-note")}`;
  }
  function renderSubjectDetail() {
    const s = subjectById(currentSubjectId);
    if (!s) { currentPage = "subjects"; return renderSubjects(); }
    const delta = daysUntil(s.examDate);
    const examLine = s.examDate ? `Exam ${formatDate(s.examDate)}${delta === null ? "" : delta < 0 ? ` · ${Math.abs(delta)} days ago` : delta === 0 ? " · Exam i dag" : ` · ${delta} days left`}` : "No exam date added";
    const tabs = [["tasks","Assignments"],["topics","Topics"],["notes","Notes"]];
    let content = "";
    if (subjectTab === "tasks") {
      const list = tasksFor(s.id);
      content = `<div class="panel"><div class="panel-header"><div><h2 class="panel-title">Assignments & tasks</h2><p class="panel-subtitle">Keep track of what you need to do.</p></div><button class="button button-primary" data-action="add-task" data-subject="${s.id}">＋ Add task</button></div>
      ${list.length ? list.sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999")).map(t=>`<div class="list-card ${t.done?"done":""}"><input class="check-input" type="checkbox" data-toggle-task="${t.id}" ${t.done?"checked":""} aria-label="Marker ${escapeHTML(t.title)} completed"><div class="list-main"><strong>${escapeHTML(t.title)}</strong><p>${escapeHTML(t.type)} · ${t.dueDate ? "Due: "+formatDate(t.dueDate) : "No due date"} · ${t.done?"Complete":"Due"}</p></div><div class="list-actions"><button class="small-icon" data-action="edit-task" data-id="${t.id}" aria-label="Rediger oppgave">✎</button><button class="small-icon" data-action="delete-task" data-id="${t.id}" aria-label="Delete oppgave">×</button></div></div>`).join("") : emptyState("♡","A little at a time","Add assignments, tasks or reading tasks.","Add task","add-task")}</div>`;
    } else if (subjectTab === "topics") {
      const list = topicsFor(s.id);
      content = `<div class="panel"><div class="panel-header"><div><h2 class="panel-title">Topics learned</h2><p class="panel-subtitle">${list.filter(t=>t.done).length} av ${list.length} topics completed · ${topicProgress(s.id)}%</p></div><button class="button button-primary" data-action="add-topic" data-subject="${s.id}">＋ Add topic</button></div><div class="progress-track" style="height:8px;margin-bottom:20px"><div class="progress-fill" style="width:${topicProgress(s.id)}%"></div></div>
      ${list.length ? list.map(t=>`<div class="list-card ${t.done?"done":""}"><input class="check-input" type="checkbox" data-toggle-topic="${t.id}" ${t.done?"checked":""} aria-label="Mark topic as learned"><div class="list-main"><strong>${escapeHTML(t.title)}</strong><p>${t.done?"Learned ♡":"Not marked as learned"}</p></div><button class="small-icon" data-action="delete-topic" data-id="${t.id}" aria-label="Delete topic">×</button></div>`).join("") : emptyState("✧","Your learning journey","Add syllabus topics and check them off as you learn.","Add topic","add-topic")}</div>`;
    } else {
      const list = notesFor(s.id);
      content = `<div class="panel"><div class="panel-header"><div><h2 class="panel-title">Notes for ${escapeHTML(s.name)}</h2><p class="panel-subtitle">Notes are saved automatically as you type.</p></div><button class="button button-primary" data-action="new-note" data-subject="${s.id}">＋ New note</button></div>${list.length ? `<div class="note-grid">${list.map(n=>`<article class="note-card" data-open-note="${n.id}" tabindex="0" role="button"><span class="pill">${escapeHTML(n.topic||"Note")}</span><h3>${escapeHTML(n.title)}</h3><p>${escapeHTML((n.content||"").slice(0,140))}</p></article>`).join("")}</div>` : emptyState("✎","No notes for this subject","Lag ditt første notat for faget.","New note","new-note")}</div>`;
    }
    return `<button class="back-link" data-page="subjects">← Back to all subjects</button>
      <section class="detail-hero"><div class="section-heading" style="margin:0"><div><p class="eyebrow">${escapeHTML(s.semester||"YOUR SUBJECT")}</p><h1>${escapeHTML(s.name)} <span class="heart">♡</span></h1><div class="detail-meta"><span>▦ ${escapeHTML(examLine)}</span><span>·</span><span>${topicProgress(s.id)}% of topics learned</span></div></div><div class="inline-actions"><button class="button" data-action="edit-subject" data-id="${s.id}">✎ Edit subject</button><button class="button" data-action="subject-menu" data-id="${s.id}">···</button></div></div></section>
      <div class="detail-tabs">${tabs.map(([v,l])=>`<button class="detail-tab ${subjectTab===v?"active":""}" data-subject-tab="${v}">${l}${v==="tasks"?" ("+tasksFor(s.id).length+")":v==="topics"?" ("+topicsFor(s.id).length+")":" ("+notesFor(s.id).length+")"}</button>`).join("")}</div>${content}`;
  }
  function renderNoteEditor() {
    const n = data.notes.find(x=>x.id===currentNoteId);
    if (!n) { currentPage = "notes"; return renderNotes(); }
    return `<button class="back-link" data-page="${currentSubjectId ? "subject-detail" : "notes"}">← Back to ${currentSubjectId ? "subject" : "notes"}</button>
      <div class="section-heading"><div><p class="eyebrow">NOTEBOOK / AUTO-SAVED</p><h1>Edit note <span class="heart">♡</span></h1><p>Changes are saved automatically on this device.</p></div><button class="button button-danger" data-action="delete-note" data-id="${n.id}">Delete note</button></div>
      <div class="panel note-form"><div class="field"><label for="noteTitle">Note title</label><input id="noteTitle" data-note-field="title" value="${escapeHTML(n.title)}" placeholder="e.g. Lecture 3 – machine learning"></div>
      <div class="form-grid"><div class="field"><label for="noteSubject">Subject</label><select id="noteSubject" data-note-field="subjectId"><option value="">Uten fag</option>${data.subjects.map(s=>`<option value="${s.id}" ${n.subjectId===s.id?"selected":""}>${escapeHTML(s.name)}</option>`).join("")}</select></div><div class="field"><label for="noteTopic">Lecture / topic (optional)</label><input id="noteTopic" data-note-field="topic" value="${escapeHTML(n.topic||"")}" placeholder="Kapittel, forelesning eller tema"></div></div>
      <div class="field"><label for="noteContent">Your notes</label><textarea id="noteContent" data-note-field="content" rows="18" placeholder="Write your notes here …">${escapeHTML(n.content||"")}</textarea></div><div class="right muted" id="noteSaveLabel">Saved on this device</div></div>`;
  }
  function renderPage() {
    const content = $("#pageContent");
    const labels = {overview:"MY SPACE / OVERVIEW", subjects:"MY SPACE / MY SUBJECTS", deadlines:"MY SPACE / DEADLINES", notes:"MY SPACE / NOTES", "subject-detail":"MY SPACE / SUBJECT", "note-editor":"MY SPACE / NOTE"};
    $("#breadcrumb").textContent = labels[currentPage] || "MY SPACE";
    $$(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.page === (currentPage==="subject-detail"?"subjects":currentPage==="note-editor"?"notes":currentPage)));
    if (currentPage==="overview") content.innerHTML = renderOverview();
    else if (currentPage==="subjects") content.innerHTML = renderSubjects();
    else if (currentPage==="deadlines") content.innerHTML = renderDeadlines();
    else if (currentPage==="notes") content.innerHTML = renderNotes();
    else if (currentPage==="subject-detail") content.innerHTML = renderSubjectDetail();
    else if (currentPage==="note-editor") content.innerHTML = renderNoteEditor();
    else { currentPage="overview"; content.innerHTML = renderOverview(); }
  }
  function navigate(page) {
    if (page === "subject-detail" && !subjectById(currentSubjectId)) page = "subjects";
    if (page === "note-editor" && !data.notes.some(n=>n.id===currentNoteId)) page = "notes";
    currentPage = page;
    renderPage();
    window.scrollTo({top:0, behavior:"smooth"});
  }

  const modalBackdrop = $("#modalBackdrop");
  function openModal(title, body, wide=false) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = body;
    $(".modal").classList.toggle("modal-wide", wide);
    modalBackdrop.hidden = false;
    const first = $("input:not([type=hidden]), select, textarea, button", $("#modalBody"));
    if (first) setTimeout(()=>first.focus(), 20);
  }
  function closeModal() {
    modalBackdrop.hidden = true;
    $("#modalBody").innerHTML = "";
  }
  function subjectOptions(selected="") {
    return `<option value="">Choose subject (optional)</option>${data.subjects.map(s=>`<option value="${s.id}" ${s.id===selected?"selected":""}>${escapeHTML(s.name)}</option>`).join("")}`;
  }
  function showSubjectForm(id=null) {
    const s = id ? subjectById(id) : null;
    openModal(s?"Edit subject":"Add a subject", `<form id="subjectForm">
      <div class="field"><label for="subjectName">Subject name *</label><input id="subjectName" name="name" required maxlength="120" value="${escapeHTML(s?.name||"")}" placeholder="e.g. Introduction to AI"></div>
      <div class="field"><label for="semester">Semester</label><input id="semester" name="semester" value="${escapeHTML(s?.semester||"Autumn 2026")}" placeholder="Autumn 2026"></div>
      <div class="field"><label for="examDate">Exam date</label><input id="examDate" name="examDate" type="date" value="${escapeHTML(s?.examDate||"")}"></div>
      <div class="field"><label for="subjectColor">Subject colour</label><select id="subjectColor" name="color">${[["rose","Soft rose"],["lilac","Lilac"],["blue","Powder blue"],["sage","Sage green"],["peach","Peach"],["butter","Butter yellow"]].map(([v,l])=>`<option value="${v}" ${(s?.color||"rose")===v?"selected":""}>${l}</option>`).join("")}</select></div>
      <div class="form-actions"><button type="button" class="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Save subject</button></div></form>`);
    $("#subjectForm").addEventListener("submit", e=>{
      e.preventDefault(); const fd=new FormData(e.currentTarget);
      const name=String(fd.get("name")||"").trim(); if(!name) return;
      if(s) Object.assign(s,{name,semester:String(fd.get("semester")||"").trim(),examDate:String(fd.get("examDate")||""),color:String(fd.get("color")||"rose")});
      else data.subjects.push({id:uid(),name,semester:String(fd.get("semester")||"").trim(),examDate:String(fd.get("examDate")||""),color:String(fd.get("color")||"rose")});
      saveData(); closeModal(); renderPage(); showToast(s?"Subject updated ♡":"Subject added ♡");
    });
  }
  function showTaskForm(id=null, subjectId=null) {
    const t=id?data.tasks.find(x=>x.id===id):null;
    const preset=subjectId||currentSubjectId||"";
    openModal(t?"Edit assignment":"Add an assignment", `<form id="taskForm">
      <div class="field"><label for="taskTitle">Title *</label><input id="taskTitle" name="title" required maxlength="180" value="${escapeHTML(t?.title||"")}" placeholder="e.g. Read chapter 4"></div>
      <div class="form-grid"><div class="field"><label for="taskSubject">Subject</label><select id="taskSubject" name="subjectId">${subjectOptions(t?.subjectId||preset)}</select></div><div class="field"><label for="taskType">Type</label><select id="taskType" name="type">${["Assignment","Assignment","Reading","Exam","Other"].map(x=>`<option ${x===(t?.type||"Assignment")?"selected":""}>${x}</option>`).join("")}</select></div></div>
      <div class="field"><label for="taskDate">Due date (optional)</label><input id="taskDate" name="dueDate" type="date" value="${escapeHTML(t?.dueDate||"")}"></div>
      <div class="field"><label><input type="checkbox" name="done" ${t?.done?"checked":""}> Markert som completed</label></div>
      <div class="form-actions"><button type="button" class="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Save assignment</button></div></form>`);
    $("#taskForm").addEventListener("submit", e=>{
      e.preventDefault(); const fd=new FormData(e.currentTarget); const title=String(fd.get("title")||"").trim(); if(!title)return;
      const record={title,subjectId:String(fd.get("subjectId")||""),type:String(fd.get("type")||"Assignment"),dueDate:String(fd.get("dueDate")||""),done:fd.get("done")==="on"};
      if(t) Object.assign(t,record); else data.tasks.push({id:uid(),...record});
      saveData(); closeModal(); renderPage(); showToast("Assignmentn er lagret ♡");
    });
  }
  function showTopicForm(subjectId=null) {
    const s=subjectById(subjectId||currentSubjectId);
    if(!s) { showToast("Choose a subject first."); return; }
    openModal("Add a topic", `<form id="topicForm"><p class="muted">Subject: ${escapeHTML(s.name)}</p><div class="field"><label for="topicTitle">Topic *</label><input id="topicTitle" name="title" required maxlength="180" placeholder="e.g. Neural networks"></div><div class="form-actions"><button type="button" class="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Add topic</button></div></form>`);
    $("#topicForm").addEventListener("submit",e=>{e.preventDefault();const title=String(new FormData(e.currentTarget).get("title")||"").trim();if(!title)return;data.topics.push({id:uid(),subjectId:s.id,title,done:false});saveData();closeModal();renderPage();showToast("Topic added ♡");});
  }
  function createNote(subjectId="") {
    const note={id:uid(),title:"",subjectId:subjectId||"",topic:"",content:"",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    data.notes.unshift(note); currentNoteId=note.id; currentSubjectId=subjectId||currentSubjectId; saveData(); navigate("note-editor");
    setTimeout(()=>$("#noteTitle")?.focus(),30);
  }
  function scheduleNoteSave() {
    clearTimeout(noteSaveTimer);
    const label=$("#noteSaveLabel");
    if(label) label.textContent="Saving…";
    noteSaveTimer=setTimeout(()=>{
      const n=data.notes.find(x=>x.id===currentNoteId); if(!n)return;
      $$("[data-note-field]").forEach(el=>{
        const key=el.dataset.noteField;
        if(key==="subjectId") n.subjectId=el.value; else n[key]=el.value;
      });
      n.updatedAt=new Date().toISOString();
      const ok=saveData();
      if(label) label.textContent=ok?"Saved on this device":"Could not save — export a backup";
    },250);
  }
  function deleteNote(id) {
    const n=data.notes.find(x=>x.id===id);
    if(!n || !confirm(`Delete notatet «${n.title||"Untitled note"}»? This cannot be undone.`))return;
    data.notes=data.notes.filter(x=>x.id!==id);saveData();closeModal();currentNoteId=null;navigate(currentSubjectId?"subject-detail":"notes");showToast("Note deleted.");
  }
  function showCustomize() {
    openModal("Customize your space", `<p class="muted">Choose an image from your computer. The image is stored locally in this browser. Large images may exceed browser storage limits.</p>
      <div class="field"><label for="backgroundFile">Background image</label><input type="file" id="backgroundFile" accept="image/*"></div>
      <div class="settings-preview">${data.background?`<img class="bg-thumb" src="${data.background}" alt="Valgt bakgrunn">`:`<div class="bg-thumb"></div>`}<div><strong>${data.background?"Custom background selected":"Soft pink default"}</strong><p class="muted" style="margin:4px 0 0">A light overlay stays over the image for readability.</p></div></div>
      <div class="form-actions"><button type="button" class="button button-danger" data-action="remove-background">Remove background</button><button type="button" class="button" data-close-modal>Close</button></div>`);
    $("#backgroundFile").addEventListener("change",e=>{
      const file=e.target.files?.[0];if(!file)return;
      if(!file.type.startsWith("image/")){showToast("Choose an image file.");return;}
      if(file.size>3*1024*1024){showToast("The image is larger than 3 MB. Choose a smaller image for local storage.");e.target.value="";return;}
      const reader=new FileReader();
      reader.onload=()=>{data.background=reader.result;const ok=saveData();if(ok){applyBackground();closeModal();showToast("Bakgrunn lagret på denne enheten ♡");}else{data.background=null;}};
      reader.onerror=()=>showToast("Could not read the image file.");
      reader.readAsDataURL(file);
    });
  }
  function applyBackground() {
    const main=$(".main-area");
    if(data.background) main.style.backgroundImage=`linear-gradient(rgba(250,246,244,.91),rgba(250,246,244,.91)),url("${data.background}")`;
    else main.style.backgroundImage="";
  }

  function loadTimer() {
    try {
      const saved=JSON.parse(localStorage.getItem(TIMER_KEY)||"null");
      if(saved && typeof saved==="object") timer={...timer,...saved};
    } catch (_) {}
    timer.focusMinutes=Math.max(1,Math.min(180,Number(timer.focusMinutes)||25));
    timer.breakMinutes=Math.max(1,Math.min(60,Number(timer.breakMinutes)||5));
    timer.remaining=Math.max(0,Number(timer.remaining)||timer.focusMinutes*60);
    if(timer.running && timer.endAt) {
      timer.remaining=Math.max(0,Math.ceil((timer.endAt-Date.now())/1000));
      if(timer.remaining===0) finishTimerPhase(false);
    }
    if(!timer.running && (!timer.remaining || !Number.isFinite(timer.remaining))) timer.remaining=(timer.mode==="focus"?timer.focusMinutes:timer.breakMinutes)*60;
    updateTimerDisplays();
  }
  function saveTimer() {
    try { localStorage.setItem(TIMER_KEY,JSON.stringify(timer)); } catch (_) {}
  }
  function fmtTime(seconds) {
    seconds=Math.max(0,Math.floor(seconds));
    return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  }
  function updateTimerDisplays() {
    const remaining=timer.running&&timer.endAt ? Math.max(0,Math.ceil((timer.endAt-Date.now())/1000)) : timer.remaining;
    const display=fmtTime(remaining);
    if($("#timerDisplaySide")) $("#timerDisplaySide").textContent=display;
    if($("#timerStatusSide")) $("#timerStatusSide").textContent=timer.running?(timer.mode==="focus"?"Focus session in progress":"Break in progress"):(timer.mode==="focus"?"Ready for a little focus?":"Ready for a little break?");
    if($("#timerModalTime")) $("#timerModalTime").textContent=display;
    if($("#timerModalMode")) $("#timerModalMode").textContent=timer.mode==="focus"?"Focus time":"Break time";
    if($("#timerModalCaption")) $("#timerModalCaption").textContent=timer.running?"You’re doing lovely. Keep going ♡":`${timer.completedSessions} focus session${timer.completedSessions===1?"":"s"} completed`;
    const total=(timer.mode==="focus"?timer.focusMinutes:timer.breakMinutes)*60;
    const progress=Math.max(0,Math.min(100,(1-remaining/total)*100));
    const ring=$("#timerRing");if(ring)ring.style.setProperty("--timer-progress",`${progress}%`);
    if($("#focusLength"))$("#focusLength").value=timer.focusMinutes;
    if($("#breakLength"))$("#breakLength").value=timer.breakMinutes;
    if($("#timerStartBtn"))$("#timerStartBtn").textContent=timer.running?"Pause":"Start";
  }
  function startTimer() {
    if(timer.running) {
      timer.remaining=Math.max(0,Math.ceil((timer.endAt-Date.now())/1000));
      timer.running=false;timer.endAt=null;saveTimer();updateTimerDisplays();return;
    }
    if(timer.remaining<=0)timer.remaining=(timer.mode==="focus"?timer.focusMinutes:timer.breakMinutes)*60;
    timer.running=true;timer.endAt=Date.now()+timer.remaining*1000;saveTimer();updateTimerDisplays();
  }
  function resetTimer() {
    timer.running=false;timer.endAt=null;timer.remaining=(timer.mode==="focus"?timer.focusMinutes:timer.breakMinutes)*60;saveTimer();updateTimerDisplays();
  }
  function finishTimerPhase(announce=true) {
    const finished=timer.mode;
    if(finished==="focus") timer.completedSessions++;
    timer.mode=finished==="focus"?"break":"focus";
    timer.remaining=(timer.mode==="focus"?timer.focusMinutes:timer.breakMinutes)*60;
    timer.running=false;timer.endAt=null;saveTimer();updateTimerDisplays();
    if(announce) {
      showToast(finished==="focus"?"Focus complete! Time for a little break ♡":"Break complete. Ready to focus? ♡");
      try { if("Notification" in window && Notification.permission==="granted") new Notification("Study Space", {body:finished==="focus"?"Focus session complete — take a break.":"Break is over — ready to focus?"}); } catch (_) {}
    }
  }
  function openTimer() {
    openModal("Pomodoro timer", `<div class="timer-modal"><div class="timer-mode" id="timerModalMode">Focus time</div><div class="timer-ring" id="timerRing"><div class="timer-time" id="timerModalTime">25:00</div></div><p class="timer-caption" id="timerModalCaption">You’re doing lovely. Keep going ♡</p>
      <div class="timer-controls"><button class="button button-primary" id="timerStartBtn">Start</button><button class="button" id="timerResetBtn">Reset</button><button class="button" id="timerSwitchBtn">Switch mode</button></div>
      <div class="timer-settings"><div class="field"><label for="focusLength">Focus (min)</label><input id="focusLength" type="number" min="1" max="180" value="${timer.focusMinutes}"></div><div class="field"><label for="breakLength">Break (min)</label><input id="breakLength" type="number" min="1" max="60" value="${timer.breakMinutes}"></div></div>
      <p class="muted" style="font-size:11px;margin:12px 0 0">Timeren fortsetter når du lukker dette vinduet eller navigerer i appen.</p></div>`, true);
    updateTimerDisplays();
    $("#timerStartBtn").addEventListener("click",startTimer);
    $("#timerResetBtn").addEventListener("click",resetTimer);
    $("#timerSwitchBtn").addEventListener("click",()=>{timer.mode=timer.mode==="focus"?"break":"focus";resetTimer();updateTimerDisplays();});
    $("#focusLength").addEventListener("change",e=>{const v=Math.max(1,Math.min(180,Number(e.target.value)||25));timer.focusMinutes=v;if(timer.mode==="focus")resetTimer();else saveTimer();updateTimerDisplays();});
    $("#breakLength").addEventListener("change",e=>{const v=Math.max(1,Math.min(60,Number(e.target.value)||5));timer.breakMinutes=v;if(timer.mode==="break")resetTimer();else saveTimer();updateTimerDisplays();});
  }
  function timerTick() {
    if(timer.running && timer.endAt) {
      timer.remaining=Math.max(0,Math.ceil((timer.endAt-Date.now())/1000));
      if(timer.remaining===0) finishTimerPhase(true);
      else { updateTimerDisplays(); if(timer.remaining%5===0)saveTimer(); }
    } else updateTimerDisplays();
  }

  function exportBackup() {
    const payload={app:"Study Space",version:1,exportedAt:new Date().toISOString(),data};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`study-space-backup-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    showToast("Backup exported.");
  }
  function importBackup(file) {
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try {
        const parsed=JSON.parse(String(reader.result||""));
        const incoming=parsed?.data||parsed;
        if(!incoming || !Array.isArray(incoming.subjects)||!Array.isArray(incoming.tasks)||!Array.isArray(incoming.topics)||!Array.isArray(incoming.notes))throw new Error("This file does not appear to be a Study Space backup.");
        if(!confirm("Import this backup? Existing Study Space data will be replaced. Consider exporting a backup first."))return;
        const previous=data;data={...defaultData(),...incoming};
        if(!saveData()){data=previous;return;}
        applyBackground();currentPage="overview";currentSubjectId=null;currentNoteId=null;renderPage();showToast("Backup imported ♡");
      }catch(error){showToast("Import failed: "+error.message);}
      finally { $("#importFile").value=""; }
    };
    reader.onerror=()=>showToast("Could not read the backup file.");
    reader.readAsText(file);
  }
  function deleteSubject(id) {
    const s=subjectById(id);if(!s)return;
    if(!confirm(`Delete faget «${s.name}» og alle tilhørende oppgaver, topics og notater? This cannot be undone.`))return;
    data.subjects=data.subjects.filter(x=>x.id!==id);
    data.tasks=data.tasks.filter(x=>x.subjectId!==id);
    data.topics=data.topics.filter(x=>x.subjectId!==id);
    data.notes=data.notes.filter(x=>x.subjectId!==id);
    if(currentSubjectId===id)currentSubjectId=null;
    saveData();navigate("subjects");showToast("Subject and related data deleted.");
  }
  function showSubjectMenu(id) {
    const s=subjectById(id);if(!s)return;
    openModal(s.name, `<p class="muted">Hva vil du gjøre med dette faget?</p><div class="inline-actions"><button class="button button-primary" data-action="open-subject" data-id="${id}">Open subject</button><button class="button" data-action="edit-subject" data-id="${id}">Edit subject</button><button class="button button-danger" data-action="delete-subject" data-id="${id}">Delete subject</button></div>`);
  }

  document.addEventListener("click", e => {
    const pageBtn=e.target.closest("[data-page]");
    if(pageBtn){e.preventDefault();navigate(pageBtn.dataset.page);return;}
    const openSub=e.target.closest("[data-open-subject]");
    if(openSub && !e.target.closest("[data-action='subject-menu']")){currentSubjectId=openSub.dataset.openSubject;subjectTab="tasks";navigate("subject-detail");return;}
    const openNote=e.target.closest("[data-open-note]");
    if(openNote){currentNoteId=openNote.dataset.openNote;currentSubjectId=data.notes.find(n=>n.id===currentNoteId)?.subjectId||null;navigate("note-editor");return;}
    const tab=e.target.closest("[data-subject-tab]");
    if(tab){subjectTab=tab.dataset.subjectTab;renderPage();return;}
    const filter=e.target.closest("[data-filter]");
    if(filter){deadlineFilter=filter.dataset.filter;renderPage();return;}
    const close=e.target.closest("[data-close-modal]");
    if(close){closeModal();return;}
    const action=e.target.closest("[data-action]");
    if(!action)return;
    const id=action.dataset.id, subject=action.dataset.subject;
    switch(action.dataset.action){
      case "add-subject": showSubjectForm(); break;
      case "edit-subject": closeModal(); showSubjectForm(id); break;
      case "delete-subject": closeModal(); deleteSubject(id); break;
      case "subject-menu": showSubjectMenu(id); break;
      case "open-subject": closeModal(); currentSubjectId=id;subjectTab="tasks";navigate("subject-detail");break;
      case "add-task": showTaskForm(null,subject||null); break;
      case "edit-task": showTaskForm(id); break;
      case "delete-task": {const t=data.tasks.find(x=>x.id===id);if(t&&confirm(`Delete “${t.title}”?`)){data.tasks=data.tasks.filter(x=>x.id!==id);saveData();renderPage();showToast("Assignment deleted.");}break;}
      case "add-topic": showTopicForm(subject||null); break;
      case "delete-topic": {const t=data.topics.find(x=>x.id===id);if(t&&confirm(`Delete topic «${t.title}»?`)){data.topics=data.topics.filter(x=>x.id!==id);saveData();renderPage();}break;}
      case "new-note": createNote(subject||""); break;
      case "delete-note": deleteNote(id); break;
      case "customize": showCustomize(); break;
      case "remove-background": data.background=null;saveData();applyBackground();closeModal();showToast("Background reset.");break;
    }
  });
  document.addEventListener("change", e=>{
    const taskCheck=e.target.closest("[data-toggle-task]");
    if(taskCheck){const t=data.tasks.find(x=>x.id===taskCheck.dataset.toggleTask);if(t){t.done=taskCheck.checked;saveData();renderPage();}return;}
    const topicCheck=e.target.closest("[data-toggle-topic]");
    if(topicCheck){const t=data.topics.find(x=>x.id===topicCheck.dataset.toggleTopic);if(t){t.done=topicCheck.checked;saveData();renderPage();}return;}
  });
  document.addEventListener("input", e=>{
    if(e.target.id==="noteSearch"){noteSearch=e.target.value;const pos=e.target.selectionStart;renderPage();const next=$("#noteSearch");if(next){next.focus();next.setSelectionRange(pos,pos);}return;}
    if(e.target.matches("[data-note-field]"))scheduleNoteSave();
  });
  document.addEventListener("keydown", e=>{
    if((e.key==="Enter"||e.key===" ") && (e.target.matches("[data-open-subject]")||e.target.matches("[data-open-note]"))){e.preventDefault();e.target.click();}
    if(e.key==="Escape"&&!modalBackdrop.hidden)closeModal();
  });
  $("#modalClose").addEventListener("click",closeModal);
  modalBackdrop.addEventListener("click",e=>{if(e.target===modalBackdrop)closeModal();});
  $$(".nav-link").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
  $("#sidebarTimer").addEventListener("click",openTimer);
  $("#topTimer").addEventListener("click",openTimer);
  $("#quickNoteBtn").addEventListener("click",()=>createNote(""));
  $("#dateButton").addEventListener("click",()=>{
    openModal("Your calendar", `<p class="muted">Today is ${new Intl.DateTimeFormat("no-NO",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}.</p><div class="panel" style="padding:14px"><h3 style="font:500 20px var(--serif)">Upcoming dates</h3>${visibleDeadlines("due").filter(item => item.date >= todayISO()).length?`<div class="deadline-list">${visibleDeadlines("due").filter(item => item.date >= todayISO()).slice(0,8).map(deadlineHTML).join("")}</div>`:'<p class="muted">No upcoming deadlines yet. Add an assignment or exam date to see them here.</p>'}</div><div class="form-actions"><button class="button button-primary" data-close-modal>Close</button></div>`);
  });
  $("#exportBtn").addEventListener("click",exportBackup);
  $("#importBtn").addEventListener("click",()=>$("#importFile").click());
  $("#importFile").addEventListener("change",e=>importBackup(e.target.files?.[0]));
  window.addEventListener("storage",e=>{if(e.key===STORAGE_KEY){data=loadData();renderPage();}});
  window.addEventListener("error",e=>{
    const fatal=$("#fatalError");
    if(fatal && !$("#pageContent").innerHTML){fatal.hidden=false;$("#fatalMessage").textContent="En uventet feil hindret oppstart. Prøv å laste siden på nytt. Feil: "+(e.message||"ukjent JavaScript-feil");}
    setSaveStatus("error","App error — check console");
  });

  // Load all saved content before the first Overview render.
  try {
    data=loadData();
    loadTimer();
    $("#todayLabel").textContent=new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short"}).format(new Date());
    applyBackground();
    renderPage();
    updateTimerDisplays();
    setInterval(timerTick,250);
  } catch(error) {
    $("#fatalError").hidden=false;
    $("#fatalMessage").textContent="Study Space could not start: "+error.message;
  }
})();
