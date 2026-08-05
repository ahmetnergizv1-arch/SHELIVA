import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API = "";
const SIZES = ["36","37","38","39","40","41"];
const n = v => Number(v || 0);

const money = value =>
  n(value).toLocaleString("tr-TR", {
    style:"currency",
    currency:"TRY",
    maximumFractionDigits:0
  });

function imageUrl(path) {
  if (!path) return "";

  return path.startsWith("/uploads/")
    ? API+path
    : path;
}

function totalStock(product) {return (product.colors || []).reduce(
    (sum,color) =>
      sum +
      Object.values(color.sizes || {})
        .reduce(
          (s,v) => s+n(v),
          0
        ),
    0
  );
}

function salePrice(product) {
  if (product.salePrice!=null) {
    return n(product.salePrice);
  }

  const discount =
    Math.max(
      0,
      Math.min(100,n(product.discount))
    );

  return Math.round(
    (
      n(product.price) *
      (1-discount/100)
    ) * 100
  ) / 100;
}

function firstImage(product) {
  return (
    product.colors?.[0]?.images?.[0] ||
    product.colors?.[0]?.image ||
    product.image ||
    ""
  );
}

export default function App() {
  const [authToken,setAuthToken]=useState(()=>localStorage.getItem("sheliva-token")||sessionStorage.getItem("sheliva-token")||"");
  const [authUser,setAuthUser]=useState(null);
  const [authOpen,setAuthOpen]=useState(false);
  const [authMode,setAuthMode]=useState("login");
  const [otpSent,setOtpSent]=useState(false);

  // SHELIVA_EMAIL_AUTH_V1
  const [registerCodeSent,setRegisterCodeSent]=useState(false);
  const [registerDraft,setRegisterDraft]=useState(null);
  const [registerCode,setRegisterCode]=useState("");
  const [authBusy,setAuthBusy]=useState(false);
  const [resetStep,setResetStep]=useState("email");
  const [resetEmail,setResetEmail]=useState("");
  const [loginCodeSent,setLoginCodeSent]=useState(false);
  const [loginDraft,setLoginDraft]=useState(null);
  const [loginCode,setLoginCode]=useState("");
  const [rememberMe,setRememberMe]=useState(true);
  const [authError,setAuthError]=useState("");
  const [registerResendAt,setRegisterResendAt]=useState(0);
  const [loginResendAt,setLoginResendAt]=useState(0);

  const [toast,setToast]=useState(null);
  const [accountOpen,setAccountOpen]=useState(false);
  const [myOrders,setMyOrders]=useState([]);
  const myOrdersRef=useRef([]);
  const [myOrdersLoading,setMyOrdersLoading]=useState(false);
  const [ordersExpanded,setOrdersExpanded]=useState(false);
  const [accountOrderFilter,setAccountOrderFilter]=useState("active");
  const [orderLightbox,setOrderLightbox]=useState(""); // SHELIVA_ORDER_LIGHTBOX_V2

  const [savedAddress,setSavedAddress]=useState(
    () => {
      try {
        return JSON.parse(
          localStorage.getItem("sheliva-saved-address") || "null"
        );
      } catch {
        return null;
      }
    }
  );
  const [products,setProducts] =
    useState([]);

  const [loading,setLoading] =
    useState(true);

  const [connected,setConnected] =
    useState(false);

  const [page,setPage] =
    useState("home");

  const [selected,setSelected] =
    useState(null);

  const [selectedColor,setSelectedColor] =
    useState(null);

  const [selectedSize,setSelectedSize] =
    useState(null);

  const [activePhoto,setActivePhoto] =
    useState("");

  const [filter,setFilter] =
    useState("Tümü");

  const [search,setSearch] =
    useState("");

  const [cart,setCart] =
    useState(
      () =>
        JSON.parse(
          localStorage.getItem(
            "sheliva-cart-v3"
          ) || "[]"
        )
    );

  const [cartOpen,setCartOpen] =
    useState(false);

  const [checkout,setCheckout] =
    useState(false);

  const [orderSuccess,setOrderSuccess] =
    useState(null);

  const [settings,setSettings]=useState({});
  const [productTab,setProductTab]=useState("features");
  const [productReviews,setProductReviews]=useState([]);
  const [reviewRating,setReviewRating]=useState(5);
  const [reviewSent,setReviewSent]=useState(false);


  // SHELIVA_DYNAMIC_CATEGORY_IMAGES_V1
  useEffect(()=>{
    if(!products?.length) return;

    const normalize=value=>
      String(value||"")
        .toLocaleUpperCase("tr-TR")
        .replace(/\s+/g," ")
        .trim();

    const productImage=product=>{
      const raw=
        product?.colors?.[0]?.images?.[0] ||
        product?.colors?.[0]?.image ||
        product?.image ||
        "";

      if(!raw) return "";
      return raw.startsWith("http") ? raw : `${API}${raw}`;
    };

    const pickProduct=list=>{
      const available=(list||[]).filter(product=>productImage(product));
      if(!available.length) return null;

      const bestSeller=[...available]
        .sort((a,b)=>Number(b.totalSold||0)-Number(a.totalSold||0))[0];

      if(Number(bestSeller?.totalSold||0)>0) return bestSeller;

      return [...available]
        .sort((a,b)=>
          Number(b.salePrice||b.price||0)-
          Number(a.salePrice||a.price||0)
        )[0];
    };

    const newest=[...products].sort((a,b)=>
      new Date(b.createdAt||0)-new Date(a.createdAt||0)
    );

    const groups={
      "KIŞLIK":products.filter(p=>
        normalize(p.category).includes("KIŞ")
      ),
      "YAZLIK":products.filter(p=>
        normalize(p.category).includes("YAZ")
      ),
      "İNDİRİMDE":products.filter(p=>
        Number(p.discount||0)>0
      ),
      "TÜM ÜRÜNLER":products,
      "SON GELENLER":newest.filter(p=>p.newest!==false)
    };

    const headings=[
      ...document.querySelectorAll(
        "h1,h2,h3,h4,h5,strong,span,p"
      )
    ];

    for(const [title,list] of Object.entries(groups)){
      const heading=headings.find(node=>
        normalize(node.textContent)===title
      );

      if(!heading) continue;

      const card=
        heading.closest(
          "a,button,article,section,[class*='card'],[class*='category'],div"
        );

      const selected=pickProduct(list);
      const src=productImage(selected);

      if(!card||!src) continue;

      const img=card.querySelector("img");

      if(img){
        img.src=src;
        img.alt=selected?.name||title;
        img.style.objectFit="cover";
      }else{
        card.style.backgroundImage=
          `linear-gradient(rgba(0,0,0,.34),rgba(0,0,0,.34)),url("${src}")`;
        card.style.backgroundSize="cover";
        card.style.backgroundPosition="center";
      }
    }
  },[products]);
  
  async function refreshProducts() {
    try {
      const res =
        await fetch(
          `${API}/api/products`
        );

      if (!res.ok) {
        throw new Error();
      }

      setProducts(
        (await res.json())
          .filter(
            p => p.active!==false
          )
      );

      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{
    refreshProducts();

    const timer =
      setInterval(
        refreshProducts,
        60000
      );

    return () =>
      clearInterval(timer);
  },[]);

  // SHELIVA_CART_STOCK_GUARD_V1
  function availableStockForCartItem(item){
    const product=products.find(p=>Number(p.id)===Number(item.productId||item.id));
    if(!product) return 0;

    const color=(product.colors||[]).find(c=>
      String(c.id)===String(item.colorId) ||
      String(c.name)===String(item.colorName)
    );

    if(!color) return 0;

    return Math.max(0,Number(color.sizes?.[String(item.size)]||0));
  }

  useEffect(()=>{
    if(!products.length||!cart.length) return;

    setCart(current=>{
      let changed=false;

      const next=current
        .map(item=>{
          const max=availableStockForCartItem(item);
          const qty=Math.max(0,Math.min(Number(item.qty||1),max));

          if(qty!==Number(item.qty||1)) changed=true;

          return {...item,qty};
        })
        .filter(item=>item.qty>0);

      if(next.length!==current.length) changed=true;

      return changed ? next : current;
    });
  },[products]);
  useEffect(()=>{
    localStorage.setItem(
      "sheliva-cart-v3",
      JSON.stringify(cart)
    );
  },[cart]);

  useEffect(()=>{
    loadAuthUser();
  },[authToken]);

  useEffect(()=>{
    fetch(`${API}/api/settings`)
      .then(r=>r.ok?r.json():{})
      .then(setSettings)
      .catch(()=>{});
  },[]);

  useEffect(()=>{
    myOrdersRef.current=myOrders;
  },[myOrders]);

  useEffect(()=>{
    if(!accountOpen||!authToken) return;

    loadMyOrders({silent:myOrdersRef.current.length>0});

    const timer=setInterval(()=>{
      loadMyOrders({silent:true});
    },5000);

    return ()=>clearInterval(timer);
  },[accountOpen,authToken]);

  useEffect(()=>{
    const click=e=>{
      const img=e.target.closest?.(".accountPanel img,.ordersAccountCard img");
      if(img?.src) setOrderLightbox(img.src);
    };
    document.addEventListener("click",click);
    return ()=>document.removeEventListener("click",click);
  },[]);
  // SHELIVA_PRODUCT_ZOOM_V1
  useEffect(()=>{
    let overlay=null;
    let image=null;
    let scale=1;
    let startDistance=0;
    let startScale=1;

    const clamp=value=>Math.max(1,Math.min(4,value));

    const applyScale=()=>{
      if(image) image.style.transform=`scale(${scale})`;
    };

    const close=()=>{
      if(overlay){
        overlay.remove();
        overlay=null;
        image=null;
        scale=1;
        document.body.style.overflow="";
      }
    };

    const open=(src,sources=[src])=>{
      close();

      overlay=document.createElement("div");
      overlay.className="productZoomOverlay";
      const uniqueSources=[...new Set((sources||[]).filter(Boolean))];

      overlay.innerHTML=`
        <div class="productZoomToolbar">
          <button type="button" data-zoom-out aria-label="Uzaklaştır">−</button>
          <span>Yakınlaştırmak için dokun veya sıkıştır</span>
          <button type="button" data-zoom-in aria-label="Yakınlaştır">+</button>
          <button type="button" data-zoom-close aria-label="Kapat">×</button>
        </div>

        <div class="productZoomStage">
          <img src="${src}" alt="Ürün görseli büyük görünüm">
        </div>

        ${uniqueSources.length>1 ? `
          <div class="productZoomThumbs">
            ${uniqueSources.map((item,index)=>`
              <button
                type="button"
                data-zoom-thumb="${index}"
                class="${item===src ? "active" : ""}"
              >
                <img src="${item}" alt="Ürün fotoğrafı ${index+1}">
              </button>
            `).join("")}
          </div>
        ` : ""}
      `;

      document.body.appendChild(overlay);
      document.body.style.overflow="hidden";
      image=overlay.querySelector(".productZoomStage > img");

      overlay.querySelectorAll("[data-zoom-thumb]").forEach(button=>{
        button.onclick=()=>{
          const next=uniqueSources[Number(button.dataset.zoomThumb)];
          if(!next||!image) return;

          image.src=next;
          scale=1;
          applyScale();

          overlay
            .querySelectorAll("[data-zoom-thumb]")
            .forEach(item=>item.classList.remove("active"));

          button.classList.add("active");
        };
      });

      overlay.querySelector("[data-zoom-close]").onclick=close;
      overlay.querySelector("[data-zoom-in]").onclick=()=>{
        scale=clamp(scale+.5);
        applyScale();
      };
      overlay.querySelector("[data-zoom-out]").onclick=()=>{
        scale=clamp(scale-.5);
        applyScale();
      };

      overlay.addEventListener("click",event=>{
        if(event.target===overlay || event.target.classList.contains("productZoomStage")){
          close();
        }
      });

      image.addEventListener("dblclick",()=>{
        scale=scale>1 ? 1 : 2;
        applyScale();
      });

      overlay.addEventListener("touchstart",event=>{
        if(event.touches.length===2){
          const [a,b]=event.touches;
          startDistance=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
          startScale=scale;
        }
      },{passive:true});

      overlay.addEventListener("touchmove",event=>{
        if(event.touches.length===2 && startDistance){
          const [a,b]=event.touches;
          const distance=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
          scale=clamp(startScale*(distance/startDistance));
          applyScale();
        }
      },{passive:true});

      overlay.addEventListener("wheel",event=>{
        event.preventDefault();
        scale=clamp(scale+(event.deltaY<0 ? .25 : -.25));
        applyScale();
      },{passive:false});
    };

    const click=event=>{
      const target=event.target.closest?.(
        ".productPage .mainPhoto img,.productPage .mainPhotoV3 img"
      );

      if(!target?.src) return;

      event.preventDefault();

      const productRoot=target.closest(".productPage");

      const sources=[
        ...(productRoot?.querySelectorAll(
          ".thumbs img,.mainPhoto img,.mainPhotoV3 img"
        )||[])
      ]
        .map(img=>img.src)
        .filter(Boolean);

      open(target.src,sources);
    };

    const key=event=>{
      if(event.key==="Escape") close();
    };

    document.addEventListener("click",click);
    document.addEventListener("keydown",key);

    return ()=>{
      document.removeEventListener("click",click);
      document.removeEventListener("keydown",key);
      close();
    };
  },[]);

  useEffect(()=>{
    if(!selected?.id){
      setProductReviews([]);
      return;
    }

    fetch(`${API}/api/products/${selected.id}/reviews`)
      .then(r=>r.ok?r.json():[])
      .then(setProductReviews)
      .catch(()=>setProductReviews([]));
  },[selected?.id]);

  const filtered =
    useMemo(()=>{
      let list =
        [...products];

      if (filter==="Yazlık") {
        list =
          list.filter(
            p => p.category==="Yazlık"
          );
      }

      if (filter==="Kışlık") {
        list =
          list.filter(
            p => p.category==="Kışlık"
          );
      }

      if (filter==="Yeni Sezon") {
        list =
          list.filter(
            p => p.newest!==false
          );
      }

      if (filter==="İndirimde") {
        list =
          list.filter(
            p => n(p.discount)>0
          );
      }

      if (filter==="Son Gelenler") {
        list =
          [...list].sort(
            (a,b) =>
              new Date(b.createdAt) -
              new Date(a.createdAt)
          );
      }

      if (search.trim()) {
        list =
          list.filter(
            p =>
              p.name
                .toLocaleLowerCase("tr")
                .includes(
                  search
                    .toLocaleLowerCase("tr")
                )
          );
      }

      return list;
    },[
      products,
      filter,
      search
    ]);

  const cartCount =
    cart.reduce(
      (s,item) =>
        s+n(item.qty),
      0
    );

  const cartTotal =
    cart.reduce(
      (s,item) =>
        s+n(item.price)*n(item.qty),
      0
    );

  const checkoutCargoFee =
    cartTotal>0 &&
    cartTotal<n(settings.freeShippingThreshold)
      ? n(settings.cargoFee)
      : 0;

  const checkoutGrandTotal =
    cartTotal + checkoutCargoFee;

  const freeShippingRemaining =
    Math.max(0,n(settings.freeShippingThreshold)-cartTotal);

  const discounted =
    products.filter(
      p =>
        n(p.discount)>0 &&
        totalStock(p)>0
    );

  const bestSellers =
    [...products]
      .filter(
        p => totalStock(p)>0
      )
      .sort(
        (a,b) =>
          n(b.totalSold) -
          n(a.totalSold)
      );

  const stockedProducts =
    [...products]
      .filter(
        product =>
          totalStock(product)>0 &&
          firstImage(product)
      );

  const promoProduct =
    [...stockedProducts]
      .sort(
        (a,b) =>
          salePrice(b) -
          salePrice(a)
      )[0] || null;

  const bestseller =
    [...stockedProducts]
      .sort(
        (a,b) =>
          n(b.totalSold) -
          n(a.totalSold)
      )[0] || null;

  function pickCategoryProduct(list){
    const available=(list||[]).filter(p=>firstImage(p));
    if(!available.length) return null;

    const sold=[...available].sort((a,b)=>n(b.totalSold)-n(a.totalSold));
    if(n(sold[0]?.totalSold)>0) return sold[0];

    return [...available].sort((a,b)=>salePrice(b)-salePrice(a))[0];
  }

  const categoryCards=useMemo(()=>{
    const normalize=value=>String(value||"").toLocaleUpperCase("tr-TR").replace(/\s+/g," ").trim();
    const newest=[...products].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));

    const definitions=[
      ["YAZLIK","Yazlık",products.filter(p=>normalize(p.category).includes("YAZ"))],
      ["KIŞLIK","Kışlık",products.filter(p=>normalize(p.category).includes("KIŞ")||normalize(p.category).includes("KIS"))],
      ["İNDİRİMDEKİLER","İndirimde",products.filter(p=>n(p.discount)>0)]
    ];

    return definitions
      .map(([title,key,list])=>{
        const product=pickCategoryProduct(list);
        return product ? {title,key,product,img:imageUrl(firstImage(product))} : null;
      })
      .filter(Boolean);
  },[products]);

  function orderStateSignature(list){
    return JSON.stringify(
      (list||[]).map(order=>({
        id:order.id,
        status:order.status,
        paymentStatus:order.paymentStatus,
        cargoCompany:order.cargoCompany||"",
        cargoTracking:order.cargoTracking||"",
        updatedAt:order.updatedAt||order.statusUpdatedAt||"",
        cancelledAt:order.cancelledAt||"",
        deliveredAt:order.deliveredAt||""
      }))
    );
  }

  async function loadMyOrders({silent=false}={}) {
    if(!authToken){
      if(!silent){
        setAuthMode("login");
        setAuthOpen(true);
      }
      return;
    }

    if(!silent && !myOrdersRef.current.length){
      setMyOrdersLoading(true);
    }

    try{
      const res=await fetch(`${API}/api/account/orders`,{
        headers:{Authorization:`Bearer ${authToken}`},
        cache:"no-store"
      });

      if(!res.ok) throw new Error();

      const nextOrders=await res.json();
      const previousSignature=orderStateSignature(myOrdersRef.current);
      const nextSignature=orderStateSignature(nextOrders);

      if(previousSignature!==nextSignature){
        myOrdersRef.current=nextOrders;
        setMyOrders(nextOrders);
      }

      setMyOrdersLoadedOnce(true);
    }catch{
      if(!silent){
        showToast(
          "Siparişler yüklenemedi",
          "Bağlantıyı kontrol edip tekrar deneyin.",
          "error"
        );
      }
    }finally{
      if(!silent){
        setMyOrdersLoading(false);
      }
    }
  }

  function openAccountOrders(){
    if(!authUser){
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    setAccountOpen(true);
    setOrdersExpanded(true);
    loadMyOrders({silent:myOrdersRef.current.length>0});
  }

  function statusLabel(order){
    if(order.paymentStatus!=="Ödendi") return "Ödeme Onayı Bekleniyor";
    return order.status || "Hazırlanıyor";
  }

  function buildOrderMessage(order,channel){
    const lines=(order.items||[]).map((item,index)=>
      `${index+1}. ${item.name} • ${item.colorName} • ${item.size} numara • ${item.qty} adet`
    );
    return [
      "Merhaba SHELIVA, sipariş talebim için ödeme yapmak istiyorum.",
      `Sipariş No: ${order.orderNo}`,
      "",
      ...lines,
      "",
      `Toplam: ${money(order.total)}`,
      `İletişim: ${channel}`
    ].join("\n");
  }

  function openWhatsAppOrder(order){
    const raw=String(settings.whatsappUrl||settings.supportPhone||"").trim();
    const digits=raw.replace(/\D/g,"");
    if(!digits) return showToast("WhatsApp numarası ayarlanmamış","Yönetim panelinden numarayı ekle.","error");
    const number=digits.startsWith("0")?`9${digits}`:(digits.length===10?`90${digits}`:digits);
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(buildOrderMessage(order,"WhatsApp"))}`,"_blank","noopener,noreferrer");
  }

  async function openInstagramOrder(order){
    const raw=String(settings.instagramUrl||"").trim();
    if(!raw) return showToast("Instagram hesabı ayarlanmamış","Yönetim panelinden hesabı ekle.","error");
    const username=raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i,"").replace(/^@/,"").replace(/\/$/,"");
    try{await navigator.clipboard.writeText(buildOrderMessage(order,"Instagram"));}catch{}
    showToast("Sipariş bilgileri kopyalandı","Instagram DM alanına yapıştırabilirsin.");
    window.open(`https://www.instagram.com/${username}/`,"_blank","noopener,noreferrer");
  }

  function instagramHref(){
    const raw=String(settings.instagramUrl||"").trim();
    if(!raw) return "";
    if(/^https?:\/\//i.test(raw)) return raw;
    return `https://instagram.com/${raw.replace(/^@/,"")}`;
  }

  function whatsappHref(){
    const raw=String(settings.whatsappUrl||settings.supportPhone||"").trim();
    if(!raw) return "";
    if(/^https?:\/\//i.test(raw)) return raw;
    const digits=raw.replace(/\D/g,"");
    const number=digits.startsWith("0") ? `9${digits}` : (digits.length===10 ? `90${digits}` : digits);
    return number ? `https://wa.me/${number}` : "";
  }

  function showToast(message,detail="",type="success") {
    setToast({message,detail,type});

    setTimeout(()=>{
      setToast(null);
    },3200);
  }

  function saveAddressFromForm(form) {
    const address = {
      name:form.get("name") || "",
      phone:form.get("phone") || "",
      email:form.get("email") || "",
      city:form.get("city") || "",
      district:form.get("district") || "",
      neighborhood:form.get("neighborhood") || "",
      postalCode:form.get("postalCode") || "",
      address:form.get("address") || ""
    };

    setSavedAddress(address);

    localStorage.setItem(
      "sheliva-saved-address",
      JSON.stringify(address)
    );
  }

  function clearSavedAddress() {
    

    setSavedAddress(null);
    localStorage.removeItem("sheliva-saved-address");
  }

  function openProduct(product) {
    const color =
      product.colors?.[0] ||
      null;

    setSelected(product);
    setSelectedColor(color);
    setSelectedSize(null);

    setActivePhoto(
      color?.images?.[0] ||
      color?.image ||
      product.image ||
      ""
    );

    setPage("product");
    window.scrollTo(0,0);
  }

  function goHome(category="Tümü") {
    setPage("home");
    setFilter(category);

    setTimeout(()=>{
      if (category==="Tümü") {
        window.scrollTo({
          top:0,
          behavior:"smooth"
        });
      } else {
        document
          .querySelector("#products")
          ?.scrollIntoView({
            behavior:"smooth"
          });
      }
    },50);
  }

  function addToCart() {
    if (!selectedColor) {
      return showToast("Renk seç.");
    }

    if (!selectedSize) {
      return showToast("Numara seç.");
    }

    const stock =
      n(
        selectedColor
          .sizes?.[String(selectedSize)]
      );

    if (stock<=0) {
      return showToast(
        "Bu numara tükendi."
      );
    }

    const key =
      `${selected.id}-${selectedColor.id}-${selectedSize}`;

    setCart(prev => {
      const found =
        prev.find(
          item =>
            item.key===key
        );

      if (found) {
        if (found.qty>=stock) {
          return prev;
        }

        return prev.map(
          item =>
            item.key===key
              ? {
                  ...item,
                  qty:item.qty+1,
                  maxStock:stock
                }
              : item
        );
      }

      return [
        ...prev,
        {
          key,
          productId:selected.id,
          name:selected.name,

          colorId:selectedColor.id,
          colorName:selectedColor.name,

          size:selectedSize,

          image:
            selectedColor.images?.[0] ||
            selectedColor.image ||
            selected.image,

          listPrice:n(selected.price),
          discount:n(selected.discount),
          price:salePrice(selected),

          qty:1,
          maxStock:stock
        }
      ];
    });

    showToast(
      "Ürün başarıyla sepetine eklendi",
      `${selected.name} • ${selectedColor.name} • ${selectedSize} numara`
    );
  }

  function changeQty(key,delta) {
    setCart(prev =>
      prev
        .map(item => {
          if(item.key!==key) return item;

          const maxStock=availableStockForCartItem(item);
          const nextQty=Number(item.qty||1)+Number(delta||0);

          if(nextQty>maxStock){
            showToast(
              "Stok sınırına ulaştınız",
              `Bu ürünün ${item.size} numarasında yalnızca ${maxStock} adet var.`,
              "error"
            );
            return item;
          }

          return {
            ...item,
            qty:Math.max(0,nextQty)
          };
        })
        .filter(item=>item.qty>0)
    );
  }

  async function submitReview(event){
    event.preventDefault();

    if(!authToken){
      setAuthOpen(true);
      setAuthMode("login");
      return;
    }

    const form=new FormData(event.currentTarget);
    const text=String(form.get("reviewText")||"").trim();

    if(!text){
      return showToast("Yorum yazmalısın.","","error");
    }

    const res=await fetch(`${API}/api/reviews`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:`Bearer ${authToken}`
      },
      body:JSON.stringify({
        productId:selected.id,
        rating:reviewRating,
        text,
        anonymous:form.get("anonymous")==="on"
      })
    });

    const data=await res.json();

    if(!res.ok){
      return showToast("Yorum gönderilemedi",data.error||"","error");
    }

    event.currentTarget.reset();
    const reviewBox=event.currentTarget.querySelector('textarea[name="reviewText"]');
    if(reviewBox) reviewBox.value="";
    setReviewRating(5);
    setReviewSent(true);
      showToast(
        "Yorumunuz başarıyla gönderildi",
        "Yorumunuz inceleme için SHELIVA yönetim paneline iletildi.",
        "success"
      );
    setTimeout(()=>setReviewSent(false),4200);
    showToast("Yorum gönderildi","Yönetici onayından sonra yayınlanacak.");
  }

  async function placeOrder(event) {
    event.preventDefault();


    const form =
      new FormData(
        event.currentTarget
      );

    const body = {
      source:"SHELIVA Web",

      cargoFee:
        n(form.get("cargoFee")),

      paymentMethod:
        form.get("paymentMethod"),

      paymentStatus:"Onay Bekliyor",

      customer:{
        name:form.get("name"),
        phone:form.get("phone"),
        email:form.get("email"),

        city:form.get("city"),
        district:form.get("district"),
        neighborhood:form.get("neighborhood"),
        postalCode:form.get("postalCode"),

        address:form.get("address"),
        note:form.get("note")
      },

      items:cart
    };

    const res =
      await fetch(
        `${API}/api/orders`,
        {
          method:"POST",

          headers:{
            "Content-Type":"application/json",
            ...(authToken ? {Authorization:`Bearer ${authToken}`} : {})
          },

          body:
            JSON.stringify(body)
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      return showToast(
        data.error ||
        "Sipariş oluşturulamadı."
      );
    }

    setOrderSuccess(data);
    setCart([]);

    if(authUser){
      saveAddressFromForm(form);
    }

    await refreshProducts();
  }

  async function loadAuthUser(token=authToken) {
    if(!token){setAuthUser(null);return}
    try{
      const res=await fetch(`${API}/api/auth/me`,{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){localStorage.removeItem("sheliva-token");sessionStorage.removeItem("sheliva-token");setAuthToken("");setAuthUser(null);return}
      setAuthUser(await res.json());
    }catch{setAuthUser(null)}
  }

  async function loginUser(event) {
    event.preventDefault();
    if(authBusy) return;

    const form=new FormData(event.currentTarget);
    setAuthError("");

    if(!loginCodeSent){
      const draft={
        email:String(form.get("login")||"").trim().toLowerCase(),
        password:String(form.get("password")||"")
      };

      setAuthBusy(true);
      try{
        const res=await fetch(`${API}/api/auth/login/request-code`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(draft)
        });

        const data=await res.json();
        if(!res.ok){const msg=data.error||"Giriş kodu gönderilemedi.";setAuthError(msg);return showToast(msg,"","error");}

        setLoginDraft(draft);
        setLoginCodeSent(true);
        setLoginResendAt(Date.now()+60000);
        showToast("Giriş kodu gönderildi","E-posta adresinize gelen 6 haneli kodu girin.");
      }catch{
        showToast("Bağlantı hatası","Tekrar deneyin.","error");
      }finally{
        setAuthBusy(false);
      }
      return;
    }

    setAuthBusy(true);
    try{
      const res=await fetch(`${API}/api/auth/login-email`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...loginDraft,code:loginCode,remember:rememberMe})
      });

      const data=await res.json();
      if(!res.ok) return showToast(data.error||"Giriş yapılamadı.","","error");

      localStorage.removeItem("sheliva-token");
      sessionStorage.removeItem("sheliva-token");

      if(rememberMe){
        localStorage.setItem("sheliva-token",data.token);
      }else{
        sessionStorage.setItem("sheliva-token",data.token);
      }

      setAuthToken(data.token);
      setAuthUser(data.user);
      setAuthOpen(false);
      setLoginCodeSent(false);
      setLoginDraft(null);
      setLoginCode("");
      showToast("Giriş başarılı",`Hoş geldin ${data.user?.name||""}`);
    }catch{
      showToast("Bağlantı hatası","Tekrar deneyin.","error");
    }finally{
      setAuthBusy(false);
    }
  }

  async function registerUser(event) {
    event.preventDefault();
    if(authBusy) return;

    const form=new FormData(event.currentTarget);
    setAuthError("");

    if(!registerCodeSent){
      const password=String(form.get("password")||"");
      const passwordConfirm=String(form.get("passwordConfirm")||"");

      if(password.length<6){
        const msg="Şifre en az 6 karakter olmalıdır.";
        setAuthError(msg);
        return showToast(msg,"","error");
      }

      if(password!==passwordConfirm){
        const msg="Şifreler birbiriyle eşleşmiyor.";
        setAuthError(msg);
        return showToast(msg,"","error");
      }

      const draft={
        name:String(form.get("name")||"").trim(),
        email:String(form.get("email")||"").trim().toLowerCase(),
        password
      };

      setAuthBusy(true);

      try{
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),25000);

        let res;
        try{
          res=await fetch(`${API}/api/auth/email/request-code`,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({email:draft.email,purpose:"register"}),
            signal:controller.signal
          });
        }catch(error){
          if(error?.name==="AbortError"){
            showToast("Mail sunucusu geç cevap verdi. Lütfen 30 saniye sonra tekrar deneyin.");
            return;
          }
          throw error;
        }finally{
          clearTimeout(timeout);
        }

        const data=await res.json();

        if(!res.ok){const msg=data.error||"Kod gönderilemedi.";setAuthError(msg);return showToast(msg,"","error");}

        setRegisterDraft(draft);
        setRegisterCodeSent(true);
        setRegisterResendAt(Date.now()+60000);
        showToast("6 haneli doğrulama kodu e-posta adresinize gönderildi.");
      }finally{
        setAuthBusy(false);
      }

      return;
    }

    setAuthBusy(true);

    try{
      const res=await fetch(`${API}/api/auth/register-email`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          ...registerDraft,
          code:registerCode
        })
      });

      const data=await res.json();

      if(!res.ok){const msg=data.error||"Hesap oluşturulamadı.";setAuthError(msg);return showToast(msg,"","error");}

      localStorage.setItem("sheliva-token",data.token);
      setAuthToken(data.token);
      setAuthUser(data.user);
      setAuthOpen(false);
      setRegisterCodeSent(false);
      setRegisterDraft(null);
      setRegisterCode("");
      showToast("E-posta adresiniz doğrulandı. SHELİVA hesabınız oluşturuldu.");
    }finally{
      setAuthBusy(false);
    }
  }

  async function requestPasswordReset(event){
    event.preventDefault();
    if(authBusy) return;

    const form=new FormData(event.currentTarget);
    const email=String(form.get("email")||"").trim().toLowerCase();

    setAuthBusy(true);

    try{
      const res=await fetch(`${API}/api/auth/email/request-code`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email,purpose:"reset"})
      });

      const data=await res.json();

      if(!res.ok) return showToast(data.error||"Kod gönderilemedi.");

      setResetEmail(email);
      setResetStep("code");
      showToast("Şifre sıfırlama kodu e-posta adresinize gönderildi.");
    }finally{
      setAuthBusy(false);
    }
  }

  async function completePasswordReset(event){
    event.preventDefault();
    if(authBusy) return;

    const form=new FormData(event.currentTarget);

    setAuthBusy(true);

    try{
      const res=await fetch(`${API}/api/auth/password/reset`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          email:resetEmail,
          code:form.get("code"),
          password:form.get("password")
        })
      });

      const data=await res.json();

      if(!res.ok) return showToast(data.error||"Şifre değiştirilemedi.");

      showToast("Şifreniz değiştirildi. Yeni şifrenizle giriş yapabilirsiniz.");
      setResetStep("email");
      setResetEmail("");
      setAuthMode("login");
    }finally{
      setAuthBusy(false);
    }
  }

  async function logoutUser() {
    
    if(authToken){try{await fetch(`${API}/api/auth/logout`,{method:"POST",headers:{Authorization:`Bearer ${authToken}`}})}catch{}}
    localStorage.removeItem("sheliva-token");sessionStorage.removeItem("sheliva-token");setAuthToken("");setAuthUser(null);
  }

  
  const visibleAccountOrders=(myOrders||[]).filter(order=>{
    if(accountOrderFilter==="delivered"){
      return order.status==="Teslim Edildi";
    }

    return !["Teslim Edildi","İptal"].includes(order.status);
  });
