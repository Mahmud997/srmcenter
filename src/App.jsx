import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, Timestamp, where
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { auth, db, functions, firebaseConfigured } from "./firebase";
import { httpsCallable } from "firebase/functions";

const money = (n) => new Intl.NumberFormat("ru-RU").format(Number(n || 0)) + " ₸";
const dateText = (v) => v?.toDate ? v.toDate().toLocaleString("ru-RU") : "—";

function exportExcel(rows, name="export.xlsx") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Данные");
  XLSX.writeFile(wb, name);
}
function exportPDF(title, rows, name="report.pdf") {
  const pdf = new jsPDF({orientation:"landscape"});
  pdf.setFontSize(16); pdf.text(title, 12, 15);
  pdf.setFontSize(9);
  rows.slice(0, 35).forEach((r, i) => {
    const line = Object.values(r).map(v => String(v ?? "")).join(" | ").slice(0, 170);
    pdf.text(line, 12, 25 + i * 7);
  });
  pdf.save(name);
}

function Login({onUser}) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState("");
  async function submit(e){
    e.preventDefault(); setError("");
    try { await signInWithEmailAndPassword(auth,email,password); }
    catch(err){ setError(err.message || "Ошибка авторизации"); }
  }
  return <div className="login"><div className="login-card">
    <div className="brand">SMART CENTER</div><h1>CRM / LMS</h1>
    <p>Firebase · роли · посещаемость · финансы</p>
    <form onSubmit={submit}>
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="Пароль" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button>Войти</button>
    </form>
    {error && <div className="error">{error}</div>}
    {!firebaseConfigured && <div className="warning">Заполните .env по примеру и пересоберите проект.</div>}
  </div></div>
}

function Sidebar({tab,setTab,user}){
  const items = [
    ["dashboard","Обзор"],["groups","Группы"],["students","Ученики"],
    ["lessons","Уроки"],["attendance","Посещаемость"],["finance","Бухгалтерия"],
    ["reports","Отчёты"],["staff","Персонал"]
  ];
  return <aside><div className="logo">Smart<span>Center</span></div>
    <div className="role">{user?.role || "user"}</div>
    {items.map(([id,label])=><button className={tab===id?"nav active":"nav"} onClick={()=>setTab(id)} key={id}>{label}</button>)}
    <button className="nav logout" onClick={()=>signOut(auth)}>Выйти</button>
  </aside>
}

function Dashboard({students,groups,lessons,payments}){
  const unpaid = students.filter(s=>s.paymentStatus==="unpaid").length;
  const paid = students.filter(s=>s.paymentStatus==="paid").length;
  return <main><h1>Обзор</h1><div className="cards">
    <div><b>{students.length}</b><span>Учеников</span></div>
    <div><b>{groups.length}</b><span>Групп</span></div>
    <div><b>{paid}</b><span>Оплатили</span></div>
    <div className="danger-card"><b>{unpaid}</b><span>Не оплатили</span></div>
  </div>
  <section className="panel"><h2>Контроль оплаты</h2><p>Зелёный — оплачено, жёлтый — срок приближается, красный — просрочено.</p>
  <PaymentTable students={students}/></section></main>
}

function PaymentTable({students}){
  return <div className="table-wrap"><table><thead><tr><th>Ученик</th><th>Группа</th><th>Родитель</th><th>Телефон</th><th>Срок</th><th>Статус</th><th>Связаться</th></tr></thead>
  <tbody>{students.map(s=>{
    const due = s.paymentDueAt?.toDate ? s.paymentDueAt.toDate() : null;
    const days = due ? Math.ceil((due-Date.now())/86400000) : null;
    const status = s.paymentStatus==="paid" ? "paid" : days!==null && days<0 ? "overdue" : days!==null && days<=3 ? "soon" : "unpaid";
    return <tr key={s.id}><td>{s.fullName}</td><td>{s.groupName||"—"}</td><td>{s.parentName||"—"}</td><td>{s.parentPhone||"—"}</td><td>{due?due.toLocaleDateString("ru-RU"):"—"}</td>
      <td><span className={"pill "+status}>{status==="paid"?"Оплачено":status==="soon"?"Скоро срок":status==="overdue"?"Просрочено":"Не оплачено"}</span></td>
      <td>{s.parentPhone && <a className="call" href={"tel:"+s.parentPhone}>Позвонить</a>}</td></tr>
  })}</tbody></table></div>
}

