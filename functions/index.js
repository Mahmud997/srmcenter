const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {setGlobalOptions} = require("firebase-functions/v2");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();
setGlobalOptions({region:"asia-southeast1", maxInstances:10});

function requireRole(req, roles){
  if(!req.auth) throw new HttpsError("unauthenticated","Требуется вход.");
  const role=req.auth.token.role;
  if(!roles.includes(role)) throw new HttpsError("permission-denied","Недостаточно прав.");
  return role;
}

exports.setUserRole = onCall(async (req)=>{
  requireRole(req,["director"]);
  const {uid,role,displayName,phone}=req.data||{};
  if(!uid || !["director","manager","teacher","student","parent"].includes(role))
    throw new HttpsError("invalid-argument","uid и корректная role обязательны.");
  await getAuth().setCustomUserClaims(uid,{role});
  await db.doc(`users/${uid}`).set({displayName:displayName||"",phone:phone||"",role,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return {ok:true};
});

exports.createAttendanceQr = onCall({enforceAppCheck:true}, async (req)=>{
  requireRole(req,["teacher","manager","director"]);
  const {lessonId}=req.data||{};
  if(!lessonId) throw new HttpsError("invalid-argument","lessonId обязателен.");
  const lessonSnap=await db.doc(`lessons/${lessonId}`).get();
  if(!lessonSnap.exists) throw new HttpsError("not-found","Урок не найден.");
  const lesson=lessonSnap.data();
  if(req.auth.token.role==="teacher" && lesson.teacherId!==req.auth.uid)
    throw new HttpsError("permission-denied","Это не ваш урок.");
  const token=crypto.randomBytes(24).toString("base64url");
  const tokenHash=crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt=Timestamp.fromMillis(Date.now()+20000);
  await db.collection("qrTokens").doc(tokenHash).set({
    lessonId, expiresAt, createdBy:req.auth.uid, used:false,
    createdAt:FieldValue.serverTimestamp()
  });
  return {token,ttlMs:20000};
});

exports.submitQrAttendance = onCall({enforceAppCheck:true}, async (req)=>{
  if(!req.auth) throw new HttpsError("unauthenticated","Войдите как ученик.");
  const {lessonId,token}=req.data||{};
  if(!lessonId||!token) throw new HttpsError("invalid-argument","lessonId/token обязательны.");
  const hash=crypto.createHash("sha256").update(token).digest("hex");
  const tokenRef=db.doc(`qrTokens/${hash}`);
  const attendanceRef=db.doc(`lessons/${lessonId}/attendance/${req.auth.uid}`);
  const result=await db.runTransaction(async tx=>{
    const [tSnap,aSnap,lSnap]=await Promise.all([tx.get(tokenRef),tx.get(attendanceRef),tx.get(db.doc(`lessons/${lessonId}`))]);
    if(!tSnap.exists || !lSnap.exists) throw new HttpsError("not-found","QR или урок не найден.");
    const t=tSnap.data();
    if(t.lessonId!==lessonId || t.used || t.expiresAt.toMillis()<Date.now()) throw new HttpsError("failed-precondition","QR истёк.");
    if(aSnap.exists) return false;
    tx.set(attendanceRef,{
      studentId:req.auth.uid, status:"pending", source:"qr",
      scannedAt:FieldValue.serverTimestamp(), qrTokenHash:hash
    });
    tx.update(tokenRef,{used:true,usedBy:req.auth.uid,usedAt:FieldValue.serverTimestamp()});
    return true;
  });
  return {ok:result,status:"pending"};
});

exports.checkLateReports = onSchedule({schedule:"every 5 minutes",timeZone:"Asia/Almaty"}, async ()=>{
  const now=Date.now(), cutoff=now-60*60*1000;
  const snap=await db.collection("lessons")
    .where("scheduledEnd","<=",Timestamp.fromMillis(cutoff))
    .where("reportStatus","==","pending").limit(200).get();
  if(snap.empty) return;
  const batch=db.batch();
  for(const d of snap.docs){
    const lesson=d.data();
    const recipients=await db.collection("users").where("role","in",["director","manager"]).get();
    recipients.forEach(u=>{
      const ref=db.collection("notifications").doc();
      batch.set(ref,{
        type:"late_report",lessonId:d.id,teacherId:lesson.teacherId,
        recipientUid:u.id,title:"Отчёт просрочен",
        message:`Учитель не отправил отчёт по уроку ${d.id} в течение 60 минут.`,
        read:false,createdAt:FieldValue.serverTimestamp()
      });
    });
    batch.update(d.ref,{reportStatus:"alerted",lateReportAlertAt:FieldValue.serverTimestamp()});
  }
  await batch.commit();
});

exports.recalculatePaymentStatuses = onSchedule({schedule:"every day 03:10",timeZone:"Asia/Almaty"}, async ()=>{
  const snap=await db.collection("students").limit(1000).get();
  const batch=db.batch();
  const now=Date.now();
  snap.docs.forEach(d=>{
    const s=d.data();
    if(s.paymentStatus==="paid") return;
    const due=s.paymentDueAt?.toMillis?.();
    const status=due && due<now ? "overdue" : "unpaid";
    batch.update(d.ref,{paymentStatus:status});
  });
  await batch.commit();
});