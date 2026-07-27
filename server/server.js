import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA = path.join(__dirname, "data");
const UPLOADS = path.join(__dirname, "uploads");
fs.mkdirSync(DATA, { recursive:true });
fs.mkdirSync(UPLOADS, { recursive:true });

const F = {
  products:path.join(DATA,"products.json"),
  orders:path.join(DATA,"orders.json"),
  reviews:path.join(DATA,"reviews.json"),
  users:path.join(DATA,"users.json"),
  otp:path.join(DATA,"otp.json"),
  sessions:path.join(DATA,"sessions.json"),
  returns:path.join(DATA,"returns.json"),
  tickets:path.join(DATA,"tickets.json"),
  settings:path.join(DATA,"settings.json")
};

const SETTINGS_DEFAULT = {
  storeName:"SHELİVA",
  supportPhone:"",
  supportEmail:"",
  cargoFee:0,
  freeShippingThreshold:2500,
  defaultVatRate:20,
  orderPrefix:"SH",
  ticketPrefix:"FIS",
  cargoCompanies:["Yurtiçi Kargo","Aras Kargo","MNG Kargo","Sürat Kargo","PTT Kargo"]
};

function ensure(file, initial){ if(!fs.existsSync(file)) fs.writeFileSync(file,JSON.stringify(initial,null,2),"utf8"); }
Object.entries(F).forEach(([k,v])=>ensure(v,k==="settings"?SETTINGS_DEFAULT:[]));

const read=(f,d=[])=>{try{return JSON.parse(fs.readFileSync(f,"utf8"))}catch{return d}};
const write=(f,d)=>fs.writeFileSync(f,JSON.stringify(d,null,2),"utf8");
const n=v=>Number(v||0);
const now=()=>new Date().toISOString();
const nextId=a=>a.length?Math.max(...a.map(x=>n(x.id)))+1:1;

function cleanPhone(v=""){
  let d=String(v).replace(/\D/g,"");
  if(d.startsWith("90")&&d.length===12)return d;
  if(d.startsWith("0")&&d.length===11)return "9"+d;
  if(d.length===10&&d.startsWith("5"))return "90"+d;
  return d;
}
function hashPassword(p){
  const salt=crypto.randomBytes(16).toString("hex");
  return salt+":"+crypto.scryptSync(String(p),salt,64).toString("hex");
}
function verifyPassword(p,stored){
  try{
    const [salt,h]=String(stored).split(":");
    const a=crypto.scryptSync(String(p),salt,64), b=Buffer.from(h,"hex");
    return a.length===b.length&&crypto.timingSafeEqual(a,b);
  }catch{return false}
}
const token=()=>crypto.randomBytes(32).toString("hex");
function safeUser(u){if(!u)return null;const x={...u};delete x.passwordHash;return x}
function auth(req){
  const t=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!t)return null;
  const s=read(F.sessions,[]).find(x=>x.token===t&&new Date(x.expiresAt).getTime()>Date.now());
  return s?read(F.users,[]).find(u=>n(u.id)===n(s.userId)):null;
}
function requireUser(req,res,next){const u=auth(req);if(!u)return res.status(401).json({error:"Giriş yapman gerekiyor."});req.user=u;next()}

