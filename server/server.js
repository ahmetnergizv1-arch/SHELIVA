import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const app=express(); const PORT=3001;
const __filename=fileURLToPath(import.meta.url); const __dirname=path.dirname(__filename);
const DATA=path.join(__dirname,"data"), UP=path.join(__dirname,"uploads");
fs.mkdirSync(DATA,{recursive:true}); fs.mkdirSync(UP,{recursive:true});
const F={products:path.join(DATA,"products.json"),orders:path.join(DATA,"orders.json"),reviews:path.join(DATA,"reviews.json"),users:path.join(DATA,"users.json"),otp:path.join(DATA,"otp.json"),sessions:path.join(DATA,"sessions.json"),returns:path.join(DATA,"returns.json"),tickets:path.join(DATA,"production-tickets.json"),settings:path.join(DATA,"settings.json")};
const DEF={storeName:"SHELİVA",supportPhone:"",supportEmail:"",defaultVatRate:20,cargoFee:0,freeShippingThreshold:2500,orderPrefix:"SH",ticketPrefix:"FIS",cargoCompanies:["Aras Kargo","Yurtiçi Kargo","MNG Kargo","Sürat Kargo","PTT Kargo"],defaultCargoCompany:"Aras Kargo",bankName:"",iban:"",accountHolder:"",instagramUrl:"",youtubeUrl:"",tiktokUrl:"",whatsappUrl:"",otpMode:"test"};
const ensure=(f,v)=>{if(!fs.existsSync(f))fs.writeFileSync(f,JSON.stringify(v,null,2),"utf8")};
ensure(F.products,[]);ensure(F.orders,[]);ensure(F.reviews,[]);ensure(F.users,[]);ensure(F.otp,[]);ensure(F.sessions,[]);ensure(F.returns,[]);ensure(F.tickets,[]);ensure(F.settings,DEF);
const read=(f,d=[])=>{try{return JSON.parse(fs.readFileSync(f,"utf8"))}catch{return d}}; const write=(f,d)=>fs.writeFileSync(f,JSON.stringify(d,null,2),"utf8");
const n=v=>Number(v||0), now=()=>new Date().toISOString(), nextId=a=>a.length?Math.max(...a.map(x=>n(x.id)))+1:1;
function phone(v=""){let d=String(v).replace(/\D/g,"");if(d.startsWith("90")&&d.length===12)return d;if(d.startsWith("0")&&d.length===11)return "9"+d;if(d.length===10&&d.startsWith("5"))return "90"+d;return d}
function hash(p){const s=crypto.randomBytes(16).toString("hex"),h=crypto.scryptSync(String(p),s,64).toString("hex");return `${s}:${h}`}
function verify(p,x){try{const [s,h]=String(x).split(":"),a=crypto.scryptSync(String(p),s,64),b=Buffer.from(h,"hex");return a.length===b.length&&crypto.timingSafeEqual(a,b)}catch{return false}}
const safe=u=>{if(!u)return null;const x={...u};delete x.passwordHash;return x}; const token=()=>crypto.randomBytes(32).toString("hex");
function auth(req){const t=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");const s=read(F.sessions,[]).find(x=>x.token===t&&new Date(x.expiresAt).getTime()>Date.now());return s?read(F.users,[]).find(u=>n(u.id)===n(s.userId)):null}
function need(req,res,next){const u=auth(req);if(!u)return res.status(401).json({error:"Giriş yapman gerekiyor."});req.user=u;next()}

/* SHELIVA_ADMIN_SECURITY_V1 */
const adminSessions=new Map();
const ADMIN_SESSION_MS=12*60*60*1000;

function cleanAdminSessions(){
  const t=Date.now();
  for(const [key,value] of adminSessions){
    if(value.expiresAt<=t) adminSessions.delete(key);
  }
}

function adminTokenFrom(req){
  return String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
}

function needAdmin(req,res,next){
  cleanAdminSessions();
  const t=adminTokenFrom(req);
  const session=adminSessions.get(t);

  if(!t||!session||session.expiresAt<=Date.now()){
    return res.status(401).json({error:"Yönetici girişi gerekli."});
  }

  session.expiresAt=Date.now()+ADMIN_SESSION_MS;
  next();
}
const sale=p=>Math.round(n(p.price)*(1-Math.max(0,Math.min(100,n(p.discount)))/100)*100)/100;
const cost=p=>{const buy=n(p.purchasePrice),vat=buy*n(p.vatRate)/100;return Math.round((buy+vat+n(p.shippingCost)+n(p.packagingCost)+n(p.otherCost))*100)/100};
const stock=p=>(p.colors||[]).reduce((s,c)=>s+Object.values(c.sizes||{}).reduce((a,v)=>a+n(v),0),0);
function saveImage(data,prefix){if(!data||!String(data).startsWith("data:image/"))return null;const m=String(data).match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);if(!m)return null;let e=m[1].toLowerCase();if(e==="jpeg")e="jpg";const name=`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${e}`;fs.writeFileSync(path.join(UP,name),Buffer.from(m[2],"base64"));return `/uploads/${name}`}
function color(c,pid,i){const images=[];for(const x of c.images||[]){if(typeof x==="string"&&x)images.push(x);else if(x?.url)images.push(x.url);else if(x?.data){const s=saveImage(x.data,`p${pid}-c${i+1}`);if(s)images.push(s)}}if(!images.length&&c.image)images.push(c.image);const sizes={};for(const s of ["36","37","38","39","40","41"])sizes[s]=n(c.sizes?.[s]);return{id:c.id||`CLR-${Date.now()}-${i+1}`,name:c.name||`Renk ${i+1}`,images,image:images[0]||"",sizes}}
const enrich=p=>({...p,stock:stock(p),salePrice:sale(p),totalCost:cost(p),grossProfit:Math.round((sale(p)-cost(p))*100)/100});
const profit=o=>o.status!=="Teslim Edildi"?0:Math.round(((o.items||[]).reduce((s,i)=>s+(n(i.price)-n(i.unitCost))*n(i.qty),0)-n(o.actualCargoCost)-n(o.refundCost))*100)/100;
function tickets(order){const list=read(F.tickets,[]),set=read(F.settings,DEF);let id=list.length?Math.max(...list.map(x=>n(x.id))):0;for(const item of order.items||[])for(let k=0;k<n(item.qty);k++){id++;list.push({id,ticketNo:`${set.ticketPrefix||"FIS"}-${String(id).padStart(6,"0")}`,orderId:order.id,orderNo:order.orderNo,createdAt:now(),printedAt:null,productId:item.productId,productCode:item.code||"",quality:item.quality||"",sole:item.sole||"",model:item.name,color:item.colorName,size:item.size,image:item.image||"",customer:order.customer,cargoCompany:"",cargoTracking:"",status:order.status})}write(F.tickets,list)}