if (loading) {
    return (
      <div className="loading">
        SHELİVA
      </div>
    );
  }

  return (
    <div className="site">

      <header className="header">

        <div className="headerLeft">
          <button
            className="menu"
            onClick={()=>goHome()}
          >
            ☰
            {" "}
            <small>MENU</small>
          </button>

          {instagramHref() && (
            <a className="headerSocial instagram" href={instagramHref()} target="_blank" rel="noreferrer" aria-label="Instagram">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>
            </a>
          )}

          {whatsappHref() && (
            <a className="headerSocial whatsapp" href={whatsappHref()} target="_blank" rel="noreferrer" aria-label="WhatsApp">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.7A8 8 0 0 1 8.2 18.8L4 20l1.2-4A8 8 0 1 1 20 11.7Z"/><path d="M9 8.5c.3 2.4 2.1 4.3 4.6 5l1.2-1.1 2 .8c-.4 1.6-1.7 2.5-3.2 2.3-3.6-.5-6.5-3.3-7-6.8-.2-1.4.7-2.8 2.2-3.2l.8 2Z"/></svg>
            </a>
          )}
        </div>

        <button
          className="brand"
          onClick={()=>goHome()}
        >
          SHELİVA
        </button>

        <div className="headerIcons">

          <div className="headerSearch">
            ⌕
            <input
              placeholder="Ara"
              value={search}
              onChange={e=>
                setSearch(
                  e.target.value
                )
              }
            />
          </div>

          <button
            className="headerAccount"
            onClick={openAccountOrders}
          >
            SİPARİŞLERİM
          </button>

          <button
            className="headerAccount"
            onClick={()=>
              authUser
                ? setAccountOpen(true)
                : setAuthOpen(true)
            }
          >
            {authUser ? "HESABIM" : "GİRİŞ / ÜYE OL"}
          </button>

          <button
            className="headerCart"
            onClick={()=>
              setCartOpen(true)
            }
          >
            🛍

            <span>
              {cartCount}
            </span>
          </button>

        </div>

      </header>

      {!connected && (
        <div className="serverWarning">
          Sunucu bağlantısı yok.
        </div>
      )}

      {page==="home" && (
        <main className="homeMain">

          {promoProduct && (
          <section className="heroBanner heroTop">

            <div className="heroPhoto">
              <img
                src={
                  imageUrl(
                    firstImage(promoProduct)
                  )
                }
              />
            </div>

            <div className="heroBlack">

              <h1>
                Özelleştirilmiş Koleksiyon
              </h1>

              <b>BY SHELİVA</b>
              <i></i>

              <span>
                {promoProduct.name}
              </span>

              {promoProduct && (
                <button
                  className="heroAction"
                  onClick={()=>
                    openProduct(promoProduct)
                  }
                >
                  İNCELE
                </button>
              )}

            </div>

          </section>
          )}

          {bestseller && (
          <section className="heroBanner heroBottom">

            <div className="heroBlack">

              <h1>En Çok Satan</h1>

              <b>BY SHELİVA</b>
              <i></i>

              <span>
                {bestseller.name}
              </span>

              {bestseller && (
                <button
                  className="heroAction"
                  onClick={()=>
                    openProduct(bestseller)
                  }
                >
                  İNCELE
                </button>
              )}

            </div>

            <div className="heroPhoto">
              <img
                src={
                  imageUrl(
                    firstImage(bestseller)
                  )
                }
                style={{
                  objectFit:"cover",
                  objectPosition:"center bottom"
                }}
              />
            </div>

          </section>
          )}

          {categoryCards.length>0 && (
            <section className="categoryGrid">
              {categoryCards.map(card=>(
                <button
                  key={card.title}
                  onClick={()=>goHome(card.key)}
                >
                  <img
                    src={card.img}
                    alt={card.product.name}
                    onError={event=>{
                      const fallbackProduct=promoProduct || bestseller;
                      const fallback=fallbackProduct
                        ? imageUrl(firstImage(fallbackProduct))
                        : "";

                      if(
                        fallback &&
                        event.currentTarget.src!==fallback &&
                        event.currentTarget.dataset.fallback!=="1"
                      ){
                        event.currentTarget.dataset.fallback="1";
                        event.currentTarget.src=fallback;
                      }else{
                        event.currentTarget.style.display="none";
                      }
                    }}
                  />
                  <strong>{card.title}</strong>
                  <span>by SHELİVA</span>
                </button>
              ))}
            </section>
          )}

          <section
            id="products"
            className="products"
          >

            <div className="productsTitle">
              <span>SHELİVA</span>

              <h2>
                {filter==="Tümü"
                  ? "Tüm Ürünler"
                  : filter}
              </h2>
            </div>

            {!filtered.length ? (
              <div className="noProducts">
                Henüz ürün eklenmedi.
                <small>
                  Ürünler yönetim panelinden eklenir.
                </small>
              </div>
            ) : (
              <div className="productsGrid">

                {filtered.map(
                  product => (
                    <article
                      className="productCard"
                      key={product.id}
                      onClick={()=>
                        openProduct(product)
                      }
                    >

                      <div className="productImg">

                        {firstImage(product) ? (
                          <img
                            src={
                              imageUrl(
                                firstImage(product)
                              )
                            }
                          />
                        ) : (
                          <div className="noImage">
                            SHELİVA
                          </div>
                        )}

                        {n(product.discount)>0 && (
                          <span className="saleTag">
                            %{product.discount}
                          </span>
                        )}

                      </div>

                      <div className="productCardText">

                        <small>
                          {product.category}
                        </small>

                        <h3>
                          {product.name}
                        </h3>

                        <div className="priceArea">

                          {n(product.discount)>0 && (
                            <del>
                              {money(product.price)}
                            </del>
                          )}

                          <strong>
                            {money(
                              salePrice(product)
                            )}
                          </strong>

                        </div>

                        <span
                          className={
                            totalStock(product)>0
                              ? "stockAvailable"
                              : "stockOut"
                          }
                        >
                          {totalStock(product)>0
                            ? `${totalStock(product)} adet stok`
                            : "Tükendi"}
                        </span>

                        <button
                          disabled={
                            totalStock(product)<=0
                          }
                        >
                          {totalStock(product)>0
                            ? "ÜRÜNÜ İNCELE"
                            : "TÜKENDİ"}
                        </button>

                      </div>

                    </article>
                  )
                )}

              </div>
            )}

          </section>

        </main>
      )}

      {page==="product" && selected && (
        <main className="productPage">

          <div className="breadcrumb">

            <button
              onClick={()=>goHome()}
            >
              Ana Sayfa
            </button>

            <span>/</span>

            <b>
              {selected.name}
            </b>

          </div>

          <section className="detailTop v3Product">

            <div className="galleryV3">

              <div className="thumbsV3">

                {(
                  selectedColor?.images ||
                  (
                    selectedColor?.image
                      ? [selectedColor.image]
                      : []
                  )
                ).map(
                  (img,index) => (
                    <button
                      key={index}
                      className={
                        activePhoto===img
                          ? "active"
                          : ""
                      }
                      onClick={()=>
                        setActivePhoto(img)
                      }
                    >
                      <img
                        src={
                          imageUrl(img)
                        }
                      />
                    </button>
                  )
                )}

              </div>

              <div className="mainPhotoV3">

                {activePhoto ? (
                  <img
                    src={
                      imageUrl(activePhoto)
                    }
                  />
                ) : (
                  <div className="noImage">
                    SHELİVA
                  </div>
                )}

              </div>

            </div>

            <div className="detailInfo">

              <small>
                {selected.quality || "SHELİVA"}
              </small>

              <h1>
                {selected.name}
              </h1>

              <div className="detailPriceV3">

                <div>

                  {n(selected.discount)>0 && (
                    <del>
                      {money(selected.price)}
                    </del>
                  )}

                  <strong>
                    {money(
                      salePrice(selected)
                    )}
                  </strong>

                </div>

                {n(selected.discount)>0 && (
                  <span>
                    %{selected.discount} İndirim
                  </span>
                )}

              </div>

              <div className="optionBlock">

                <label>RENK</label>

                <div className="colorSelector">

                  {(selected.colors||[])
                    .map(color => (
                      <button
                        key={color.id}
                        className={
                          selectedColor?.id===color.id
                            ? "active"
                            : ""
                        }
                        onClick={()=>{
                          setSelectedColor(color);
                          setSelectedSize(null);
                          setActivePhoto(
                            color.images?.[0] ||
                            color.image ||
                            ""
                          );
                        }}
                      >

                        {(color.images?.[0] || color.image) && (
                          <img
                            src={
                              imageUrl(
                                color.images?.[0] ||
                                color.image
                              )
                            }
                          />
                        )}

                        <span>
                          {color.name}
                        </span>

                      </button>
                    ))}

                </div>

              </div>

              <div className="optionBlock">

                <label>NUMARA</label>

                <div className="sizes">

                  {SIZES.map(size => {
                    const stock =
                      n(
                        selectedColor
                          ?.sizes?.[size]
                      );

                    return (
                      <button
                        key={size}
                        disabled={stock<=0}
                        className={
                          String(selectedSize)===size
                            ? "active"
                            : ""
                        }
                        onClick={()=>
                          setSelectedSize(size)
                        }
                      >
                        {size}

                        <small>
                          {stock>0
                            ? `${stock} adet`
                            : "Yok"}
                        </small>
                      </button>
                    );
                  })}

                </div>

              </div>

              <button
                className="addButton"
                disabled={
                  !selectedColor ||
                  !selectedSize ||
                  n(
                    selectedColor
                      ?.sizes?.[String(selectedSize)]
                  )<=0
                }
                onClick={addToCart}
              >
                {!selectedSize
                  ? "NUMARA SEÇ"
                  : n(
                      selectedColor
                        ?.sizes?.[String(selectedSize)]
                    )<=0
                    ? "TÜKENDİ"
                    : "SEPETE EKLE"}
              </button>

              <div className="productMeta">

                <span>
                  Stok:
                  {" "}
                  <b>
                    {totalStock(selected)}
                  </b>
                </span>

                <span>
                  İndirimli fiyat otomatik hesaplanır.
                </span>

              </div>

            </div>

          </section>

          <section className="productTabsPro">

            <div className="productTabsNav">
              {[
                ["features","ÜRÜN ÖZELLİKLERİ"],
                ["reviews",`YORUMLAR (${productReviews.length})`],
                ["payment","ÖDEME SEÇENEKLERİ"],
                ["shipping","KARGO, DEĞİŞİM VE İADELER"],
                ["faq","S.S.S."]
              ].map(([key,label])=>(
                <button
                  key={key}
                  className={productTab===key ? "active" : ""}
                  onClick={()=>setProductTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="productTabContent">
              {productTab==="features" && (
                <div>
                  <h3>{selected.name}</h3>
                  <p>{selected.description || "Ürün açıklaması yakında eklenecek."}</p>

                  {selected.features && <div className="richTextBlock">{selected.features}</div>}
                </div>
              )}

              {productTab==="reviews" && (
                <div className="reviewsArea">
                  <div className="reviewList">
                    {!productReviews.length && <p>Bu ürün için henüz onaylanmış yorum yok.</p>}
                    {productReviews.map(review=>(
                      <article key={review.id} className="customerReview">
                        <div><b>{review.userName || "Müşteri"}</b><span>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div>
                        <p>{review.text}</p>
                        <small>{new Date(review.createdAt).toLocaleDateString("tr-TR")}</small>
                      </article>
                    ))}
                  </div>

                  <form className="reviewForm" onSubmit={submitReview}>
                    <h3>Yorum Yaz</h3>
                    {!authUser && <p>Yorum göndermek için giriş yapman gerekir.</p>}
                    <div className="ratingPicker">
                      {[1,2,3,4,5].map(star=>(
                        <button type="button" key={star} className={star<=reviewRating ? "active" : ""} onClick={()=>setReviewRating(star)}>★</button>
                      ))}
                    </div>
                    <textarea name="reviewText" placeholder="Ürün hakkındaki deneyimini yaz..." required/>
                    <label className="anonymousReviewOption">
                      <input type="checkbox" name="anonymous"/>
                      <span>
                        <b>Adımı ve bilgilerimi gizle</b>
                        <small>Yayınlandığında adın yerine "Gizli Kullanıcı" görünür.</small>
                      </span>
                    </label>
                    <button type="submit">YORUMU GÖNDER</button>
                    {reviewSent && <div className="reviewSentMessage">✓ Yorum gönderildi. Onaydan sonra yayınlanacak.</div>}
                    <small>Yorumun yönetici onayından sonra yayınlanır.</small>
                  </form>
                </div>
              )}

              {productTab==="payment" && (
                <div>
                  <h3>Ödeme Seçenekleri</h3>
                  <p>{selected.paymentInfo || "Kredi/Banka Kartı ve Havale/EFT seçenekleri kullanılabilir."}</p>
                  {settings.iban && (
                    <div className="ibanBox">
                      <span>{settings.bankName || "Banka"}</span>
                      <b>{settings.iban}</b>
                      <small>{settings.accountHolder || "SHELİVA"}</small>
                    </div>
                  )}
                </div>
              )}


              {productTab==="shipping" && (
                <div><h3>Kargo, Değişim ve İadeler</h3><p>{selected.shippingReturns || "Gönderimler Aras Kargo ile yapılır. Detaylı koşullar yönetim panelinden düzenlenebilir."}</p></div>
              )}

              {productTab==="faq" && (
                <div><h3>Sık Sorulan Sorular</h3><p>{selected.faq || "Sık sorulan sorular yakında eklenecek."}</p></div>
              )}
            </div>

          </section>

        </main>
      )}

      <footer className="siteFooter">
        <div className="footerTop">
          <section className="footerBrand">
            <h2>SHELİVA</h2>
            <p>Modern çizgiler, seçilmiş modeller ve detaylı üretim.</p>
            <div className="socialLinks">{settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer">INSTAGRAM</a>}{settings.tiktokUrl && <a href={settings.tiktokUrl} target="_blank" rel="noreferrer">TIKTOK</a>}{settings.youtubeUrl && <a href={settings.youtubeUrl} target="_blank" rel="noreferrer">YOUTUBE</a>}{settings.whatsappUrl && <a href={settings.whatsappUrl} target="_blank" rel="noreferrer">WHATSAPP</a>}</div>
          </section>

          <section>
            <b>ALIŞVERİŞ</b>
            <button onClick={()=>goHome("Yazlık")}>Yazlık</button>
            <button onClick={()=>goHome("Kışlık")}>Kışlık</button>
            <button onClick={()=>goHome("İndirimde")}>İndirimde</button>
            <button onClick={()=>goHome("Son Gelenler")}>Son Gelenler</button>
          </section>

          <section><b>MÜŞTERİ</b><button onClick={openAccountOrders}>Sipariş Takibi</button><span>Kargo & Teslimat</span><span>İade / Değişim</span><span>Gizlilik</span></section>
          <section><b>SHELİVA</b><span>Hakkımızda</span><span>İletişim</span><span>Üretim</span><span>Sık Sorulan Sorular</span></section>
        </div>

        <div className="footerBottom"><span>© 2026 SHELİVA</span><span>Güvenli alışveriş • Gerçek stok</span></div>
      </footer>

      {orderLightbox && (
        <div className="shelivaLightbox" onClick={()=>setOrderLightbox("")}>
          <button onClick={()=>setOrderLightbox("")}>×</button>
          <img src={orderLightbox} onClick={e=>e.stopPropagation()}/>
        </div>
      )}

      {authOpen && (
        <div className="authOverlay">
          <div className="authModal">
            <div className="authHead">
              <div><small>SHELİVA</small><h2>{authMode==="login" ? "Giriş Yap" : authMode==="forgot" ? "Şifremi Unuttum" : "Üye Ol"}</h2></div>
              <button onClick={()=>{setAuthOpen(false);setAuthError("");}}>×</button>
            </div>

            <div className="authTabs">
              <button className={authMode==="login"?"active":""} onClick={()=>setAuthMode("login")}>GİRİŞ</button>
              <button className={authMode==="register"?"active":""} onClick={()=>setAuthMode("register")}>ÜYE OL</button>
            </div>

            {authMode==="login" ? (
              !loginCodeSent ? (
                <form className="authForm" onSubmit={loginUser}>
                  <label>E-posta<input name="login" type="email" autoComplete="email" inputMode="email" required placeholder="mail@ornek.com"/></label>
                  <label>Şifre<input name="password" type="password" autoComplete="current-password" required placeholder="Şifren"/></label>

                  {authError && <div className="authInlineError">{authError}</div>}

                  <label className="rememberOption">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e=>setRememberMe(e.target.checked)}
                    />
                    <span>
                      <b>Beni hatırla</b>
                      <small>Bu cihazda oturumum açık kalsın.</small>
                    </span>
                  </label>

                  <button disabled={authBusy}>{authBusy ? "KOD GÖNDERİLİYOR..." : "GİRİŞ KODU GÖNDER"}</button>
                  <button
                    type="button"
                    className="authSecondary"
                    onClick={()=>{
                      setAuthMode("forgot");
                      setResetStep("email");
                    }}
                  >
                    ŞİFREMİ UNUTTUM
                  </button>
                </form>
              ) : (
                <form className="authForm" onSubmit={loginUser}>
                  <div className="verifyLater">
                    <b>{loginDraft?.email}</b> adresine gönderilen 6 haneli güvenli giriş kodunu girin.
                    Kod 5 dakika geçerlidir.
                  </div>
                  {authError && <div className="authInlineError">{authError}</div>}
                  <label>Giriş Kodu
                    <input
                      value={loginCode}
                      onChange={e=>setLoginCode(e.target.value.replace(/\D/g,"").slice(0,6))}
                      inputMode="numeric"
                      required
                      minLength="6"
                      maxLength="6"
                      placeholder="000000"
                      style={{fontSize:24,letterSpacing:8,textAlign:"center"}}
                    />
                  </label>
                  <button disabled={authBusy||loginCode.length!==6}>
                    {authBusy ? "DOĞRULANIYOR..." : "KODU DOĞRULA VE GİRİŞ YAP"}
                  </button>
                  <button
                    type="button"
                    className="authSecondary"
                    onClick={()=>{
                      setLoginCodeSent(false);
                      setLoginDraft(null);
                      setLoginCode("");
                    }}
                  >
                    BİLGİLERİ DEĞİŞTİR
                  </button>
                </form>
              )
            ) : authMode==="forgot" ? (
              resetStep==="email" ? (
                <form className="authForm" onSubmit={requestPasswordReset}>
                  <div className="verifyLater">Hesabınıza kayıtlı e-posta adresini yazın. 6 haneli şifre sıfırlama kodu göndereceğiz.</div>
                  <label>E-posta<input name="email" type="email" required placeholder="mail@ornek.com"/></label>
                  <button disabled={authBusy}>{authBusy ? "GÖNDERİLİYOR..." : "ŞİFRE SIFIRLAMA KODU GÖNDER"}</button>
                  <button type="button" className="authSecondary" onClick={()=>setAuthMode("login")}>GİRİŞE DÖN</button>
                </form>
              ) : (
                <form className="authForm" onSubmit={completePasswordReset}>
                  <div className="verifyLater"><b>{resetEmail}</b> adresine gelen kodu girin ve yeni şifrenizi belirleyin.</div>
                  <label>6 Haneli Kod<input name="code" inputMode="numeric" required minLength="6" maxLength="6" placeholder="000000"/></label>
                  <label>Yeni Şifre<input name="password" type="password" required minLength="6" placeholder="En az 6 karakter"/></label>
                  <button disabled={authBusy}>{authBusy ? "DEĞİŞTİRİLİYOR..." : "ŞİFREYİ DEĞİŞTİR"}</button>
                </form>
              )
            ) : (
              !registerCodeSent ? (
                <form className="authForm" onSubmit={registerUser}>
                  <label>Ad Soyad
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      placeholder="Ad Soyad"
                      defaultValue={savedAddress?.name || authUser?.name || ""}
                    />
                  </label>

                  <label>E-posta
                    <input
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      placeholder="mail@ornek.com"
                    />
                  </label>

                  <label>Şifre
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength="6"
                      placeholder="En az 6 karakter"
                    />
                  </label>

                  <label>Şifreyi Doğrula
                    <input
                      name="passwordConfirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength="6"
                      placeholder="Şifreyi tekrar yazın"
                    />
                  </label>

                  {authError && <div className="authInlineError">{authError}</div>}

                  <div className="verifyLater">
                    Aynı e-posta adresiyle ikinci hesap açılamaz. E-posta adresinize 6 haneli doğrulama kodu gönderilir.
                  </div>
                  <button disabled={authBusy}>{authBusy ? "KOD GÖNDERİLİYOR..." : "DOĞRULAMA KODU GÖNDER"}</button>
                </form>
              ) : (
                <form className="authForm" onSubmit={registerUser}>
                  <div className="verifyLater">
                    <b>{registerDraft?.email}</b> adresine gönderilen 6 haneli kodu girin.
                    Kod 5 dakika geçerlidir ve yalnızca bir kez kullanılabilir.
                  </div>
                  {authError && <div className="authInlineError">{authError}</div>}
                  <label>Doğrulama Kodu
                    <input
                      value={registerCode}
                      onChange={e=>setRegisterCode(e.target.value.replace(/\D/g,"").slice(0,6))}
                      inputMode="numeric"
                      required
                      minLength="6"
                      maxLength="6"
                      placeholder="000000"
                      style={{fontSize:24,letterSpacing:8,textAlign:"center"}}
                    />
                  </label>
                  <button disabled={authBusy||registerCode.length!==6}>
                    {authBusy ? "DOĞRULANIYOR..." : "KODU DOĞRULA VE HESAP AÇ"}
                  </button>
                  <button
                    type="button"
                    className="authSecondary"
                    onClick={()=>{
                      setRegisterCodeSent(false);
                      setRegisterDraft(null);
                      setRegisterCode("");
                    }}
                  >
                    BİLGİLERİ DEĞİŞTİR
                  </button>
                </form>
              )
            )}
          </div>
        </div>
      )}

      {accountOpen && authUser && (
        <div className="accountOverlay">

          <div className="accountPanel">

            <div className="accountHead">

              <div>
                <small>SHELİVA HESABIM</small>
                <h2>{authUser.name}</h2>
                <span>{authUser.email}</span>
              </div>

              <button
                onClick={()=>
                  setAccountOpen(false)
                }
              >
                ×
              </button>

            </div>

            <div className="accountMenuGrid">

              <section className="accountMenuCard">
                <b>PROFİL BİLGİLERİ</b>

                <span>{authUser.name}</span>
                <span>{authUser.phone}</span>
                <span>{authUser.email}</span>
              </section>

              <section className="accountMenuCard addressCard">

                <div className="accountCardTitle">
                  <b>TESLİMAT ADRESİM</b>

                  {savedAddress && (
                    <button
                      onClick={clearSavedAddress}
                    >
                      SİL
                    </button>
                  )}
                </div>

                {savedAddress ? (
                  <>
                    <strong>
                      {savedAddress.name}
                    </strong>

                    <p>
                      {savedAddress.neighborhood
                        ? `${savedAddress.neighborhood}, `
                        : ""}
                      {savedAddress.address}
                    </p>

                    <span>
                      {savedAddress.district}
                      {" / "}
                      {savedAddress.city}
                    </span>

                    <span>
                      {savedAddress.phone}
                    </span>

                    <small>
                      Bir sonraki siparişte bu bilgiler
                      otomatik doldurulur.
                    </small>
                  </>
                ) : (
                  <>
                    <p>
                      Henüz kayıtlı teslimat adresin yok.
                    </p>

                    <small>
                      İlk siparişinde adresini gir.
                      Siparişten sonra otomatik kaydedilecek.
                    </small>
                  </>
                )}

              </section>

              <section className="accountMenuCard ordersAccountCard">
                <div className="accountCardTitle">
                  <b>SON SİPARİŞLERİM</b>
                <div className="accountOrderTabs">
                  <button
                    type="button"
                    className={accountOrderFilter==="active" ? "active" : ""}
                    onClick={()=>setAccountOrderFilter("active")}
                  >
                    AKTİF SİPARİŞLERİNİZ
                    <b>{(myOrders||[]).filter(o=>!["Teslim Edildi","İptal"].includes(o.status)).length}</b>
                  </button>

                  <button
                    type="button"
                    className={accountOrderFilter==="delivered" ? "active" : ""}
                    onClick={()=>setAccountOrderFilter("delivered")}
                  >
                    GEÇMİŞ SİPARİŞLERİNİZ
                    <b>{(myOrders||[]).filter(o=>o.status==="Teslim Edildi").length}</b>
                  </button>
                </div>
                {!myOrdersLoading && visibleAccountOrders.length===0 && (
                  <div className="accountOrdersEmpty">
                    <b>{accountOrderFilter==="active" ? "Aktif siparişiniz yok." : "Teslim edilen siparişiniz yok."}</b>
                    <span>Siparişleriniz burada güvenli şekilde saklanır ve durum değişiklikleri otomatik görünür.</span>
                  </div>
                )}
                  <button
                    onClick={()=>{
                      const next=!ordersExpanded;
                      setOrdersExpanded(next);
                      if(next) loadMyOrders();
                    }}
                  >
                    {ordersExpanded ? "KAPAT" : "GÖRÜNTÜLE"}
                  </button>
                </div>

                {!ordersExpanded ? (
                  <p>Siparişlerinin güncel durumunu ve kargo bilgilerini görüntüle.</p>
                ) : myOrdersLoading ? (
                  <p>Siparişler yükleniyor...</p>
                ) : myOrders.length===0 ? (
                  <div className="emptyOrders">
                    <strong>Henüz siparişiniz yok</strong>
                    <span>Oluşturduğunuz siparişler burada görünecek.</span>
                  </div>
                ) : (
                  <div className="myOrdersList">
                    {visibleAccountOrders.map(order=>(
                      <article className="myOrderCard" key={order.id}>
                        <div className="myOrderHead">
                          <div>
                            <b>{order.orderNo}</b>
                            <small>{new Date(order.createdAt).toLocaleString("tr-TR")}</small>
                          </div>
                          <span className={`orderStatus status-${String(order.status||"bekliyor").toLocaleLowerCase("tr").replaceAll(" ","-")}`}>
                            {statusLabel(order)}
                          </span>
                        </div>

                        <div className="orderProgress">
                          {["Ödeme Onayı","Hazırlanıyor","Kargoya Verildi","Teslim Edildi"].map((step,index)=>{
                            const current=order.paymentStatus!=="Ödendi" ? 0 : ({"Hazırlanıyor":1,"Kargoya Verildi":2,"Teslim Edildi":3}[order.status] ?? 1);
                            return <span className={index<=current?"done":""} key={step}>{step}</span>;
                          })}
                        </div>

                        <div className="myOrderItems">
                          {(order.items||[]).map((item,index)=>(
                            <div key={`${order.id}-${index}`}>
                              <span>{item.name} • {item.colorName} • {item.size} numara</span>
                              <b>{item.qty} adet</b>
                            </div>
                          ))}
                        </div>

                        <div className="myOrderInfo">
                          <span><b>Ödeme:</b> {order.paymentStatus||"Bekliyor"}</span>
                          <span><b>Toplam:</b> {money(order.total)}</span>
                          {order.cargoCompany && <span><b>Kargo:</b> {order.cargoCompany}</span>}
                          {order.cargoTracking && <span><b>Takip Kodu:</b> {order.cargoTracking}</span>}
                          {order.cargoNote && <span><b>Kargo Notu:</b> {order.cargoNote}</span>}
                          {order.customer?.note && <span><b>Sipariş Notu:</b> {order.customer.note}</span>}
                        </div>

                        {order.paymentStatus!=="Ödendi" && (
                          <div className="orderContactButtons">
                            <button onClick={()=>openWhatsAppOrder(order)}>WHATSAPP İLE ÖDEME</button>
                            <button onClick={()=>openInstagramOrder(order)}>INSTAGRAM İLE SİPARİŞ VER</button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="accountMenuCard">
                <b>GÜVENLİK</b>
                <p>
                  Şifre ve telefon doğrulama ayarları.
                </p>
              </section>

            </div>

            <div className="accountFooter">

              <button
                className="logoutButton"
                onClick={()=>{
                  setAccountOpen(false);
                  logoutUser();
                }}
              >
                ÇIKIŞ YAP
              </button>

            </div>

          </div>

        </div>
      )}

      {toast && (
        <div
          className={
            `shopToast ${toast.type || "success"}`
          }
        >
          <div className="toastCheck">
            ✓
          </div>

          <div className="toastText">
            <b>{toast.message}</b>
            <span>{toast.detail}</span>
          </div>

          <button
            onClick={()=>{
              setToast(null);
              setCartOpen(true);
            }}
          >
            SEPETE GİT
          </button>

          <button
            className="toastClose"
            onClick={()=>
              setToast(null)
            }
          >
            ×
          </button>
        </div>
      )}
      <div
        className={
          cartOpen
            ? "drawerShade show"
            : "drawerShade"
        }
        onClick={()=>
          setCartOpen(false)
        }
      ></div>

      <aside
        className={
          cartOpen
            ? `sideDrawer open ${checkout ? "checkoutMode" : ""}`
            : "sideDrawer"
        }
      >

        <div className="drawerHead">

          <h2>
            Sepetim ({cartCount})
          </h2>

          <button
            onClick={()=>
              setCartOpen(false)
            }
          >
            ×
          </button>

        </div>

        {!checkout ? (
          <>

            <div className="drawerContent">

              {!cart.length && (
                <div className="emptyCartPro">

                  <div className="emptyCartIcon">
                    🛍
                  </div>

                  <h3>Sepetin boş.</h3>

                  <p>
                    Beğendiğin ürünleri sepete ekleyerek
                    alışverişine başlayabilirsin.
                  </p>

                  <button
                    onClick={()=>{
                      setCartOpen(false);
                      setCheckout(false);
                      goHome("Tümü");

                      setTimeout(()=>{
                        document
                          .querySelector("#products")
                          ?.scrollIntoView({
                            behavior:"smooth"
                          });
                      },100);
                    }}
                  >
                    Sepetine Yeni Ürünler Eklemek İçin Tıkla
                  </button>

                  <div className="emptyCartBenefits">
                    <span>✓ Gerçek stok</span>
                    <span>✓ Güvenli alışveriş</span>
                    <span>✓ Kolay sipariş</span>
                  </div>

                </div>
              )}

              {cart.map(item => (
                <div
                  className="drawerItem"
                  key={item.key}
                >

                  <img
                    src={
                      imageUrl(item.image)
                    }
                  />

                  <div>

                    <h4>{item.name}</h4>

                    <p>
                      {item.colorName}
                      {" • "}
                      {item.size}
                    </p>

                    <strong>
                      {money(
                        item.price *
                        item.qty
                      )}
                    </strong>

                    <div className="drawerQty">

                      <button
                        onClick={()=>
                          changeQty(
                            item.key,
                            -1
                          )
                        }
                      >
                        −
                      </button>

                      <span>
                        {item.qty}
                      </span>

                      <button
                        disabled={
                          item.qty>=item.maxStock
                        }
                        onClick={()=>
                          changeQty(
                            item.key,
                            1
                          )
                        }
                      >
                        +
                      </button>

                    </div>

                    <small className="stockHint">
                      Maks. {item.maxStock} adet
                    </small>

                  </div>

                  <button
                    className="remove"
                    onClick={()=>
                      setCart(
                        cart.filter(
                          x => x.key!==item.key
                        )
                      )
                    }
                  >
                    ×
                  </button>

                </div>
              ))}

            </div>

            {!!cart.length && (
              <div className="drawerBottom">


                <div className="freeShippingCartNotice">
                  {n(settings.freeShippingThreshold)>0 ? (
                    cartTotal>=n(settings.freeShippingThreshold) ? (
                      <b>✓ Ücretsiz kargo hakkın aktif.</b>
                    ) : (
                      <>
                        <b>{money(settings.freeShippingThreshold)} ve üzeri ücretsiz kargo</b>
                        <span>Ücretsiz kargo için {money(freeShippingRemaining)} daha ekle.</span>
                      </>
                    )
                  ) : null}
                </div>

                <div className="drawerTotal">
                  <span>Toplam</span>
                  <strong>
                    {money(cartTotal)}
                  </strong>
                </div>

                <button
                  onClick={()=>
                    setCheckout(true)
                  }
                >
                  SİPARİŞİ ONAYLA
                </button>

              </div>
            )}

          </>
        ) : (
          <form
            className="checkoutForm"
            onSubmit={placeOrder}
          >

            {!orderSuccess ? (
              <>

                <button
                  type="button"
                  onClick={()=>
                    setCheckout(false)
                  }
                >
                  ← Sepete dön
                </button>

                <div className="checkoutHeading">
                  <small>SHELİVA CHECKOUT</small>
                  <h2>Ödeme ve Teslimat</h2>
                  <p>Siparişini tamamlamak için bilgilerini kontrol et.</p>
                </div>

                <h3>Teslimat Bilgileri</h3>

                {!authUser && (
                  <div className="guestCheckoutInfo">
                    <div>
                      <b>Üye olmadan sipariş verebilirsiniz.</b>
                      <span>Üyelik zorunlu değildir. Üye olursanız sipariş geçmişinizi ve kargo bilgilerinizi hesabınızdan takip edebilirsiniz.</span>
                    </div>
                    <button type="button" onClick={()=>setAuthOpen(true)}>İSTEĞE BAĞLI ÜYE OL / GİRİŞ YAP</button>
                  </div>
                )}

                <input
                  name="name"
                  required
                  placeholder="Ad Soyad" defaultValue={savedAddress?.name || authUser?.name || ""}
                />

                <input
                  name="phone"
                  required
                  placeholder="Telefon" defaultValue={savedAddress?.phone || authUser?.phone || ""}
                />

                <input
                  name="email"
                  type="email"
                  required
                  placeholder="E-posta" defaultValue={savedAddress?.email || authUser?.email || ""}
                />

                <div className="checkoutTwo">

                  <input
                    name="city"
                    required
                    placeholder="İl" defaultValue={savedAddress?.city || ""}
                  />

                  <input
                    name="district"
                    required
                    placeholder="İlçe" defaultValue={savedAddress?.district || ""}
                  />

                </div>

                <div className="checkoutTwo">

                  <input
                    name="neighborhood"
                    placeholder="Mahalle" defaultValue={savedAddress?.neighborhood || ""}
                  />

                  <input
                    name="postalCode"
                    placeholder="Posta Kodu" defaultValue={savedAddress?.postalCode || ""}
                  />

                </div>

                <textarea
                  name="address"
                  required
                  placeholder="Açık adres" defaultValue={savedAddress?.address || ""}
                />

                <textarea
                  name="note"
                  placeholder="Sipariş notu"
                />

                <div className="paymentChoices contactPaymentChoices">
                  <label>
                    <input type="radio" name="paymentMethod" value="WhatsApp / Instagram" defaultChecked />
                    <span>
                      <b>WhatsApp veya Instagram üzerinden ödeme</b>
                      <small>Sipariş talebini oluşturduktan sonra iletişime geçip IBAN bilgilerini alacaksın.</small>
                    </span>
                  </label>
                </div>

                <div className="checkoutNotice">
                  Sipariş talebi oluşturulduğunda stok hemen düşmez. Ödeme kontrol edilip yönetici tarafından onaylandığında sipariş hazırlanır.
                </div>

                <input
                  type="hidden"
                  name="cargoFee"
                  value={checkoutCargoFee}
                />


                <div className="checkoutShippingSummary">
                  <div><span>Ara Toplam</span><b>{money(cartTotal)}</b></div>
                  <div><span>Kargo • Aras Kargo</span><b>{checkoutCargoFee===0 ? "Ücretsiz" : money(checkoutCargoFee)}</b></div>
                  {n(settings.freeShippingThreshold)>0 && <small>{money(settings.freeShippingThreshold)} ve üzeri siparişlerde kargo ücretsiz.</small>}
                </div>

                <div className="drawerTotal">
                  <span>Toplam</span>
                  <strong>
                    {money(checkoutGrandTotal)}
                  </strong>
                </div>

                <button
                  className="orderButton"
                  type="submit"
                >
                  SİPARİŞİ OLUŞTUR
                </button>

              </>
            ) : (
              <div className="success orderRequestSuccess">
                <b>✓</b>
                <h3>Sipariş Talebin Oluşturuldu</h3>
                <p>Sipariş No:</p>
                <strong>{orderSuccess.orderNo}</strong>
                <div className="successWarning">
                  Ödeme WhatsApp veya Instagram DM üzerinden yapılacaktır. Ödeme onaylanana kadar sipariş kesinleşmez ve stoktan düşmez.
                </div>
                <div className="successContactButtons">
                  <button type="button" onClick={()=>openWhatsAppOrder(orderSuccess)}>WHATSAPP İLE ÖDEME YAP</button>
                  <button type="button" onClick={()=>openInstagramOrder(orderSuccess)}>INSTAGRAM İLE SİPARİŞ VER</button>
                </div>
                <button
                  type="button"
                  className="secondarySuccessButton"
                  onClick={()=>{
                    setOrderSuccess(null);
                    setCheckout(false);
                    setCartOpen(false);
                    setAccountOpen(true);
                    setOrdersExpanded(true);
                    loadMyOrders({silent:myOrdersRef.current.length>0});
                  }}
                >
                  SİPARİŞLERİMDE GÖR
                </button>
              </div>
            )}

          </form>
        )}

      </aside>

    </div>
  );
}