function Students({students,onImport}){
  const [file,setFile]=useState(null);
  function parseFile(f){
    setFile(f);
    const reader=new FileReader();
    reader.onload=e=>{
      const data=e.target.result;
      let rows=[];
      if(f.name.toLowerCase().endsWith(".csv")) rows=Papa.parse(data,{header:true,skipEmptyLines:true}).data;
      else rows=XLSX.utils.sheet_to_json(XLSX.read(data,{type:"array"}).Sheets[XLSX.read(data,{type:"array"}).SheetNames[0]]);
      onImport(rows);
    };
    if(f.name.toLowerCase().endsWith(".csv")) reader.readAsText(f); else reader.readAsArrayBuffer(f);
  }
  const exportTemplate=()=>exportExcel([{fullName:"Иванов Иван",phone:"+77000000000",groupName:"Group A",parentName:"Иванова Анна",parentPhone:"+77000000001",monthlyFee:30000,paymentStatus:"unpaid"}],"students-template.xlsx");
  return <main><div className="head-row"><h1>Ученики</h1><button onClick={exportTemplate}>Скачать шаблон Excel</button></div>
    <section className="panel"><h2>Импорт Excel / CSV</h2><input type="file" accept=".xlsx,.xls,.csv" onChange={e=>e.target.files[0]&&parseFile(e.target.files[0])}/>
    {file&&<p>Загружен: {file.name}. Записи отправляются в Firestore после проверки.</p>}</section>
    <section className="panel"><PaymentTable students={students}/></section></main>
}

function Finance({students,payments}){
  const rows=payments.map(p=>({Дата:dateText(p.createdAt),Ученик:p.studentName,Сумма:p.amount,Метод:p.method,Статус:p.status}));
  return <main><div className="head-row"><h1>Бухгалтерия</h1><div><button onClick={()=>exportExcel(rows)}>Excel</button><button onClick={()=>exportPDF("Финансовый отчёт",rows)}>PDF</button><button onClick={()=>window.print()}>Печать</button></div></div>
    <div className="cards"><div><b>{money(payments.reduce((a,p)=>a+Number(p.amount||0),0))}</b><span>Поступления</span></div><div><b>{students.filter(s=>s.paymentStatus==="unpaid").length}</b><span>Должники</span></div></div>
    <section className="panel"><h2>Платежи</h2><div className="table-wrap"><table><thead><tr><th>Дата</th><th>Ученик</th><th>Сумма</th><th>Метод</th><th>Статус</th></tr></thead><tbody>
      {payments.map(p=><tr key={p.id}><td>{dateText(p.createdAt)}</td><td>{p.studentName}</td><td>{money(p.amount)}</td><td>{p.method||"—"}</td><td>{p.status||"paid"}</td></tr>)}</tbody></table></div></section>
  </main>
}

function QRLesson(){
  const [lessonId,setLessonId]=useState(""); const [qr,setQr]=useState(""); const [expires,setExpires]=useState(0); const [busy,setBusy]=useState(false);
  async function create(){
    setBusy(true);
    try{
      const fn=httpsCallable(functions,"createAttendanceQr");
      const r=await fn({lessonId});
      const token=r.data.token;
      setQr(await QRCode.toDataURL(JSON.stringify({lessonId,token}),{width:320,margin:2}));
      setExpires(Date.now()+Number(r.data.ttlMs||20000));
    }catch(e){alert(e.message)}
    finally{setBusy(false)}
  }
  useEffect(()=>{ if(!qr)return; const t=setInterval(()=>{if(Date.now()>expires)setQr("")},500); return()=>clearInterval(t)},[qr,expires]);
  return <main><h1>QR-посещаемость</h1><section className="panel qr-panel"><input placeholder="ID урока" value={lessonId} onChange={e=>setLessonId(e.target.value)}/><button onClick={create} disabled={busy}>Создать QR на 20 секунд</button>
  {qr&&<><img className="qr" src={qr}/><strong>QR короткоживущий. После истечения обновите код.</strong></>}</section></main>
}