function price(p){
  const d=Math.max(0,Math.min(100,n(p.discount)));
  return Math.round(n(p.price)*(1-d/100)*100)/100;
}
function unitCost(p){
  const purchase=n(p.purchasePrice);
  const vat=purchase*n(p.vatRate)/100;
  return Math.round((purchase+vat+n(p.shippingCost)+n(p.packagingCost)+n(p.otherCost))*100)/100;
}
function stock(p){return (p.colors||[]).reduce((s,c)=>s+Object.values(c.sizes||{}).reduce((a,v)=>a+n(v),0),0)}
function enrich(p){const sp=price(p),cost=unitCost(p);return {...p,stock:stock(p),salePrice:sp,totalCost:cost,grossProfit:Math.round((sp-cost)*100)/100}}
function saveImage(data,prefix){
  if(!data||!String(data).startsWith("data:image/"))return null;
  const m=String(data).match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);if(!m)return null;
  let ext=m[1].toLowerCase();if(ext==="jpeg")ext="jpg";
  const name=`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS,name),Buffer.from(m[2],"base64"));return `/uploads/${name}`;
}
function normColor(c,pid,i){
  const images=[];
  for(const x of c.images||[]){
    if(typeof x==="string"&&x)images.push(x);
    else if(x?.url)images.push(x.url);
    else if(x?.data){const y=saveImage(x.data,`p${pid}-c${i+1}`);if(y)images.push(y)}
  }
  if(!images.length&&c.image)images.push(c.image);
  const sizes={};for(const s of ["36","37","38","39","40","41"])sizes[s]=n(c.sizes?.[s]);
  return {id:c.id||`CLR-${Date.now()}-${i}`,name:c.name||`Renk ${i+1}`,images,image:images[0]||"",sizes};
}
function orderProfit(o){
  if(o.status!=="Teslim Edildi")return 0;
  return Math.round(((o.items||[]).reduce((s,i)=>s+(n(i.price)-n(i.unitCost))*n(i.qty),0)-n(o.actualCargoCost)-n(o.refundCost))*100)/100;
}
function createTickets(order){
  const list=read(F.tickets,[]), settings=read(F.settings,SETTINGS_DEFAULT);
  let id=list.length?Math.max(...list.map(x=>n(x.id))):0;
  for(const item of order.items||[])for(let i=0;i<n(item.qty);i++){
    id++;
    list.push({
      id,ticketNo:`${settings.ticketPrefix||"FIS"}-${String(id).padStart(6,"0")}`,
      orderId:order.id,orderNo:order.orderNo,createdAt:now(),printedAt:null,status:order.status,
      productId:item.productId,productCode:item.code,quality:item.quality,sole:item.sole,
      model:item.name,color:item.colorName,size:item.size,image:item.image,customer:order.customer,
      cargoCompany:"",cargoTracking:""
    });
  }
  write(F.tickets,list);
}

app.use(cors());
app.use(express.json({limit:"100mb"}));
app.use("/uploads",express.static(UPLOADS));

app.get("/api/health",(req,res)=>res.json({ok:true,server:"SHELIVA FULL",time:now()}));

app.post("/api/auth/request-otp",(req,res)=>{
  const phone=cleanPhone(req.body.phone);if(phone.length<10)return res.status(400).json({error:"Telefon geçersiz."});
  let list=read(F.otp,[]).filter(x=>new Date(x.expiresAt).getTime()>Date.now());
  const code=String(Math.floor(100000+Math.random()*900000));
  list.push({phone,code,createdAt:now(),expiresAt:new Date(Date.now()+300000).toISOString()});write(F.otp,list);
  console.log("\n========== SHELIVA TEST OTP ==========\nTELEFON:",phone,"\nKOD:",code,"\n======================================\n");
  res.json({ok:true});
});
app.post("/api/auth/register",(req,res)=>{
  const phone=cleanPhone(req.body.phone),email=String(req.body.email||"").trim().toLowerCase(),name=String(req.body.name||"").trim(),password=String(req.body.password||""),code=String(req.body.code||"");
  if(!name||!email||phone.length<10||password.length<6)return res.status(400).json({error:"Bilgileri kontrol et."});
  const otps=read(F.otp,[]),idx=otps.findIndex(x=>x.phone===phone&&x.code===code&&new Date(x.expiresAt).getTime()>Date.now());if(idx<0)return res.status(400).json({error:"Kod yanlış veya süresi doldu."});
  const users=read(F.users,[]);if(users.some(u=>u.phone===phone||u.email===email))return res.status(409).json({error:"Hesap zaten var."});
  const user={id:nextId(users),name,phone,email,passwordHash:hashPassword(password),verified:true,createdAt:now()};users.push(user);write(F.users,users);
  otps.splice(idx,1);write(F.otp,otps);
  const sessions=read(F.sessions,[]),t=token();sessions.push({token:t,userId:user.id,expiresAt:new Date(Date.now()+30*86400000).toISOString()});write(F.sessions,sessions);
  res.json({token:t,user:safeUser(user)});
});
app.post("/api/auth/login",(req,res)=>{
  const login=String(req.body.login||"").trim().toLowerCase(),phone=cleanPhone(login),p=String(req.body.password||"");
  const user=read(F.users,[]).find(u=>u.email===login||u.phone===phone);if(!user||!verifyPassword(p,user.passwordHash))return res.status(401).json({error:"Giriş bilgileri yanlış."});
  const sessions=read(F.sessions,[]),t=token();sessions.push({token:t,userId:user.id,expiresAt:new Date(Date.now()+30*86400000).toISOString()});write(F.sessions,sessions);res.json({token:t,user:safeUser(user)});
});
app.get("/api/auth/me",requireUser,(req,res)=>res.json(safeUser(req.user)));
app.post("/api/auth/logout",requireUser,(req,res)=>{const t=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");write(F.sessions,read(F.sessions,[]).filter(s=>s.token!==t));res.json({ok:true})});
app.get("/api/account/orders",requireUser,(req,res)=>res.json(read(F.orders,[]).filter(o=>n(o.userId)===n(req.user.id)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));

app.get("/api/products",(req,res)=>res.json(read(F.products,[]).map(enrich)));
app.post("/api/products",(req,res)=>{
  const list=read(F.products,[]),id=nextId(list),colors=(req.body.colors||[]).map((c,i)=>normColor(c,id,i));
  const p={id,code:req.body.code||`SHL-${String(id).padStart(4,"0")}`,name:req.body.name||"Yeni Ürün",category:req.body.category||"Yazlık",description:req.body.description||"",quality:req.body.quality||"",sole:req.body.sole||"",price:n(req.body.price),discount:n(req.body.discount),purchasePrice:n(req.body.purchasePrice),vatRate:n(req.body.vatRate),shippingCost:n(req.body.shippingCost),packagingCost:n(req.body.packagingCost),otherCost:n(req.body.otherCost),active:req.body.active!==false,newest:req.body.newest!==false,featured:req.body.featured===true,colors,image:colors?.[0]?.images?.[0]||"",totalSold:n(req.body.totalSold),createdAt:now()};
  list.push(p);write(F.products,list);res.json(enrich(p));
});
app.put("/api/products/:id",(req,res)=>{
  const list=read(F.products,[]),id=n(req.params.id),idx=list.findIndex(p=>n(p.id)===id);if(idx<0)return res.status(404).json({error:"Ürün yok."});
  const colors=(req.body.colors||list[idx].colors||[]).map((c,i)=>normColor(c,id,i));
  list[idx]={...list[idx],...req.body,id,colors,image:colors?.[0]?.images?.[0]||list[idx].image||"",updatedAt:now()};write(F.products,list);res.json(enrich(list[idx]));
});
app.delete("/api/products/:id",(req,res)=>{write(F.products,read(F.products,[]).filter(p=>n(p.id)!==n(req.params.id)));res.json({ok:true})});

app.get("/api/orders",(req,res)=>res.json([...read(F.orders,[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));
app.post("/api/orders",requireUser,(req,res)=>{
  const products=read(F.products,[]),orders=read(F.orders,[]),settings=read(F.settings,SETTINGS_DEFAULT),items=req.body.items||[];if(!items.length)return res.status(400).json({error:"Sepet boş."});
  const normalized=[];
  for(const item of items){
    const p=products.find(x=>n(x.id)===n(item.productId)),c=p?.colors?.find(x=>x.id===item.colorId);if(!p||!c)return res.status(400).json({error:"Varyant bulunamadı."});
    const size=String(item.size),qty=Math.max(1,n(item.qty)),st=n(c.sizes?.[size]);if(st<=0)return res.status(400).json({error:"Ürün tükendi."});if(qty>st)return res.status(400).json({error:`En fazla ${st} adet.`});
    normalized.push({key:`${p.id}-${c.id}-${size}`,productId:p.id,code:p.code,quality:p.quality||"",sole:p.sole||"",name:p.name,colorId:c.id,colorName:c.name,size,qty,price:price(p),unitCost:unitCost(p),image:c.images?.[0]||c.image||p.image||""});
  }
  for(const i of normalized){const p=products.find(x=>n(x.id)===n(i.productId)),c=p.colors.find(x=>x.id===i.colorId);c.sizes[i.size]=n(c.sizes[i.size])-i.qty;p.totalSold=n(p.totalSold)+i.qty}
  write(F.products,products);
  const id=nextId(orders),subtotal=normalized.reduce((s,i)=>s+n(i.price)*n(i.qty),0),cargoFee=subtotal>=n(settings.freeShippingThreshold)?0:n(settings.cargoFee);
  const order={id,orderNo:`${settings.orderPrefix||"SH"}-${String(id).padStart(6,"0")}`,userId:req.user.id,source:"SHELIVA Web",customer:{name:req.body.customer?.name||req.user.name,phone:req.body.customer?.phone||req.user.phone,email:req.body.customer?.email||req.user.email,city:req.body.customer?.city||"",district:req.body.customer?.district||"",neighborhood:req.body.customer?.neighborhood||"",postalCode:req.body.customer?.postalCode||"",address:req.body.customer?.address||"",note:req.body.customer?.note||""},items:normalized,subtotal,cargoFee,total:subtotal+cargoFee,paymentMethod:req.body.paymentMethod||"Kapıda / Taslak",paymentStatus:"Bekliyor",status:"Yeni",statusHistory:[{status:"Yeni",at:now()}],createdAt:now(),cargoCompany:"",cargoTracking:"",cargoNote:"",actualCargoCost:0,refundCost:0};
  orders.push(order);write(F.orders,orders);createTickets(order);res.json(order);
});
app.put("/api/orders/:id/status",(req,res)=>{
  const list=read(F.orders,[]),idx=list.findIndex(o=>n(o.id)===n(req.params.id));if(idx<0)return res.status(404).json({error:"Sipariş yok."});
  const status=String(req.body.status||"");list[idx].status=status;list[idx].statusHistory=[...(list[idx].statusHistory||[]),{status,at:now()}];
  if(status==="Kargoya Verildi"){list[idx].cargoCompany=req.body.cargoCompany||"";list[idx].cargoTracking=req.body.cargoTracking||"";list[idx].cargoNote=req.body.cargoNote||"";list[idx].actualCargoCost=n(req.body.actualCargoCost)}
  write(F.orders,list);write(F.tickets,read(F.tickets,[]).map(t=>n(t.orderId)===n(list[idx].id)?{...t,status,cargoCompany:list[idx].cargoCompany,cargoTracking:list[idx].cargoTracking}:t));res.json(list[idx]);
});
app.post("/api/orders/:id/revert",(req,res)=>{
  const list=read(F.orders,[]),idx=list.findIndex(o=>n(o.id)===n(req.params.id));if(idx<0)return res.status(404).json({error:"Sipariş yok."});
  const prev={"Hazırlanıyor":"Yeni","Kargoya Verildi":"Hazırlanıyor","Teslim Edildi":"Kargoya Verildi"}[list[idx].status];if(!prev)return res.status(400).json({error:"Geri alınamaz."});
  list[idx].status=prev;list[idx].statusHistory=[...(list[idx].statusHistory||[]),{status:prev,at:now(),reverted:true}];write(F.orders,list);res.json(list[idx]);
});

app.get("/api/tickets",(req,res)=>res.json([...read(F.tickets,[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));
app.put("/api/tickets/:id/printed",(req,res)=>{const list=read(F.tickets,[]),idx=list.findIndex(t=>n(t.id)===n(req.params.id));if(idx<0)return res.status(404).json({error:"Fiş yok."});list[idx].printedAt=now();write(F.tickets,list);res.json(list[idx])});

app.get("/api/reviews",(req,res)=>res.json(read(F.reviews,[])));
app.get("/api/products/:id/reviews",(req,res)=>res.json(read(F.reviews,[]).filter(r=>n(r.productId)===n(req.params.id)&&r.status==="Onaylandı")));
app.post("/api/reviews",requireUser,(req,res)=>{const list=read(F.reviews,[]),x={id:nextId(list),userId:req.user.id,userName:req.user.name,productId:n(req.body.productId),rating:Math.max(1,Math.min(5,n(req.body.rating))),text:String(req.body.text||""),status:"Bekliyor",createdAt:now()};list.push(x);write(F.reviews,list);res.json(x)});
app.put("/api/reviews/:id",(req,res)=>{const list=read(F.reviews,[]),idx=list.findIndex(r=>n(r.id)===n(req.params.id));if(idx<0)return res.status(404).json({error:"Yorum yok."});list[idx].status=req.body.status||list[idx].status;write(F.reviews,list);res.json(list[idx])});

app.get("/api/returns",(req,res)=>res.json(read(F.returns,[])));
app.post("/api/returns",requireUser,(req,res)=>{const o=read(F.orders,[]).find(x=>n(x.id)===n(req.body.orderId)&&n(x.userId)===n(req.user.id));if(!o||o.status!=="Teslim Edildi")return res.status(400).json({error:"Bu sipariş iade edilemez."});const list=read(F.returns,[]),x={id:nextId(list),orderId:o.id,orderNo:o.orderNo,userId:req.user.id,customerName:req.user.name,reason:String(req.body.reason||""),status:"Talep",createdAt:now()};list.push(x);write(F.returns,list);res.json(x)});
app.put("/api/returns/:id",(req,res)=>{const list=read(F.returns,[]),idx=list.findIndex(r=>n(r.id)===n(req.params.id));if(idx<0)return res.status(404).json({error:"İade yok."});list[idx].status=req.body.status||list[idx].status;write(F.returns,list);res.json(list[idx])});

app.get("/api/settings",(req,res)=>res.json(read(F.settings,SETTINGS_DEFAULT)));
app.put("/api/settings",(req,res)=>{const x={...read(F.settings,SETTINGS_DEFAULT),...req.body};write(F.settings,x);res.json(x)});
app.get("/api/metrics",(req,res)=>{
  const products=read(F.products,[]),orders=read(F.orders,[]),returns=read(F.returns,[]),delivered=orders.filter(o=>o.status==="Teslim Edildi"),valid=orders.filter(o=>o.status!=="İptal");
  const grossRevenue=valid.reduce((s,o)=>s+n(o.total),0),completedRevenue=delivered.reduce((s,o)=>s+n(o.total),0),netProfit=delivered.reduce((s,o)=>s+orderProfit(o),0),unitsSold=delivered.reduce((s,o)=>s+(o.items||[]).reduce((a,i)=>a+n(i.qty),0),0);
  const models={},colors={},sizes={};for(const o of delivered)for(const i of o.items||[]){models[i.name]=n(models[i.name])+n(i.qty);colors[i.colorName]=n(colors[i.colorName])+n(i.qty);sizes[i.size]=n(sizes[i.size])+n(i.qty)}
  const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,value])=>({name,value}));
  res.json({modelCount:products.length,stockCount:products.reduce((s,p)=>s+stock(p),0),activeOrders:orders.filter(o=>!["Teslim Edildi","İptal"].includes(o.status)).length,grossRevenue,completedRevenue,netProfit,orderCount:orders.length,deliveredCount:delivered.length,unitsSold,averageOrder:delivered.length?completedRevenue/delivered.length:0,returnCount:returns.length,returnRate:delivered.length?returns.length/delivered.length*100:0,topModels:top(models),topColors:top(colors),topSizes:top(sizes)});
});

app.listen(PORT,"0.0.0.0",()=>console.log("\nSHELIVA FULL SERVER 3001 CALISIYOR - TEST OTP KODLARI BU EKRANDA\n"));