app.use(cors()); app.use(express.json({limit:"100mb"})); app.use("/uploads",express.static(UP));
app.get("/api/health",(q,r)=>r.json({ok:true,server:"SHELIVA PRO",time:now()}));

app.post("/api/admin/login",(q,r)=>{
  const configured=String(process.env.ADMIN_SECRET||"");
  const supplied=String(q.body?.secret||"");

  if(!configured){
    return r.status(503).json({error:"ADMIN_SECRET sunucuda ayarlı değil."});
  }

  const a=Buffer.from(configured);
  const b=Buffer.from(supplied);
  const valid=a.length===b.length && crypto.timingSafeEqual(a,b);

  if(!valid){
    return r.status(401).json({error:"Yönetici anahtarı yanlış."});
  }

  const t=token();
  adminSessions.set(t,{
    createdAt:Date.now(),
    expiresAt:Date.now()+ADMIN_SESSION_MS
  });

  r.json({
    ok:true,
    token:t,
    expiresIn:ADMIN_SESSION_MS
  });
});

app.post("/api/admin/logout",needAdmin,(q,r)=>{
  adminSessions.delete(adminTokenFrom(q));
  r.json({ok:true});
});

app.post("/api/auth/request-otp",(q,r)=>{const p=phone(q.body.phone);if(p.length<10)return r.status(400).json({error:"Geçerli telefon gir."});let list=read(F.otp,[]).filter(x=>new Date(x.expiresAt).getTime()>Date.now());if(list.filter(x=>x.phone===p&&Date.now()-new Date(x.createdAt).getTime()<60000).length>=3)return r.status(429).json({error:"Çok fazla kod istedin. 1 dakika bekle."});const code=String(Math.floor(100000+Math.random()*900000));list.push({phone:p,code,createdAt:now(),expiresAt:new Date(Date.now()+300000).toISOString()});write(F.otp,list);console.log(`\n===== SHELIVA TEST OTP =====\nTELEFON: ${p}\nKOD: ${code}\n============================\n`);r.json({ok:true})});