function App(){
  const [user,setUser]=useState(null); const [profile,setProfile]=useState(null); const [tab,setTab]=useState("dashboard");
  const [students,setStudents]=useState([]),[groups,setGroups]=useState([]),[lessons,setLessons]=useState([]),[payments,setPayments]=useState([]);
  useEffect(()=>onAuthStateChanged(auth,async u=>{
    if(!u){setUser(null);return}
    const snap=await getDocs(query(collection(db,"users"),where("__name__","==",u.uid),limit(1)));
    setProfile(snap.empty?{role:"user"}:snap.docs[0].data()); setUser(u);
  }),[]);
  useEffect(()=>{if(!user)return;
    const un1=onSnapshot(query(collection(db,"students"),limit(500)),s=>setStudents(s.docs.map(d=>({id:d.id,...d.data()}))));
    const un2=onSnapshot(query(collection(db,"groups"),limit(200)),s=>setGroups(s.docs.map(d=>({id:d.id,...d.data()}))));
    const un3=onSnapshot(query(collection(db,"lessons"),orderBy("scheduledStart","desc"),limit(200)),s=>setLessons(s.docs.map(d=>({id:d.id,...d.data()}))));
    const un4=onSnapshot(query(collection(db,"payments"),orderBy("createdAt","desc"),limit(500)),s=>setPayments(s.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{un1();un2();un3();un4()};
  },[user]);
  async function importStudents(rows){
    for(const r of rows){
      const fullName=r.fullName||r["ФИО"]||r.name; if(!fullName)continue;
      await addDoc(collection(db,"students"),{
        fullName, phone:r.phone||"", groupName:r.groupName||"",
        parentName:r.parentName||"", parentPhone:r.parentPhone||"",
        monthlyFee:Number(r.monthlyFee||0), paymentStatus:r.paymentStatus||"unpaid",
        paymentDueAt:r.paymentDueAt?Timestamp.fromDate(new Date(r.paymentDueAt)):null,
        createdAt:serverTimestamp(), active:true
      });
    }
    alert("Импорт завершён");
  }
  if(!user)return <Login/>;
  const data={students,groups,lessons,payments};
  return <div className="app"><Sidebar tab={tab} setTab={setTab} user={profile}/>
    {tab==="dashboard"&&<Dashboard {...data}/>}
    {tab==="students"&&<Students students={students} onImport={importStudents}/>}
    {tab==="finance"&&<Finance {...data}/>}
    {tab==="attendance"&&<QRLesson/>}
    {tab==="groups"&&<main><h1>Группы</h1><section className="panel"><p>CRUD групп подключается к коллекции <b>groups</b>. Доступ менеджера ограничен правилами.</p></section></main>}
    {tab==="lessons"&&<main><h1>Уроки</h1><section className="panel"><p>Расписание и уроки хранятся в <b>lessons</b>. Учитель видит только назначенные ему уроки.</p></section></main>}
    {tab==="reports"&&<main><h1>Отчёты</h1><section className="panel"><p>Системные напоминания создаются Cloud Function через 60 минут после окончания урока.</p></section></main>}
    {tab==="staff"&&<main><h1>Персонал</h1><section className="panel"><p>Добавление пользователей выполняется через защищённую callable Function, а не напрямую из браузера.</p></section></main>}
  </div>
}
export default App;