window.StudySubjects = (() => {
  const colours = {
    rose: {accent:"#b56f89", bg:"#f7e8ee", icon:"♡"},
    sage: {accent:"#6c886f", bg:"#e8efe6", icon:"✿"},
    lilac: {accent:"#927ca8", bg:"#eee8f5", icon:"✧"},
    peach: {accent:"#b7805c", bg:"#f8ece1", icon:"☼"},
    blue: {accent:"#718ba8", bg:"#e8eef5", icon:"❀"}
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  function createSubject(input) {
    return {id:uid(), name:input.name.trim(), semester:input.semester.trim(), examDate:input.examDate || "", colour:input.colour || "rose", assignments:[], topics:[], notes:"", createdAt:new Date().toISOString()};
  }
  function createItem(input) {
    return {id:uid(), title:input.title.trim(), date:input.date || "", type:input.type || "assignment", done:!!input.done};
  }
  function progress(subject) {
    const total = subject.topics.length;
    return total ? Math.round(subject.topics.filter(t=>t.done).length / total * 100) : 0;
  }
  return {colours, uid, createSubject, createItem, progress};
})();