app.post("/api/auth/register-simple",(q,r)=>{
  const p=phone(q.body.phone),email=String(q.body.email||"").trim().toLowerCase(),name=String(q.body.name||"").trim(),pw=String(q.body.password||"");
  if(!name||p.length<10||!email||pw.length<6)return r.status(400).json({error:"Bilgileri kontrol et. Şifre en az 6 karakter olmalı."});
  const users=read(F.users,[]);
  if(users.some(u=>u.phone===p||u.email===email))return r.status(409).json({error:"Telefon veya e-posta zaten kayıtlı."});
  const u={id:nextId(users),name,phone:p,email,passwordHash:hash(pw),verified:false,addresses:[],createdAt:now()};
  users.push(u);write(F.users,users);
  const ss=read(F.sessions,[]),t=token();
  ss.push({token:t,userId:u.id,createdAt:now(),expiresAt:new Date(Date.now()+30*86400000).toISOString()});
  write(F.sessions,ss);
  r.status(201).json({token:t,user:safe(u)});
});
app.post("/api/auth/register",(q,r)=>{const p=phone(q.body.phone),email=String(q.body.email||"").trim().toLowerCase(),name=String(q.body.name||"").trim(),pw=String(q.body.password||""),code=String(q.body.code||"").trim();if(!name||p.length<10||!email||pw.length<6)return r.status(400).json({error:"Bilgiler eksik veya şifre kısa."});const otps=read(F.otp,[]),idx=otps.findIndex(x=>x.phone===p&&x.code===code&&new Date(x.expiresAt).getTime()>Date.now());if(idx<0)return r.status(400).json({error:"Kod yanlış veya süresi doldu."});const users=read(F.users,[]);if(users.some(u=>u.phone===p||u.email===email))return r.status(409).json({error:"Telefon veya e-posta kayıtlı."});const u={id:nextId(users),name,phone:p,email,passwordHash:hash(pw),verified:true,addresses:[],createdAt:now()};users.push(u);write(F.users,users);otps.splice(idx,1);write(F.otp,otps);const ss=read(F.sessions,[]),t=token();ss.push({token:t,userId:u.id,createdAt:now(),expiresAt:new Date(Date.now()+30*86400000).toISOString()});write(F.sessions,ss);r.status(201).json({token:t,user:safe(u)})});
app.post("/api/auth/login",(q,r)=>{const l=String(q.body.login||"").trim().toLowerCase(),p=phone(l),u=read(F.users,[]).find(x=>x.email===l||x.phone===p);if(!u||!verify(String(q.body.password||""),u.passwordHash))return r.status(401).json({error:"Giriş bilgileri yanlış."});const ss=read(F.sessions,[]),t=token();ss.push({token:t,userId:u.id,createdAt:now(),expiresAt:new Date(Date.now()+30*86400000).toISOString()});write(F.sessions,ss);r.json({token:t,user:safe(u)})});
app.get("/api/auth/me",need,(q,r)=>r.json(safe(q.user)));app.post("/api/auth/logout",need,(q,r)=>{const t=String(q.headers.authorization||"").replace(/^Bearer\s+/i,"");write(F.sessions,read(F.sessions,[]).filter(s=>s.token!==t));r.json({ok:true})});app.get("/api/account/orders",need,(q,r)=>r.json(read(F.orders,[]).filter(o=>n(o.userId)===n(q.user.id)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));

/*
  Bu noktadan sonraki API'lerde sadece asagidaki musteri rotalari acik.
  Diger urun/siparis/stok/ayar/rapor islemleri admin token ister.
*/
app.use((req,res,next)=>{
  const method=req.method.toUpperCase();
  const p=req.path;

  const customerRoute=
    (method==="GET" && p==="/api/products") ||
    (method==="GET" && /^\/api\/products\/\d+\/reviews$/.test(p)) ||
    (method==="POST" && p==="/api/orders") ||
    (method==="POST" && p==="/api/reviews") ||
    (method==="POST" && p==="/api/returns") ||
    (method==="GET" && p==="/api/settings");

  if(customerRoute) return next();
  return needAdmin(req,res,next);
});

app.get("/api/products",(q,r)=>r.json(read(F.products,[]).map(enrich)));
app.post("/api/products",(q,r)=>{const list=read(F.products,[]),id=nextId(list),colors=Array.isArray(q.body.colors)?q.body.colors.map((c,i)=>color(c,id,i)):[];const p={id,code:q.body.code||`SHL-${String(id).padStart(4,"0")}`,name:q.body.name||"Yeni Ürün",category:q.body.category||"Yazlık",description:q.body.description||"",quality:q.body.quality||"",sole:q.body.sole||"",price:n(q.body.price),discount:n(q.body.discount),purchasePrice:n(q.body.purchasePrice),vatRate:n(q.body.vatRate),shippingCost:n(q.body.shippingCost),packagingCost:n(q.body.packagingCost),otherCost:n(q.body.otherCost),active:q.body.active!==false,newest:q.body.newest!==false,featured:q.body.featured===true,features:q.body.features||"",measurements:q.body.measurements||"",paymentInfo:q.body.paymentInfo||"",shippingReturns:q.body.shippingReturns||"",faq:q.body.faq||"",colors,image:colors?.[0]?.images?.[0]||"",totalSold:n(q.body.totalSold),createdAt:now()};list.push(p);write(F.products,list);r.status(201).json(enrich(p))});
app.put("/api/products/:id",(q,r)=>{const id=n(q.params.id),list=read(F.products,[]),idx=list.findIndex(p=>n(p.id)===id);if(idx<0)return r.status(404).json({error:"Ürün bulunamadı."});const old=list[idx],colors=Array.isArray(q.body.colors)?q.body.colors.map((c,i)=>color(c,id,i)):old.colors||[];list[idx]={...old,...q.body,id,colors,image:colors?.[0]?.images?.[0]||old.image||"",updatedAt:now()};write(F.products,list);r.json(enrich(list[idx]))});app.delete("/api/products/:id",(q,r)=>{write(F.products,read(F.products,[]).filter(p=>n(p.id)!==n(q.params.id)));r.json({ok:true})});

app.get("/api/orders",(q,r)=>r.json([...read(F.orders,[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));
app.post("/api/orders",(q,r)=>{const user=auth(q);const orders=read(F.orders,[]),products=read(F.products,[]),set=read(F.settings,DEF),items=Array.isArray(q.body.items)?q.body.items:[];if(!items.length)return r.status(400).json({error:"Sepet boş."});const out=[];for(const i of items){const p=products.find(x=>n(x.id)===n(i.productId)),c=p?.colors?.find(x=>x.id===i.colorId),size=String(i.size),qty=Math.max(1,n(i.qty)),st=n(c?.sizes?.[size]);if(!p||!c)return r.status(400).json({error:"Ürün varyantı bulunamadı."});if(st<=0)return r.status(400).json({error:`${p.name} ${c.name} ${size} tükendi.`});if(qty>st)return r.status(400).json({error:`En fazla ${st} adet alınabilir.`});out.push({key:`${p.id}-${c.id}-${size}`,productId:p.id,code:p.code,quality:p.quality||"",sole:p.sole||"",name:p.name,colorId:c.id,colorName:c.name,size,qty,listPrice:n(p.price),discount:n(p.discount),price:sale(p),unitCost:cost(p),image:c.images?.[0]||c.image||p.image||""})}/* SIPARIS_ONAY_AKISI_V1: stok odeme onayinda dusulecek */const id=nextId(orders),subtotal=out.reduce((s,i)=>s+n(i.price)*n(i.qty),0),cargoFee=subtotal>=n(set.freeShippingThreshold)?0:n(set.cargoFee);const o={id,orderNo:`${set.orderPrefix||"SH"}-${String(id).padStart(6,"0")}`,userId:user?.id||null,source:"SHELIVA Web",customer:{name:q.body.customer?.name||user?.name||"",phone:q.body.customer?.phone||user?.phone||"",email:q.body.customer?.email||user?.email||"",city:q.body.customer?.city||"",district:q.body.customer?.district||"",neighborhood:q.body.customer?.neighborhood||"",postalCode:q.body.customer?.postalCode||"",address:q.body.customer?.address||"",note:q.body.customer?.note||""},items:out,subtotal,cargoFee,total:subtotal+cargoFee,paymentMethod:q.body.paymentMethod||"Havale / EFT",paymentStatus:"Onay Bekliyor",status:"Yeni",statusHistory:[{status:"Yeni",at:now()}],createdAt:now(),cargoCompany:"",cargoTracking:"",cargoNote:"",actualCargoCost:0,refundCost:0};orders.push(o);write(F.orders,orders);r.status(201).json(o)});
app.put("/api/orders/:id/status",(q,r)=>{const list=read(F.orders,[]),idx=list.findIndex(o=>n(o.id)===n(q.params.id));if(idx<0)return r.status(404).json({error:"Sipariş bulunamadı."});const s=String(q.body.status||"");if(!["Yeni","Hazırlanıyor","Kargoya Verildi","Teslim Edildi","İptal"].includes(s))return r.status(400).json({error:"Geçersiz durum."});if(["Hazırlanıyor","Kargoya Verildi","Teslim Edildi"].includes(s)&&list[idx].paymentStatus!=="Ödendi")return r.status(400).json({error:"Ödeme onaylanmadan sipariş ilerletilemez."});list[idx].status=s;list[idx].statusHistory=[...(list[idx].statusHistory||[]),{status:s,at:now()}];if(s==="Kargoya Verildi"){list[idx].cargoCompany=q.body.cargoCompany||list[idx].cargoCompany||"";list[idx].cargoTracking=q.body.cargoTracking||list[idx].cargoTracking||"";list[idx].cargoNote=q.body.cargoNote||list[idx].cargoNote||"";list[idx].actualCargoCost=n(q.body.actualCargoCost??list[idx].actualCargoCost)}write(F.orders,list);write(F.tickets,read(F.tickets,[]).map(t=>n(t.orderId)===n(list[idx].id)?{...t,status:s,cargoCompany:list[idx].cargoCompany,cargoTracking:list[idx].cargoTracking}:t));r.json(list[idx])});
app.post("/api/orders/:id/revert",(q,r)=>{const list=read(F.orders,[]),idx=list.findIndex(o=>n(o.id)===n(q.params.id));if(idx<0)return r.status(404).json({error:"Sipariş bulunamadı."});const p={"Hazırlanıyor":"Yeni","Kargoya Verildi":"Hazırlanıyor","Teslim Edildi":"Kargoya Verildi"}[list[idx].status];if(!p)return r.status(400).json({error:"Bu durum geri alınamaz."});list[idx].status=p;list[idx].statusHistory=[...(list[idx].statusHistory||[]),{status:p,at:now(),reverted:true}];write(F.orders,list);r.json(list[idx])});

app.get("/api/tickets",(q,r)=>r.json([...read(F.tickets,[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));app.put("/api/tickets/:id/printed",(q,r)=>{const list=read(F.tickets,[]),idx=list.findIndex(t=>n(t.id)===n(q.params.id));if(idx<0)return r.status(404).json({error:"Fiş bulunamadı."});list[idx].printedAt=now();write(F.tickets,list);r.json(list[idx])});
app.get("/api/reviews",(q,r)=>r.json([...read(F.reviews,[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));app.get("/api/products/:id/reviews",(q,r)=>r.json(read(F.reviews,[]).filter(x=>n(x.productId)===n(q.params.id)&&x.status==="Onaylandı")));app.post("/api/reviews",need,(q,r)=>{const list=read(F.reviews,[]),anonymous=q.body.anonymous===true,x={id:nextId(list),userId:q.user.id,userName:anonymous?"Gizli Kullanıcı":q.user.name,anonymous,productId:n(q.body.productId),rating:Math.max(1,Math.min(5,n(q.body.rating))),text:String(q.body.text||"").trim(),status:"Bekliyor",createdAt:now()};if(!x.text)return r.status(400).json({error:"Yorum boş olamaz."});list.push(x);write(F.reviews,list);r.status(201).json(x)});app.put("/api/reviews/:id",(q,r)=>{const list=read(F.reviews,[]),idx=list.findIndex(x=>n(x.id)===n(q.params.id));if(idx<0)return r.status(404).json({error:"Yorum bulunamadı."});list[idx].status=q.body.status||list[idx].status;write(F.reviews,list);r.json(list[idx])});app.delete("/api/reviews/:id",(q,r)=>{const id=n(q.params.id),list=read(F.reviews,[]),next=list.filter(x=>n(x.id)!==id);if(next.length===list.length)return r.status(404).json({error:"Yorum bulunamadı."});write(F.reviews,next);r.json({ok:true})});
app.get("/api/returns",(q,r)=>r.json([...read(F.returns,[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));app.post("/api/returns",need,(q,r)=>{const o=read(F.orders,[]).find(x=>n(x.id)===n(q.body.orderId)&&n(x.userId)===n(q.user.id));if(!o)return r.status(404).json({error:"Sipariş bulunamadı."});if(o.status!=="Teslim Edildi")return r.status(400).json({error:"Sadece teslim edilen sipariş iade edilebilir."});const list=read(F.returns,[]),x={id:nextId(list),orderId:o.id,orderNo:o.orderNo,userId:user?.id||null,customerName:q.user.name,reason:String(q.body.reason||""),status:"Talep",createdAt:now()};list.push(x);write(F.returns,list);r.status(201).json(x)});app.put("/api/returns/:id",(q,r)=>{const list=read(F.returns,[]),idx=list.findIndex(x=>n(x.id)===n(q.params.id));if(idx<0)return r.status(404).json({error:"İade bulunamadı."});list[idx].status=q.body.status||list[idx].status;list[idx].updatedAt=now();write(F.returns,list);r.json(list[idx])});

app.post("/api/orders/:id/approve-payment",(q,r)=>{
  const id=n(q.params.id);
  const orders=read(F.orders,[]);
  const idx=orders.findIndex(o=>n(o.id)===id);
  if(idx<0)return r.status(404).json({error:"Sipariş bulunamadı."});

  const order=orders[idx];
  if(order.paymentStatus==="Ödendi"){
    return r.json(order);
  }

  const products=read(F.products,[]);

  for(const item of order.items||[]){
    const product=products.find(p=>n(p.id)===n(item.productId));
    const color=product?.colors?.find(c=>c.id===item.colorId);
    const current=n(color?.sizes?.[String(item.size)]);

    if(!product||!color){
      return r.status(400).json({error:`${item.name} varyantı bulunamadı.`});
    }

    if(current<n(item.qty)){
      return r.status(400).json({
        error:`${item.name} - ${item.colorName} - ${item.size} numarada yeterli stok yok. Mevcut: ${current}`
      });
    }
  }

  for(const item of order.items||[]){
    const product=products.find(p=>n(p.id)===n(item.productId));
    const color=product.colors.find(c=>c.id===item.colorId);
    color.sizes[String(item.size)]=n(color.sizes[String(item.size)])-n(item.qty);
    product.totalSold=n(product.totalSold)+n(item.qty);
  }

  write(F.products,products);

  order.paymentStatus="Ödendi";
  order.status="Hazırlanıyor";
  order.paymentApprovedAt=now();
  order.statusHistory=[
    ...(order.statusHistory||[]),
    {status:"Ödeme Onaylandı",at:now()},
    {status:"Hazırlanıyor",at:now()}
  ];

  orders[idx]=order;
  write(F.orders,orders);
  const existingTickets=read(F.tickets,[]).some(t=>n(t.orderId)===n(order.id));
  if(!existingTickets) tickets(order);
  r.json(order);
});
app.get("/api/settings",(q,r)=>r.json(read(F.settings,DEF)));app.put("/api/settings",(q,r)=>{const x={...read(F.settings,DEF),...q.body};write(F.settings,x);r.json(x)});
app.get("/api/metrics",(q,r)=>{const products=read(F.products,[]),orders=read(F.orders,[]),rets=read(F.returns,[]),d=orders.filter(o=>o.status==="Teslim Edildi"),v=orders.filter(o=>o.status!=="İptal"),gross=v.reduce((s,o)=>s+n(o.total),0),done=d.reduce((s,o)=>s+n(o.total),0),net=d.reduce((s,o)=>s+profit(o),0),units=d.reduce((s,o)=>s+(o.items||[]).reduce((x,i)=>x+n(i.qty),0),0),model={},color={},size={};for(const o of d)for(const i of o.items||[]){model[i.name]=n(model[i.name])+n(i.qty);color[i.colorName]=n(color[i.colorName])+n(i.qty);size[i.size]=n(size[i.size])+n(i.qty)}const top=x=>Object.entries(x).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,value])=>({name,value}));r.json({modelCount:products.length,stockCount:products.reduce((s,p)=>s+stock(p),0),activeOrders:orders.filter(o=>!["Teslim Edildi","İptal"].includes(o.status)).length,grossRevenue:gross,completedRevenue:done,netProfit:Math.round(net*100)/100,orderCount:orders.length,deliveredCount:d.length,unitsSold:units,averageOrder:d.length?done/d.length:0,returnCount:rets.length,returnRate:d.length?(rets.length/d.length)*100:0,topModels:top(model),topColors:top(color),topSizes:top(size)})});
app.listen(PORT,"0.0.0.0",()=>console.log("\nSHELIVA PRO SERVER 3001 - TEST OTP KODLARI BU EKRANDA\n"));
